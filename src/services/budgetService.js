import { storageService } from './storageService';
import { apiService } from './apiService';

/**
 * Clean baseline generator matching current fiscal period (September 2026 / 2569)
 * Allocations:
 * - PD (ฝ่ายผลิต): ฿1,000,000.00
 * - QC (ฝ่ายควบคุมคุณภาพ): ฿150,000.00
 * - WH (ฝ่ายคลังสินค้า): ฿120,000.00
 * - PUR (ฝ่ายจัดซื้อ): ฿100,000.00
 * - ENG (ฝ่ายวิศวกรรม): ฿205,000.00
 * With 0 initial spent and strictly the active month (2026-09 / กันยายน 2569), eliminating empty past-month placeholder rows.
 */
export const generateCleanBudgetBaseline = () => {
  const activeMonth = '2026-09';
  const deptConfigs = {
    PD: { monthlyBudget: 1000000 },
    QC: { monthlyBudget: 150000 },
    WH: { monthlyBudget: 120000 },
    PUR: { monthlyBudget: 100000 },
    ENG: { monthlyBudget: 205000 }
  };

  const baseline = {};
  for (const [code, cfg] of Object.entries(deptConfigs)) {
    baseline[code] = {
      monthlyBudget: cfg.monthlyBudget,
      spent: 0,
      actualExpense: 0,
      budgetSpent: 0,
      pending: 0,
      variance: cfg.monthlyBudget,
      remainingBudget: cfg.monthlyBudget,
      budgetRemaining: cfg.monthlyBudget,
      history: {
        [activeMonth]: cfg.monthlyBudget
      },
      historicalSpent: {
        [activeMonth]: 0
      },
      refundCredits: {}
    };
  }
  return baseline;
};

export const CLEAN_BUDGET_BASELINE = generateCleanBudgetBaseline();

/**
 * BudgetService (Enterprise Department Budget & Settlement Engine)
 * Authoritative single source of truth for budget crediting, reconciliations,
 * and duplicate-refund protection.
 */
export const budgetService = {
  /**
   * Reset Budget Data to clean minimal baseline matching current fiscal period (2026-09)
   * Writes to storageService and syncs with backend server if available.
   */
  resetBudgetData() {
    const cleanBudgets = generateCleanBudgetBaseline();
    storageService.saveBudgets(cleanBudgets);
    try {
      if (typeof fetch === 'function') {
        fetch('http://localhost:3001/api/budgets/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanBudgets)
        }).catch(() => {});
      }
    } catch {
      // Graceful offline fallback
    }
    return cleanBudgets;
  },

  /**
   * Credit Department Budget on Claim Refund with strict idempotency
   * Ensures:
   * 1. budgetSpent -= refundValue
   * 2. budgetRemaining += refundValue
   * 3. Idempotent: exact same refund (refPo + storeKey + amount) will not be credited twice
   * 4. Single audit trail in budget transactions log matching canonical table schema
   */
  async creditDepartmentBudget({
    departmentId,
    department,
    prDepartment,
    dept: deptAlias,
    amount,
    refundValue,
    refundAmount,
    referencePo,
    docNo,
    poNumber,
    storeKey = '',
    storeName = '',
    reason = '',
    actor = 'Budget Specialist'
  }) {
    // A. Resilient Department Identification & Calling Contract
    const rawDept = department || departmentId || prDepartment || deptAlias || 'PD';
    const dept = String(rawDept).replace(/^ฝ่าย\s*/i, '').trim().toUpperCase() || 'PD';
    const refundAmt = Math.round((Number(amount ?? refundValue ?? refundAmount ?? 0)) * 100) / 100;
    if (refundAmt <= 0) {
      return { success: false, reason: 'Zero or negative refund amount' };
    }

    const refPo = String(referencePo || docNo || poNumber || '').trim();
    const cleanStoreKey = String(storeKey || '').trim();
    const idempotencyKey = `REFUND_${refPo}_${cleanStoreKey || 'STORE'}_${refundAmt}`;

    // C.1 Check idempotency against both po.processedRefundTransactions and existing budget ledger
    const existingTx = storageService.getBudgetTransactions() || [];
    const pos = storageService.getPOs() || [];
    const targetPO = pos.find(p => p.id === refPo || p.poNo === refPo || p.poNumber === refPo);
    const hasPoTx = Boolean(targetPO && Array.isArray(targetPO.processedRefundTransactions) && targetPO.processedRefundTransactions.includes(idempotencyKey));

    const isAlreadyCredited = hasPoTx || existingTx.some(tx => 
      tx.idempotencyKey === idempotencyKey ||
      tx.transactionId === idempotencyKey ||
      ((tx.docNo === refPo || tx.referenceDoc === refPo || tx.poNumber === refPo || tx.refId === refPo || tx.refDocNo === refPo) &&
       (tx.storeKey === cleanStoreKey || !cleanStoreKey || cleanStoreKey === 'GLOBAL' || cleanStoreKey === 'STORE') &&
       Number(tx.amount ?? tx.refundAmount ?? tx.creditAmount) === refundAmt)
    );

    if (isAlreadyCredited) {
      const budgets = storageService.getBudgets();
      const currentSpent = Number(budgets[dept]?.spent ?? budgets[dept]?.actualExpense ?? budgets[dept]?.budgetSpent ?? 0);
      const remaining = Number(budgets[dept]?.variance ?? budgets[dept]?.remainingBudget ?? budgets[dept]?.budgetRemaining ?? 0);
      return {
        success: true,
        alreadyReconciled: true,
        department: dept,
        amount: refundAmt,
        budgetSpent: currentSpent,
        budgetRemaining: remaining
      };
    }

    if (targetPO) {
      targetPO.processedRefundTransactions = targetPO.processedRefundTransactions || [];
      if (!targetPO.processedRefundTransactions.includes(idempotencyKey)) {
        targetPO.processedRefundTransactions.push(idempotencyKey);
        storageService.savePOs(pos);
      }
    }

    // C.2 Deduct from spent and add to remaining in budgets
    const budgets = storageService.getBudgets();
    if (!budgets[dept]) {
      budgets[dept] = { monthlyBudget: 0, spent: 0, actualExpense: 0, pending: 0, variance: 0, history: {}, historicalSpent: {}, refundCredits: {} };
    }

    const currentSpent = Number(budgets[dept].spent ?? budgets[dept].actualExpense ?? budgets[dept].budgetSpent ?? 0);
    const newSpent = Math.max(0, Math.round((currentSpent - refundAmt) * 100) / 100);

    budgets[dept].spent = newSpent;
    budgets[dept].actualExpense = newSpent;
    budgets[dept].budgetSpent = newSpent;

    const monthly = Number(budgets[dept].monthlyBudget || budgets[dept].budgetTotal || 0);
    const newVariance = Math.round((monthly - newSpent) * 100) / 100;

    budgets[dept].variance = newVariance;
    budgets[dept].remainingBudget = newVariance;
    budgets[dept].budgetRemaining = newVariance;

    const today = new Date();
    const targetMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    if (!budgets[dept].refundCredits) budgets[dept].refundCredits = {};
    budgets[dept].refundCredits[targetMonth] = Math.round(
      ((budgets[dept].refundCredits[targetMonth] || 0) + refundAmt) * 100
    ) / 100;

    storageService.saveBudgets(budgets);

    // Also update Department entity in departments storage for SSOT
    try {
      const depts = storageService.getDepartments() || [];
      const deptItem = depts.find(d => d.code === dept || d.id === dept || d.id === `DEPT-${dept}`);
      if (deptItem) {
        deptItem.budgetTotal = Number(deptItem.budgetTotal || deptItem.monthlyBudget || monthly);
        deptItem.budgetSpent = newSpent;
        deptItem.budgetRemaining = newVariance;
        storageService.saveDepartments(depts);
      }
    } catch {
      // Graceful fallback
    }

    // B. Canonical Budget Transaction Schema matching MonthlyBudgetManagement UI columns
    const baseNote = `คืนเงินค่าสินค้าเสียหาย/ของขาดจาก ${refPo}${storeName || cleanStoreKey ? ` (${storeName || cleanStoreKey})` : ''}`;
    const effectiveNote = reason 
      ? (reason.includes('คืนเงิน') ? reason : `${baseNote} - ${reason}`)
      : baseNote;
    const tx = {
      id: `REFUND_${refPo || 'PO'}_${cleanStoreKey || 'STORE'}_${Date.now()}`,
      transactionId: idempotencyKey,
      idempotencyKey,
      timestamp: today.toISOString(),
      createdAt: today.toISOString(),
      date: today.toISOString().replace('T', ' ').substring(0, 19),
      type: 'BUDGET_ROLLBACK',
      actionType: 'BUDGET_ROLLBACK',
      transactionType: 'BUDGET_RESTORED_CLAIM_REFUND',
      typeLabel: 'คืนงบประมาณ (Refund)',
      dept,
      department: dept,
      departmentName: `ฝ่าย ${dept}`,
      amount: refundAmt, // Strictly positive number e.g. 246
      refundAmount: refundAmt,
      creditAmount: refundAmt,
      delta: refundAmt,
      previousAmount: currentSpent,
      newAmount: newSpent,
      docNo: refPo,
      referenceDoc: refPo,
      poNumber: refPo,
      poNo: refPo,
      refDocNo: refPo,
      refId: refPo,
      poId: refPo,
      referencePo: refPo,
      storeKey: cleanStoreKey || 'STORE',
      actor: actor || 'Budget Specialist',
      note: effectiveNote,
      remark: effectiveNote,
      targetMonth,
      isReconciled: true
    };

    storageService.appendBudgetTransaction(tx);

    try {
      if (typeof fetch === 'function') {
        await fetch(`http://localhost:3001/api/budgets/${dept}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(budgets[dept])
        });
      }
    } catch {
      // Graceful offline fallback
    }

    return {
      success: true,
      alreadyReconciled: false,
      department: dept,
      amount: refundAmt,
      budgetSpent: newSpent,
      budgetRemaining: newVariance,
      transaction: tx
    };
  },

  /**
   * D. Self-Healing & Retroactive Sync Engine (Crucial for Existing POs)
   * Automatically synchronizes settled claims from stored POs into the budget ledger.
   * Backfills missing refund records (e.g. PO-PD-2026-001 with ฿246.00) idempotently.
   */
  syncSettledRefundsToBudget(providedPOs, providedDepartments) {
    const pos = (Array.isArray(providedPOs) && providedPOs.length > 0) ? providedPOs : (storageService.getPOs() || []);
    const existingTx = storageService.getBudgetTransactions() || [];
    const reconciledRecords = [];
    let syncedCount = 0;

    for (const po of pos) {
      if (!po) continue;
      const targetDepartment = (po.department || po.departmentId || po.prDepartment || po.dept || 'PD')
        .replace(/^ฝ่าย\s*/i, '').trim().toUpperCase() || 'PD';
      const poDocNo = String(po.poNo || po.poNumber || po.id || '').trim();
      if (!poDocNo) continue;

      // 1. Scan storeClaims
      if (po.storeClaims && typeof po.storeClaims === 'object') {
        for (const [storeKey, claim] of Object.entries(po.storeClaims)) {
          if (!claim) continue;
          const isRefundClaim = (
            claim.isResolved === true || 
            claim.status === 'RESOLVED' || 
            claim.type === 'REFUND' || 
            claim.actionType === 'REFUND' || 
            claim.resolutionType === 'REFUND' || 
            claim.type === 'CLOSE_WITH_REFUND' ||
            String(claim.note || '').includes('คืนเงิน')
          ) && (
            claim.type === 'REFUND' ||
            claim.actionType === 'REFUND' ||
            claim.resolutionType === 'REFUND' ||
            claim.type === 'CLOSE_WITH_REFUND' ||
            String(claim.note || '').includes('คืนเงิน')
          );

          const refundVal = Math.round((Number(claim.refundAmount) || 0) * 100) / 100;
          if (isRefundClaim && refundVal > 0) {
            const cleanKey = String(storeKey || '').trim();
            const txSig = `REFUND_${poDocNo}_${cleanKey || 'STORE'}_${refundVal}`;
            
            // Check if already in ledger or processed
            const hasPoTx = Array.isArray(po.processedRefundTransactions) && po.processedRefundTransactions.includes(txSig);
            const existsInLedger = hasPoTx || existingTx.some(tx => 
              tx.idempotencyKey === txSig ||
              tx.transactionId === txSig ||
              ((tx.docNo === poDocNo || tx.referenceDoc === poDocNo || tx.poNumber === poDocNo || tx.refId === poDocNo || tx.refDocNo === poDocNo) &&
               Number(tx.amount ?? tx.refundAmount ?? tx.creditAmount) === refundVal)
            );

            if (!existsInLedger) {
              const storeName = claim.storeName || cleanKey;
              const defaultReason = `คืนเงินค่าสินค้าเสียหาย/ของขาดจาก ${poDocNo}${storeName ? ` (${storeName})` : ''}`;
              const reason = claim.note ? `${defaultReason} - ${claim.note}` : defaultReason;
              this.creditDepartmentBudget({
                departmentId: targetDepartment,
                department: targetDepartment,
                amount: refundVal,
                referencePo: poDocNo,
                storeKey: cleanKey,
                storeName: storeName,
                reason: reason,
                actor: claim.resolvedBy || 'Online Purchaser'
              });
              syncedCount++;
              reconciledRecords.push({ poNo: poDocNo, amount: refundVal, storeKey: cleanKey });
            }
          }
        }
      }

      // 2. Scan items where claimResolution === 'REFUND'
      if (Array.isArray(po.items)) {
        for (const item of po.items) {
          if (!item) continue;
          const isItemRefund = (item.claimResolution === 'REFUND' || item.resolutionType === 'REFUND') && Number(item.refundAmount || 0) > 0;
          if (isItemRefund) {
            const refundVal = Math.round(Number(item.refundAmount) * 100) / 100;
            const itemStore = item.actualStoreName || item.storeName || item.storeKey || 'ITEM';
            const txSig = `REFUND_${poDocNo}_${itemStore}_${refundVal}`;
            const hasPoTx = Array.isArray(po.processedRefundTransactions) && po.processedRefundTransactions.includes(txSig);
            const existsInLedger = hasPoTx || existingTx.some(tx => 
              tx.idempotencyKey === txSig ||
              tx.transactionId === txSig ||
              ((tx.docNo === poDocNo || tx.referenceDoc === poDocNo || tx.poNumber === poDocNo || tx.refId === poDocNo || tx.refDocNo === poDocNo) &&
               Number(tx.amount ?? tx.refundAmount ?? tx.creditAmount) === refundVal)
            );

            if (!existsInLedger) {
              this.creditDepartmentBudget({
                departmentId: targetDepartment,
                department: targetDepartment,
                amount: refundVal,
                referencePo: poDocNo,
                storeKey: itemStore,
                storeName: itemStore,
                reason: `คืนเงินค่าสินค้า ${item.name || item.code} จาก ${poDocNo}`,
                actor: 'Online Purchaser'
              });
              syncedCount++;
              reconciledRecords.push({ poNo: poDocNo, amount: refundVal, storeKey: itemStore });
            }
          }
        }
      }
    }

    return {
      syncedCount,
      reconciledRecords,
      success: true
    };
  }
};
