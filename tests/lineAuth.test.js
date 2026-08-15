import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { ROLES } from '../src/config/constants';
import { lineService, DEFAULT_MOCK_LINE_USERS } from '../src/services/lineService';

describe('Scenario 7: LINE Authentication & UID Role Mapping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Default LINE user mappings contain all system roles', () => {
    const mappings = lineService.getUserMappings();
    expect(mappings.length).toBeGreaterThanOrEqual(6);

    const rolesInMapping = mappings.map(m => m.roleId);
    expect(rolesInMapping).toContain('REQUESTER_PD');
    expect(rolesInMapping).toContain('REQUESTER_QC');
    expect(rolesInMapping).toContain('ASST_MANAGER');
    expect(rolesInMapping).toContain('PLANT_MANAGER');
    expect(rolesInMapping).toContain('ONLINE_PURCHASER');
    expect(rolesInMapping).toContain('ADMIN');
  });

  it('Current profile fallback maps accurately to active system role', () => {
    const profilePD = lineService.getCurrentProfile(ROLES.REQUESTER_PD);
    expect(profilePD.roleId).toBe('REQUESTER_PD');
    expect(profilePD.department).toBe('PD');

    const profilePlant = lineService.getCurrentProfile(ROLES.PLANT_MANAGER);
    expect(profilePlant.roleId).toBe('PLANT_MANAGER');
    expect(profilePlant.employeeName).toContain('ประเสริฐ');
  });

  it('Binding a custom LINE UID updates user mapping registry', () => {
    const customUid = 'U_CUSTOM_EMPLOYEE_9999999999999999';
    const boundUser = lineService.bindUserRole(
      customUid,
      'ASST_MANAGER',
      'คุณมานะ (Asst Mgr ใหม่)',
      'ALL'
    );

    expect(boundUser.lineUid).toBe(customUid);
    expect(boundUser.roleId).toBe('ASST_MANAGER');
    expect(boundUser.employeeName).toBe('คุณมานะ (Asst Mgr ใหม่)');

    const allMappings = lineService.getUserMappings();
    const found = allMappings.find(m => m.lineUid === customUid);
    expect(found).toBeDefined();
    expect(found.employeeName).toBe('คุณมานะ (Asst Mgr ใหม่)');
  });
});
