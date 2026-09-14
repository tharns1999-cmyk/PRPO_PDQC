import { resolveUserPermissions, ROLES } from '../config/constants';

const AUTH_SESSION_KEY = 'prpo_auth_session';
const REGISTERED_USERS_KEY = 'prpo_registered_users';

// Pre-configured Employee Accounts categorized by Position for Localhost Testing
export const DEFAULT_EMPLOYEE_ACCOUNTS = [
  {
    id: 'USR-0001',
    employeeId: 'EMP-PD-001',
    username: 'wichai.pd',
    email: 'wichai@company.com',
    password: 'password123',
    pin: 'password123',
    name: 'คุณวิชัย (PD)',
    employeeName: 'คุณวิชัย สุขใจ',
    displayName: 'Wichai (PD)',
    department: 'PD',
    primaryDepartment: 'PD',
    departments: ['PD'],
    assignedDepartments: ['PD'],
    allowedDepartments: ['PD'],
    roleId: 'REQUESTER_PD',
    canonicalRole: 'REQUESTER',
    positionKey: 'REQUESTER_PD',
    title: 'Requester (PD)',
    level: 1,
    status: 'ACTIVE',
    description: 'สร้าง/ส่ง PR ฝ่ายผลิต, เบิกจ่ายสินค้า, ตรวจรับของเข้าสต็อก'
  },
  {
    id: 'USR-0002',
    employeeId: 'EMP-QC-001',
    username: 'somying.qc',
    email: 'somying@company.com',
    password: 'password123',
    pin: 'password123',
    name: 'คุณสมหญิง (QC)',
    employeeName: 'คุณสมหญิง รักดี',
    displayName: 'Somying (QC)',
    department: 'QC',
    primaryDepartment: 'QC',
    departments: ['QC'],
    assignedDepartments: ['QC'],
    allowedDepartments: ['QC'],
    roleId: 'REQUESTER_QC',
    canonicalRole: 'REQUESTER',
    positionKey: 'REQUESTER_QC',
    title: 'Requester (QC)',
    level: 1,
    status: 'ACTIVE',
    description: 'สร้าง/ส่ง PR ฝ่าย QC/Lab, เบิกจ่ายสารเคมี, ตรวจรับของ'
  },
  {
    id: 'USR-0003',
    employeeId: 'EMP-MGR-001',
    username: 'somchai.am',
    email: 'somchai.am@company.com',
    password: 'password123',
    pin: 'password123',
    name: 'คุณสมชาย (Asst. Mgr)',
    employeeName: 'คุณสมชาย มุ่งมั่น',
    displayName: 'Somchai (Asst Mgr)',
    department: 'PD',
    primaryDepartment: 'PD',
    departments: ['PD', 'QC'],
    assignedDepartments: ['PD', 'QC'],
    allowedDepartments: ['PD', 'QC'],
    roleId: 'ASST_MANAGER',
    canonicalRole: 'REVIEWER',
    positionKey: 'REVIEWER',
    title: 'Assistant Manager',
    level: 2,
    status: 'ACTIVE',
    description: 'ตรวจทาน PR (Level 1 Reviewer), ดูแลฝ่ายผลิต (PD) และฝ่ายควบคุมคุณภาพ (QC)'
  },
  {
    id: 'USR-0004',
    employeeId: 'EMP-PUR-001',
    username: 'nat.on',
    email: 'nat.on@company.com',
    password: 'password123',
    pin: 'password123',
    name: 'คุณนัท (Online Purchaser)',
    employeeName: 'คุณนัท จัดซื้อ',
    displayName: 'Nat (Online)',
    department: 'ALL',
    primaryDepartment: 'ALL',
    departments: ['ALL'],
    assignedDepartments: ['ALL'],
    allowedDepartments: ['ALL'],
    roleId: 'ONLINE_PURCHASER',
    canonicalRole: 'PURCHASER',
    positionKey: 'ONLINE_PURCHASER',
    title: 'Online Purchaser (คุณนัท)',
    level: 2,
    status: 'ACTIVE',
    description: 'จัดการสั่งซื้อออนไลน์ Shopee/Lazada, บันทึกราคาจริง'
  },
  {
    id: 'USR-0005',
    employeeId: 'EMP-MGR-002',
    username: 'prasert.pm',
    email: 'prasert.pm@company.com',
    password: 'password123',
    pin: 'password123',
    name: 'คุณประเสริฐ (Plant Mgr)',
    employeeName: 'คุณประเสริฐ ยิ่งยง',
    displayName: 'Prasert (Plant Mgr)',
    department: 'ALL',
    primaryDepartment: 'ALL',
    departments: ['ALL'],
    assignedDepartments: ['ALL'],
    allowedDepartments: ['ALL'],
    roleId: 'PLANT_MANAGER',
    canonicalRole: 'APPROVER',
    positionKey: 'APPROVER',
    title: 'Plant Manager',
    level: 3,
    status: 'ACTIVE',
    description: 'อนุมัติสั่งซื้อ (Final Approver), ออก PO อัตโนมัติ, คุมงบประมาณ'
  },
  {
    id: 'USR-0006',
    employeeId: 'EMP-SYS-999',
    username: 'admin',
    email: 'admin@company.com',
    password: 'password123',
    pin: 'password123',
    name: 'Admin System',
    employeeName: 'ผู้ดูแลระบบ',
    displayName: 'Admin System',
    department: 'ALL',
    primaryDepartment: 'ALL',
    departments: ['ALL'],
    assignedDepartments: ['ALL'],
    allowedDepartments: ['ALL'],
    roleId: 'ADMIN',
    canonicalRole: 'ADMIN',
    positionKey: 'ADMIN',
    title: 'System Administrator',
    level: 99,
    status: 'ACTIVE',
    description: 'ผู้ดูแลระบบ สิทธิ์สูงสุดในการจัดการข้อมูลทุกส่วน'
  }
];

/**
 * Check if the current environment is UAT mode
 */
export const isUATEnv = () => {
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_ENV === 'uat';
};

/**
 * Role-based access mapping for read-only permission checklist
 */
export const getRolePermissionsChecklist = (userOrRole) => {
  if (!userOrRole) return [];
  const roleStr = String(userOrRole.canonicalRole || userOrRole.roleId || userOrRole.role || userOrRole.positionKey || '').toUpperCase();
  const isAdmin = userOrRole.isAdmin === true || roleStr.includes('ADMIN') || Number(userOrRole.level) >= 99 || userOrRole.username === 'admin';
  const isApprover = isAdmin || roleStr.includes('APPROV') || roleStr.includes('PLANT_MANAGER');
  const isPurchaser = isAdmin || roleStr.includes('PURCHAS') || roleStr.includes('BUYER');
  const isRequesterOrStaff = isAdmin || roleStr.includes('REQUEST') || roleStr.includes('REVIEW') || roleStr.includes('STOCK') || roleStr.includes('PD') || roleStr.includes('QC');
  const isRequester = isAdmin || roleStr.includes('REQUEST') || roleStr.includes('PD') || roleStr.includes('QC');

  return [
    {
      key: 'PR_CREATION',
      label: 'สร้างใบขอซื้อ (PR Creation)',
      description: 'สร้าง ร่าง และส่งคำขอซื้อเข้าระบบ',
      allowed: Boolean(isAdmin || isRequester || userOrRole.canCreatePR)
    },
    {
      key: 'APPROVAL',
      label: 'ตรวจทานและอนุมัติ (Approval)',
      description: 'ตรวจทานงบประมาณและอนุมัติใบขอซื้อ',
      allowed: Boolean(isAdmin || isApprover || userOrRole.canReview || userOrRole.canFinalApprove)
    },
    {
      key: 'PURCHASING',
      label: 'จัดซื้อและสั่งซื้อออนไลน์ (Purchasing)',
      description: 'ดำเนินการสั่งซื้อ เทียบราคา และบันทึกราคาจริง',
      allowed: Boolean(isAdmin || isPurchaser || userOrRole.canOnlinePurchase)
    },
    {
      key: 'INVENTORY',
      label: 'ตรวจรับและจัดการคลัง (Inventory)',
      description: 'ตรวจรับพัสดุ (GRN) เบิกจ่าย และตัดสต็อกสินค้า',
      allowed: Boolean(isAdmin || isRequesterOrStaff || userOrRole.canReceiveGRN || userOrRole.canReceiveGoods)
    }
  ];
};

export const authService = {
  // Get all registered accounts
  getRegisteredUsers() {
    try {
      const data = localStorage.getItem(REGISTERED_USERS_KEY);
      if (!data) return DEFAULT_EMPLOYEE_ACCOUNTS;
      const parsed = JSON.parse(data);
      return parsed.map(u => {
        const def = DEFAULT_EMPLOYEE_ACCOUNTS.find(d => d.id === u.id || d.username === u.username);
        if (def && def.departments && (!u.departments || u.departments.length < def.departments.length)) {
          return {
            ...u,
            departments: def.departments,
            assignedDepartments: def.assignedDepartments || def.departments,
            allowedDepartments: def.allowedDepartments || def.departments
          };
        }
        return u;
      });
    } catch {
      return DEFAULT_EMPLOYEE_ACCOUNTS;
    }
  },

  saveRegisteredUsers(users) {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  },

  // Get active session
  getCurrentSession() {
    try {
      const data = localStorage.getItem(AUTH_SESSION_KEY);
      if (data) {
        const session = JSON.parse(data);
        const departments = (Array.isArray(session.departments) && session.departments.length > 0)
          ? session.departments
          : (session.department ? [session.department] : ['PD']);
        // Enrich with fresh role permissions dynamically based on role/level
        const rolePermissions = resolveUserPermissions({ ...session, departments });
        return {
          ...session,
          departments,
          assignedDepartments: session.assignedDepartments || departments,
          allowedDepartments: session.allowedDepartments || departments,
          ...rolePermissions,
          role: rolePermissions
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  // Authenticate user with Employee ID / Username / Email and PIN / Password
  async login(username, password, _optionalLegacyUid = null) {
    // 1. Purge any stale cached user sessions first
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem('prpo_current_user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('prpo_user');
    localStorage.removeItem('prpo_original_admin_user');

    const cleanUser = String(username || '').trim();
    const cleanPass = String(password || '').trim();

    // Authenticate against registered users / authentic personas
    const users = this.getRegisteredUsers();
    const cleanUserLower = cleanUser.toLowerCase();
    
    const matched = users.find(u => {
      const uUser = (u.username || '').toLowerCase();
      const uEmp = (u.employeeId || '').toLowerCase();
      const userMatch = uUser === cleanUserLower || uEmp === cleanUserLower ||
        (cleanUserLower === 'siraphat.pd' && uUser === 'wichai.pd') ||
        (cleanUserLower === 'natthinee.qc' && uUser === 'somying.qc') ||
        (cleanUserLower === 'kallayani.mgr' && uUser === 'somchai.am');
      const passMatch = u.password === cleanPass || u.pin === cleanPass ||
        (uUser === 'admin' && (cleanPass === 'admin123' || cleanPass === 'password123'));
      return userMatch && passMatch;
    });

    if (!matched) {
      throw new Error('ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง');
    }

    matched.lastLogin = new Date().toISOString();
    this.saveRegisteredUsers(users);

    const rolePermissions = resolveUserPermissions(matched);
    const userDepts = rolePermissions.departments || matched.departments || matched.assignedDepartments || matched.allowedDepartments || [matched.department];
    const sessionData = {
      id: matched.id,
      username: matched.username,
      employeeId: matched.employeeId,
      name: matched.name,
      employeeName: matched.name,
      displayName: matched.name,
      primaryDepartment: matched.primaryDepartment || matched.department,
      department: matched.department,
      departments: userDepts,
      assignedDepartments: matched.assignedDepartments || userDepts,
      allowedDepartments: matched.allowedDepartments || userDepts,
      roleId: matched.roleId,
      positionKey: matched.positionKey,
      title: matched.title,
      level: matched.level,
      lastLogin: matched.lastLogin,
      ...rolePermissions,
      role: rolePermissions,
      rolePermissions: rolePermissions,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };

    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));

    return sessionData;
  },

  // Instant login by Position for Localhost Testing
  async loginByPosition(positionOrUsername) {
    const users = this.getRegisteredUsers();
    const cleanKey = (positionOrUsername || '').trim().toLowerCase();

    const matched = users.find(u => 
      u.positionKey?.toLowerCase() === cleanKey ||
      u.roleId?.toLowerCase() === cleanKey ||
      u.username?.toLowerCase() === cleanKey
    );

    if (!matched) {
      throw new Error(`ไม่พบบัญชีสำหรับตำแหน่ง: ${positionOrUsername}`);
    }

    return this.login(matched.username, matched.password);
  },

  // Log out current session
  logout() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem('prpo_current_user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('prpo_user');
    localStorage.removeItem('prpo_original_admin_user');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  }
};
