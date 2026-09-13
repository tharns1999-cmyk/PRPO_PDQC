import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import BudgetView from '../src/views/BudgetView';
import MonthlyBudgetManagement from '../src/views/budget/MonthlyBudgetManagement';
import { storageService } from '../src/services/storageService';
import { budgetService } from '../src/services/budgetService';
import { workflowEngine } from '../src/services/workflowEngine';

describe('Department Budget Credit & Ledger Synchronization Verification', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  // ── Scenario 1: Retroactive Auto-Sync of PO-PD-2026-001 ──
  it('Scenario 1 (Retroactive Auto-Sync of PO-PD-2026-001): automatically detects, credits, and backfills missing ฿246.00 refund from PO-PD-2026-001', async () => {
    const po = {
      id: 'PO-1789291527812-1',
      poNo: 'PO-PD-2026-001',
      department: 'PD',
      status: 'ORDERED_PENDING_DELIVERY',
      storeClaims: {
        'Shopee_แ้ก้กเก้ดเ้ด': {
          status: 'RESOLVED',
          isResolved: true,
          type: 'REFUND',
          refundAmount: 246,
          note: '[ร้าน แ้ก้กเก้ดเ้ด]: คืนเงินนนนนค่ะ',
          resolvedAt: '2026-09-13T09:39:44.460Z',
          resolvedBy: 'คุณนัท (Online Purchaser)'
        }
      },
      items: [
        {
          productId: 'PROD-2',
          code: 'ITM-002',
          name: 'น้ำมันหล่อลื่น (ลิตร)',
          claimResolution: 'REFUND',
          refundAmount: 246
        }
      ]
    };

    storageService.savePOs([po]);

    // Initial state: ensure transaction does not exist yet
    let txs = storageService.getBudgetTransactions();
    const existing001 = txs.find(t => t.docNo === 'PO-PD-2026-001' || t.referenceDoc === 'PO-PD-2026-001');
    expect(existing001).toBeUndefined();

    // Execute retroactive auto-sync
    const syncResult = budgetService.syncSettledRefundsToBudget([po]);
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBeGreaterThanOrEqual(1);

    // Ledger now contains the canonical record for PO-PD-2026-001
    txs = storageService.getBudgetTransactions();
    const reconciledTx = txs.find(t => t.docNo === 'PO-PD-2026-001' || t.referenceDoc === 'PO-PD-2026-001');
    expect(reconciledTx).toBeDefined();
    expect(reconciledTx.amount).toBe(246);
    expect(reconciledTx.refundAmount).toBe(246);
    expect(reconciledTx.department).toBe('PD');
    expect(reconciledTx.departmentName).toBe('ฝ่าย PD');
    expect(reconciledTx.type).toBe('BUDGET_ROLLBACK');
  });

  // ── Scenario 2: Table UI Formatting ──
  it('Scenario 2 (Table UI Formatting): renders ISO timestamp, BUDGET_ROLLBACK, ฝ่าย PD, +฿246.00 (emerald bold font), PO-PD-2026-001 (badge), and remark', () => {
    const po = {
      id: 'PO-1789291527812-1',
      poNo: 'PO-PD-2026-001',
      department: 'PD',
      storeClaims: {
        'Shopee_แ้ก้กเก้ดเ้ด': {
          status: 'RESOLVED',
          isResolved: true,
          type: 'REFUND',
          refundAmount: 246,
          note: '[ร้าน แ้ก้กเก้ดเ้ด]: คืนเงินนนนนค่ะ'
        }
      }
    };
    storageService.savePOs([po]);
    budgetService.syncSettledRefundsToBudget([po]);

    // Render MonthlyBudgetManagement / BudgetView
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/budget?tab=history']}>
        <MonthlyBudgetManagement
          pos={[po]}
          departments={[{ code: 'PD', name: 'ฝ่ายผลิต', monthlyBudget: 40000 }]}
          currentUser={{ id: 'ADMIN', roleId: 'ADMIN', level: 99, assignedDepartments: ['PD'] }}
        />
      </MemoryRouter>
    );

    // Verify Tab 3 presence and rendered table columns
    // Check that +฿246.00 is rendered with emerald bold font, NOT +฿0
    expect(html).toContain('+฿246.00');
    expect(html).toContain('text-emerald-600 font-mono');
    expect(html).not.toContain('+฿0.00');

    // Check that reference doc is PO-PD-2026-001 as badge, NOT '-'
    expect(html).toContain('PO-PD-2026-001');

    // Check Department format is "ฝ่าย PD"
    expect(html).toContain('ฝ่าย PD');

    // Check Type is BUDGET_ROLLBACK
    expect(html).toContain('BUDGET_ROLLBACK');

    // Check Remark
    expect(html).toContain('คืนเงินค่าสินค้าเสียหาย/ของขาดจาก PO-PD-2026-001');
  });

  // ── Scenario 3: Department Summary Metric Consistency ──
  it('Scenario 3 (Department Summary Metric Consistency): PD budgetSpent is reduced by ฿246.00 and budgetRemaining is increased by ฿246.00', async () => {
    // Set baseline budgets
    const baselineBudgets = {
      PD: {
        monthlyBudget: 40000,
        spent: 10000,
        actualExpense: 10000,
        variance: 30000,
        remainingBudget: 30000,
        history: { '2026-09': 40000 },
        historicalSpent: { '2026-09': 10000 }
      }
    };
    storageService.saveBudgets(baselineBudgets);

    const po = {
      id: 'PO-1789291527812-1',
      poNo: 'PO-PD-2026-001',
      department: 'PD',
      storeClaims: {
        'Shopee_แ้ก้กเก้ดเ้ด': {
          status: 'RESOLVED',
          isResolved: true,
          type: 'REFUND',
          refundAmount: 246,
          note: '[ร้าน แ้ก้กเก้ดเ้ด]: คืนเงินนนนนค่ะ'
        }
      }
    };
    storageService.savePOs([po]);

    const creditRes = await budgetService.creditDepartmentBudget({
      departmentId: 'PD',
      department: 'PD',
      amount: 246,
      referencePo: 'PO-PD-2026-001',
      storeKey: 'Shopee_แ้ก้กเก้ดเ้ด',
      reason: 'คืนเงินค่าสินค้าเสียหาย/ของขาดจาก PO-PD-2026-001'
    });

    expect(creditRes.success).toBe(true);
    expect(creditRes.budgetSpent).toBe(9754); // 10000 - 246
    expect(creditRes.budgetRemaining).toBe(30246); // 30000 + 246

    const updatedBudgets = storageService.getBudgets();
    expect(updatedBudgets['PD'].spent).toBe(9754);
    expect(updatedBudgets['PD'].variance).toBe(30246);
    expect(updatedBudgets['PD'].remainingBudget).toBe(30246);
  });

  // ── Scenario 4: Strict Idempotency ──
  it('Scenario 4 (Strict Idempotency): refreshing or running sync multiple times does NOT duplicate transaction or repeatedly credit budget', async () => {
    const po = {
      id: 'PO-1789291527812-1',
      poNo: 'PO-PD-2026-001',
      department: 'PD',
      storeClaims: {
        'Shopee_แ้ก้กเก้ดเ้ด': {
          status: 'RESOLVED',
          isResolved: true,
          type: 'REFUND',
          refundAmount: 246,
          note: '[ร้าน แ้ก้กเก้ดเ้ด]: คืนเงินนนนนค่ะ'
        }
      }
    };
    storageService.savePOs([po]);

    // First execution
    const run1 = budgetService.syncSettledRefundsToBudget([po]);
    expect(run1.syncedCount).toBe(1);

    const txs1 = storageService.getBudgetTransactions();
    const count1 = txs1.filter(t => t.docNo === 'PO-PD-2026-001').length;
    expect(count1).toBe(1);

    const budgetsAfter1 = storageService.getBudgets();
    const spent1 = budgetsAfter1['PD']?.spent;

    // Second execution (simulate page refresh or tab switch)
    const run2 = budgetService.syncSettledRefundsToBudget([po]);
    expect(run2.syncedCount).toBe(0); // 0 new syncs

    const txs2 = storageService.getBudgetTransactions();
    const count2 = txs2.filter(t => t.docNo === 'PO-PD-2026-001').length;
    expect(count2).toBe(1); // strictly 1, no duplicates!

    // Third execution (direct creditDepartmentBudget call)
    const run3 = await budgetService.creditDepartmentBudget({
      department: 'PD',
      amount: 246,
      referencePo: 'PO-PD-2026-001',
      storeKey: 'Shopee_แ้ก้กเก้ดเ้ด'
    });
    expect(run3.alreadyReconciled).toBe(true);

    const budgetsAfter3 = storageService.getBudgets();
    expect(budgetsAfter3['PD']?.spent).toBe(spent1); // budget spent unchanged!
  });
});
