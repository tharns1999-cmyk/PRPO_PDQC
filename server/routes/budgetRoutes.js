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
        monthData[dept] = {
          baseAllocated: d.history?.[monthKey] || d.monthlyBudget || 200000,
          actualSpent: d.historicalSpent?.[monthKey] || 0,
          committed: 0
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
    const departments = await readFile('departments.json', initialDepartments);
    const transactions = await readFile('budgetTransactions.json', []);

    if (!budgets[dept]) {
      budgets[dept] = { monthlyBudget: 0, spent: 0, pending: 0, variance: 0, history: {}, historicalSpent: {} };
    }

    const currentMonthly = Number(budgets[dept].monthlyBudget) || 0;
    const prev = previousAmount !== undefined ? Number(previousAmount) : currentMonthly;
    let finalAmount = prev;

    const today = new Date();
    const monthKey = targetMonth || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    if (action === 'TOP_UP') {
      finalAmount = prev + Number(delta || 0);
      budgets[dept].monthlyBudget = finalAmount;
      const spent = Number(budgets[dept].spent) || 0;
      budgets[dept].variance = finalAmount - spent;
    } else if (action === 'BUDGET_ROLLBACK') {
      const rollbackAmt = Number(delta || 0);
      const curSpent = previousAmount !== undefined ? Number(previousAmount) : Number(budgets[dept].spent ?? budgets[dept].actualExpense ?? 0);
      const newSpent = newAmount !== undefined ? Number(newAmount) : Math.max(0, curSpent - rollbackAmt);
      budgets[dept].spent = newSpent;
      budgets[dept].actualExpense = newSpent;
      budgets[dept].variance = (Number(budgets[dept].variance) || (currentMonthly - curSpent)) + rollbackAmt;
      budgets[dept].remainingBudget = budgets[dept].variance;
      if (!budgets[dept].refundCredits) budgets[dept].refundCredits = {};
      budgets[dept].refundCredits[monthKey] = (Number(budgets[dept].refundCredits[monthKey]) || 0) + rollbackAmt;
      finalAmount = currentMonthly;
    } else if (action === 'SET_BUDGET' || action === 'ADJUST') {
      finalAmount = Number(newAmount !== undefined ? newAmount : prev);
      budgets[dept].monthlyBudget = finalAmount;
      const spent = Number(budgets[dept].spent) || 0;
      budgets[dept].variance = finalAmount - spent;
    }

    if (!budgets[dept].history) budgets[dept].history = {};
    if (action !== 'BUDGET_ROLLBACK') {
      budgets[dept].history[monthKey] = finalAmount;
    }

    // 1. Write budgets.json
    await writeFile('budgets.json', budgets);

    // 2. Sync monthlyBudget to departments.json if present
    if (action !== 'BUDGET_ROLLBACK') {
      const deptObj = departments.find(d => d.code === dept);
      if (deptObj) {
        deptObj.monthlyBudget = finalAmount;
        await writeFile('departments.json', departments);
      }
    }

    // 3. Create and append transaction log to budgetTransactions.json
    const nowStr = today.toISOString().replace('T', ' ').slice(0, 19);
    const amountDiff = action === 'BUDGET_ROLLBACK' ? Number(delta || 0) : finalAmount - prev;
    const newTx = {
      id: `BTX-${Date.now()}`,
      date: nowStr,
      createdAt: today.toISOString(),
      dept,
      type: action || 'ADJUST',
      typeLabel: action === 'SET_BUDGET' 
        ? 'กำหนดงบประมาณประจำเดือน (Monthly Allocation)' 
        : action === 'TOP_UP' 
          ? 'เติมงบประมาณพิเศษ (Budget Top-up)' 
          : action === 'BUDGET_ROLLBACK'
            ? 'คืนงบประมาณ (Budget Reversal)'
            : 'ปรับยอดงบประมาณ (Adjustment)',
      previousAmount: prev,
      newAmount: finalAmount,
      amount: amountDiff,
      actor: actor || 'ผู้ดูแลระบบ (Admin)',
      note: reason || 'ปรับปรุงงบประมาณประจำเดือน',
      targetMonth: monthKey
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

// ── 4. Budget Transactions Ledger Endpoints ──
router.get(['/budget-transactions', '/transactions'], async (req, res) => {
  try {
    const transactions = await readFile('budgetTransactions.json', []);
    res.json(transactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post(['/budget-transactions', '/transactions'], async (req, res) => {
  try {
    const transactions = await readFile('budgetTransactions.json', []);
    const tx = req.body;
    const newTx = {
      id: tx.id || `BTX-${Date.now()}`,
      date: tx.date || new Date().toISOString().replace('T', ' ').slice(0, 19),
      createdAt: tx.createdAt || new Date().toISOString(),
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
