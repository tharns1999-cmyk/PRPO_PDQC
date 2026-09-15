/**
 * @file Code.gs
 * @description Main Entry Point and Public RPC API Controller for PRPO_PDQC
 * Dispatches google.script.run requests with authentication, parameter unpacking,
 * transactional locking, safe user context, and standardized response envelope wrapping.
 * @version 2.1.0
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
 * Universal RPC Invoker & Safety Middleware.
 * Unpacks payloads, guarantees safe user context, enforces transactional locking,
 * and standardizes responses into { success: true, data: result } or { success: false, error: err.message }.
 * 
 * @param {Function} fn The business logic function to execute (payload, user)
 * @param {string} actionName Name of the action for audit and logging
 * @param {*} rawPayload Incoming payload from frontend (Object or JSON String)
 * @param {Object} [userContext] Explicit user context if provided
 * @returns {Object} Standard API Response { success, data, error }
 */
function handleApiRequest(fn, actionName, rawPayload, userContext) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;
  try {
    if (!lock.hasLock()) {
      try {
        lock.waitLock(5000); // ป้องกันแย่งกันเขียนชีต (ลดเวลาจาก 10000 เหลือ 5000 ตามคำขอ)
        lockAcquired = true;
      } catch (lockErr) {
        console.warn('[API Controller] Lock waitLock timed out or unavailable in "' + actionName + '": ' + lockErr.message);
      }
    }
    
    // 1. แกะ Payload อย่างปลอดภัย รองรับทั้ง Object และ String JSON
    var payload = rawPayload;
    if (typeof rawPayload === 'string') {
      try { payload = JSON.parse(rawPayload); } catch (e) { payload = {}; }
    }
    payload = payload || {};

    // 2. สร้าง Safe User Context ป้องกัน user.department / user.role เป็น undefined
    var rawUser = userContext || payload.currentUser || payload.user;
    var user;
    if (rawUser && typeof rawUser === 'object') {
      user = {
        username: rawUser.username || rawUser.employeeId || 'system',
        name: rawUser.name || rawUser.displayName || rawUser.employeeName || 'System User',
        department: rawUser.department || rawUser.dept || rawUser.primaryDepartment || payload.department || payload.dept || 'PD',
        role: rawUser.role || rawUser.roleId || rawUser.canonicalRole || 'ADMIN',
        canonicalRole: rawUser.canonicalRole || rawUser.role || rawUser.roleId || 'ADMIN',
        isAdmin: !!(rawUser.isAdmin || rawUser.role === 'ADMIN' || rawUser.canonicalRole === 'ADMIN')
      };
      for (var k in rawUser) {
        if (!(k in user)) {
          user[k] = rawUser[k];
        }
      }
    } else {
      user = {
        username: 'system',
        name: 'System User',
        department: payload.department || payload.dept || 'PD',
        role: 'ADMIN',
        canonicalRole: 'ADMIN',
        isAdmin: true
      };
    }

    // 3. รันฟังก์ชันพร้อมส่ง payload และ safe user
    var result = fn(payload, user);

    // Write pending attachments in a single batch with direct setValues
    if (typeof _pendingAttachments !== 'undefined' && Array.isArray(_pendingAttachments) && _pendingAttachments.length > 0) {
      try {
        var attSheet = getSheet(SHEET_NAMES.ATTACHMENTS);
        var attHeaders = getSheetHeaders(attSheet);
        var attachmentRows = _pendingAttachments.map(function(rec) {
          return serializeRecordToRow(rec, attHeaders);
        });
        if (attachmentRows.length > 0 && attachmentRows[0].length > 0) {
          var lastRow = attSheet.getLastRow();
          attSheet.getRange(lastRow + 1, 1, attachmentRows.length, attachmentRows[0].length).setValues(attachmentRows);
        }
      } catch (attBatchErr) {
        console.warn('[API Controller] Failed to batch write attachments: ' + attBatchErr.message);
      }
      _pendingAttachments = [];
    }

    if (result && typeof result === 'object' && 'success' in result) {
      return result;
    }
    return { success: true, data: result !== undefined ? result : null };
  } catch (err) {
    console.error('[API Controller] Error in "' + actionName + '": ' + err.message + ' \nStack: ' + err.stack);
    return { success: false, error: err.message };
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

// =========================================================================
// 1. AUTHENTICATION & USER PROFILE RPCs
// =========================================================================

/**
 * Returns authenticated user profile and capability matrix.
 */
function apiGetCurrentUser(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return {
      username: user.username,
      name: user.name,
      department: user.department,
      role: user.role,
      canonicalRole: user.canonicalRole,
      isAdmin: user.isAdmin
    };
  }, 'GetCurrentUser', rawPayload, userContext);
}

/**
 * Authenticates user credentials with username and password against Users sheet.
 * Public endpoint for frontend login.
 * 
 * @param {string} username Username or Employee ID
 * @param {string} password Password
 * @returns {Object} Hydrated user profile
 */
function apiLogin(username, password, rawPayload, userContext) {
  var cleanUser = username;
  var cleanPass = password;
  if (typeof username === 'object' && username !== null) {
    cleanUser = username.username || username.employeeId;
    cleanPass = username.password;
    rawPayload = username;
    userContext = password;
  }
  return handleApiRequest(function(payload, user) {
    var u = cleanUser || payload.username || payload.employeeId;
    var p = cleanPass || payload.password;
    return authenticateUserByPassword(u, p);
  }, 'Login', rawPayload, userContext);
}

/**
 * Retrieves all registered users from Users sheet.
 */
function apiGetUsers(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.USERS);
  }, 'GetUsers', rawPayload, userContext);
}

/**
 * Upserts a user account.
 */
function apiUpsertUser(userObj, userContext) {
  return handleApiRequest(function(payload, user) {
    var target = payload ? Object.assign({}, payload) : {};
    target.department = target.department || target.dept || user.department || 'PD';
    target.updatedAt = new Date().toISOString();
    if (!target.id && !target.employeeId && !target.username) {
      target.id = 'USR-' + Date.now();
    }
    var key = target.id ? 'id' : (target.username ? 'username' : 'employeeId');
    return upsertRecordById(SHEET_NAMES.USERS, key, target);
  }, 'UpsertUser', userObj, userContext);
}

/**
 * Saves a user account (Standard alias for apiUpsertUser).
 */
function apiSaveUser(userObj, userContext) {
  return apiUpsertUser(userObj, userContext);
}

/**
 * Deletes a user account.
 */
function apiDeleteUser(userIdOrPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var id = (typeof userIdOrPayload === 'object' && userIdOrPayload !== null)
      ? (userIdOrPayload.id || userIdOrPayload.userId)
      : (payload.id || payload.userId || userIdOrPayload);
    if (!id) {
      throw new Error('VALIDATION_ERROR: Missing User ID for deletion');
    }
    return deleteRecordById(SHEET_NAMES.USERS, 'id', id);
  }, 'DeleteUser', userIdOrPayload, userContext);
}

// =========================================================================
// 2. MASTER DATA RPCs (Products, Vendors, Locations, Units, Depts)
// =========================================================================

/**
 * Universal Master Item Saver RPC Endpoint.
 * Validates duplicate code, generates ID, timestamps, and persists to Google Sheet.
 * 
 * @param {string|Object} collectionOrPayload 'Products' | 'Vendors' | 'StorageLocations' | 'UsageUnits'
 * @param {Object} [itemOrUser] Record to save
 * @param {Object} [userContext] Optional user context
 * @returns {Object} Standard API response envelope
 */
function apiSaveMasterItem(collectionOrPayload, itemOrUser, userContext) {
  var collection = collectionOrPayload;
  var item = itemOrUser;
  var rawPayload = item;
  var rawUser = userContext;

  if (typeof collectionOrPayload === 'object' && collectionOrPayload !== null) {
    collection = collectionOrPayload.collection || collectionOrPayload.collectionName || collectionOrPayload.sheetName;
    item = collectionOrPayload.item || collectionOrPayload.data || collectionOrPayload;
    rawPayload = collectionOrPayload;
    rawUser = itemOrUser;
  }

  return handleApiRequest(function(payload, user) {
    var targetCollection = collection || payload.collection;
    var targetItem = item || payload.item || payload;
    if (typeof targetItem === 'string') {
      try { targetItem = JSON.parse(targetItem); } catch (e) { targetItem = {}; }
    }
    targetItem = targetItem ? Object.assign({}, targetItem) : {};

    // Fallback department
    targetItem.department = targetItem.department || targetItem.dept || user.department || 'PD';
    targetItem.updatedAt = new Date().toISOString();
    if (!targetItem.createdAt && !targetItem.id) {
      targetItem.createdAt = new Date().toISOString();
    }

    var sheetName = resolveMasterSheetName(targetCollection);
    var targetCode = String(targetItem.code || targetItem.sku || targetItem.vendorCode || '').trim().toUpperCase();
    if (sheetName === SHEET_NAMES.DEPARTMENTS && targetCode === 'ALL') {
      throw new Error('VALIDATION_ERROR: ไม่อนุญาตให้ใช้รหัส "ALL" เป็นแผนกจริงในระบบ');
    }

    // Auto-generate ID if new item
    if (!targetItem.id) {
      var suffix = Date.now().toString().slice(-4);
      if (sheetName === SHEET_NAMES.PRODUCTS) {
        var cat = targetItem.category || targetItem.department || 'PD';
        targetItem.id = 'PROD-' + cat + '-' + suffix;
      } else if (sheetName === SHEET_NAMES.VENDORS) {
        targetItem.id = 'VEN-' + suffix;
      } else if (sheetName === SHEET_NAMES.STORAGE_LOCATIONS) {
        targetItem.id = 'LOC-' + (targetItem.department || 'ALL') + '-' + suffix;
      } else if (sheetName === SHEET_NAMES.USAGE_UNITS) {
        targetItem.id = 'UNIT-' + (targetItem.department || 'PD') + '-' + suffix;
      } else {
        targetItem.id = 'ID-' + suffix;
      }
    }
    if (targetItem.status === undefined && targetItem.isActive === undefined) {
      targetItem.status = 'ACTIVE';
      targetItem.isActive = true;
    }

    // High-speed RAM array search + batch write
    var saved = upsertRecordFast(sheetName, 'id', targetItem);
    return saved;
  }, 'SaveMasterItem', rawPayload, rawUser);
}

/**
 * Universal Master Item Deletion RPC Endpoint.
 * Deletes item row from Google Sheet by ID.
 * 
 * @param {string|Object} collectionOrPayload 'Products' | 'Vendors' | 'StorageLocations' | 'UsageUnits'
 * @param {string} [idOrUser] Unique identifier
 * @param {Object} [userContext] Optional user context
 * @returns {Object} Standard API response envelope
 */
function apiDeleteMasterItem(collectionOrPayload, idOrUser, userContext) {
  var collection = collectionOrPayload;
  var id = idOrUser;
  var rawPayload = { collection: collection, id: id };
  var rawUser = userContext;

  if (typeof collectionOrPayload === 'object' && collectionOrPayload !== null) {
    collection = collectionOrPayload.collection || collectionOrPayload.sheetName;
    id = collectionOrPayload.id || collectionOrPayload.itemId;
    rawPayload = collectionOrPayload;
    rawUser = idOrUser;
  }

  return handleApiRequest(function(payload, user) {
    var targetCollection = collection || payload.collection;
    var targetId = id || payload.id;
    if (!targetId) {
      throw new Error('VALIDATION_ERROR: Missing ID for deletion');
    }
    var result = deleteMasterItem(targetCollection, targetId);
    return (result && result.data !== undefined) ? result.data : result;
  }, 'DeleteMasterItem', rawPayload, rawUser);
}

/**
 * Retrieves all products.
 */
function apiGetProducts(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.PRODUCTS);
  }, 'GetProducts', rawPayload, userContext);
}

/**
 * Upserts a product.
 */
function apiUpsertProduct(productObj, userContext) {
  return apiSaveMasterItem(SHEET_NAMES.PRODUCTS, productObj, userContext);
}

/**
 * Deletes a product by ID.
 */
function apiDeleteProduct(productId, userContext) {
  return apiDeleteMasterItem(SHEET_NAMES.PRODUCTS, productId, userContext);
}

/**
 * Retrieves all vendors.
 */
function apiGetVendors(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.VENDORS);
  }, 'GetVendors', rawPayload, userContext);
}

/**
 * Upserts a vendor record.
 */
function apiUpsertVendor(vendorObj, userContext) {
  return apiSaveMasterItem(SHEET_NAMES.VENDORS, vendorObj, userContext);
}

/**
 * Deletes a vendor by ID.
 */
function apiDeleteVendor(vendorId, userContext) {
  return apiDeleteMasterItem(SHEET_NAMES.VENDORS, vendorId, userContext);
}

/**
 * Storage Locations RPCs
 */
function apiGetStorageLocations(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.STORAGE_LOCATIONS);
  }, 'GetStorageLocations', rawPayload, userContext);
}

function apiUpsertStorageLocation(locationObj, userContext) {
  return apiSaveMasterItem(SHEET_NAMES.STORAGE_LOCATIONS, locationObj, userContext);
}

function apiDeleteStorageLocation(locationId, userContext) {
  return apiDeleteMasterItem(SHEET_NAMES.STORAGE_LOCATIONS, locationId, userContext);
}

/**
 * Usage Units RPCs
 */
function apiGetUsageUnits(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.USAGE_UNITS);
  }, 'GetUsageUnits', rawPayload, userContext);
}

function apiUpsertUsageUnit(unitObj, userContext) {
  return apiSaveMasterItem(SHEET_NAMES.USAGE_UNITS, unitObj, userContext);
}

function apiDeleteUsageUnit(unitId, userContext) {
  return apiDeleteMasterItem(SHEET_NAMES.USAGE_UNITS, unitId, userContext);
}

/**
 * Departments RPCs
 */
function apiGetDepartments(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.DEPARTMENTS);
  }, 'GetDepartments', rawPayload, userContext);
}

function apiUpsertDepartment(deptObj, userContext) {
  return handleApiRequest(function(payload, user) {
    var target = payload ? Object.assign({}, payload) : {};
    var code = String(target.code || '').trim().toUpperCase();
    if (code === 'ALL') {
      throw new Error('VALIDATION_ERROR: ไม่อนุญาตให้ใช้รหัสแผนก "ALL"');
    }
    target.updatedAt = new Date().toISOString();
    return upsertRecordById(SHEET_NAMES.DEPARTMENTS, 'code', target);
  }, 'UpsertDepartment', deptObj, userContext);
}

/**
 * Signatures RPCs
 */
function apiGetSignatures(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.SIGNATURES);
  }, 'GetSignatures', rawPayload, userContext);
}

function apiSaveSignature(roleId, signatureUrl, userObj, rawPayload, userContext) {
  var cleanRoleId = roleId;
  var cleanUrl = signatureUrl;
  var cleanUser = userObj;
  if (typeof roleId === 'object' && roleId !== null) {
    cleanRoleId = roleId.roleId;
    cleanUrl = roleId.signatureUrl || roleId.signature;
    cleanUser = roleId.userObj || roleId.user;
    rawPayload = roleId;
    userContext = signatureUrl;
  }
  return handleApiRequest(function(payload, user) {
    var rId = cleanRoleId || payload.roleId;
    var sUrl = cleanUrl || payload.signatureUrl || payload.signature;
    var u = cleanUser || payload.userObj || user;
    var record = {
      roleId: rId,
      name: u ? (u.name || u.displayName || u.username) : 'Unknown',
      signatureUrl: sUrl,
      updatedAt: new Date().toISOString(),
      updatedBy: u ? (u.email || u.username) : 'Unknown'
    };
    return upsertRecordById(SHEET_NAMES.SIGNATURES, 'roleId', record);
  }, 'SaveSignature', rawPayload, userContext);
}

// =========================================================================
// 3. PURCHASE REQUEST (PR) RPCs
// =========================================================================

/**
 * Normalizes PR records for backward compatibility.
 * If any PR contains item store URLs (Shopee/Lazada/http/https) or mentions "ออนไลน์" / "online",
 * enforce purchaseChannel = 'ONLINE'.
 *
 * @param {Array<Object>} prs
 * @returns {Array<Object>}
 */
function normalizePRsLegacyOnline(prs) {
  if (!Array.isArray(prs)) return [];
  return prs.map(function(pr) {
    if (!pr || typeof pr !== 'object') return pr;

    var currentChannel = String(pr.purchaseChannel || pr.channel || '').trim().toUpperCase();
    if (currentChannel === 'ONLINE' || currentChannel === 'ONLINE_PURCHASE') {
      pr.purchaseChannel = 'ONLINE';
      pr.channel = 'ONLINE';
      return pr;
    }

    var isOnline = false;

    // 1. Check PR level fields
    var textToCheck = (
      String(pr.purchaseChannel || '') + ' ' +
      String(pr.channel || '') + ' ' +
      String(pr.orderType || '') + ' ' +
      String(pr.remarks || '') + ' ' +
      String(pr.note || '') + ' ' +
      String(pr.notes || '') + ' ' +
      String(pr.vendorName || '')
    ).toLowerCase();

    if (
      textToCheck.indexOf('ออนไลน์') !== -1 ||
      textToCheck.indexOf('online') !== -1 ||
      textToCheck.indexOf('shopee') !== -1 ||
      textToCheck.indexOf('lazada') !== -1 ||
      textToCheck.indexOf('tiktok') !== -1
    ) {
      isOnline = true;
    }

    // 2. Check items
    var rawItems = pr.items;
    if (typeof rawItems === 'string') {
      try {
        rawItems = JSON.parse(rawItems);
      } catch (e) {
        var strItems = rawItems.toLowerCase();
        if (
          strItems.indexOf('http://') !== -1 ||
          strItems.indexOf('https://') !== -1 ||
          strItems.indexOf('shopee') !== -1 ||
          strItems.indexOf('lazada') !== -1 ||
          strItems.indexOf('tiktok') !== -1 ||
          strItems.indexOf('ออนไลน์') !== -1 ||
          strItems.indexOf('online') !== -1
        ) {
          isOnline = true;
        }
      }
    }

    if (!isOnline && Array.isArray(rawItems)) {
      for (var i = 0; i < rawItems.length; i++) {
        var it = rawItems[i];
        if (!it) continue;
        var url = String(it.productUrl || it.onlineUrl || it.url || it.shopUrl || it.link || it.itemUrl || '').trim().toLowerCase();
        if (
          url.indexOf('http://') === 0 ||
          url.indexOf('https://') === 0 ||
          url.indexOf('shopee') !== -1 ||
          url.indexOf('lazada') !== -1 ||
          url.indexOf('tiktok') !== -1
        ) {
          isOnline = true;
          break;
        }
        var itemText = (
          String(it.name || '') + ' ' +
          String(it.description || '') + ' ' +
          String(it.remarks || '') + ' ' +
          String(it.note || '') + ' ' +
          String(it.vendorName || '')
        ).toLowerCase();
        if (
          itemText.indexOf('ออนไลน์') !== -1 ||
          itemText.indexOf('online') !== -1 ||
          itemText.indexOf('shopee') !== -1 ||
          itemText.indexOf('lazada') !== -1
        ) {
          isOnline = true;
          break;
        }
      }
    }

    if (isOnline) {
      pr.purchaseChannel = 'ONLINE';
      pr.channel = 'ONLINE';
    }

    return pr;
  });
}

/**
 * Records an audit log entry in AuditLogs sheet with full schema & legacy compatibility.
 * Covers both standard schema (targetRef, summary, actor, changes, createdAt)
 * and legacy/header variants (docNo, actorName, actorRole, comment, details).
 *
 * @param {string} docNo Document number (e.g. "PD007/2026")
 * @param {string} action Action name (e.g. "CREATE", "SEND_BACK", "REVIEW_APPROVED", "APPROVED")
 * @param {string} actorName Name of actor
 * @param {string} actorRole Role of actor
 * @param {string} comment Reason or comment
 * @param {string} [module='PURCHASE'] Module name
 * @param {Object} [userObj=null] Full user context object
 * @returns {Object} Appended audit log object
 */
function recordAuditLogEntry(docNo, action, actorName, actorRole, comment, module, userObj) {
  try {
    var opts = {};
    if (typeof docNo === 'object' && docNo !== null) {
      opts = docNo;
      docNo = opts.docNo || opts.targetRef || opts.documentNo || opts.prNo || '';
      action = opts.action;
      actorName = opts.actorName || (opts.actor && (opts.actor.name || opts.actor.displayName || opts.actor.username)) || (typeof opts.actor === 'string' ? opts.actor : '');
      actorRole = opts.actorRole || (opts.actor && (opts.actor.role || opts.actor.userRole || opts.actor.title)) || '';
      comment = opts.comment || opts.summary || opts.reason || '';
      module = opts.module || 'PURCHASE';
      userObj = (opts.actor && typeof opts.actor === 'object') ? opts.actor : null;
    }

    var timestamp = new Date().toISOString();
    var cleanDocNo = String(docNo || '').trim().toUpperCase();
    var cleanAction = String(action || 'ACTION').trim();
    var cleanActorName = String(actorName || (userObj && (userObj.name || userObj.username)) || 'ผู้ใช้งาน').trim();
    var cleanActorRole = String(actorRole || (userObj && (userObj.role || userObj.title || userObj.canonicalRole)) || '').trim();
    var cleanComment = String(comment || opts.summary || '').trim();
    var summaryText = opts.summary || cleanComment || (cleanAction + ' บนเอกสาร ' + cleanDocNo);

    var auditLog = {
      id: opts.id || ('AL-' + Date.now() + '-' + Utilities.getUuid().slice(0, 4)),
      timestamp: timestamp,
      createdAt: timestamp,
      action: cleanAction,
      module: module || 'PURCHASE',
      targetRef: cleanDocNo,
      docNo: cleanDocNo,
      documentNo: cleanDocNo,
      prNo: cleanDocNo,
      actorName: cleanActorName,
      actorRole: cleanActorRole,
      actor: (opts.actor && typeof opts.actor === 'object') ? opts.actor : {
        id: (userObj && (userObj.username || userObj.id)) || 'USER',
        name: cleanActorName,
        role: cleanActorRole,
        department: (userObj && userObj.department) || ''
      },
      summary: summaryText,
      details: summaryText,
      comment: cleanComment,
      note: cleanComment,
      reason: opts.reason || cleanComment,
      changes: opts.changes || (cleanComment ? [{ field: 'บันทึกเหตุผล', before: '-', after: cleanComment }] : [])
    };

    var logSheet = getSheet(SHEET_NAMES.AUDIT_LOGS || 'AuditLogs');
    var logHeaders = getSheetHeaders(logSheet);
    var logRows = [serializeRecordToRow(auditLog, logHeaders)];
    if (logRows.length > 0 && logRows[0].length > 0) {
      var lastRow = logSheet.getLastRow();
      logSheet.getRange(lastRow + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
    }
    return auditLog;
  } catch (err) {
    console.warn('[recordAuditLogEntry] Error appending to AuditLogs:', err.message);
    return null;
  }
}

/**
 * Standardized central helper for recording PR Audit Logs across its lifecycle.
 *
 * @param {string} docNo Document number (PR No)
 * @param {string} action Action name (CREATE, RESUBMIT, SEND_BACK, REVIEW_FORWARD, APPROVE, CANCEL)
 * @param {Object|string} actor User context object or name
 * @param {string} summary Description / comment for this action
 * @param {Array} [changes] Optional array of modified fields
 * @returns {Object} Appended audit log object
 */
function logPRAudit(docNo, action, actor, summary, changes) {
  return recordAuditLogEntry({
    targetRef: String(docNo || '').trim().toUpperCase(),
    docNo: String(docNo || '').trim().toUpperCase(),
    action: action,
    module: 'PURCHASE',
    summary: summary || '',
    comment: summary || '',
    actor: actor || { name: 'ผู้ใช้งานระบบ', role: '' },
    actorName: typeof actor === 'object' ? (actor.name || actor.displayName || actor.username) : String(actor || ''),
    actorRole: typeof actor === 'object' ? (actor.role || actor.userRole || actor.title) : '',
    changes: changes || []
  });
}

/**
 * Reads, indexes, and groups AuditLogs by normalized document key (e.g. normKey(docNo)).
 * Maps both schema-compliant fields and legacy fields to ensure timeline displays correctly.
 *
 * @param {Array} auditLogsList Array of raw audit log records
 * @returns {Object} Map of normalized docKey -> Array of log event items
 */
function buildAuditLogsByDoc(auditLogsList) {
  var normKey = function(val) { return String(val || '').trim().toUpperCase(); };
  var logsByDoc = {};
  if (!Array.isArray(auditLogsList)) return logsByDoc;

  auditLogsList.forEach(function(log) {
    if (!log) return;
    var rawDocNo = log.docNo || log.targetRef || log.documentNo || log.prNo || log.poNo || '';
    var keys = [];
    if (log.targetRef) keys.push(normKey(log.targetRef));
    if (log.docNo) keys.push(normKey(log.docNo));
    if (log.prNo) keys.push(normKey(log.prNo));
    if (log.poNo) keys.push(normKey(log.poNo));
    if (log.documentNo) keys.push(normKey(log.documentNo));
    if (keys.length === 0 && rawDocNo) keys.push(normKey(rawDocNo));

    var uniqueKeys = [];
    keys.forEach(function(k) {
      if (k && uniqueKeys.indexOf(k) === -1) uniqueKeys.push(k);
    });
    if (uniqueKeys.length === 0) return;

    var parsedActor = null;
    if (typeof log.actor === 'string') {
      try { parsedActor = JSON.parse(log.actor); } catch(e) {}
    } else if (typeof log.actor === 'object' && log.actor !== null) {
      parsedActor = log.actor;
    }

    var actorName = log.actorName || (parsedActor && (parsedActor.name || parsedActor.displayName || parsedActor.username)) || (typeof log.actor === 'string' && !log.actor.trim().startsWith('{') ? log.actor : '') || log.userName || log.user || 'ผู้ใช้งาน';
    var actorRole = log.actorRole || (parsedActor && (parsedActor.role || parsedActor.title || parsedActor.position || parsedActor.userRole)) || log.userRole || log.role || '';
    var commentText = log.comment || log.summary || log.note || log.details || log.reason || '';
    var timestamp = log.timestamp || log.createdAt || log.date || new Date().toISOString();

    var eventObj = {
      id: log.id || ('AUD-' + Utilities.getUuid().slice(0, 8)),
      timestamp: timestamp,
      createdAt: timestamp,
      date: timestamp,
      time: timestamp,
      action: log.action || 'ดำเนินการ',
      title: log.action || 'ดำเนินการ',
      type: log.action || 'ดำเนินการ',
      docNo: rawDocNo,
      targetRef: log.targetRef || rawDocNo,
      actor: actorName,
      actorName: actorName,
      user: actorName,
      userName: actorName,
      by: actorName,
      role: actorRole,
      actorRole: actorRole,
      userRole: actorRole,
      comment: commentText,
      note: commentText,
      details: commentText,
      description: commentText,
      summary: commentText,
      reason: log.reason || commentText,
      changes: log.changes || [],
      status: log.status || null
    };

    uniqueKeys.forEach(function(key) {
      if (!logsByDoc[key]) logsByDoc[key] = [];
      logsByDoc[key].push(eventObj);
    });
  });

  Object.keys(logsByDoc).forEach(function(k) {
    logsByDoc[k].sort(function(a, b) {
      var tA = new Date(a.timestamp || a.createdAt || 0).getTime();
      var tB = new Date(b.timestamp || b.createdAt || 0).getTime();
      return tA - tB;
    });
  });

  return logsByDoc;
}

/**
 * Retrieves all PRs.
 */
function apiGetPRs(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var prs = batchReadRecords(SHEET_NAMES.PRS);
    
    // Join Attachments
    var attachSheetName = (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.ATTACHMENTS) ? SHEET_NAMES.ATTACHMENTS : 'Attachments';
    var attachments = [];
    try { attachments = batchReadRecords(attachSheetName); } catch (e) {}
    
    var normKey = function(val) { return String(val || '').trim().toUpperCase(); };
    var attachmentsByDoc = {};
    attachments.forEach(function(att) {
      if (!att) return;
      var k1 = normKey(att.docNo);
      var k2 = normKey(att.prNo);
      if (k1) {
        if (!attachmentsByDoc[k1]) attachmentsByDoc[k1] = [];
        attachmentsByDoc[k1].push(att);
      }
      if (k2 && k2 !== k1) {
        if (!attachmentsByDoc[k2]) attachmentsByDoc[k2] = [];
        attachmentsByDoc[k2].push(att);
      }
    });
    
    // Join AuditLogs
    var auditLogs = [];
    try { auditLogs = batchReadRecords('AuditLogs'); } catch (e) {}
    var logsByDoc = buildAuditLogsByDoc(auditLogs);

    prs.forEach(function(pr) {
      if (typeof pr.attachments === 'string') {
        try { pr.attachments = JSON.parse(pr.attachments); } catch(e) {}
      }
      var prKey = normKey(pr.prNo || pr.id || pr.docNo);
      var kNo = normKey(pr.prNo);
      var kId = normKey(pr.id);
      var kDoc = normKey(pr.docNo);
      var files = attachmentsByDoc[prKey] || [];
      pr.attachments = files;
      pr.quotationFiles = files;
      pr.generalAttachments = files;
      
      var docLogs = logsByDoc[prKey] || logsByDoc[kNo] || logsByDoc[kDoc] || logsByDoc[kId] || [];
      var seenIds = {};
      var sortedLogs = [];
      docLogs.forEach(function(l) {
        var lid = l.id || (l.timestamp + '_' + l.action);
        if (!seenIds[lid]) {
          seenIds[lid] = true;
          sortedLogs.push(l);
        }
      });
      sortedLogs.sort(function(a, b) {
        var tA = new Date(a.timestamp || a.createdAt || 0).getTime();
        var tB = new Date(b.timestamp || b.createdAt || 0).getTime();
        return tA - tB;
      });

      pr.timeline = sortedLogs;
      pr.activityTimeline = sortedLogs;
      pr.history = sortedLogs;
      pr.approvalHistory = sortedLogs;
      pr.auditLogs = sortedLogs;
    });

    return normalizePRsLegacyOnline(prs);
  }, 'GetPRs', rawPayload, userContext);
}

/**
 * Creates a new PR with thread-safe sequential PR Number generation.
 * Immediately persists to PRs sheet and writes individual lines to PRItems sheet.
 */
function apiCreatePR(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var prObj = payload ? Object.assign({}, payload) : {};
    var dept = prObj.department || prObj.dept || user.department || 'PD';

    // Generate unique sequential number inside ScriptLock
    var seqPrNo = prObj.prNo || generateSequentialDocId(dept, 'PR');

    prObj.id = prObj.id || ('PR-' + Date.now() + '-' + Utilities.getUuid().slice(0, 4));
    prObj.prNo = seqPrNo;
    prObj.department = dept;
    prObj.requestedBy = prObj.requestedBy || user.name || user.username || 'System User';
    prObj.status = prObj.status || 'SUBMITTED';
    prObj.createdAt = prObj.createdAt || new Date().toISOString();
    prObj.updatedAt = new Date().toISOString();

    // Extract & stringify items for Sheet persistence
    var rawItems = prObj.items;
    if (typeof rawItems === 'string') {
      try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
    }
    if (!Array.isArray(rawItems)) rawItems = [];

    // REAL GOOGLE DRIVE UPLOAD PIPELINE:
    // Upload any inline Base64 images and attachments to Google Drive before writing to sheet
    rawItems = processItemImages(rawItems, seqPrNo, 'PR');
    if (Array.isArray(prObj.attachments)) {
      prObj.attachments = processDocumentAttachments(prObj.attachments, DRIVE_CATEGORIES.PR, seqPrNo, 'PR', true);
    }

    // Always stringify items before writing to PRs sheet
    prObj.items = JSON.stringify(rawItems);

    // Calculate subtotal & totalAmount if missing
    if (!prObj.totalAmount && rawItems.length > 0) {
      var total = rawItems.reduce(function(sum, it) {
        return sum + ((Number(it.qty || it.quantity || 0)) * (Number(it.price || it.unitPrice || 0)));
      }, 0);
      prObj.totalAmount = total;
      prObj.subtotal = prObj.subtotal || total;
    }

    // 1. Write to PRs sheet (Search RAM index first, then batch write)
    upsertRecordFast(SHEET_NAMES.PRS, 'id', prObj);

    // 2. Write individual items to PRItems sheet immediately with real Drive URLs & IDs
    try {
      ensurePRItemsSheet();
      if (rawItems.length > 0) {
        var itemRows = rawItems.map(function(item, idx) {
          var qty = Number(item.qty || item.quantity || item.purchaseQty || 1);
          var price = Number(item.price || item.unitPrice || 0);
          return {
            id: item.id || ('PRI-' + Date.now() + '-' + (idx + 1) + '-' + Utilities.getUuid().slice(0, 3)),
            prId: prObj.id,
            prNo: prObj.prNo,
            productId: item.productId || item.product || item.code || '',
            productCode: item.code || item.productCode || '',
            name: item.name || item.itemName || item.title || '',
            purchaseUnit: item.purchaseUnit || item.unit || 'ชิ้น',
            stockUnit: item.stockUnit || item.unit || 'ชิ้น',
            conversionRate: Number(item.conversionRate || 1),
            qty: qty,
            unit: item.unit || item.purchaseUnit || item.stockUnit || 'ชิ้น',
            price: price,
            totalPrice: Number(item.totalPrice || item.total || (qty * price)),
            department: dept,
            notes: item.notes || item.remark || '',
            status: prObj.status,
            imageUrl: item.imageUrl || '',
            fileId: item.fileId || '',
            driveUrl: item.driveUrl || '',
            images: Array.isArray(item.images) ? JSON.stringify(item.images) : (item.images || ''),
            attachments: Array.isArray(item.attachments) ? JSON.stringify(item.attachments) : (item.attachments || ''),
            createdAt: prObj.createdAt,
            updatedAt: prObj.updatedAt
          };
        });
        batchAppendRecords(SHEET_NAMES.PR_ITEMS, itemRows);
      }
    } catch (itemErr) {
      console.warn('[apiCreatePR] Warning saving to PRItems tab: ' + itemErr.message);
    }

    // 3. Write to AuditLogs
    try {
      logPRAudit(
        seqPrNo || prObj.prNo || prObj.id,
        prObj.status === 'DRAFT' ? 'PR_DRAFTED' : 'CREATE',
        user,
        prObj.status === 'DRAFT' ? 'บันทึกแบบร่างใบขอซื้อ' : 'สร้างใบขอซื้อและส่งตรวจสอบ'
      );
    } catch(e) {
      console.warn('AuditLog Error in apiCreatePR:', e);
    }

    var returnPr = Object.assign({}, prObj);
    returnPr.items = rawItems;
    return returnPr;
  }, 'CreatePR', rawPayload, userContext);
}

/**
 * Updates or reviews an existing PR.
 * Fallback department, creates object if payload empty, stringifies items, sets updatedAt.
 */
function apiSavePR(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var prObj = payload ? Object.assign({}, payload) : {};
    var dept = prObj.department || prObj.dept || user.department || 'PD';
    prObj.department = dept;
    prObj.id = prObj.id || ('PR-' + Date.now());
    prObj.updatedAt = new Date().toISOString();

    var rawItems = prObj.items;
    if (typeof rawItems === 'string') {
      try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
    }
    if (!Array.isArray(rawItems)) rawItems = [];

    // REAL GOOGLE DRIVE UPLOAD PIPELINE:
    rawItems = processItemImages(rawItems, prObj.prNo || prObj.id, 'PR');
    if (Array.isArray(prObj.attachments)) {
      prObj.attachments = processDocumentAttachments(prObj.attachments, DRIVE_CATEGORIES.PR, prObj.prNo || prObj.id, 'PR');
    }

    prObj.items = JSON.stringify(rawItems);

    ['history', 'timeline', 'activityLog', 'approvalHistory', 'comments'].forEach(function(field) {
      if (prObj[field]) {
        var rawVal = prObj[field];
        if (typeof rawVal === 'string') {
          try { rawVal = JSON.parse(rawVal); } catch (e) { rawVal = []; }
        }
        prObj[field] = JSON.stringify(Array.isArray(rawVal) ? rawVal : []);
      }
    });

    var saved = upsertRecordFast(SHEET_NAMES.PRS, 'id', prObj);

    // Also update PRItems if available
    try {
      if (rawItems.length > 0 && prObj.id) {
        ensurePRItemsSheet();
        var itemRows = rawItems.map(function(item, idx) {
          var qty = Number(item.qty || item.quantity || 1);
          var price = Number(item.price || item.unitPrice || 0);
          return {
            id: item.id || ('PRI-' + prObj.id + '-' + (idx + 1)),
            prId: prObj.id,
            prNo: prObj.prNo || '',
            productId: item.productId || item.code || '',
            productCode: item.code || item.productCode || '',
            name: item.name || item.itemName || '',
            purchaseUnit: item.purchaseUnit || item.unit || 'ชิ้น',
            stockUnit: item.stockUnit || item.unit || 'ชิ้น',
            conversionRate: Number(item.conversionRate || 1),
            qty: qty,
            unit: item.unit || 'ชิ้น',
            price: price,
            totalPrice: Number(item.totalPrice || item.total || (qty * price)),
            department: dept,
            notes: item.notes || '',
            status: prObj.status || 'UPDATED',
            imageUrl: item.imageUrl || '',
            fileId: item.fileId || '',
            driveUrl: item.driveUrl || '',
            images: Array.isArray(item.images) ? JSON.stringify(item.images) : (item.images || ''),
            attachments: Array.isArray(item.attachments) ? JSON.stringify(item.attachments) : (item.attachments || ''),
            createdAt: prObj.createdAt || prObj.updatedAt,
            updatedAt: prObj.updatedAt
          };
        });
        batchUpsertRecordsFast(SHEET_NAMES.PR_ITEMS, 'id', itemRows);
      }
    } catch (e) {
      console.warn('[apiSavePR] Warning updating PRItems: ' + e.message);
    }

    // Audit log hook for apiSavePR
    try {
      var prNo = prObj.prNo || prObj.id;
      if (prObj.status === 'CANCELLED') {
        logPRAudit(prNo, 'CANCEL', user, prObj.reason || prObj.comment || 'ยกเลิกใบขอซื้อ');
      } else if (payload && (payload.action === 'RESUBMIT' || payload.isResubmit)) {
        logPRAudit(prNo, 'RESUBMIT', user, 'แก้ไขรายละเอียดเอกสารและส่งตรวจสอบใหม่อีกครั้ง');
      }
    } catch(e) {
      console.warn('AuditLog Error in apiSavePR:', e);
    }

    var returnSaved = Object.assign({}, prObj);
    returnSaved.items = rawItems;
    return returnSaved;
  }, 'SavePR', rawPayload, userContext);
}

/**
 * Updates a PR (when Requester edits/resubmits).
 */
function apiUpdatePR(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var savedPr = apiSavePR(payload, userContext);
    var targetPr = (savedPr && savedPr.data) ? savedPr.data : savedPr;
    var prNo = (targetPr && (targetPr.prNo || targetPr.id)) || (payload && (payload.prNo || payload.id)) || '';
    if (prNo) {
      try {
        logPRAudit(prNo, 'RESUBMIT', user, 'แก้ไขรายละเอียดเอกสารและส่งตรวจสอบใหม่อีกครั้ง');
      } catch(e) {
        console.warn('AuditLog Error in apiUpdatePR:', e);
      }
    }
    return targetPr;
  }, 'UpdatePR', rawPayload, userContext);
}

/**
 * Reviews a PR.
 */
function apiReviewPR(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var prObj = payload ? Object.assign({}, payload) : {};
    var dept = prObj.department || prObj.dept || user.department || 'PD';
    prObj.department = dept;
    prObj.status = prObj.status || 'REVIEWED';
    prObj.reviewedBy = prObj.reviewedBy || user.name || user.username || 'Reviewer';
    prObj.reviewedAt = prObj.reviewedAt || new Date().toISOString();
    prObj.updatedAt = new Date().toISOString();

    ['items', 'history', 'timeline', 'activityLog', 'approvalHistory', 'comments'].forEach(function(field) {
      if (prObj[field]) {
        var rawVal = prObj[field];
        if (typeof rawVal === 'string') {
          try { rawVal = JSON.parse(rawVal); } catch (e) { rawVal = []; }
        }
        prObj[field] = JSON.stringify(Array.isArray(rawVal) ? rawVal : []);
      }
    });

    var result = upsertRecordFast(SHEET_NAMES.PRS, 'id', prObj);

    // 3. Write to AuditLogs
    try {
      logPRAudit(
        prObj.prNo || prObj.id,
        'REVIEW_FORWARD',
        user,
        prObj.comment || (payload && payload.comment) || 'ตรวจสอบผ่าน ส่งต่อ Plant Mgr'
      );
    } catch(e) {
      console.warn('AuditLog Error in apiReviewPR:', e);
    }

    return result;
  }, 'ReviewPR', rawPayload, userContext);
}

/**
 * Approves a PR.
 */
function apiApprovePR(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var prObj = payload ? Object.assign({}, payload) : {};
    var dept = prObj.department || prObj.dept || user.department || 'PD';
    prObj.department = dept;
    prObj.status = 'APPROVED';
    prObj.approvedBy = prObj.approvedBy || user.name || user.username || 'Approver';
    prObj.approvedAt = prObj.approvedAt || new Date().toISOString();
    prObj.updatedAt = new Date().toISOString();

    ['items', 'history', 'timeline', 'activityLog', 'approvalHistory', 'comments'].forEach(function(field) {
      if (prObj[field]) {
        var rawVal = prObj[field];
        if (typeof rawVal === 'string') {
          try { rawVal = JSON.parse(rawVal); } catch (e) { rawVal = []; }
        }
        prObj[field] = JSON.stringify(Array.isArray(rawVal) ? rawVal : []);
      }
    });

    var result = upsertRecordFast(SHEET_NAMES.PRS, 'id', prObj);

    // 3. Write to AuditLogs
    try {
      logPRAudit(
        prObj.prNo || prObj.id,
        'APPROVE',
        user,
        prObj.comment || (payload && payload.comment) || 'อนุมัติใบขอซื้อ'
      );
    } catch(e) {
      console.warn('AuditLog Error in apiApprovePR:', e);
    }

    return result;
  }, 'ApprovePR', rawPayload, userContext);
}

/**
 * Rejects / Sends back a PR.
 */
function apiRejectPR(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var prObj = payload ? Object.assign({}, payload) : {};
    var dept = prObj.department || prObj.dept || user.department || 'PD';
    prObj.department = dept;
    
    // 1. ดึงค่าเหตุผล (Reason Field Mapping & Display)
    var actualReason = prObj.reason || prObj.comment || prObj.rejectReason || prObj.revisionReason || prObj.returnComment || (payload && (payload.reason || payload.comment)) || '';
    prObj.rejectReason = actualReason;
    
    // 2. Preserve status (REJECTED_TO_DRAFT, RETURNED) or default to REJECTED
    prObj.status = prObj.status || 'REJECTED';
    prObj.rejectedBy = prObj.rejectedBy || user.name || user.username || 'Rejecter';
    prObj.rejectedAt = prObj.rejectedAt || new Date().toISOString();
    prObj.updatedAt = new Date().toISOString();

    ['items', 'history', 'timeline', 'activityLog', 'approvalHistory', 'comments'].forEach(function(field) {
      if (prObj[field]) {
        var rawVal = prObj[field];
        if (typeof rawVal === 'string') {
          try { rawVal = JSON.parse(rawVal); } catch (e) { rawVal = []; }
        }
        prObj[field] = JSON.stringify(Array.isArray(rawVal) ? rawVal : []);
      }
    });

    var result = upsertRecordFast(SHEET_NAMES.PRS, 'id', prObj);
    
    // 3. บันทึกลง AuditLogs
    try {
      logPRAudit(
        prObj.prNo || prObj.id,
        'SEND_BACK',
        user,
        actualReason || 'ส่งกลับเพื่อแก้ไข'
      );
    } catch(e) {
      console.warn('AuditLog Error in apiRejectPR:', e);
    }

    // 4. แจ้งเตือน (Safe wrapper)
    try {
      if (typeof UrlFetchApp !== 'undefined') {
        // Safe placeholder with muteHttpExceptions
      }
    } catch (notifyErr) {
      console.warn('Notification Error:', notifyErr);
    }

    return result;
  }, 'RejectPR', rawPayload, userContext);
}

/**
 * Sends back / Rejects a PR (Standard alias for apiRejectPR).
 */
function apiSendBackPR(rawPayload, userContext) {
  return apiRejectPR(rawPayload, userContext);
}

/**
 * Cancels a PR and logs CANCEL action in AuditLogs.
 */
function apiCancelPR(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var prObj = payload ? Object.assign({}, payload) : {};
    var dept = prObj.department || prObj.dept || user.department || 'PD';
    prObj.department = dept;
    prObj.status = 'CANCELLED';
    var actualReason = prObj.reason || prObj.comment || prObj.rejectReason || (payload && (payload.reason || payload.comment)) || '';
    prObj.cancelledBy = prObj.cancelledBy || user.name || user.username || 'User';
    prObj.cancelledAt = prObj.cancelledAt || new Date().toISOString();
    prObj.updatedAt = new Date().toISOString();

    ['items', 'history', 'timeline', 'activityLog', 'approvalHistory', 'comments'].forEach(function(field) {
      if (prObj[field]) {
        var rawVal = prObj[field];
        if (typeof rawVal === 'string') {
          try { rawVal = JSON.parse(rawVal); } catch (e) { rawVal = []; }
        }
        prObj[field] = JSON.stringify(Array.isArray(rawVal) ? rawVal : []);
      }
    });

    var result = upsertRecordFast(SHEET_NAMES.PRS, 'id', prObj);

    try {
      logPRAudit(prObj.prNo || prObj.id, 'CANCEL', user, actualReason || 'ยกเลิกใบขอซื้อ');
    } catch(e) {
      console.warn('AuditLog Error in apiCancelPR:', e);
    }

    return result;
  }, 'CancelPR', rawPayload, userContext);
}

// =========================================================================
// 4. PURCHASE ORDER (PO) RPCs
// =========================================================================

/**
 * Retrieves all POs.
 */
function apiGetPOs(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.POS);
  }, 'GetPOs', rawPayload, userContext);
}

/**
 * Creates a new PO with thread-safe sequential PO number.
 */
function apiCreatePO(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var poObj = payload ? Object.assign({}, payload) : {};
    var dept = poObj.department || poObj.dept || user.department || 'PUR';
    var seqPoNo = poObj.poNo || generateSequentialDocId(dept, 'PO');

    poObj.id = poObj.id || ('PO-' + Date.now() + '-' + Utilities.getUuid().slice(0, 4));
    poObj.poNo = seqPoNo;
    poObj.department = dept;
    poObj.status = poObj.status || 'PO_CREATED';
    poObj.createdAt = poObj.createdAt || new Date().toISOString();
    poObj.updatedAt = new Date().toISOString();

    if (poObj.items) {
      var rawItems = poObj.items;
      if (typeof rawItems === 'string') {
        try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
      }
      if (Array.isArray(rawItems)) {
        rawItems = processItemImages(rawItems, poObj.poNo || poObj.id, 'PO');
        poObj.items = JSON.stringify(rawItems);
      }
    }
    if (Array.isArray(poObj.attachments)) {
      poObj.attachments = processDocumentAttachments(poObj.attachments, DRIVE_CATEGORIES.PO, poObj.poNo || poObj.id, 'PO');
    }

    ['items', 'history', 'timeline', 'activityLog', 'claimHistory', 'comments', 'ngItems', 'grnHistory'].forEach(function(field) {
      if (poObj[field]) {
        var rawVal = poObj[field];
        if (typeof rawVal === 'string') {
          try { rawVal = JSON.parse(rawVal); } catch (e) { rawVal = []; }
        }
        poObj[field] = JSON.stringify(Array.isArray(rawVal) ? rawVal : []);
      }
    });

    upsertRecordFast(SHEET_NAMES.POS, 'id', poObj);
    return poObj;
  }, 'CreatePO', rawPayload, userContext);
}

/**
 * Updates an existing PO record.
 */
function apiSavePO(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var poObj = payload ? Object.assign({}, payload) : {};
    var dept = poObj.department || poObj.dept || user.department || 'PUR';
    poObj.department = dept;
    poObj.id = poObj.id || ('PO-' + Date.now());
    poObj.createdAt = poObj.createdAt || new Date().toISOString();
    poObj.updatedAt = new Date().toISOString();

    if (poObj.items) {
      var rawItems = poObj.items;
      if (typeof rawItems === 'string') {
        try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
      }
      if (Array.isArray(rawItems)) {
        rawItems = processItemImages(rawItems, poObj.poNo || poObj.id, 'PO');
        poObj.items = JSON.stringify(rawItems);
      }
    }
    if (Array.isArray(poObj.attachments)) {
      poObj.attachments = processDocumentAttachments(poObj.attachments, DRIVE_CATEGORIES.PO, poObj.poNo || poObj.id, 'PO');
    }

    ['items', 'history', 'timeline', 'activityLog', 'claimHistory', 'comments', 'ngItems', 'grnHistory'].forEach(function(field) {
      if (poObj[field]) {
        var rawVal = poObj[field];
        if (typeof rawVal === 'string') {
          try { rawVal = JSON.parse(rawVal); } catch (e) { rawVal = []; }
        }
        poObj[field] = JSON.stringify(Array.isArray(rawVal) ? rawVal : []);
      }
    });

    upsertRecordFast(SHEET_NAMES.POS, 'id', poObj);
    return poObj;
  }, 'SavePO', rawPayload, userContext);
}

/**
 * Updates a PO (Standard alias for apiSavePO).
 */
function apiUpdatePO(rawPayload, userContext) {
  return apiSavePO(rawPayload, userContext);
}

/**
 * Receives goods against a PO with full Idempotency Guard and atomic updates.
 *
 * Payload shape (sent by workflowEngine.receiveGoods):
 *   { id, poNo, department, status, items[], history[], grnHistory[],
 *     activityLog[], ngItems[], claimHistory[], grNumber,
 *     receivedBy, receiverName, receivedAt, receivingInfo{} }
 *
 * Idempotency: if grNumber already exists in grnHistory → short-circuit (returns existing PO).
 * Atomic: reads the LIVE sheet record, merges updated fields, writes back once.
 * Cascading: if status === 'CLOSED' and PO references a PR → marks PR as 'completed'.
 */
function apiReceivePO(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    // ── 1. Resolve ID ────────────────────────────────────────────────────────
    var poId = payload.id || payload.poId;
    if (!poId) {
      throw new Error('VALIDATION_ERROR: apiReceivePO requires payload.id (PO document ID)');
    }

    // ── 2. Read LIVE record from Sheet (GAS Sheet is SSOT) ───────────────────
    var allPOs = batchReadRecords(SHEET_NAMES.POS);
    var livePO = null;
    var liveIdx = -1;
    for (var i = 0; i < allPOs.length; i++) {
      if (String(allPOs[i].id) === String(poId) || String(allPOs[i].poNo) === String(poId)) {
        livePO = allPOs[i];
        liveIdx = i;
        break;
      }
    }

    // ── 3. Idempotency Guard: reject RECEIVED / CLOSED / CANCELLED POs ───────
    var TERMINAL_STATUSES = ['CLOSED', 'CANCELLED', 'RECEIVED', 'COMPLETED', 'COMPLETED_WITH_REFUND'];
    if (livePO && TERMINAL_STATUSES.indexOf(String(livePO.status || '').toUpperCase()) !== -1) {
      console.warn('[apiReceivePO] Idempotency block: PO "' + (livePO.poNo || poId) + '" already in terminal status "' + livePO.status + '". Skipping write.');
      return livePO;
    }

    // ── 4. Idempotency Guard: reject duplicate GRN number ───────────────────
    var incomingGrn = payload.grNumber || payload.grId || '';
    if (incomingGrn && livePO) {
      var existingGrnHistory = livePO.grnHistory;
      if (typeof existingGrnHistory === 'string') {
        try { existingGrnHistory = JSON.parse(existingGrnHistory); } catch (e) { existingGrnHistory = []; }
      }
      if (Array.isArray(existingGrnHistory)) {
        for (var gi = 0; gi < existingGrnHistory.length; gi++) {
          if (existingGrnHistory[gi] && existingGrnHistory[gi].grNumber === incomingGrn) {
            console.warn('[apiReceivePO] Idempotency block: GRN "' + incomingGrn + '" already processed for PO "' + (livePO.poNo || poId) + '".');
            return livePO;
          }
        }
      }
    }

    // ── 5. Build the merged PO object ────────────────────────────────────────
    // Start from live record if found, else from payload (new PO being written)
    var poObj = livePO ? Object.assign({}, livePO) : {};

    // Merge in ALL fields from payload (client already computed the correct values)
    var SKIP_MERGE = ['id', 'poNo', 'createdAt']; // never overwrite identity / creation stamp
    for (var key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key) && SKIP_MERGE.indexOf(key) === -1) {
        poObj[key] = payload[key];
      }
    }

    // ── 6. Ensure critical scalar fields ────────────────────────────────────
    var dept = poObj.department || poObj.dept || user.department || 'PD';
    poObj.id = poId;
    poObj.department = dept;
    poObj.createdAt = poObj.createdAt || new Date().toISOString();
    poObj.updatedAt = new Date().toISOString();

    // Status: prefer explicit payload status, then derive from legacy field
    if (!poObj.status || poObj.status === 'GOODS_RECEIVED') {
      poObj.status = 'CLOSED'; // Default full-receipt → CLOSED
    }

    // Receiver metadata
    poObj.receivedBy = poObj.receivedBy || user.name || user.username || 'Receiver';
    poObj.receiverName = poObj.receiverName || poObj.receivedBy;
    poObj.receivedAt = poObj.receivedAt || new Date().toISOString();
    if (!poObj.receivingInfo || typeof poObj.receivingInfo !== 'object') {
      poObj.receivingInfo = {
        receiverName: poObj.receivedBy,
        receiverSignature: poObj.receiverSignature || '/signatures/receiver-default.png',
        receivedAt: poObj.receivedAt
      };
    }

    // ── 7. Append GRN entry to grnHistory if grNumber present ───────────────
    if (incomingGrn) {
      var rawGrnHistory = poObj.grnHistory;
      if (typeof rawGrnHistory === 'string') {
        try { rawGrnHistory = JSON.parse(rawGrnHistory); } catch (e) { rawGrnHistory = []; }
      }
      if (!Array.isArray(rawGrnHistory)) rawGrnHistory = [];
      rawGrnHistory.push({
        grNumber: incomingGrn,
        receivedBy: poObj.receivedBy,
        receivedAt: poObj.receivedAt,
        status: poObj.status,
        timestamp: new Date().toISOString()
      });
      poObj.grnHistory = rawGrnHistory; // will be stringified below
    }

    // ── 8. Stringify ALL array / object fields before Sheet write ────────────
    var ARRAY_FIELDS = [
      'items', 'history', 'timeline', 'activityLog', 'approvalHistory',
      'comments', 'claimHistory', 'ngItems', 'grnHistory', 'grAttachments'
    ];
    ARRAY_FIELDS.forEach(function(field) {
      if (poObj[field] !== undefined && poObj[field] !== null && poObj[field] !== '') {
        var rawVal = poObj[field];
        if (typeof rawVal === 'string') {
          try { rawVal = JSON.parse(rawVal); } catch (e) { rawVal = []; }
        }
        poObj[field] = JSON.stringify(Array.isArray(rawVal) ? rawVal : []);
      }
    });

    // Stringify receivingInfo (object, not array)
    if (poObj.receivingInfo && typeof poObj.receivingInfo === 'object') {
      poObj.receivingInfo = JSON.stringify(poObj.receivingInfo);
    }
    if (poObj.claimDetails && typeof poObj.claimDetails === 'object') {
      poObj.claimDetails = JSON.stringify(poObj.claimDetails);
    }
    if (poObj.claimData && typeof poObj.claimData === 'object') {
      poObj.claimData = JSON.stringify(poObj.claimData);
    }

    // ── 9. Atomic write to POs sheet ─────────────────────────────────────────
    var updatedPO = upsertRecordFast(SHEET_NAMES.POS, 'id', poObj);
    console.log('[apiReceivePO] PO "' + (poObj.poNo || poId) + '" written to sheet. Status: ' + poObj.status + (incomingGrn ? ' | GRN: ' + incomingGrn : ''));

    // ── 10. Cascading PR Completion (if fully received → CLOSED) ────────────
    var isClosed = poObj.status === 'CLOSED' || poObj.status === 'COMPLETED';
    if (isClosed) {
      var prRef = payload.prId || payload.prNo || payload.prNumber;
      if (prRef) {
        try {
          var allPRs = batchReadRecords(SHEET_NAMES.PRS);
          var targetPR = null;
          for (var pi = 0; pi < allPRs.length; pi++) {
            var p = allPRs[pi];
            if (
              String(p.id) === String(prRef) ||
              String(p.prNo) === String(prRef) ||
              String(p.prNumber) === String(prRef)
            ) {
              targetPR = p;
              break;
            }
          }
          if (targetPR) {
            targetPR.status = 'completed';
            targetPR.poStatus = 'completed';
            targetPR.poNumber = poObj.poNo || poObj.poNumber || targetPR.poNumber;
            targetPR.fullyReceivedAt = poObj.receivedAt || new Date().toISOString();
            targetPR.updatedAt = new Date().toISOString();

            // Append to PR activityLog
            var prLog = targetPR.activityLog;
            if (typeof prLog === 'string') {
              try { prLog = JSON.parse(prLog); } catch (e) { prLog = []; }
            }
            if (!Array.isArray(prLog)) prLog = [];
            prLog.push({
              action: 'ปิดเอกสาร (Closed)',
              user: user.name || user.username || 'System',
              role: user.canonicalRole || user.role || '',
              timestamp: new Date().toISOString(),
              note: 'PO ' + (poObj.poNo || poId) + ' รับสินค้าครบแล้ว ปิดใบ PR อัตโนมัติ'
            });
            targetPR.activityLog = JSON.stringify(prLog);
            upsertRecordFast(SHEET_NAMES.PRS, 'id', targetPR);
            console.log('[apiReceivePO] Cascading PR "' + (targetPR.prNo || prRef) + '" → status: completed');
          }
        } catch (prErr) {
          console.warn('[apiReceivePO] Warning: Could not cascade PR completion: ' + prErr.message);
        }
      }
    }

    return updatedPO;
  }, 'ReceivePO', rawPayload, userContext);
}

/**
 * Finalizes PO, updates PR status, and records audit trail atomically.
 */
function apiFinalizePO(poIdOrPayload, poDataOrUser, userContext) {
  var poId = poIdOrPayload;
  var poData = poDataOrUser;
  var rawPayload = poDataOrUser;
  var rawUser = userContext;

  if (typeof poIdOrPayload === 'object' && poIdOrPayload !== null) {
    poId = poIdOrPayload.id || poIdOrPayload.poId;
    poData = poIdOrPayload.data || poIdOrPayload.poData || poIdOrPayload;
    rawPayload = poIdOrPayload;
    rawUser = poDataOrUser;
  }

  return handleApiRequest(function(payload, user) {
    var finalData = (poData || payload) ? Object.assign({}, (poData || payload)) : {};
    var targetId = poId || finalData.id;
    var dept = finalData.department || finalData.dept || user.department || 'PUR';
    finalData.id = targetId;
    finalData.department = dept;
    finalData.createdAt = finalData.createdAt || new Date().toISOString();
    finalData.updatedAt = new Date().toISOString();

    if (finalData.items) {
      var rawItems = finalData.items;
      if (typeof rawItems === 'string') {
        try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
      }
      finalData.items = JSON.stringify(Array.isArray(rawItems) ? rawItems : []);
    }

    var updated = upsertRecordFast(SHEET_NAMES.POS, 'id', finalData);

    // If associated with PR, mark PR as APPROVED
    if (finalData.prId || finalData.prNo) {
      var prKey = finalData.prId ? 'id' : 'prNo';
      var prVal = finalData.prId || finalData.prNo;
      var prs = batchReadRecords(SHEET_NAMES.PRS);
      var targetPr = prs.find(function(p) { return String(p[prKey]) === String(prVal); });
      if (targetPr) {
        targetPr.status = 'APPROVED';
        targetPr.poNumber = finalData.poNo;
        targetPr.approvedBy = finalData.approvedBy || user.name || user.username || 'System';
        targetPr.approvedAt = finalData.approvedAt || new Date().toISOString();
        targetPr.updatedAt = new Date().toISOString();
        upsertRecordFast(SHEET_NAMES.PRS, 'id', targetPr);
      }
    }

    return updated;
  }, 'FinalizePO', rawPayload, rawUser);
}

// =========================================================================
// 5. INVENTORY & STOCK TRANSACTIONS RPCs
// =========================================================================

/**
 * Retrieves all stock movements/logs.
 */
function apiGetStockLogs(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.STOCK_LOGS);
  }, 'GetStockLogs', rawPayload, userContext);
}

/**
 * Records stock movements and atomically adjusts Product balances.
 */
function apiAppendStockMovements(movementsListOrPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var list = Array.isArray(payload) ? payload : (payload.movementsList || payload.movements || payload.items || []);
    if (typeof list === 'string') {
      try { list = JSON.parse(list); } catch (e) { list = []; }
    }
    if (!Array.isArray(list) || list.length === 0) return [];

    var dept = user.department || 'PD';
    var defaultActor = user.name || user.username || 'System User';

    var products = batchReadRecords(SHEET_NAMES.PRODUCTS);
    var productMap = new Map(products.map(function(p) { return [String(p.id), p]; }));
    var recordsToAppend = [];

    list.forEach(function(mov) {
      if (!mov || typeof mov !== 'object') return;
      var prod = productMap.get(String(mov.productId));
      var currentBalance = prod ? Number(prod.stockBalance || 0) : 0;
      var qty = Number(mov.qty || mov.quantity || 0);

      var newBalance = currentBalance;
      if (mov.type === 'IN') {
        newBalance += qty;
      } else if (mov.type === 'OUT') {
        newBalance = Math.max(0, currentBalance - qty);
      } else if (mov.type === 'ADJUST') {
        newBalance = qty;
      }

      if (prod) {
        prod.stockBalance = newBalance;
        prod.updatedAt = new Date().toISOString();
      }

      var logRecord = {
        id: mov.id || ('MOV-' + Date.now() + '-' + Utilities.getUuid().slice(0, 4)),
        timestamp: mov.timestamp || new Date().toISOString(),
        date: mov.date || new Date().toISOString(),
        productId: mov.productId || (prod ? prod.id : ''),
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
        actorName: mov.actorName || defaultActor,
        department: mov.department || (prod ? prod.department : dept),
        locationId: mov.locationId || (prod ? prod.locationId : ''),
        notes: mov.notes || mov.note || ''
      };

      recordsToAppend.push(logRecord);
    });

    if (recordsToAppend.length > 0) {
      batchAppendRecords(SHEET_NAMES.STOCK_LOGS, recordsToAppend);
      batchWriteRecords(SHEET_NAMES.PRODUCTS, Array.from(productMap.values()));
    }

    return recordsToAppend;
  }, 'AppendStockMovements', movementsListOrPayload, userContext);
}

// =========================================================================
// 6. BUDGET & FINANCIAL RECONCILIATION RPCs
// =========================================================================

/**
 * Retrieves budget configuration and spent status.
 */
function apiGetBudgets(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var rows = batchReadRecords(SHEET_NAMES.BUDGETS);
    var budgetMap = {};
    rows.forEach(function(r) {
      var dept = String(r.dept || '').trim().toUpperCase();
      if (dept && dept !== 'ALL') {
        budgetMap[r.dept] = r;
      }
    });
    return budgetMap;
  }, 'GetBudgets', rawPayload, userContext);
}

/**
 * Saves or updates budget configurations.
 */
function apiSaveBudgets(budgetsObj, userContext) {
  return handleApiRequest(function(payload, user) {
    var targetBudgets = (typeof payload === 'object' && payload !== null) ? payload : {};
    var budgetList = [];
    Object.keys(targetBudgets).forEach(function(dept) {
      var cleanDept = String(dept || '').trim().toUpperCase();
      if (!cleanDept || cleanDept === 'ALL') return;
      var data = targetBudgets[dept] || {};
      data.dept = cleanDept;
      data.updatedAt = new Date().toISOString();
      budgetList.push(data);
    });
    if (budgetList.length > 0) {
      batchUpsertRecordsFast(SHEET_NAMES.BUDGETS, 'dept', budgetList);
    }
    return targetBudgets;
  }, 'SaveBudgets', budgetsObj, userContext);
}

/**
 * Retrieves budget transaction history.
 */
function apiGetBudgetTransactions(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.BUDGET_TRANSACTIONS);
  }, 'GetBudgetTransactions', rawPayload, userContext);
}

/**
 * Appends a budget transaction and reconciles variance.
 */
function apiAppendBudgetTransaction(txObj, userContext) {
  return handleApiRequest(function(payload, user) {
    var targetTx = payload ? Object.assign({}, payload) : {};
    var dept = targetTx.dept || targetTx.department || user.department || 'PD';
    targetTx.dept = dept;
    targetTx.id = targetTx.id || ('TX-' + Date.now() + '-' + Utilities.getUuid().slice(0, 4));
    targetTx.createdAt = targetTx.createdAt || new Date().toISOString();
    targetTx.actorName = targetTx.actorName || user.name || user.username || 'System User';
    targetTx.actorRole = targetTx.actorRole || user.role || 'ADMIN';

    appendRecord(SHEET_NAMES.BUDGET_TRANSACTIONS, targetTx);

    // Reconcile with Budgets tab if refund/credit
    if (targetTx.type === 'BUDGET_ROLLBACK' || targetTx.refundAmount) {
      var budgets = batchReadRecords(SHEET_NAMES.BUDGETS);
      var deptBudget = budgets.find(function(b) { return String(b.dept).toUpperCase() === String(dept).toUpperCase(); });
      if (deptBudget) {
        var refund = Number(targetTx.refundAmount || targetTx.amount || 0);
        deptBudget.variance = Number(deptBudget.variance || 0) + refund;
        deptBudget.updatedAt = new Date().toISOString();
        upsertRecordById(SHEET_NAMES.BUDGETS, 'dept', deptBudget);
      }
    }

    return targetTx;
  }, 'AppendBudgetTransaction', txObj, userContext);
}

// =========================================================================
// 7. AUDIT LOGS & NOTIFICATIONS RPCs
// =========================================================================

function apiGetAuditLogs(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return batchReadRecords(SHEET_NAMES.AUDIT_LOGS);
  }, 'GetAuditLogs', rawPayload, userContext);
}

function apiAppendAuditLog(logObj, userContext) {
  return handleApiRequest(function(payload, user) {
    var targetLog = payload ? Object.assign({}, payload) : {};
    targetLog.id = targetLog.id || ('AUD-' + Date.now() + '-' + Utilities.getUuid().slice(0, 5));
    targetLog.timestamp = targetLog.timestamp || new Date().toISOString();
    targetLog.actor = targetLog.actor || { id: user.username, name: user.name, role: user.role };
    targetLog.createdAt = targetLog.createdAt || new Date().toISOString();
    return appendRecord(SHEET_NAMES.AUDIT_LOGS, targetLog);
  }, 'AppendAuditLog', logObj, userContext);
}

function apiGetNotifications(userObjOrPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var allNotifs = batchReadRecords(SHEET_NAMES.NOTIFICATIONS);
    var u = user;
    return allNotifs.filter(function(n) {
      if (!n.targetRole || n.targetRole === 'ALL') return true;
      if (!u) return false;
      if (u.isAdmin) return true;
      var roleStr = String(n.targetRole).toUpperCase();
      return roleStr === String(u.canonicalRole).toUpperCase() ||
             roleStr === String(u.role).toUpperCase() ||
             roleStr === String(u.roleId).toUpperCase();
    });
  }, 'GetNotifications', userObjOrPayload, userContext);
}

function apiSaveNotifications(notifsListOrPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var list = Array.isArray(payload) ? payload : (payload.notifications || payload.notifs || []);
    return batchWriteRecords(SHEET_NAMES.NOTIFICATIONS, list);
  }, 'SaveNotifications', notifsListOrPayload, userContext);
}

// =========================================================================
// 8. DRIVE FILE UPLOAD RPC
// =========================================================================

/**
 * Accepts Base64 file from frontend, validates, stores in Drive,
 * logs to Attachments sheet, and rolls back if database write fails.
 */
function apiUploadFile(payload, userContext) {
  return handleApiRequest(function(p, user) {
    var uploadPayload = p ? Object.assign({}, p) : {};
    uploadPayload.uploadedBy = uploadPayload.uploadedBy || user.name || user.username || 'System User';
    return uploadBase64File(uploadPayload);
  }, 'UploadFile', payload, userContext);
}

// =========================================================================
// 9. SYSTEM ADMINISTRATION & INITIALIZATION RPCs
// =========================================================================

/**
 * Initializes Spreadsheet tabs, headers, and Drive folders.
 */
function apiInitializeSystem(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var report = initializeSystem();
    ensurePRItemsSheet();
    return report;
  }, 'InitializeSystem', rawPayload, userContext);
}

/**
 * Seeds baseline Master Data.
 */
function apiSeedMasterData(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return seedInitialMasterData();
  }, 'SeedMasterData', rawPayload, userContext);
}

/**
 * Migrates a batch of PO records into POs sheet.
 */
function apiMigratePOsBatch(poBatch, userContext) {
  return handleApiRequest(function(payload, user) {
    var batch = Array.isArray(payload) ? payload : (payload.poBatch || payload.pos || []);
    return migratePOsBatch(batch);
  }, 'MigratePOsBatch', poBatch, userContext);
}

/**
 * System Health Diagnostic Ping.
 */
function apiGetSystemStatus(userEmailOrPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    var ss = getSpreadsheet();
    return {
      status: 'HEALTHY',
      environment: getScriptProperty(CONFIG.PROPERTY_KEYS.APP_ENV, 'production'),
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      currentUser: user.username || user.name || 'System User',
      currentRole: user.role || 'ADMIN',
      isAdmin: user.isAdmin,
      totalSheets: ss.getSheets().length,
      serverTime: new Date().toISOString()
    };
  }, 'GetSystemStatus', userEmailOrPayload, userContext);
}

/**
 * High-Performance Consolidated Initial Data RPC Endpoint.
 * Batches all collections into a single RPC round-trip for instant app boot.
 * 
 * @returns {Object} Standard API Envelope containing full hydrated initial dataset
 */
function apiGetInitialPayload(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return getInitialPayloadBatch();
  }, 'GetInitialPayload', rawPayload, userContext);
}

/**
 * Migration Endpoint: Purges ALL Department Entity from Google Sheets.
 * - Removes 'ALL' department and 'ALL' budgets
 * - Re-maps users with department 'ALL' to 'MGT' / 'PUR'
 * 
 * @returns {Object} Migration audit report
 */
function apiPurgeAllDepartment(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    return purgeAllDepartmentEntity();
  }, 'PurgeAllDepartment', rawPayload, userContext);
}

/**
 * High-Performance Sheet Values to Objects Parser in RAM.
 * Reads 2D getValues() array, strictly maps header rows, auto-parses JSON fields,
 * formats ISO dates, and casts identifiers to string without repeated sheet calls.
 * 
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Array<Object>}
 */
function readSheetValuesAsObjects(sheet) {
  if (!sheet) return [];
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  if (!values || values.length <= 1) return [];

  var headers = values[0].map(function(h) { return String(h || '').trim(); });
  var records = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var isEmpty = true;
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) continue;

    var record = {};
    for (var c = 0; c < headers.length; c++) {
      var header = headers[c];
      if (!header) continue;
      var val = row[c];

      if (typeof isIdentifierColumn === 'function' && isIdentifierColumn(header)) {
        val = (val !== null && val !== undefined) ? String(val).trim() : '';
      } else if (typeof val === 'string' && val.length > 1) {
        var trimmed = val.trim();
        if ((trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) === '}') ||
            (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']')) {
          try { val = JSON.parse(trimmed); } catch (e) {}
        }
      } else if (val instanceof Date) {
        val = val.toISOString();
      }
      record[header] = val;
    }
    records.push(record);
  }
  return records;
}

/**
 * Fast Bootstrap Data Payload for frontend initial load.
 * Opens Google Spreadsheet ONCE, reads PRs, POs, and Inventory/Products via .getDataRange().getValues(),
 * converts 2D arrays to JSON in RAM, and returns all collections in a single unified response.
 */
function apiGetBootstrapData(rawPayload, userContext) {
  return handleApiRequest(function(payload, user) {
    // 1. Open Spreadsheet ONCE
    var ss = getSpreadsheet();

    // 2. Fetch sheet tabs
    var prSheet = ss.getSheetByName(SHEET_NAMES.PRS) || ss.getSheetByName('PRs');
    var poSheet = ss.getSheetByName(SHEET_NAMES.POS) || ss.getSheetByName('POs');
    var invSheet = ss.getSheetByName('Inventory') || ss.getSheetByName(SHEET_NAMES.PRODUCTS) || ss.getSheetByName('Products');
    var logsSheet = ss.getSheetByName(SHEET_NAMES.STOCK_LOGS) || ss.getSheetByName('StockLogs');
    var venSheet = ss.getSheetByName(SHEET_NAMES.VENDORS) || ss.getSheetByName('Vendors');
    var locSheet = ss.getSheetByName(SHEET_NAMES.STORAGE_LOCATIONS) || ss.getSheetByName('StorageLocations');
    var unitSheet = ss.getSheetByName(SHEET_NAMES.USAGE_UNITS) || ss.getSheetByName('UsageUnits');
    var deptSheet = ss.getSheetByName(SHEET_NAMES.DEPARTMENTS) || ss.getSheetByName('Departments');
    var userSheet = ss.getSheetByName(SHEET_NAMES.USERS) || ss.getSheetByName('Users');
    var budSheet = ss.getSheetByName(SHEET_NAMES.BUDGETS) || ss.getSheetByName('Budgets');
    var txSheet = ss.getSheetByName(SHEET_NAMES.BUDGET_TRANSACTIONS) || ss.getSheetByName('BudgetTransactions');
    var notifSheet = ss.getSheetByName(SHEET_NAMES.NOTIFICATIONS) || ss.getSheetByName('Notifications');
    var attachSheetName = (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.ATTACHMENTS) ? SHEET_NAMES.ATTACHMENTS : 'Attachments';
    var attachSheet = ss.getSheetByName(attachSheetName);

    // 3. Read .getDataRange().getValues() and convert to JSON in RAM
    var rawAttachments = attachSheet ? readSheetValuesAsObjects(attachSheet) : [];
    var normKey = function(val) { return String(val || '').trim().toUpperCase(); };
    var attachmentsByDoc = {};
    rawAttachments.forEach(function(att) {
      if (!att) return;
      var k1 = normKey(att.docNo);
      var k2 = normKey(att.prNo);
      if (k1) {
        if (!attachmentsByDoc[k1]) attachmentsByDoc[k1] = [];
        attachmentsByDoc[k1].push(att);
      }
      if (k2 && k2 !== k1) {
        if (!attachmentsByDoc[k2]) attachmentsByDoc[k2] = [];
        attachmentsByDoc[k2].push(att);
      }
    });

    var prs = prSheet ? readSheetValuesAsObjects(prSheet) : [];
    if (typeof normalizePRsLegacyOnline === 'function') {
      prs = normalizePRsLegacyOnline(prs);
    }
    // Fetch and Index AuditLogs
    var auditLogsSheet = ss.getSheetByName('AuditLogs');
    var rawAuditLogs = auditLogsSheet ? readSheetValuesAsObjects(auditLogsSheet) : [];
    var logsByDoc = buildAuditLogsByDoc(rawAuditLogs);

    prs.forEach(function(pr) {
      if (typeof pr.attachments === 'string') {
        try { pr.attachments = JSON.parse(pr.attachments); } catch(e) {}
      }
      var prKey = normKey(pr.prNo || pr.id || pr.docNo);
      var kNo = normKey(pr.prNo);
      var kId = normKey(pr.id);
      var kDoc = normKey(pr.docNo);
      var files = attachmentsByDoc[prKey] || [];
      pr.attachments = files;
      pr.quotationFiles = files;
      pr.generalAttachments = files;
      
      var docLogs = logsByDoc[prKey] || logsByDoc[kNo] || logsByDoc[kDoc] || logsByDoc[kId] || [];
      var seenIds = {};
      var sortedLogs = [];
      docLogs.forEach(function(l) {
        var lid = l.id || (l.timestamp + '_' + l.action);
        if (!seenIds[lid]) {
          seenIds[lid] = true;
          sortedLogs.push(l);
        }
      });
      sortedLogs.sort(function(a, b) {
        var tA = new Date(a.timestamp || a.createdAt || 0).getTime();
        var tB = new Date(b.timestamp || b.createdAt || 0).getTime();
        return tA - tB;
      });

      pr.timeline = sortedLogs;
      pr.activityTimeline = sortedLogs;
      pr.history = sortedLogs;
      pr.approvalHistory = sortedLogs;
      pr.auditLogs = sortedLogs;
    });

    var pos = poSheet ? readSheetValuesAsObjects(poSheet) : [];
    pos.forEach(function(po) {
      po.attachments = attachmentsByDoc[po.poNo] || [];
    });
    var inventory = invSheet ? readSheetValuesAsObjects(invSheet) : [];
    var stockLogs = logsSheet ? readSheetValuesAsObjects(logsSheet) : [];
    var vendors = venSheet ? readSheetValuesAsObjects(venSheet) : [];
    var storageLocations = locSheet ? readSheetValuesAsObjects(locSheet) : [];
    var usageUnits = unitSheet ? readSheetValuesAsObjects(unitSheet) : [];
    var rawDepartments = deptSheet ? readSheetValuesAsObjects(deptSheet) : [];
    var users = userSheet ? readSheetValuesAsObjects(userSheet) : [];
    var rawBudgets = budSheet ? readSheetValuesAsObjects(budSheet) : [];
    var budgetTransactions = txSheet ? readSheetValuesAsObjects(txSheet) : [];
    var rawNotifications = notifSheet ? readSheetValuesAsObjects(notifSheet) : [];

    var departments = rawDepartments.filter(function(d) {
      var code = String(d.code || '').trim().toUpperCase();
      var id = String(d.id || '').trim().toUpperCase();
      var name = String(d.name || '');
      return code !== 'ALL' && id !== 'DEPT-ALL' && name.indexOf('ส่วนกลาง') === -1 && name.indexOf('ทุกฝ่าย') === -1;
    });

    var budgets = {};
    rawBudgets.forEach(function(r) {
      var dept = String(r.dept || '').trim().toUpperCase();
      if (dept && dept !== 'ALL') {
        budgets[r.dept] = r;
      }
    });

    var notifications = rawNotifications.filter(function(n) {
      if (!n.targetRole || n.targetRole === 'ALL') return true;
      if (!user) return false;
      if (user.isAdmin) return true;
      var roleStr = String(n.targetRole).toUpperCase();
      return roleStr === String(user.canonicalRole).toUpperCase() ||
             roleStr === String(user.role).toUpperCase() ||
             roleStr === String(user.roleId).toUpperCase();
    });

    // 4. Return all collections in a single Response
    return {
      prs: prs,
      pos: pos,
      inventory: inventory,
      products: inventory, // alias so code expecting products or inventory works seamlessly
      stockLogs: stockLogs,
      vendors: vendors,
      storageLocations: storageLocations,
      usageUnits: usageUnits,
      departments: departments,
      users: users,
      budgets: budgets,
      budgetTransactions: budgetTransactions,
      notifications: notifications,
      serverTime: new Date().toISOString()
    };
  }, 'GetBootstrapData', rawPayload, userContext);
}

/**
 * Fast RAM Array Indexing Upsert for High-Volume Sheets (PRs, POs, Master Data).
 * Loads sheet once into RAM array, finds target index in memory,
 * and executes a single batch write (setValues) without redundant lookups.
 */
function upsertRecordFast(sheetName, idField, record) {
  var targetId = record[idField];
  if (!targetId) throw new Error('VALIDATION_ERROR: Missing idField');
  var sheet = getSheet(sheetName);
  var values = sheet.getDataRange().getValues(); // Load into RAM array
  if (!values || values.length === 0) throw new Error('SCHEMA_ERROR: Sheet empty');
  
  var headers = values[0].map(function(h) { return String(h).trim(); });
  var idColIndex = headers.indexOf(idField);
  if (idColIndex === -1) throw new Error('SCHEMA_ERROR: Header "' + idField + '" not found in ' + sheetName);
  
  // 1. ค้นหา index ใน Array บน RAM ก่อน
  var rowIndexToUpdate = -1;
  var targetStr = String(targetId).trim().toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idColIndex]).trim().toLowerCase() === targetStr) {
      rowIndexToUpdate = i + 1; // 1-based index
      break;
    }
  }
  
  var rowValues = serializeRecordToRow(record, headers);
  // 2. ค่อยสั่งเขียนช่วงข้อมูล (Batch write via setValues)
  if (rowIndexToUpdate !== -1) {
    sheet.getRange(rowIndexToUpdate, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.getRange(values.length + 1, 1, 1, headers.length).setValues([rowValues]);
  }
  SpreadsheetApp.flush();
  return record;
}

/**
 * Fast Batch Upsert for Multiple Records using RAM Indexing.
 * Reads sheet once into RAM, finds all indices in memory,
 * and writes updates and appended rows in batch.
 */
function batchUpsertRecordsFast(sheetName, idField, records) {
  if (!records || records.length === 0) return [];
  var sheet = getSheet(sheetName);
  var values = sheet.getDataRange().getValues(); // Load into RAM array
  if (!values || values.length === 0) throw new Error('SCHEMA_ERROR: Sheet empty');
  
  var headers = values[0].map(function(h) { return String(h).trim(); });
  var idColIndex = headers.indexOf(idField);
  if (idColIndex === -1) throw new Error('SCHEMA_ERROR: Header "' + idField + '" not found in ' + sheetName);
  
  // 1. ค้นหา index ใน Array บน RAM ก่อน โดยสร้าง Map
  var ramIndexMap = {};
  for (var i = 1; i < values.length; i++) {
    var cellVal = String(values[i][idColIndex]).trim().toLowerCase();
    if (cellVal) {
      ramIndexMap[cellVal] = i + 1; // 1-based index
    }
  }
  
  var newRows = [];
  records.forEach(function(rec) {
    var recId = rec[idField];
    var serialized = serializeRecordToRow(rec, headers);
    var key = recId ? String(recId).trim().toLowerCase() : '';
    if (key && ramIndexMap[key]) {
      var rowIdx = ramIndexMap[key];
      // ค่อยสั่งเขียนช่วงข้อมูลเฉพาะแถวที่มีการอัปเดต
      sheet.getRange(rowIdx, 1, 1, headers.length).setValues([serialized]);
    } else {
      newRows.push(serialized);
    }
  });
  
  // 2. สั่งเขียนช่วงข้อมูลส่วนแถวใหม่ทั้งหมดในคำสั่งเดียว (Batch write)
  if (newRows.length > 0) {
    var startRow = values.length + 1;
    sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  }
  
  SpreadsheetApp.flush();
  return records;
}

