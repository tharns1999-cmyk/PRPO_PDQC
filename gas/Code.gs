/**
 * Google Apps Script Backend for PR-PO-Stock-System (ERP)
 * 
 * Provides:
 * 1. Self-Provisioning Database (15 Sheets for Master, Transactions, Logs, and E-Signatures)
 * 2. Automated Google Drive Folder Provisioning & Document Routing
 * 3. Unified API Bridge (apiGetInitialData, apiUploadFile, CRUD for all entities)
 * 4. Lightweight Authentication & Role Validation
 */

const CONFIG = {
  SPREADSHEET_ID: '1G0dohgV9l8lJwHpWCYIB5EOwfGoFd8V-3Bj-ylDfMgY',
  ROOT_FOLDER_NAME: '[ERP] PR-PO-Stock-System',
  ATTACHMENTS_FOLDER_NAME: 'PR_PO_Attachments',
  SPREADSHEET_NAME: 'PR_PO_ERP_Database',

  // Master Data Tabs
  SHEET_USERS: 'Users',
  SHEET_DEPARTMENTS: 'Departments',
  SHEET_PRODUCTS_MASTER: 'Products_Master',
  SHEET_STORAGE_LOCATIONS: 'Storage_Locations',
  SHEET_USAGE_UNITS: 'Usage_Units',
  SHEET_VENDORS: 'Vendors',
  SHEET_BUDGETS: 'Budgets',
  SHEET_SIGNATURES: 'Signatures',

  // Transactional Data Tabs
  SHEET_PR_RECORDS: 'PR_Records',
  SHEET_PO_RECORDS: 'PO_Records',
  SHEET_STOCK_MOVEMENTS: 'Stock_Movements',
  SHEET_BUDGET_TRANSACTIONS: 'Budget_Transactions',

  // Audit, Communication & Files Tabs
  SHEET_NOTIFICATIONS: 'Notifications',
  SHEET_AUDIT_LOGS: 'Audit_Logs',
  SHEET_FILES: 'Files'
};

const USER_HEADERS = [
  'id', 'employeeId', 'username', 'password', 'name', 
  'department', 'primaryDepartment', 'allowedDepartments', 
  'canonicalRole', 'roleId', 'level', 'status', 'isActive', 
  'description', 'signature'
];

const AUDIT_HEADERS = [
  'id',            // รหัส Log (AUD-...)
  'timestamp',     // วันเวลา (ISO / Formatted)
  'action',        // ประเภทกิจกรรม (LOGIN, LOGOUT, CREATE, UPDATE, DELETE, APPROVE, REJECT)
  'docType',       // หมวดหมู่ (USER, PRODUCT, VENDOR, LOCATION, PR, PO, STOCK)
  'docNo',         // เลขที่อ้างอิง (เช่น รหัสสินค้า, เลขที่ PR)
  'details',       // คำอธิบายภาษาไทยที่ชัดเจน
  'actorName',     // ชื่อ-นามสกุล ผู้ดำเนินการ
  'department',    // แผนก
  'actorRole',     // สิทธิ์/บทบาท
  'clientIp',      // IP Address ของผู้ใช้
  'clientEnv'      // เบราว์เซอร์/อุปกรณ์ (User Agent)
];

/**
 * Web App entrypoint: Serves the compiled React Single Page App
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ระบบจัดซื้อและคลังสินค้า (PR/PO & Inventory System)')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Resolves or creates a child folder inside a parent folder
 */
function getOrCreateChildFolder(parentFolder, childName) {
  const folders = parentFolder.getFoldersByName(childName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(childName);
}

/**
 * Resolves the root ERP folder in Google Drive
 */
function getRootDriveFolder() {
  const propId = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  if (propId) {
    try {
      return DriveApp.getFolderById(propId);
    } catch (e) {
      Logger.log('Property ROOT_FOLDER_ID invalid, searching by name: ' + e.message);
    }
  }

  const folders = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    const folder = folders.next();
    PropertiesService.getScriptProperties().setProperty('ROOT_FOLDER_ID', folder.getId());
    return folder;
  }

  const newRoot = DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
  PropertiesService.getScriptProperties().setProperty('ROOT_FOLDER_ID', newRoot.getId());
  return newRoot;
}

/**
 * Resolves the target folder path inside Google Drive:
 * [ERP] PR-PO-Stock-System/
 *   ├── PR_PO_Attachments/
 *   ├── 01_PR_Attachments/{YYYY-MM}/
 *   ├── 02_PO_Documents/{YYYY-MM}/
 *   ├── 03_GRN_Evidence/{YYYY-MM}/{PO_NUMBER}/
 *   └── 04_Claim_Evidence/{YYYY-MM}/{PO_NUMBER}/
 */
function resolveTargetDriveFolder(category, poNumber) {
  const root = getRootDriveFolder();
  const dateKey = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');

  let categoryFolderName = '01_PR_Attachments';
  const cat = String(category || '').toUpperCase();
  if (cat.indexOf('PO') !== -1 || cat.indexOf('02') !== -1) {
    categoryFolderName = '02_PO_Documents';
  } else if (cat.indexOf('GRN') !== -1 || cat.indexOf('03') !== -1 || cat.indexOf('RECEIV') !== -1) {
    categoryFolderName = '03_GRN_Evidence';
  } else if (cat.indexOf('CLAIM') !== -1 || cat.indexOf('04') !== -1 || cat.indexOf('DISPUTE') !== -1) {
    categoryFolderName = '04_Claim_Evidence';
  } else if (cat.indexOf('ATTACH') !== -1) {
    categoryFolderName = CONFIG.ATTACHMENTS_FOLDER_NAME;
  }

  const catFolder = getOrCreateChildFolder(root, categoryFolderName);
  const monthFolder = getOrCreateChildFolder(catFolder, dateKey);

  const cleanPo = String(poNumber || '').trim();
  if (cleanPo && (categoryFolderName === '03_GRN_Evidence' || categoryFolderName === '04_Claim_Evidence')) {
    const poFolder = getOrCreateChildFolder(monthFolder, cleanPo);
    return {
      folder: poFolder,
      path: CONFIG.ROOT_FOLDER_NAME + '/' + categoryFolderName + '/' + dateKey + '/' + cleanPo
    };
  }

  return {
    folder: monthFolder,
    path: CONFIG.ROOT_FOLDER_NAME + '/' + categoryFolderName + '/' + dateKey
  };
}

/**
 * Execution Context Singletons & Caching Layer
 */
let _activeSpreadsheet = null;
let _coreSheetsInitialized = false;

const CACHE_TTL_SECONDS = 1800; // 30 minutes cache for Master Data

const CACHE_KEYS = {
  USERS: 'CACHE_USERS',
  MASTER_DATA: 'CACHE_MASTER_DATA',
  PRODUCTS: 'CACHE_PRODUCTS',
  BUDGETS: 'CACHE_BUDGETS'
};

/**
 * Reads parsed JSON from CacheService
 */
function getCachedData(key) {
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    Logger.log('Cache read error [' + key + ']: ' + e.message);
  }
  return null;
}

/**
 * Saves JSON serializable data to CacheService (safely checking < 95KB GAS limit)
 */
function setCachedData(key, data, ttl) {
  try {
    if (data === undefined || data === null) return;
    const cache = CacheService.getScriptCache();
    const serialized = JSON.stringify(data);
    if (serialized.length <= 95000) {
      cache.put(key, serialized, ttl || CACHE_TTL_SECONDS);
    }
  } catch (e) {
    Logger.log('Cache write error [' + key + ']: ' + e.message);
  }
}

/**
 * Invalidates single or multiple keys from CacheService
 */
function invalidateCacheKeys(keys) {
  try {
    const cache = CacheService.getScriptCache();
    if (Array.isArray(keys)) {
      cache.removeAll(keys);
    } else if (typeof keys === 'string') {
      cache.remove(keys);
    }
  } catch (e) {
    Logger.log('Cache invalidate error: ' + e.message);
  }
}

/**
 * Resolves or creates the ERP Google Sheets database automatically (Self-Provisioning with Singleton)
 */
function getOrCreateSpreadsheet() {
  if (_activeSpreadsheet) {
    return _activeSpreadsheet;
  }

  const props = PropertiesService.getScriptProperties();
  const explicitId = CONFIG.SPREADSHEET_ID;
  let ss = null;

  if (explicitId) {
    try {
      ss = SpreadsheetApp.openById(explicitId);
      props.setProperty('SPREADSHEET_ID', explicitId);
    } catch (e) {
      Logger.log('Explicit SPREADSHEET_ID inaccessible: ' + e.message);
    }
  }

  if (!ss) {
    const storedId = props.getProperty('SPREADSHEET_ID');
    if (storedId) {
      try {
        ss = SpreadsheetApp.openById(storedId);
      } catch (e) {
        Logger.log('Stored SPREADSHEET_ID is invalid or inaccessible: ' + e.message);
      }
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    props.setProperty('SPREADSHEET_ID', ss.getId());
    Logger.log('Created new Spreadsheet: ' + ss.getId() + ' (' + ss.getUrl() + ')');

    try {
      const file = DriveApp.getFileById(ss.getId());
      const rootFolder = getRootDriveFolder();
      file.moveTo(rootFolder);
    } catch (driveErr) {
      Logger.log('Could not move spreadsheet to root folder: ' + driveErr.message);
    }

    ensureCoreSheetsInitialized(ss);
    props.setProperty('ERP_SHEETS_INITIALIZED', 'true');
    _coreSheetsInitialized = true;
  } else {
    // Only verify core sheets once if not yet marked initialized in ScriptProperties
    if (!_coreSheetsInitialized) {
      const isInit = props.getProperty('ERP_SHEETS_INITIALIZED');
      if (isInit !== 'true') {
        ensureCoreSheetsInitialized(ss);
        props.setProperty('ERP_SHEETS_INITIALIZED', 'true');
      }
      _coreSheetsInitialized = true;
    }
  }

  // Ensure Users schema is migrated to strict 15-column format and cleaned
  const userCleanVer = props.getProperty('USERS_CLEAN_15_V2');
  if (userCleanVer !== 'true') {
    ensureUsersInitialized(ss);
    props.setProperty('USERS_CLEAN_15_V2', 'true');
  }

  _activeSpreadsheet = ss;
  return _activeSpreadsheet;
}

/**
 * Helper to ensure a specific sheet exists with headers
 */
function getOrCreateSheetWithHeaders(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#F3F4F6');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Ensures Users sheet is strictly 15 columns, cleans misaligned rows, and populates fresh seed data
 */
function ensureUsersInitialized(ss) {
  let userSheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(CONFIG.SHEET_USERS);
  }

  // 1. Ensure header row 1 is exactly 15 columns
  userSheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS])
    .setFontWeight('bold')
    .setBackground('#F3F4F6');
  userSheet.setFrozenRows(1);

  // Clear extra legacy columns beyond 15 if any
  const maxCols = userSheet.getMaxColumns();
  if (maxCols > USER_HEADERS.length) {
    userSheet.getRange(1, USER_HEADERS.length + 1, userSheet.getMaxRows(), maxCols - USER_HEADERS.length).clearContent();
  }

  // 2. Clean all existing rows from row 2 downwards (Clean & Re-populate)
  const lastRow = userSheet.getLastRow();
  if (lastRow > 1) {
    userSheet.getRange(2, 1, lastRow - 1, userSheet.getLastColumn()).clearContent();
  }

  // 3. Populate clean 15-column seed users
  const seedUsers = [
    [
      'USR-0001',
      'EMP-PD-001',
      'siraphat.pd',
      'password123',
      'สิรภัทร แจ่มมิน',     // name (มีชื่อเดียว ห้ามส่ง employeeName หรือ displayName ซ้ำ)
      'PD',                  // department
      'PD',                  // primaryDepartment
      '["PD"]',              // allowedDepartments
      'REQUESTER',           // canonicalRole
      'REQUESTER_PD',        // roleId
      1,                     // level
      'ACTIVE',              // status
      true,                  // isActive
      'สร้าง/ส่ง PR ฝ่ายผลิต, เบิกจ่ายสินค้า, ตรวจรับของเข้าสต็อก', // description
      ''                     // signature
    ],
    [
      'USR-0002',
      'EMP-QC-001',
      'natthinee.qc',
      'password123',
      'ณัฐธินีย์ สอนครบบุรี',
      'QC',
      'QC',
      '["QC"]',
      'REQUESTER',
      'REQUESTER_QC',
      1,
      'ACTIVE',
      true,
      'สร้าง/ส่ง PR ฝ่าย QC/Lab, เบิกจ่ายสารเคมี, ตรวจรับของ',
      ''
    ],
    [
      'USR-0003',
      'EMP-MGR-001',
      'kallayani.mgr',
      'password123',
      'กัลยาณี พลไกร',
      'PD',
      'PD',
      '["PD","QC"]',
      'REVIEWER',
      'ASST_MANAGER',
      2,
      'ACTIVE',
      true,
      'ตรวจทาน PR (Level 1 Reviewer)',
      ''
    ],
    [
      'USR-0004',
      'EMP-PUR-001',
      'nat.on',
      'password123',
      'คุณนัท จัดซื้อ',
      'ALL',
      'ALL',
      '["PD","QC","ALL"]',
      'PURCHASER',
      'ONLINE_PURCHASER',
      2,
      'ACTIVE',
      true,
      'จัดการสั่งซื้อออนไลน์ Shopee/Lazada',
      ''
    ],
    [
      'USR-0005',
      'EMP-MGR-002',
      'prasert.pm',
      'password123',
      'คุณประเสริฐ ยิ่งยง',
      'ALL',
      'ALL',
      '["PD","QC","ALL"]',
      'APPROVER',
      'PLANT_MANAGER',
      3,
      'ACTIVE',
      true,
      'อนุมัติสั่งซื้อ (Final Approver)',
      ''
    ],
    [
      'USR-0006',
      'EMP-SYS-999',
      'admin',
      'password123',
      'ผู้ดูแลระบบ',
      'ALL',
      'ALL',
      '["*"]',
      'ADMIN',
      'ADMIN',
      99,
      'ACTIVE',
      true,
      'ผู้ดูแลระบบ สิทธิ์สูงสุด',
      ''
    ]
  ];

  userSheet.getRange(2, 1, seedUsers.length, USER_HEADERS.length).setValues(seedUsers);
  
  // Invalidate cache immediately so new clean data is read
  invalidateCacheKeys(CACHE_KEYS.USERS);
}

/**
 * Ensures Audit_Logs tab exists with strict 11 headers conforming to AUDIT_HEADERS
 */
function ensureAuditLogsInitialized(ss) {
  let auditSheet = ss.getSheetByName(CONFIG.SHEET_AUDIT_LOGS);
  if (!auditSheet) {
    auditSheet = ss.insertSheet(CONFIG.SHEET_AUDIT_LOGS);
  }

  const lastCol = auditSheet.getLastColumn();
  if (lastCol > AUDIT_HEADERS.length) {
    auditSheet.getRange(1, AUDIT_HEADERS.length + 1, 1, lastCol - AUDIT_HEADERS.length).clearContent();
  }
  auditSheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS])
    .setFontWeight('bold')
    .setBackground('#F3F4F6');
  auditSheet.setFrozenRows(1);

  return auditSheet;
}

/**
 * Ensures all 15 required core sheets exist with proper schemas and seeds initial data
 */
function ensureCoreSheetsInitialized(ss) {
  // 1. Users
  ensureUsersInitialized(ss);

  // 2. Departments
  const deptHeaders = ['id', 'code', 'name', 'nameEn', 'prefix', 'description', 'monthlyBudget', 'isActive', 'color', 'managerName', 'createdAt', 'updatedAt'];
  const deptSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_DEPARTMENTS, deptHeaders);
  if (deptSheet.getLastRow() <= 1) {
    const seedDepts = [
      ['DEPT-PD', 'PD', 'ฝ่ายผลิต', 'Production', 'PD', 'รับผิดชอบกระบวนการแปรรูป ควบคุมการผลิต และดูแลไลน์ผลิตสินค้า', 250000, true, 'blue', 'คุณประเสริฐ ยิ่งยง', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['DEPT-QC', 'QC', 'ฝ่ายควบคุมคุณภาพ', 'Quality Control & Lab', 'QC', 'ตรวจสอบคุณภาพ วัตถุดิบ สารเคมี บรรจุภัณฑ์ และงานแล็บวิเคราะห์', 150000, true, 'amber', 'ดร. กรรณิการ์ จิตเจริญ', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['DEPT-WH', 'WH', 'ฝ่ายคลังสินค้า', 'Warehouse & Inventory', 'WH', 'บริหารคลังจัดเก็บสินค้า วัตถุดิบ ชิ้นส่วน และตรวจรับกระจายสต็อก', 120000, true, 'emerald', 'คุณสมคิด คลังทอง', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['DEPT-PUR', 'PUR', 'ฝ่ายจัดซื้อ', 'Procurement & Sourcing', 'PUR', 'จัดหาผู้จัดจำหน่าย เปรียบเทียบราคา จัดซื้อพัสดุและอุปกรณ์', 100000, true, 'purple', 'คุณสุดา จัดหาดี', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['DEPT-ENG', 'ENG', 'ฝ่ายวิศวกรรมและซ่อมบำรุง', 'Engineering & Maintenance', 'ENG', 'ดูแลรักษาเครื่องจักร ระบบสาธารณูปโภค และงานซ่อมบำรุงโรงงาน', 180000, true, 'cyan', 'วิศวกร ช่างทอง', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']
    ];
    seedDepts.forEach(function(row) { deptSheet.appendRow(row); });
  }

  // 3. Products_Master (Dual-UOM Schema)
  const prodHeaders = ['id', 'code', 'name', 'category', 'department', 'purchaseUnit', 'stockUnit', 'purchaseUom', 'baseUom', 'conversionRate', 'conversionRatio', 'price', 'stockBalance', 'reorderPoint', 'leadTimeDays', 'supplierId', 'locationId', 'locationName', 'createdAt', 'updatedAt'];
  const prodSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_PRODUCTS_MASTER, prodHeaders);
  if (prodSheet.getLastRow() <= 1) {
    const seedProds = [
      ['PROD-PD-001', 'PD-OIL-068', 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)', 'PD', 'PD', 'ถัง (200L)', 'ลิตร', 'ถัง (200L)', 'ลิตร', 200, 200, 14500, 2400, 1000, 5, '', 'LOC-PD-001', 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-PD-002', 'PD-GRS-002', 'จาระบีทนความร้อนสูงเกรดอาหาร (High-Temp Food Grade Grease NLGI 2)', 'PD', 'PD', 'กล่อง (12 กระป๋อง)', 'กระป๋อง', 'กล่อง (12 กระป๋อง)', 'กระป๋อง', 12, 12, 9600, 25, 10, 3, '', 'LOC-PD-001', 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-PD-003', 'PD-BLT-380', 'สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15)', 'PD', 'PD', 'เส้น', 'เส้น', 'เส้น', 'เส้น', 1, 1, 620, 6, 8, 7, '', 'LOC-PD-002', 'ชั้นวาง A-02 (อะไหล่เครื่องจักร & สายพาน)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-PD-004', 'PD-GLV-NBR', 'ถุงมือไนไตรล์ป้องกันสารเคมี (Nitrile Chemical Resistant Gloves Size L)', 'PD', 'PD', 'กล่อง (100 ชิ้น)', 'ชิ้น', 'กล่อง (100 ชิ้น)', 'ชิ้น', 100, 100, 320, 2000, 750, 3, '', 'LOC-PD-003', 'ตู้เก็บอุปกรณ์ความปลอดภัย (PPE)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-PD-005', 'PD-BOX-002', 'กล่องลูกฟูกมาตรฐาน เบอร์ 2', 'PD', 'PD', 'ใบ', 'ใบ', 'ใบ', 'ใบ', 1, 1, 15, 100, 50, 3, '', 'LOC-PD-004', 'ห้องแพ็คเกจจิ้ง', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-QC-001', 'QC-BUF-PH7', 'สารละลายบัฟเฟอร์มาตรฐานสอบเทียบ pH 7.00 Buffer Solution (500ml)', 'QC', 'QC', 'ขวด', 'ขวด', 'ขวด', 'ขวด', 1, 1, 750, 12, 5, 5, '', 'LOC-QC-001', 'ตู้เก็บสารเคมีทดสอบ (Lab 1)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-QC-002', 'QC-BUF-PH4', 'สารละลายบัฟเฟอร์มาตรฐานสอบเทียบ pH 4.01 Buffer Solution (500ml)', 'QC', 'QC', 'ขวด', 'ขวด', 'ขวด', 'ขวด', 1, 1, 750, 6, 3, 5, '', 'LOC-QC-001', 'ตู้เก็บสารเคมีทดสอบ (Lab 1)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-QC-003', 'QC-PPT-100', 'ทิปปิเปตไมโครสีขาว (Micropipette Tips 100-1000 uL, DNase/RNase Free)', 'QC', 'QC', 'กล่อง (1000 ชิ้น)', 'ชิ้น', 'กล่อง (1000 ชิ้น)', 'ชิ้น', 1000, 1000, 1200, 15000, 5000, 4, '', 'LOC-QC-001', 'ตู้เก็บสารเคมีทดสอบ (Lab 1)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-QC-004', 'QC-FLT-WAT', 'กระดาษกรองเชิงคุณภาพ Whatman Grade 1 (เส้นผ่านศูนย์กลาง 110mm)', 'QC', 'QC', 'กล่อง (100 แผ่น)', 'แผ่น', 'กล่อง (100 แผ่น)', 'แผ่น', 100, 100, 950, 1200, 400, 7, '', 'LOC-QC-002', 'ชั้นวางอาหารเลี้ยงเชื้อ (Media Shelf B)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['PROD-QC-005', 'QC-AGR-PCA', 'อาหารเลี้ยงเชื้อ Plate Count Agar (PCA) สำหรับทดสอบจุลชีววิทยา (500g)', 'QC', 'QC', 'ขวด (500g)', 'กรัม', 'ขวด (500g)', 'กรัม', 500, 500, 2850, 2500, 1000, 10, '', 'LOC-QC-002', 'ชั้นวางอาหารเลี้ยงเชื้อ (Media Shelf B)', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']
    ];
    seedProds.forEach(function(row) { prodSheet.appendRow(row); });
  }

  // 4. Storage_Locations
  const locHeaders = ['id', 'name', 'department', 'createdAt', 'updatedAt'];
  const locSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_STORAGE_LOCATIONS, locHeaders);
  if (locSheet.getLastRow() <= 1) {
    const seedLocs = [
      ['LOC-PD-001', 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)', 'PD', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['LOC-PD-002', 'ชั้นวาง A-02 (อะไหล่เครื่องจักร & สายพาน)', 'PD', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['LOC-PD-003', 'ตู้เก็บอุปกรณ์ความปลอดภัย (PPE)', 'PD', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['LOC-PD-004', 'ห้องแพ็คเกจจิ้ง', 'PD', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['LOC-QC-001', 'ตู้เก็บสารเคมีทดสอบ (Lab 1)', 'QC', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['LOC-QC-002', 'ชั้นวางอาหารเลี้ยงเชื้อ (Media Shelf B)', 'QC', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['LOC-QC-003', 'ตู้ควบคุมอุณหภูมิ 4°C (Cold Storage)', 'QC', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['LOC-GEN-001', 'คลังพัสดุกลาง', 'ALL', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']
    ];
    seedLocs.forEach(function(row) { locSheet.appendRow(row); });
  }

  // 5. Usage_Units
  const unitHeaders = ['id', 'name', 'department', 'dot', 'color', 'badgeBg', 'status', 'createdAt', 'updatedAt'];
  const unitSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_USAGE_UNITS, unitHeaders);
  if (unitSheet.getLastRow() <= 1) {
    const seedUnits = [
      ['UNIT-PD-001', 'ห้อง K1', 'PD', 'bg-blue-500', 'bg-blue-50 text-blue-700 border-blue-200/80', 'bg-blue-100 text-blue-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['UNIT-PD-002', 'ห้อง K2', 'PD', 'bg-violet-500', 'bg-violet-50 text-violet-700 border-violet-200/80', 'bg-violet-100 text-violet-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['UNIT-PD-003', 'ห้องผลไม้', 'PD', 'bg-emerald-500', 'bg-emerald-50 text-emerald-700 border-emerald-200/80', 'bg-emerald-100 text-emerald-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['UNIT-PD-004', 'ห้องแพ็ค', 'PD', 'bg-amber-500', 'bg-amber-50 text-amber-700 border-amber-200/80', 'bg-amber-100 text-amber-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['UNIT-PD-005', 'ออฟฟิศ PD', 'PD', 'bg-slate-500', 'bg-slate-100 text-slate-700 border-slate-200/80', 'bg-slate-200 text-slate-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['UNIT-QC-001', 'Lab เคมี', 'QC', 'bg-cyan-500', 'bg-cyan-50 text-cyan-700 border-cyan-200/80', 'bg-cyan-100 text-cyan-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['UNIT-QC-002', 'Lab จุลชีววิทยา', 'QC', 'bg-teal-500', 'bg-teal-50 text-teal-700 border-teal-200/80', 'bg-teal-100 text-teal-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['UNIT-QC-003', 'ห้อง Sensory', 'QC', 'bg-fuchsia-500', 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80', 'bg-fuchsia-100 text-fuchsia-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['UNIT-QC-004', 'ออฟฟิศ QC', 'QC', 'bg-rose-500', 'bg-rose-50 text-rose-700 border-rose-200/80', 'bg-rose-100 text-rose-800', 'ACTIVE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']
    ];
    seedUnits.forEach(function(row) { unitSheet.appendRow(row); });
  }

  // 6. Vendors
  const vendorHeaders = ['id', 'code', 'name', 'department', 'contactPerson', 'phone', 'email', 'taxId', 'address', 'createdAt', 'updatedAt'];
  const vendorSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_VENDORS, vendorHeaders);
  if (vendorSheet.getLastRow() <= 1) {
    const seedVendors = [
      ['VEND-001', 'VEND-IND-01', 'บริษัท สยามอินดัสเตรียลซัพพลาย จำกัด', 'PD', 'คุณสมชาย มุ่งมั่น', '02-123-4567', 'sales@siamind.co.th', '0105551234567', '88/9 หมู่ 4 นิคมอุตสาหกรรมบางชัน ถ.เสรีไทย คันนายาว กทม. 10230', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['VEND-002', 'VEND-OIL-02', 'บริษัท ปิโตรเลียมแอนด์ลูบริแคนท์ เทรดดิ้ง จำกัด', 'PD', 'คุณวิภาวรรณ ชัยเจริญ', '02-987-6543', 'contact@petrolube.com', '0105559876543', '123/45 ถ.วิภาวดีรังสิต จตุจักร กทม. 10900', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['VEND-003', 'VEND-SAF-03', 'ห้างหุ้นส่วนจำกัด เซฟตี้เฟิร์สท์ โปรดักส์', 'PD', 'คุณธวัชชัย รักษ์ดี', '081-456-7890', 'service@safetyfirst.co.th', '0103554567890', '45/12 ถ.กิ่งแก้ว ต.ราชาเทวะ อ.บางพลี จ.สมุทรปราการ 10540', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['VEND-004', 'VEND-LAB-01', 'บริษัท ไซแอนติฟิคแล็บ แอนด์เคมิคอล จำกัด', 'QC', 'ดร.กิตติศักดิ์ วิริยะ', '02-456-7890', 'order@scilabchem.co.th', '0105554567891', '99/1 อาคารไซแอนซ์ปาร์ค ถ.พหลโยธิน คลองหนึ่ง คลองหลวง ปทุมธานี 12120', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['VEND-005', 'VEND-INS-02', 'บริษัท เพรสซิชั่นอินสตรูเมนท์ส (ไทยแลนด์) จำกัด', 'QC', 'คุณนุชนาถ สุขเกษม', '02-789-0123', 'support@precision-inst.co.th', '0105557890123', '55/3 ซอยสุขุมวิท 63 แขวงคลองตันเหนือ เขตวัฒนา กทม. 10110', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['VEND-006', 'VEND-GEN-01', 'บริษัท ออฟฟิศแอนด์แฟคทอรี่ ดีโป้ จำกัด', 'BOTH', 'คุณปริญญา มั่นคง', '02-333-4444', 'info@officedepot-th.com', '0105553334444', '100/8 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กทม. 10310', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']
    ];
    seedVendors.forEach(function(row) { vendorSheet.appendRow(row); });
  }

  // 7. Budgets
  const budgetHeaders = ['dept', 'monthlyBudget', 'spent', 'pending', 'variance', 'historyJson', 'historicalSpentJson', 'updatedAt'];
  const budgetSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_BUDGETS, budgetHeaders);
  if (budgetSheet.getLastRow() <= 1) {
    const seedBudgets = [
      ['PD', 250000, 0, 0, 250000, '{}', '{}', new Date().toISOString()],
      ['QC', 150000, 0, 0, 150000, '{}', '{}', new Date().toISOString()],
      ['WH', 120000, 0, 0, 120000, '{}', '{}', new Date().toISOString()],
      ['PUR', 100000, 0, 0, 100000, '{}', '{}', new Date().toISOString()],
      ['ENG', 180000, 0, 0, 180000, '{}', '{}', new Date().toISOString()]
    ];
    seedBudgets.forEach(function(row) { budgetSheet.appendRow(row); });
  }

  // 8. Budget_Transactions
  const btxHeaders = ['id', 'date', 'type', 'dept', 'department', 'amount', 'refundAmount', 'docNo', 'referenceDoc', 'poNumber', 'refId', 'note', 'actor', 'createdAt'];
  getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_BUDGET_TRANSACTIONS, btxHeaders);

  // 9. PR_Records
  const prHeaders = ['id', 'prNo', 'department', 'source', 'purchaseChannel', 'requesterName', 'requesterId', 'requesterSignature', 'reviewerName', 'reviewerId', 'reviewerSignature', 'approvedBy', 'approverId', 'approverSignature', 'status', 'hasVat', 'specUrl', 'attachmentsJson', 'note', 'reason', 'totalEstimatedPrice', 'itemsJson', 'timelineJson', 'createdAt', 'updatedAt'];
  getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_PR_RECORDS, prHeaders);

  // 10. PO_Records
  const poHeaders = ['id', 'poNo', 'prId', 'prNo', 'prNumber', 'department', 'vendorId', 'vendorName', 'purchaseChannel', 'status', 'workflowStatus', 'isCompleted', 'isClosed', 'totalAmount', 'subtotal', 'vat', 'grandTotal', 'itemsJson', 'ngItemsJson', 'grnHistoryJson', 'deliveryInfoJson', 'receivingInfoJson', 'issueDate', 'completedAt', 'createdAt', 'updatedAt'];
  getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_PO_RECORDS, poHeaders);

  // 11. Stock_Movements
  const stockHeaders = ['id', 'date', 'productId', 'productCode', 'itemCode', 'name', 'type', 'documentNo', 'docNo', 'grnNumber', 'poNo', 'poNumber', 'refPo', 'qty', 'quantity', 'receivedQty', 'unit', 'baseUom', 'purchaseUom', 'conversionRatio', 'unitPrice', 'baseUnitCost', 'purchaseUnitPrice', 'totalPrice', 'totalValue', 'balance', 'balanceAfter', 'user', 'locationId', 'locationName', 'note', 'createdAt'];
  const stockSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_STOCK_MOVEMENTS, stockHeaders);
  if (stockSheet.getLastRow() <= 1) {
    const seedStock = [
      ['INIT-PROD-PD-001', '2026-09-01 00:00:00', 'PROD-PD-001', 'PD-OIL-068', 'PD-OIL-068', 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)', 'IN', 'INITIAL-BALANCE', 'INITIAL-BALANCE', 'INITIAL-BALANCE', '-', '-', '-', 2400, 2400, 12, 'ลิตร', 'ลิตร', 'ถัง (200L)', 200, 72.50, 72.50, 14500, 174000, 174000, 2400, 2400, 'System Initial Balance', 'LOC-PD-001', 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)', 'ยอดยกมาจากระบบเริ่มต้น', '2026-09-01T00:00:00.000Z']
    ];
    seedStock.forEach(function(row) { stockSheet.appendRow(row); });
  }

  // 12. Notifications
  const notiHeaders = ['id', 'type', 'title', 'message', 'priority', 'targetRole', 'targetDepartment', 'docNo', 'link', 'isRead', 'readAt', 'createdAt'];
  getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_NOTIFICATIONS, notiHeaders);

  // 13. Audit_Logs
  ensureAuditLogsInitialized(ss);

  // 14. Signatures
  const sigHeaders = ['roleId', 'name', 'signatureUrl', 'updatedAt', 'updatedBy'];
  const sigSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_SIGNATURES, sigHeaders);
  if (sigSheet.getLastRow() <= 1) {
    const seedSigs = [
      ['ASST_MANAGER', 'คุณสมชาย (Asst. Mgr)', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20 50 Q 50 10, 80 50 T 140 50 T 180 30" fill="none" stroke="%231e3a8a" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Somchai (Asst. Mgr)</text></svg>', '2026-08-01 09:00:00', 'Admin'],
      ['PLANT_MANAGER', 'คุณประเสริฐ (Plant Mgr)', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M15 45 Q 60 5, 90 45 T 150 45 T 190 25" fill="none" stroke="%230f766e" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Prasert (Plant Mgr)</text></svg>', '2026-08-01 09:00:00', 'Admin'],
      ['ADMIN', 'ผู้ดูแลระบบ', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20 40 Q 60 10, 100 40 T 170 30" fill="none" stroke="%233730a3" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">System Admin</text></svg>', '2026-08-01 09:00:00', 'Admin'],
      ['REQUESTER_PD', 'คุณวิชัย (PD)', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M25 45 Q 65 15, 95 45 T 160 40" fill="none" stroke="%232563eb" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Wichai (PD)</text></svg>', '2026-08-01 09:00:00', 'Admin'],
      ['REQUESTER_QC', 'คุณสมหญิง (QC)', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20 45 Q 55 15, 85 45 T 150 40" fill="none" stroke="%23d97706" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Somying (QC)</text></svg>', '2026-08-01 09:00:00', 'Admin']
    ];
    seedSigs.forEach(function(row) { sigSheet.appendRow(row); });
  }

  // 15. Files
  const fileHeaders = ['fileId', 'fileName', 'mimeType', 'category', 'poNumber', 'folderPath', 'fileUrl', 'uploadedAt'];
  getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_FILES, fileHeaders);

  // Clean default empty sheets
  try {
    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่นงาน1');
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
  } catch (e) {}
}

/**
 * High-performance reader converting a Google Sheets tab into an array of JavaScript objects
 */
function readSheetToObjects(ss, sheetName, jsonCols) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return [];

  const headers = data[0].map(function(h) { return String(h).trim(); });
  const jsonSet = {};
  if (Array.isArray(jsonCols)) {
    jsonCols.forEach(function(c) { jsonSet[c] = true; });
  }

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    let hasValue = false;

    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (!h) continue;
      let val = row[j];

      if (val !== '' && val !== null && val !== undefined) {
        hasValue = true;
      }

      // Automatically parse JSON string fields
      if (jsonSet[h] || h.indexOf('Json') !== -1 || h === 'allowedDepartments' || h === 'attachments' || h === 'items') {
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try {
            val = JSON.parse(val);
          } catch (jsonErr) {}
        }
      }

      obj[h] = val;
    }

    if (hasValue) {
      results.push(obj);
    }
  }

  return results;
}

/**
 * High-performance bulk writer replacing a sheet's content with an array of objects
 */
function writeObjectsToSheet(ss, sheetName, headers, objects, jsonCols) {
  const sheet = getOrCreateSheetWithHeaders(ss, sheetName, headers);
  const jsonSet = {};
  if (Array.isArray(jsonCols)) {
    jsonCols.forEach(function(c) { jsonSet[c] = true; });
  }

  // Clear existing data rows below header
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  if (!Array.isArray(objects) || objects.length === 0) {
    return true;
  }

  const rows = objects.map(function(obj) {
    return headers.map(function(h) {
      let val = obj[h];
      if (val === undefined || val === null) return '';
      if (jsonSet[h] || h.indexOf('Json') !== -1 || typeof val === 'object') {
        try {
          return JSON.stringify(val);
        } catch (e) {
          return String(val);
        }
      }
      return val;
    });
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  return true;
}

/**
 * Generic Upsert Helper for a single record in Google Sheets
 * If record exists (matched by id or code), updates the row in-place; otherwise appends a new row.
 */
function upsertRecordInSheet(ss, sheetName, headers, record, idField, jsonCols) {
  const sheet = getOrCreateSheetWithHeaders(ss, sheetName, headers);
  const data = sheet.getDataRange().getValues();
  const jsonSet = {};
  if (Array.isArray(jsonCols)) {
    jsonCols.forEach(function(c) { jsonSet[c] = true; });
  }

  const headerRow = data[0].map(function(h) { return String(h).trim(); });
  let idColIdx = headerRow.indexOf(idField || 'id');
  if (idColIdx === -1) idColIdx = 0;
  const codeIdx = headerRow.indexOf('code');

  const targetId = String(record[idField || 'id'] || record.id || '').trim();
  const targetCode = String(record.code || '').trim().toUpperCase();

  let targetRowIdx = -1;
  if (data.length > 1 && targetId) {
    for (let i = 1; i < data.length; i++) {
      const rowId = String(data[i][idColIdx] || '').trim();
      if (rowId === targetId) {
        targetRowIdx = i + 1; // 1-based index in sheet
        break;
      }
    }
  }

  const rowValues = headers.map(function(h) {
    let val = record[h];
    if (val === undefined || val === null) {
      if (h === 'createdAt' && targetRowIdx === -1) return new Date().toISOString();
      if (h === 'updatedAt') return new Date().toISOString();
      return '';
    }
    if (jsonSet[h] || h.indexOf('Json') !== -1 || typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch (e) {
        return String(val);
      }
    }
    return val;
  });

  if (targetRowIdx !== -1) {
    sheet.getRange(targetRowIdx, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return record;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED API BRIDGE FUNCTIONS (Called via google.script.run from React Client)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper to robustly extract a field from a row object regardless of case or spacing in header
 */
function getRowField(rowObj, fieldNames) {
  if (!rowObj || typeof rowObj !== 'object') return '';
  for (let i = 0; i < fieldNames.length; i++) {
    const target = fieldNames[i];
    if (rowObj[target] !== undefined && rowObj[target] !== null && String(rowObj[target]).trim() !== '') {
      return rowObj[target];
    }
  }
  for (let i = 0; i < fieldNames.length; i++) {
    const normTarget = fieldNames[i].toLowerCase().replace(/[\s_-]/g, '');
    for (const key in rowObj) {
      if (key.toLowerCase().replace(/[\s_-]/g, '') === normTarget) {
        if (rowObj[key] !== undefined && rowObj[key] !== null && String(rowObj[key]).trim() !== '') {
          return rowObj[key];
        }
      }
    }
  }
  return '';
}

/**
 * Single-Shot Initial Data Hydration: Returns essential master data & summary stats for instant startup
 * Accelerated by Granular CacheService (CACHE_USERS, CACHE_PRODUCTS, CACHE_MASTER_DATA, CACHE_BUDGETS)
 * Heavy historical data (PRs, POs, Stock Movements, Audit Logs) are lazy-loaded via separate APIs.
 */
function apiGetInitialData() {
  try {
    const ss = getOrCreateSpreadsheet();

    // 1. Granular Cache: USERS
    let sanitizedUsers = getCachedData(CACHE_KEYS.USERS);
    if (!sanitizedUsers) {
      const users = readSheetToObjects(ss, CONFIG.SHEET_USERS, ['allowedDepartments']);
      sanitizedUsers = users.map(function(u, i) {
        const empId = String(getRowField(u, ['employeeId', 'employee_id', 'empId', 'id']) || '').trim();
        const username = String(getRowField(u, ['username', 'user']) || '').trim();
        const nameVal = String(getRowField(u, ['name', 'employeeName']) || '').trim();
        const empNameVal = String(getRowField(u, ['employeeName', 'name']) || '').trim();
        const displayVal = String(getRowField(u, ['displayName']) || '').trim() || nameVal || empNameVal;
        const deptVal = String(getRowField(u, ['department', 'primaryDepartment']) || 'PD').trim();
        const roleIdVal = String(getRowField(u, ['roleId', 'role', 'positionKey']) || 'REQUESTER_PD').trim();
        let canonicalRole = String(getRowField(u, ['canonicalRole']) || '').trim().toUpperCase();
        if (!canonicalRole) {
          const upperRole = roleIdVal.toUpperCase();
          if (upperRole.indexOf('ADMIN') !== -1) canonicalRole = 'ADMIN';
          else if (upperRole.indexOf('PURCHAS') !== -1) canonicalRole = 'PURCHASER';
          else if (upperRole.indexOf('WAREHOUSE') !== -1) canonicalRole = 'WAREHOUSE';
          else if (upperRole.indexOf('REVIEW') !== -1 || upperRole.indexOf('ASST') !== -1) canonicalRole = 'REVIEWER';
          else if (upperRole.indexOf('APPROV') !== -1 || upperRole.indexOf('MGR') !== -1) canonicalRole = 'APPROVER';
          else canonicalRole = 'REQUESTER';
        }

        return {
          id: String(getRowField(u, ['id']) || ('USR-' + (i + 1))),
          employeeId: empId.toUpperCase(),
          username: username || empId,
          name: nameVal || displayVal,
          employeeName: empNameVal || nameVal || displayVal,
          displayName: displayVal,
          department: deptVal,
          departments: u.allowedDepartments || [deptVal],
          primaryDepartment: deptVal,
          allowedDepartments: u.allowedDepartments || [deptVal],
          canonicalRole: canonicalRole,
          roleId: roleIdVal,
          email: String(getRowField(u, ['email']) || ''),
          level: Number(getRowField(u, ['level']) || 1),
          status: String(getRowField(u, ['status']) || 'ACTIVE'),
          isActive: true,
          pin: String(getRowField(u, ['pin', 'password', 'pwd']) || '1234'),
          pictureUrl: String(getRowField(u, ['pictureUrl']) || ''),
          description: String(getRowField(u, ['description']) || ''),
          signature: String(getRowField(u, ['signature']) || '')
        };
      });
      setCachedData(CACHE_KEYS.USERS, sanitizedUsers);
    }

    // 2. Granular Cache: PRODUCTS
    let products = getCachedData(CACHE_KEYS.PRODUCTS);
    if (!products) {
      products = readSheetToObjects(ss, CONFIG.SHEET_PRODUCTS_MASTER);
      setCachedData(CACHE_KEYS.PRODUCTS, products);
    }

    // 3. Granular Cache: MASTER DATA (Departments, Vendors, Locations, Usage Units, Signatures)
    let masterData = getCachedData(CACHE_KEYS.MASTER_DATA);
    if (!masterData) {
      const departments = readSheetToObjects(ss, CONFIG.SHEET_DEPARTMENTS);
      const vendors = readSheetToObjects(ss, CONFIG.SHEET_VENDORS);
      const storageLocations = readSheetToObjects(ss, CONFIG.SHEET_STORAGE_LOCATIONS);
      const usageUnits = readSheetToObjects(ss, CONFIG.SHEET_USAGE_UNITS);
      const rawSigs = readSheetToObjects(ss, CONFIG.SHEET_SIGNATURES);
      const signatures = {};
      rawSigs.forEach(function(s) {
        if (s.roleId) signatures[s.roleId] = s;
      });
      masterData = {
        departments: departments,
        vendors: vendors,
        storageLocations: storageLocations,
        usageUnits: usageUnits,
        signatures: signatures
      };
      setCachedData(CACHE_KEYS.MASTER_DATA, masterData);
    }

    // 4. Granular Cache: BUDGETS
    let budgets = getCachedData(CACHE_KEYS.BUDGETS);
    if (!budgets) {
      const rawBudgets = readSheetToObjects(ss, CONFIG.SHEET_BUDGETS, ['historyJson', 'historicalSpentJson']);
      budgets = {};
      rawBudgets.forEach(function(b) {
        budgets[b.dept] = {
          monthlyBudget: Number(b.monthlyBudget || 0),
          spent: Number(b.spent || 0),
          pending: Number(b.pending || 0),
          variance: Number(b.variance || 0),
          history: b.historyJson || {},
          historicalSpent: b.historicalSpentJson || {}
        };
      });
      setCachedData(CACHE_KEYS.BUDGETS, budgets);
    }

    // 5. Notifications
    const notifications = readSheetToObjects(ss, CONFIG.SHEET_NOTIFICATIONS);

    // 6. Fast Summary Stats (Instant header-level row counting)
    const prSheet = ss.getSheetByName(CONFIG.SHEET_PR_RECORDS);
    const poSheet = ss.getSheetByName(CONFIG.SHEET_PO_RECORDS);
    const stockSheet = ss.getSheetByName(CONFIG.SHEET_STOCK_MOVEMENTS);
    const summaryStats = {
      totalPRs: prSheet ? Math.max(0, prSheet.getLastRow() - 1) : 0,
      totalPOs: poSheet ? Math.max(0, poSheet.getLastRow() - 1) : 0,
      totalStockMovements: stockSheet ? Math.max(0, stockSheet.getLastRow() - 1) : 0
    };

    return {
      success: true,
      users: sanitizedUsers,
      departments: masterData.departments || [],
      products: products || [],
      storageLocations: masterData.storageLocations || [],
      usageUnits: masterData.usageUnits || [],
      vendors: masterData.vendors || [],
      budgets: budgets || {},
      signatures: masterData.signatures || {},
      notifications: notifications || [],
      summaryStats: summaryStats
    };
  } catch (err) {
    Logger.log('apiGetInitialData error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Lazy Fetching: PR Records
 */
function apiGetPRs() {
  try {
    const ss = getOrCreateSpreadsheet();
    const prs = readSheetToObjects(ss, CONFIG.SHEET_PR_RECORDS, ['itemsJson', 'attachmentsJson', 'timelineJson']);
    return { success: true, prs: prs };
  } catch (err) {
    return { success: false, error: err.message, prs: [] };
  }
}

/**
 * Lazy Fetching: PO Records
 */
function apiGetPOs() {
  try {
    const ss = getOrCreateSpreadsheet();
    const pos = readSheetToObjects(ss, CONFIG.SHEET_PO_RECORDS, ['itemsJson', 'ngItemsJson', 'grnHistoryJson', 'deliveryInfoJson', 'receivingInfoJson']);
    return { success: true, pos: pos };
  } catch (err) {
    return { success: false, error: err.message, pos: [] };
  }
}

/**
 * Lazy Fetching: Stock Movement Logs
 */
function apiGetStockLogs() {
  try {
    const ss = getOrCreateSpreadsheet();
    const stockLogs = readSheetToObjects(ss, CONFIG.SHEET_STOCK_MOVEMENTS);
    return { success: true, stockLogs: stockLogs };
  } catch (err) {
    return { success: false, error: err.message, stockLogs: [] };
  }
}

/**
 * Lazy Fetching: Budget Transactions
 */
function apiGetBudgetTransactions() {
  try {
    const ss = getOrCreateSpreadsheet();
    const budgetTransactions = readSheetToObjects(ss, CONFIG.SHEET_BUDGET_TRANSACTIONS);
    return { success: true, budgetTransactions: budgetTransactions };
  } catch (err) {
    return { success: false, error: err.message, budgetTransactions: [] };
  }
}

/**
 * Lazy Fetching: Audit Logs
 */
function apiGetAuditLogs() {
  try {
    const ss = getOrCreateSpreadsheet();
    const auditLogs = readSheetToObjects(ss, CONFIG.SHEET_AUDIT_LOGS, ['changes']);
    return { success: true, auditLogs: auditLogs };
  } catch (err) {
    return { success: false, error: err.message, auditLogs: [] };
  }
}

/**
 * Lazy Fetching: Uploaded Files
 */
function apiGetFiles() {
  try {
    const ss = getOrCreateSpreadsheet();
    const files = readSheetToObjects(ss, CONFIG.SHEET_FILES);
    return { success: true, files: files };
  } catch (err) {
    return { success: false, error: err.message, files: [] };
  }
}

/**
 * Save PR Records
 */
function apiSavePRs(prs) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'prNo', 'department', 'source', 'purchaseChannel', 'requesterName', 'requesterId', 'requesterSignature', 'reviewerName', 'reviewerId', 'reviewerSignature', 'approvedBy', 'approverId', 'approverSignature', 'status', 'hasVat', 'specUrl', 'attachmentsJson', 'note', 'reason', 'totalEstimatedPrice', 'itemsJson', 'timelineJson', 'createdAt', 'updatedAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_PR_RECORDS, headers, prs, ['itemsJson', 'attachmentsJson', 'timelineJson']);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save PO Records
 */
function apiSavePOs(pos) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'poNo', 'prId', 'prNo', 'prNumber', 'department', 'vendorId', 'vendorName', 'purchaseChannel', 'status', 'workflowStatus', 'isCompleted', 'isClosed', 'totalAmount', 'subtotal', 'vat', 'grandTotal', 'itemsJson', 'ngItemsJson', 'grnHistoryJson', 'deliveryInfoJson', 'receivingInfoJson', 'issueDate', 'completedAt', 'createdAt', 'updatedAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_PO_RECORDS, headers, pos, ['itemsJson', 'ngItemsJson', 'grnHistoryJson', 'deliveryInfoJson', 'receivingInfoJson']);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Products Master Data
 */
function apiSaveProducts(products) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'code', 'name', 'category', 'department', 'purchaseUnit', 'stockUnit', 'purchaseUom', 'baseUom', 'conversionRate', 'conversionRatio', 'price', 'stockBalance', 'reorderPoint', 'leadTimeDays', 'supplierId', 'locationId', 'locationName', 'createdAt', 'updatedAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_PRODUCTS_MASTER, headers, products);
    invalidateCacheKeys(CACHE_KEYS.PRODUCTS);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Single Product Master Data (Insert or Update row in Products_Master)
 * Strict SKU Uniqueness Validation:
 * - In CREATE mode: verifies SKU/code is unique across all rows in Products_Master. Rejects if duplicate.
 * - In EDIT mode: strictly updates only the row belonging to targetId.
 */
function apiSaveProduct(productData, mode) {
  try {
    if (!productData || typeof productData !== 'object') {
      return { success: false, error: 'INVALID_DATA', message: 'ข้อมูลสินค้าไม่ถูกต้อง' };
    }
    const isEdit = String(mode || productData._mode || '').toUpperCase() === 'EDIT' || (Boolean(productData.isEdit) && Boolean(productData.id));
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'code', 'name', 'category', 'department', 'purchaseUnit', 'stockUnit', 'purchaseUom', 'baseUom', 'conversionRate', 'conversionRatio', 'price', 'stockBalance', 'reorderPoint', 'leadTimeDays', 'supplierId', 'locationId', 'locationName', 'createdAt', 'updatedAt'];
    const sheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_PRODUCTS_MASTER, headers);
    const data = sheet.getDataRange().getValues();

    const targetCode = String(productData.code || productData.sku || '').trim().toUpperCase();
    const targetId = String(productData.id || '').trim();

    if (!targetCode) {
      return { success: false, error: 'EMPTY_SKU', message: 'กรุณาระบุรหัสสินค้า (SKU / Item Code)' };
    }

    const headerRow = data[0].map(function(h) { return String(h).trim(); });
    const idColIdx = headerRow.indexOf('id') !== -1 ? headerRow.indexOf('id') : 0;
    const codeColIdx = headerRow.indexOf('code') !== -1 ? headerRow.indexOf('code') : 1;

    let existingRowIdx = -1; // 1-based index in sheet
    let duplicateSkuFound = false;

    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][idColIdx] || '').trim();
        const rowCode = String(data[i][codeColIdx] || '').trim().toUpperCase();

        if (targetId && rowId === targetId) {
          existingRowIdx = i + 1;
        }

        // Check if SKU already exists
        if (rowCode && rowCode === targetCode) {
          if (!isEdit || (targetId && rowId !== targetId)) {
            duplicateSkuFound = true;
          }
        }
      }
    }

    // Defensive Guardrail: In CREATE mode (or when SKU belongs to another record), reject duplicate
    if (duplicateSkuFound) {
      return { success: false, error: 'DUPLICATE_SKU', message: 'รหัสสินค้านี้ถูกใช้งานแล้วในระบบ' };
    }

    if (isEdit && existingRowIdx === -1 && targetId) {
      return { success: false, error: 'NOT_FOUND', message: 'ไม่พบข้อมูลสินค้าที่ต้องการแก้ไขในระบบ' };
    }

    const dept = productData.category || productData.department || 'PD';
    if (!productData.id) {
      productData.id = 'PROD-' + dept + '-' + Date.now();
    }
    productData.department = dept;
    productData.category = dept;
    productData.code = targetCode;
    productData.purchaseUom = productData.purchaseUom || productData.purchaseUnit || 'ชิ้น';
    productData.purchaseUnit = productData.purchaseUom;
    productData.baseUom = productData.baseUom || productData.stockUnit || 'ชิ้น';
    productData.stockUnit = productData.baseUom;
    const rate = Number(productData.conversionRatio !== undefined ? productData.conversionRatio : (productData.conversionRate !== undefined ? productData.conversionRate : 1));
    productData.conversionRatio = rate > 0 ? rate : 1;
    productData.conversionRate = productData.conversionRatio;
    productData.updatedAt = new Date().toISOString();

    const rowValues = headers.map(function(h) {
      let val = productData[h];
      if (val === undefined || val === null) {
        if (h === 'createdAt') return productData.createdAt || new Date().toISOString();
        if (h === 'updatedAt') return new Date().toISOString();
        return '';
      }
      return val;
    });

    if (existingRowIdx !== -1) {
      // EDIT mode: Update specific row in-place
      sheet.getRange(existingRowIdx, 1, 1, headers.length).setValues([rowValues]);
    } else {
      // CREATE mode: Append new row
      if (!productData.createdAt) productData.createdAt = new Date().toISOString();
      sheet.appendRow(rowValues);
    }

    invalidateCacheKeys(CACHE_KEYS.PRODUCTS);

    return { success: true, data: productData };
  } catch (err) {
    Logger.log('apiSaveProduct error: ' + err.message);
    return { success: false, error: 'SERVER_ERROR', message: err.message };
  }
}

/**
 * Convenience aliases for Product CRUD
 */
function apiCreateProduct(productData) {
  return apiSaveProduct(productData, 'CREATE');
}

function apiUpdateProduct(productData) {
  return apiSaveProduct(productData, 'EDIT');
}

/**
 * Save Stock Logs / Stock Movements
 */
function apiSaveStockLogs(logs) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'date', 'productId', 'productCode', 'itemCode', 'name', 'type', 'documentNo', 'docNo', 'grnNumber', 'poNo', 'poNumber', 'refPo', 'qty', 'quantity', 'receivedQty', 'unit', 'baseUom', 'purchaseUom', 'conversionRatio', 'unitPrice', 'baseUnitCost', 'purchaseUnitPrice', 'totalPrice', 'totalValue', 'balance', 'balanceAfter', 'user', 'locationId', 'locationName', 'note', 'createdAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_STOCK_MOVEMENTS, headers, logs);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Log a single stock movement or batch of movements
 */
function apiLogStockMovement(movement) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'date', 'productId', 'productCode', 'itemCode', 'name', 'type', 'documentNo', 'docNo', 'grnNumber', 'poNo', 'poNumber', 'refPo', 'qty', 'quantity', 'receivedQty', 'unit', 'baseUom', 'purchaseUom', 'conversionRatio', 'unitPrice', 'baseUnitCost', 'purchaseUnitPrice', 'totalPrice', 'totalValue', 'balance', 'balanceAfter', 'user', 'locationId', 'locationName', 'note', 'createdAt'];
    const sheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_STOCK_MOVEMENTS, headers);
    
    const row = headers.map(function(h) {
      const val = movement[h];
      return val !== undefined && val !== null ? val : '';
    });
    sheet.appendRow(row);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Budgets
 */
function apiSaveBudgets(budgets) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['dept', 'monthlyBudget', 'spent', 'pending', 'variance', 'historyJson', 'historicalSpentJson', 'updatedAt'];
    const rows = Object.keys(budgets || {}).map(function(dept) {
      const b = budgets[dept] || {};
      return {
        dept: dept,
        monthlyBudget: Number(b.monthlyBudget || 0),
        spent: Number(b.spent || 0),
        pending: Number(b.pending || 0),
        variance: Number(b.variance || 0),
        historyJson: b.history || {},
        historicalSpentJson: b.historicalSpent || {},
        updatedAt: new Date().toISOString()
      };
    });
    writeObjectsToSheet(ss, CONFIG.SHEET_BUDGETS, headers, rows, ['historyJson', 'historicalSpentJson']);
    invalidateCacheKeys(CACHE_KEYS.BUDGETS);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Budget Transactions
 */
function apiSaveBudgetTransactions(transactions) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'date', 'type', 'dept', 'department', 'amount', 'refundAmount', 'docNo', 'referenceDoc', 'poNumber', 'refId', 'note', 'actor', 'createdAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_BUDGET_TRANSACTIONS, headers, transactions);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Vendors
 */
function apiSaveVendors(vendors) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'code', 'name', 'department', 'contactPerson', 'phone', 'email', 'taxId', 'address', 'createdAt', 'updatedAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_VENDORS, headers, vendors);
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Single Vendor (Insert or Update row in Vendors)
 */
function apiSaveVendor(vendorData) {
  try {
    if (!vendorData || typeof vendorData !== 'object') {
      return { success: false, error: 'ข้อมูลผู้ขายไม่ถูกต้อง' };
    }
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'code', 'name', 'department', 'contactPerson', 'phone', 'email', 'taxId', 'address', 'createdAt', 'updatedAt'];
    
    const dept = vendorData.department || 'BOTH';
    if (!vendorData.id) {
      vendorData.id = 'VEND-' + dept + '-' + String(Date.now()).slice(-6);
    }
    vendorData.updatedAt = new Date().toISOString();
    if (!vendorData.createdAt) vendorData.createdAt = new Date().toISOString();

    upsertRecordInSheet(ss, CONFIG.SHEET_VENDORS, headers, vendorData, 'id');
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);

    return { success: true, data: vendorData };
  } catch (err) {
    Logger.log('apiSaveVendor error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Save Storage Locations
 */
function apiSaveStorageLocations(locations) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'name', 'department', 'createdAt', 'updatedAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_STORAGE_LOCATIONS, headers, locations);
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Single Storage Location (Insert or Update row in Storage_Locations)
 */
function apiSaveStorageLocation(locationData) {
  try {
    if (!locationData || typeof locationData !== 'object') {
      return { success: false, error: 'ข้อมูลจุดจัดเก็บไม่ถูกต้อง' };
    }
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'name', 'department', 'createdAt', 'updatedAt'];
    
    const dept = locationData.department || 'PD';
    if (!locationData.id) {
      locationData.id = 'LOC-' + dept + '-' + String(Date.now()).slice(-6);
    }
    locationData.updatedAt = new Date().toISOString();
    if (!locationData.createdAt) locationData.createdAt = new Date().toISOString();

    upsertRecordInSheet(ss, CONFIG.SHEET_STORAGE_LOCATIONS, headers, locationData, 'id');
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);

    return { success: true, data: locationData };
  } catch (err) {
    Logger.log('apiSaveStorageLocation error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Save Usage Units
 */
function apiSaveUsageUnits(units) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'name', 'department', 'dot', 'color', 'badgeBg', 'status', 'createdAt', 'updatedAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_USAGE_UNITS, headers, units);
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Single Usage Unit (Insert or Update row in Usage_Units)
 */
function apiSaveUsageUnit(unitData) {
  try {
    if (!unitData || typeof unitData !== 'object') {
      return { success: false, error: 'ข้อมูลหน่วยเบิกไม่ถูกต้อง' };
    }
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'name', 'department', 'dot', 'color', 'badgeBg', 'status', 'createdAt', 'updatedAt'];
    
    const dept = unitData.department || 'PD';
    if (!unitData.id) {
      unitData.id = 'UNIT-' + dept + '-' + String(Date.now()).slice(-6);
    }
    unitData.status = unitData.status || 'ACTIVE';
    unitData.updatedAt = new Date().toISOString();
    if (!unitData.createdAt) unitData.createdAt = new Date().toISOString();

    upsertRecordInSheet(ss, CONFIG.SHEET_USAGE_UNITS, headers, unitData, 'id');
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);

    return { success: true, data: unitData };
  } catch (err) {
    Logger.log('apiSaveUsageUnit error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Save Departments
 */
function apiSaveDepartments(departments) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'code', 'name', 'nameEn', 'prefix', 'description', 'monthlyBudget', 'isActive', 'color', 'managerName', 'createdAt', 'updatedAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_DEPARTMENTS, headers, departments);
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Single Department (Insert or Update row in Departments)
 */
function apiSaveDepartment(deptData) {
  try {
    if (!deptData || typeof deptData !== 'object') {
      return { success: false, error: 'ข้อมูลแผนกไม่ถูกต้อง' };
    }
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'code', 'name', 'nameEn', 'prefix', 'description', 'monthlyBudget', 'isActive', 'color', 'managerName', 'createdAt', 'updatedAt'];
    
    if (!deptData.id) {
      deptData.id = 'DEPT-' + (deptData.code || String(Date.now()).slice(-4));
    }
    deptData.updatedAt = new Date().toISOString();
    if (!deptData.createdAt) deptData.createdAt = new Date().toISOString();

    upsertRecordInSheet(ss, CONFIG.SHEET_DEPARTMENTS, headers, deptData, 'id');
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);

    return { success: true, data: deptData };
  } catch (err) {
    Logger.log('apiSaveDepartment error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Save Users
 */
function apiSaveUsers(users) {
  try {
    const ss = getOrCreateSpreadsheet();
    writeObjectsToSheet(ss, CONFIG.SHEET_USERS, USER_HEADERS, users, ['allowedDepartments']);
    invalidateCacheKeys(CACHE_KEYS.USERS);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Clean and re-populate Users sheet with 15-column seed data
 */
function apiResetUsers() {
  try {
    const ss = getOrCreateSpreadsheet();
    ensureUsersInitialized(ss);
    return { success: true, message: 'Users sheet cleaned and re-populated with 15-column schema' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save Notifications
 */
function apiSaveNotifications(notifications) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['id', 'type', 'title', 'message', 'priority', 'targetRole', 'targetDepartment', 'docNo', 'link', 'isRead', 'readAt', 'createdAt'];
    writeObjectsToSheet(ss, CONFIG.SHEET_NOTIFICATIONS, headers, notifications);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Log a single audit record with strict 11-column mapping conforming to AUDIT_HEADERS
 */
function apiLogAudit(entry) {
  try {
    if (!entry || typeof entry !== 'object') {
      return { success: false, error: 'Invalid audit entry' };
    }

    const cleanDetails = String(entry.details || '').trim();
    const cleanAction = String(entry.action || '').trim().toUpperCase();
    const cleanDocType = String(entry.docType || 'SYSTEM').trim().toUpperCase();
    const cleanDocNo = String(entry.docNo || '').trim();

    const isSystemEvent = cleanAction.includes('SYSTEM') || cleanAction.includes('INIT') || cleanAction.includes('CACHE') || cleanAction.includes('CLEAR') || cleanDocType === 'SYSTEM';
    const isAuthEvent = cleanAction === 'LOGIN' || cleanAction === 'LOGOUT' || cleanDocType === 'AUTH' || cleanDocType === 'USER';
    const hasDocRef = Boolean(cleanDocNo && cleanDocNo !== '-' && cleanDocType);

    // Garbage Prevention: Must have details or valid doc ref, not empty
    if (!cleanDetails && !hasDocRef && !isSystemEvent && !isAuthEvent) {
      return { success: false, error: 'Skipped empty/garbage audit entry' };
    }
    if (!cleanDetails && !isSystemEvent && !isAuthEvent) {
      return { success: false, error: 'Missing details description' };
    }

    const ss = getOrCreateSpreadsheet();
    const sheet = ensureAuditLogsInitialized(ss);

    const now = new Date();
    const timestamp = entry.timestamp || now.toISOString();
    const id = entry.id || ('AUD-' + now.getTime() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase());

    // Strict 11 columns in exact order
    const row = [
      id,                                                      // 0: id
      timestamp,                                               // 1: timestamp
      cleanAction || 'SYSTEM',                                 // 2: action
      cleanDocType || 'SYSTEM',                                // 3: docType
      cleanDocNo || '-',                                       // 4: docNo
      cleanDetails || (cleanAction + ' ' + (cleanDocNo || '-')), // 5: details
      entry.actorName || entry.actor || 'ระบบอัตโนมัติ (System)', // 6: actorName
      entry.department || 'GENERAL',                           // 7: department
      entry.actorRole || entry.role || 'Staff',                // 8: actorRole
      entry.clientIp || 'CLIENT_DIRECT',                       // 9: clientIp
      entry.clientEnv || 'React Web App'                       // 10: clientEnv
    ];

    sheet.appendRow(row);
    return { success: true, id: id };
  } catch (err) {
    Logger.log('[apiLogAudit] Error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Save Audit Logs (Bulk sync with strict 11-column mapping & garbage filter)
 */
function apiSaveAuditLogs(logs) {
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ensureAuditLogsInitialized(ss);
    if (!Array.isArray(logs) || logs.length === 0) {
      return { success: true };
    }

    const validLogs = logs.filter(function(entry) {
      if (!entry || typeof entry !== 'object') return false;
      const d = String(entry.details || '').trim();
      const a = String(entry.action || '').trim().toUpperCase();
      const doc = String(entry.docNo || '').trim();
      const dt = String(entry.docType || '').trim().toUpperCase();
      const sys = a.includes('SYSTEM') || a.includes('INIT') || a.includes('CACHE') || a.includes('CLEAR') || dt === 'SYSTEM';
      const auth = a === 'LOGIN' || a === 'LOGOUT' || dt === 'AUTH' || dt === 'USER';
      const ref = Boolean(doc && doc !== '-' && dt);
      return Boolean(d && (ref || sys || auth));
    });

    const rows = validLogs.map(function(entry) {
      const now = new Date();
      const timestamp = entry.timestamp || now.toISOString();
      const id = entry.id || ('AUD-' + now.getTime() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase());
      const act = String(entry.action || 'SYSTEM').trim().toUpperCase();
      const dt = String(entry.docType || 'SYSTEM').trim().toUpperCase();
      const doc = String(entry.docNo || '-').trim();
      const d = String(entry.details || (act + ' ' + (doc || '-'))).trim();

      return [
        id,
        timestamp,
        act,
        dt,
        doc,
        d,
        entry.actorName || entry.actor || 'ระบบอัตโนมัติ (System)',
        entry.department || 'GENERAL',
        entry.actorRole || entry.role || 'Staff',
        entry.clientIp || 'CLIENT_DIRECT',
        entry.clientEnv || 'React Web App'
      ];
    });

    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow > 1 && lastCol > 0) {
        sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
      sheet.getRange(2, 1, rows.length, AUDIT_HEADERS.length).setValues(rows);
    }
    return { success: true };
  } catch (err) {
    Logger.log('[apiSaveAuditLogs] Error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Save Signatures
 */
function apiSaveSignatures(signatures) {
  try {
    const ss = getOrCreateSpreadsheet();
    const headers = ['roleId', 'name', 'signatureUrl', 'updatedAt', 'updatedBy'];
    const rows = Object.keys(signatures || {}).map(function(key) {
      return signatures[key];
    });
    writeObjectsToSheet(ss, CONFIG.SHEET_SIGNATURES, headers, rows);
    invalidateCacheKeys(CACHE_KEYS.MASTER_DATA);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Clear transactional records (PRs, POs, Stock movement, Notifications, Audit logs)
 */
function apiClearTransactionalData() {
  try {
    const ss = getOrCreateSpreadsheet();
    apiSavePRs([]);
    apiSavePOs([]);
    apiSaveStockLogs([]);
    apiSaveBudgetTransactions([]);
    apiSaveNotifications([]);
    apiSaveAuditLogs([]);

    // Reset budgets spent and pending to 0
    const rawBudgets = readSheetToObjects(ss, CONFIG.SHEET_BUDGETS, ['historyJson', 'historicalSpentJson']);
    const resetBudgets = {};
    rawBudgets.forEach(function(b) {
      resetBudgets[b.dept] = {
        monthlyBudget: Number(b.monthlyBudget || 0),
        spent: 0,
        pending: 0,
        variance: Number(b.monthlyBudget || 0),
        history: b.historyJson || {},
        historicalSpent: {}
      };
    });
    apiSaveBudgets(resetBudgets);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Clear all CacheService keys — forces GAS to re-read directly from Sheets next request.
 * Call this from the browser console or Admin panel to flush stale cache after sheet edits.
 */
function apiClearAllCache() {
  try {
    const cache = CacheService.getScriptCache();
    const allKeys = Object.values(CACHE_KEYS);
    cache.removeAll(allKeys);
    Logger.log('All GAS CacheService keys cleared: ' + allKeys.join(', '));
    return { success: true, message: 'Cache cleared: ' + allKeys.join(', ') };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Authenticate user with Employee ID / Email / Username and PIN
 */
function apiLogin(identifier, pin) {
  try {
    const ss = getOrCreateSpreadsheet();
    const users = readSheetToObjects(ss, CONFIG.SHEET_USERS, ['allowedDepartments']);
    if (!users || users.length === 0) {
      throw new Error('ไม่พบข้อมูลผู้ใช้งานในระบบ Google Sheets (แท็บ Users ว่างเปล่า)');
    }

    const cleanInput = String(identifier || '').trim().toLowerCase();
    const cleanPin = String(pin || '').trim();

    let foundUser = null;
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const empId = String(getRowField(u, ['employeeId', 'employee_id', 'empId', 'id']) || '').trim();
      const username = String(getRowField(u, ['username', 'user']) || '').trim();
      const email = String(getRowField(u, ['email']) || '').trim();
      const userPin = String(getRowField(u, ['pin', 'password', 'pwd']) || '').trim();

      const empIdLower = empId.toLowerCase();
      const userLower = username.toLowerCase();
      const emailLower = email.toLowerCase();

      // Check identifier: matches employeeId, username, or email
      const idMatches = (empIdLower === cleanInput || userLower === cleanInput || emailLower === cleanInput);

      // Check PIN: matches pin or password (or if empty in sheet, allow 1234/12345)
      const pinMatches = (userPin === cleanPin || (userPin === '' && (cleanPin === '1234' || cleanPin === '12345')));

      if (idMatches && pinMatches) {
        const rawStatus = String(getRowField(u, ['status']) || 'ACTIVE').toUpperCase();
        const rawActive = getRowField(u, ['isActive']);
        const isActive = (rawActive === true || String(rawActive).toUpperCase() === 'TRUE' || rawActive === '' || rawActive === undefined) &&
                         (rawStatus === 'ACTIVE' || rawStatus === '');

        if (!isActive) {
          throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        }

        const nameVal = String(getRowField(u, ['name', 'employeeName']) || '').trim();
        const empNameVal = String(getRowField(u, ['employeeName', 'name']) || '').trim();
        const displayVal = String(getRowField(u, ['displayName']) || '').trim() || nameVal || empNameVal;
        const deptVal = String(getRowField(u, ['department', 'primaryDepartment']) || 'PD').trim();

        let allowedDepts = u.allowedDepartments;
        if (!Array.isArray(allowedDepts) || allowedDepts.length === 0) {
          if (deptVal.indexOf(',') !== -1) {
            allowedDepts = deptVal.split(',').map(function(d) { return d.trim(); });
          } else {
            allowedDepts = [deptVal];
          }
        }

        let canonicalRole = String(getRowField(u, ['canonicalRole']) || '').trim().toUpperCase();
        const roleIdVal = String(getRowField(u, ['roleId', 'role', 'positionKey']) || 'REQUESTER_PD').trim();
        if (!canonicalRole) {
          const upperRole = roleIdVal.toUpperCase();
          if (upperRole.indexOf('ADMIN') !== -1) canonicalRole = 'ADMIN';
          else if (upperRole.indexOf('PURCHAS') !== -1) canonicalRole = 'PURCHASER';
          else if (upperRole.indexOf('WAREHOUSE') !== -1) canonicalRole = 'WAREHOUSE';
          else if (upperRole.indexOf('REVIEW') !== -1 || upperRole.indexOf('ASST') !== -1) canonicalRole = 'REVIEWER';
          else if (upperRole.indexOf('APPROV') !== -1 || upperRole.indexOf('MGR') !== -1) canonicalRole = 'APPROVER';
          else canonicalRole = 'REQUESTER';
        }

        foundUser = {
          id: String(getRowField(u, ['id']) || ('USR-' + (i + 1))),
          employeeId: empId.toUpperCase(),
          name: nameVal || displayVal,
          employeeName: empNameVal || nameVal || displayVal,
          displayName: displayVal,
          department: deptVal,
          departments: allowedDepts,
          primaryDepartment: deptVal,
          allowedDepartments: allowedDepts,
          canonicalRole: canonicalRole,
          roleId: roleIdVal,
          email: email || (empIdLower + '@company.com'),
          username: username || empId,
          level: Number(getRowField(u, ['level']) || 1),
          status: 'ACTIVE',
          isActive: true,
          pictureUrl: String(getRowField(u, ['pictureUrl']) || ''),
          description: String(getRowField(u, ['description']) || ''),
          signature: String(getRowField(u, ['signature']) || ''),
          lastLoginAt: new Date().toISOString()
        };
        break;
      }
    }

    if (!foundUser) {
      throw new Error('รหัสพนักงาน/อีเมล หรือรหัส PIN ไม่ถูกต้อง');
    }

    return {
      success: true,
      user: foundUser
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ'
    };
  }
}

/**
 * Retrieve sanitized user list
 */
function apiGetUsers() {
  try {
    const ss = getOrCreateSpreadsheet();
    const users = readSheetToObjects(ss, CONFIG.SHEET_USERS, ['allowedDepartments']);
    const sanitized = users.map(function(u, i) {
      const empId = String(getRowField(u, ['employeeId', 'employee_id', 'empId', 'id']) || '').trim();
      const username = String(getRowField(u, ['username', 'user']) || '').trim();
      const nameVal = String(getRowField(u, ['name', 'employeeName']) || '').trim();
      const empNameVal = String(getRowField(u, ['employeeName', 'name']) || '').trim();
      const displayVal = String(getRowField(u, ['displayName']) || '').trim() || nameVal || empNameVal;
      const deptVal = String(getRowField(u, ['department', 'primaryDepartment']) || 'PD').trim();
      const roleIdVal = String(getRowField(u, ['roleId', 'role', 'positionKey']) || 'REQUESTER_PD').trim();
      let canonicalRole = String(getRowField(u, ['canonicalRole']) || '').trim().toUpperCase();
      if (!canonicalRole) {
        const upperRole = roleIdVal.toUpperCase();
        if (upperRole.indexOf('ADMIN') !== -1) canonicalRole = 'ADMIN';
        else if (upperRole.indexOf('PURCHAS') !== -1) canonicalRole = 'PURCHASER';
        else if (upperRole.indexOf('WAREHOUSE') !== -1) canonicalRole = 'WAREHOUSE';
        else if (upperRole.indexOf('REVIEW') !== -1 || upperRole.indexOf('ASST') !== -1) canonicalRole = 'REVIEWER';
        else if (upperRole.indexOf('APPROV') !== -1 || upperRole.indexOf('MGR') !== -1) canonicalRole = 'APPROVER';
        else canonicalRole = 'REQUESTER';
      }

      return {
        id: String(getRowField(u, ['id']) || ('USR-' + (i + 1))),
        employeeId: empId.toUpperCase(),
        username: username || empId,
        name: nameVal || displayVal,
        employeeName: nameVal || displayVal,
        displayName: nameVal || displayVal,
        department: deptVal,
        departments: u.allowedDepartments || [deptVal],
        primaryDepartment: deptVal,
        allowedDepartments: u.allowedDepartments || [deptVal],
        canonicalRole: canonicalRole,
        roleId: roleIdVal,
        level: Number(getRowField(u, ['level']) || 1),
        status: String(getRowField(u, ['status']) || 'ACTIVE'),
        isActive: true,
        description: String(getRowField(u, ['description']) || ''),
        signature: String(getRowField(u, ['signature']) || '')
      };
    });
    return { success: true, users: sanitized };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieve departments
 */
function apiGetDepartments() {
  try {
    const ss = getOrCreateSpreadsheet();
    const depts = readSheetToObjects(ss, CONFIG.SHEET_DEPARTMENTS);
    return { success: true, departments: depts };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Upload Base64 file into structured Google Drive folder
 */
function apiUploadFile(payload) {
  try {
    if (!payload || !payload.base64Data) {
      throw new Error('ไม่พบข้อมูลไฟล์ Base64 (base64Data is required)');
    }

    const mimeType = payload.mimeType || 'image/jpeg';
    const fileName = payload.fileName || ('upload_' + new Date().getTime() + '.jpg');
    const category = payload.category || 'PR';
    const poNumber = payload.poNumber || '';

    const target = resolveTargetDriveFolder(category, poNumber);
    const decodedBytes = Utilities.base64Decode(payload.base64Data);
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    const file = target.folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log('Could not set link sharing: ' + shareErr.message);
    }

    const fileId = file.getId();
    const fileUrl = file.getUrl();
    const timestamp = new Date().toISOString();

    const ss = getOrCreateSpreadsheet();
    const fileHeaders = ['fileId', 'fileName', 'mimeType', 'category', 'poNumber', 'folderPath', 'fileUrl', 'uploadedAt'];
    const filesSheet = getOrCreateSheetWithHeaders(ss, CONFIG.SHEET_FILES, fileHeaders);
    filesSheet.appendRow([fileId, fileName, mimeType, category, poNumber, target.path, fileUrl, timestamp]);

    return {
      success: true,
      fileId: fileId,
      fileUrl: fileUrl,
      fileName: fileName,
      mimeType: mimeType,
      folderPath: target.path,
      uploadedAt: timestamp
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'เกิดข้อผิดพลาดในการบันทึกไฟล์ลง Google Drive'
    };
  }
}
