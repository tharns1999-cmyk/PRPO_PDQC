/**
 * @file Code.gs
 * @description Main Entry Point and Public RPC API Controller for PRPO_PDQC
 * Dispatches google.script.run requests with authentication, two-tier authorization (RBAC),
 * transactional locking, and standardized response envelope wrapping.
 * @version 2.0.0
 */

/**
 * HTTP GET Entry Point for Standalone Web App.
 * Serves the single-file HTML bundle built by Vite.
 * 
 * @param {Object} e HTTP Event object
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  try {
    const output = HtmlService.createHtmlOutputFromFile('index')
      .setTitle(CONFIG.DEFAULTS.APP_TITLE)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    return output;
  } catch (err) {
    // If index.html is not yet uploaded/bundled, render helpful diagnostic page
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${CONFIG.DEFAULTS.APP_TITLE}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; display: flex; justify-content: center; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 600px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h2 { color: #38bdf8; margin-top: 0; }
            p { line-height: 1.6; color: #94a3b8; }
            .badge { background: #0369a1; color: #e0f2fe; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; }
            .btn { background: #2563eb; color: #fff; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 16px; }
            .btn:hover { background: #1d4ed8; }
            code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #f43f5e; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">GAS BACKEND ACTIVE</span>
            <h2>${CONFIG.DEFAULTS.APP_TITLE}</h2>
            <p>ระบบหลังบ้าน Google Apps Script ทำงานเรียบร้อยแล้ว พร้อมรับการเชื่อมต่อจาก Frontend Single HTML Bundle</p>
            <p><strong>ผู้เข้าใช้งานปัจจุบัน:</strong> <code>${getCurrentUserEmail() || 'Unidentified'}</code></p>
            <p><strong>สถานะ:</strong> รอการ Build ไฟล์ <code>dist/index.html</code> และ Deploy ขึ้น GAS ผ่าน clasp หรือ Script Editor</p>
            <a href="javascript:void(0)" onclick="google.script.run.withSuccessHandler(alert).apiGetSystemStatus()" class="btn">ทดสอบระบบ (Diagnostic Ping)</a>
          </div>
        </body>
      </html>
    `).setTitle(CONFIG.DEFAULTS.APP_TITLE);
  }
}

/**
 * Universal RPC Invoker Wrapper.
 * Catches all uncaught exceptions and formats into standard API response contract.
 * 
 * @param {Function} handler The business logic function to execute
 * @param {string} actionName Name of the action for audit and logging
 * @returns {Object} Standard API Response { success, data, error, message }
 */
function handleApiRequest(handler, actionName = 'Action') {
  try {
    const data = handler();
    return apiSuccess(data, `${actionName} completed successfully`);
  } catch (err) {
    console.error(`[API Controller] Error in "${actionName}": ${err.message}`);
    const errorCode = err.message.includes(':') ? err.message.split(':')[0].trim() : 'INTERNAL_SERVER_ERROR';
    const errorMessage = err.message.includes(':') ? err.message.split(':').slice(1).join(':').trim() : err.message;
    return apiError(errorCode, errorMessage);
  }
}

// =========================================================================
// 1. AUTHENTICATION & USER PROFILE RPCs
// =========================================================================

/**
 * Returns authenticated user profile and capability matrix.
 */
function apiGetCurrentUser() {
  return handleApiRequest(function() {
    return requireAuth();
  }, 'GetCurrentUser');
}

/**
 * Authenticates user credentials with username and password against Users sheet.
 * Public endpoint for frontend login.
 * 
 * @param {string} username Username or Employee ID
 * @param {string} password Password
 * @returns {Object} Hydrated user profile
 */
function apiLogin(username, password) {
  return handleApiRequest(function() {
    return authenticateUserByPassword(username, password);
  }, 'Login');
}

/**
 * Retrieves all registered users from Users sheet.
 */
function apiGetUsers() {
  return handleApiRequest(function() {
    return batchReadRecords(SHEET_NAMES.USERS);
  }, 'GetUsers');
}

/**
 * Upserts a user account (Admin only).
 */
function apiUpsertUser(userObj) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN]);
    userObj.updatedAt = new Date().toISOString();
    return upsertRecordById(SHEET_NAMES.USERS, 'id', userObj);
  }, 'UpsertUser');
}

/**
 * Deletes a user account (Admin only).
 */
function apiDeleteUser(userId) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN]);
    return deleteRecordById(SHEET_NAMES.USERS, 'id', userId);
  }, 'DeleteUser');
}

// =========================================================================
// 2. MASTER DATA RPCs (Products, Vendors, Locations, Units, Depts)
// =========================================================================

/**
 * Retrieves all products.
 */
function apiGetProducts() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.PRODUCTS);
  }, 'GetProducts');
}

/**
 * Upserts a product.
 */
function apiUpsertProduct(productObj) {
  return handleApiRequest(function() {
    requireAuth();
    productObj.updatedAt = new Date().toISOString();
    return upsertRecordById(SHEET_NAMES.PRODUCTS, 'id', productObj);
  }, 'UpsertProduct');
}

/**
 * Deletes a product by ID.
 */
function apiDeleteProduct(productId) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.PLANT_MANAGER]);
    return deleteRecordById(SHEET_NAMES.PRODUCTS, 'id', productId);
  }, 'DeleteProduct');
}

/**
 * Retrieves all vendors.
 */
function apiGetVendors() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.VENDORS);
  }, 'GetVendors');
}

/**
 * Upserts a vendor record.
 */
function apiUpsertVendor(vendorObj) {
  return handleApiRequest(function() {
    requireAuth();
    vendorObj.updatedAt = new Date().toISOString();
    return upsertRecordById(SHEET_NAMES.VENDORS, 'id', vendorObj);
  }, 'UpsertVendor');
}

/**
 * Storage Locations RPCs
 */
function apiGetStorageLocations() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.STORAGE_LOCATIONS);
  }, 'GetStorageLocations');
}

function apiUpsertStorageLocation(locationObj) {
  return handleApiRequest(function() {
    requireAuth();
    locationObj.updatedAt = new Date().toISOString();
    return upsertRecordById(SHEET_NAMES.STORAGE_LOCATIONS, 'id', locationObj);
  }, 'UpsertStorageLocation');
}

function apiDeleteStorageLocation(locationId) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN]);
    return deleteRecordById(SHEET_NAMES.STORAGE_LOCATIONS, 'id', locationId);
  }, 'DeleteStorageLocation');
}

/**
 * Usage Units RPCs
 */
function apiGetUsageUnits() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.USAGE_UNITS);
  }, 'GetUsageUnits');
}

function apiUpsertUsageUnit(unitObj) {
  return handleApiRequest(function() {
    requireAuth();
    unitObj.updatedAt = new Date().toISOString();
    return upsertRecordById(SHEET_NAMES.USAGE_UNITS, 'id', unitObj);
  }, 'UpsertUsageUnit');
}

function apiDeleteUsageUnit(unitId) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN]);
    return deleteRecordById(SHEET_NAMES.USAGE_UNITS, 'id', unitId);
  }, 'DeleteUsageUnit');
}

/**
 * Departments RPCs
 */
function apiGetDepartments() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.DEPARTMENTS);
  }, 'GetDepartments');
}

function apiUpsertDepartment(deptObj) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN]);
    return upsertRecordById(SHEET_NAMES.DEPARTMENTS, 'code', deptObj);
  }, 'UpsertDepartment');
}

/**
 * Signatures RPCs
 */
function apiGetSignatures() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.SIGNATURES);
  }, 'GetSignatures');
}

function apiSaveSignature(roleId, signatureUrl) {
  return handleApiRequest(function() {
    const user = requireAuth();
    const record = {
      roleId: roleId,
      name: user.name,
      signatureUrl: signatureUrl,
      updatedAt: new Date().toISOString(),
      updatedBy: user.email
    };
    return upsertRecordById(SHEET_NAMES.SIGNATURES, 'roleId', record);
  }, 'SaveSignature');
}

// =========================================================================
// 3. PURCHASE REQUEST (PR) RPCs
// =========================================================================

/**
 * Retrieves all PRs.
 */
function apiGetPRs() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.PRS);
  }, 'GetPRs');
}

/**
 * Creates a new PR with thread-safe sequential PR Number generation.
 */
function apiCreatePR(prObj) {
  return handleApiRequest(function() {
    const user = requirePermission('PR_CREATION');
    const dept = prObj.department || user.primaryDepartment || 'PD';
    requireDepartment(dept);

    // Generate unique sequential number inside ScriptLock
    const seqPrNo = generateSequentialDocId(dept, 'PR');

    prObj.id = prObj.id || `PR-${Date.now()}`;
    prObj.prNo = seqPrNo;
    prObj.department = dept;
    prObj.requestedBy = prObj.requestedBy || user.name;
    prObj.status = prObj.status || 'SUBMITTED';
    prObj.createdAt = prObj.createdAt || new Date().toISOString();
    prObj.updatedAt = new Date().toISOString();

    return appendRecord(SHEET_NAMES.PRS, prObj);
  }, 'CreatePR');
}

/**
 * Updates or reviews an existing PR.
 */
function apiSavePR(prObj) {
  return handleApiRequest(function() {
    requireAuth();
    prObj.updatedAt = new Date().toISOString();
    return upsertRecordById(SHEET_NAMES.PRS, 'id', prObj);
  }, 'SavePR');
}

// =========================================================================
// 4. PURCHASE ORDER (PO) RPCs
// =========================================================================

/**
 * Retrieves all POs.
 */
function apiGetPOs() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.POS);
  }, 'GetPOs');
}

/**
 * Creates a new PO with thread-safe sequential PO number.
 */
function apiCreatePO(poObj) {
  return handleApiRequest(function() {
    requirePermission('APPROVAL');
    const dept = poObj.department || 'PD';

    // Generate sequential PO number with LockService
    const seqPoNo = generateSequentialDocId(dept, 'PO');

    poObj.id = poObj.id || `PO-${Date.now()}`;
    poObj.poNo = seqPoNo;
    poObj.department = dept;
    poObj.createdAt = poObj.createdAt || new Date().toISOString();
    poObj.updatedAt = new Date().toISOString();

    return appendRecord(SHEET_NAMES.POS, poObj);
  }, 'CreatePO');
}

/**
 * Updates an existing PO record.
 */
function apiSavePO(poObj) {
  return handleApiRequest(function() {
    requireAuth();
    poObj.updatedAt = new Date().toISOString();
    return upsertRecordById(SHEET_NAMES.POS, 'id', poObj);
  }, 'SavePO');
}

/**
 * Finalizes PO, updates PR status, and records audit trail atomically.
 */
function apiFinalizePO(poId, poData) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.APPROVER, SYSTEM_ROLES.PLANT_MANAGER, SYSTEM_ROLES.ADMIN]);

    return withScriptLock(function() {
      poData.id = poId;
      poData.updatedAt = new Date().toISOString();
      const updated = upsertRecordById(SHEET_NAMES.POS, 'id', poData);

      // If associated with PR, mark PR as APPROVED
      if (poData.prId || poData.prNo) {
        const prKey = poData.prId ? 'id' : 'prNo';
        const prVal = poData.prId || poData.prNo;
        const prs = batchReadRecords(SHEET_NAMES.PRS);
        const targetPr = prs.find(p => String(p[prKey]) === String(prVal));
        if (targetPr) {
          targetPr.status = 'APPROVED';
          targetPr.poNumber = poData.poNo;
          targetPr.approvedBy = poData.approvedBy;
          targetPr.approvedAt = poData.approvedAt || new Date().toISOString();
          upsertRecordById(SHEET_NAMES.PRS, 'id', targetPr);
        }
      }

      return updated;
    }, CONFIG.DEFAULTS.SCRIPT_LOCK_TIMEOUT_MS, `FinalizePO_${poId}`);
  }, 'FinalizePO');
}

// =========================================================================
// 5. INVENTORY & STOCK TRANSACTIONS RPCs
// =========================================================================

/**
 * Retrieves all stock movements/logs.
 */
function apiGetStockLogs() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.STOCK_LOGS);
  }, 'GetStockLogs');
}

/**
 * Records stock movements and atomically adjusts Product balances using LockService.
 */
function apiAppendStockMovements(movementsList = []) {
  return handleApiRequest(function() {
    const user = requirePermission('INVENTORY');
    if (!movementsList || movementsList.length === 0) return [];

    return withScriptLock(function() {
      const products = batchReadRecords(SHEET_NAMES.PRODUCTS);
      const productMap = new Map(products.map(p => [String(p.id), p]));

      const recordsToAppend = [];

      movementsList.forEach(mov => {
        const prod = productMap.get(String(mov.productId));
        const currentBalance = prod ? Number(prod.stockBalance || 0) : 0;
        const qty = Number(mov.qty || mov.quantity || 0);

        let newBalance = currentBalance;
        if (mov.type === 'IN') {
          newBalance += qty;
        } else if (mov.type === 'OUT') {
          newBalance = Math.max(0, currentBalance - qty);
        } else if (mov.type === 'ADJUST') {
          newBalance = qty;
        }

        // Update product balance in map
        if (prod) {
          prod.stockBalance = newBalance;
          prod.updatedAt = new Date().toISOString();
        }

        const logRecord = {
          id: mov.id || `MOV-${Date.now()}-${Utilities.getUuid().slice(0, 4)}`,
          timestamp: mov.timestamp || new Date().toISOString(),
          date: mov.date || new Date().toISOString(),
          productId: mov.productId,
          productCode: mov.productCode || (prod ? prod.code : ''),
          name: mov.name || (prod ? prod.name : ''),
          type: mov.type || 'IN',
          documentNo: mov.documentNo || mov.grnNumber || mov.docNo || '',
          grnNumber: mov.grnNumber || mov.documentNo || '',
          poNumber: mov.poNumber || mov.poNo || '',
          prNo: mov.prNo || '',
          qty: qty,
          unit: mov.unit || mov.stockUnit || (prod ? prod.stockUnit : 'ชิ้น'),
          conversionRate: Number(mov.conversionRate || 1),
          unitPrice: Number(mov.unitPrice || 0),
          totalPrice: Number(mov.totalPrice || (qty * Number(mov.unitPrice || 0))),
          balanceAfter: newBalance,
          actorName: mov.actorName || user.name,
          department: mov.department || (prod ? prod.department : 'PD'),
          locationId: mov.locationId || (prod ? prod.locationId : ''),
          notes: mov.notes || mov.note || ''
        };

        recordsToAppend.push(logRecord);
      });

      // 1. Batch append logs
      batchAppendRecords(SHEET_NAMES.STOCK_LOGS, recordsToAppend);

      // 2. Batch update modified products
      batchWriteRecords(SHEET_NAMES.PRODUCTS, Array.from(productMap.values()));

      return recordsToAppend;
    }, CONFIG.DEFAULTS.SCRIPT_LOCK_TIMEOUT_MS, 'AppendStockMovements');
  }, 'AppendStockMovements');
}

// =========================================================================
// 6. BUDGET & FINANCIAL RECONCILIATION RPCs
// =========================================================================

/**
 * Retrieves budget configuration and spent status.
 */
function apiGetBudgets() {
  return handleApiRequest(function() {
    requireAuth();
    const rows = batchReadRecords(SHEET_NAMES.BUDGETS);
    
    // Transform into object dictionary keyed by department (PD, QC, WH)
    const budgetMap = {};
    rows.forEach(r => {
      if (r.dept) {
        budgetMap[r.dept] = r;
      }
    });
    return budgetMap;
  }, 'GetBudgets');
}

/**
 * Saves or updates budget configurations.
 */
function apiSaveBudgets(budgetsObj) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.PLANT_MANAGER]);

    return withScriptLock(function() {
      Object.keys(budgetsObj).forEach(dept => {
        const data = budgetsObj[dept];
        data.dept = dept;
        data.updatedAt = new Date().toISOString();
        upsertRecordById(SHEET_NAMES.BUDGETS, 'dept', data);
      });
      return budgetsObj;
    }, CONFIG.DEFAULTS.SCRIPT_LOCK_TIMEOUT_MS, 'SaveBudgets');
  }, 'SaveBudgets');
}

/**
 * Retrieves budget transaction history.
 */
function apiGetBudgetTransactions() {
  return handleApiRequest(function() {
    requireAuth();
    return batchReadRecords(SHEET_NAMES.BUDGET_TRANSACTIONS);
  }, 'GetBudgetTransactions');
}

/**
 * Appends a budget transaction and reconciles variance with LockService.
 */
function apiAppendBudgetTransaction(txObj) {
  return handleApiRequest(function() {
    const user = requireAuth();

    return withScriptLock(function() {
      const dept = txObj.dept || txObj.department || 'PD';
      txObj.id = txObj.id || `TX-${Date.now()}-${Utilities.getUuid().slice(0, 4)}`;
      txObj.createdAt = txObj.createdAt || new Date().toISOString();
      txObj.actorName = txObj.actorName || user.name;
      txObj.actorRole = txObj.actorRole || user.canonicalRole;

      appendRecord(SHEET_NAMES.BUDGET_TRANSACTIONS, txObj);

      // Reconcile with Budgets tab if refund/credit
      if (txObj.type === 'BUDGET_ROLLBACK' || txObj.refundAmount) {
        const budgets = batchReadRecords(SHEET_NAMES.BUDGETS);
        const deptBudget = budgets.find(b => String(b.dept).toUpperCase() === String(dept).toUpperCase());
        if (deptBudget) {
          const refund = Number(txObj.refundAmount || txObj.amount || 0);
          deptBudget.variance = Number(deptBudget.variance || 0) + refund;
          deptBudget.updatedAt = new Date().toISOString();
          upsertRecordById(SHEET_NAMES.BUDGETS, 'dept', deptBudget);
        }
      }

      return txObj;
    }, CONFIG.DEFAULTS.SCRIPT_LOCK_TIMEOUT_MS, 'AppendBudgetTransaction');
  }, 'AppendBudgetTransaction');
}

// =========================================================================
// 7. AUDIT LOGS & NOTIFICATIONS RPCs
// =========================================================================

function apiGetAuditLogs() {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.PLANT_MANAGER]);
    return batchReadRecords(SHEET_NAMES.AUDIT_LOGS);
  }, 'GetAuditLogs');
}

function apiAppendAuditLog(logObj) {
  return handleApiRequest(function() {
    const user = requireAuth();
    logObj.id = logObj.id || `AUD-${Date.now()}-${Utilities.getUuid().slice(0, 5)}`;
    logObj.timestamp = logObj.timestamp || new Date().toISOString();
    logObj.actor = logObj.actor || { id: user.id, name: user.name, role: user.roleId };
    logObj.createdAt = new Date().toISOString();
    return appendRecord(SHEET_NAMES.AUDIT_LOGS, logObj);
  }, 'AppendAuditLog');
}

function apiGetNotifications() {
  return handleApiRequest(function() {
    const user = requireAuth();
    const allNotifs = batchReadRecords(SHEET_NAMES.NOTIFICATIONS);
    
    // Filter notifications for user's role or broadcast
    return allNotifs.filter(n => {
      if (!n.targetRole || n.targetRole === 'ALL' || user.isAdmin) return true;
      return String(n.targetRole).toUpperCase() === String(user.canonicalRole).toUpperCase() ||
             String(n.targetRole).toUpperCase() === String(user.roleId).toUpperCase();
    });
  }, 'GetNotifications');
}

function apiSaveNotifications(notifsList) {
  return handleApiRequest(function() {
    requireAuth();
    return batchWriteRecords(SHEET_NAMES.NOTIFICATIONS, notifsList);
  }, 'SaveNotifications');
}

// =========================================================================
// 8. DRIVE FILE UPLOAD RPC
// =========================================================================

/**
 * Accepts Base64 file from frontend, validates, stores in Drive,
 * logs to Attachments sheet, and rolls back if database write fails.
 */
function apiUploadFile(payload) {
  return handleApiRequest(function() {
    const user = requireAuth();
    payload.uploadedBy = user.email || user.name;
    return uploadBase64File(payload);
  }, 'UploadFile');
}

// =========================================================================
// 9. SYSTEM ADMINISTRATION & INITIALIZATION RPCs
// =========================================================================

/**
 * Initializes Spreadsheet tabs, headers, and Drive folders.
 */
function apiInitializeSystem() {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN]);
    return initializeSystem();
  }, 'InitializeSystem');
}

/**
 * Seeds baseline Master Data.
 */
function apiSeedMasterData() {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN]);
    return seedInitialMasterData();
  }, 'SeedMasterData');
}

/**
 * Migrates a batch of PO records into POs sheet.
 */
function apiMigratePOsBatch(poBatch) {
  return handleApiRequest(function() {
    requireRole([SYSTEM_ROLES.ADMIN]);
    return migratePOsBatch(poBatch);
  }, 'MigratePOsBatch');
}

/**
 * System Health Diagnostic Ping.
 */
function apiGetSystemStatus() {
  return handleApiRequest(function() {
    const user = requireAuth();
    const ss = getSpreadsheet();
    return {
      status: 'HEALTHY',
      environment: getScriptProperty(CONFIG.PROPERTY_KEYS.APP_ENV, 'production'),
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      currentUser: user.email,
      currentRole: user.roleId,
      isAdmin: user.isAdmin,
      totalSheets: ss.getSheets().length,
      serverTime: new Date().toISOString()
    };
  }, 'GetSystemStatus');
}
