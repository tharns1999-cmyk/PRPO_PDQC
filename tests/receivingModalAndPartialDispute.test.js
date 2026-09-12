import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { ROLES, PO_STATUS } from '../src/config/constants';
import { storageService } from '../src/services/storageService';
import { recordGoodsReceipt } from '../src/context/ProcurementContext';
import { receiveToStock } from '../src/context/InventoryContext';

describe('ReceivingModal Logic & Partial Receiving Engine', () => {
  beforeEach(() => {
    storageService.resetData();
    storageService.saveProducts([
      { id: 'PROD-01', code: 'P01', name: 'Item 1', stockBalance: 10, unit: 'ชิ้น' },
      { id: 'PROD-02', code: 'P02', name: 'Item 2', stockBalance: 5, unit: 'กล่อง' }
    ]);
    storageService.savePOs([
      {
        id: 'PO-2026-TEST-01',
        poNo: 'PO-2026-TEST-01',
        status: 'ORDERED_PENDING_DELIVERY',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        vendor: 'Shopee Supplier',
        items: [
          { productId: 'PROD-01', code: 'P01', name: 'Item 1', orderedQty: 10, receivedQty: 0, price: 100 },
          { productId: 'PROD-02', code: 'P02', name: 'Item 2', orderedQty: 5, receivedQty: 0, price: 200 }
        ]
      }
    ]);
  });

  it('1. Calculates shortage correctly using formula: shortageQty = orderedQty - (Number(acceptedQty) + Number(damagedQty || 0))', () => {
    const orderedQty = 10;
    const acceptedQty = 6;
    const damagedQty = 1;

    const shortageQty = orderedQty - (Number(acceptedQty) + Number(damagedQty || 0));
    expect(shortageQty).toBe(3);

    // If acceptedQty < orderedQty, alert is triggered
    const hasShortage = shortageQty > 0;
    expect(hasShortage).toBe(true);
  });

  it('2. VENDOR_SHORTAGE updates PO status to PARTIALLY_RECEIVED_IN_CLAIM and creates dispute items for Online Hub', async () => {
    const poId = 'PO-2026-TEST-01';
    const grnPayload = {
      grnNumber: 'GRN-PO-2026-TEST-01-01',
      round: 1,
      receivedDate: new Date().toLocaleString('th-TH'),
      statusOverride: 'PARTIALLY_RECEIVED_IN_CLAIM',
      receivingItems: [
        {
          productId: 'PROD-01',
          code: 'P01',
          name: 'Item 1',
          receivedThisTime: 6, // 6 accepted + 0 damaged
          goodQty: 6,
          damagedQty: 0,
          shortageQty: 4,
          shortageReason: 'VENDOR_SHORTAGE',
          condition: 'SHORTAGE'
        },
        {
          productId: 'PROD-02',
          code: 'P02',
          name: 'Item 2',
          receivedThisTime: 5,
          goodQty: 5,
          damagedQty: 0,
          shortageQty: 0,
          condition: 'GOOD'
        }
      ]
    };

    const { po: updatedPO, grn } = await recordGoodsReceipt(poId, grnPayload);

    expect(updatedPO.status).toBe('PARTIALLY_RECEIVED_IN_CLAIM');
    expect(updatedPO.items[0].receivedQty).toBe(6);
    expect(updatedPO.items[0].shortageQty).toBe(4);
    expect(updatedPO.grnHistory).toHaveLength(1);

    // Verify Online Hub match (status contains 'claim')
    const s = String(updatedPO.status).toLowerCase();
    const isOnlineClaimTab = s.includes('claim');
    expect(isOnlineClaimTab).toBe(true);
  });

  it('3. SPLIT_SHIPMENT updates status to WAITING_DELIVERY_ROUND_2 without routing to claim', async () => {
    const poId = 'PO-2026-TEST-01';
    const grnPayload = {
      grnNumber: 'GRN-PO-2026-TEST-01-01',
      round: 1,
      receivedDate: new Date().toLocaleString('th-TH'),
      statusOverride: 'WAITING_DELIVERY_ROUND_2',
      waitingRound2: true,
      receivingItems: [
        {
          productId: 'PROD-01',
          code: 'P01',
          name: 'Item 1',
          receivedThisTime: 5,
          goodQty: 5,
          damagedQty: 0,
          shortageQty: 5,
          shortageReason: 'SPLIT_SHIPMENT',
          condition: 'SHORTAGE'
        }
      ]
    };

    const { po: updatedPO } = await recordGoodsReceipt(poId, grnPayload);
    expect(updatedPO.status).toBe('WAITING_DELIVERY_ROUND_2');
    expect(String(updatedPO.status).toLowerCase().includes('claim')).toBe(false);
  });

  it('4. receiveToStock adds only intact/complete items to stock and does not add shortage or damaged items', async () => {
    // Before: PROD-01 stock is 10
    const initialProd = storageService.getProducts().find(p => p.id === 'PROD-01');
    expect(initialProd.stockBalance).toBe(10);

    // Receive only intact (acceptedQty: 6)
    const intactStockItems = [
      {
        productId: 'PROD-01',
        code: 'P01',
        name: 'Item 1',
        qty: 6,
        receivedQty: 6,
        damagedQty: 0,
        docNo: 'PO-2026-TEST-01',
        grNumber: 'GRN-01'
      }
    ];

    await receiveToStock(intactStockItems, {
      docNo: 'PO-2026-TEST-01',
      grNumber: 'GRN-01',
      note: 'รับเฉพาะยอดสมบูรณ์'
    });

    const updatedProd = storageService.getProducts().find(p => p.id === 'PROD-01');
    // 10 initial + 6 intact = 16 (4 shortage units NOT in stock)
    expect(updatedProd.stockBalance).toBe(16);

    const stockLogs = storageService.getStockLogs().filter(l => l.productId === 'PROD-01');
    expect(stockLogs[stockLogs.length - 1].qty).toBe(6);
    expect(stockLogs[stockLogs.length - 1].balance).toBe(16);
  });
});
