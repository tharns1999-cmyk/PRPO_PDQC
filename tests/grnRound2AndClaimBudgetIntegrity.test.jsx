import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReceivingModal from '../src/views/inventory/ReceivingModal';
import { storageService } from '../src/services/storageService';
import { budgetService } from '../src/services/budgetService';
import { workflowEngine } from '../src/services/workflowEngine';
import { warehouseService } from '../src/services/warehouseService';

describe('GRN Round 2+ & Claim Budget Integrity Verification', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  // ── Scenario 1: Fully Received ──
  it('Scenario 1 (Fully Received): Ordered=5, Accumulated=5, Refunded=0 -> Remaining=0. Inputs disabled, displays "✓ ตรวจรับครบแล้วในรอบก่อน"', async () => {
    const po = {
      id: 'PO-SCENARIO-1',
      poNo: 'PO-SC-001',
      status: 'WAITING_DELIVERY_ROUND_2',
      department: 'PD',
      items: [
        {
          productId: 'PROD-01',
          code: 'CODE-01',
          name: 'Item Scenario 1',
          orderedQty: 5,
          accumulatedReceived: 5,
          receivedQty: 5,
          refundedQty: 0,
          purchaseUnit: 'ชิ้น',
          unitPrice: 100
        }
      ]
    };

    const html = renderToStaticMarkup(<ReceivingModal po={po} isOpen={true} />);

    // Row status badge
    expect(html).toContain('✓ ตรวจรับครบแล้วในรอบก่อน');

    // Input must be disabled with locked styling
    expect(html).toContain('bg-slate-100 text-slate-400 cursor-not-allowed');
    expect(html).toContain('disabled=""');

    // Value must be 0
    expect(html).toContain('value="0"');

    storageService.savePOs([po]);

    // Defensive Warehouse Submission Verification: clamped to 0
    const grnResult = await warehouseService.submitGRN(
      po.id,
      {
        items: [
          {
            productId: 'PROD-01',
            acceptedQty: 5, // attempt to receive 5 more
            damagedQty: 0
          }
        ]
      },
      { user: { name: 'Inspector' } }
    );

    const updatedItem = grnResult.po.items.find(i => i.productId === 'PROD-01');
    expect(updatedItem.accumulatedReceived).toBe(5);
    expect(updatedItem.receivedQty).toBe(5);
  });

  // ── Scenario 2: Full/Partial Refund Settled (ITM-002 Case) ──
  it('Scenario 2 (Full/Partial Refund Settled - ITM-002 case): Ordered=5, Accumulated=4, Refunded=1 -> Remaining=0. Inputs disabled, displays "💰 ได้รับเงินคืนแล้ว ฿246.00 (ปิดรับ)", Zero physical receiving allowed', async () => {
    // Initial product stock balance
    storageService.saveProducts([
      {
        id: 'PROD-ITM-002',
        code: 'ITM-002',
        name: 'น้ำมันหล่อลื่นสังเคราะห์',
        stockBalance: 10,
        price: 246
      }
    ]);

    // Exact state representing ITM-002 before patch: store-level claim resolved as REFUND (฿246.00), item-level refundedQty omitted
    const po = {
      id: 'PO-ONLINE-ITM002',
      poNo: 'PO-2026-ITM002',
      status: 'PARTIALLY_RECEIVED_IN_CLAIM',
      department: 'PD',
      departmentId: 'PD',
      storeClaims: {
        'Shopee_แ้ก้กเก้ดเ้ด': {
          type: 'REFUND',
          actionType: 'REFUND',
          resolutionType: 'REFUND',
          refundAmount: 246,
          isResolved: true,
          resolvedAt: '2026-09-12T10:00:00.000Z',
          note: 'คืนเงิน 246.00 บาท'
        }
      },
      items: [
        {
          productId: 'PROD-ITM-002',
          code: 'ITM-002',
          name: 'น้ำมันหล่อลื่นสังเคราะห์',
          orderedQty: 5,
          accumulatedReceived: 4,
          receivedQty: 4,
          actualStoreName: 'แ้ก้กเก้ดเ้ด',
          storePlatform: 'Shopee',
          storeKey: 'Shopee_แ้ก้กเก้ดเ้ด',
          unitPrice: 246,
          actualPrice: 246,
          purchaseUnit: 'ขวด',
          hasDispute: true,
          isDamaged: true,
          damagedQty: 1
          // Note: item.refundedQty and item.claimResolution are intentionally unpopulated initially
        }
      ]
    };

    // Render ReceivingModal
    const html = renderToStaticMarkup(<ReceivingModal po={po} isOpen={true} />);

    // Must show refund badge with exact amount ฿246.00
    expect(html).toContain('💰 ได้รับเงินคืนแล้ว ฿246.00 (ปิดรับ)');

    // Row styling must be muted opacity-80 bg-slate-50/50
    expect(html).toContain('opacity-80 bg-slate-50/50');

    // Inputs must be disabled with required lock classes
    expect(html).toContain('bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200 select-none');
    expect(html).toContain('disabled=""');
    expect(html).toContain('value="0"');

    // Save PO and test defensive submission guard in warehouseService
    storageService.savePOs([po]);

    const grnResult = await warehouseService.submitGRN(
      po.id,
      {
        items: [
          {
            productId: 'PROD-ITM-002',
            acceptedQty: 1, // Malicious attempt to receive the refunded 1 unit
            damagedQty: 0
          }
        ]
      },
      { user: { name: 'Inspector' } }
    );

    // Verify PO Item remains at accumulatedReceived = 4 and remaining = 0
    const updatedItem = grnResult.po.items.find(i => i.productId === 'PROD-ITM-002');
    expect(updatedItem.accumulatedReceived).toBe(4);
    expect(updatedItem.refundedQty).toBe(1);
    expect(updatedItem.claimResolution).toBe('REFUND');
    expect(updatedItem.isSettled).toBe(true);

    // Verify ZERO stock balance increment for refunded item
    const products = storageService.getProducts();
    const prod = products.find(p => p.id === 'PROD-ITM-002');
    expect(prod.stockBalance).toBe(10); // Untouched: 10 + 0 = 10

    // Verify ZERO movement logs produced
    const logs = storageService.getStockLogs();
    const itmLogs = logs.filter(l => l.productId === 'PROD-ITM-002');
    expect(itmLogs.length).toBe(0);
  });

  // ── Scenario 3: Outstanding Replacement (PD-CLN-IND Case) ──
  it('Scenario 3 (Outstanding Replacement - PD-CLN-IND case): Ordered=5, Accumulated=4, Replacement Pending=1, Refunded=0 -> Remaining=1. Inputs enabled with max=1, badge shows replacement', () => {
    const po = {
      id: 'PO-REPLACEMENT-PD-CLN',
      poNo: 'PO-2026-CLN01',
      status: 'ORDERED_PENDING_DELIVERY',
      department: 'PD',
      items: [
        {
          productId: 'PROD-PD-CLN',
          code: 'PD-CLN-IND',
          name: 'น้ำยาทำความสะอาดอุตสาหกรรม',
          orderedQty: 5,
          accumulatedReceived: 4,
          receivedQty: 4,
          replacementPendingQty: 1,
          refundedQty: 0,
          claimResolution: 'REPLACEMENT',
          isSettled: false,
          purchaseUnit: 'ถัง',
          unitPrice: 500
        }
      ]
    };

    const html = renderToStaticMarkup(<ReceivingModal po={po} isOpen={true} />);

    // Remaining = 5 - 4 - 0 = 1
    expect(html).toContain('value="1"');
    expect(html).toContain('max="1"');
    expect(html).toContain('min="0"');

    // Contextual badge for replacement
    expect(html).toContain('📦 รอรับของทดแทน 1 ถัง');
    expect(html).not.toContain('💰 ได้รับเงินคืนแล้ว');
    expect(html).not.toContain('✓ ตรวจรับครบแล้วในรอบก่อน');
  });

  // ── Scenario 4: Outstanding Split Shipment (PD-BLT-380 Case) ──
  it('Scenario 4 (Outstanding Split Shipment - PD-BLT-380 case): Ordered=5, Accumulated=4, Wait Next Round=1, Refunded=0 -> Remaining=1. Inputs enabled with max=1, badge shows split shipment', () => {
    const po = {
      id: 'PO-SPLIT-PD-BLT',
      poNo: 'PO-2026-BLT01',
      status: 'WAITING_DELIVERY_ROUND_2',
      department: 'PD',
      items: [
        {
          productId: 'PROD-PD-BLT',
          code: 'PD-BLT-380',
          name: 'สายพานลำเลียงอุตสาหกรรม',
          orderedQty: 5,
          accumulatedReceived: 4,
          receivedQty: 4,
          shortageQty: 1,
          shortageAction: 'WAIT_NEXT_ROUND',
          shortageReason: 'SPLIT_SHIPMENT',
          refundedQty: 0,
          purchaseUnit: 'เส้น',
          unitPrice: 850
        }
      ]
    };

    const html = renderToStaticMarkup(<ReceivingModal po={po} isOpen={true} />);

    // Remaining = 5 - 4 - 0 = 1
    expect(html).toContain('value="1"');
    expect(html).toContain('max="1"');
    expect(html).toContain('min="0"');

    // Contextual badge for split shipment
    expect(html).toContain('⏳ รอรับรอบถัดไป 1 เส้น');
    expect(html).not.toContain('💰 ได้รับเงินคืนแล้ว');
  });

  // ── Scenario 5: Budget Protection & Idempotency ──
  it('Scenario 5 (Budget Protection): Submitting GRN Round 2 does not alter or erase the refund credit recorded in Department Budget, and ensures idempotent refund reconciliation', async () => {
    // Initialise budget for PD
    const initialBudgets = {
      PD: {
        monthlyBudget: 100000,
        spent: 25000,
        actualExpense: 25000,
        variance: 75000,
        remainingBudget: 75000
      }
    };
    storageService.saveBudgets(initialBudgets);

    // Initialise PO with store claim refund
    const po = {
      id: 'PO-BUDGET-PROT-01',
      poNo: 'PO-PD-2026-BP01',
      status: 'PARTIALLY_RECEIVED_IN_CLAIM',
      department: 'PD',
      departmentId: 'PD',
      grandTotal: 1246,
      storeClaims: {
        'Shopee_แ้ก้กเก้ดเ้ด': {
          type: 'REFUND',
          refundAmount: 246,
          isResolved: true,
          resolvedAt: '2026-09-12T10:00:00.000Z',
          note: 'คืนเงิน 246.00 บาท'
        }
      },
      items: [
        {
          productId: 'PROD-ITM-002',
          code: 'ITM-002',
          name: 'น้ำมันหล่อลื่นสังเคราะห์',
          orderedQty: 5,
          accumulatedReceived: 4,
          receivedQty: 4,
          actualStoreName: 'แ้ก้กเก้ดเ้ด',
          storePlatform: 'Shopee',
          storeKey: 'Shopee_แ้ก้กเก้ดเ้ด',
          unitPrice: 246,
          actualPrice: 246,
          purchaseUnit: 'ขวด',
          hasDispute: true,
          damagedQty: 1
        }
      ]
    };
    storageService.savePOs([po]);

    // 1. Credit budget for the refund (฿246)
    const credResult = await budgetService.creditDepartmentBudget({
      department: 'PD',
      amount: 246,
      referencePo: po.poNo,
      storeKey: 'Shopee_แ้ก้กเก้ดเ้ด',
      reason: 'Refund for ITM-002',
      actor: 'Purchaser'
    });

    expect(credResult.success).toBe(true);

    const budgetsAfterRefund = storageService.getBudgets();
    expect(budgetsAfterRefund.PD.spent).toBe(24754); // 25000 - 246 = 24754
    expect(budgetsAfterRefund.PD.variance).toBe(75246); // 75000 + 246 = 75246

    // 2. Submit GRN Round 2 for other items (or no-op for ITM-002)
    await warehouseService.submitGRN(
      po.id,
      {
        items: [
          {
            productId: 'PROD-ITM-002',
            acceptedQty: 0,
            damagedQty: 0
          }
        ]
      },
      { user: { name: 'Inspector' } }
    );

    // 3. Verify that GRN Round 2 submission DID NOT alter or erase the refund credit recorded in Department Budget
    const budgetsAfterGRN = storageService.getBudgets();
    expect(budgetsAfterGRN.PD.spent).toBe(24754);
    expect(budgetsAfterGRN.PD.variance).toBe(75246);

    // 4. Test idempotency: attempting to credit same refund again is blocked
    const duplicateCred = await budgetService.creditDepartmentBudget({
      department: 'PD',
      amount: 246,
      referencePo: po.poNo,
      storeKey: 'Shopee_แ้ก้กเก้ดเ้ด',
      reason: 'Duplicate retry',
      actor: 'Purchaser'
    });

    expect(duplicateCred.alreadyReconciled).toBe(true);

    // Budget ledger remains intact with exactly 1 transaction
    const txs = storageService.getBudgetTransactions();
    const refTxs = txs.filter(t => t.referencePo === po.poNo);
    expect(refTxs.length).toBe(1);
    expect(refTxs[0].amount).toBe(246);
  });
});
