import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';
import { storageService } from '../src/services/storageService';
import { PO_STATUS } from '../src/config/constants';
import { useProcurementContext } from '../src/context/ProcurementContext';
import { useBudgetContext } from '../src/context/BudgetContext';
import { useInventoryContext } from '../src/context/InventoryContext';

describe('State Engine: Partial Receiving, GRN Tracking, & Budget Reversal', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(() => Promise.reject(new Error('Backend offline in test')));
    storageService.resetData();
    storageService.saveVendors([
      { id: 'VEN-01', code: 'V01', name: 'Standard Supplier' }
    ]);
    storageService.saveProducts([
      { id: 'PROD-A', code: 'SKU-A', name: 'Product Alpha', category: 'PD', price: 100, stockBalance: 20, unit: 'ชิ้น', conversionRate: 1 },
      { id: 'PROD-B', code: 'SKU-B', name: 'Product Beta', category: 'PD', price: 200, stockBalance: 5, unit: 'ชิ้น', conversionRate: 1 }
    ]);
  });

  it('1. Verifies PO_STATUS constants include extended partial and claim statuses', () => {
    expect(PO_STATUS.PARTIALLY_RECEIVED_IN_CLAIM).toBeDefined();
    expect(PO_STATUS.PARTIALLY_RECEIVED_IN_CLAIM.id).toBe('PARTIALLY_RECEIVED_IN_CLAIM');
    expect(PO_STATUS.COMPLETED_WITH_REFUND).toBeDefined();
    expect(PO_STATUS.COMPLETED_WITH_REFUND.id).toBe('COMPLETED_WITH_REFUND');
    expect(PO_STATUS.WAITING_DELIVERY_ROUND_2).toBeDefined();
    expect(PO_STATUS.WAITING_DELIVERY_ROUND_2.id).toBe('WAITING_DELIVERY_ROUND_2');
  });

  it('2. recordGoodsReceipt updates line-item contracts (orderedQty, receivedQty, damagedQty, shortageQty) and records GRN round', async () => {
    const initialPO = {
      id: 'PO-TEST-001',
      poNo: 'PO-PD-2026-999',
      prNo: 'PD001/2026',
      status: 'ISSUED',
      department: 'PD',
      grandTotal: 3000,
      items: [
        {
          productId: 'PROD-A',
          code: 'SKU-A',
          name: 'Product Alpha',
          orderedQty: 10,
          purchaseQty: 10,
          qty: 10,
          receivedQty: 0,
          damagedQty: 0,
          shortageQty: 10,
          price: 100
        },
        {
          productId: 'PROD-B',
          code: 'SKU-B',
          name: 'Product Beta',
          orderedQty: 10,
          purchaseQty: 10,
          qty: 10,
          receivedQty: 0,
          damagedQty: 0,
          shortageQty: 10,
          price: 200
        }
      ]
    };
    storageService.savePOs([initialPO]);

    const procurement = useProcurementContext();

    // Round 1: Partial receipt of PROD-A (6 units received, 1 damaged) and PROD-B (4 units received, 0 damaged)
    const grnPayloadRound1 = {
      grnNumber: 'GRN-PO-PD-2026-999-01',
      round: 1,
      receivedBy: 'QC Inspector A',
      note: 'ตรวจรับรอบที่ 1 พบของไม่ครบและมีของชำรุด',
      receivingItems: [
        { productId: 'PROD-A', receivedThisTime: 6, damagedQty: 1, condition: 'DAMAGED' },
        { productId: 'PROD-B', receivedThisTime: 4, damagedQty: 0, condition: 'GOOD' }
      ]
    };

    const res1 = await procurement.recordGoodsReceipt('PO-TEST-001', grnPayloadRound1);
    expect(res1.success).toBe(true);

    const poAfterRound1 = res1.po;
    expect(poAfterRound1.status).toBe('PARTIALLY_RECEIVED_IN_CLAIM');
    expect(poAfterRound1.grnHistory).toHaveLength(1);
    expect(poAfterRound1.grnHistory[0].grnNumber).toBe('GRN-PO-PD-2026-999-01');

    // PROD-A: ordered 10, received 6, damaged 1, shortage 4
    const itemA = poAfterRound1.items.find(i => i.productId === 'PROD-A');
    expect(itemA.orderedQty).toBe(10);
    expect(itemA.receivedQty).toBe(6);
    expect(itemA.damagedQty).toBe(1);
    expect(itemA.shortageQty).toBe(4);

    // PROD-B: ordered 10, received 4, damaged 0, shortage 6
    const itemB = poAfterRound1.items.find(i => i.productId === 'PROD-B');
    expect(itemB.orderedQty).toBe(10);
    expect(itemB.receivedQty).toBe(4);
    expect(itemB.damagedQty).toBe(0);
    expect(itemB.shortageQty).toBe(6);

    // Round 2: Supplier delivers replacement round
    const grnPayloadRound2 = {
      grnNumber: 'GRN-PO-PD-2026-999-02',
      round: 2,
      receivedBy: 'QC Inspector B',
      statusOverride: 'COMPLETED_WITH_REFUND',
      note: 'รับสินค้าชดเชยและเคลียร์ส่วนต่างด้วยการคืนเงิน',
      receivingItems: [
        { productId: 'PROD-A', receivedThisTime: 4, damagedQty: 0 },
        { productId: 'PROD-B', receivedThisTime: 6, damagedQty: 0 }
      ]
    };

    const res2 = await procurement.recordGoodsReceipt('PO-TEST-001', grnPayloadRound2);
    expect(res2.success).toBe(true);
    const poAfterRound2 = res2.po;

    expect(poAfterRound2.status).toBe('COMPLETED_WITH_REFUND');
    expect(poAfterRound2.grnHistory).toHaveLength(2);
    const itemA2 = poAfterRound2.items.find(i => i.productId === 'PROD-A');
    expect(itemA2.receivedQty).toBe(10);
    expect(itemA2.shortageQty).toBe(0);
  });

  it('3. rollbackBudget reduces actualExpense/spent, restores remainingBudget/variance, and appends ledger transaction', async () => {
    storageService.saveBudgets({
      PD: {
        monthlyBudget: 100000,
        spent: 40000,
        actualExpense: 40000,
        variance: 60000,
        remainingBudget: 60000
      }
    });

    const budgetCtx = useBudgetContext();
    const refundRes = await budgetCtx.rollbackBudget('PD', 5000, 'คืนเงินค่าสินค้าเสียหายจาก PO-PD-2026-999');

    expect(refundRes.success).toBe(true);
    expect(refundRes.refundAmount).toBe(5000);
    expect(refundRes.actualExpense).toBe(35000);
    expect(refundRes.remainingBudget).toBe(65000);

    // Verify persisted budgets
    const updatedBudgets = storageService.getBudgets();
    expect(updatedBudgets.PD.spent).toBe(35000);
    expect(updatedBudgets.PD.variance).toBe(65000);

    // Verify Ledger Transaction
    const transactions = storageService.getBudgetTransactions();
    expect(transactions.length).toBeGreaterThanOrEqual(1);
    const latestTx = transactions[0];
    expect(latestTx.dept).toBe('PD');
    expect(latestTx.type).toBe('BUDGET_ROLLBACK');
    expect(latestTx.amount).toBe(5000);
  });

  it('4. receiveToStock receives only complete/good items and ignores damaged units for stockBalance', async () => {
    const inventory = useInventoryContext();

    // PROD-A initial stock: 20
    // PROD-B initial stock: 5
    const initialProds = storageService.getProducts();
    expect(initialProds.find(p => p.id === 'PROD-A').stockBalance).toBe(20);
    expect(initialProds.find(p => p.id === 'PROD-B').stockBalance).toBe(5);

    // Receive with partial damage: PROD-A received 10 with 3 damaged -> net +7
    // PROD-B received 4 with 4 damaged (100% damaged) -> net +0
    const receiptItems = [
      { productId: 'PROD-A', receivedQty: 10, damagedQty: 3, docNo: 'PO-PD-001' },
      { productId: 'PROD-B', receivedQty: 4, damagedQty: 4, docNo: 'PO-PD-001' }
    ];

    const stockRes = await inventory.receiveToStock(receiptItems, { docNo: 'PO-PD-001', note: 'ตรวจรับรอบ 1' });
    expect(stockRes.success).toBe(true);

    const updatedProds = storageService.getProducts();
    const prodA = updatedProds.find(p => p.id === 'PROD-A');
    const prodB = updatedProds.find(p => p.id === 'PROD-B');

    // 20 + (10 - 3) = 27
    expect(prodA.stockBalance).toBe(27);
    // 5 + (4 - 4) = 5 (unchanged because all were damaged)
    expect(prodB.stockBalance).toBe(5);

    // Verify stock logs
    const logs = storageService.getStockLogs();
    const prodALog = logs.find(l => l.productId === 'PROD-A' && (l.docNo === 'GRN-PO-PD-001-01' || l.refPo === 'PO-PD-001' || l.poNo === 'PO-PD-001'));
    expect(prodALog).toBeDefined();
    expect(prodALog.docNo).toBe('GRN-PO-PD-001-01');
    expect(prodALog.type).toBe('IN');
    expect(prodALog.qty).toBe(7);
    expect(prodALog.balance).toBe(27);
  });
});
