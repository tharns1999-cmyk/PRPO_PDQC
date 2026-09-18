import { workflowEngine } from './workflowEngine';

/**
 * Workspace Service - Single Source of Truth for Workspace Task Routing & Lifecycle
 */

export const isUserMatched = (targetValue, currentUser) => {
  if (!targetValue || !currentUser) return false;
  const val = String(targetValue).trim().toLowerCase();
  const email = String(currentUser.email || '').trim().toLowerCase();
  const name = String(currentUser.name || '').trim().toLowerCase();
  const username = String(currentUser.username || '').trim().toLowerCase();
  const id = String(currentUser.id || '').trim().toLowerCase();
  return (email && val === email) || (name && val === name) || (username && val === username) || (id && val === id);
};

export const isRequester = (user) => {
  if (!user) return false;
  const role = String(user.roleId || user.role || user.canonicalRole || '').toUpperCase();
  const level = Number(user.level || 1);
  return level <= 1 || role.startsWith('REQUESTER');
};

/**
 * ตรวจสอบว่า Task นี้ต้องดำเนินการโดยฉัน (To Do) หรือไม่
 * กฎเหล็ก:
 * 1. บล็อก Requester จากการเห็น CLAIM_PENDING ใน To Do โดยเด็ดขาด
 * 2. เงื่อนไขเดียวที่ Requester จะได้ตรวจรับรอบ 2 คือสถานะ WAITING_DELIVERY_ROUND_2
 */
export const isTaskForMe = (task, user) => {
  if (!user) return false;
  if (task.docType === 'PR') {
    const isDone = ['PO_ISSUED', 'APPROVED', 'CLOSED', 'CANCELLED', 'completed', 'received'].includes(task.status);
    if (isDone) return false;
    return workflowEngine.canAction(user, task);
  }
  if (task.docType === 'PO') {
    const isDone = ['CLOSED', 'CANCELLED', 'RECEIVED', 'COMPLETED', 'COMPLETED_WITH_REFUND'].includes(task.status);
    if (isDone) return false;

    const isClaim = ['CLAIM_PENDING', 'CLAIM_REPORTED', 'CLAIM_IN_PROGRESS', 'PARTIALLY_RECEIVED_IN_CLAIM'].includes(task.status) || task.hasUnresolvedClaim;
    if (isClaim) {
      if (user?.id === 'ADMIN' || user?.roleId === 'ADMIN' || Number(user?.level || 1) >= 99) return true;
      if (task.purchaseChannel === 'ONLINE' && (user?.roleId === 'ONLINE_PURCHASER' || user?.canOnlinePurchase)) return true;
      // บล็อก Requester: ในสถานะ CLAIM_PENDING ห้ามโผล่ใน To Do เด็ดขาด
      return false;
    }

    // เงื่อนไขเดียวที่ Requester จะได้ตรวจรับรอบ 2: สถานะต้องเป็น WAITING_DELIVERY_ROUND_2
    if (task.status === 'WAITING_DELIVERY_ROUND_2') {
      return workflowEngine.canAction(user, task);
    }

    return workflowEngine.canAction(user, task);
  }
  return false;
};

export const isCompletedTask = (task, user) => {
  const isPR = task.docType === 'PR';
  let isDone = false;
  if (isPR) {
    isDone = ['COMPLETED', 'CLOSED', 'FORCE_CLOSED', 'REJECTED', 'CANCELLED', 'PO_ISSUED', 'APPROVED', 'completed', 'received'].includes(task.status);
  } else {
    isDone = ['COMPLETED', 'CLOSED', 'FORCE_CLOSED', 'REJECTED', 'CANCELLED', 'RECEIVED', 'COMPLETED_WITH_REFUND'].includes(task.status);
  }
  if (!isDone) return false;

  if (user?.id === 'ADMIN' || user?.roleId === 'ADMIN' || Number(user?.level || 1) >= 99) return true;

  const wasRequester = 
    isUserMatched(task.requestedBy, user) || 
    isUserMatched(task.applicantName1, user) || 
    isUserMatched(task.createdBy, user) || 
    task.requesterId === user?.id;

  const wasInLog = task.activityLog?.some(l => 
    isUserMatched(l.user, user) || 
    (user?.title && l.role === user.title)
  );

  return wasRequester || wasInLog;
};

export const isUserParticipant = (doc, currentUser) => {
  if (!doc || !currentUser) return false;
  const isRequesterMatch = 
    isUserMatched(doc.createdBy, currentUser) || 
    isUserMatched(doc.requestedBy, currentUser) ||
    isUserMatched(doc.applicantName1, currentUser) ||
    isUserMatched(doc.requesterEmail, currentUser) || 
    isUserMatched(doc.requesterName, currentUser) ||
    doc.requesterId === currentUser?.id;

  const isReviewer = 
    isUserMatched(doc.reviewedBy, currentUser) || 
    (Array.isArray(doc.reviewers) && doc.reviewers.some(r => isUserMatched(r, currentUser)));

  const isApprover = isUserMatched(doc.approvedBy, currentUser);

  const isHistoryMatch = 
    (Array.isArray(doc.history) && doc.history.some(h => isUserMatched(h.user || h.by || h.name, currentUser))) ||
    (Array.isArray(doc.timeline) && doc.timeline.some(t => isUserMatched(t.user || t.by || t.name, currentUser))) ||
    (Array.isArray(doc.activityLog) && doc.activityLog.some(l => isUserMatched(l.user, currentUser) || (currentUser?.title && l.role === currentUser.title)));

  return isRequesterMatch || isReviewer || isApprover || isHistoryMatch;
};

/**
 * ตรวจสอบงานที่รอผู้อื่นดำเนินการ (In Progress)
 * ย้ายใบที่มี CLAIM_PENDING มาอยู่ที่นี่ พร้อม Badge "⏳ รอฝ่ายจัดซื้อเจรจาเคลมร้านค้า"
 */
export const isInProgressTask = (task, user) => {
  if (isTaskForMe(task, user)) return false;
  
  const isPR = task.docType === 'PR';
  let isDone = false;
  if (isPR) {
    isDone = ['COMPLETED', 'CLOSED', 'FORCE_CLOSED', 'REJECTED', 'CANCELLED', 'PO_ISSUED', 'APPROVED', 'completed', 'received'].includes(task.status);
  } else {
    isDone = ['COMPLETED', 'CLOSED', 'FORCE_CLOSED', 'REJECTED', 'CANCELLED', 'RECEIVED', 'COMPLETED_WITH_REFUND'].includes(task.status);
  }
  if (isDone) return false;

  const roleId = String(user?.roleId || user?.id || '').toUpperCase();
  const userLevel = Number(user?.level || 1);
  if (roleId === 'ADMIN' || user?.role === 'admin' || userLevel >= 99) return true;

  return isUserParticipant(task, user);
};

export const getTaskBadgeLabel = (task, user) => {
  if (!task) return '';
  if (task.docType === 'PO') {
    if (['CLAIM_PENDING', 'CLAIM_REPORTED', 'CLAIM_IN_PROGRESS', 'PARTIALLY_RECEIVED_IN_CLAIM'].includes(task.status) || task.hasUnresolvedClaim) {
      const isPurchaser = user?.roleId === 'ONLINE_PURCHASER' || user?.canOnlinePurchase || user?.roleId === 'ADMIN' || Number(user?.level || 1) >= 99;
      return isPurchaser ? '🔴 รอเจรจาเคลมร้านค้า' : '⏳ รอฝ่ายจัดซื้อเจรจาเคลมร้านค้า';
    }
    if (task.status === 'WAITING_DELIVERY_ROUND_2') {
      return 'รอร้านค้าส่งของรอบที่ 2 (ทดแทน)';
    }
  }
  return task.statusLabel || task.status || '';
};

export const workspaceService = {
  isUserMatched,
  isRequester,
  isTaskForMe,
  isInProgressTask,
  isCompletedTask,
  isUserParticipant,
  getTaskBadgeLabel
};

export default workspaceService;
