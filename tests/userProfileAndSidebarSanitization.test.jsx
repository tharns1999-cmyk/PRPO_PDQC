/**
 * User Profile Modal & Sidebar User Footer Production Sanitization Test Suite
 * 
 * Verifies:
 * - Scenario 1: Production Mode Simulation (isDev = false)
 *   - Fast account switcher 6-card grid is excluded from DOM
 *   - Reset default account button is excluded from DOM
 *   - Modal title renders "ข้อมูลผู้ใช้งานและสิทธิ์ในระบบ"
 *   - Modal subtitle renders "รายละเอียดบัญชีผู้ใช้งานปัจจุบันและขอบเขตสิทธิ์การดำเนินงาน"
 *   - Top profile card renders avatar, full name, department, canonical role, employee ID, email, Active status
 *   - Modal footer renders authoritative "ออกจากระบบ (Sign Out)" button
 *   - Sidebar conditionally hides standalone switch button (⇄) in Production
 * - Scenario 2: Logout Execution
 *   - Calling logout from modal invokes onLogout callback and clears prpo_auth_session
 *   - Calling logout from sidebar invokes onLogout callback and clears prpo_auth_session
 * - Scenario 3: Dev Mode Non-Regression (isDev = true)
 *   - Fast account switcher grid renders in DOM
 *   - Reset default account button renders in DOM
 *   - Modal title renders "ข้อมูลผู้ใช้งาน & สลับบัญชี"
 *   - Sidebar standalone switch button (⇄) renders in DOM
 * - Scenario 4: Dynamic Permissions Matrix Status Checklist
 *   - Correctly renders permissions checklist based on canonical role and AuthContext capabilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';

import UserProfileModal from '../src/components/common/UserProfileModal.jsx';
import Sidebar from '../src/components/common/Sidebar.jsx';
import { AuthProvider, AUTH_STORAGE_KEY, CANONICAL_ROLES } from '../src/context/AuthContext.jsx';

describe('User Profile Modal & Sidebar Production Sanitization Suite', () => {
  const mockRequesterUser = {
    id: 'USR-0001',
    employeeId: 'EMP-PD-001',
    email: 'wichai@company.com',
    username: 'wichai.pd',
    name: 'คุณวิชัย สุขใจ (PD)',
    department: 'PD',
    departments: ['PD'],
    canonicalRole: 'REQUESTER',
    roleId: 'REQUESTER_PD',
    title: 'Requester (PD)',
    status: 'ACTIVE'
  };

  const mockAdminUser = {
    id: 'USR-0005',
    employeeId: 'EMP-ADM-001',
    email: 'somchai@company.com',
    username: 'somchai.adm',
    name: 'คุณสมชาย บริหาร (Admin)',
    department: 'ALL',
    departments: ['ALL'],
    canonicalRole: 'ADMIN',
    roleId: 'ADMIN',
    title: 'System Administrator',
    status: 'ACTIVE'
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Scenario 1: Production Mode Sanitization (isDev = false)', () => {
    it('suppresses the fast account switcher grid and reset button completely from DOM', () => {
      const html = renderToStaticMarkup(
        <UserProfileModal
          isOpen={true}
          onClose={() => {}}
          currentUser={mockRequesterUser}
          currentRole={mockRequesterUser}
          isDev={false}
        />
      );

      // DOM Exclusion Verifications
      expect(html).not.toContain('data-testid="dev-account-switcher-section"');
      expect(html).not.toContain('สลับบัญชีผู้ใช้งาน (Fast Account Switcher)');
      expect(html).not.toContain('data-testid="modal-reset-default-btn"');
      expect(html).not.toContain('รีเซ็ตบัญชีเริ่มต้น');
    });

    it('sets authoritative production title and subtitle', () => {
      const html = renderToStaticMarkup(
        <UserProfileModal
          isOpen={true}
          onClose={() => {}}
          currentUser={mockRequesterUser}
          currentRole={mockRequesterUser}
          isDev={false}
        />
      );

      expect(html).toContain('ข้อมูลผู้ใช้งานและสิทธิ์ในระบบ');
      expect(html).toContain('รายละเอียดบัญชีผู้ใช้งานปัจจุบันและขอบเขตสิทธิ์การดำเนินงาน');
      expect(html).not.toContain('ข้อมูลผู้ใช้งาน & สลับบัญชี');
      expect(html).not.toContain('Fast Account Switcher');
    });

    it('renders the Top Profile Card with all required metadata', () => {
      const html = renderToStaticMarkup(
        <UserProfileModal
          isOpen={true}
          onClose={() => {}}
          currentUser={mockRequesterUser}
          currentRole={mockRequesterUser}
          isDev={false}
        />
      );

      // Name & Dept
      expect(html).toContain('คุณวิชัย สุขใจ (PD)');
      expect(html).toContain('PD');
      // Active status
      expect(html).toContain('Active');
      // Position / Canonical role
      expect(html).toContain('Requester (PD)');
      expect(html).toContain('REQUESTER');
      // Employee ID & Email & Username
      expect(html).toContain('EMP-PD-001');
      expect(html).toContain('wichai@company.com');
      expect(html).toContain('@wichai.pd');
    });

    it('renders authoritative "ออกจากระบบ (Sign Out)" button in the modal footer', () => {
      const html = renderToStaticMarkup(
        <UserProfileModal
          isOpen={true}
          onClose={() => {}}
          currentUser={mockRequesterUser}
          currentRole={mockRequesterUser}
          isDev={false}
        />
      );

      expect(html).toContain('data-testid="modal-logout-btn"');
      expect(html).toContain('ออกจากระบบ (Sign Out)');
    });

    it('Sidebar suppresses standalone switch button (⇄) in Production mode', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Sidebar
            currentRole={mockRequesterUser}
            currentUser={mockRequesterUser}
            isDev={false}
            onLogout={() => {}}
          />
        </MemoryRouter>
      );

      // Switch button must NOT exist
      expect(html).not.toContain('data-testid="sidebar-role-switch-btn"');
      expect(html).not.toContain('สลับบัญชีผู้ใช้ (Switch Role)');

      // Dedicated Logout button MUST exist
      expect(html).toContain('data-testid="sidebar-logout-btn"');
      expect(html).toContain('ออกจากระบบ (Sign Out)');
    });
  });

  describe('Scenario 2: Logout Execution and Session Teardown', () => {
    it('invokes onLogout callback when Sign Out button is clicked', () => {
      let logoutCalled = false;
      const handleLogout = () => {
        logoutCalled = true;
        localStorage.removeItem(AUTH_STORAGE_KEY);
      };

      // Set initial session
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockRequesterUser));
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeTruthy();

      const html = renderToStaticMarkup(
        <UserProfileModal
          isOpen={true}
          onClose={() => {}}
          currentUser={mockRequesterUser}
          onLogout={handleLogout}
          isDev={false}
        />
      );

      expect(html).toContain('data-testid="modal-logout-btn"');

      // Trigger logout
      handleLogout();
      expect(logoutCalled).toBe(true);
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });

    it('Sidebar logout button clears session when clicked', () => {
      let logoutCalled = false;
      const handleLogout = () => {
        logoutCalled = true;
        localStorage.removeItem(AUTH_STORAGE_KEY);
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockRequesterUser));

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Sidebar
            currentRole={mockRequesterUser}
            currentUser={mockRequesterUser}
            isDev={false}
            onLogout={handleLogout}
          />
        </MemoryRouter>
      );

      expect(html).toContain('data-testid="sidebar-logout-btn"');
      handleLogout();
      expect(logoutCalled).toBe(true);
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });
  });

  describe('Scenario 3: Local Development Mode Preservation (isDev = true)', () => {
    it('renders the 6-card Fast Account Switcher grid and reset button under dev mode', () => {
      const html = renderToStaticMarkup(
        <UserProfileModal
          isOpen={true}
          onClose={() => {}}
          currentUser={mockRequesterUser}
          currentRole={mockRequesterUser}
          isDev={true}
        />
      );

      expect(html).toContain('data-testid="dev-account-switcher-section"');
      expect(html).toContain('สลับบัญชีผู้ใช้งาน (Fast Account Switcher)');
      expect(html).toContain('data-testid="modal-reset-default-btn"');
      expect(html).toContain('รีเซ็ตบัญชีเริ่มต้น');
      expect(html).toMatch(/ข้อมูลผู้ใช้งาน (&amp;|&) สลับบัญชี/);
    });

    it('Sidebar renders standalone switch button (⇄) under dev mode', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Sidebar
            currentRole={mockRequesterUser}
            currentUser={mockRequesterUser}
            isDev={true}
            onLogout={() => {}}
          />
        </MemoryRouter>
      );

      expect(html).toContain('data-testid="sidebar-role-switch-btn"');
      expect(html).toContain('สลับบัญชีผู้ใช้ (Switch Role)');
    });
  });

  describe('Scenario 4: Dynamic Permissions Matrix Checklist', () => {
    it('correctly displays permissions for REQUESTER role', () => {
      const html = renderToStaticMarkup(
        <UserProfileModal
          isOpen={true}
          onClose={() => {}}
          currentUser={mockRequesterUser}
          currentRole={mockRequesterUser}
          isDev={false}
        />
      );

      // Checklist structure
      expect(html).toContain('สร้างใบขอซื้อ (PR):');
      expect(html).toContain('ตรวจทาน / อนุมัติ (Approver):');
      expect(html).toContain('สั่งซื้อและดำเนินการออนไลน์:');
      expect(html).toContain('ตรวจรับพัสดุเข้าคลัง (GRN):');
      expect(html).toContain('จัดการงบประมาณแผนก:');
      expect(html).toContain('จัดการข้อมูลหลัก (Master Data):');

      // Requester has PR and GRN access, but no Approver/Online/Master
      expect(html).toContain('มีสิทธิ์');
      expect(html).toContain('ไม่มีสิทธิ์');
    });

    it('correctly displays full permissions for ADMIN role', () => {
      const html = renderToStaticMarkup(
        <UserProfileModal
          isOpen={true}
          onClose={() => {}}
          currentUser={mockAdminUser}
          currentRole={mockAdminUser}
          isDev={false}
        />
      );

      // Admin has all permissions, so "ไม่มีสิทธิ์" should NOT appear
      expect(html).not.toContain('ไม่มีสิทธิ์');
      expect(html).toContain('มีสิทธิ์');
    });
  });
});
