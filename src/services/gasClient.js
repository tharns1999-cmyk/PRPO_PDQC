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
    email: 'wichai@company.com',
    username: 'wichai.pd',
    pin: '1234',
    name: 'คุณวิชัย สุขใจ (PD)',
    displayName: 'Wichai (PD)',
    department: 'PD',
    departments: ['PD'],
    canonicalRole: 'REQUESTER',
    roleId: 'REQUESTER_PD',
    title: 'Requester (PD)',
    level: 1,
    status: 'ACTIVE',
    isActive: true,
    pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    description: 'สร้าง/ส่ง PR ฝ่ายผลิต, เบิกจ่ายสินค้า, ตรวจรับของเฉพาะแผนก PD'
  },
  {
    id: 'USR-0002',
    employeeId: 'EMP-QC-001',
    email: 'somying@company.com',
    username: 'somying.qc',
    pin: '1234',
    name: 'คุณสมหญิง รักดี (QC)',
    displayName: 'Somying (QC)',
    department: 'QC',
    departments: ['QC'],
    canonicalRole: 'REQUESTER',
    roleId: 'REQUESTER_QC',
    title: 'Requester (QC)',
    level: 1,
    status: 'ACTIVE',
    isActive: true,
    pictureUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    description: 'สร้าง/ส่ง PR ฝ่าย QC/Lab, ตรวจรับของเฉพาะแผนก QC'
  },
  {
    id: 'USR-0003',
    employeeId: 'EMP-MGR-001',
    email: 'somchai@company.com',
    username: 'somchai.mgr',
    pin: '1234',
    name: 'คุณสมชาย (Asst. Mgr)',
    displayName: 'Somchai (Asst. Mgr)',
    department: 'PD, QC',
    departments: ['PD', 'QC'],
    canonicalRole: 'REVIEWER',
    roleId: 'ASST_MANAGER',
    title: 'Assistant Manager',
    level: 2,
    status: 'ACTIVE',
    isActive: true,
    pictureUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    description: 'ตรวจทาน PR (Reviewer Level 1) แผนก PD และ QC, ตรวจสอบงบประมาณ'
  },
  {
    id: 'USR-0004',
    employeeId: 'EMP-PUR-001',
    email: 'nat@company.com',
    username: 'nat.on',
    pin: '1234',
    name: 'คุณนัท จัดซื้อ (Purchaser)',
    displayName: 'Nat (Online)',
    department: 'ALL',
    departments: ['PD', 'QC'],
    canonicalRole: 'PURCHASER',
    roleId: 'ONLINE_PURCHASER',
    title: 'Online Purchaser',
    level: 2,
    status: 'ACTIVE',
    isActive: true,
    pictureUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    description: 'ศูนย์จัดการคำสั่งซื้อออนไลน์ Shopee/Lazada, บันทึกราคาจริง, เคลมร้านค้า'
  },
  {
    id: 'USR-0005',
    employeeId: 'EMP-MGR-002',
    email: 'prasert@company.com',
    username: 'prasert.pm',
    pin: '1234',
    name: 'คุณประเสริฐ ยิ่งยง (Plant Manager)',
    displayName: 'Prasert (Plant Mgr)',
    department: 'ALL',
    departments: ['PD', 'QC'],
    canonicalRole: 'APPROVER',
    roleId: 'PLANT_MANAGER',
    title: 'Plant Manager',
    level: 3,
    status: 'ACTIVE',
    isActive: true,
    pictureUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    description: 'อนุมัติสั่งซื้อ (Final Approver), ตรวจสอบงบประมาณทุกแผนก'
  },
  {
    id: 'USR-0006',
    employeeId: 'EMP-SYS-999',
    email: 'admin@company.com',
    username: 'admin',
    pin: '9999',
    name: 'ผู้ดูแลระบบ (System Admin)',
    displayName: 'Admin System',
    department: 'ALL',
    departments: ['PD', 'QC'],
    canonicalRole: 'ADMIN',
    roleId: 'ADMIN',
    title: 'System Administrator',
    level: 99,
    status: 'ACTIVE',
    isActive: true,
    pictureUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
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
        (String(u.employeeId || '').toLowerCase() === cleanId || 
         String(u.email || '').toLowerCase() === cleanId || 
         String(u.username || '').toLowerCase() === cleanId) &&
        (String(u.pin || '1234') === cleanPin || String(u.password || '') === cleanPin)
      );

      if (!user) {
        throw new Error('รหัสพนักงาน/อีเมล หรือรหัส PIN ไม่ถูกต้อง');
      }

      if (user.status === 'INACTIVE' || user.isActive === false) {
        throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      }

      let canonicalRole = user.canonicalRole;
      if (!canonicalRole) {
        const rawRole = String(user.roleId || user.role || user.positionKey || '').toUpperCase();
        if (rawRole.includes('ADMIN')) canonicalRole = 'ADMIN';
        else if (rawRole.includes('PURCHAS')) canonicalRole = 'PURCHASER';
        else if (rawRole.includes('WAREHOUSE')) canonicalRole = 'WAREHOUSE';
        else if (rawRole.includes('REVIEW')) canonicalRole = 'REVIEWER';
        else if (rawRole.includes('APPROV') || rawRole.includes('MGR')) canonicalRole = 'APPROVER';
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
        users: userPool.map(({ pin: _p, password: _pw, ...u }) => u)
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
