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

  // 1. Admin or full-access role has universal access
  const isAdmin = user.id === 'ADMIN' || user.roleId === 'ADMIN' || Number(user.level) >= 99;
  if (isAdmin || user.canViewAllDepts) {
    return true;
  }

  // 2. Check allowedDepartments array
  const allowed = user.allowedDepartments;
  if (Array.isArray(allowed) && allowed.length > 0) {
    const upperAllowed = allowed.map(d => String(d).trim().toUpperCase());
    if (upperAllowed.includes('*') || upperAllowed.includes('ALL')) {
      return true;
    }
    if (upperAllowed.includes(targetDept)) {
      return true;
    }
  }

  // 3. Fallback to primaryDepartment or department
  const primaryDept = String(user.primaryDepartment || user.department || '').trim().toUpperCase();
  if (primaryDept === 'ALL' || primaryDept === '*' || primaryDept === targetDept) {
    return true;
  }

  return false;
}

/**
 * Returns list of accessible departments for a given user.
 * @param {Object} user
 * @param {Array<string>} availableDepartments - Optional list of all departments in system
 * @returns {Array<string>}
 */
export function getUserAccessibleDepartments(user, availableDepartments = ['PD', 'QC']) {
  if (!user) return [];

  const isAdmin = user.id === 'ADMIN' || user.roleId === 'ADMIN' || Number(user.level) >= 99;
  if (isAdmin || user.canViewAllDepts) {
    return availableDepartments;
  }

  const allowed = user.allowedDepartments;
  if (Array.isArray(allowed) && allowed.length > 0) {
    if (allowed.includes('*') || allowed.includes('ALL')) {
      return availableDepartments;
    }
    return allowed;
  }

  const primaryDept = user.primaryDepartment || user.department;
  if (primaryDept === 'ALL' || primaryDept === '*') {
    return availableDepartments;
  }

  return primaryDept ? [primaryDept] : [];
}
