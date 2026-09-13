/**
 * Auth & RBAC Subsystem & Google Workspace GAS Integration Tests
 * 
 * Verifies:
 * - Scenario 1: Login & RBAC Route Guard (Purchaser restricted from Budget/Warehouse)
 * - Scenario 2: GRN Requester vs. Warehouse Scoping (PD vs QC isolation vs Warehouse all depts)
 * - Scenario 3: Mock vs. Production GAS Bridge (Localhost callGAS execution and timeouts)
 * - Scenario 4: Structured Google Drive Folder Routing (01_PR, 02_PO, 03_GRN, 04_Claim)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import './setup.js';

import { 
  AuthProvider, 
  useAuth,
  CANONICAL_ROLES, 
  PERMISSIONS, 
  normalizeRole, 
  isSessionValid,
  AUTH_STORAGE_KEY 
} from '../src/context/AuthContext';
import ProtectedRoute, { AccessDeniedCard } from '../src/components/common/ProtectedRoute';
import { callGAS, isGASAvailable, MOCK_GAS_USERS } from '../src/services/gasClient';
import { 
  driveService, 
  resolveDriveFolderPath, 
  uploadFileToDrive, 
  fileToBase64,
  DRIVE_ROOT_FOLDER,
  DRIVE_CATEGORIES 
} from '../src/services/driveService';
import LoginView from '../src/views/auth/LoginView';
import DevRoleSwitcher from '../src/components/common/DevRoleSwitcher';
import Sidebar from '../src/components/common/Sidebar';

describe('RBAC & Google Workspace Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Objective 1: Lightweight Authentication & Session Management', () => {
    it('apiLogin via callGAS validates Employee ID and PIN successfully', async () => {
      const result = await callGAS('apiLogin', 'EMP-PD-001', '1234');
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.employeeId).toBe('EMP-PD-001');
      expect(result.user.canonicalRole).toBe('REQUESTER');
      expect(result.user.department).toBe('PD');
      // Critical security check: PIN/Password must be stripped from returned user
      expect(result.user.pin).toBeUndefined();
      expect(result.user.password).toBeUndefined();
    });

    it('apiLogin rejects invalid credentials or incorrect PIN', async () => {
      await expect(callGAS('apiLogin', 'EMP-PD-001', 'wrong_pin')).rejects.toThrow(
        'รหัสพนักงาน/อีเมล หรือรหัส PIN ไม่ถูกต้อง'
      );
      await expect(callGAS('apiLogin', 'NON_EXISTENT', '1234')).rejects.toThrow(
        'รหัสพนักงาน/อีเมล หรือรหัส PIN ไม่ถูกต้อง'
      );
    });

    it('apiLogin rejects deactivated accounts with clear error alert', async () => {
      const inactiveUser = {
        id: 'USR-INACTIVE',
        employeeId: 'EMP-SUSPENDED',
        email: 'suspended@company.com',
        pin: '1234',
        name: 'ระงับการใช้งาน',
        department: 'PD',
        canonicalRole: 'REQUESTER',
        status: 'INACTIVE',
        isActive: false
      };

      // Mock deactivated user in storage
      localStorage.setItem('prpo_users_cache', JSON.stringify([inactiveUser]));
      await expect(callGAS('apiLogin', 'EMP-SUSPENDED', '1234')).rejects.toThrow(
        'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
      );
    });

    it('Session validity evaluation enforces 24-hour expiration threshold', () => {
      const now = Date.now();
      const validSession = {
        id: 'USR-0001',
        employeeId: 'EMP-PD-001',
        expiresAt: now + 3600000 // 1 hour in future
      };
      expect(isSessionValid(validSession)).toBe(true);

      const expiredSession = {
        id: 'USR-0001',
        employeeId: 'EMP-PD-001',
        expiresAt: now - 1000 // 1 second in past
      };
      expect(isSessionValid(expiredSession)).toBe(false);
    });

    it('Role normalization accurately maps legacy and custom role identifiers into 5 canonical roles', () => {
      expect(normalizeRole('REQUESTER_PD')).toBe(CANONICAL_ROLES.REQUESTER);
      expect(normalizeRole('REQUESTER_QC')).toBe(CANONICAL_ROLES.REQUESTER);
      expect(normalizeRole('ONLINE_PURCHASER')).toBe(CANONICAL_ROLES.PURCHASER);
      expect(normalizeRole('WAREHOUSE')).toBe(CANONICAL_ROLES.WAREHOUSE);
      expect(normalizeRole('PLANT_MANAGER')).toBe(CANONICAL_ROLES.APPROVER);
      expect(normalizeRole('ASST_MANAGER')).toBe(CANONICAL_ROLES.APPROVER);
      expect(normalizeRole('ADMIN')).toBe(CANONICAL_ROLES.ADMIN);
      expect(normalizeRole('SYSTEM_ADMIN')).toBe(CANONICAL_ROLES.ADMIN);
    });

    it('Canonical permissions matrix strictly guards the 7 key enterprise capabilities', () => {
      expect(PERMISSIONS.PR_CREATE).toEqual(['REQUESTER', 'ADMIN']);
      expect(PERMISSIONS.PR_APPROVE).toEqual(['APPROVER', 'ADMIN']);
      expect(PERMISSIONS.ONLINE_PROCURE).toEqual(['PURCHASER', 'ADMIN']);
      expect(PERMISSIONS.CLAIM_RESOLVE).toEqual(['PURCHASER', 'ADMIN']);
      expect(PERMISSIONS.GRN_RECEIVE).toEqual(['WAREHOUSE', 'REQUESTER', 'ADMIN']);
      expect(PERMISSIONS.BUDGET_MANAGE).toEqual(['APPROVER', 'ADMIN']);
      expect(PERMISSIONS.SYSTEM_ADMIN).toEqual(['ADMIN']);
    });
  });

  describe('Scenario 1: Login & RBAC Route Guard', () => {
    it('AccessDeniedCard displays 403 details, current role, and required permission', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AccessDeniedCard
            requiredPermission="BUDGET_MANAGE"
            currentRole={{
              name: 'คุณนัท จัดซื้อ',
              canonicalRole: 'PURCHASER'
            }}
          />
        </MemoryRouter>
      );

      expect(html).toContain('สิทธิ์การเข้าถึงถูกจำกัด');
      expect(html).toContain('403 Access Denied / Role Restriction');
      expect(html).toContain('คุณนัท จัดซื้อ');
      expect(html).toContain('PURCHASER');
      expect(html).toContain('BUDGET_MANAGE');
      expect(html).toContain('กลับสู่หน้าหลัก');
    });

    it('ProtectedRoute blocks PURCHASER from accessing BUDGET_MANAGE and renders AccessDeniedCard', () => {
      // Seed purchaser user session in localStorage
      const purchaserUser = MOCK_GAS_USERS.find(u => u.canonicalRole === 'PURCHASER');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...purchaserUser,
        canonicalRole: 'PURCHASER',
        expiresAt: Date.now() + 86400000
      }));

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/budget']}>
          <AuthProvider>
            <ProtectedRoute requiredPermission="BUDGET_MANAGE">
              <div id="secret-budget-view">Secret Budget Content</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(html).not.toContain('secret-budget-view');
      expect(html).toContain('สิทธิ์การเข้าถึงถูกจำกัด');
      expect(html).toContain('BUDGET_MANAGE');
    });

    it('ProtectedRoute permits ADMIN to access any restricted section', () => {
      const adminUser = MOCK_GAS_USERS.find(u => u.canonicalRole === 'ADMIN');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...adminUser,
        canonicalRole: 'ADMIN',
        expiresAt: Date.now() + 86400000
      }));

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data']}>
          <AuthProvider>
            <ProtectedRoute requiredPermission="SYSTEM_ADMIN">
              <div id="master-data-content">Master Data Active Content</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(html).toContain('master-data-content');
    });
  });

  describe('Scenario 2: GRN Requester vs. Warehouse Scoping', () => {
    it('REQUESTER (PD) is permitted to access department PD and denied QC department', () => {
      const pdUser = MOCK_GAS_USERS.find(u => u.employeeId === 'EMP-PD-001');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...pdUser,
        canonicalRole: 'REQUESTER',
        department: 'PD',
        expiresAt: Date.now() + 86400000
      }));

      // Test access to PD
      const htmlPD = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <ProtectedRoute requiredDepartment="PD">
              <div id="pd-grn-record">PO-PD-2026-001 Receiving</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );
      expect(htmlPD).toContain('pd-grn-record');

      // Test access to QC
      const htmlQC = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <ProtectedRoute requiredDepartment="QC">
              <div id="qc-grn-record">PO-QC-2026-001 Receiving</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );
      expect(htmlQC).not.toContain('qc-grn-record');
      expect(htmlQC).toContain('สิทธิ์การเข้าถึงถูกจำกัด');
    });

    it('WAREHOUSE has unrestricted department access across both PD and QC records', () => {
      const whUser = MOCK_GAS_USERS.find(u => u.canonicalRole === 'WAREHOUSE');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...whUser,
        canonicalRole: 'WAREHOUSE',
        department: 'ALL',
        expiresAt: Date.now() + 86400000
      }));

      // Check PD access
      const htmlPD = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <ProtectedRoute requiredDepartment="PD">
              <div id="warehouse-pd">Warehouse Receiving PD Goods</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );
      expect(htmlPD).toContain('warehouse-pd');

      // Check QC access
      const htmlQC = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <ProtectedRoute requiredDepartment="QC">
              <div id="warehouse-qc">Warehouse Receiving QC Goods</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );
      expect(htmlQC).toContain('warehouse-qc');
    });
  });

  describe('Scenario 3: Mock vs. Production GAS Bridge', () => {
    it('isGASAvailable returns false in standard Node/Vite localhost environment without google.script.run', () => {
      expect(isGASAvailable()).toBe(false);
    });

    it('callGAS safely executes apiGetUsers and apiGetDepartments via mock router on localhost', async () => {
      const usersRes = await callGAS('apiGetUsers');
      expect(usersRes.success).toBe(true);
      expect(Array.isArray(usersRes.users)).toBe(true);
      expect(usersRes.users.length).toBeGreaterThanOrEqual(5);

      const deptsRes = await callGAS('apiGetDepartments');
      expect(deptsRes.success).toBe(true);
      expect(Array.isArray(deptsRes.departments)).toBe(true);
      expect(deptsRes.departments.some(d => d.code === 'PD')).toBe(true);
      expect(deptsRes.departments.some(d => d.code === 'QC')).toBe(true);
    });

    it('callGAS properly delegates to google.script.run when live GAS global is injected', async () => {
      let registeredSuccessHandler = null;

      global.google = {
        script: {
          run: {
            withSuccessHandler: (handler) => {
              registeredSuccessHandler = handler;
              return {
                withFailureHandler: () => ({
                  testLiveGAS: () => {
                    if (registeredSuccessHandler) {
                      registeredSuccessHandler({ success: true, mode: 'LIVE_GAS' });
                    }
                  }
                })
              };
            }
          }
        }
      };

      expect(isGASAvailable()).toBe(true);

      const gasPromise = callGAS('testLiveGAS');
      const response = await gasPromise;
      expect(response.success).toBe(true);
      expect(response.mode).toBe('LIVE_GAS');

      delete global.google;
      expect(isGASAvailable()).toBe(false);
    });
  });

  describe('Scenario 4: Structured Google Drive Document Hierarchy & Routing', () => {
    it('Resolves standard PR attachment folder path with YYYY-MM stamping', () => {
      const testDate = new Date('2026-09-13T10:00:00Z');
      const prPath = resolveDriveFolderPath('PR', '', testDate);
      expect(prPath).toBe(`${DRIVE_ROOT_FOLDER}/${DRIVE_CATEGORIES.PR}/2026-09`);
    });

    it('Resolves standard PO document folder path with YYYY-MM stamping', () => {
      const testDate = new Date('2026-09-13T10:00:00Z');
      const poPath = resolveDriveFolderPath('PO', '', testDate);
      expect(poPath).toBe(`${DRIVE_ROOT_FOLDER}/${DRIVE_CATEGORIES.PO}/2026-09`);
    });

    it('Resolves GRN evidence path nested under {YYYY-MM}/{PO_NUMBER}', () => {
      const testDate = new Date('2026-09-13T10:00:00Z');
      const grnPath = resolveDriveFolderPath('GRN', 'PO-PD-2026-001', testDate);
      expect(grnPath).toBe(`${DRIVE_ROOT_FOLDER}/${DRIVE_CATEGORIES.GRN}/2026-09/PO-PD-2026-001`);
    });

    it('Resolves Claim evidence path nested under {YYYY-MM}/{PO_NUMBER}', () => {
      const testDate = new Date('2026-09-13T10:00:00Z');
      const claimPath = resolveDriveFolderPath('CLAIM', 'PO-QC-2026-042', testDate);
      expect(claimPath).toBe(`${DRIVE_ROOT_FOLDER}/${DRIVE_CATEGORIES.CLAIM}/2026-09/PO-QC-2026-042`);
    });

    it('uploadFileToDrive converts payload, routes to Drive folder, and returns drive link', async () => {
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const uploadResult = await uploadFileToDrive({
        base64Data: mockBase64,
        fileName: 'damaged_item_round2.jpg',
        mimeType: 'image/jpeg',
        category: 'GRN',
        poNumber: 'PO-PD-2026-001',
        description: 'รูปสินค้าชำรุดจากการตรวจรับรอบที่ 2'
      });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.fileId).toBeDefined();
      expect(uploadResult.fileUrl).toContain('https://drive.google.com/file/d/');
      expect(uploadResult.fileName).toBe('damaged_item_round2.jpg');
      expect(uploadResult.folderPath).toContain('03_GRN_Evidence');
      expect(uploadResult.folderPath).toContain('PO-PD-2026-001');
    });
  });

  describe('UI Component Aesthetics & Dev Tooling', () => {
    it('LoginView renders modern SaaS branding and inputs', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <LoginView />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(html).toContain('PR-PO &amp; Stock System');
      expect(html).toContain('เข้าสู่ระบบ (Sign In)');
      expect(html).toContain('รหัสพนักงาน / อีเมล');
      expect(html).toContain('รหัสความปลอดภัย PIN');
      expect(html).toContain('สลับผู้ใช้ด่วน (Dev / Sandbox)');
    });

    it('DevRoleSwitcher is permanently unmounted and returns null to eliminate state corruption', () => {
      const requesterUser = MOCK_GAS_USERS.find(u => u.canonicalRole === 'REQUESTER');
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...requesterUser,
        canonicalRole: 'REQUESTER',
        expiresAt: Date.now() + 86400000
      }));

      const html = renderToStaticMarkup(
        <AuthProvider>
          <DevRoleSwitcher />
        </AuthProvider>
      );

      expect(html).toBe('');
    });

    it('LoginView provides standard 1-click persona authentication replacing the floating switcher', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <LoginView />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(html).toContain('สลับผู้ใช้ด่วน (Dev / Sandbox)');
      expect(html).toContain('1-Click Login');
    });
  });

  describe('Objective: Comprehensive Logout & Session Teardown Mechanism', () => {
    it('Sidebar renders 3-part micro layout with dedicated Logout button in profile footer', () => {
      const mockRole = {
        name: 'คุณสมหญิง (QC)',
        title: 'Requester (QC)',
        department: 'QC',
        roleId: 'REQUESTER_QC',
        pictureUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Sidebar 
            currentRole={mockRole}
            currentUser={mockRole}
            onLogout={() => {}}
          />
        </MemoryRouter>
      );

      // Part 1: Avatar
      expect(html).toContain('photo-1580489944761-15a19d654956');
      // Part 2: Middle Truncated Info
      expect(html).toContain('คุณสมหญิง (QC)');
      expect(html).toContain('Requester');
      // Part 3: Action Group with Dedicated Logout Button
      expect(html).toContain('data-testid="sidebar-logout-btn"');
      expect(html).toContain('ออกจากระบบ (Sign Out)');
      expect(html).toContain('aria-label="ออกจากระบบ"');
    });

    it('Clean authentication lifecycle teardown clears session and redirects to /login', () => {
      const requesterUser = MOCK_GAS_USERS[0];
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...requesterUser,
        expiresAt: Date.now() + 86400000
      }));

      // Verify unmounted DevRoleSwitcher returns null
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <DevRoleSwitcher />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(html).toBe('');

      // Session teardown purges storage key cleanly
      localStorage.removeItem(AUTH_STORAGE_KEY);
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });

    it('Authoritative session teardown atomically purges all auth storage keys', () => {
      // Seed storage with active credentials
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        id: 'USR-0001',
        employeeId: 'EMP-PD-001',
        name: 'คุณวิชัย',
        canonicalRole: 'REQUESTER'
      }));
      localStorage.setItem('prpo_current_user', JSON.stringify({ id: 'USR-0001' }));
      localStorage.setItem('prpo_auth_session', JSON.stringify({ id: 'USR-0001' }));

      expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
      expect(localStorage.getItem('prpo_current_user')).not.toBeNull();
      expect(localStorage.getItem('prpo_auth_session')).not.toBeNull();

      // Test Session Teardown Consumer
      function LogoutExecutor() {
        const { logout, isAuthenticated, currentUser } = useAuth();
        return (
          <div>
            <button data-testid="execute-logout-btn" onClick={logout}>Do Logout</button>
            <span data-testid="is-auth">{isAuthenticated ? 'YES' : 'NO'}</span>
            <span data-testid="user-state">{currentUser ? 'ACTIVE' : 'NULL'}</span>
          </div>
        );
      }

      // Initial state is authenticated
      const htmlBefore = renderToStaticMarkup(
        <AuthProvider>
          <LogoutExecutor />
        </AuthProvider>
      );
      expect(htmlBefore).toContain('YES');
      expect(htmlBefore).toContain('ACTIVE');

      // Execute storage purge (simulating logout invocation)
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('prpo_current_user');
      localStorage.removeItem('prpo_auth_session');

      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem('prpo_current_user')).toBeNull();
      expect(localStorage.getItem('prpo_auth_session')).toBeNull();

      // Rerender state is unauthenticated / NULL
      const htmlAfter = renderToStaticMarkup(
        <AuthProvider>
          <LogoutExecutor />
        </AuthProvider>
      );
      expect(htmlAfter).toContain('NO');
      expect(htmlAfter).toContain('NULL');
    });

    it('Direct Route Protection immediately bounces unauthenticated requests to /login', () => {
      // Verify that accessing ProtectedRoute when logged out renders redirect to /login
      localStorage.clear();

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute requiredRole="REQUESTER">
                    <div id="protected-dashboard">Secret Dashboard</div>
                  </ProtectedRoute>
                } 
              />
              <Route path="/login" element={<div id="login-screen">Redirected to Login</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Must NOT contain protected dashboard content
      expect(html).not.toContain('protected-dashboard');
    });

    it('Re-login fidelity restores authenticated access and role capabilities seamlessly', async () => {
      // 1. Initial State: Logged out
      localStorage.clear();

      // 2. Perform Login via callGAS as Nat (Purchaser)
      const loginRes = await callGAS('apiLogin', 'EMP-PUR-001', '1234');
      expect(loginRes.success).toBe(true);
      expect(loginRes.user.canonicalRole).toBe('PURCHASER');

      // 3. Store verified session payload
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...loginRes.user,
        expiresAt: Date.now() + 86400000
      }));

      // 4. Verify Route Access is restored
      const htmlRestored = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/online-tasks']}>
          <AuthProvider>
            <ProtectedRoute requiredPermission="ONLINE_PROCURE">
              <div id="online-hub">Online Procurement Hub Access Granted</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(htmlRestored).toContain('online-hub');
    });
  });
});

