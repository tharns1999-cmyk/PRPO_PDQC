/**
 * Permission and Department Access Control Utilities
 * Supports multi-department access, wildcard (* or ALL), and backward compatibility.
 */

/**
 * Checks if a user has access to a specific department.
 * @param {Object} user - The user or currentRole object
 * @param {string} departmentCode - The department code to check (e.g. 'PD', 'QC')
 * @returns {boolean}
 */
export function hasDepartmentAccess(user, departmentCode) {
  if (!user) return false;
  if (!departmentCode) return true;

  const targetDept = String(departmentCode).trim().toUpperCase();

  // 1. Universal access roles (Admin, Plant Manager, or users explicitly assigned ALL/*)
  const roleId = String(user.roleId || user.id || '').toUpperCase();
  const isAdmin = roleId === 'ADMIN' || Number(user.level) >= 99 || user.role === 'admin';
  const isApprover = roleId === 'PLANT_MANAGER' || user.positionKey === 'APPROVER' || user.canFinalApprove || Number(user.level) >= 3;
  const assigned = Array.isArray(user.assignedDepartments) ? user.assignedDepartments : [];
  const allowed = Array.isArray(user.allowedDepartments) ? user.allowedDepartments : [];
  const hasAllInAssigned = assigned.includes('ALL') || assigned.includes('*') || allowed.includes('ALL') || allowed.includes('*');

  if (isAdmin || isApprover || (user.department === 'ALL' && user.canViewAllDepts) || hasAllInAssigned) {
    return true;
  }

  // 2. Check assignedDepartments (new canonical field) first
  if (assigned.length > 0) {
    const upperAssigned = assigned.map(d => String(d).trim().toUpperCase());
    if (upperAssigned.includes('*') || upperAssigned.includes('ALL')) return true;
    if (upperAssigned.includes(targetDept)) return true;
  }

  // 3. Check allowedDepartments array (legacy support)
  if (allowed.length > 0) {
    const upperAllowed = allowed.map(d => String(d).trim().toUpperCase());
    if (upperAllowed.includes('*') || upperAllowed.includes('ALL')) {
      return true;
    }
    if (upperAllowed.includes(targetDept)) {
      return true;
    }
  }

  // 4. Fallback to primaryDepartment or department
  const primaryDept = String(user.primaryDepartment || user.department || '').trim().toUpperCase();
  if (primaryDept === 'ALL' || primaryDept === '*' || primaryDept === targetDept) {
    return true;
  }

  return false;
}

import { storageService } from '../services/storageService';

/**
 * Returns list of accessible departments for a given user.
 * @param {Object} user
 * @param {Array<string>} [availableDepartments] - Optional list of all departments in system
 * @returns {Array<string>}
 */
export function getUserAccessibleDepartments(user, availableDepartments = null) {
  if (!user) return [];

  const depts = (availableDepartments && availableDepartments.length > 0)
    ? availableDepartments
    : (storageService.getDepartments?.()?.map(d => d.code) || ['PD', 'QC', 'WH', 'PUR', 'ENG']);

  const roleId = String(user.roleId || user.id || '').toUpperCase();
  const isAdmin = roleId === 'ADMIN' || Number(user.level) >= 99 || user.role === 'admin';
  const isApprover = roleId === 'PLANT_MANAGER' || user.positionKey === 'APPROVER' || user.canFinalApprove || Number(user.level) >= 3;
  const assigned = Array.isArray(user.assignedDepartments) ? user.assignedDepartments : [];
  const allowed = Array.isArray(user.allowedDepartments) ? user.allowedDepartments : [];
  const hasAllInAssigned = assigned.includes('ALL') || assigned.includes('*') || allowed.includes('ALL') || allowed.includes('*');

  if (isAdmin || isApprover || (user.department === 'ALL' && user.canViewAllDepts) || hasAllInAssigned) {
    return depts;
  }

  // Check assignedDepartments first (new canonical field)
  if (assigned.length > 0) {
    if (assigned.includes('*') || assigned.includes('ALL')) return depts;
    return assigned.filter(d => depts.includes(d));
  }

  // Fallback: allowedDepartments (legacy)
  if (allowed.length > 0) {
    if (allowed.includes('*') || allowed.includes('ALL')) {
      return depts;
    }
    return allowed.filter(d => depts.includes(d));
  }

  const primaryDept = user.primaryDepartment || user.department;
  if (primaryDept === 'ALL' || primaryDept === '*') {
    return depts;
  }

  return primaryDept ? [primaryDept] : [];
}
