// ─── ROLES & PERMISSION MATRIX ─────────────────────────────────────────────
// Supports both generic roles (scalable for any department) and legacy roles
export const ROLES = {
  // Generic Roles (Scalable for any department: PD, QC, HR, IT, etc.)
  REQUESTER: {
    id: 'REQUESTER',
    title: 'Requester (ผู้ขอซื้อ)',
    name: 'Requester Staff',
    department: 'PD',
    canViewBudget: false,
    canCreatePR: true,
    canSubmitPR: true,
    canDeleteOwnDraft: true,
    canReceiveGoods: true,
    canCloseOwnPO: true,
    canManageMaster: true,
    canDeleteMaster: false,
    canViewAllDepts: false,
    canReview: false,
    canFinalApprove: false,
    canViewBudgetMenu: false,
    canSetBudget: false,
    canOnlinePurchase: false,
    level: 1,
  },
  REVIEWER: {
    id: 'REVIEWER',
    title: 'Reviewer / Asst. Manager (ผู้ตรวจทาน PR)',
    name: 'Reviewer',
    department: 'ALL',
    canViewBudget: true,
    canCreatePR: true,
    canSubmitPR: true,
    canDeleteOwnDraft: true,
    canReceiveGoods: true,
    canCloseOwnPO: true,
    canManageMaster: true,
    canDeleteMaster: false,
    canViewAllDepts: true,
    canReview: true,         // ตรวจสอบ → Reviewed หรือ Reject
    canFinalApprove: false,
    canViewBudgetMenu: true,
    canSetBudget: false,
    canOnlinePurchase: false,
    level: 2,
  },
  APPROVER: {
    id: 'APPROVER',
    title: 'Approver / Plant Manager (ผู้อนุมัติขั้นสุดท้าย)',
    name: 'Approver',
    department: 'ALL',
    canViewBudget: true,
    canCreatePR: true,
    canSubmitPR: true,
    canDeleteOwnDraft: true,
    canReceiveGoods: true,
    canCloseOwnPO: true,
    canManageMaster: true,
    canDeleteMaster: false,
    canViewAllDepts: true,
    canReview: true,
    canFinalApprove: true,   // Approve → PO / Reject / Cancel PR
    canViewBudgetMenu: true,
    canSetBudget: true,
    canOnlinePurchase: false,
    level: 3,
  },
  ONLINE_PURCHASER: {
    id: 'ONLINE_PURCHASER',
    title: 'Online Purchaser (จัดซื้อออนไลน์)',
    name: 'คุณนัท (Online Purchaser)',
    department: 'ALL',
    canViewBudget: false,
    canCreatePR: false,
    canSubmitPR: false,
    canDeleteOwnDraft: false,
    canReceiveGoods: false,
    canCloseOwnPO: false,
    canManageMaster: false,
    canDeleteMaster: false,
    canViewAllDepts: true,
    canReview: false,
    canFinalApprove: false,
    canViewBudgetMenu: false,
    canSetBudget: false,
    canOnlinePurchase: true, // รับ Task Online, Update Actual Price, ปิด PO Online
    level: 2,
  },
  ADMIN: {
    id: 'ADMIN',
    title: 'System Admin',
    name: 'Admin System',
    department: 'ALL',
    canViewBudget: true,
    canCreatePR: true,
    canSubmitPR: true,
    canDeleteOwnDraft: true,
    canReceiveGoods: true,
    canCloseOwnPO: true,
    canManageMaster: true,
    canDeleteMaster: true,
    canViewAllDepts: true,
    canReview: true,
    canFinalApprove: true,
    canViewBudgetMenu: true,
    canSetBudget: true,
    canOnlinePurchase: true,
    level: 99,
  },

  // Legacy Department-Specific Aliases (Kept for 100% backward compatibility)
  REQUESTER_PD: {
    id: 'REQUESTER_PD',
    title: 'Requester (PD)',
    name: 'คุณวิชัย (PD)',
    department: 'PD',
    canViewBudget: false,
    canCreatePR: true,
    canSubmitPR: true,
    canDeleteOwnDraft: true,
    canReceiveGoods: true,
    canCloseOwnPO: true,
    canManageMaster: true,
    canDeleteMaster: false,
    canViewAllDepts: false,
    canReview: false,
    canFinalApprove: false,
    canViewBudgetMenu: false,
    canSetBudget: false,
    canOnlinePurchase: false,
    level: 1,
  },
  REQUESTER_QC: {
    id: 'REQUESTER_QC',
    title: 'Requester (QC)',
    name: 'คุณสมหญิง (QC)',
    department: 'QC',
    canViewBudget: false,
    canCreatePR: true,
    canSubmitPR: true,
    canDeleteOwnDraft: true,
    canReceiveGoods: true,
    canCloseOwnPO: true,
    canManageMaster: true,
    canDeleteMaster: false,
    canViewAllDepts: false,
    canReview: false,
    canFinalApprove: false,
    canViewBudgetMenu: false,
    canSetBudget: false,
    canOnlinePurchase: false,
    level: 1,
  },
  ASST_MANAGER: {
    id: 'ASST_MANAGER',
    title: 'Assistant Manager',
    name: 'คุณสมชาย (Asst. Mgr)',
    department: 'ALL',
    canViewBudget: true,
    canCreatePR: true,
    canSubmitPR: true,
    canDeleteOwnDraft: true,
    canReceiveGoods: false,
    canCloseOwnPO: false,
    canManageMaster: true,
    canDeleteMaster: false,
    canViewAllDepts: true,
    canReview: true,
    canFinalApprove: false,
    canViewBudgetMenu: true,
    canSetBudget: false,
    canOnlinePurchase: false,
    level: 2,
  },
  PLANT_MANAGER: {
    id: 'PLANT_MANAGER',
    title: 'Plant Manager',
    name: 'คุณประเสริฐ (Plant Mgr)',
    department: 'ALL',
    canViewBudget: true,
    canCreatePR: true,
    canSubmitPR: true,
    canDeleteOwnDraft: true,
    canReceiveGoods: false,
    canCloseOwnPO: false,
    canManageMaster: true,
    canDeleteMaster: false,
    canViewAllDepts: true,
    canReview: true,
    canFinalApprove: true,
    canViewBudgetMenu: true,
    canSetBudget: true,
    canOnlinePurchase: false,
    level: 3,
  },
};

// ─── USER LEVEL HIERARCHY ──────────────────────────────────────────────────
export const USER_LEVELS = {
  1: { level: 1, title: 'Level 1: Requester (ผู้ขอซื้อประจำแผนก)', desc: 'สร้าง/ส่ง PR, รับของเข้าสต็อกแผนก, เบิกจ่ายด่วน' },
  2: { level: 2, title: 'Level 2: Reviewer / Asst. Manager (ผู้ตรวจทาน PR)', desc: 'สิทธิ์ Level 1 + ตรวจสอบ PR ขั้นที่ 1, ดูงบประมาณ, ดูข้ามแผนก' },
  3: { level: 3, title: 'Level 3: Approver / Plant Manager (ผู้อนุมัติขั้นสุดท้าย)', desc: 'สิทธิ์ Level 1+2 + อนุมัติ PR ออก PO อัตโนมัติ, ตั้งค่างบประมาณ' },
  4: { level: 4, title: 'Level 4: Executive / Director (ผู้บริหารระดับสูง)', desc: 'สิทธิ์ Level 1+2+3 + อนุมัติพิเศษ/Memo วงเงินสูง' },
  99: { level: 99, title: 'Level 99: System Administrator (ผู้ดูแลระบบ)', desc: 'สิทธิ์เต็มทุกโมดูลในระบบ' },
};

/**
 * Resolve permissions dynamically based on user Level (Hierarchical Inheritance)
 * Level สูงกว่าจะได้สิทธิ์ของ Level ต่ำกว่าทั้งหมดเสมอ (ยกเว้น canReceiveGoods ที่เป็นงานของ Level 1 ประจำแผนกเท่านั้น)
 */
export function resolveUserPermissions(user) {
  if (!user) return ROLES.REQUESTER;
  
  const level = Number(user.level || 1);
  const dept = user.department || 'PD';
  const isOnline = user.roleId === 'ONLINE_PURCHASER' || user.role_id === 'ONLINE_PURCHASER';

  return {
    id: user.roleId || user.role_id || (level >= 99 ? 'ADMIN' : level >= 3 ? 'APPROVER' : level >= 2 ? (isOnline ? 'ONLINE_PURCHASER' : 'REVIEWER') : 'REQUESTER'),
    title: user.title || (level >= 99 ? 'System Admin' : level >= 3 ? `Plant Manager (${dept})` : level >= 2 ? (isOnline ? 'Online Purchaser' : `Asst. Manager (${dept})`) : `Requester (${dept})`),
    name: user.name || user.employee_name || user.employeeName || 'Staff',
    department: dept,
    level: level,

    // ─── LEVEL 1+ PERMISSIONS (พนักงานทุกคน) ───
    canCreatePR: level >= 1,
    canSubmitPR: level >= 1,
    canDeleteOwnDraft: level >= 1,
    canReceiveGoods: level === 1 || level >= 99,
    canCloseOwnPO: level === 1 || level >= 99,
    canManageMaster: level >= 1,

    // ─── LEVEL 2+ PERMISSIONS (หัวหน้างาน / ผู้ช่วยผู้จัดการ) ───
    canReview: level >= 2,
    canViewBudget: level >= 2,
    canViewBudgetMenu: level >= 2,
    canViewAllDepts: level >= 2 || dept === 'ALL',

    // ─── LEVEL 3+ PERMISSIONS (ผู้จัดการ / ผู้อนุมัติขั้นสุดท้าย) ───
    canFinalApprove: level >= 3,
    canSetBudget: level >= 3,

    // ─── LEVEL 99 PERMISSIONS (System Admin) ───
    canDeleteMaster: level >= 99,

    // ─── SPECIAL TASK PERMISSIONS ───
    canOnlinePurchase: isOnline || level >= 99,
  };
}

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────
export const DEPARTMENTS = {
  PD:   { id: 'PD',   prefix: 'PD',   name: 'ฝ่ายผลิต (Production)',            monthlyBudget: 150000 },
  QC:   { id: 'QC',   prefix: 'QC',   name: 'ฝ่ายควบคุมคุณภาพ (QC/R&D)',        monthlyBudget: 80000  },
};

// ─── PR STATUS ────────────────────────────────────────────────────────────────
// Workflow: DRAFT → SUBMITTED → REVIEWED → APPROVED → PO_ISSUED → IN_PROGRESS_ONLINE / CLOSED
// Rejection 1-Level: Level 3 Rejection -> REJECTED_TO_L2, Level 2 Rejection -> REJECTED_TO_DRAFT
export const PR_STATUS = {
  DRAFT:               { id: 'DRAFT',               label: 'ร่างเอกสาร (Draft)',              color: 'bg-slate-100 text-slate-600 border-slate-200' },
  SUBMITTED:           { id: 'SUBMITTED',           label: 'รอตรวจสอบ (Asst. Mgr)',           color: 'bg-amber-50 text-amber-700 border-amber-200' },
  REVIEWED:            { id: 'REVIEWED',            label: 'ผ่านตรวจ / รออนุมัติ (Plant Mgr)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  APPROVED:            { id: 'APPROVED',            label: 'อนุมัติแล้ว (สร้าง PO)',           color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED:            { id: 'REJECTED',            label: 'ไม่อนุมัติ (Rejected)',            color: 'bg-rose-50 text-rose-700 border-rose-200' },
  REJECTED_TO_L2:      { id: 'REJECTED_TO_L2',      label: 'ส่งกลับ Level 2 (Asst. Mgr ตรวจใหม่)', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  REJECTED_TO_DRAFT:   { id: 'REJECTED_TO_DRAFT',   label: 'ถูกส่งกลับให้แก้ไข (ร่าง)',        color: 'bg-orange-50 text-orange-700 border-orange-200' },
  CANCELLED:           { id: 'CANCELLED',           label: 'ยกเลิกแล้ว (Cancelled)',           color: 'bg-slate-100 text-slate-500 border-slate-300' },
  PO_ISSUED:           { id: 'PO_ISSUED',           label: 'ออก PO แล้ว (รอดำเนินการ)',        color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  IN_PROGRESS_ONLINE:  { id: 'IN_PROGRESS_ONLINE',  label: 'กำลังดำเนินการ Online',            color: 'bg-violet-50 text-violet-700 border-violet-200' },
  CLOSED:              { id: 'CLOSED',              label: 'เสร็จสิ้น (Closed)',               color: 'bg-teal-50 text-teal-700 border-teal-200' },
};

// ─── PO STATUS ────────────────────────────────────────────────────────────────
export const PO_STATUS = {
  ISSUED:                   { id: 'ISSUED',                   label: 'ออก PO แล้ว (รอรับของ)',        color: 'bg-blue-50 text-blue-700 border-blue-200' },
  IN_DELIVERY:              { id: 'IN_DELIVERY',              label: 'กำลังจัดส่ง',                   color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  IN_PROGRESS_ONLINE:       { id: 'IN_PROGRESS_ONLINE',       label: 'สั่งซื้อ Online อยู่ระหว่างดำเนิน',  color: 'bg-violet-50 text-violet-700 border-violet-200' },
  ORDERED_PENDING_DELIVERY: { id: 'ORDERED_PENDING_DELIVERY', label: 'สั่งซื้อแล้ว (รอจัดส่ง/รับของ)', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  PARTIAL:                  { id: 'PARTIAL',                  label: 'รับของแล้วบางส่วน',             color: 'bg-amber-50 text-amber-700 border-amber-200' },
  RECEIVED:                 { id: 'RECEIVED',                 label: 'รับสินค้าเข้าคลังแล้ว',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED:                { id: 'CANCELLED',                label: 'ยกเลิก',                        color: 'bg-rose-50 text-rose-700 border-rose-200' },
  CLOSED:                   { id: 'CLOSED',                   label: 'เสร็จสิ้น (Closed)',            color: 'bg-teal-50 text-teal-700 border-teal-200' },
};

// ─── MEMO ─────────────────────────────────────────────────────────────────────
export const MEMO_THRESHOLD = 20000; // บาท — ต้องมี MEMO เมื่อยอด PR ≥ ค่านี้

export const MEMO_CLASSIFICATION = {
  ASSET:   { id: 'ASSET',   label: 'Asset (ทรัพย์สิน)' },
  EXPENSE: { id: 'EXPENSE', label: 'Expense (ค่าใช้จ่าย)' },
  OTHER:   { id: 'OTHER',   label: 'Other (อื่นๆ)' },
};

export const MEMO_CONCLUSION = {
  APPROVED:              { id: 'APPROVED',              label: 'Approved (อนุมัติ)' },
  CONDITIONALLY_APPROVED:{ id: 'CONDITIONALLY_APPROVED',label: 'Conditionally Approved (อนุมัติมีเงื่อนไข)' },
  NOT_APPROVED:          { id: 'NOT_APPROVED',          label: 'Not Approved (ไม่อนุมัติ)' },
  OTHER:                 { id: 'OTHER',                 label: 'Other (อื่นๆ)' },
};

// ─── PURCHASE CHANNEL ─────────────────────────────────────────────────────────
export const PURCHASE_CHANNEL = {
  SELF:   { id: 'SELF',   label: 'ซื้อเอง (จัดซื้อภายใน)',          icon: 'Building2' },
  ONLINE: { id: 'ONLINE', label: 'Online (Shopee / Lazada)',         icon: 'ShoppingCart' },
};

// ─── SOURCE ───────────────────────────────────────────────────────────────────
export const PR_SOURCE = {
  OFFICE:  { id: 'OFFICE',  label: 'OFFICE (สำนักงาน)' },
  FACTORY: { id: 'FACTORY', label: 'FACTORY (โรงงาน/สายการผลิต)' },
};

// ─── VENDOR DEPARTMENTS ───────────────────────────────────────────────────────
export const VENDOR_DEPARTMENTS = {
  PD:   { id: 'PD',   label: 'ฝ่ายผลิต (PD)' },
  QC:   { id: 'QC',   label: 'ฝ่ายควบคุมคุณภาพ (QC)' },
  BOTH: { id: 'BOTH', label: 'ใช้ร่วมกันทุกแผนก (BOTH)' },
};

// ─── STOCK IN REASONS ─────────────────────────────────────────────────────────
export const STOCK_IN_REASONS = [
  'สต็อกตั้งต้น (Opening Stock)',
  'ปรับปรุงยอดคงเหลือ (Stock Adjustment)',
  'รับคืนจากสายการผลิต (Return from Production)',
  'รับจาก Supplier นอกระบบ PO (Non-PO Receipt)',
  'ของแถม / ส่วนเพิ่ม (Free Items / Bonus)',
  'อื่นๆ (Other)',
];

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  CURRENT_ROLE: 'prpo_current_role',
  PRODUCTS:     'prpo_products_data',
  VENDORS:      'prpo_vendors_data',
  PRS:          'prpo_prs_data',
  POS:          'prpo_pos_data',
  STOCK_LOGS:   'prpo_stock_logs',
  BUDGETS:      'prpo_budgets_data',
  PR_COUNTERS:  'prpo_pr_counters',  // { "HR": 1, "PD": 2, ... }
  SIGNATURES:   'prpo_signatures',   // { [roleId/userId]: { signatureUrl, name, updatedAt } }
  AUDIT_LOGS:   'prpo_audit_logs',   // [ { id, timestamp, action, actorName, docNo, details, ... } ]
};
