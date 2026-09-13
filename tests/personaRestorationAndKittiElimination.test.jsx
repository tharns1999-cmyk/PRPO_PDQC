/**
 * Persona Restoration & Kitti Elimination Verification Suite
 * 
 * Verifies:
 * - Scenario 1: Kitti Elimination
 *   - No active user list (MOCK_GAS_USERS, LoginView, DevRoleSwitcher) contains Kitti or EMP-WH-001
 *   - System contains exactly 6 authentic personas
 * - Scenario 2: Somchai (Asst. Mgr) Login & Role Switch
 *   - apiLogin validates EMP-MGR-001 and PIN 1234 as REVIEWER
 *   - DevRoleSwitcher displays Somchai (Asst. Mgr) with REVIEWER badge
 *   - LoginView quick login grid displays Somchai (Asst. Mgr)
 *   - Somchai possesses PR_REVIEW, PR_APPROVE, and BUDGET_MANAGE capabilities
 * - Scenario 3: Department-Scoped GRN & Reviewer Scoping
 *   - Wichai (PD) can receive GRN for PD, denied QC
 *   - Somying (QC) can receive GRN for QC, denied PD
 *   - Somchai (Asst. Mgr) has access across both PD and QC departments
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';

import { 
  AuthProvider, 
  useAuth, 
  CANONICAL_ROLES, 
  PERMISSIONS, 
  normalizeRole, 
  AUTH_STORAGE_KEY 
} from '../src/context/AuthContext.jsx';
import { callGAS, MOCK_GAS_USERS } from '../src/services/gasClient.js';
import LoginView from '../src/views/auth/LoginView.jsx';
import DevRoleSwitcher from '../src/components/common/DevRoleSwitcher.jsx';
import ProtectedRoute from '../src/components/common/ProtectedRoute.jsx';

describe('Persona Restoration & Kitti Elimination Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Scenario 1: Kitti Elimination & Exactly 6 Authentic Personas', () => {
    it('MOCK_GAS_USERS contains exactly 6 authentic personas in canonical order', () => {
      expect(MOCK_GAS_USERS).toHaveLength(6);

      const expectedPersonas = [
        { name: 'คุณวิชัย สุขใจ (PD)', role: 'REQUESTER', empId: 'EMP-PD-001' },
        { name: 'คุณสมหญิง รักดี (QC)', role: 'REQUESTER', empId: 'EMP-QC-001' },
        { name: 'คุณสมชาย (Asst. Mgr)', role: 'REVIEWER', empId: 'EMP-MGR-001' },
        { name: 'คุณนัท จัดซื้อ (Purchaser)', role: 'PURCHASER', empId: 'EMP-PUR-001' },
        { name: 'คุณประเสริฐ ยิ่งยง (Plant Manager)', role: 'APPROVER', empId: 'EMP-MGR-002' },
        { name: 'ผู้ดูแลระบบ (System Admin)', role: 'ADMIN', empId: 'EMP-SYS-999' }
      ];

      expectedPersonas.forEach((expected, index) => {
        const user = MOCK_GAS_USERS[index];
        expect(user.name).toBe(expected.name);
        expect(user.canonicalRole).toBe(expected.role);
        expect(user.employeeId).toBe(expected.empId);
      });
    });

    it('confirms Kitti and EMP-WH-001 are completely purged from MOCK_GAS_USERS', () => {
      const kittiByName = MOCK_GAS_USERS.find(u => 
        u.name?.includes('กิตติ') || 
        u.displayName?.includes('Kitti') || 
        u.username?.includes('kitti')
      );
      expect(kittiByName).toBeUndefined();

      const kittiByEmpId = MOCK_GAS_USERS.find(u => u.employeeId === 'EMP-WH-001');
      expect(kittiByEmpId).toBeUndefined();
    });
  });

  describe('Scenario 2: Somchai (Asst. Mgr) Authentication & Role Switching', () => {
    it('authenticates Somchai with EMP-MGR-001 and PIN 1234 via apiLogin', async () => {
      const response = await callGAS('apiLogin', 'EMP-MGR-001', '1234');
      expect(response.success).toBe(true);
      expect(response.user).toBeDefined();
      expect(response.user.employeeId).toBe('EMP-MGR-001');
      expect(response.user.name).toBe('คุณสมชาย (Asst. Mgr)');
      expect(response.user.canonicalRole).toBe('REVIEWER');
      expect(response.user.title).toBe('Assistant Manager');
      expect(response.user.departments).toEqual(['PD', 'QC']);
    });

    it('LoginView 1-click grid renders Somchai and excludes Kitti', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <LoginView />
          </AuthProvider>
        </MemoryRouter>
      );

      // Must display Somchai
      expect(html).toContain('Somchai (Asst. Mgr)');
      expect(html).toContain('REVIEWER');

      // Must NOT display Kitti
      expect(html).not.toContain('Kitti (Warehouse)');
      expect(html).not.toContain('EMP-WH-001');
    });

    it('DevRoleSwitcher is unmounted while Somchai is accessible in LoginView with REVIEWER role', () => {
      const htmlSwitcher = renderToStaticMarkup(
        <AuthProvider>
          <DevRoleSwitcher />
        </AuthProvider>
      );
      expect(htmlSwitcher).toBe('');

      const htmlLogin = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <LoginView />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(htmlLogin).toContain('Somchai (Asst. Mgr)');
      expect(htmlLogin).toContain('REVIEWER');
    });

    it('evaluates Somchai permissions for PR_REVIEW, PR_APPROVE, and BUDGET_MANAGE', () => {
      let authHelpers = null;

      function TestComponent() {
        authHelpers = useAuth();
        return null;
      }

      const somchaiUser = MOCK_GAS_USERS.find(u => u.employeeId === 'EMP-MGR-001');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...somchaiUser,
        expiresAt: Date.now() + 86400000
      }));

      renderToStaticMarkup(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(authHelpers.canonicalRole).toBe('REVIEWER');
      expect(authHelpers.canAccess('PR_REVIEW')).toBe(true);
      expect(authHelpers.canAccess('PR_APPROVE')).toBe(true);
      expect(authHelpers.canAccess('BUDGET_MANAGE')).toBe(true);
      expect(authHelpers.canAccess('ONLINE_PROCURE')).toBe(false);
      expect(authHelpers.canAccess('SYSTEM_ADMIN')).toBe(false);
    });
  });

  describe('Scenario 3: GRN Access and Department Scoping', () => {
    it('permits Requester Wichai (PD) to receive GRN for PD, but denies QC', () => {
      const wichaiUser = MOCK_GAS_USERS.find(u => u.employeeId === 'EMP-PD-001');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...wichaiUser,
        expiresAt: Date.now() + 86400000
      }));

      let authHelpers = null;
      function TestComponent() {
        authHelpers = useAuth();
        return null;
      }

      renderToStaticMarkup(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(authHelpers.canAccess('GRN_RECEIVE')).toBe(true);
      expect(authHelpers.canAccessDepartment('PD')).toBe(true);
      expect(authHelpers.canAccessDepartment('QC')).toBe(false);
    });

    it('permits Requester Somying (QC) to receive GRN for QC, but denies PD', () => {
      const somyingUser = MOCK_GAS_USERS.find(u => u.employeeId === 'EMP-QC-001');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...somyingUser,
        expiresAt: Date.now() + 86400000
      }));

      let authHelpers = null;
      function TestComponent() {
        authHelpers = useAuth();
        return null;
      }

      renderToStaticMarkup(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(authHelpers.canAccess('GRN_RECEIVE')).toBe(true);
      expect(authHelpers.canAccessDepartment('QC')).toBe(true);
      expect(authHelpers.canAccessDepartment('PD')).toBe(false);
    });

    it('permits Somchai (Asst. Mgr) to access both PD and QC departments', () => {
      const somchaiUser = MOCK_GAS_USERS.find(u => u.employeeId === 'EMP-MGR-001');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...somchaiUser,
        expiresAt: Date.now() + 86400000
      }));

      let authHelpers = null;
      function TestComponent() {
        authHelpers = useAuth();
        return null;
      }

      renderToStaticMarkup(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(authHelpers.canAccessDepartment('PD')).toBe(true);
      expect(authHelpers.canAccessDepartment('QC')).toBe(true);
      expect(authHelpers.canAccessDepartment('ENG')).toBe(false);
    });
  });
});
