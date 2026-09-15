/**
 * @file Config.gs
 * @description Centralized Configuration, Constants, and Properties Service for PRPO_PDQC GAS Backend
 * @version 2.0.0
 */

/**
 * Global Configuration Keys & Defaults
 */
const CONFIG = {
  // Script Property Keys
  PROPERTY_KEYS: {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    DRIVE_ROOT_FOLDER_ID: 'DRIVE_ROOT_FOLDER_ID',
    ADMIN_EMAILS: 'ADMIN_EMAILS',
    APP_ENV: 'APP_ENV',
    SYSTEM_INITIALIZED: 'SYSTEM_INITIALIZED'
  },

  // Fallback defaults
  DEFAULTS: {
    APP_TITLE: '[ERP] ระบบบริหารจัดซื้อ คลังพัสดุ และงบประมาณ (PRPO_PDQC)',
    DRIVE_ROOT_NAME: '[ERP] PR-PO-Stock-System',
    TIMEZONE: 'Asia/Bangkok',
    MAX_FILE_SIZE_BYTES: 20 * 1024 * 1024, // 20 MB max for base64 uploads
    SCRIPT_LOCK_TIMEOUT_MS: 15000 // 15 seconds lock wait
  }
};

/**
 * Standard Sheet Tab Names (Single-Spreadsheet Architecture)
 */
const SHEET_NAMES = Object.freeze({
  // Master Data
  PRODUCTS: 'Products',
  VENDORS: 'Vendors',
  STORAGE_LOCATIONS: 'StorageLocations',
  USAGE_UNITS: 'UsageUnits',
  DEPARTMENTS: 'Departments',
  USERS: 'Users',
  SIGNATURES: 'Signatures',

  // Transactions
  PRS: 'PRs',
  POS: 'POs',
  STOCK_LOGS: 'StockLogs',
  BUDGET_TRANSACTIONS: 'BudgetTransactions',
  AUDIT_LOGS: 'AuditLogs',
  NOTIFICATIONS: 'Notifications',

  // System & Financial Configuration
  BUDGETS: 'Budgets',
  PR_COUNTERS: 'PRCounters',
  APP_CONFIG: 'AppConfig',
  ATTACHMENTS: 'Attachments'
});

/**
 * Drive Folder Categories matching driveService.js
 */
const DRIVE_CATEGORIES = Object.freeze({
  ROOT: '[ERP] PR-PO-Stock-System',
  PR: '01_PR_Attachments',
  PO: '02_PO_Documents',
  GRN: '03_GRN_Evidence',
  CLAIM: '04_Claim_Evidence',
  BACKUPS: '_Backups'
});

/**
 * Allowed MIME Types for Document/Evidence Upload
 */
const ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

/**
 * Retrieves the active or configured Spreadsheet ID.
 * @returns {string} Spreadsheet ID
 */
function getSpreadsheetId() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(CONFIG.PROPERTY_KEYS.SPREADSHEET_ID);
  
  if (!ssId) {
    try {
      const activeSs = SpreadsheetApp.getActiveSpreadsheet();
      if (activeSs) {
        ssId = activeSs.getId();
        props.setProperty(CONFIG.PROPERTY_KEYS.SPREADSHEET_ID, ssId);
      }
    } catch (e) {
      // In standalone script, getActiveSpreadsheet may be null
    }
  }

  if (!ssId) {
    throw new Error('CONFIG_ERROR: SPREADSHEET_ID is not configured in Script Properties.');
  }

  return ssId;
}

/**
 * Opens and returns the main Google Spreadsheet instance.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  const id = getSpreadsheetId();
  try {
    return SpreadsheetApp.openById(id);
  } catch (err) {
    throw new Error(`DATABASE_ERROR: Cannot open Spreadsheet with ID "${id}". Error: ${err.message}`);
  }
}

/**
 * Retrieves a specific sheet tab by name, with helpful error reporting.
 * @param {string} sheetName Name of the sheet tab
 * @param {boolean} [autoCreate=false] Create sheet tab if it doesn't exist
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName, autoCreate = false) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet && autoCreate) {
    sheet = ss.insertSheet(sheetName);
  } else if (!sheet) {
    throw new Error(`SHEET_NOT_FOUND: Sheet tab "${sheetName}" does not exist in spreadsheet.`);
  }

  return sheet;
}

/**
 * Reads a single Script Property with fallback.
 * @param {string} key Property key
 * @param {string} [defaultValue=''] Fallback value
 * @returns {string}
 */
function getScriptProperty(key, defaultValue = '') {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  return val !== null && val !== undefined ? val : defaultValue;
}

/**
 * Writes a single Script Property.
 * @param {string} key Property key
 * @param {string} value Property value
 */
function setScriptProperty(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

/**
 * Returns list of configured Admin Emails (case-insensitive, trimmed).
 * @returns {string[]}
 */
function getAdminEmails() {
  const raw = getScriptProperty(CONFIG.PROPERTY_KEYS.ADMIN_EMAILS, '');
  if (!raw) return [];
  return raw.split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Standard API Response Envelope Builder
 * @param {*} data Payload
 * @param {string} [message='Success'] Success message
 * @returns {Object}
 */
function apiSuccess(data, message = 'Success') {
  return {
    success: true,
    data: data !== undefined ? data : null,
    error: null,
    message: message
  };
}

/**
 * Standard API Error Response Envelope Builder
 * @param {string} errorCode Machine-readable code
 * @param {string} message Human-readable message
 * @param {*} [data=null] Optional error metadata
 * @returns {Object}
 */
function apiError(errorCode, message, data = null) {
  return {
    success: false,
    data: data,
    error: errorCode,
    message: message || 'An unexpected error occurred.'
  };
}
