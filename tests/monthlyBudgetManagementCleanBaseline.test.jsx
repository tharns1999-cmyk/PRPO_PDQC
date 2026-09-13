import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import BudgetView from '../src/views/BudgetView';
import MonthlyBudgetManagement from '../src/views/budget/MonthlyBudgetManagement';
import MonthlyBudgetView from '../src/views/budget/MonthlyBudgetView';
import { storageService } from '../src/services/storageService';
import { budgetService, CLEAN_BUDGET_BASELINE, generateCleanBudgetBaseline } from '../src/services/budgetService';
import { apiService } from '../src/services/apiService';
import { workflowEngine } from '../src/services/workflowEngine';

describe('Monthly Budget Management Clean Baseline & Operational Period Alignment Suite', () => {
  beforeEach(() => {
    storageService.resetData();
    budgetService.resetBudgetData();
  });

  // ── Requirement 1: Reset Active Budget Month to 2026-09 (กันยายน 2569) ──
  it('Requirement 1: Budget view defaults immediately to operational period "กันยายน 2569" (2026-09)', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/budget']}>
        <BudgetView
          currentUser={{ id: 'ADMIN', roleId: 'ADMIN', level: 99, assignedDepartments: ['ALL'] }}
        />
      </MemoryRouter>
    );

    // Verify Thai month representation
    expect(html).toContain('กันยายน 2569');
    expect(html).toContain('(2026-09)');
    // Verify it does NOT default to futuristic 2027-01 (มกราคม 2570)
    expect(html).not.toContain('มกราคม 2570');
  });

  it('Requirement 1b: MonthlyBudgetView and MonthlyBudgetManagement aliases both render default period "กันยายน 2569"', () => {
    const html1 = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/budget']}>
        <MonthlyBudgetView
          currentUser={{ id: 'ADMIN', roleId: 'ADMIN', level: 99, assignedDepartments: ['ALL'] }}
        />
      </MemoryRouter>
    );
    expect(html1).toContain('กันยายน 2569');

    const html2 = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/budget']}>
        <MonthlyBudgetManagement
          currentUser={{ id: 'ADMIN', roleId: 'ADMIN', level: 99, assignedDepartments: ['ALL'] }}
        />
      </MemoryRouter>
    );
    expect(html2).toContain('กันยายน 2569');
  });

  // ── Requirement 2: Clean Departmental Allocations & ฿0 Initial Spent ──
  it('Requirement 2: Departmental allocations match realistic baselines (PD: ฿1M, QC: ฿150k, WH: ฿120k, PUR: ฿100k, ENG: ฿205k) with ฿0 spent', () => {
    const baseline = storageService.getBudgets();

    expect(baseline.PD.monthlyBudget).toBe(1000000);
    expect(baseline.PD.spent).toBe(0);
    expect(baseline.PD.variance).toBe(1000000);

    expect(baseline.QC.monthlyBudget).toBe(150000);
    expect(baseline.QC.spent).toBe(0);
    expect(baseline.QC.variance).toBe(150000);

    expect(baseline.WH.monthlyBudget).toBe(120000);
    expect(baseline.WH.spent).toBe(0);
    expect(baseline.WH.variance).toBe(120000);

    expect(baseline.PUR.monthlyBudget).toBe(100000);
    expect(baseline.PUR.spent).toBe(0);
    expect(baseline.PUR.variance).toBe(100000);

    expect(baseline.ENG.monthlyBudget).toBe(205000);
    expect(baseline.ENG.spent).toBe(0);
    expect(baseline.ENG.variance).toBe(205000);

    // Baseline contains strictly the active month 2026-09
    expect(Object.keys(baseline.PD.history)).toEqual(['2026-09']);
    expect(Object.keys(baseline.PD.historicalSpent)).toEqual(['2026-09']);
  });

  // ── Requirement 3: Elimination of Past Empty Placeholder Rows ──
  it('Requirement 3: Historical comparison table renders ONLY 1 row: "กันยายน 2569 (เดือนปัจจุบัน)" and eliminates empty past months', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/budget?tab=trends']}>
        <BudgetView
          currentUser={{ id: 'ADMIN', roleId: 'ADMIN', level: 99, assignedDepartments: ['ALL'] }}
          prs={[]}
          pos={[]}
        />
      </MemoryRouter>
    );

    // Active month must appear as current month row
    expect(html).toContain('กันยายน 2569');
    expect(html).toContain('เดือนปัจจุบัน');
    expect(html).toContain('฿1,575,000'); // Total allocated for ALL departments (1M + 150k + 120k + 100k + 205k)
    expect(html).toContain('รอบบัญชีปัจจุบัน (2026-09)');

    // Past months (มี.ค. - ส.ค. 2569) must NOT appear in the table
    expect(html).not.toContain('สิงหาคม 2569');
    expect(html).not.toContain('กรกฎาคม 2569');
    expect(html).not.toContain('มิถุนายน 2569');
    expect(html).not.toContain('พฤษภาคม 2569');
    expect(html).not.toContain('เมษายน 2569');
    expect(html).not.toContain('มีนาคม 2569');
  });

  // ── Requirement 4: Dynamic Period Growth on Actual PR/PO Transactions ──
  it('Requirement 4: Dynamic period growth displays past/future months ONLY when actual PR/PO transactions exist', () => {
    // Inject a real PO in August 2026 (2026-08)
    const augPO = {
      id: 'PO-PD-2026-AUG',
      poNo: 'PO-PD-2026-088',
      department: 'PD',
      status: 'CLOSED',
      issueDate: '2026-08-15',
      items: [{ name: 'August Raw Material', price: 50000, qty: 1 }]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/budget?tab=trends']}>
        <BudgetView
          currentUser={{ id: 'ADMIN', roleId: 'ADMIN', level: 99, assignedDepartments: ['ALL'] }}
          prs={[]}
          pos={[augPO]}
        />
      </MemoryRouter>
    );

    // Now August 2026 dynamically appears because a real transaction exists
    expect(html).toContain('สิงหาคม 2569');
    expect(html).toContain('กันยายน 2569');

    // Months without any transactions (e.g. July, June, May) remain excluded
    expect(html).not.toContain('กรกฎาคม 2569');
    expect(html).not.toContain('มิถุนายน 2569');
  });

  // ── Requirement 5: Data Reset Capability & Real-time PR/PO Updates ──
  it('Requirement 5a: resetBudgetData cleanly re-seeds minimal baseline idempotently', () => {
    // Corrupt storage with legacy bloated phantom numbers and multiple history months
    storageService.saveBudgets({
      PD: {
        monthlyBudget: 4000000,
        spent: 999999,
        variance: 3000001,
        history: { '2026-01': 4000000, '2026-09': 4000000 },
        historicalSpent: { '2026-01': 999999, '2026-09': 0 }
      }
    });
    expect(storageService.getBudgets().PD.monthlyBudget).toBe(4000000);

    // Call reset utility
    const resetResult = budgetService.resetBudgetData();
    expect(resetResult.PD.monthlyBudget).toBe(1000000);
    expect(resetResult.PD.spent).toBe(0);
    expect(Object.keys(resetResult.PD.history)).toEqual(['2026-09']);

    const reloaded = storageService.getBudgets();
    expect(reloaded.PD.monthlyBudget).toBe(1000000);
    expect(reloaded.PD.spent).toBe(0);
    expect(reloaded.QC.monthlyBudget).toBe(150000);
    expect(reloaded.WH.monthlyBudget).toBe(120000);
    expect(reloaded.PUR.monthlyBudget).toBe(100000);
    expect(reloaded.ENG.monthlyBudget).toBe(205000);
    expect(Object.keys(reloaded.PD.history)).toEqual(['2026-09']);
  });

  it('Requirement 5b: Real active PR and PO deductions update committed and spent in real-time', () => {
    // PR commitment for PD in 2026-09: ฿25,000
    const pr = {
      id: 'PR-PD-001',
      prNo: 'PR-PD-001',
      department: 'PD',
      status: 'APPROVED',
      requestedDate: '2026-09-05',
      totalAmount: 25000
    };
    storageService.savePRs([pr]);

    // Closed PO for PD in 2026-09: ฿15,000
    const po = {
      id: 'PO-PD-001',
      poNo: 'PO-PD-2026-001',
      department: 'PD',
      status: 'CLOSED',
      issueDate: '2026-09-10',
      items: [{ name: 'Part A', price: 15000, qty: 1 }]
    };
    storageService.savePOs([po]);

    const summary = apiService.calculateBudgetSummary('2026-09');
    const pdSummary = summary.trends['2026-09'].PD;

    expect(pdSummary.baseAllocated).toBe(1000000);
    expect(pdSummary.actualSpent).toBe(15000);
    expect(pdSummary.committed).toBe(25000);
    expect(pdSummary.totalSpent).toBe(40000);
    expect(pdSummary.remaining).toBe(960000); // 1,000,000 - 40,000
    expect(pdSummary.percentage).toBe(4); // 40,000 / 1,000,000 * 100
  });
});
