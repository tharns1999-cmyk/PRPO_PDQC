// Notification Service (In-App Local Caching)

const NOTIFICATIONS_STORAGE_KEY = 'prpo_in_app_notifications';

export const NOTIFICATION_TYPES = {
  PR_SUBMITTED: {
    id: 'PR_SUBMITTED',
    label: 'PR รอการตรวจสอบ (Review Level 1)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'FileText',
    colorHex: '#D97706',
    priority: 'URGENT'
  },
  PR_REVIEWED: {
    id: 'PR_REVIEWED',
    label: 'PR ผ่านการตรวจ รออนุมัติ (Final Approve)',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: 'ShieldCheck',
    colorHex: '#2563EB',
    priority: 'URGENT'
  },
  PR_APPROVED: {
    id: 'PR_APPROVED',
    label: 'PR ได้รับการอนุมัติ (ออก PO อัตโนมัติ)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: 'CheckCircle2',
    colorHex: '#059669',
    priority: 'INFO'
  },
  PR_REJECTED: {
    id: 'PR_REJECTED',
    label: 'PR ถูกส่งกลับ / ปฏิเสธ',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'XCircle',
    colorHex: '#DC2626',
    priority: 'URGENT'
  },
  PR_CANCELLED: {
    id: 'PR_CANCELLED',
    label: 'PR ถูกยกเลิก',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'XCircle',
    colorHex: '#E11D48',
    priority: 'URGENT'
  },
  ONLINE_TASK: {
    id: 'ONLINE_TASK',
    label: 'งานสั่งซื้อออนไลน์ (Shopee/Lazada)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: 'ShoppingBag',
    colorHex: '#7C3AED',
    priority: 'URGENT'
  },
  ONLINE_ORDERED: {
    id: 'ONLINE_ORDERED',
    label: 'สั่งซื้อออนไลน์แล้ว (รอตรวจรับของ)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: 'ShoppingBag',
    colorHex: '#9333EA',
    priority: 'INFO'
  },
  PO_CANCELLED: {
    id: 'PO_CANCELLED',
    label: 'PO ถูกยกเลิก',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'XCircle',
    colorHex: '#BE123C',
    priority: 'URGENT'
  },
  GOODS_RECEIVED: {
    id: 'GOODS_RECEIVED',
    label: 'รับสินค้าเข้าคลัง (+IN Stock Card)',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: 'PackageCheck',
    colorHex: '#0D9488',
    priority: 'INFO'
  },
  LOW_STOCK_ROP: {
    id: 'LOW_STOCK_ROP',
    label: 'แจ้งเตือนสต๊อกต่ำกว่าจุดสั่งซื้อ (ROP Alert)',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'AlertTriangle',
    colorHex: '#E11D48',
    priority: 'URGENT'
  },
  STOCK_ISSUED: {
    id: 'STOCK_ISSUED',
    label: 'เบิกจ่ายสินค้าสำเร็จ (-OUT)',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: 'ArrowDownRight',
    colorHex: '#475569',
    priority: 'INFO'
  },
  PO_CLAIM: {
    id: 'PO_CLAIM',
    label: 'แจ้งปัญหา / เคลมสินค้า',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'AlertOctagon',
    colorHex: '#DC2626',
    priority: 'URGENT'
  },
  SELF_CLAIM: {
    id: 'SELF_CLAIM',
    label: 'แจ้งปัญหาสินค้า (จัดซื้อทั่วไป)',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'AlertTriangle',
    colorHex: '#E11D48',
    priority: 'URGENT'
  },
  PO_CLAIM_RESEND: {
    id: 'PO_CLAIM_RESEND',
    label: 'ส่งสินค้าทดแทน / จัดซื้อใหม่ (Claim Resend)',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: 'RefreshCw',
    colorHex: '#2563EB',
    priority: 'URGENT'
  },
  PO_CLAIM_CLOSED: {
    id: 'PO_CLAIM_CLOSED',
    label: 'ปิดเคสหลังแจ้งปัญหา (Claim Closed)',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'Lock',
    colorHex: '#64748B',
    priority: 'INFO'
  }

};

export const notificationService = {
  // Read all notifications from local storage
  getAll() {
    try {
      const data = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveAll(notifications) {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  },

  // Helper to check if a notification is targeted for the current role
  isNotificationTarget(n, currentRole) {
    if (!currentRole) return true;
    if (currentRole.id === 'ADMIN' || currentRole.roleId === 'ADMIN' || Number(currentRole.level) >= 99) return true;

    // 1. Role Filter
    if (Array.isArray(n.targetRoles) && n.targetRoles.length > 0) {
      const userLevel = Number(currentRole.level || 1);
      const isOnline = currentRole.roleId === 'ONLINE_PURCHASER' || currentRole.id === 'ONLINE_PURCHASER' || currentRole.positionKey === 'ONLINE_PURCHASER' || (currentRole.canOnlinePurchase && userLevel < 99);

      let roleMatches = n.targetRoles.includes(currentRole.id) ||
        n.targetRoles.includes(currentRole.roleId) ||
        n.targetRoles.includes(currentRole.positionKey);

      if (!roleMatches) {
        if (isOnline && n.targetRoles.includes('ONLINE_PURCHASER')) {
          roleMatches = true;
        } else if (!isOnline && userLevel === 2 && !currentRole.canFinalApprove && n.targetRoles.some(r => ['ASST_MANAGER', 'REVIEWER'].includes(r))) {
          roleMatches = true;
        } else if (userLevel >= 3 && n.targetRoles.some(r => ['PLANT_MANAGER', 'APPROVER'].includes(r))) {
          roleMatches = true;
        } else if (userLevel === 1 && n.targetRoles.some(r => ['REQUESTER', 'REQUESTER_PD', 'REQUESTER_QC'].includes(r))) {
          if (n.targetRoles.includes(`REQUESTER_${currentRole.department}`) || n.targetRoles.includes('REQUESTER')) {
            roleMatches = true;
          }
        }
      }

      if (!roleMatches) return false;
    }

    // 2. Department Filter (if department is specified and not ALL)
    if (n.department && n.department !== 'ALL') {
      if (currentRole.department !== 'ALL' && !currentRole.canViewAllDepts && currentRole.department !== n.department) {
        return false;
      }
    }

    return true;
  },

  // Get notifications filtered for a specific role or all if Admin
  getNotificationsForRole(currentRole) {
    const all = this.getAll();
    if (!currentRole) return all;

    return all.filter(n => this.isNotificationTarget(n, currentRole))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  // Unread count
  getUnreadCount(currentRole) {
    const list = this.getNotificationsForRole(currentRole);
    return list.filter(n => !n.isRead).length;
  },

  // Mark a specific notification as read
  markAsRead(id) {
    const all = this.getAll();
    const updated = all.map(n => n.id === id ? { ...n, isRead: true } : n);
    this.saveAll(updated);
    return updated;
  },

  // Mark all notifications as read for role
  markAllAsRead(currentRole) {
    const all = this.getAll();
    const updated = all.map(n => {
      if (this.isNotificationTarget(n, currentRole)) {
        return { ...n, isRead: true };
      }
      return n;
    });
    this.saveAll(updated);
    return updated;
  },

  // Clear all
  clearAll() {
    this.saveAll([]);
  },

  // Dispatch an In-App Notification
  dispatch({
    type,
    title,
    message,
    docNo = '',
    refDocType = '', // 'PR' | 'PO' | 'STOCK'
    refDocId = '',
    department = 'ALL',
    targetRoles = [],
    amount = null,
    actor = ''
  }) {
    const all = this.getAll();
    const typeInfo = NOTIFICATION_TYPES[type] || {
      id: type,
      label: 'การแจ้งเตือน',
      badgeColor: 'bg-slate-100 text-slate-700',
      colorHex: '#4F46E5'
    };

    const newNoti = {
      id: `NOTI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      typeInfo,
      title,
      message,
      docNo,
      refDocType,
      refDocId,
      department,
      targetRoles,
      amount,
      actor,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }),
      isRead: false
    };

    all.unshift(newNoti);
    // Keep max 100 notifications in local cache to avoid memory bloating
    const trimmed = all.slice(0, 100);
    this.saveAll(trimmed);

    console.log('[NotificationService] In-App Notification created:', newNoti);
    return newNoti;
  }
};
