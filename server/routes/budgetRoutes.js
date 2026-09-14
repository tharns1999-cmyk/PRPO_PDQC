import { Router } from 'express';
import { 
  readFile, 
  writeFile, 
  initialBudgets, 
  initialDepartments 
} from '../storage.js';

const router = Router();

/**
 * Budget & Department Ledger Subsystem
 * Routes mounted at /api/budgets and /api
 */

// ── 1. Budgets GET ──
router.get(['/', '/budgets'], async (req, res) => {
  try {
    const { year, month } = req.query;
    const budgets = await readFile('budgets.json', initialBudgets);
    const departments = await readFile('departments.json', initialDepartments);
    let changed = false;

    // Ensure all departments from departments.json exist in budgets.json
    departments.forEach(dept => {
      if (!budgets[dept.code]) {
        budgets[dept.code] = {
          monthlyBudget: Number(dept.monthlyBudget) || 200000,
          spent: 0,
          pending: 0,
          variance: Number(dept.monthlyBudget) || 200000,
          history: {},
          historicalSpent: {}
        };
        changed = true;
      }
    });

    if (changed) {
      await writeFile('budgets.json', budgets);
    }

    if (year && month) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthData = {};
      Object.keys(budgets).forEach(dept => {
        const d = budgets[dept] || {};
        // Strict Zero-based budgeting: each month is 100% isolated.
        // Before allocation, baseAllocated is 0. NEVER fallback to master monthlyBudget or departments.json!
        const allocatedForMonth = (d.history && d.history[monthKey] !== undefined && d.history[monthKey] !== null)
          ? Number(d.history[monthKey])
          : 0;
        monthData[dept] = {
          baseAllocated: allocatedForMonth,
          actualSpent: d.historicalSpent?.[monthKey] || 0,
          committed: 0,
          isAllocated: allocatedForMonth > 0
        };
      });
      return res.json({ monthKey, data: monthData, budgets });
    }
    res.json(budgets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2. Budgets POST & PUT ──
router.post(['/', '/budgets'], async (req, res) => {
  try {
    await writeFile('budgets.json', req.body);
    res.json(req.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put(['/', '/budgets'], async (req, res) => {
  try {
    await writeFile('budgets.json', req.body);
    res.json(req.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 3. Budget Adjustment & Top-up Endpoint (Atomic Ledger Update) ──
router.post(['/adjust', '/budgets/adjust'], async (req, res) => {
  try {
    const { dept, action, newAmount, previousAmount, delta, reason, actor, targetMonth } = req.body;
    if (!dept) {
      return res.status(400).json({ error: 'Missing department code' });
    }

    const budgets = await readFile('budgets.json', initialBudgets);
    const transactions = await readFile('budgetTransactions.json', []);

    if (!budgets[dept]) {
      budgets[dept] = { monthlyBudget: 0, spent: 0, pending: 0, variance: 0, history: {}, historicalSpent: {} };
    }

    const today = new Date();
    const currentActiveMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthKey = targetMonth || currentActiveMonth;

    // Strict Zero-based: Previous budget strictly refers to the same month's allocated history.
    // Initial state of any new month is strictly 0. Never fallback to master data!
    const prevInMonth = (budgets[dept].history && budgets[dept].history[monthKey] !== undefined && budgets[dept].history[monthKey] !== null)
      ? Number(budgets[dept].history[monthKey])
      : 0;
    const prev = previousAmount !== undefined ? Number(previousAmount) : prevInMonth;
    let finalAmount = prev;

    let txType = action || 'ADJUST';
    let txTypeLabel = 'ปรับยอดงบประมาณ';
    let amountDiff = 0;

    if (action === 'TOP_UP') {
      finalAmount = prev + Number(delta || 0);
      txType = 'TOP_UP';
      txTypeLabel = 'เติมงบประมาณพิเศษ (Budget Top-up)';
      amountDiff = Number(delta || 0);
    } else if (action === 'BUDGET_ROLLBACK') {
      const rollbackAmt = Number(delta || 0);
      const currentMonthly = Number(budgets[dept].monthlyBudget) || 0;
      const curSpent = previousAmount !== undefined ? Number(previousAmount) : Number(budgets[dept].spent ?? budgets[dept].actualExpense ?? 0);
      const newSpent = newAmount !== undefined ? Number(newAmount) : Math.max(0, curSpent - rollbackAmt);
      budgets[dept].spent = newSpent;
      budgets[dept].actualExpense = newSpent;
      budgets[dept].variance = (Number(budgets[dept].variance) || (currentMonthly - curSpent)) + rollbackAmt;
      budgets[dept].remainingBudget = budgets[dept].variance;
      if (!budgets[dept].refundCredits) budgets[dept].refundCredits = {};
      budgets[dept].refundCredits[monthKey] = (Number(budgets[dept].refundCredits[monthKey]) || 0) + rollbackAmt;
      finalAmount = currentMonthly;
      txType = 'BUDGET_ROLLBACK';
      txTypeLabel = 'คืนงบประมาณ (Budget Reversal)';
      amountDiff = rollbackAmt;
    } else {
      // SET_BUDGET, MONTHLY_ALLOCATION, ADJUST
      finalAmount = Number(newAmount !== undefined ? newAmount : prev);
      const isInitial = (action === 'MONTHLY_ALLOCATION') || (prev === 0);
      if (isInitial) {
        txType = 'MONTHLY_ALLOCATION';
        txTypeLabel = 'จัดสรรงบประมาณประจำเดือน';
        amountDiff = finalAmount; // Zero-based: Full initial allocation
      } else {
        txType = 'SET_BUDGET';
        txTypeLabel = (finalAmount - prev >= 0) ? 'ปรับเพิ่มงบประมาณ' : 'ปรับลดยอดงบประมาณ';
        amountDiff = finalAmount - prev; // Delta within same month
      }
    }

    if (!budgets[dept].history) budgets[dept].history = {};
    if (action !== 'BUDGET_ROLLBACK') {
      budgets[dept].history[monthKey] = finalAmount;
    }

    // Update active period values if operating on active fiscal month (2026-09 or current month)
    if (monthKey === '2026-09' || monthKey === currentActiveMonth) {
      if (action !== 'BUDGET_ROLLBACK') {
        budgets[dept].monthlyBudget = finalAmount;
        const spent = Number(budgets[dept].spent) || 0;
        budgets[dept].variance = finalAmount - spent;
        budgets[dept].remainingBudget = budgets[dept].variance;
      }
    }

    // 1. Write budgets.json
    await writeFile('budgets.json', budgets);

    // 2. Create and append transaction log to budgetTransactions.json
    const nowStr = today.toISOString().replace('T', ' ').slice(0, 19);
    const newTx = {
      id: `BTX-${Date.now()}`,
      date: nowStr,
      createdAt: today.toISOString(),
      dept,
      type: txType,
      typeLabel: txTypeLabel,
      previousAmount: prev,
      newAmount: finalAmount,
      amount: amountDiff,
      actor: actor || 'ผู้ดูแลระบบ (Admin)',
      note: reason || (txType === 'MONTHLY_ALLOCATION' ? `จัดสรรงบประมาณประจำเดือน ${monthKey}` : 'ปรับปรุงงบประมาณประจำเดือน'),
      targetMonth: monthKey,
      period: monthKey
    };

    transactions.unshift(newTx);
    await writeFile('budgetTransactions.json', transactions);

    res.json({
      success: true,
      budget: budgets[dept],
      transaction: newTx,
      budgets,
      transactions
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 3b. Dedicated Monthly Allocation Endpoint ──
router.post(['/allocate', '/budgets/allocate'], async (req, res) => {
  try {
    const { period, allocations = {}, actor, reason } = req.body;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'Invalid period format YYYY-MM' });
    }

    const budgets = await readFile('budgets.json', initialBudgets);
    const transactions = await readFile('budgetTransactions.json', []);
    const today = new Date();
    const currentActiveMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const nowStr = today.toISOString().replace('T', ' ').slice(0, 19);
    const createdTxs = [];

    for (const [dept, amount] of Object.entries(allocations)) {
      const numAmount = Math.max(0, Number(amount) || 0);
      if (!budgets[dept]) {
        budgets[dept] = { monthlyBudget: 0, spent: 0, actualExpense: 0, pending: 0, variance: 0, history: {}, historicalSpent: {}, refundCredits: {} };
      }
      if (!budgets[dept].history) budgets[dept].history = {};

      const prevMonthAlloc = (budgets[dept].history[period] !== undefined && budgets[dept].history[period] !== null)
        ? Number(budgets[dept].history[period])
        : 0;
      const isInitial = prevMonthAlloc === 0;

      budgets[dept].history[period] = numAmount;

      if (period === '2026-09' || period === currentActiveMonth) {
        budgets[dept].monthlyBudget = numAmount;
        budgets[dept].variance = numAmount - (Number(budgets[dept].spent) || 0);
        budgets[dept].remainingBudget = budgets[dept].variance;
      }

      const deltaAmount = isInitial ? numAmount : (numAmount - prevMonthAlloc);
      const txType = isInitial ? 'MONTHLY_ALLOCATION' : (deltaAmount >= 0 ? 'TOP_UP' : 'SET_BUDGET');
      const txTypeLabel = isInitial ? 'จัดสรรงบประมาณประจำเดือน' : (deltaAmount >= 0 ? 'ปรับเพิ่มงบประมาณ' : 'ปรับลดยอดงบประมาณ');

      const tx = {
        id: `BTX-ALLOC-${dept}-${period}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: nowStr,
        createdAt: today.toISOString(),
        type: txType,
        typeLabel: txTypeLabel,
        dept,
        department: dept,
        previousAmount: prevMonthAlloc,
        newAmount: numAmount,
        amount: deltaAmount,
        actor: actor || 'Asst. Manager',
        note: reason || (isInitial ? `จัดสรรงบประมาณประจำเดือน ${period}` : `ปรับปรุงงบประมาณประจำเดือน ${period}`),
        targetMonth: period,
        period
      };
      transactions.unshift(tx);
      createdTxs.push(tx);
    }

    await writeFile('budgets.json', budgets);
    await writeFile('budgetTransactions.json', transactions);

    res.json({
      success: true,
      period,
      allocations,
      transactions: createdTxs,
      budgets
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 4. Budget Transactions Ledger Endpoints ──
router.get(['/budget-transactions', '/transactions'], async (req, res) => {
  try {
    const { period, department, dept } = req.query;
    let transactions = await readFile('budgetTransactions.json', []);
    if (period) {
      transactions = transactions.filter(t => (t.period === period || t.targetMonth === period || String(t.date || '').startsWith(period)));
    }
    const filterDept = (department || dept || '').replace(/^ฝ่าย\s*/i, '').trim().toUpperCase();
    if (filterDept && filterDept !== 'ALL') {
      transactions = transactions.filter(t => {
        const d = String(t.department || t.dept || '').replace(/^ฝ่าย\s*/i, '').trim().toUpperCase();
        return d === filterDept;
      });
    }
    res.json(transactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post(['/budget-transactions', '/transactions'], async (req, res) => {
  try {
    const transactions = await readFile('budgetTransactions.json', []);
    const tx = req.body;
    const now = new Date();
    const newTx = {
      id: tx.id || `TX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: tx.timestamp || now.toISOString(),
      date: tx.date || now.toISOString().replace('T', ' ').slice(0, 19),
      createdAt: tx.createdAt || now.toISOString(),
      period: tx.period || tx.targetMonth || '2026-09',
      docType: tx.docType || 'PO',
      actorName: tx.actorName || tx.actor || 'ผู้ดูแลระบบจัดซื้อ',
      actorRole: tx.actorRole || 'PURCHASER',
      ...tx
    };
    transactions.unshift(newTx);
    await writeFile('budgetTransactions.json', transactions);
    res.json(newTx);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
