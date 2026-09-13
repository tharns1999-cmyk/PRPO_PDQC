/**
 * Google Apps Script Backend for PR-PO-Stock-System
 * 
 * Provides backend services for:
 * 1. Lightweight Authentication (apiLogin, apiGetUsers, apiGetDepartments)
 * 2. Google Drive Hierarchical Document & Evidence Storage (apiUploadFile)
 * 3. Google Sheets Datastore Handlers (Users, Departments, Files)
 */

const CONFIG = {
  ROOT_FOLDER_NAME: '[ERP] PR-PO-Stock-System',
  SHEET_USERS: 'Users',
  SHEET_DEPARTMENTS: 'Departments',
  SHEET_FILES: 'Files'
};

/**
 * Web App entrypoint
 */
function doGet(e) {
  return HtmlService.createHtmlOutput('<h3>PR-PO-Stock-System GAS API Bridge is Running</h3><p>Status: Active</p>')
    .setTitle('PR-PO System API');
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
 * Resolves the target folder path inside the structured Drive hierarchy:
 * [ERP] PR-PO-Stock-System/
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
  }

  // Root -> Category
  const catFolder = getOrCreateChildFolder(root, categoryFolderName);
  // Category -> YYYY-MM
  const monthFolder = getOrCreateChildFolder(catFolder, dateKey);

  // If GRN or Claim and PO number is provided, create/route into {PO_NUMBER} subfolder
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
 * Gets or initializes a sheet in the active spreadsheet
 */
function getOrCreateSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
 * Seed initial users if sheet is freshly created
 */
function ensureUsersInitialized() {
  const headers = ['id', 'employeeId', 'email', 'pin', 'name', 'department', 'canonicalRole', 'roleId', 'status', 'isActive'];
  const sheet = getOrCreateSheet(CONFIG.SHEET_USERS, headers);
  if (sheet.getLastRow() <= 1) {
    const seed = [
      ['USR-0001', 'EMP-PD-001', 'wichai@company.com', '1234', 'คุณวิชัย สุขใจ (PD)', 'PD', 'REQUESTER', 'REQUESTER_PD', 'ACTIVE', true],
      ['USR-0002', 'EMP-QC-001', 'somying@company.com', '1234', 'คุณสมหญิง รักดี (QC)', 'QC', 'REQUESTER', 'REQUESTER_QC', 'ACTIVE', true],
      ['USR-0003', 'EMP-MGR-001', 'somchai@company.com', '1234', 'คุณสมชาย (Asst. Mgr)', 'PD, QC', 'REVIEWER', 'ASST_MANAGER', 'ACTIVE', true],
      ['USR-0004', 'EMP-PUR-001', 'nat@company.com', '1234', 'คุณนัท จัดซื้อ (Purchaser)', 'ALL', 'PURCHASER', 'ONLINE_PURCHASER', 'ACTIVE', true],
      ['USR-0005', 'EMP-MGR-002', 'prasert@company.com', '1234', 'คุณประเสริฐ ยิ่งยง (Plant Manager)', 'ALL', 'APPROVER', 'PLANT_MANAGER', 'ACTIVE', true],
      ['USR-0006', 'EMP-SYS-999', 'admin@company.com', '9999', 'ผู้ดูแลระบบ (System Admin)', 'ALL', 'ADMIN', 'ADMIN', 'ACTIVE', true]
    ];
    seed.forEach(function(row) {
      sheet.appendRow(row);
    });
  }
}

/**
 * API: Authenticate user by Employee ID / Email + PIN
 * 
 * @param {string} identifier Employee ID, Email, or Username
 * @param {string} pin 4-6 digit security PIN
 * @returns {Object} Sanitized user profile without PIN
 */
function apiLogin(identifier, pin) {
  try {
    ensureUsersInitialized();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_USERS);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('ไม่พบข้อมูลผู้ใช้งานในระบบ');
    }

    const headers = data[0].map(function(h) { return String(h).trim(); });
    const idIndex = headers.indexOf('id');
    const empIdIndex = headers.indexOf('employeeId');
    const emailIndex = headers.indexOf('email');
    const pinIndex = headers.indexOf('pin');
    const nameIndex = headers.indexOf('name');
    const deptIndex = headers.indexOf('department');
    const canonicalIndex = headers.indexOf('canonicalRole');
    const roleIdIndex = headers.indexOf('roleId');
    const statusIndex = headers.indexOf('status');
    const activeIndex = headers.indexOf('isActive');

    const cleanInput = String(identifier || '').trim().toLowerCase();
    const cleanPin = String(pin || '').trim();

    let foundUser = null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const empId = String(row[empIdIndex] || '').toLowerCase().trim();
      const email = String(row[emailIndex] || '').toLowerCase().trim();
      const userPin = String(row[pinIndex] || '').trim();

      if ((empId === cleanInput || email === cleanInput) && userPin === cleanPin) {
        const isActive = (activeIndex !== -1 ? (row[activeIndex] === true || String(row[activeIndex]).toUpperCase() === 'TRUE') : true) &&
                         (statusIndex !== -1 ? String(row[statusIndex]).toUpperCase() === 'ACTIVE' : true);

        if (!isActive) {
          throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        }

        var deptVal = row[deptIndex] || 'PD';
        var deptsVal = String(deptVal).indexOf(',') !== -1 
          ? String(deptVal).split(',').map(function(d) { return d.trim(); }) 
          : [deptVal];

        foundUser = {
          id: row[idIndex] || ('USR-' + i),
          employeeId: row[empIdIndex] || '',
          email: row[emailIndex] || '',
          name: row[nameIndex] || '',
          department: deptVal,
          departments: deptsVal,
          canonicalRole: row[canonicalIndex] || 'REQUESTER',
          roleId: row[roleIdIndex] || 'REQUESTER_PD',
          status: 'ACTIVE',
          isActive: true,
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
 * API: Retrieve sanitized user list (no PINs)
 */
function apiGetUsers() {
  try {
    ensureUsersInitialized();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(function(h) { return String(h).trim(); });
    const users = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userObj = {};
      headers.forEach(function(header, idx) {
        if (header !== 'pin' && header !== 'password') {
          userObj[header] = row[idx];
        }
      });
      users.push(userObj);
    }

    return { success: true, users: users };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * API: Retrieve departments
 */
function apiGetDepartments() {
  const headers = ['id', 'code', 'name'];
  const sheet = getOrCreateSheet(CONFIG.SHEET_DEPARTMENTS, headers);
  if (sheet.getLastRow() <= 1) {
    sheet.appendRow(['PD', 'PD', 'ฝ่ายผลิต (Production Department)']);
    sheet.appendRow(['QC', 'QC', 'ฝ่ายควบคุมคุณภาพ (Quality Control)']);
  }
  const data = sheet.getDataRange().getValues();
  const depts = [];
  for (let i = 1; i < data.length; i++) {
    depts.push({
      id: data[i][0],
      code: data[i][1],
      name: data[i][2]
    });
  }
  return { success: true, departments: depts };
}

/**
 * API: Upload Base64 file into structured Google Drive folder
 * 
 * @param {Object} payload
 * @param {string} payload.base64Data Pure Base64 encoded string
 * @param {string} payload.mimeType MIME type (e.g. image/jpeg, application/pdf)
 * @param {string} payload.fileName Target file name
 * @param {string} payload.category 'PR' | 'PO' | 'GRN' | 'CLAIM'
 * @param {string} [payload.poNumber] Relevant Purchase Order number
 * @param {string} [payload.description] Optional description
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

    // Resolve hierarchical folder
    const target = resolveTargetDriveFolder(category, poNumber);

    // Decode Base64 data
    const decodedBytes = Utilities.base64Decode(payload.base64Data);
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // Create file in target Drive folder
    const file = target.folder.createFile(blob);

    // Set permission to anyone with link can view
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log('Could not set link sharing: ' + shareErr.message);
    }

    const fileId = file.getId();
    const fileUrl = file.getUrl();
    const timestamp = new Date().toISOString();

    // Log file entry to Google Sheets 'Files'
    const filesSheet = getOrCreateSheet(CONFIG.SHEET_FILES, [
      'fileId', 'fileName', 'mimeType', 'category', 'poNumber', 'folderPath', 'fileUrl', 'uploadedAt'
    ]);
    filesSheet.appendRow([
      fileId, fileName, mimeType, category, poNumber, target.path, fileUrl, timestamp
    ]);

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
