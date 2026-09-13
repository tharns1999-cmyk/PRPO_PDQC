import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { authService, DEFAULT_EMPLOYEE_ACCOUNTS } from '../src/services/authService';

describe('Scenario 8: Username/Password & Position Login for Localhost Testing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Default employee accounts are available for each position', () => {
    const accounts = authService.getRegisteredUsers();
    expect(accounts.length).toBe(6);
    expect(accounts.some(a => a.username === 'wichai.pd')).toBe(true);
    expect(accounts.some(a => a.username === 'somchai.am')).toBe(true);
    expect(accounts.some(a => a.username === 'prasert.pm')).toBe(true);
    expect(accounts.some(a => a.username === 'nat.on')).toBe(true);
  });

  it('Successful login returns session and role permissions', async () => {
    const userSession = await authService.login('wichai.pd', 'password123');

    expect(userSession).toBeDefined();
    expect(userSession.name).toBe('คุณวิชัย (PD)');
    expect(userSession.department).toBe('PD');
    expect(userSession.canCreatePR).toBe(true);
    expect(userSession.canViewBudget).toBe(false);

    // Verify session persistence
    const savedSession = authService.getCurrentSession();
    expect(savedSession).toBeDefined();
    expect(savedSession.username).toBe('wichai.pd');
  });

  it('Login by position key works accurately', async () => {
    const mgrSession = await authService.loginByPosition('APPROVER');
    expect(mgrSession.name).toBe('คุณประเสริฐ (Plant Mgr)');
    expect(mgrSession.canFinalApprove).toBe(true);
    expect(mgrSession.canViewBudget).toBe(true);
  });

  it('Login with invalid credentials throws descriptive error', async () => {
    await expect(
      authService.login('wichai.pd', 'wrong_password')
    ).rejects.toThrow('ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง');

    await expect(
      authService.login('nonexistent.user', '123456')
    ).rejects.toThrow('ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง');
  });

  it('Logout clears active session', async () => {
    await authService.login('admin', 'admin123');
    expect(authService.getCurrentSession()).not.toBeNull();

    authService.logout();
    expect(authService.getCurrentSession()).toBeNull();
  });

  it('Default employee accounts have valid company emails and metadata', () => {
    DEFAULT_EMPLOYEE_ACCOUNTS.forEach(account => {
      expect(account.email).toBeDefined();
      expect(account.email).toContain('@company.com');
      expect(account.employeeId).toBeDefined();
      expect(account.department).toBeDefined();
    });
  });

  it('Role permissions checklist maps accurately for Requester', async () => {
    const { getRolePermissionsChecklist } = await import('../src/services/authService');
    const requester = DEFAULT_EMPLOYEE_ACCOUNTS.find(a => a.roleId === 'REQUESTER_PD');
    const checklist = getRolePermissionsChecklist(requester);

    const prCreation = checklist.find(p => p.key === 'PR_CREATION');
    const approval = checklist.find(p => p.key === 'APPROVAL');
    const purchasing = checklist.find(p => p.key === 'PURCHASING');
    const inventory = checklist.find(p => p.key === 'INVENTORY');

    expect(prCreation.allowed).toBe(true);
    expect(approval.allowed).toBe(false);
    expect(purchasing.allowed).toBe(false);
    expect(inventory.allowed).toBe(true); // Requester can receive in department
  });

  it('Role permissions checklist grants full access to Admin', async () => {
    const { getRolePermissionsChecklist } = await import('../src/services/authService');
    const adminUser = DEFAULT_EMPLOYEE_ACCOUNTS.find(a => a.roleId === 'ADMIN');
    const checklist = getRolePermissionsChecklist(adminUser);

    expect(checklist.every(p => p.allowed === true)).toBe(true);
  });

  it('Role permissions checklist maps accurately for Purchaser', async () => {
    const { getRolePermissionsChecklist } = await import('../src/services/authService');
    const purchaser = DEFAULT_EMPLOYEE_ACCOUNTS.find(a => a.roleId === 'ONLINE_PURCHASER');
    const checklist = getRolePermissionsChecklist(purchaser);

    const prCreation = checklist.find(p => p.key === 'PR_CREATION');
    const purchasing = checklist.find(p => p.key === 'PURCHASING');

    expect(prCreation.allowed).toBe(false);
    expect(purchasing.allowed).toBe(true);
  });
});
