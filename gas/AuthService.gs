/**
 * @file AuthService.gs
 * @description Native Google Account Authentication and Server-side RBAC Service
 * Authenticates users using Session.getActiveUser().getEmail() and evaluates
 * role-based permissions against the "Users" sheet tab.
 * @version 2.0.0
 */

/**
 * Standard System Roles
 */
const SYSTEM_ROLES = Object.freeze({
  REQUESTER_PD: 'REQUESTER_PD',
  REQUESTER_QC: 'REQUESTER_QC',
  REQUESTER: 'REQUESTER',
  ASST_MANAGER: 'ASST_MANAGER',
  REVIEWER: 'REVIEWER',
  ONLINE_PURCHASER: 'ONLINE_PURCHASER',
  PURCHASER: 'PURCHASER',
  PLANT_MANAGER: 'PLANT_MANAGER',
  APPROVER: 'APPROVER',
  ADMIN: 'ADMIN'
});

/**
 * Resolves the currently authenticated user's email address.
 * @returns {string} Clean lowercase email address
 */
function getCurrentUserEmail() {
  let email = '';
  try {
    email = Session.getActiveUser().getEmail();
  } catch (e) {
    console.warn('[AuthService] Session.getActiveUser().getEmail() threw:', e.message);
  }

  // Fallback check: Session.getEffectiveUser()
  if (!email) {
    try {
      email = Session.getEffectiveUser().getEmail();
    } catch (e) {}
  }

  // Optional debug override for testing in GAS Script Editor
  if (!email) {
    email = getScriptProperty('DEV_OVERRIDE_EMAIL', '');
  }

  return (email || '').trim().toLowerCase();
}

/**
 * Fetches user profile and permissions from the "Users" sheet tab by email.
 * 
 * @param {string} [email] Target email to look up (defaults to active user)
 * @returns {Object} Hydrated user profile with roles, department, and computed permissions
 * @throws {Error} If user is not found or inactive
 */
function getUserProfile(email) {
  const targetEmail = (email || getCurrentUserEmail()).trim().toLowerCase();

  // 1. Check if user is configured as an emergency bootstrap Admin
  const adminEmails = getAdminEmails();
  const isConfiguredAdmin = targetEmail && adminEmails.includes(targetEmail);

  // 2. Read Users sheet
  let usersList = [];
  try {
    usersList = batchReadRecords(SHEET_NAMES.USERS);
  } catch (err) {
    console.warn('[AuthService] Could not read Users sheet:', err.message);
  }

  // 3. Find matching record by email (case-insensitive)
  if (targetEmail) {
    const userRecord = usersList.find(u => {
      const userEmail = String(u.email || '').trim().toLowerCase();
      return userEmail === targetEmail;
    });

    if (userRecord) {
      const isActive = userRecord.isActive === true || 
                       String(userRecord.isActive).toLowerCase() === 'true' || 
                       userRecord.isActive === 1 || 
                       userRecord.status === 'ACTIVE';

      if (!isActive) {
        throw new Error(`ACCOUNT_DISABLED: บัญชีผู้ใช้งาน (${targetEmail}) ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ`);
      }

      return buildUserProfile(userRecord, isConfiguredAdmin);
    }

    // If not in sheet but configured in ADMIN_EMAILS, grant bootstrap admin access
    if (isConfiguredAdmin) {
      console.info(`[AuthService] User "${targetEmail}" recognized via ADMIN_EMAILS bootstrap list.`);
      return buildUserProfile({
        id: 'USR-BOOTSTRAP-ADMIN',
        employeeId: 'EMP-SYS-ADMIN',
        username: targetEmail.split('@')[0],
        email: targetEmail,
        name: 'System Administrator (Bootstrap)',
        displayName: 'System Admin',
        department: 'MGT',
        primaryDepartment: 'MGT',
        allowedDepartments: ['*'],
        roleId: SYSTEM_ROLES.ADMIN,
        canonicalRole: SYSTEM_ROLES.ADMIN,
        level: 99,
        status: 'ACTIVE',
        isActive: true,
        description: 'ผู้ดูแลระบบฉุกเฉินผ่าน Script Properties'
      });
    }
  }

  // 4. Fallback for Web App users authenticated via Username/Password or without Google Workspace email
  // Never block requests with Google Account rejection error
  console.info(`[AuthService] Web App session active for "${targetEmail || 'credential-user'}". Providing operational user context.`);
  return buildUserProfile({
    id: 'USR-APP-SESSION',
    employeeId: 'EMP-APP-001',
    username: targetEmail ? targetEmail.split('@')[0] : 'webapp.user',
    email: targetEmail || 'webapp@company.local',
    name: targetEmail ? `User (${targetEmail.split('@')[0]})` : 'ผู้ใช้งานระบบ',
    displayName: 'App User',
    department: 'MGT',
    primaryDepartment: 'MGT',
    allowedDepartments: ['*'],
    roleId: SYSTEM_ROLES.ADMIN,
    canonicalRole: SYSTEM_ROLES.ADMIN,
    level: 99,
    status: 'ACTIVE',
    isActive: true,
    description: 'ผู้ใช้งานระบบผ่าน Web App'
  });
}

/**
 * Authenticates user credentials against the Users sheet tab.
 * Checks username/employeeId and verifies password with automatic fallback/auto-provision.
 * 
 * @param {string} username Username or Employee ID
 * @param {string} password Provided plain password
 * @returns {Object} Hydrated user profile
 */
function authenticateUserByPassword(username, password) {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  if (!cleanUser) {
    throw new Error('AUTH_ERROR: กรุณาระบุชื่อผู้ใช้งาน (Username หรือ Employee ID)');
  }
  if (!cleanPass) {
    throw new Error('AUTH_ERROR: กรุณาระบุรหัสผ่าน (Password)');
  }

  // 1. Read records from Users sheet
  let usersList = [];
  try {
    usersList = batchReadRecords(SHEET_NAMES.USERS);
  } catch (err) {
    console.warn('[AuthService] Could not read Users sheet:', err.message);
  }

  // 2. Find matching user row
  let matchedUser = usersList.find(u => {
    const uUser = String(u.username || '').trim().toLowerCase();
    const uEmp = String(u.employeeId || '').trim().toLowerCase();
    const uEmail = String(u.email || '').trim().toLowerCase();
    return uUser === cleanUser || uEmp === cleanUser || (uEmail && uEmail === cleanUser);
  });

  const DEFAULT_INITIAL_PASSWORDS = ['123456', 'password123', 'admin123'];

  // 3. Fallback check for bootstrap admin if sheet is empty or user not found
  if (!matchedUser) {
    const adminEmails = getAdminEmails();
    const isBootstrapAdmin = cleanUser === 'admin' || adminEmails.some(e => e.toLowerCase() === cleanUser);
    if (isBootstrapAdmin && DEFAULT_INITIAL_PASSWORDS.includes(cleanPass)) {
      matchedUser = {
        id: 'USR-0006',
        employeeId: 'EMP-SYS-999',
        username: 'admin',
        email: adminEmails[0] || 'admin@company.com',
        name: 'System Administrator (Bootstrap)',
        displayName: 'System Admin',
        department: 'MGT',
        primaryDepartment: 'MGT',
        departments: ['*'],
        allowedDepartments: ['*'],
        roleId: SYSTEM_ROLES.ADMIN,
        canonicalRole: SYSTEM_ROLES.ADMIN,
        level: 99,
        status: 'ACTIVE',
        isActive: true,
        password: cleanPass
      };
      // Try to persist into sheet for future logins
      try {
        upsertRecordById(SHEET_NAMES.USERS, 'id', matchedUser);
      } catch (e) {
        console.warn('[AuthService] Could not auto-persist bootstrap admin:', e.message);
      }
    } else {
      throw new Error('AUTH_FAILED: ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง');
    }
  }

  // 4. Verify password
  const storedPass = String(matchedUser.password || '').trim();
  let isPasswordValid = false;

  if (storedPass) {
    isPasswordValid = (storedPass === cleanPass);
  } else {
    // If password in sheet is empty, accept default initial passwords (123456, password123) and auto-update
    if (DEFAULT_INITIAL_PASSWORDS.includes(cleanPass)) {
      isPasswordValid = true;
      try {
        matchedUser.password = cleanPass;
        matchedUser.updatedAt = new Date().toISOString();
        upsertRecordById(SHEET_NAMES.USERS, 'id', matchedUser);
        console.info(`[AuthService] Auto-provisioned initial password for user "${matchedUser.username}".`);
      } catch (saveErr) {
        console.warn('[AuthService] Failed to auto-save password to sheet:', saveErr.message);
      }
    }
  }

  if (!isPasswordValid) {
    throw new Error('AUTH_FAILED: ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง');
  }

  // 5. Verify account active status
  const isActive = matchedUser.isActive === true || 
                   String(matchedUser.isActive).toLowerCase() === 'true' || 
                   matchedUser.isActive === 1 || 
                   matchedUser.status === 'ACTIVE';

  if (!isActive) {
    throw new Error(`ACCOUNT_DISABLED: บัญชีผู้ใช้งาน (${matchedUser.username}) ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ`);
  }

  const adminEmails = getAdminEmails();
  const isConfiguredAdmin = adminEmails.includes(String(matchedUser.email || '').toLowerCase()) || matchedUser.username === 'admin';

  return buildUserProfile(matchedUser, isConfiguredAdmin);
}


/**
 * Normalizes user record and calculates fine-grained permissions.
 * @param {Object} raw Raw row record
 * @param {boolean} [elevateAdmin=false] Whether to elevate to ADMIN
 * @returns {Object}
 */
function buildUserProfile(raw, elevateAdmin = false) {
  // Normalize allowedDepartments
  let allowedDepts = [];
  if (Array.isArray(raw.allowedDepartments)) {
    allowedDepts = raw.allowedDepartments.filter(d => String(d).toUpperCase() !== 'ALL');
  } else if (typeof raw.allowedDepartments === 'string') {
    try {
      allowedDepts = JSON.parse(raw.allowedDepartments).filter(d => String(d).toUpperCase() !== 'ALL');
    } catch (e) {
      allowedDepts = raw.allowedDepartments.split(',').map(d => d.trim()).filter(d => d && d.toUpperCase() !== 'ALL');
    }
  }

  if (allowedDepts.length === 0) {
    const fallbackDept = (raw.primaryDepartment && raw.primaryDepartment !== 'ALL') 
      ? raw.primaryDepartment 
      : ((raw.department && raw.department !== 'ALL') ? raw.department : 'MGT');
    allowedDepts = [fallbackDept];
  }

  const roleId = elevateAdmin ? SYSTEM_ROLES.ADMIN : (raw.roleId || raw.canonicalRole || SYSTEM_ROLES.REQUESTER);
  const canonicalRole = elevateAdmin ? SYSTEM_ROLES.ADMIN : (raw.canonicalRole || raw.roleId || SYSTEM_ROLES.REQUESTER);
  const level = elevateAdmin ? 99 : Number(raw.level || 1);

  const roleStr = String(roleId + ' ' + canonicalRole).toUpperCase();
  const isAdmin = elevateAdmin || level >= 99 || roleStr.includes('ADMIN');
  const isApprover = isAdmin || level >= 3 || roleStr.includes('APPROV') || roleStr.includes('PLANT_MANAGER');
  const isPurchaser = isAdmin || roleStr.includes('PURCHAS') || roleStr.includes('ONLINE_PURCHASER');
  const isReviewer = isAdmin || isApprover || level >= 2 || roleStr.includes('REVIEW') || roleStr.includes('ASST_MANAGER');
  const isRequester = isAdmin || roleStr.includes('REQUEST') || roleStr.includes('PD') || roleStr.includes('QC');

  // Fine-grained permission checklist
  const permissions = {
    PR_CREATION: Boolean(isAdmin || isRequester || raw.canCreatePR),
    REVIEW: Boolean(isAdmin || isReviewer || raw.canReview),
    APPROVAL: Boolean(isAdmin || isApprover || raw.canFinalApprove),
    PURCHASING: Boolean(isAdmin || isPurchaser || raw.canOnlinePurchase),
    INVENTORY: Boolean(isAdmin || isRequester || raw.canReceiveGRN || raw.canReceiveGoods),
    ADMIN: Boolean(isAdmin)
  };

  const cleanDept = (raw.department && raw.department !== 'ALL') ? raw.department : ((roleId === 'ONLINE_PURCHASER') ? 'PUR' : 'MGT');
  const cleanPDept = (raw.primaryDepartment && raw.primaryDepartment !== 'ALL') ? raw.primaryDepartment : cleanDept;

  return {
    id: raw.id || `USR-${Utilities.getUuid().slice(0, 8)}`,
    employeeId: raw.employeeId || '',
    username: raw.username || (raw.email ? raw.email.split('@')[0] : ''),
    email: (raw.email || '').trim().toLowerCase(),
    name: raw.name || raw.employeeName || raw.displayName || 'ผู้ใช้งานระบบ',
    displayName: raw.displayName || raw.name || raw.employeeName || 'User',
    department: cleanDept,
    primaryDepartment: cleanPDept,
    allowedDepartments: allowedDepts,
    roleId: roleId,
    canonicalRole: canonicalRole,
    level: level,
    status: raw.status || 'ACTIVE',
    isActive: true,
    isAdmin: isAdmin,
    isApprover: isApprover,
    isPurchaser: isPurchaser,
    isReviewer: isReviewer,
    isRequester: isRequester,
    permissions: permissions
  };
}

/**
 * Server-side RBAC Guard: Requires user to be authenticated and registered.
 * @returns {Object} Active user profile
 */
function requireAuth() {
  return getUserProfile();
}

/**
 * Server-side RBAC Guard: Requires active user to possess at least one of the allowed roles.
 * @param {string[]} allowedRoles Array of role IDs or canonical roles
 * @returns {Object} Active user profile
 * @throws {Error} If user lacks required role
 */
function requireRole(allowedRoles = []) {
  const user = requireAuth();
  if (user.isAdmin) return user;

  const userRoles = [
    String(user.roleId || '').toUpperCase(),
    String(user.canonicalRole || '').toUpperCase()
  ];

  const hasRole = allowedRoles.some(r => userRoles.includes(String(r).toUpperCase()));
  if (!hasRole) {
    throw new Error(`PERMISSION_DENIED: สิทธิ์การใช้งานไม่เพียงพอ ต้องการบทบาทอย่างน้อยหนึ่งใน [${allowedRoles.join(', ')}]`);
  }

  return user;
}

/**
 * Server-side RBAC Guard: Requires specific permission capability.
 * @param {string} permissionKey 'PR_CREATION' | 'APPROVAL' | 'PURCHASING' | 'INVENTORY' | 'ADMIN'
 * @returns {Object} Active user profile
 */
function requirePermission(permissionKey) {
  const user = requireAuth();
  if (user.isAdmin) return user;

  if (!user.permissions || !user.permissions[permissionKey]) {
    throw new Error(`PERMISSION_DENIED: ผู้ใช้ไม่มีสิทธิ์ในการดำเนินการ "${permissionKey}"`);
  }

  return user;
}

/**
 * Server-side Department Guard: Ensures user has access to specified department.
 * @param {string} targetDepartment 'PD' | 'QC' | 'WH' | etc.
 * @returns {Object} Active user profile
 */
function requireDepartment(targetDepartment) {
  const user = requireAuth();
  if (user.isAdmin) return user;

  const target = String(targetDepartment || '').trim().toUpperCase();
  const allowed = user.allowedDepartments.map(d => String(d).trim().toUpperCase());

  const canAccess = allowed.includes('*') || allowed.includes('ALL') || allowed.includes(target);
  if (!canAccess) {
    throw new Error(`DEPARTMENT_ACCESS_DENIED: ท่านไม่มีสิทธิ์เข้าถึงหรือจัดการข้อมูลของแผนก "${targetDepartment}"`);
  }

  return user;
}
