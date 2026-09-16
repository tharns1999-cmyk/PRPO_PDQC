import { storageService } from '../services/storageService';

/**
 * Permission and Department Access Control Utilities
 * Supports multi-department access, wildcard (* or ALL), and backward compatibility.
 */

/**
 * Extracts all departments assigned to a user as a clean Array of uppercase strings.
 * Supports:
 * - Array: ['PD', 'QC']
 * - Comma-separated string: "PD, QC" or "PD,QC"
 * - Assigned / Allowed / Primary / Department properties
 * @param {Object} user - User object or currentRole object
 * @returns {string[]} Array of uppercase department codes
 */
export function getUserDepartments(user) {
  if (!user) return [];

  const rawDepts = [];

  const collect = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(item => collect(item));
    } else if (typeof val === 'string') {
      val.split(',').forEach(part => {
        const trimmed = part.trim();
        if (trimmed) rawDepts.push(trimmed.toUpperCase());
      });
    }
  };

  // Collect from all possible user fields
  collect(user.departments);
  collect(user.assignedDepartments);
  collect(user.allowedDepartments);
  collect(user.department);
  collect(user.primaryDepartment);

  // If user object has nested role or session properties
  if (user.role && typeof user.role === 'object') {
    collect(user.role.departments);
    collect(user.role.assignedDepartments);
    collect(user.role.allowedDepartments);
    collect(user.role.department);
  }

  // Deduplicate
  const uniqueDepts = Array.from(new Set(rawDepts));

  // If empty and user is admin or universal
  const roleId = String(user.roleId || user.role_id || user.id || '').toUpperCase();
  const isAdmin = user.role === 'admin' ||
                  roleId === 'ADMIN' ||
                  Number(user.level) >= 99 ||
                  user.isAdmin === true ||
                  user.username === 'admin';
  if (uniqueDepts.length === 0 && isAdmin) {
    return ['ALL'];
  }

  return uniqueDepts;
}

/**
 * Department Matching Helper
 * Robustly matches department codes or IDs across representations:
 * e.g. 'QC' vs 'DEPT-QC', objects { id, code, name }, case-insensitively.
 * @param {string|Object} productDept - The product's department (e.g. 'QC', 'DEPT-QC', or category)
 * @param {string|Object} targetDept - The target department to compare against (e.g. 'DEPT-QC', 'QC', or dept object)
 * @returns {boolean}
 */
export const isDepartmentMatch = (productDept, targetDept) => {
  if (!productDept || !targetDept) return false;

  const rawTargetStr = typeof targetDept === 'string' ? targetDept.trim().toUpperCase() : '';
  const rawProductStr = typeof productDept === 'string' ? productDept.trim().toUpperCase() : '';
  if (rawTargetStr === 'ALL' || rawTargetStr === '*' || rawTargetStr === 'BOTH') return true;
  if (rawProductStr === 'ALL' || rawProductStr === '*' || rawProductStr === 'BOTH') return true;

  const pDept = String(productDept?.code || productDept?.id || productDept).trim().toUpperCase();

  // กรณี targetDept เป็น String (เช่น 'QC', 'DEPT-QC')
  if (typeof targetDept === 'string') {
    const tDept = targetDept.trim().toUpperCase();
    return pDept === tDept || 
           pDept.replace(/^DEPT-/, '') === tDept.replace(/^DEPT-/, '') ||
           tDept.includes(pDept) || 
           pDept.includes(tDept);
  }

  // กรณี targetDept เป็น Object แผนก { id, code, name }
  const deptId = String(targetDept.id || '').trim().toUpperCase();
  const deptCode = String(targetDept.code || '').trim().toUpperCase();
  const deptName = String(targetDept.name || '').trim().toUpperCase();

  return pDept === deptCode || 
         pDept === deptId || 
         pDept.replace(/^DEPT-/, '') === deptId.replace(/^DEPT-/, '') ||
         (Boolean(deptName) && pDept === deptName) ||
         (Boolean(deptCode) && pDept.replace(/^DEPT-/, '') === deptCode.replace(/^DEPT-/, ''));
};

/**
 * Checks if a user can access data scoped to a target department.
 * - Returns true if user.role === 'admin' or user departments contain 'ALL' or '*'
 * - Returns true if targetDepartment is 'ALL' or 'BOTH' (central / shared data)
 * - Returns true if user has the targetDepartment in their departments array (Case-insensitive)
 * @param {Object} user - User object or currentRole
 * @param {string} targetDepartment - Department code of the data record
 * @returns {boolean}
 */
export function canAccessDepartmentData(user, targetDepartment) {
  if (!user) return false;
  if (!targetDepartment || targetDepartment === 'ALL' || targetDepartment === 'BOTH') return true;

  const userDepts = getUserDepartments(user);

  const roleId = String(user.roleId || user.role_id || user.id || '').toUpperCase();
  const isAdmin = user.role === 'admin' || 
                  roleId === 'ADMIN' || 
                  Number(user.level) >= 99 || 
                  user.isAdmin === true || 
                  user.username === 'admin' ||
                  userDepts.includes('ALL') || 
                  userDepts.includes('*') ||
                  (user.department === 'ALL' && user.canViewAllDepts);

  if (isAdmin) return true;

  const target = String(targetDepartment).trim().toUpperCase();
  return userDepts.some(d => isDepartmentMatch(d, target));
}

/**
 * Checks if a user has access to a specific department.
 * (Delegates to canonical canAccessDepartmentData)
 * @param {Object} user - The user or currentRole object
 * @param {string} departmentCode - The department code to check (e.g. 'PD', 'QC')
 * @returns {boolean}
 */
export function hasDepartmentAccess(user, departmentCode) {
  return canAccessDepartmentData(user, departmentCode);
}

/**
 * Returns list of accessible departments for a given user.
 * @param {Object} user
 * @param {Array<string>} [availableDepartments] - Optional list of all departments in system
 * @returns {Array<string>}
 */
export function getUserAccessibleDepartments(user, availableDepartments = null) {
  if (!user) return [];

  const allDepts = (availableDepartments && availableDepartments.length > 0)
    ? availableDepartments
    : (storageService.getDepartments?.()?.map(d => d.code) || ['PD', 'QC', 'WH', 'PUR', 'ENG']);

  const userDepts = getUserDepartments(user);
  const roleId = String(user.roleId || user.role_id || user.id || '').toUpperCase();
  const isAdmin = user.role === 'admin' ||
                  roleId === 'ADMIN' ||
                  Number(user.level) >= 99 ||
                  user.isAdmin === true ||
                  user.username === 'admin' ||
                  userDepts.includes('ALL') ||
                  userDepts.includes('*') ||
                  (user.department === 'ALL' && user.canViewAllDepts);

  if (isAdmin) {
    return allDepts;
  }

  const filtered = userDepts.filter(d => d !== 'ALL' && d !== '*');
  if (filtered.length > 0) {
    return filtered;
  }

  const primaryDept = user.primaryDepartment || user.department;
  if (primaryDept && primaryDept !== 'ALL' && primaryDept !== '*') {
    return [primaryDept];
  }

  return allDepts;
}
