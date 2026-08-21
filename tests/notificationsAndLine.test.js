import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { ROLES } from '../src/config/constants';
import { notificationService } from '../src/services/notificationService';

describe('Scenario 6: In-App Notifications Validation', () => {
  beforeEach(() => {
    notificationService.clearAll();
  });

  it('Dispatch notification saves to local storage with unread status', () => {
    const noti = notificationService.dispatch({
      type: 'PR_SUBMITTED',
      title: 'PR รอตรวจสอบ',
      message: 'ใบขอซื้อ PD001/2026 รอคุณสมชายตรวจสอบ',
      docNo: 'PD001/2026',
      refDocType: 'PR',
      refDocId: 'PR-100',
      department: 'PD',
      targetRoles: ['ASST_MANAGER', 'ADMIN'],
      amount: 15000,
      actor: 'คุณวิชัย (PD)'
    });

    expect(noti.id).toBeDefined();
    expect(noti.isRead).toBe(false);

    const all = notificationService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('PR รอตรวจสอบ');
  });

  it('Role-based notification filtering: Asst Manager sees review notifications, Requester does not', () => {
    notificationService.dispatch({
      type: 'PR_SUBMITTED',
      title: 'PR รอตรวจสอบ Level 1',
      message: 'รายละเอียด...',
      targetRoles: ['ASST_MANAGER', 'ADMIN']
    });

    // Asst Manager should see it
    const asstNotis = notificationService.getNotificationsForRole(ROLES.ASST_MANAGER);
    expect(asstNotis.length).toBe(1);

    // Requester QC should not see it
    const qcNotis = notificationService.getNotificationsForRole(ROLES.REQUESTER_QC);
    expect(qcNotis.length).toBe(0);

    // Admin should see everything
    const adminNotis = notificationService.getNotificationsForRole(ROLES.ADMIN);
    expect(adminNotis.length).toBe(1);
  });

  it('Mark as read updates unread counter', () => {
    const noti = notificationService.dispatch({
      type: 'PR_REVIEWED',
      title: 'PR ผ่านการตรวจ',
      message: 'รอ Plant Manager อนุมัติ',
      targetRoles: ['PLANT_MANAGER']
    });

    expect(notificationService.getUnreadCount(ROLES.PLANT_MANAGER)).toBe(1);

    notificationService.markAsRead(noti.id);
    expect(notificationService.getUnreadCount(ROLES.PLANT_MANAGER)).toBe(0);
  });
});
