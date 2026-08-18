import { storageService } from './storageService.js';
import { PR_STATUS, PO_STATUS, DEPARTMENTS } from '../config/constants.js';
import { notificationService } from './notificationService.js';
import { auditService } from './auditService.js';

export const workflowEngine = {
  
  canAction(role, doc) {
    if (!role || !doc) return false;

    const isAdmin = role.id === 'ADMIN' || role.roleId === 'ADMIN' || Number(role.level) >= 99;
    const userLevel = Number(role.level || (isAdmin ? 99 : 1));
    const isOnlinePurchaser = role.roleId === 'ONLINE_PURCHASER' || role.id === 'ONLINE_PURCHASER' || role.positionKey === 'ONLINE_PURCHASER' || (role.canOnlinePurchase && userLevel < 99);

    // Helper to check if role matches document creator / requester
    const isDocOwner = (d) => {
      if (!d) return false;
      const target = (d.requestedBy || d.applicantName1 || '').trim().toLowerCase();
      if (!target) return true; // If unspecified, allow matching department

      const rawNames = [role.name, role.employeeName, role.displayName, role.username].filter(Boolean);
      return rawNames.some(n => {
        const clean = n.trim().toLowerCase();
        const baseRole = clean.replace(/\s*\([^)]*\)/g, '').trim();
        const baseTarget = target.replace(/\s*\([^)]*\)/g, '').trim();
        return clean === target ||
               clean.includes(target) ||
               target.includes(clean) ||
               (baseRole && baseTarget && (baseRole === baseTarget || baseRole.includes(baseTarget) || baseTarget.includes(baseRole)));
      });
    };

    const matchesDept = (dept) => {
      return role.department === 'ALL' || role.department === dept || isAdmin;
    };

    // --- 1. PO Document Action Checks (if document is a PO) ---
    if (doc.poNo) {
      const po = doc;

      // 1. Online PO waiting for Online Purchaser (IN_PROGRESS_ONLINE):
      if (po.status === 'IN_PROGRESS_ONLINE') {
        return isOnlinePurchaser || isAdmin;
      }

      // 2. PO Goods Receiving (ORDERED_PENDING_DELIVERY, ISSUED, PARTIAL, IN_DELIVERY):
      // ─── PRIMARY RULE: ONLY Requester / Supervisor (Level 1) of that department can receive goods!
      // Asst. Mgr (Level 2) and Plant Mgr (Level 3) and Online Purchaser CANNOT receive goods.
      if (['ORDERED_PENDING_DELIVERY', 'ISSUED', 'PARTIAL', 'IN_DELIVERY'].includes(po.status)) {
        if (isAdmin) return true;
        if (isOnlinePurchaser) return false;
        
        // Strictly disallow Level >= 2 managers (Asst. Mgr, Plant Mgr) from receiving goods
        if (userLevel >= 2) return false;

        // Department requester or supervisor (Level 1) of that department
        if (userLevel === 1 && matchesDept(po.department)) {
          return true;
        }

        return false;
      }

      return false;
    }

    // --- 2. PR Document Action Checks (if document is a PR) ---
    const pr = doc;

    // 1. DRAFT or REJECTED_TO_DRAFT:
    // Only the requester who owns the draft can action it (or Admin)
    if (['DRAFT', 'REJECTED_TO_DRAFT'].includes(pr.status)) {
      if (isAdmin) return true;
      if (role.canSubmitPR && matchesDept(pr.department) && isDocOwner(pr)) {
        return true;
      }
      return false;
    }

    // 2. SUBMITTED or REJECTED_TO_L2 (Review Level 1 - Asst. Manager):
    // Only Level 2 Reviewers / Asst Managers (strictly NOT Plant Manager Level 3, NOT Requesters Level 1, NOT Online Purchaser)
    if (['SUBMITTED', 'REJECTED_TO_L2'].includes(pr.status)) {
      if (isAdmin) return true;
      if (isOnlinePurchaser) return false;
      // Disallow Level 3 (Plant Mgr / Approvers) and Level 1 (Requesters)
      if (userLevel >= 3 || role.canFinalApprove || userLevel <= 1) return false;

      const isLevel2Reviewer = userLevel === 2 || role.canReview || role.id === 'ASST_MANAGER' || role.id === 'REVIEWER' || role.positionKey === 'REVIEWER' || role.roleId === 'ASST_MANAGER';
      return isLevel2Reviewer && matchesDept(pr.department);
    }

    // 3. REVIEWED (Final Approval - Plant Manager):
    // Only Level 3 Approvers / Plant Managers (strictly NOT Level 2 Asst Managers, NOT Requesters Level 1, NOT Online Purchaser)
    if (pr.status === 'REVIEWED') {
      if (isAdmin) return true;
      if (isOnlinePurchaser) return false;
      const isLevel3Approver = userLevel >= 3 || role.canFinalApprove || role.id === 'PLANT_MANAGER' || role.id === 'APPROVER' || role.positionKey === 'APPROVER' || role.roleId === 'PLANT_MANAGER';
      return isLevel3Approver && matchesDept(pr.department);
    }

    return false;
  },

  // Check if a user can cancel a PR (Task must currently be with the user)
  canCancelPR(role, pr) {
    if (!role || !pr) return false;
    if (['APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE', 'CLOSED', 'CANCELLED'].includes(pr.status)) {
      return false;
    }
    return this.canAction(role, pr);
  },

  // Edit PR items by Approver (Level 2+) before approval
  async editPRItems(prId, updatedItems, user, editReason = '') {
    const prs = storageService.getPRs();
    const pr = prs.find(p => p.id === prId);
    if (!pr) throw new Error('ไม่พบเอกสาร PR ในระบบ');

    if (user.level < 2 && user.id !== 'ADMIN') {
      throw new Error('เฉพาะผู้อนุมัติตั้งแต่ Level 2 ขึ้นไปเท่านั้นที่สามารถแก้ไขรายการได้');
    }

    if (!['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(pr.status)) {
      throw new Error('ไม่สามารถแก้ไขรายการในสถานะปัจจุบันของ PR นี้ได้');
    }

    const oldTotal = pr.totalAmount || 0;
    const formattedItems = updatedItems.map(item => {
      const pQty = Number(item.purchaseQty ?? item.qty) || 1;
      const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
      const sQty = Number(item.stockQty) || (pQty * rate);
      const price = Number(item.price) || 0;
      return {
        ...item,
        purchaseUnit: item.purchaseUnit || item.unit || 'ชิ้น',
        stockUnit: item.stockUnit || item.unit || 'ชิ้น',
        conversionRate: rate,
        purchaseQty: pQty,
        stockQty: sQty,
        qty: pQty,
        price,
        total: price * pQty
      };
    });

    const newTotal = formattedItems.reduce((sum, it) => sum + it.total, 0);
    pr.items = formattedItems;
    pr.totalAmount = newTotal;

    const timestamp = new Date().toLocaleString('th-TH');
    pr.activityLog.push({
      action: 'แก้ไขรายการสินค้า (Approver Item Edit)',
      user: user.name,
      role: user.title,
      timestamp,
      note: `ผู้อนุมัติแก้ไขรายการสินค้า (ยอดเดิม ฿${oldTotal.toLocaleString()} → ยอดใหม่ ฿${newTotal.toLocaleString()})${editReason ? ` เหตุผล: ${editReason}` : ''}`
    });

    storageService.savePRs(prs);
    return pr;
  },

  // 1-Level Rejection Logic:
  // Level 3 (Plant Mgr) -> REJECTED_TO_L2 (Sent back to Level 2 Asst Mgr)
  // Level 2 (Asst Mgr) -> REJECTED_TO_DRAFT (Sent back to Level 1 Requester)
  async rejectPR(prId, user, reason) {
    if (!reason || !reason.trim()) {
      throw new Error('กรุณาระบุเหตุผลการไม่อนุมัติ / ส่งกลับ');
    }

    const prs = storageService.getPRs();
    const pr = prs.find(p => p.id === prId);
    if (!pr) throw new Error('ไม่พบเอกสาร PR ในระบบ');

    const timestamp = new Date().toLocaleString('th-TH');
    let nextStatus = 'REJECTED_TO_DRAFT';
    let actionLabel = 'ส่งกลับให้ผู้ขอซื้อแก้ไข (Rejected to Draft)';
    let targetRoles = [pr.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN'];
    let notiTitle = 'ใบขอซื้อ (PR) ถูกส่งกลับให้แก้ไข';

    if (user.level >= 3 || pr.status === 'REVIEWED') {
      nextStatus = 'REJECTED_TO_L2';
      actionLabel = 'ส่งกลับ Level 2 ตรวจสอบใหม่ (Rejected to L2)';
      targetRoles = ['ASST_MANAGER', 'ADMIN'];
      notiTitle = 'ใบขอซื้อ (PR) ถูกส่งกลับจาก Level 3 มายัง Level 2';
    }

    pr.status = nextStatus;
    pr.activityLog.push({
      action: actionLabel,
      user: user.name,
      role: user.title,
      timestamp,
      note: `เหตุผลการส่งกลับ: ${reason.trim()}`
    });

    storageService.savePRs(prs);

    auditService.logAction({
      action: 'PR_REJECTED',
      actor: user,
      department: pr.department,
      docNo: pr.prNo,
      docType: 'PR',
      details: `ส่งกลับ / ปฏิเสธ PR เลขที่ ${pr.prNo} (${actionLabel}): ${reason.trim()}`
    });

    // Dispatch Notification
    notificationService.dispatch({
      type: 'PR_REJECTED',
      title: notiTitle,
      message: `ใบขอซื้อเลขที่ ${pr.prNo} ถูกส่งกลับโดย ${user.name}: ${reason.trim()}`,
      docNo: pr.prNo,
      refDocType: 'PR',
      refDocId: pr.id,
      department: pr.department,
      targetRoles,
      amount: pr.totalAmount,
      actor: user.name
    });

    return pr;
  },

  // Online Purchaser Acknowledges Task & marks as ordered
  async acknowledgeOnlineTask(poId, vendorName, user, updatedItems = null, varianceNote = '') {
    if (!vendorName || !vendorName.trim()) {
      throw new Error('กรุณาระบุชื่อร้านค้า / ช่องทางที่สั่งซื้อ (เช่น Shopee ร้าน XYZ)');
    }

    const pos = storageService.getPOs();
    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('ไม่พบเอกสาร PO ในระบบ');

    po.status = 'ORDERED_PENDING_DELIVERY';
    po.vendorName = vendorName.trim();
    const timestamp = new Date().toLocaleString('th-TH');

    let varianceDetails = [];

    if (Array.isArray(updatedItems) && updatedItems.length > 0) {
      po.items = po.items.map(origItem => {
        const matchingUpdated = updatedItems.find(u => u.code === origItem.code || u.id === origItem.id);
        if (matchingUpdated) {
          const oldPrice = origItem.unitPrice || origItem.estimatedPrice || origItem.price || 0;
          const oldQty = origItem.purchaseQty ?? origItem.qty;
          const newPrice = Number(matchingUpdated.unitPrice) >= 0 ? Number(matchingUpdated.unitPrice) : oldPrice;
          const newQty = Number(matchingUpdated.purchaseQty) > 0 ? Number(matchingUpdated.purchaseQty) : oldQty;
          const rate = Number(origItem.conversionRate) > 0 ? Number(origItem.conversionRate) : 1;
          const newStockQty = newQty * rate;

          // Preserve original PR values if not already preserved
          const originalEstimatedPrice = origItem.originalEstimatedPrice ?? oldPrice;
          const originalPurchaseQty = origItem.originalPurchaseQty ?? oldQty;

          if (newPrice !== oldPrice || newQty !== oldQty) {
            varianceDetails.push(`${origItem.name}: เดิม ${oldQty} @ ฿${oldPrice.toLocaleString()} -> สั่งจริง ${newQty} @ ฿${newPrice.toLocaleString()}`);
          }

          return {
            ...origItem,
            originalEstimatedPrice,
            originalPurchaseQty,
            unitPrice: newPrice,
            estimatedPrice: newPrice,
            price: newPrice,
            purchaseQty: newQty,
            qty: newQty,
            stockQty: newStockQty,
            lineTotal: newPrice * newQty
          };
        }
        return origItem;
      });

      // Recalculate PO total
      const newTotal = po.items.reduce((sum, item) => sum + ((item.purchaseQty ?? item.qty) * (item.unitPrice || item.estimatedPrice || item.price || 0)), 0);
      po.grandTotal = newTotal;
      po.totalAmount = newTotal;
      po.subtotal = newTotal;
    }

    let noteText = `สั่งซื้อจาก: ${vendorName.trim()} — ส่งต่อให้แผนกต้นทางตรวจรับและปิด PO`;
    if (varianceDetails.length > 0) {
      noteText += ` | ปรับปรุงยอดสั่งซื้อจริง: [${varianceDetails.join(', ')}]`;
    }
    if (varianceNote && varianceNote.trim()) {
      noteText += ` (หมายเหตุ: ${varianceNote.trim()})`;
    }

    po.activityLog.push({
      action: 'รับทราบและสั่งซื้อออนไลน์แล้ว (Online Order Placed)',
      user: user.name,
      role: user.title,
      timestamp,
      note: noteText
    });

    storageService.savePOs(pos);

    // Notify Department Requester
    notificationService.dispatch({
      type: 'ONLINE_ORDERED',
      title: '📦 สินค้าออนไลน์สั่งซื้อแล้ว (รอจัดส่ง)',
      message: `ใบสั่งซื้อ ${po.poNo} (อ้างอิง PR ${po.prNo}) สั่งซื้อจาก "${vendorName.trim()}" แล้ว (ยอดรวม ฿${(po.grandTotal || 0).toLocaleString()})${varianceDetails.length > 0 ? ' มีการปรับปรุงราคา/จำนวนตามสต็อกจริง' : ''}`,
      docNo: po.poNo,
      refDocType: 'PO',
      refDocId: po.id,
      department: po.department,
      targetRoles: [po.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN', 'ASST_MANAGER'],
      amount: po.grandTotal,
      actor: user.name
    });

    return po;
  },

  // 2A: Cancel PR (Allowed ONLY before PO is issued)
  async cancelPR(prId, user, reason) {
    if (!reason || !reason.trim()) {
      throw new Error('กรุณาระบุเหตุผลในการยกเลิกใบขอซื้อ (PR)');
    }

    const prs = storageService.getPRs();
    const pr = prs.find(p => p.id === prId);
    if (!pr) throw new Error('ไม่พบเอกสาร PR ในระบบ');

    if (['APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE', 'CLOSED'].includes(pr.status)) {
      throw new Error('ไม่สามารถยกเลิก PR ที่ออกเป็น PO หรืออนุมัติสั่งซื้อแล้วได้ หากต้องการยกเลิก กรุณาใช้ฟังก์ชันยกเลิก PO แทน');
    }

    if (pr.status === 'CANCELLED') {
      throw new Error('เอกสาร PR นี้ถูกยกเลิกไปแล้ว');
    }

    // Must be actionable by the current user at their stage (Task must currently be at this user)
    if (!this.canAction(user, pr)) {
      throw new Error('ไม่สามารถยกเลิกได้ เนื่องจากเอกสารไม่ได้อยู่ในขั้นตอนที่ท่านต้องดำเนินการในขณะนี้ (งานไม่ได้อยู่ที่ท่าน)');
    }

    pr.status = 'CANCELLED';
    const timestamp = new Date().toLocaleString('th-TH');

    pr.activityLog.push({
      action: 'ยกเลิกใบขอซื้อ (Cancelled PR)',
      user: user.name,
      role: user.title,
      timestamp,
      note: `เหตุผลการยกเลิก: ${reason.trim()}`
    });

    storageService.savePRs(prs);

    auditService.logAction({
      action: 'PR_CANCELLED',
      actor: user,
      department: pr.department,
      docNo: pr.prNo,
      docType: 'PR',
      details: `ยกเลิกใบขอซื้อเลขที่ ${pr.prNo}: ${reason.trim()}`
    });

    // Dispatch Notification
    notificationService.dispatch({
      type: 'PR_CANCELLED',
      title: '❌ ใบขอซื้อ (PR) ถูกยกเลิก',
      message: `ใบขอซื้อเลขที่ ${pr.prNo} แผนก ${pr.department} ถูกยกเลิกโดย ${user.name}: ${reason.trim()}`,
      docNo: pr.prNo,
      refDocType: 'PR',
      refDocId: pr.id,
      department: pr.department,
      targetRoles: [pr.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN', 'ASST_MANAGER'],
      amount: pr.totalAmount,
      actor: user.name
    });

    return pr;
  },

  // 2A: Cancel PO (Dedicated PO cancellation function)
  async cancelPO(poId, user, reason) {
    if (!reason || !reason.trim()) {
      throw new Error('กรุณาระบุเหตุผลในการยกเลิกใบสั่งซื้อ (PO)');
    }

    const pos = storageService.getPOs();
    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('ไม่พบเอกสาร PO ในระบบ');

    if (['CLOSED', 'RECEIVED'].includes(po.status)) {
      throw new Error('ไม่สามารถยกเลิก PO ที่ปิดงานหรือรับสินค้าเข้าคลังเสร็จสิ้นแล้วได้');
    }

    if (po.status === 'CANCELLED') {
      throw new Error('เอกสาร PO นี้ถูกยกเลิกไปแล้ว');
    }

    po.status = 'CANCELLED';
    const timestamp = new Date().toLocaleString('th-TH');

    po.activityLog.push({
      action: 'ยกเลิกใบสั่งซื้อ (Cancelled PO)',
      user: user.name,
      role: user.title,
      timestamp,
      note: `เหตุผลการยกเลิก: ${reason.trim()}`
    });

    storageService.savePOs(pos);

    auditService.logAction({
      action: 'PO_CANCELLED',
      actor: user,
      department: po.department,
      docNo: po.poNo,
      docType: 'PO',
      details: `ยกเลิกใบสั่งซื้อ ${po.poNo}: ${reason.trim()}`
    });

    // Also update parent PR activity log if exists
    if (po.prId) {
      const prs = storageService.getPRs();
      const parentPR = prs.find(p => p.id === po.prId || p.prNo === po.prNo);
      if (parentPR) {
        parentPR.activityLog.push({
          action: 'ใบสั่งซื้ออ้างอิงถูกยกเลิก (Referenced PO Cancelled)',
          user: user.name,
          role: user.title,
          timestamp,
          note: `ใบสั่งซื้อ ${po.poNo} ถูกยกเลิก: ${reason.trim()}`
        });
        storageService.savePRs(prs);
      }
    }

    // Dispatch Notification
    notificationService.dispatch({
      type: 'PO_CANCELLED',
      title: '❌ ใบสั่งซื้อ (PO) ถูกยกเลิก',
      message: `ใบสั่งซื้อ ${po.poNo} (อ้างอิง PR ${po.prNo}) แผนก ${po.department} ถูกยกเลิกโดย ${user.name}: ${reason.trim()}`,
      docNo: po.poNo,
      refDocType: 'PO',
      refDocId: po.id,
      department: po.department,
      targetRoles: [po.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN', 'ASST_MANAGER', 'PLANT_MANAGER'],
      amount: po.grandTotal,
      actor: user.name
    });

    return po;
  },
  
  // Calculate Budget
  calculateBudgetSummary(targetMonthStr) {
    const prs = storageService.getPRs();
    const pos = storageService.getPOs();
    const budgets = storageService.getBudgets();
    
    // Default to current month if not provided
    const today = new Date();
    const targetMonth = targetMonthStr || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const currentSummary = {};
    const trends = {};

    Object.keys(DEPARTMENTS).forEach(dept => {
      const currentAllocated = budgets[dept]?.history?.[targetMonth] || budgets[dept]?.monthlyBudget || DEPARTMENTS[dept].monthlyBudget;
      currentSummary[dept] = { allocated: currentAllocated, actualSpent: 0, committed: 0, variance: budgets[dept]?.variance || 0 };
    });

    const getTrendMonth = (m) => {
      if (!trends[m]) {
        trends[m] = {};
        Object.keys(DEPARTMENTS).forEach(dept => {
          const alloc = budgets[dept]?.history?.[m] || budgets[dept]?.monthlyBudget || DEPARTMENTS[dept].monthlyBudget;
          trends[m][dept] = { allocated: alloc, actualSpent: 0, committed: 0 };
        });
      }
      return trends[m];
    };

    // Fallback: 6 months history minimum
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      getTrendMonth(mStr);
    }

    pos.forEach(po => {
      if (!['CANCELLED'].includes(po.status) && currentSummary[po.department]) {
        const total = po.items.reduce((sum, item) => sum + (item.actUnitPrice ? item.actUnitPrice * item.qty : (item.price * item.qty)), 0);
        const poMonth = po.issueDate ? po.issueDate.substring(0, 7) : targetMonth;
        const isActual = ['CLOSED', 'RECEIVED'].includes(po.status);
        
        const tMonth = getTrendMonth(poMonth);
        if (isActual) tMonth[po.department].actualSpent += total;
        else tMonth[po.department].committed += total;

        if (poMonth === targetMonth) {
          if (isActual) currentSummary[po.department].actualSpent += total;
          else currentSummary[po.department].committed += total;
        }
      }
    });

    prs.forEach(pr => {
      if (['SUBMITTED', 'REVIEWED', 'APPROVED'].includes(pr.status) && currentSummary[pr.department]) {
        if (!pos.some(po => po.prId === pr.id)) {
          const prMonth = pr.requestedDate ? pr.requestedDate.substring(0, 7) : targetMonth;
          const tMonth = getTrendMonth(prMonth);
          tMonth[pr.department].committed += (pr.totalAmount || 0);

          if (prMonth === targetMonth) {
            currentSummary[pr.department].committed += (pr.totalAmount || 0);
          }
        }
      }
    });

    return {
      current: currentSummary,
      trends: trends,
      targetMonth: targetMonth
    };
  },

  isOverBudget(department, amount) {
    const summary = this.calculateBudgetSummary().current;
    const deptInfo = summary[department];
    if (!deptInfo) return false;
    const remaining = deptInfo.allocated - (deptInfo.actualSpent + deptInfo.committed);
    return amount > remaining;
  },

  // Generate PR No
  generatePRNo(deptId) {
    const counters = storageService.getPRCounters() || {};
    const dateStr = new Date().getFullYear().toString();
    const rawCount = (typeof counters[deptId] === 'object' && counters[deptId] !== null)
      ? (counters[deptId].PR || 0)
      : (counters[deptId] || 0);

    const count = rawCount + 1;
    if (typeof counters[deptId] === 'object' && counters[deptId] !== null) {
      counters[deptId].PR = count;
    } else {
      counters[deptId] = count;
    }
    storageService.savePRCounters(counters);

    const prefix = DEPARTMENTS[deptId]?.prefix || deptId;
    return `${prefix}${String(count).padStart(3, '0')}/${dateStr}`;
  },

  // Generate PO No
  generatePONo(deptId) {
    const pos = storageService.getPOs();
    const count = pos.length + 1;
    const dateStr = new Date().getFullYear().toString();
    const prefix = DEPARTMENTS[deptId]?.prefix || deptId;
    return `PO-${prefix}-${dateStr}-${String(count).padStart(3, '0')}`;
  },

  // Create PR (Draft or Submitted)
  async createPR(prData, user, isDraft = false) {
    const prs = storageService.getPRs();
    const prNo = this.generatePRNo(prData.department);
    const timestamp = new Date().toLocaleString('th-TH');

    const draftFlag = isDraft || Boolean(prData.isDraft);
    const status = draftFlag ? 'DRAFT' : 'SUBMITTED';

    const formattedItems = (prData.items || []).map(item => {
      const pQty = Number(item.purchaseQty ?? item.qty) || 1;
      const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
      const sQty = Number(item.stockQty) || (pQty * rate);
      const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
      const sUnit = item.stockUnit || item.unit || 'ชิ้น';
      const price = Number(item.price) || 0;
      return {
        ...item,
        purchaseQty: pQty,
        stockQty: sQty,
        qty: pQty,
        purchaseUnit: pUnit,
        stockUnit: sUnit,
        unit: pUnit,
        conversionRate: rate,
        price,
        total: price * pQty
      };
    });

    const newPR = {
      id: `PR-${Date.now()}`,
      prNo,
      department: prData.department,
      source: prData.source,
      purchaseChannel: prData.purchaseChannel,
      requestedBy: user.name,
      requestedDate: new Date().toISOString().split('T')[0],
      requiredDate: prData.requiredDate,
      status: status,
      specUrl: prData.specUrl || '',
      attachments: prData.attachments || [],
      items: formattedItems,
      totalAmount: formattedItems.reduce((sum, item) => sum + (item.purchaseQty * item.price), 0),
      note: prData.note || '',
      memo: prData.memo || null,
      activityLog: [
        {
          action: isDraft ? 'บันทึกแบบร่าง (Draft)' : 'สร้างและเปิดใบ PR',
          user: user.name,
          role: user.title,
          timestamp,
          note: isDraft ? 'บันทึกเป็นแบบร่าง' : 'เปิดใบขอซื้อใหม่ส่งเข้าสู่ระบบ'
        }
      ]
    };

    prs.unshift(newPR);
    storageService.savePRs(prs);

    auditService.logAction({
      action: isDraft ? 'PR_DRAFT_CREATED' : 'PR_SUBMITTED',
      actor: user,
      department: newPR.department,
      docNo: newPR.prNo,
      docType: 'PR',
      details: `${isDraft ? 'บันทึกแบบร่าง PR' : 'สร้างและยื่นส่งใบขอซื้อ'} เลขที่ ${newPR.prNo} ยอดรวม ฿${newPR.totalAmount.toLocaleString()}`
    });

    return newPR;
  },
  
  // Submit existing Draft/Rejected PR
  async submitPR(prId, user, memoData = null) {
    const prs = storageService.getPRs();
    const pr = prs.find(p => p.id === prId);
    if (!pr) throw new Error('PR not found');

    if (memoData) {
      pr.memo = memoData;
    }

    pr.status = 'SUBMITTED';
    pr.activityLog.push({
      action: 'ส่งพิจารณา (Submit)',
      user: user.name,
      role: user.title,
      timestamp: new Date().toLocaleString('th-TH'),
      note: 'ส่ง PR เข้าสู่ระบบเพื่อพิจารณา'
    });
    
    storageService.savePRs(prs);

    auditService.logAction({
      action: 'PR_SUBMITTED',
      actor: user,
      department: pr.department,
      docNo: pr.prNo,
      docType: 'PR',
      details: `ส่งใบขอซื้อเลขที่ ${pr.prNo} ยอดเงิน ฿${(pr.totalAmount || 0).toLocaleString()} เข้าสู่ระบบเพื่อตรวจสอบ`
    });

    // Dispatch In-App & LINE Notification
    notificationService.dispatch({
      type: 'PR_SUBMITTED',
      title: 'มีคำขอซื้อใหม่รอการตรวจสอบ (Review Level 1)',
      message: `ใบขอซื้อเลขที่ ${pr.prNo} แผนก ${pr.department} ยอดเงิน ฿${(pr.totalAmount || 0).toLocaleString()} รอคุณสมชาย (Asst. Manager) ตรวจสอบ`,
      docNo: pr.prNo,
      refDocType: 'PR',
      refDocId: pr.id,
      department: pr.department,
      targetRoles: ['ASST_MANAGER', 'ADMIN'],
      amount: pr.totalAmount,
      actor: user.name
    });

    return pr;
  },

  // Update Status & Handle Workflow Transitions
  async updatePRStatus(prId, nextStatus, user, note = '') {
    const prs = storageService.getPRs();
    const index = prs.findIndex(p => p.id === prId);
    if (index === -1) throw new Error('PR not found');

    const pr = prs[index];
    pr.status = nextStatus;
    const timestamp = new Date().toLocaleString('th-TH');

    let actionLabel = 'อัพเดทสถานะ';
    if (nextStatus === 'REVIEWED') actionLabel = 'ตรวจสอบแล้ว (Level 1 - Asst Mgr)';
    if (nextStatus === 'APPROVED') actionLabel = 'อนุมัติ (Final Approval - Plant Mgr)';
    if (nextStatus === 'REJECTED_TO_DRAFT') actionLabel = 'ไม่อนุมัติ / ตีกลับให้แก้ไข (Rejected to Draft)';
    if (nextStatus === 'CANCELLED') actionLabel = 'ยกเลิกเอกสาร (Cancelled)';

    pr.activityLog.push({
      action: actionLabel,
      user: user.name,
      role: user.title,
      timestamp,
      note: note || `เปลี่ยนสถานะเป็น ${PR_STATUS[nextStatus]?.label}`
    });

    let generatedPO = null;
    if (nextStatus === 'APPROVED') {
      generatedPO = await this.createPOFromPR(pr, user);
      pr.status = pr.purchaseChannel === 'ONLINE' ? 'IN_PROGRESS_ONLINE' : 'PO_ISSUED';
    }

    storageService.savePRs(prs);

    // Dispatch In-App & LINE Notification for Review / Reject
    if (nextStatus === 'REVIEWED') {
      notificationService.dispatch({
        type: 'PR_REVIEWED',
        title: 'PR ผ่านการตรวจสอบแล้ว รออนุมัติสั่งซื้อ (Final Approve)',
        message: `ใบขอซื้อเลขที่ ${pr.prNo} แผนก ${pr.department} ยอดเงิน ฿${(pr.totalAmount || 0).toLocaleString()} ผ่านการตรวจ Level 1 แล้ว รอคุณประเสริฐ (Plant Manager) อนุมัติ`,
        docNo: pr.prNo,
        refDocType: 'PR',
        refDocId: pr.id,
        department: pr.department,
        targetRoles: ['PLANT_MANAGER', 'ADMIN'],
        amount: pr.totalAmount,
        actor: user.name
      });
    } else if (nextStatus === 'REJECTED_TO_DRAFT') {
      notificationService.dispatch({
        type: 'PR_REJECTED',
        title: 'ใบขอซื้อ (PR) ถูกส่งกลับให้แก้ไข / ไม่อนุมัติ',
        message: `ใบขอซื้อเลขที่ ${pr.prNo} ถูกส่งกลับโดย ${user.name}: ${note || 'กรุณาตรวจสอบรายละเอียดและแก้ไข'}`,
        docNo: pr.prNo,
        refDocType: 'PR',
        refDocId: pr.id,
        department: pr.department,
        targetRoles: [pr.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN'],
        amount: pr.totalAmount,
        actor: user.name
      });
    }

    return { pr, po: generatedPO };
  },

  // Auto Create PO from PR (Workflow Engine Logic)
  async createPOFromPR(pr, user) {
    const pos = storageService.getPOs();
    const vendors = storageService.getVendors();
    const products = storageService.getProducts();
    const timestamp = new Date().toLocaleString('th-TH');
    
    // Group items by vendorId
    const groups = {};
    pr.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const supplierId = prod?.supplierId || 'NULL';
      if (!groups[supplierId]) groups[supplierId] = [];
      groups[supplierId].push(item);
    });

    const generatedPOs = [];
    let splitCount = 0;
    const basePoNo = this.generatePONo(pr.department);
    const isSplit = Object.keys(groups).length > 1;

    for (const [vendorId, items] of Object.entries(groups)) {
      splitCount++;
      const vendor = vendorId !== 'NULL' ? vendors.find(v => v.id === vendorId) : null;
      const poNo = isSplit ? `${basePoNo}-${splitCount}` : basePoNo;
      
      const subtotal = items.reduce((sum, item) => sum + (item.price * (item.purchaseQty ?? item.qty)), 0);
      const vat = 0;
      const grandTotal = subtotal;

      const poStatus = pr.purchaseChannel === 'ONLINE' ? 'IN_PROGRESS_ONLINE' : 'ISSUED';
      
      let vId = vendor?.id || null;
      let vName = vendor?.name || 'ไม่ระบุผู้ขาย (รอจัดซื้อดำเนินการ)';
      if (pr.purchaseChannel === 'ONLINE') {
        vId = null;
        vName = 'Shopee / Lazada (ระบุร้านภายหลัง)';
      }

      const newPO = {
        id: `PO-${Date.now()}-${splitCount}`,
        poNo,
        prId: pr.id,
        prNo: pr.prNo,
        // ─── Snapshot PR ownership data so Requester can always access this PO ───
        requestedBy: pr.requestedBy || '',
        requesterId: pr.requesterId || null,
        department: pr.department,
        vendorId: vId,
        vendorName: vName,
        purchaseChannel: pr.purchaseChannel,
        onlineLink: pr.onlineLink || null,
        specUrl: pr.specUrl || null,
        issueDate: new Date().toISOString().split('T')[0],
        deliveryDate: pr.requiredDate,
        status: poStatus,
        items: items.map(item => {
          const pQty = Number(item.purchaseQty ?? item.qty) || 0;
          return {
            ...item,
            orderedQty: pQty,
            receivedQty: 0,
            receivedStockQty: 0,
            remainingQty: pQty,
            actUnitPrice: null
          };
        }),
        subtotal,
        vat,
        grandTotal,
        activityLog: [
          {
            action: 'แปลง PR เป็น PO และออกใบสั่งซื้ออัตโนมัติ',
            user: user.name,
            role: user.title,
            timestamp,
            note: isSplit ? `อนุมัติสร้าง PO แยกตามผู้ขาย เลขที่ ${poNo}` : `อนุมัติสร้างเอกสาร PO เลขที่ ${poNo}`
          }
        ]
      };
      
      generatedPOs.push(newPO);
      pos.unshift(newPO);

      auditService.logAction({
        action: 'PR_APPROVED_PO_CREATED',
        actor: user,
        department: pr.department,
        docNo: newPO.poNo,
        docType: 'PO',
        details: `อนุมัติ PR ${pr.prNo} ออกใบสั่งซื้อ ${newPO.poNo} (ผู้ขาย: ${vName}) ยอดเงิน ฿${newPO.grandTotal.toLocaleString()}`
      });

      // Dispatch Notification for each PO
      if (newPO.purchaseChannel === 'ONLINE') {
        notificationService.dispatch({
          type: 'ONLINE_TASK',
          title: 'มีงานสั่งซื้อออนไลน์ใหม่ (Shopee / Lazada)',
          message: `ใบสั่งซื้อออนไลน์เลขที่ ${newPO.poNo} อ้างอิง PR ${newPO.prNo} ยอดประเมิน ฿${newPO.grandTotal.toLocaleString()} รอคุณนัทดำเนินการสั่งซื้อ`,
          docNo: newPO.poNo,
          refDocType: 'PO',
          refDocId: newPO.id,
          department: newPO.department,
          targetRoles: ['ONLINE_PURCHASER', 'ADMIN'],
          amount: newPO.grandTotal,
          actor: user.name
        });
      } else {
        notificationService.dispatch({
          type: 'PR_APPROVED',
          title: 'PR ได้รับการอนุมัติ & ออก PO อัตโนมัติเรียบร้อย',
          message: `ใบสั่งซื้อ ${newPO.poNo} ถูกสร้างจาก ${pr.prNo} (ผู้ขาย: ${newPO.vendorName}) ยอดเงิน ฿${newPO.grandTotal.toLocaleString()}`,
          docNo: newPO.poNo,
          refDocType: 'PO',
          refDocId: newPO.id,
          department: newPO.department,
          targetRoles: [pr.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN', 'ASST_MANAGER'],
          amount: newPO.grandTotal,
          actor: user.name
        });
      }
    }

    storageService.savePOs(pos);
    return generatedPOs.length === 1 ? generatedPOs[0] : generatedPOs;
  },

  // ─── Partial / Full Goods Receiving ──────────────────────────────────────────
  // receivingItems: Array of { productId, receivedThisTime (in purchaseQty units) }
  // If all items are fully received → CLOSED. Else → PARTIAL.
  async receiveGoods(poId, receivingItems, user, note = '') {
    const pos = storageService.getPOs();
    const products = storageService.getProducts();
    const stockLogs = storageService.getStockLogs();
    const prs = storageService.getPRs();
    const timestamp = new Date().toLocaleString('th-TH');

    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('ไม่พบเอกสาร PO ในระบบ');
    if (['CLOSED', 'CANCELLED'].includes(po.status)) throw new Error('PO นี้ถูกปิดหรือยกเลิกแล้ว');

    const receiveMap = {};
    receivingItems.forEach(r => { receiveMap[r.productId] = Number(r.receivedThisTime) || 0; });

    let allFullyReceived = true;
    const receivedSummaryParts = [];

    po.items.forEach(poItem => {
      const pQty = Number(poItem.orderedQty ?? poItem.purchaseQty ?? poItem.qty) || 0;
      const alreadyReceived = Number(poItem.receivedQty) || 0;
      const remaining = pQty - alreadyReceived;
      const thisReceive = Math.min(receiveMap[poItem.productId] ?? 0, remaining);

      if (thisReceive <= 0) {
        if (alreadyReceived < pQty) allFullyReceived = false;
        return;
      }

      const rate = Number(poItem.conversionRate) > 0 ? Number(poItem.conversionRate) : 1;
      const stockReceive = thisReceive * rate;

      poItem.receivedQty = alreadyReceived + thisReceive;
      poItem.receivedStockQty = (Number(poItem.receivedStockQty) || 0) + stockReceive;
      poItem.remainingQty = pQty - poItem.receivedQty;
      poItem.orderedQty = pQty;

      if (poItem.receivedQty < pQty) allFullyReceived = false;

      // Update product stock balance
      const prodIndex = products.findIndex(p => p.id === poItem.productId);
      if (prodIndex !== -1) {
        const prod = products[prodIndex];
        const currentBal = Number(prod.stockBalance) || 0;
        const newBal = currentBal + stockReceive;
        prod.stockBalance = newBal;

        const sUnit = prod.stockUnit || prod.unit || 'ชิ้น';
        const pUnit = prod.purchaseUnit || prod.unit || sUnit;
        const logNote = rate > 1
          ? `รับสินค้า ${thisReceive} ${pUnit} (= ${stockReceive} ${sUnit}) จาก PO ${po.poNo}`
          : `รับสินค้า ${thisReceive} ${sUnit} จาก PO ${po.poNo}`;

        stockLogs.unshift({
          id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          date: timestamp,
          productId: poItem.productId,
          productCode: poItem.code,
          type: 'IN',
          docNo: po.poNo,
          qty: stockReceive,
          unit: sUnit,
          balance: newBal,
          user: `${user.name} (${user.title})`,
          note: note || logNote
        });

        receivedSummaryParts.push(`${poItem.name}: ${thisReceive} ${pUnit}`);
      }
    });

    po.status = allFullyReceived ? 'CLOSED' : 'PARTIAL';
    const summaryNote = receivedSummaryParts.length > 0
      ? `รับของในรอบนี้: ${receivedSummaryParts.join(', ')}${note ? ` — ${note}` : ''}`
      : note || 'รับสินค้าบางส่วน';

    po.activityLog.push({
      action: allFullyReceived ? 'รับสินค้าครบและปิด PO (Goods Received – Closed)' : 'รับสินค้าบางส่วน (Partial Receiving)',
      user: user.name,
      role: user.title,
      timestamp,
      note: summaryNote
    });

    auditService.logAction({
      action: allFullyReceived ? 'GOODS_RECEIVED_PO_CLOSED' : 'GOODS_RECEIVED_PARTIAL',
      actor: user,
      department: po.department,
      docNo: po.poNo,
      docType: 'PO',
      details: `${allFullyReceived ? 'ตรวจรับสินค้าครบและปิด PO' : 'ตรวจรับสินค้าบางส่วน'} ${po.poNo}: ${summaryNote}`
    });

    // If fully closed, also close parent PR
    if (allFullyReceived) {
      const pr = prs.find(p => p.id === po.prId);
      if (pr) {
        pr.status = 'CLOSED';
        pr.activityLog.push({
          action: 'ปิดเอกสาร (Closed)',
          user: user.name,
          role: user.title,
          timestamp,
          note: `PO ${po.poNo} รับสินค้าครบแล้ว ปิดใบ PR อัตโนมัติ`
        });
      }
      storageService.savePRs(prs);

      notificationService.dispatch({
        type: 'GOODS_RECEIVED',
        title: 'รับสินค้าครบแล้ว — ปิด PO เรียบร้อย (+IN)',
        message: `PO ${po.poNo} รับสินค้าครบทุกรายการแล้ว สต็อกการ์ดถูกอัปเดตเรียบร้อย`,
        docNo: po.poNo,
        refDocType: 'PO',
        refDocId: po.id,
        department: po.department,
        targetRoles: [po.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN', 'ASST_MANAGER'],
        amount: po.grandTotal,
        actor: user.name
      });
    } else {
      notificationService.dispatch({
        type: 'GOODS_PARTIAL',
        title: '⚠️ รับสินค้าบางส่วน — ยังมียอดค้างอยู่',
        message: `PO ${po.poNo} รับสินค้าบางส่วนแล้ว (${summaryNote}) ยังมีรายการที่รอรับอยู่`,
        docNo: po.poNo,
        refDocType: 'PO',
        refDocId: po.id,
        department: po.department,
        targetRoles: [po.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN'],
        amount: po.grandTotal,
        actor: user.name
      });
    }

    storageService.savePOs(pos);
    storageService.saveProducts(products);
    storageService.saveStockLogs(stockLogs);

    return po;
  },

  // Update actual price for ONLINE PO and calculate variance
  async updateActualPrice(poId, itemIndex, actPrice, user) {
    const pos = storageService.getPOs();
    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('PO not found');

    const item = po.items[itemIndex];
    if (!item) throw new Error('Item not found');

    const oldPrice = item.price;
    item.actUnitPrice = Number(actPrice);
    
    const pQty = item.purchaseQty ?? item.qty ?? 1;
    const variance = (oldPrice - item.actUnitPrice) * pQty; // Positive means saved money, negative means overspent

    po.activityLog.push({
      action: 'อัปเดตราคาจริง (Actual Price)',
      user: user.name,
      role: user.title,
      timestamp: new Date().toLocaleString('th-TH'),
      note: `อัปเดตราคาจริงของ ${item.name} เป็น ฿${item.actUnitPrice.toLocaleString()} (ส่วนต่าง: ${variance >= 0 ? '+' : ''}${variance.toLocaleString()})`
    });

    // Update variance in budget module
    const budgets = storageService.getBudgets();
    if (!budgets[po.department]) budgets[po.department] = { spent: 0, pending: 0, variance: 0 };
    budgets[po.department].variance = (budgets[po.department].variance || 0) + variance;
    storageService.saveBudgets(budgets);

    storageService.savePOs(pos);
    return po;
  },

  // Assign Vendor to PO
  async assignVendorToPO(poId, vendorId, vendorName, user) {
    const pos = storageService.getPOs();
    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('PO not found');

    po.vendorId = vendorId;
    po.vendorName = vendorName;
    const timestamp = new Date().toLocaleString('th-TH');

    po.activityLog.push({
      action: 'ระบุผู้ขาย (Assign Vendor)',
      user: user.name,
      role: user.title,
      timestamp,
      note: `อัปเดตผู้ขายเป็น: ${vendorName}`
    });

    storageService.savePOs(pos);
    return po;
  },

  // Update PO Status
  async updatePOStatus(poId, nextStatus, user, note = '') {
    const pos = storageService.getPOs();
    const index = pos.findIndex(p => p.id === poId);
    if (index === -1) throw new Error('PO not found');

    const po = pos[index];
    po.status = nextStatus;
    const timestamp = new Date().toLocaleString('th-TH');

    let actionLabel = 'อัปเดตสถานะ PO';
    if (nextStatus === 'IN_DELIVERY') actionLabel = 'อัปเดตสถานะการจัดส่ง (In Delivery)';

    po.activityLog.push({
      action: actionLabel,
      user: user.name,
      role: user.title,
      timestamp,
      note: note || `เปลี่ยนสถานะเป็น ${PO_STATUS[nextStatus]?.label}`
    });

    storageService.savePOs(pos);
    return po;
  },

  // Close PO and receive goods
  async closePO(poId, user, note = '') {
    const pos = storageService.getPOs();
    const products = storageService.getProducts();
    const stockLogs = storageService.getStockLogs();
    const prs = storageService.getPRs();
    const timestamp = new Date().toLocaleString('th-TH');

    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('PO not found');

    // Fully receive all items and trigger IN stock movement
    po.items.forEach(poItem => {
      const pQty = Number(poItem.purchaseQty ?? poItem.qty) || 1;
      const rate = Number(poItem.conversionRate) > 0 ? Number(poItem.conversionRate) : 1;
      const pendingPurchaseQty = pQty - (poItem.receivedQty || 0);
      const totalStockQty = Number(poItem.stockQty) || (pQty * rate);
      const pendingStockQty = poItem.stockQty ? (totalStockQty - (poItem.receivedStockQty || 0)) : (pendingPurchaseQty * rate);

      if (pendingStockQty > 0 || pendingPurchaseQty > 0) {
        poItem.receivedQty = pQty;
        poItem.receivedStockQty = totalStockQty;

        const prodIndex = products.findIndex(p => p.id === poItem.productId);
        if (prodIndex !== -1) {
          const prod = products[prodIndex];
          const currentBal = Number(prod.stockBalance) || 0;
          const newBal = currentBal + pendingStockQty;
          prod.stockBalance = newBal;

          const sUnit = prod.stockUnit || prod.unit || 'ชิ้น';
          const pUnit = prod.purchaseUnit || prod.unit || sUnit;
          const noteDetail = rate > 1 
            ? `รับสินค้าเข้าคลัง ${pendingStockQty.toLocaleString()} ${sUnit} (${pQty} ${pUnit}) จาก PO เลขที่ ${po.poNo}`
            : `รับสินค้าเข้าคลังเต็มจำนวน ${pendingStockQty.toLocaleString()} ${sUnit} จาก PO เลขที่ ${po.poNo}`;

          stockLogs.unshift({
            id: `LOG-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            date: timestamp,
            productId: poItem.productId,
            productCode: poItem.code,
            type: 'IN',
            docNo: po.poNo,
            qty: pendingStockQty,
            unit: sUnit,
            balance: newBal,
            user: `${user.name} (${user.title})`,
            note: note || noteDetail
          });
        }
      }
    });

    po.status = 'CLOSED';
    po.activityLog.push({
      action: 'รับสินค้าและปิด PO (Closed)',
      user: user.name,
      role: user.title,
      timestamp,
      note: note || `รับสินค้าและบันทึกเข้า Stock เรียบร้อย`
    });

    auditService.logAction({
      action: 'GOODS_RECEIVED_PO_CLOSED',
      actor: user,
      department: po.department,
      docNo: po.poNo,
      docType: 'PO',
      details: `ตรวจรับสินค้าเข้าคลัง และปิดใบสั่งซื้อ ${po.poNo}`
    });

    // Also close the PR
    const pr = prs.find(p => p.id === po.prId);
    if (pr) {
      pr.status = 'CLOSED';
      pr.activityLog.push({
        action: 'ปิดเอกสาร (Closed)',
        user: user.name,
        role: user.title,
        timestamp,
        note: `PO ที่เกี่ยวข้องถูกรับสินค้าและปิดงานแล้ว`
      });
    }

    storageService.savePOs(pos);
    storageService.saveProducts(products);
    storageService.saveStockLogs(stockLogs);
    storageService.savePRs(prs);

    // Dispatch Notification for Goods Received
    notificationService.dispatch({
      type: 'GOODS_RECEIVED',
      title: 'รับสินค้าเข้าคลังและปิด PO เรียบร้อย (+IN)',
      message: `ใบสั่งซื้อ ${po.poNo} ได้รับสินค้าครบถ้วนเข้าคลัง สต๊อกการ์ดถูกอัปเดตเรียบร้อยแล้ว`,
      docNo: po.poNo,
      refDocType: 'PO',
      refDocId: po.id,
      department: po.department,
      targetRoles: [po.department === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN', 'ASST_MANAGER'],
      amount: po.grandTotal,
      actor: user.name
    });

    return po;
  },

  // --- Quick Issue Stock (เบิกจ่าย) ---
  async quickIssueStock(productId, issueQty, user, note = '') {
    const products = storageService.getProducts();
    const stockLogs = storageService.getStockLogs();
    const timestamp = new Date().toLocaleString('th-TH');

    const prodIndex = products.findIndex(p => p.id === productId);
    if (prodIndex === -1) throw new Error('Product not found');

    const product = products[prodIndex];
    const sUnit = product.stockUnit || product.unit || 'ชิ้น';
    const numIssueQty = Number(issueQty) || 0;

    if (product.stockBalance < numIssueQty) {
      throw new Error(`จำนวนคงเหลือไม่พอเบิก (มี ${product.stockBalance} ${sUnit}, ต้องการเบิก ${numIssueQty} ${sUnit})`);
    }

    const newBal = Math.round((product.stockBalance - numIssueQty) * 10000) / 10000;
    product.stockBalance = newBal;

    const logNo = `REQ-${Date.now().toString().slice(-4)}`;
    stockLogs.unshift({
      id: `LOG-${Date.now()}`,
      date: timestamp,
      productId: product.id,
      productCode: product.code,
      type: 'OUT',
      docNo: logNo,
      qty: numIssueQty,
      unit: sUnit,
      balance: newBal,
      user: `${user.name} (${user.title})`,
      note: note || `เบิกสินค้าไปใช้งาน`
    });

    storageService.saveProducts(products);
    storageService.saveStockLogs(stockLogs);

    // Dispatch Notification for Quick Issue & Check ROP
    notificationService.dispatch({
      type: 'STOCK_ISSUED',
      title: 'เบิกจ่ายสินค้าสำเร็จ (-OUT)',
      message: `เบิกจ่าย ${product.name} (${product.code}) จำนวน ${numIssueQty} ${sUnit} คงเหลือ ${newBal} ${sUnit}`,
      docNo: logNo,
      refDocType: 'STOCK',
      refDocId: product.id,
      department: product.category,
      targetRoles: [product.category === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ADMIN'],
      actor: user.name
    });

    if (newBal <= (product.reorderPoint || 0)) {
      notificationService.dispatch({
        type: 'LOW_STOCK_ROP',
        title: '⚠️ แจ้งเตือน: สต๊อกสินค้าแตะจุดสั่งซื้อ (ROP Alert)',
        message: `สินค้า "${product.name}" (${product.code}) มียอดคงเหลือ ${newBal} ${sUnit} ซึ่งน้อยกว่าหรือเท่ากับจุด ROP (${product.reorderPoint} ${sUnit}) แนะนำให้เปิด PR สั่งซื้อเพิ่ม`,
        docNo: product.code,
        refDocType: 'STOCK',
        refDocId: product.id,
        department: product.category,
        targetRoles: [product.category === 'PD' ? 'REQUESTER_PD' : 'REQUESTER_QC', 'ASST_MANAGER', 'ADMIN'],
        actor: 'ระบบแจ้งเตือนสต๊อกอัตโนมัติ'
      });
    }

    return product;
  }
};
