/**
 * @file Initializer.gs
 * @description Idempotent Production Initializer for Google Sheets & Google Drive
 * Automatically sets up all 17 schema tabs, header columns with enterprise styling,
 * Drive folder hierarchies, and system configuration without altering existing data.
 * @version 2.0.0
 */

/**
 * Master Schema Definition for All 17 Tabs
 */
const SCHEMA_DEFINITIONS = Object.freeze({
  [SHEET_NAMES.PRODUCTS]: [
    'id', 'code', 'name', 'category', 'department', 'purchaseUnit', 'stockUnit', 
    'conversionRate', 'price', 'stockBalance', 'reorderPoint', 'leadTimeDays', 
    'locationId', 'locationName', 'status', 'isActive', 'updatedAt'
  ],
  [SHEET_NAMES.VENDORS]: [
    'id', 'code', 'name', 'department', 'contactPerson', 'phone', 'email', 
    'taxId', 'address', 'status', 'isActive', 'updatedAt'
  ],
  [SHEET_NAMES.STORAGE_LOCATIONS]: [
    'id', 'name', 'department', 'isActive', 'updatedAt'
  ],
  [SHEET_NAMES.USAGE_UNITS]: [
    'id', 'name', 'department', 'status', 'isActive', 'updatedAt'
  ],
  [SHEET_NAMES.DEPARTMENTS]: [
    'id', 'code', 'name', 'isActive', 'createdAt'
  ],
  [SHEET_NAMES.USERS]: [
    'id', 'employeeId', 'username', 'password', 'email', 'name', 'employeeName', 'displayName', 'position',
    'department', 'primaryDepartment', 'departments', 'allowedDepartments', 
    'roleId', 'canonicalRole', 'level', 'status', 'isActive', 'description', 'signature', 'updatedAt'
  ],
  [SHEET_NAMES.SIGNATURES]: [
    'roleId', 'name', 'signatureUrl', 'updatedAt', 'updatedBy'
  ],
  [SHEET_NAMES.PRS]: [
    'id', 'prNo', 'department', 'requestedBy', 'requesterSignature', 'status', 
    'items', 'subtotal', 'totalAmount', 'createdAt', 'updatedAt', 'reviewedBy', 
    'reviewedAt', 'approvedBy', 'approvedAt', 'poNumber', 'note'
  ],
  [SHEET_NAMES.PR_ITEMS]: [
    'id', 'prId', 'prNo', 'productId', 'productCode', 'name', 
    'purchaseUnit', 'stockUnit', 'conversionRate', 'qty', 'unit', 
    'price', 'totalPrice', 'department', 'notes', 'status', 
    'imageUrl', 'fileId', 'driveUrl', 'images', 'attachments',
    'createdAt', 'updatedAt'
  ],
  [SHEET_NAMES.POS]: [
    'id', 'poNo', 'prId', 'prNo', 'department', 'vendorName', 'vendorId', 
    'purchaseChannel', 'issueDate', 'orderDate', 'status', 'workflowStatus', 
    'items', 'subtotal', 'vat', 'grandTotal', 'isOnline', 'isClosed', 
    'claimStatus', 'ngItems', 'reviewedBy', 'reviewedAt', 'approvedBy', 
    'approvedAt', 'receivedBy', 'receiverName', 'receiverId', 'receivedAt', 
    'receiverRole', 'receiverSignature', 'receivingInfo', 'activityLog', 
    'createdAt', 'completedAt', 'updatedAt'
  ],
  [SHEET_NAMES.STOCK_LOGS]: [
    'id', 'timestamp', 'date', 'productId', 'productCode', 'name', 'type', 
    'documentNo', 'grnNumber', 'poNumber', 'prNo', 'qty', 'unit', 'conversionRate', 
    'unitPrice', 'totalPrice', 'balanceAfter', 'actorName', 'department', 'locationId', 'notes'
  ],
  [SHEET_NAMES.BUDGET_TRANSACTIONS]: [
    'id', 'date', 'createdAt', 'transactionId', 'period', 'type', 'actionType', 
    'dept', 'amount', 'refundAmount', 'creditAmount', 'docType', 'docNo', 
    'poNumber', 'actorName', 'actorRole', 'note', 'timestamp'
  ],
  [SHEET_NAMES.AUDIT_LOGS]: [
    'id', 'timestamp', 'action', 'module', 'targetRef', 'summary', 
    'actor', 'changes', 'createdAt'
  ],
  [SHEET_NAMES.NOTIFICATIONS]: [
    'id', 'type', 'title', 'message', 'targetRole', 'poNumber', 'prNumber', 'isRead', 'createdAt'
  ],
  [SHEET_NAMES.BUDGETS]: [
    'dept', 'monthlyBudget', 'spent', 'pending', 'variance', 'year', 'month', 
    'historicalSpent', 'history', 'refundCredits', 'updatedAt'
  ],
  [SHEET_NAMES.PR_COUNTERS]: [
    'dept', 'docType', 'lastNumber', 'prefix', 'year', 'updatedAt'
  ],
  [SHEET_NAMES.APP_CONFIG]: [
    'key', 'value', 'description', 'updatedAt'
  ],
  [SHEET_NAMES.ATTACHMENTS]: [
    'id', 'fileId', 'fileName', 'mimeType', 'fileSize', 'category', 'poNumber', 
    'docNo', 'docType', 'viewUrl', 'directUrl', 'lh3Url', 'downloadUrl', 'folderPath', 'uploadedBy', 'uploadedAt'
  ]
});

/**
 * Styling constants for enterprise look and feel
 */
const HEADER_STYLE = Object.freeze({
  BACKGROUND_COLOR: '#1e293b', // Slate 800
  FONT_COLOR: '#ffffff',
  FONT_FAMILY: 'Prompt, Segoe UI, sans-serif',
  FONT_SIZE: 10,
  FONT_WEIGHT: 'bold'
});

/**
 * Main Initialization Function.
 * Safely inspects the spreadsheet, creates missing sheets and header rows,
 * establishes Drive folder structures, and prepares default configuration.
 * Strictly IDEMPOTENT: Never overwrites or destroys existing data rows.
 * 
 * @returns {Object} Audit report of the initialization run
 */
function initializeSystem() {
  console.info('[Initializer] Starting PRPO_PDQC system initialization...');
  const ss = getSpreadsheet();
  const report = {
    timestamp: new Date().toISOString(),
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheetsCreated: [],
    sheetsExisted: [],
    headersFormatted: [],
    driveFoldersCreated: [],
    driveFoldersExisted: []
  };

  // 1. Ensure all 17 Sheet Tabs exist with headers
  Object.keys(SCHEMA_DEFINITIONS).forEach(sheetName => {
    const expectedHeaders = SCHEMA_DEFINITIONS[sheetName];
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      if (!Array.isArray(report.sheetsCreated)) report.sheetsCreated = [];
      report.sheetsCreated.push(sheetName);
      console.info(`[Initializer] Created missing sheet: "${sheetName}"`);
    } else {
      if (!Array.isArray(report.sheetsExisted)) report.sheetsExisted = [];
      report.sheetsExisted.push(sheetName);
    }

    // Check header row
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      // Empty sheet: write header row
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      formatHeaderRow(sheet, expectedHeaders.length);
      if (!Array.isArray(report.headersFormatted)) report.headersFormatted = [];
      report.headersFormatted.push(sheetName);
      console.info(`[Initializer] Added and formatted headers for: "${sheetName}"`);
    } else {
      // Sheet already has data: verify if any new columns need to be appended to header row
      const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
      const missingHeaders = expectedHeaders.filter(h => !existingHeaders.includes(h));

      if (missingHeaders.length > 0) {
        const startCol = lastCol + 1;
        sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
        formatHeaderRange(sheet, 1, startCol, missingHeaders.length);
        console.info(`[Initializer] Appended ${missingHeaders.length} missing columns to "${sheetName}": ${missingHeaders.join(', ')}`);
      }
    }
  });

  // 2. Remove default "Sheet1" if redundant
  try {
    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่นงาน1');
    if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() <= 1) {
      ss.deleteSheet(defaultSheet);
      console.info('[Initializer] Removed empty default "Sheet1".');
    }
  } catch (e) {
    // Ignore if Sheet1 is active or cannot be deleted
  }

  // 3. Initialize Drive Folders
  try {
    const root = getRootDriveFolder();
    console.info(`[Initializer] Root Drive folder verified: "${root.getName()}" (${root.getId()})`);

    const standardCategories = [
      DRIVE_CATEGORIES.PR,
      DRIVE_CATEGORIES.PO,
      DRIVE_CATEGORIES.GRN,
      DRIVE_CATEGORIES.CLAIM,
      DRIVE_CATEGORIES.BACKUPS
    ];

    standardCategories.forEach(catName => {
      const existing = root.getFoldersByName(catName);
      if (existing.hasNext()) {
        if (!Array.isArray(report.driveFoldersExisted)) report.driveFoldersExisted = [];
        report.driveFoldersExisted.push(catName);
      } else {
        root.createFolder(catName);
        if (!Array.isArray(report.driveFoldersCreated)) report.driveFoldersCreated = [];
        report.driveFoldersCreated.push(catName);
        console.info(`[Initializer] Created Drive category folder: "${catName}"`);
      }
    });
  } catch (driveErr) {
    console.warn(`[Initializer] Drive setup note: ${driveErr.message}`);
  }

  // 4. Seed baseline Master Data & Products (20 items: 10 PD, 10 QC)
  try {
    if (typeof seedProductsData === 'function') {
      report.productsSeeded = seedProductsData();
      console.info(`[Initializer] Seeded products: ${report.productsSeeded}`);
    }
  } catch (seedErr) {
    console.warn(`[Initializer] Products seed note: ${seedErr.message}`);
  }

  // 5. Purge ALL department entity and migrate user departments
  try {
    if (typeof purgeAllDepartmentEntity === 'function') {
      report.purgeAllMigration = purgeAllDepartmentEntity();
      console.info('[Initializer] Purge ALL department migration verified.');
    }
  } catch (purgeErr) {
    console.warn(`[Initializer] Purge ALL migration note: ${purgeErr.message}`);
  }

  // 6. Mark system initialized in properties
  setScriptProperty(CONFIG.PROPERTY_KEYS.SYSTEM_INITIALIZED, 'true');

  console.info('[Initializer] PRPO_PDQC system initialization completed successfully.');
  return report;
}

/**
 * Formats header row with enterprise styling (dark background, white text, bold, freeze row 1).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} numColumns
 */
function formatHeaderRow(sheet, numColumns) {
  if (numColumns <= 0) return;
  const headerRange = sheet.getRange(1, 1, 1, numColumns);
  headerRange
    .setBackground(HEADER_STYLE.BACKGROUND_COLOR)
    .setFontColor(HEADER_STYLE.FONT_COLOR)
    .setFontWeight(HEADER_STYLE.FONT_WEIGHT)
    .setFontSize(HEADER_STYLE.FONT_SIZE)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
}

/**
 * Formats a range of newly appended header cells.
 */
function formatHeaderRange(sheet, row, startCol, numCols) {
  const range = sheet.getRange(row, startCol, 1, numCols);
  range
    .setBackground(HEADER_STYLE.BACKGROUND_COLOR)
    .setFontColor(HEADER_STYLE.FONT_COLOR)
    .setFontWeight(HEADER_STYLE.FONT_WEIGHT)
    .setFontSize(HEADER_STYLE.FONT_SIZE)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}

var _prItemsSheetEnsured = false;
var _attachmentsSheetEnsured = false;

/**
 * Ensures PRItems sheet tab exists with schema headers and dynamic column sync.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensurePRItemsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.PR_ITEMS);
  if (_prItemsSheetEnsured && sheet) {
    return sheet;
  }
  const targetHeaders = SCHEMA_DEFINITIONS[SHEET_NAMES.PR_ITEMS];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.PR_ITEMS);
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    formatHeaderRow(sheet, targetHeaders.length);
  } else {
    try {
      const currentHeaders = getSheetHeaders(sheet);
      const missingHeaders = targetHeaders.filter(h => !currentHeaders.includes(h));
      if (missingHeaders.length > 0) {
        const newHeaders = currentHeaders.concat(missingHeaders);
        sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        formatHeaderRow(sheet, newHeaders.length);
      }
    } catch (e) {
      console.warn('[ensurePRItemsSheet] Header sync warning: ' + e.message);
    }
  }
  _prItemsSheetEnsured = true;
  return sheet;
}

/**
 * Ensures Attachments sheet tab exists with schema headers and dynamic column sync.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureAttachmentsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.ATTACHMENTS);
  if (_attachmentsSheetEnsured && sheet) {
    return sheet;
  }
  const targetHeaders = SCHEMA_DEFINITIONS[SHEET_NAMES.ATTACHMENTS];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.ATTACHMENTS);
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    formatHeaderRow(sheet, targetHeaders.length);
  } else {
    try {
      const currentHeaders = getSheetHeaders(sheet);
      const missingHeaders = targetHeaders.filter(h => !currentHeaders.includes(h));
      if (missingHeaders.length > 0) {
        const newHeaders = currentHeaders.concat(missingHeaders);
        sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        formatHeaderRow(sheet, newHeaders.length);
      }
    } catch (e) {
      console.warn('[ensureAttachmentsSheet] Header sync warning: ' + e.message);
    }
  }
  _attachmentsSheetEnsured = true;
  return sheet;
}

