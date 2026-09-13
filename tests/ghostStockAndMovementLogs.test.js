import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { storageService } from '../src/services/storageService';
import { warehouseService } from '../src/services/warehouseService';
import { receiveToStock } from '../src/context/InventoryContext';
import { workflowEngine } from '../src/services/workflowEngine';

describe('Ghost Stock Prevention & Atomic Stock Movement Logging', () => {
  beforeEach(() => {
    storageService.resetData();
    storageService.saveProducts([
      {
        id: 'PROD-PD-1789273108904',
        code: 'itm-001',
        name: 'ถุงมือยางใหม่',
        category: 'PD',
        price: 15,
        stockUnit: 'ชิ้น',
        purchaseUnit: 'ชิ้น',
        conversionRate: 1,
        unit: 'ชิ้น',
        stockBalance: 7
      },
      {
        id: 'PROD-PD-003',
        code: 'PD-BLT-380',
        name: 'สายพานลำเลียงทนความร้อน',
        category: 'PD',
        price: 450,
        stockUnit: 'เส้น',
        purchaseUnit: 'เส้น',
        conversionRate: 1,
        unit: 'เส้น',
        stockBalance: 10
      }
    ]);

    storageService.savePOs([
      {
        id: 'PO-2026-TEST-001',
        poNo: 'PO-PD-2026-001',
        status: 'ORDERED_PENDING_DELIVERY',
        department: 'PD',
        items: [
          {
            productId: 'PROD-PD-1789273108904',
            code: 'itm-001',
            name: 'ถุงมือยางใหม่',
            orderedQty: 10,
            receivedQty: 0,
            price: 15,
            actUnitPrice: 15
          }
        ]
      }
    ]);

    storageService.saveStockLogs([]);
  });

  it('1. Atomic Transaction: GRN receipt synchronously updates stockBalance AND writes Movement Log (+IN)', async () => {
    const poId = 'PO-2026-TEST-001';
    const grnPayload = {
      grnNumber: 'GRN-PO-PD-2026-001-01',
      round: 1,
      receivedDate: new Date().toISOString(),
      receivedBy: { name: 'คุณวิชัย', title: 'Requester (PD)' },
      receivingItems: [
        {
          productId: 'PROD-PD-1789273108904',
          code: 'itm-001',
          name: 'ถุงมือยางใหม่',
          receivedThisTime: 5,
          goodQty: 5,
          damagedQty: 0,
          unitPrice: 15,
          actualPrice: 15
        }
      ],
      note: 'รับของรอบที่ 1 สมบูรณ์'
    };

    // Execute atomic GRN submission
    const result = await warehouseService.submitGRN(poId, grnPayload, {
      user: { name: 'คุณวิชัย', title: 'Requester (PD)' }
    });

    expect(result.success).toBe(true);

    // 1. Verify Stock Balance increased from 7 to 12
    const updatedProd = storageService.getProducts().find(p => p.code === 'itm-001');
    expect(updatedProd).toBeDefined();
    expect(updatedProd.stockBalance).toBe(12);

    // 2. Verify Movement Log (+IN) was created atomically
    const logs = storageService.getStockLogs().filter(l => l.productCode === 'itm-001' || l.productId === updatedProd.id);
    expect(logs.length).toBe(1);

    const log = logs[0];
    expect(log.type).toBe('IN');
    expect(log.qty).toBe(5);
    expect(log.balance).toBe(12);
    expect(log.documentNo).toBe('GRN-PO-PD-2026-001-01');
    expect(log.poNo).toBe('PO-PD-2026-001');
    expect(log.unitPrice).toBe(15);
    expect(log.user).toContain('คุณวิชัย');
  });

  it('2. Standardized Log Schema: Log entry contains all required enterprise fields', async () => {
    const items = [
      {
        productId: 'PROD-PD-003',
        code: 'PD-BLT-380',
        name: 'สายพานลำเลียงทนความร้อน',
        qty: 3,
        receivedQty: 3,
        damagedQty: 0,
        unitPrice: 450,
        actualPrice: 450,
        docNo: 'PO-PD-2026-002',
        grNumber: 'GRN-PO-PD-2026-002-01'
      }
    ];

    await receiveToStock(items, {
      docNo: 'PO-PD-2026-002',
      poNo: 'PO-PD-2026-002',
      poNumber: 'PO-PD-2026-002',
      grNumber: 'GRN-PO-PD-2026-002-01',
      user: 'คุณสมชาย (Asst. Mgr)',
      note: 'รับสินค้าสมบูรณ์ 3 เส้น'
    });

    const logs = storageService.getStockLogs().filter(l => l.productCode === 'PD-BLT-380');
    expect(logs.length).toBe(1);
    const log = logs[0];

    // Check all required schema fields
    expect(log.id).toBeDefined();
    expect(typeof log.id).toBe('string');
    expect(log.date).toBeDefined();
    expect(log.type).toBe('IN');
    expect(log.documentNo).toBe('GRN-PO-PD-2026-002-01');
    expect(log.poNo).toBe('PO-PD-2026-002');
    expect(log.qty).toBe(3);
    expect(log.balance).toBe(13); // 10 + 3
    expect(log.unitPrice).toBe(450);
    expect(log.user).toBe('คุณสมชาย (Asst. Mgr)');
  });

  it('3. Self-Healing Data Migration: Auto-generates +IN (System Initial Balance) for Ghost Stock (stock > 0 and logs === 0)', () => {
    // Current state: itm-001 has stockBalance = 7, but 0 movement logs exist
    const prod = storageService.getProducts().find(p => p.code === 'itm-001');
    expect(prod.stockBalance).toBe(7);

    // Initial logs are empty
    const initialLogs = storageService.getStockLogs().filter(l => l.productCode === 'itm-001');
    expect(initialLogs.length).toBe(0);

    // Query logs through warehouseService self-healing resolver
    const resolvedLogs = warehouseService.getStockMovementLogs(prod);

    // Should return auto-healed log row
    expect(resolvedLogs.length).toBe(1);
    const healedLog = resolvedLogs[0];
    expect(healedLog.type).toBe('IN');
    expect(healedLog.documentNo).toContain('INITIAL-BALANCE');
    expect(healedLog.qty).toBe(7);
    expect(healedLog.balance).toBe(7);
    expect(healedLog.user).toBe('System Initial Balance');
    expect(healedLog.note).toContain('System Initial Balance');

    // Verify it is permanently persisted to storageService
    const storedLogs = storageService.getStockLogs().filter(l => l.productCode === 'itm-001');
    expect(storedLogs.length).toBe(1);
    expect(storedLogs[0].id).toBe(healedLog.id);
  });

  it('4. Resilient Matching: WorkflowEngine receiveGoods matches products across productId, code, and name', async () => {
    const po = {
      id: 'PO-2026-TEST-MATCH',
      poNo: 'PO-PD-2026-099',
      status: 'ORDERED_PENDING_DELIVERY',
      department: 'PD',
      items: [
        {
          productId: 'itm-001', // Using code as productId
          code: 'itm-001',
          name: 'ถุงมือยางใหม่',
          orderedQty: 2,
          receivedQty: 0,
          price: 15
        }
      ]
    };

    storageService.savePOs([po]);

    const receivingItems = [
      {
        productId: 'itm-001',
        receivedThisTime: 2
      }
    ];

    await workflowEngine.receiveGoods(
      po.id,
      receivingItems,
      { name: 'คุณวิชัย', title: 'Requester' },
      'รับตรวจครบ',
      { grNumber: 'GRN-PO-PD-2026-099-01' }
    );

    // Product stockBalance should increment from 7 to 9
    const updatedProd = storageService.getProducts().find(p => p.code === 'itm-001');
    expect(updatedProd.stockBalance).toBe(9);

    // Movement log should be recorded
    const logs = storageService.getStockLogs().filter(l => l.productCode === 'itm-001');
    expect(logs.some(l => l.qty === 2 && l.balance === 9)).toBe(true);
  });
});
