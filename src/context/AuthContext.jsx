/**
 * Global Authentication & Role-Based Access Control (RBAC) Subsystem
 * 
 * Provides centralized session management, canonical role normalization,
 * permission guards, and GAS backend authentication.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { callGAS, MOCK_GAS_USERS } from '../services/gasClient.js';
import { storageService } from '../services/storageService.js';

export const AUTH_STORAGE_KEY = 'prpo_auth_session';
export const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 Hours

export const CANONICAL_ROLES = {
  REQUESTER: 'REQUESTER',
  PURCHASER: 'PURCHASER',
  REVIEWER: 'REVIEWER',
  WAREHOUSE: 'WAREHOUSE',
  APPROVER: 'APPROVER',
  ADMIN: 'ADMIN'
};

export const PERMISSIONS = {
  PR_CREATE: ['REQUESTER', 'ADMIN'],
  PR_APPROVE: ['APPROVER', 'ADMIN'],
  ONLINE_PROCURE: ['PURCHASER', 'ADMIN'],
  CLAIM_RESOLVE: ['PURCHASER', 'ADMIN'],
  GRN_RECEIVE: ['WAREHOUSE', 'REQUESTER', 'ADMIN'],
  BUDGET_MANAGE: ['APPROVER', 'ADMIN'],
  SYSTEM_ADMIN: ['ADMIN']
};

/**
 * Normalizes any legacy or custom role into one of the canonical roles
 */
export const normalizeRole = (roleOrUser) => {
  if (!roleOrUser) return CANONICAL_ROLES.REQUESTER;

  const rawRole = typeof roleOrUser === 'string'
    ? roleOrUser
    : (roleOrUser.canonicalRole || roleOrUser.roleId || roleOrUser.role || roleOrUser.positionKey || '');

  const val = String(rawRole).toUpperCase().trim();
  if (val.includes('ADMIN') || val.includes('SYS')) return CANONICAL_ROLES.ADMIN;
  if (val.includes('PURCHAS') || val.includes('BUYER') || val.includes('ONLINE')) return CANONICAL_ROLES.PURCHASER;
  if (val.includes('WAREHOUSE') || val.includes('STOCK') || val.includes('INVENTORY') || val.includes('WH')) return CANONICAL_ROLES.WAREHOUSE;
  if (val.includes('REVIEW')) return CANONICAL_ROLES.REVIEWER;
  if (val.includes('APPROV') || val.includes('MANAGER') || val.includes('MGR')) return CANONICAL_ROLES.APPROVER;
  if (val.includes('REQUEST') || val.includes('USER') || val.includes('PD') || val.includes('QC')) return CANONICAL_ROLES.REQUESTER;

  return CANONICAL_ROLES.REQUESTER;
};

/**
 * Validates whether an existing stored session is still valid
 */
export const isSessionValid = (session) => {
  if (!session) return false;
  if (!session.id && !session.canonicalRole && !session.roleId && !session.employeeId && !session.username) return false;
  if (!session.expiresAt) return true; // Legacy session format without expiresAt
  return Date.now() < Number(session.expiresAt);
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      if (typeof localStorage === 'undefined') return null;
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (!isSessionValid(parsed)) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      return {
        id: parsed.id || ('SESSION-' + (parsed.canonicalRole || 'USER')),
        ...parsed,
        canonicalRole: normalizeRole(parsed)
      };
    } catch {
      return null;
    }
  });

  const [originalUser, setOriginalUser] = useState(() => {
    try {
      if (typeof localStorage === 'undefined') return null;
      const stored = localStorage.getItem('prpo_original_admin_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Determine if current user or original user is Administrator
  const isAdmin = useMemo(() => {
    const userToCheck = originalUser || currentUser;
    if (!userToCheck) return false;
    const roleStr = String(userToCheck.canonicalRole || userToCheck.roleId || userToCheck.role || userToCheck.positionKey || '').toUpperCase();
    return userToCheck.isAdmin === true || 
      roleStr.includes('ADMIN') || 
      Number(userToCheck.level) >= 99 || 
      userToCheck.username === 'admin';
  }, [currentUser, originalUser]);

  const isSimulating = Boolean(originalUser && originalUser.id !== currentUser?.id);

  // Synchronize canonical role and department info
  const canonicalRole = useMemo(() => {
    return normalizeRole(currentUser);
  }, [currentUser]);

  const currentRole = useMemo(() => {
    return currentUser ? { ...currentUser, canonicalRole } : null;
  }, [currentUser, canonicalRole]);

  const department = useMemo(() => {
    return currentUser?.department || 'PD';
  }, [currentUser]);

  const isAuthenticated = Boolean(currentUser && isSessionValid(currentUser));

  /**
   * Clear active session and reset credentials
   */
  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('prpo_current_user');
      localStorage.removeItem('prpo_auth_session');
      localStorage.removeItem('prpo_original_admin_user');
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    } catch (e) {
      console.warn('[AuthContext] Error clearing session:', e);
    }
    setCurrentUser(null);
    setOriginalUser(null);
    setAuthError(null);
  }, []);

  // Periodic expiration verification
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      if (currentUser.expiresAt && Date.now() > currentUser.expiresAt) {
        logout();
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [currentUser, logout]);

  /**
   * Helper Guard: Check if current user has the specified canonical role
   */
  const hasRole = useCallback((role) => {
    if (!isAuthenticated) return false;
    if (canonicalRole === CANONICAL_ROLES.ADMIN) return true; // Admin has super-role
    const target = Array.isArray(role) ? role : [role];
    return target.map(r => String(r).toUpperCase()).includes(canonicalRole);
  }, [isAuthenticated, canonicalRole]);

  /**
   * Helper Guard: Check if current user possesses permission
   */
  const canAccess = useCallback((permissionKey) => {
    if (!isAuthenticated) return false;
    if (canonicalRole === CANONICAL_ROLES.ADMIN) return true; // Admin always permitted
    if (canonicalRole === CANONICAL_ROLES.REVIEWER) {
      if (permissionKey === 'PR_REVIEW' || permissionKey === 'PR_APPROVE' || permissionKey === 'BUDGET_MANAGE') {
        return true;
      }
    }
    const allowedRoles = PERMISSIONS[permissionKey];
    if (!allowedRoles) return false;
    return allowedRoles.includes(canonicalRole);
  }, [isAuthenticated, canonicalRole]);

  /**
   * Helper Guard: Department scoping rule
   * - ADMIN, PURCHASER, WAREHOUSE, APPROVER can access all departments
   * - REVIEWER is scoped to their assigned departments (e.g. 'PD, QC')
   * - REQUESTER is strictly scoped to their own department (e.g. 'PD' or 'QC')
   */
  const canAccessDepartment = useCallback((deptToCheck) => {
    if (!isAuthenticated) return false;
    if (canonicalRole === CANONICAL_ROLES.ADMIN ||
        canonicalRole === CANONICAL_ROLES.PURCHASER ||
        canonicalRole === CANONICAL_ROLES.WAREHOUSE ||
        canonicalRole === CANONICAL_ROLES.APPROVER) {
      return true;
    }

    if (!deptToCheck || deptToCheck === 'ALL') return true;

    const userDept = currentUser?.department || '';
    const userDepts = currentUser?.departments || (
      userDept.includes(',') ? userDept.split(',').map(d => d.trim()) : [userDept]
    );

    return userDept === deptToCheck || userDepts.includes(deptToCheck);
  }, [isAuthenticated, canonicalRole, currentUser]);

  /**
   * Authenticate user with Identifier (Employee ID / Email) and PIN
   */
  const login = useCallback(async (identifier, pin) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const response = await callGAS('apiLogin', identifier, pin);
      if (!response || !response.success || !response.user) {
        throw new Error(response?.error || 'รหัสพนักงานหรือรหัส PIN ไม่ถูกต้อง');
      }

      const verifiedUser = response.user;
      const normalized = normalizeRole(verifiedUser);
      const sessionPayload = {
        ...verifiedUser,
        canonicalRole: normalized,
        expiresAt: Date.now() + SESSION_EXPIRATION_MS
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionPayload));
      storageService.setCurrentRole?.(sessionPayload);
      setCurrentUser(sessionPayload);
      setIsLoading(false);
      return sessionPayload;
    } catch (err) {
      const msg = err?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      setAuthError(msg);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * Fast Switcher for Development, UAT, and Admin Testing
   */
  const switchRoleDev = useCallback((roleOrUser) => {
    let target = null;
    if (typeof roleOrUser === 'string') {
      const targetCanonical = normalizeRole(roleOrUser);
      target = MOCK_GAS_USERS.find(u => u.canonicalRole === targetCanonical) || MOCK_GAS_USERS[0];
    } else if (roleOrUser && typeof roleOrUser === 'object') {
      target = roleOrUser;
    }

    if (!target) return;

    // If simulating for the first time, save the original user session
    if (!originalUser && currentUser) {
      setOriginalUser(currentUser);
      try {
        localStorage.setItem('prpo_original_admin_user', JSON.stringify(currentUser));
      } catch (e) {
        console.warn('[AuthContext] Error storing original admin user:', e);
      }
    }

    const normalized = normalizeRole(target);
    const sessionPayload = {
      ...target,
      canonicalRole: normalized,
      expiresAt: Date.now() + SESSION_EXPIRATION_MS
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionPayload));
    storageService.setCurrentRole?.(sessionPayload);
    setCurrentUser(sessionPayload);
    return sessionPayload;
  }, [currentUser, originalUser]);

  /**
   * Revert simulation back to the primary authenticated admin user
   */
  const revertSimulation = useCallback(() => {
    if (!originalUser) return null;
    const restoredUser = {
      ...originalUser,
      canonicalRole: normalizeRole(originalUser),
      expiresAt: Date.now() + SESSION_EXPIRATION_MS
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(restoredUser));
    localStorage.removeItem('prpo_original_admin_user');
    storageService.setCurrentRole?.(restoredUser);
    setCurrentUser(restoredUser);
    setOriginalUser(null);
    return restoredUser;
  }, [originalUser]);

  const value = useMemo(() => ({
    currentUser,
    currentRole,
    canonicalRole,
    department,
    isAuthenticated,
    isLoading,
    authError,
    isAdmin,
    isSimulating,
    originalUser,
    login,
    logout,
    switchRoleDev,
    revertSimulation,
    hasRole,
    canAccess,
    canAccessDepartment
  }), [
    currentUser,
    currentRole,
    canonicalRole,
    department,
    isAuthenticated,
    isLoading,
    authError,
    isAdmin,
    isSimulating,
    originalUser,
    login,
    logout,
    switchRoleDev,
    revertSimulation,
    hasRole,
    canAccess,
    canAccessDepartment
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      currentUser: null,
      currentRole: null,
      canonicalRole: 'REQUESTER',
      department: 'PD',
      isAuthenticated: false,
      isLoading: false,
      authError: null,
      isAdmin: false,
      isSimulating: false,
      originalUser: null,
      login: async () => ({}),
      logout: () => {},
      switchRoleDev: () => ({}),
      revertSimulation: () => ({}),
      hasRole: () => false,
      canAccess: () => false,
      canAccessDepartment: () => false
    };
  }
  return context;
};

export default AuthContext;
