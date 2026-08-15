import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { ROLES } from '../src/config/constants';
import { workflowEngine } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';

describe('Scenario 4: Inventory Receiving & Stock Movement (+IN)', () => {
  beforeEach(() => {
    storageService.resetData();
    storageService.saveVendors([
      { id: 'VEN-01', code: 'V01', name: 'Vendor 1' }
    ]);
    storageService.saveProducts([
      { id: 'PROD-10', code: 'P10', name: 'Safety Helmet', category: 'PD', price: 500, stockBalance: 10, unit: 'ใบ', supplierId: 'VEN-01' }
    ]);
  });

  it('Receiving PO adds stock balance and generates +IN Stock Log', async () => {
    // 1. Create and Approve PR to get PO
    const pr = await workflowEngine.createPR({
      department: 'PD',
      source: 'FACTORY',
      purchaseChannel: 'SELF',
      requiredDate: '2026-09-01',
      items: [{ productId: 'PROD-10', code: 'P10', name: 'Safety Helmet', qty: 20, price: 500 }],
      totalAmount: 10000,
      reason: 'Safety equipment',
      isDraft: false
    }, ROLES.REQUESTER_PD);

    await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
    const { po } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

    // Initial stock was 10
    const initialProduct = storageService.getProducts().find(p => p.id === 'PROD-10');
    expect(initialProduct.stockBalance).toBe(10);

    // 2. Receive all goods
    const closedPO = await workflowEngine.closePO(po.id, ROLES.REQUESTER_PD, 'รับสินค้าเข้าคลังเต็มจำนวน');

    expect(closedPO.status).toBe('CLOSED');
    expect(closedPO.items[0].receivedQty).toBe(20);

    // 3. Verify Stock Balance is updated: 10 + 20 = 30
    const updatedProducts = storageService.getProducts();
    const updatedProduct = updatedProducts.find(p => p.id === 'PROD-10');
    expect(updatedProduct.stockBalance).toBe(30);

    // 4. Verify Stock Logs has +IN entry
    const stockLogs = storageService.getStockLogs();
    const lastLog = stockLogs.find(l => l.productId === 'PROD-10');
    expect(lastLog).toBeDefined();
    expect(lastLog.type).toBe('IN');
    expect(lastLog.qty).toBe(20);
    expect(lastLog.balance).toBe(30);
    expect(lastLog.docNo).toBe(po.poNo);

    // 5. Verify Associated PR is also CLOSED
    const prs = storageService.getPRs();
    const updatedPR = prs.find(p => p.id === pr.id);
    expect(updatedPR.status).toBe('CLOSED');
  });
});
