import { Router } from 'express';
import { readFile, writeFile } from '../storage.js';

const router = Router();

/**
 * Procurement Subsystem (PR & PO Workflows)
 * Routes mounted at /api, /api/pr, /api/po
 */

// ── 1. Purchase Requests (PRs) ──
router.get(['/prs', '/pr'], async (req, res) => {
  try {
    const prs = await readFile('prs.json', []);
    res.json(prs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post(['/prs', '/pr'], async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      const seen = new Set();
      const unique = data.filter(p => {
        const key = p.id || p.prNo;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await writeFile('prs.json', unique);
      return res.json(unique);
    }
    const prs = await readFile('prs.json', []);
    const idx = prs.findIndex(p => p.id === data.id || (data.prNo && p.prNo === data.prNo));
    if (idx !== -1) {
      prs[idx] = { ...prs[idx], ...data };
    } else {
      prs.unshift(data);
    }
    await writeFile('prs.json', prs);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put(['/prs/:id', '/pr/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const prs = await readFile('prs.json', []);
    const idx = prs.findIndex(p => p.id === id);
    if (idx !== -1) {
      prs[idx] = { ...prs[idx], ...updated };
    } else {
      prs.unshift(updated);
    }
    await writeFile('prs.json', prs);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete(['/prs/:id', '/pr/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const prs = await readFile('prs.json', []);
    const filtered = prs.filter(p => p.id !== id && p.prNo !== id);
    await writeFile('prs.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2. Purchase Orders (POs) ──
router.get(['/pos', '/po'], async (req, res) => {
  try {
    const pos = await readFile('pos.json', []);
    res.json(pos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post(['/pos', '/po'], async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      const pos = await readFile('pos.json', []);
      for (const item of data) {
        const idx = pos.findIndex(p => 
          (item.id && p.id === item.id) || 
          (item.poNo && (p.poNo === item.poNo || p.poNumber === item.poNo)) ||
          (item.prNo && p.prNo === item.prNo && item.vendorId && p.vendorId === item.vendorId)
        );
        if (idx !== -1) {
          pos[idx] = { ...pos[idx], ...item };
        } else {
          pos.unshift(item);
        }
      }
      await writeFile('pos.json', pos);
      return res.json(data);
    }
    const pos = await readFile('pos.json', []);
    const idx = pos.findIndex(p => 
      (data.id && p.id === data.id) || 
      (data.poNo && (p.poNo === data.poNo || p.poNumber === data.poNo)) ||
      (data.poNumber && (p.poNo === data.poNumber || p.poNumber === data.poNumber)) ||
      (data.prNo && p.prNo === data.prNo && (!data.vendorId || p.vendorId === data.vendorId))
    );
    if (idx !== -1) {
      pos[idx] = { ...pos[idx], ...data };
    } else {
      pos.unshift(data);
    }
    await writeFile('pos.json', pos);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put(['/pos/:id', '/po/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const pos = await readFile('pos.json', []);
    const idx = pos.findIndex(p => p.id === id);
    if (idx !== -1) {
      pos[idx] = { ...pos[idx], ...updated };
    } else {
      pos.push(updated);
    }
    await writeFile('pos.json', pos);

    // ── Claim Settlement & PO Finalization: Budget Ledger Auto-Sync ──
    try {
      const targetPO = idx !== -1 ? pos[idx] : updated;
      const refPo = targetPO.poNo || targetPO.poNumber || targetPO.id;
      const dept = String(targetPO.department || targetPO.dept || 'PD').replace(/^ฝ่าย\s*/i, '').trim().toUpperCase() || 'PD';
      const period = targetPO.period || (targetPO.issueDate ? String(targetPO.issueDate).slice(0, 7) : '2026-09');

      // Calculate total refund from PO fields or storeClaims
      let refundAmt = 0;
      if (targetPO.totalRefunded !== undefined && targetPO.totalRefunded !== null) {
        refundAmt = Number(targetPO.totalRefunded);
      } else if (targetPO.refundAmount !== undefined && targetPO.refundAmount !== null) {
        refundAmt = Number(targetPO.refundAmount);
      } else if (targetPO.storeClaims && typeof targetPO.storeClaims === 'object') {
        Object.values(targetPO.storeClaims).forEach(c => {
          if (c?.isResolved && (c.type === 'REFUND' || c.resolutionType === 'REFUND' || c.actionType === 'REFUND' || String(c.note || '').includes('คืนเงิน'))) {
            refundAmt += Number(c.refundAmount || 0);
          }
        });
      }

      if (refundAmt > 0) {
        const transactions = await readFile('budgetTransactions.json', []);
        const idempotencyKey = `REFUND_${refPo}_TOTAL_${refundAmt}`;
        const alreadyLogged = transactions.some(t => 
          t.idempotencyKey === idempotencyKey ||
          ((t.docNo === refPo || t.referenceDoc === refPo) && Number(t.amount || t.refundAmount || 0) === refundAmt)
        );

        if (!alreadyLogged) {
          const now = new Date();
          const newTx = {
            id: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            idempotencyKey,
            timestamp: now.toISOString(),
            date: now.toISOString().replace('T', ' ').slice(0, 19),
            createdAt: now.toISOString(),
            period: period || '2026-09',
            department: dept,
            dept,
            departmentName: `ฝ่าย ${dept}`,
            type: 'BUDGET_ROLLBACK',
            actionType: 'REFUND_SETTLEMENT',
            transactionType: 'REFUND_SETTLEMENT',
            settlementType: 'REFUND_SETTLEMENT',
            typeLabel: 'คืนงบประมาณ (Refund)',
            amount: Number(refundAmt),
            refundAmount: Number(refundAmt),
            creditAmount: Number(refundAmt),
            docType: 'PO',
            docNo: refPo,
            referenceDoc: refPo,
            notes: `คืนงบประมาณจากการเคลม/ปิดงาน (${refPo})`,
            note: `คืนงบประมาณจากการเคลม/ปิดงาน (${refPo})`,
            remark: `คืนงบประมาณจากการเคลม/ปิดงาน (${refPo})`,
            actor: targetPO.updatedBy || 'ผู้ดูแลระบบจัดซื้อ',
            actorName: targetPO.updatedBy || 'ผู้ดูแลระบบจัดซื้อ',
            actorRole: 'PURCHASER'
          };
          transactions.unshift(newTx);
          await writeFile('budgetTransactions.json', transactions);

          // Update budgets.json
          const budgets = await readFile('budgets.json', {});
          if (budgets[dept]) {
            const curSpent = Number(budgets[dept].spent ?? budgets[dept].actualExpense ?? 0);
            const newSpent = Math.max(0, Math.round((curSpent - refundAmt) * 100) / 100);
            const monthlyAlloc = Number(budgets[dept].monthlyBudget || budgets[dept].budgetTotal || 0);
            budgets[dept].spent = newSpent;
            budgets[dept].actualExpense = newSpent;
            budgets[dept].variance = Math.round((monthlyAlloc - newSpent) * 100) / 100;
            budgets[dept].remainingBudget = budgets[dept].variance;
            if (!budgets[dept].refundCredits) budgets[dept].refundCredits = {};
            budgets[dept].refundCredits[period] = Math.round(((budgets[dept].refundCredits[period] || 0) + refundAmt) * 100) / 100;
            await writeFile('budgets.json', budgets);
          }
        }
      }
    } catch (e) {
      console.warn('[procurementRoutes] Budget sync error:', e.message);
    }

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete(['/pos/:id', '/po/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const pos = await readFile('pos.json', []);
    const filtered = pos.filter(p => p.id !== id && p.poNo !== id && p.poNumber !== id);
    await writeFile('pos.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
