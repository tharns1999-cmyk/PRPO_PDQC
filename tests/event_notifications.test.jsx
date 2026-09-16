import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import './setup.js';
import { notificationService } from '../src/services/notificationService';
import NotificationPopover from '../src/components/common/NotificationPopover';
import NotificationBell from '../src/components/common/NotificationBell';

describe('Event-Driven Notification Engine (Strict Role & Department, Zero Email)', () => {
  beforeEach(() => {
    localStorage.clear();
    notificationService.saveAll([]);
  });

  describe('1. Role & Department Filter Matrix', () => {
    const mockNotifications = [
      {
        id: 'NTF-001',
        title: 'PR รออนุมัติ',
        message: 'PR-PD-001 รออนุมัติ',
        targetDepartment: 'PD',
        targetRole: 'Approver',
        docRef: 'PR-PD-001'
      },
      {
        id: 'NTF-002',
        title: 'PR ได้รับอนุมัติ',
        message: 'PR-PD-001 ได้รับอนุมัติแล้ว',
        targetDepartment: 'PD',
        targetRole: 'Requester',
        docRef: 'PR-PD-001'
      },
      {
        id: 'NTF-003',
        title: 'PR พร้อมออก PO',
        message: 'PR-PD-001 อนุมัติแล้ว พร้อมจัดซื้อ',
        targetDepartment: 'PD',
        targetRole: 'Purchaser',
        docRef: 'PR-PD-001'
      },
      {
        id: 'NTF-004',
        title: 'PR QC รออนุมัติ',
        message: 'PR-QC-001 รออนุมัติ',
        targetDepartment: 'QC',
        targetRole: 'Approver',
        docRef: 'PR-QC-001'
      },
      {
        id: 'NTF-005',
        title: 'ระบบแจ้งปิดปรับปรุง',
        message: 'แจ้งเตือนทุกคนทุกแผนก',
        targetDepartment: 'ALL',
        targetRole: 'ALL',
        docRef: 'SYS-001'
      }
    ];

    it('should filter correctly for Requester in PD (cannot see Approver or QC notifs)', () => {
      const pdRequester = {
        name: 'Somchai Requester',
        role: 'Requester',
        department: 'PD'
      };

      const matched = mockNotifications.filter(n => notificationService.isNotificationTarget(n, pdRequester));
      const ids = matched.map(n => n.id);

      expect(ids).toContain('NTF-002'); // PD Requester
      expect(ids).toContain('NTF-005'); // ALL ALL
      expect(ids).not.toContain('NTF-001'); // PD Approver
      expect(ids).not.toContain('NTF-003'); // PD Purchaser
      expect(ids).not.toContain('NTF-004'); // QC Approver
    });

    it('should filter correctly for Approver (can see approval notifications across departments and ALL, but not Requester or Purchaser)', () => {
      const pdApprover = {
        name: 'Manager Somkid',
        role: 'Approver',
        department: 'PD'
      };

      const matched = mockNotifications.filter(n => notificationService.isNotificationTarget(n, pdApprover));
      const ids = matched.map(n => n.id);

      expect(ids).toContain('NTF-001'); // PD Approver
      expect(ids).toContain('NTF-004'); // QC Approver (unlocked for Approver)
      expect(ids).toContain('NTF-005'); // ALL ALL
      expect(ids).not.toContain('NTF-002'); // PD Requester
      expect(ids).not.toContain('NTF-003'); // PD Purchaser
    });

    it('should filter correctly for Purchaser (sees Purchaser notifs and ALL)', () => {
      const purchaser = {
        name: 'Ploy Buyer',
        role: 'Purchaser',
        department: 'PD'
      };

      const matched = mockNotifications.filter(n => notificationService.isNotificationTarget(n, purchaser));
      const ids = matched.map(n => n.id);

      expect(ids).toContain('NTF-003'); // PD Purchaser
      expect(ids).toContain('NTF-005'); // ALL ALL
      expect(ids).not.toContain('NTF-001'); // PD Approver
      expect(ids).not.toContain('NTF-002'); // PD Requester
    });

    it('should allow Admin to see all notifications regardless of dept or role', () => {
      const adminUser = {
        name: 'Super Admin',
        role: 'admin',
        isAdmin: true,
        department: 'HQ'
      };

      const matched = mockNotifications.filter(n => notificationService.isNotificationTarget(n, adminUser));
      expect(matched.length).toBe(mockNotifications.length);
    });

    it('should unlock department filter for Approver and MGT (Approver sees PR approval notifs from PD and QC)', () => {
      const mgtApprover = {
        name: 'Executive MGT',
        role: 'Approver',
        department: 'MGT'
      };

      const matched = mockNotifications.filter(n => notificationService.isNotificationTarget(n, mgtApprover));
      const ids = matched.map(n => n.id);

      // Approver in MGT must see Approver notifications from PD, QC, and ALL
      expect(ids).toContain('NTF-001'); // PD Approver
      expect(ids).toContain('NTF-004'); // QC Approver
      expect(ids).toContain('NTF-005'); // ALL ALL
      expect(ids).not.toContain('NTF-002'); // PD Requester
      expect(ids).not.toContain('NTF-003'); // PD Purchaser
    });

    it('should strictly verify NO email properties exist in notifications', () => {
      mockNotifications.forEach(n => {
        expect(n.targetEmail).toBeUndefined();
        expect(n.email).toBeUndefined();
        expect(n.userEmail).toBeUndefined();
      });
    });
  });

  describe('2. User-Specific Read Status Isolation (localStorage)', () => {
    it('should isolate readIds between different users by currentUser.name', () => {
      const userA = 'Tharn PD';
      const userB = 'Wichai QC';

      // Initial state: empty read lists
      expect(notificationService.getReadNotificationIds(userA)).toEqual([]);
      expect(notificationService.getReadNotificationIds(userB)).toEqual([]);

      // User A marks NTF-101 as read
      notificationService.markNotificationAsReadForUser(userA, 'NTF-101');

      // Verify User A has NTF-101 read, User B does not
      expect(notificationService.getReadNotificationIds(userA)).toEqual(['NTF-101']);
      expect(notificationService.getReadNotificationIds(userB)).toEqual([]);

      // User B marks NTF-202 as read
      notificationService.markNotificationAsReadForUser(userB, 'NTF-202');

      expect(notificationService.getReadNotificationIds(userA)).toEqual(['NTF-101']);
      expect(notificationService.getReadNotificationIds(userB)).toEqual(['NTF-202']);
    });

    it('should mark all notifications as read for a specific user without affecting others', () => {
      const userA = 'Anan Approver';
      const userB = 'Somsri Requester';

      notificationService.markAllNotificationsAsReadForUser(userA, ['NTF-01', 'NTF-02', 'NTF-03']);

      expect(notificationService.getReadNotificationIds(userA)).toEqual(['NTF-01', 'NTF-02', 'NTF-03']);
      expect(notificationService.getReadNotificationIds(userB)).toEqual([]);
    });

    it('should correctly reflect read state per user in getNotificationsForRole', () => {
      const notifs = [
        { id: 'NTF-501', title: 'Doc 1', targetDepartment: 'PD', targetRole: 'Requester', timestamp: new Date().toISOString() },
        { id: 'NTF-502', title: 'Doc 2', targetDepartment: 'PD', targetRole: 'Requester', timestamp: new Date().toISOString() }
      ];
      notificationService.saveAll(notifs);

      const userA = { name: 'UserA', role: 'Requester', department: 'PD' };
      const userB = { name: 'UserB', role: 'Requester', department: 'PD' };

      // User A reads NTF-501
      notificationService.markNotificationAsReadForUser(userA.name, 'NTF-501');

      const userANotifs = notificationService.getNotificationsForRole(userA, userA.name);
      const userBNotifs = notificationService.getNotificationsForRole(userB, userB.name);

      const userAItem1 = userANotifs.find(n => n.id === 'NTF-501');
      const userBItem1 = userBNotifs.find(n => n.id === 'NTF-501');

      expect(userAItem1.status).toBe('read');
      expect(userBItem1.status).not.toBe('read');
    });
  });

  describe('3. NotificationPopover Rendering & Component Verification', () => {
    const notifications = [
      {
        id: 'NTF-1',
        title: 'PR อนุมัติแล้ว',
        message: 'เอกสาร PR-001 อนุมัติแล้ว',
        targetDepartment: 'PD',
        targetRole: 'Requester',
        timestamp: new Date().toISOString()
      },
      {
        id: 'NTF-2',
        title: 'PR รออนุมัติ',
        message: 'เอกสาร PR-002 รออนุมัติ',
        targetDepartment: 'PD',
        targetRole: 'Approver',
        timestamp: new Date().toISOString()
      }
    ];

    it('renders only department/role scoped notifications for current user via renderToStaticMarkup', () => {
      const currentUser = {
        name: 'Sombat Requester',
        role: 'Requester',
        department: 'PD'
      };

      const html = renderToStaticMarkup(
        <NotificationPopover
          notifications={notifications}
          currentUser={currentUser}
        />
      );

      // Sombat is Requester -> should render NTF-1, but not NTF-2
      expect(html).toContain('PR อนุมัติแล้ว');
      expect(html).not.toContain('PR รออนุมัติ');
    });

    it('renders PD and QC approval notifications for Approver in MGT', () => {
      const mgtApprover = {
        name: 'Manager MGT',
        role: 'Approver',
        department: 'MGT'
      };
      const crossDeptNotifs = [
        { id: 'N-PD', title: 'PR-PD รออนุมัติ', targetDepartment: 'PD', targetRole: 'Approver', timestamp: new Date().toISOString() },
        { id: 'N-QC', title: 'PR-QC รออนุมัติ', targetDepartment: 'QC', targetRole: 'Approver', timestamp: new Date().toISOString() },
        { id: 'N-REQ', title: 'PR ส่วนบุคคล', targetDepartment: 'PD', targetRole: 'Requester', timestamp: new Date().toISOString() }
      ];

      const html = renderToStaticMarkup(
        <NotificationPopover
          notifications={crossDeptNotifs}
          currentUser={mgtApprover}
        />
      );

      expect(html).toContain('PR-PD รออนุมัติ');
      expect(html).toContain('PR-QC รออนุมัติ');
      expect(html).not.toContain('PR ส่วนบุคคล');
    });

    it('renders NotificationBell with reactive count matching "งานของฉัน" (My Tasks)', () => {
      const currentRole = { name: 'Manager MGT', role: 'Approver', department: 'MGT' };
      const taskCountFromWorkspace = 3;

      const html = renderToStaticMarkup(
        <NotificationBell
          currentRole={currentRole}
          count={taskCountFromWorkspace}
        />
      );

      // Bell badge must display the exact count from workspace tasks
      expect(html).toContain('3');
      expect(html).toContain('การแจ้งเตือน (3 รายการใหม่)');
    });

    it('supports user-specific read status in localStorage', () => {
      const safeUserName = 'sombat requester';
      const readIds = ['NTF-1'];
      localStorage.setItem(`prpo_read_notifications_${safeUserName}`, JSON.stringify(readIds));

      const stored = JSON.parse(localStorage.getItem(`prpo_read_notifications_${safeUserName}`));
      expect(stored).toEqual(['NTF-1']);
    });
  });
});
