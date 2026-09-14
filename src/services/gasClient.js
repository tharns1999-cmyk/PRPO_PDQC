/**
 * Google Apps Script (GAS) Asynchronous Client Bridge
 * 
 * Provides a resilient, Promise-wrapped communication layer between the React SPA
 * and `google.script.run`. Includes automatic timeout handling and local development
 * mock fallbacks so the application runs seamlessly in Vite localhost without GAS.
 */

import { storageService } from './storageService.js';

const GAS_TIMEOUT_MS = 15000;

/**
 * Checks whether the execution environment is running inside Google Apps Script Web App.
 */
export const isGASAvailable = () => {
  return typeof google !== 'undefined' && 
         typeof google.script !== 'undefined' && 
         typeof google.script.run !== 'undefined';
};

/**
 * Enhanced mock employee accounts with canonical roles and security PINs for local simulation
 */
export const MOCK_GAS_USERS = [
  {
    id: 'USR-0001',
    employeeId: 'EMP-PD-001',
    username: 'siraphat.pd',
    password: 'password123',
    name: 'สิรภัทร แจ่มมิน',
    employeeName: 'สิรภัทร แจ่มมิน',
    displayName: 'สิรภัทร แจ่มมิน',
    department: 'PD',
    departments: ['PD'],
    canonicalRole: 'REQUESTER',
    roleId: 'REQUESTER_PD',
    title: 'Requester (PD)',
    level: 1,
    status: 'ACTIVE',
    isActive: true,
    description: 'สร้าง/ส่ง PR ฝ่ายผลิต, เบิกจ่ายสินค้า, ตรวจรับของเฉพาะแผนก PD'
  },
  {
    id: 'USR-0002',
    employeeId: 'EMP-QC-001',
    username: 'natthinee.qc',
    password: 'password123',
    name: 'ณัฐธินีย์ สอนครบบุรี',
    employeeName: 'ณัฐธินีย์ สอนครบบุรี',
    displayName: 'ณัฐธินีย์ สอนครบบุรี',
    department: 'QC',
    departments: ['QC'],
    canonicalRole: 'REQUESTER',
    roleId: 'REQUESTER_QC',
    title: 'Requester (QC)',
    level: 1,
    status: 'ACTIVE',
    isActive: true,
    description: 'สร้าง/ส่ง PR ฝ่าย QC/Lab, ตรวจรับของเฉพาะแผนก QC'
  },
  {
    id: 'USR-0003',
    employeeId: 'EMP-MGR-001',
    username: 'kallayani.mgr',
    password: 'password123',
    name: 'กัลยาณี',
    employeeName: 'กัลยาณี',
    displayName: 'กัลยาณี',
    department: 'PD, QC',
    departments: ['PD', 'QC'],
    canonicalRole: 'REVIEWER',
    roleId: 'ASST_MANAGER',
    title: 'Assistant Manager',
    level: 2,
    status: 'ACTIVE',
    isActive: true,
    description: 'ตรวจทาน PR (Reviewer Level 1) แผนก PD และ QC, ตรวจสอบงบประมาณ'
  },
  {
    id: 'USR-0004',
    employeeId: 'EMP-PUR-001',
    username: 'nat.on',
    password: 'password123',
    name: 'คุณนัท จัดซื้อ',
    employeeName: 'คุณนัท จัดซื้อ',
    displayName: 'คุณนัท จัดซื้อ',
    department: 'ALL',
    departments: ['PD', 'QC'],
    canonicalRole: 'PURCHASER',
    roleId: 'ONLINE_PURCHASER',
    title: 'Online Purchaser',
    level: 2,
    status: 'ACTIVE',
    isActive: true,
    description: 'ศูนย์จัดการคำสั่งซื้อออนไลน์ Shopee/Lazada, บันทึกราคาจริง, เคลมร้านค้า'
  },
  {
    id: 'USR-0005',
    employeeId: 'EMP-MGR-002',
    username: 'prasert.pm',
    password: 'password123',
    name: 'คุณประเสริฐ ยิ่งยง',
    employeeName: 'คุณประเสริฐ ยิ่งยง',
    displayName: 'คุณประเสริฐ ยิ่งยง',
    department: 'ALL',
    departments: ['PD', 'QC'],
    canonicalRole: 'APPROVER',
    roleId: 'PLANT_MANAGER',
    title: 'Plant Manager',
    level: 3,
    status: 'ACTIVE',
    isActive: true,
    description: 'อนุมัติสั่งซื้อ (Final Approver), ตรวจสอบงบประมาณทุกแผนก'
  },
  {
    id: 'USR-0006',
    employeeId: 'EMP-SYS-999',
    username: 'admin',
    password: 'password123',
    name: 'ผู้ดูแลระบบ',
    employeeName: 'ผู้ดูแลระบบ',
    displayName: 'ผู้ดูแลระบบ',
    department: 'ALL',
    departments: ['PD', 'QC'],
    canonicalRole: 'ADMIN',
    roleId: 'ADMIN',
    title: 'System Administrator',
    level: 99,
    status: 'ACTIVE',
    isActive: true,
    description: 'ผู้ดูแลระบบ สิทธิ์สูงสุดในการจัดการข้อมูลทุกส่วน'
  }
];

/**
 * Local simulation router executing server-side logic when on localhost
 */
const mockGASRouter = async (functionName, args = []) => {
  switch (functionName) {
    case 'apiLogin': {
      const [identifier, pin] = args;
      const cleanId = String(identifier || '').trim().toLowerCase();
      const cleanPin = String(pin || '').trim();

      let dynamicUsers = [];
      try {
        if (typeof localStorage !== 'undefined') {
          const cached = localStorage.getItem('prpo_users_cache') || localStorage.getItem('prpo_registered_users');
          if (cached) dynamicUsers = JSON.parse(cached);
        }
      } catch (e) {}

      const registered = storageService.getUsers?.() || [];
      const userPool = [...MOCK_GAS_USERS, ...dynamicUsers, ...registered];

      const user = userPool.find(u => 
        (String(u.username || '').toLowerCase() === cleanId || 
         String(u.employeeId || '').toLowerCase() === cleanId) &&
        (String(u.password || '') === cleanPin || String(u.pin || '') === cleanPin || cleanPin === 'password123')
      );

      if (!user) {
        throw new Error('Username หรือ Password ไม่ถูกต้อง');
      }

      if (user.status === 'INACTIVE' || user.isActive === false) {
        throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      }

      let canonicalRole = user.canonicalRole;
      if (!canonicalRole) {
        const rawRole = String(user.roleId || user.role || user.positionKey || '').toUpperCase();
        if (rawRole.includes('ADMIN')) canonicalRole = 'ADMIN';
        else if (rawRole.includes('PURCHAS')) canonicalRole = 'PURCHASER';
        else if (rawRole.includes('REVIEW') || rawRole.includes('ASST')) canonicalRole = 'REVIEWER';
        else if (rawRole.includes('APPROV') || rawRole.includes('PLANT_MANAGER') || rawRole.includes('MGR')) canonicalRole = 'APPROVER';
        else canonicalRole = 'REQUESTER';
      }

      // Return sanitized user (strip PIN/password)
      const { pin: _p, password: _pw, ...sanitized } = user;
      return {
        success: true,
        user: {
          ...sanitized,
          canonicalRole,
          lastLoginAt: new Date().toISOString()
        }
      };
    }

    case 'apiGetUsers': {
      const registered = storageService.getUsers?.() || [];
      const userPool = registered.length > 0 ? registered : MOCK_GAS_USERS;
      return {
        success: true,
        users: userPool.map(({ password: _pw, ...u }) => ({
          ...u,
          pin: u.pin || '1234'
        }))
      };
    }

    case 'apiGetDepartments': {
      const depts = storageService.getDepartments?.() || [
        { id: 'PD', code: 'PD', name: 'ฝ่ายผลิต (Production Department)' },
        { id: 'QC', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ (Quality Control)' }
      ];
      return { success: true, departments: depts };
    }

    case 'apiUploadFile': {
      const [payload = {}] = args;
      const { 
        fileName = 'evidence.jpg', 
        category = 'GENERAL', 
        poNumber = '', 
        mimeType = 'image/jpeg',
        folderPath: customFolderPath 
      } = payload;
      const fileId = `DRIVE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
      const dateKey = new Date().toISOString().slice(0, 7);

      const catStr = String(category).toUpperCase();
      let folderCategory = '01_PR_Attachments';
      if (catStr.includes('02') || catStr.includes('PO')) folderCategory = '02_PO_Documents';
      else if (catStr.includes('03') || catStr.includes('GRN') || catStr.includes('RECEIV')) folderCategory = '03_GRN_Evidence';
      else if (catStr.includes('04') || catStr.includes('CLAIM') || catStr.includes('DISPUTE')) folderCategory = '04_Claim_Evidence';

      const cleanPo = String(poNumber || '').trim();
      const resolvedPath = customFolderPath || (
        cleanPo && (folderCategory === '03_GRN_Evidence' || folderCategory === '04_Claim_Evidence')
          ? `[ERP] PR-PO-Stock-System/${folderCategory}/${dateKey}/${cleanPo}`
          : `[ERP] PR-PO-Stock-System/${folderCategory}/${dateKey}`
      );

      return {
        success: true,
        fileId,
        fileUrl,
        fileName,
        mimeType,
        folderPath: resolvedPath,
        uploadedAt: new Date().toISOString()
      };
    }

    case 'apiClearTransactionalData':
    case 'apiWipeAllGASData':
    case 'apiClearAllCache': {
      // In local dev, clear sessionStorage & localStorage cache keys
      const CACHE_STORAGE_KEYS = [
        'prpo_products', 'prpo_vendors', 'prpo_storage_locations', 'prpo_usage_units',
        'prpo_departments', 'prpo_users', 'prpo_budgets', 'prpo_signatures',
        'prpo_prs', 'prpo_pos', 'prpo_stock_logs', 'prpo_budget_transactions',
        'prpo_audit_logs', 'prpo_notifications', 'prpo_in_app_notifications'
      ];
      try {
        if (typeof sessionStorage !== 'undefined') {
          CACHE_STORAGE_KEYS.forEach(k => sessionStorage.removeItem(k));
        }
        if (typeof localStorage !== 'undefined') {
          CACHE_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
        }
      } catch(e) {}
      return { success: true, message: 'Local dev wiped and cache cleared' };
    }

    default:
      console.warn(`[Mock GAS] Unhandled function: ${functionName}`);
      return { success: true, message: `Mock execution of ${functionName}` };
  }
};

/**
 * Universal Promise-based GAS Invocation Bridge
 * 
 * @param {string} functionName Name of Google Apps Script function in Code.gs
 * @param  {...any} args Arguments passed to the GAS function
 * @returns {Promise<any>} Resolves with the return value from GAS or Mock router
 */
export const callGAS = (functionName, ...args) => {
  return new Promise((resolve, reject) => {
    // If running in live Google Apps Script web app
    if (isGASAvailable()) {
      const timer = setTimeout(() => {
        reject(new Error(`การเชื่อมต่อ Google Apps Script หมดเวลา (${GAS_TIMEOUT_MS / 1000}s): ${functionName}`));
      }, GAS_TIMEOUT_MS);

      try {
        google.script.run
          .withSuccessHandler((result) => {
            clearTimeout(timer);
            resolve(result);
          })
          .withFailureHandler((error) => {
            clearTimeout(timer);
            const errObj = typeof error === 'string' ? new Error(error) : error;
            reject(errObj);
          })[functionName](...args);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    } else {
      // Local development mock fallback
      mockGASRouter(functionName, args)
        .then(resolve)
        .catch(reject);
    }
  });
};

export default {
  callGAS,
  isGASAvailable,
  MOCK_GAS_USERS
};
