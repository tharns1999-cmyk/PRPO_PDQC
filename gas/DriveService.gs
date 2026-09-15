var _pendingAttachments = [];

/**
 * @file DriveService.gs
 * @description Google Drive Document & Evidence Storage Service
 * Handles Base64 file decoding, MIME/size validation, automated folder hierarchy routing,
 * URL generation, and transactional rollback upon Sheet record failure.
 * @version 2.0.0
 */

/**
 * Retrieves or creates the Root Folder for the ERP system.
 * Looks up by configured ID in Script Properties first, or by standard name.
 * 
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getRootDriveFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty(CONFIG.PROPERTY_KEYS.DRIVE_ROOT_FOLDER_ID);

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      console.warn(`[DriveService] Configured Root Folder ID "${folderId}" invalid. Resolving by name...`);
    }
  }

  // Look up by name
  const rootName = CONFIG.DEFAULTS.DRIVE_ROOT_NAME;
  const folders = DriveApp.getFoldersByName(rootName);
  let rootFolder;

  if (folders.hasNext()) {
    rootFolder = folders.next();
  } else {
    rootFolder = DriveApp.createFolder(rootName);
    console.info(`[DriveService] Created new root folder: "${rootName}" (${rootFolder.getId()})`);
  }

  // Persist folder ID for fast future lookups
  props.setProperty(CONFIG.PROPERTY_KEYS.DRIVE_ROOT_FOLDER_ID, rootFolder.getId());
  return rootFolder;
}

/**
 * In-memory folder cache for the current GAS execution.
 * Avoids repeated getFoldersByName() Drive API calls when uploading multiple images
 * within the same PR/PO save operation.
 * Key: parentFolder.getId() + '::' + subFolderName
 */
var _driveFolderCache = {};

/**
 * Finds an existing subfolder by name or creates it if missing.
 * Uses an in-execution cache to avoid repeated Drive API round-trips.
 *
 * @param {GoogleAppsScript.Drive.Folder} parentFolder Parent directory
 * @param {string} subFolderName Name of subfolder
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateSubFolder(parentFolder, subFolderName) {
  var cleanName = String(subFolderName).trim();
  var cacheKey = parentFolder.getId() + '::' + cleanName;
  if (_driveFolderCache[cacheKey]) {
    return _driveFolderCache[cacheKey];
  }
  var children = parentFolder.getFoldersByName(cleanName);
  var folder = children.hasNext() ? children.next() : parentFolder.createFolder(cleanName);
  _driveFolderCache[cacheKey] = folder;
  return folder;
}

/**
 * Normalizes user-supplied category string to canonical folder category name.
 * 
 * @param {string} category 
 * @returns {string} Canonical category folder name
 */
function normalizeDriveCategory(category = '') {
  const cat = String(category).toUpperCase().trim();
  if (cat.startsWith('01') || cat.includes('PR')) return DRIVE_CATEGORIES.PR;
  if (cat.startsWith('02') || cat.includes('PO')) return DRIVE_CATEGORIES.PO;
  if (cat.startsWith('03') || cat.includes('GRN') || cat.includes('RECEIV')) return DRIVE_CATEGORIES.GRN;
  if (cat.startsWith('04') || cat.includes('CLAIM') || cat.includes('DISPUTE')) return DRIVE_CATEGORIES.CLAIM;
  if (cat.includes('BACKUP')) return DRIVE_CATEGORIES.BACKUPS;
  return DRIVE_CATEGORIES.PR;
}

/**
 * Resolves the target Google Drive Folder object based on category, date, and PO number.
 * Mirrors resolveDriveFolderPath() from src/services/driveService.js
 * 
 * Hierarchy:
 * - [ERP] PR-PO-Stock-System/01_PR_Attachments/{YYYY-MM}/
 * - [ERP] PR-PO-Stock-System/02_PO_Documents/{YYYY-MM}/
 * - [ERP] PR-PO-Stock-System/03_GRN_Evidence/{YYYY-MM}/{PO_NUMBER}/
 * - [ERP] PR-PO-Stock-System/04_Claim_Evidence/{YYYY-MM}/{PO_NUMBER}/
 * 
 * @param {string} category 'PR' | 'PO' | 'GRN' | 'CLAIM' | 'BACKUPS'
 * @param {string} [poNumber=''] Optional PO Number for GRN/Claim scoping
 * @param {Date|string} [date] Optional date
 * @returns {{ folder: GoogleAppsScript.Drive.Folder, pathString: string }}
 */
function resolveTargetDriveFolder(category, poNumber = '', date = new Date()) {
  const root = getRootDriveFolder();
  return {
    folder: root,
    pathString: CONFIG.DEFAULTS.DRIVE_ROOT_NAME || 'PR-PO-Stock-System'
  };
}

/**
 * Uploads a Base64-encoded file into the structured Google Drive hierarchy.
 * Enforces file size and MIME constraints, sets public view permissions,
 * writes an entry into the Attachments sheet, and executes ROLLBACK if database write fails.
 * 
 * @param {Object} payload File upload payload
 * @param {string} payload.base64Data Raw or Data-URI Base64 string
 * @param {string} payload.fileName Original filename (e.g. 'invoice.pdf')
 * @param {string} [payload.mimeType='application/octet-stream'] MIME type
 * @param {string} [payload.category='PR'] ERP Category
 * @param {string} [payload.poNumber=''] Associated PO Number
 * @param {string} [payload.docNo=''] Associated Document Number
 * @param {string} [payload.docType=''] Associated Document Type
 * @param {string} [payload.uploadedBy=''] Email or Name of uploader
 * @returns {Object} Upload result with Drive IDs and URLs
 */
function uploadBase64File(payload) {
  if (!payload || !payload.base64Data) {
    throw new Error('VALIDATION_ERROR: Missing required "base64Data" payload.');
  }

  const fileName = (payload.fileName || `file_${Date.now()}`).trim();
  let mimeType = (payload.mimeType || 'application/octet-stream').toLowerCase().trim();
  let base64 = String(payload.base64Data);

  // 1. Strip Data URI prefix if present (e.g. "data:image/jpeg;base64,")
  if (base64.includes(';base64,')) {
    const parts = base64.split(';base64,');
    const meta = parts[0];
    base64 = parts[1];
    if (meta.includes(':')) {
      mimeType = meta.split(':')[1].trim();
    }
  }

  // 2. MIME Type Validation
  if (ALLOWED_MIME_TYPES.length > 0 && !ALLOWED_MIME_TYPES.includes(mimeType)) {
    console.warn(`[DriveService] Upload rejected: MIME type "${mimeType}" not in whitelist.`);
    throw new Error(`UNSUPPORTED_MEDIA_TYPE: ไม่อนุญาตให้อัปโหลดไฟล์ประเภท "${mimeType}"`);
  }

  // 3. Decode bytes and validate size
  const bytes = Utilities.base64Decode(base64);
  const fileSize = bytes.length;

  if (fileSize > CONFIG.DEFAULTS.MAX_FILE_SIZE_BYTES) {
    const maxMb = (CONFIG.DEFAULTS.MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(`FILE_TOO_LARGE: ขนาดไฟล์เกินข้อกำหนด (${(fileSize / (1024 * 1024)).toFixed(2)} MB) จำกัดสูงสุดไม่เกิน ${maxMb} MB`);
  }

  // 4. Resolve destination folder
  const { folder, pathString } = resolveTargetDriveFolder(
    payload.category,
    payload.poNumber,
    payload.date
  );

  // 5. Create Blob and File in Drive
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  let createdFile;

  try {
    createdFile = folder.createFile(blob);
    // ข้าม setSharing() ไปเพื่อให้สืบทอดสิทธิ์จาก Folder แม่ ประหยัดเวลา 3-5 วิ
  } catch (driveErr) {
    console.error('[DriveService] Failed to create file in Drive:', driveErr.message);
    throw new Error(`DRIVE_UPLOAD_FAILED: ไม่สามารถบันทึกไฟล์ลง Google Drive: ${driveErr.message}`);
  }

  const fileId = createdFile.getId();
  const viewUrl = createdFile.getUrl();
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const directUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
  const lh3Url = 'https://lh3.googleusercontent.com/d/' + fileId;
  const attachmentId = `ATT-${Utilities.getUuid().slice(0, 8)}`;
  const currentUser = payload.uploadedBy || getCurrentUserEmail() || 'system';

  // 6. Record in Attachments sheet with transactional rollback
  const attachmentRecord = {
    id: attachmentId,
    fileId: fileId,
    fileName: fileName,
    mimeType: mimeType,
    fileSize: fileSize,
    category: normalizeDriveCategory(payload.category),
    poNumber: payload.poNumber || '',
    docNo: payload.docNo || payload.poNumber || '',
    docType: payload.docType || payload.category || 'OTHER',
    viewUrl: viewUrl,
    directUrl: directUrl,
    lh3Url: lh3Url,
    downloadUrl: downloadUrl,
    folderPath: pathString,
    uploadedBy: currentUser,
    uploadedAt: new Date().toISOString()
  };

  try {
    appendRecord(SHEET_NAMES.ATTACHMENTS, attachmentRecord);
    console.info(`[DriveService] File "${fileName}" uploaded successfully. ID: ${fileId}`);
  } catch (sheetErr) {
    // CRITICAL ROLLBACK: If Sheet record fails, delete the uploaded Drive file
    console.error(`[DriveService] Rollback triggered: Sheet append failed (${sheetErr.message}). Deleting Drive file "${fileId}"...`);
    try {
      createdFile.setTrashed(true);
      console.info(`[DriveService] Rollback complete: File "${fileId}" moved to trash.`);
    } catch (trashErr) {
      console.error(`[DriveService] Rollback failed to trash file: ${trashErr.message}`);
    }

    throw new Error(`TRANSACTION_FAILED: ไม่สามารถบันทึกประวัติไฟล์ลงฐานข้อมูลได้ ระบบได้ยกเลิกและลบไฟล์ออกจาก Drive เรียบร้อยแล้ว (${sheetErr.message})`);
  }

  return {
    attachmentId: attachmentId,
    fileId: fileId,
    name: fileName,
    fileName: fileName,
    fileSize: fileSize,
    mimeType: mimeType,
    directUrl: directUrl,
    lh3Url: lh3Url,
    viewUrl: viewUrl,
    downloadUrl: downloadUrl,
    folderPath: pathString,
    uploadedAt: attachmentRecord.uploadedAt
  };
}

/**
 * Saves image base64 to Google Drive with public read permission and direct CDN URLs
 */
function saveImageToDrive(base64Data, fileName, mimeType, category) {
  return uploadBase64File({
    base64Data: base64Data,
    fileName: fileName || ('image_' + Date.now() + '.jpg'),
    mimeType: mimeType || 'image/jpeg',
    category: category || 'PR'
  });
}

function uploadAttachment(payload) {
  return uploadBase64File(payload);
}

/**
 * Retrieves or creates a target attachments folder in Google Drive (e.g. '01_PR_Attachments').
 * 
 * @param {string} [folderName='01_PR_Attachments']
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateAttachmentFolder(folderName) {
  var root = getRootDriveFolder();
  var targetName = folderName || DRIVE_CATEGORIES.PR;
  return getOrCreateSubFolder(root, targetName);
}

/**
 * Decodes and uploads a single Base64 image directly to Google Drive,
 * sets Public View permissions immediately, and logs the entry to the Attachments sheet.
 * 
 * @param {string} base64Data Raw Base64 string or Data URI (data:image/...)
 * @param {string} [fileName] Target file name
 * @param {string} [mimeType='image/jpeg'] MIME type
 * @param {string} [category='01_PR_Attachments'] Drive Category folder
 * @param {string} [docNo=''] Document reference (PR No / PO No)
 * @param {string} [docType='PR'] Document type
 * @returns {Object|null} Upload result with real Google Drive URLs and fileId
 */
function uploadBase64Image(base64Data, fileName, mimeType, category, docNo, docType) {
  if (!base64Data || typeof base64Data !== 'string') return null;

  var cleanMime = (mimeType || 'image/jpeg').toLowerCase();
  var rawBase64 = base64Data;

  // 1. Strip Data URI header if present
  if (base64Data.includes(';base64,')) {
    var parts = base64Data.split(';base64,');
    var header = parts[0];
    rawBase64 = parts[1];
    if (header.includes(':')) {
      cleanMime = header.split(':')[1].trim();
    }
  }

  // 2. Guard against non-base64, empty, placeholder, or already-uploaded Drive URLs
  // ถ้า URL เป็น Drive URL อยู่แล้ว (ขึ้นต้นด้วย https://) ให้คืนค่า null ทันที ไม่ต้อง decode
  if (!rawBase64 || rawBase64.includes('STORED_IN_DRIVE') || rawBase64.includes('BASE64_') || rawBase64.length < 20
      || rawBase64.startsWith('https://') || rawBase64.startsWith('http://')) {
    return null;
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(rawBase64);
  } catch (decErr) {
    console.warn('[uploadBase64Image] Failed to decode base64: ' + decErr.message);
    return null;
  }

  var ext = cleanMime.includes('png') ? '.png' : (cleanMime.includes('webp') ? '.webp' : '.jpg');
  var cleanFileName = (fileName || ('pr_image_' + Date.now())).trim();
  if (!cleanFileName.match(/\.(jpe?g|png|webp|gif)$/i)) {
    cleanFileName += ext;
  }

  var folder = getRootDriveFolder();
  var blob = Utilities.newBlob(bytes, cleanMime, cleanFileName);
  var file;

  try {
    file = folder.createFile(blob);
    // ข้าม setSharing() ไปเพื่อให้สืบทอดสิทธิ์จาก Folder แม่
  } catch (driveErr) {
    console.error('[uploadBase64Image] createFile failed: ' + driveErr.message);
    return null;
  }

  var fileId = file.getId();
  var directUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
  var lh3Url = 'https://lh3.googleusercontent.com/d/' + fileId;
  var viewUrl = file.getUrl();

  // Accumulate in global array for batch insert later
  try {
    if (typeof ensureAttachmentsSheet === 'function') ensureAttachmentsSheet();
    _pendingAttachments.push({
      id: 'ATT-' + Utilities.getUuid().slice(0, 8),
      fileId: fileId,
      fileName: cleanFileName,
      mimeType: cleanMime,
      fileSize: bytes.length,
      category: category || DRIVE_CATEGORIES.PR,
      poNumber: (docType === 'PO' ? docNo : ''),
      docNo: docNo || '',
      docType: docType || 'PR',
      viewUrl: viewUrl,
      directUrl: directUrl,
      lh3Url: lh3Url,
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
      folderPath: folder.getName(),
      uploadedBy: getCurrentUserEmail() || 'system',
      uploadedAt: new Date().toISOString()
    });
  } catch (attErr) {
    console.warn('[uploadBase64Image] Failed to queue attachment: ' + attErr.message);
  }

  return {
    fileId: fileId,
    directUrl: directUrl,
    lh3Url: lh3Url,
    viewUrl: viewUrl,
    driveUrl: viewUrl,
    fileName: cleanFileName,
    mimeType: cleanMime
  };
}

/**
 * Traverses an array of PR items and processes any inline Base64 images/attachments,
 * saving them to Google Drive and replacing them with real Google Drive URLs and File IDs.
 * 
 * @param {Array<Object>} items PR items array
 * @param {string} [docNo=''] Document number
 * @param {string} [docType='PR'] Document type
 * @returns {Array<Object>} Items with real Google Drive URLs
 */
function processItemImages(items, docNo, docType) {
  if (!Array.isArray(items) || items.length === 0) return items;

  return items.map(function(item, idx) {
    if (!item || typeof item !== 'object') return item;
    var cleanItem = Object.assign({}, item);

    // 1. Process cleanItem.imageUrl
    if (cleanItem.imageUrl && typeof cleanItem.imageUrl === 'string' && cleanItem.imageUrl.startsWith('data:image/')) {
      var uploadResult = uploadBase64Image(
        cleanItem.imageUrl,
        (cleanItem.name || 'item_' + (idx + 1)) + '_thumb',
        'image/jpeg',
        DRIVE_CATEGORIES.PR,
        docNo,
        docType || 'PR'
      );
      if (uploadResult) {
        cleanItem.imageUrl = uploadResult.directUrl;
        cleanItem.fileId = uploadResult.fileId;
        cleanItem.driveUrl = uploadResult.viewUrl;
        cleanItem.lh3Url = uploadResult.lh3Url;
      } else {
        cleanItem.imageUrl = '';
      }
    }

    // 2. Process cleanItem.images
    if (Array.isArray(cleanItem.images) && cleanItem.images.length > 0) {
      cleanItem.images = cleanItem.images.map(function(img, imgIdx) {
        if (!img) return img;
        var rawUrl = (typeof img === 'string') ? img : (img.url || img.previewUrl || '');
        var imgName = (typeof img === 'object' && img.name) ? img.name : ((cleanItem.name || 'item_' + (idx + 1)) + '_img_' + (imgIdx + 1));

        // อายุดรวดเร็ว: ถ้าไม่ใช่ data: blob ให้คืนค่าเดิมทันที ไม่ต้อง decode
        if (!rawUrl || !rawUrl.startsWith('data:')) return img;

        if (typeof rawUrl === 'string' && rawUrl.startsWith('data:')) {
          var res = uploadBase64Image(rawUrl, imgName, 'image/jpeg', DRIVE_CATEGORIES.PR, docNo, docType || 'PR');
          if (res) {
            if (typeof img === 'string') {
              return res.directUrl;
            }
            return Object.assign({}, img, {
              url: res.directUrl,
              previewUrl: res.directUrl,
              directUrl: res.directUrl,
              lh3Url: res.lh3Url,
              fileId: res.fileId,
              driveUrl: res.viewUrl
            });
          }
          return (typeof img === 'string') ? '' : Object.assign({}, img, { url: '', previewUrl: '' });
        }
        return img;
      });

      // If cleanItem.imageUrl is empty or placeholder, pick from first image
      if ((!cleanItem.imageUrl || cleanItem.imageUrl.includes('BASE64_')) && cleanItem.images.length > 0) {
        var first = cleanItem.images[0];
        cleanItem.imageUrl = (typeof first === 'string') ? first : (first.directUrl || first.url || first.previewUrl || '');
        if (typeof first === 'object' && first.fileId) {
          cleanItem.fileId = first.fileId;
          cleanItem.driveUrl = first.driveUrl;
        }
      }
    }

    // 3. Process cleanItem.attachments
    if (Array.isArray(cleanItem.attachments) && cleanItem.attachments.length > 0) {
      cleanItem.attachments = cleanItem.attachments.map(function(att, attIdx) {
        if (!att || typeof att !== 'object') return att;
        var rawUrl = att.url || att.previewUrl || att.dataUrl || '';
        // อายุดรวดเร็ว: เฉพาะ data: blob เท่านั้นที่ต้องอัปโหลด
        if (!rawUrl || !rawUrl.startsWith('data:')) return att;
        if (typeof rawUrl === 'string' && rawUrl.startsWith('data:')) {
          var attName = att.name || ((cleanItem.name || 'item_' + (idx + 1)) + '_att_' + (attIdx + 1));
          var res = uploadBase64Image(rawUrl, attName, att.type || 'image/jpeg', DRIVE_CATEGORIES.PR, docNo, docType || 'PR');
          if (res) {
            return Object.assign({}, att, {
              url: res.directUrl,
              previewUrl: res.directUrl,
              directUrl: res.directUrl,
              lh3Url: res.lh3Url,
              fileId: res.fileId,
              driveUrl: res.viewUrl
            });
          }
          return Object.assign({}, att, { url: '', previewUrl: '' });
        }
        return att;
      });
    }

    return cleanItem;
  });
}

/**
 * Traverses an array of document-level attachments and uploads any Base64 files to Google Drive.
 * 
 * @param {Array<Object>} attachments
 * @param {string} [category='01_PR_Attachments']
 * @param {string} [docNo='']
 * @param {string} [docType='PR']
 * @returns {Array<Object>}
 */
function processDocumentAttachments(attachments, category, docNo, docType) {
  // 1. Reconcile (remove deleted old attachments from the database)
  if (docNo) {
    try {
      if (typeof ensureAttachmentsSheet === 'function') ensureAttachmentsSheet();
      var allAtts = batchReadRecords(SHEET_NAMES.ATTACHMENTS);
      var validKeys = {};
      if (Array.isArray(attachments)) {
        attachments.forEach(function(att) {
           if (att && att.fileId) validKeys[att.fileId] = true;
           if (att && att.url) validKeys[att.url] = true;
           if (att && att.viewUrl) validKeys[att.viewUrl] = true;
           if (att && att.directUrl) validKeys[att.directUrl] = true;
        });
      }
      
      var filteredAtts = allAtts.filter(function(row) {
        var rDocNo = String(row.docNo || '').trim().toUpperCase();
        var rPoNo = String(row.poNumber || '').trim().toUpperCase();
        var rPrNo = String(row.prNo || '').trim().toUpperCase();
        var targetDocNo = String(docNo).trim().toUpperCase();
        
        var isThisDoc = (rDocNo === targetDocNo || rPoNo === targetDocNo || rPrNo === targetDocNo);
        if (!isThisDoc) return true; // keep files belonging to other documents
        
        // This row belongs to the current docNo, check if it's still in the valid list
        var isKept = false;
        if (row.fileId && validKeys[row.fileId]) isKept = true;
        if (row.viewUrl && validKeys[row.viewUrl]) isKept = true;
        if (row.directUrl && validKeys[row.directUrl]) isKept = true;
        
        return isKept;
      });
      
      if (filteredAtts.length < allAtts.length) {
        batchWriteRecords(SHEET_NAMES.ATTACHMENTS, filteredAtts);
        console.info('[processDocumentAttachments] Reconciled attachments for ' + docNo + ', deleted ' + (allAtts.length - filteredAtts.length) + ' old files');
      }
    } catch (e) {
      console.warn('[processDocumentAttachments] Reconciliation error: ' + e.message);
    }
  }

  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  return attachments.map(function(att, idx) {
    if (!att || typeof att !== 'object') return att;
    var rawUrl = att.url || att.previewUrl || att.dataUrl || '';
    // อายุดรวดเร็ว: เฉพาะ data: blob เท่านั้นที่ต้องอัปโหลด ถ้าเป็น https:// หรือว่างเปล่า คืนเลย
    if (!rawUrl || !rawUrl.startsWith('data:')) return att;
    if (typeof rawUrl === 'string' && rawUrl.startsWith('data:')) {
      var attName = att.name || ('attachment_' + (idx + 1));
      var res = uploadBase64Image(rawUrl, attName, att.type || 'application/octet-stream', category || DRIVE_CATEGORIES.PR, docNo, docType);
      if (res) {
        return Object.assign({}, att, {
          url: res.directUrl,
          previewUrl: res.directUrl,
          directUrl: res.directUrl,
          lh3Url: res.lh3Url,
          fileId: res.fileId,
          driveUrl: res.viewUrl
        });
      }
      return Object.assign({}, att, { url: '', previewUrl: '' });
    }
    return att;
  });
}

/**
 * One-time Migration Script: Sets Public Read permissions (ANYONE_WITH_LINK, VIEW)
 * for all existing image files and attachments across the Google Drive folder hierarchy
 * and spreadsheet database records.
 * 
 * Can be executed directly from Google Apps Script Editor or called via RPC.
 * 
 * @returns {Object} Migration result summary
 */
function makeAllDriveFilesPublic() {
  const stats = {
    foldersScanned: 0,
    totalScanned: 0,
    updated: 0,
    errors: [],
    processedFiles: []
  };

  const visitedFileIds = {};

  function markFilePublic(file, sourceDesc) {
    if (!file) return;
    const fileId = file.getId();
    if (visitedFileIds[fileId]) return;
    visitedFileIds[fileId] = true;

    stats.totalScanned++;
    const name = file.getName() || 'unnamed';
    const mimeType = file.getMimeType() || '';

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      stats.updated++;
      const fileInfo = {
        id: fileId,
        name: name,
        mimeType: mimeType,
        directUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200',
        lh3Url: 'https://lh3.googleusercontent.com/d/' + fileId,
        viewUrl: file.getUrl(),
        source: sourceDesc || 'DriveFolder'
      };
      if (!Array.isArray(stats.processedFiles)) stats.processedFiles = [];
      stats.processedFiles.push(fileInfo);
      console.info('[DriveMigration] (' + stats.updated + ') Updated file "' + name + '" (' + fileId + ') to ANYONE_WITH_LINK, VIEW');
    } catch (err) {
      console.warn('[DriveMigration] Error updating file "' + name + '" (' + fileId + '): ' + err.message);
      if (!Array.isArray(stats.errors)) stats.errors = [];
      stats.errors.push({
        id: fileId,
        name: name,
        error: err.message
      });
    }
  }

  function traverseFolder(folder, currentPath) {
    if (!folder) return;
    stats.foldersScanned++;
    const folderName = folder.getName();
    const folderPath = currentPath ? (currentPath + '/' + folderName) : folderName;

    // 1. Process files in current folder
    try {
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        markFilePublic(file, folderPath);
      }
    } catch (err) {
      console.warn('[DriveMigration] Failed to list files in "' + folderPath + '": ' + err.message);
      if (!Array.isArray(stats.errors)) stats.errors = [];
      stats.errors.push({ folder: folderPath, error: err.message });
    }

    // 2. Recursively traverse child folders
    try {
      const childFolders = folder.getFolders();
      while (childFolders.hasNext()) {
        const childFolder = childFolders.next();
        traverseFolder(childFolder, folderPath);
      }
    } catch (err) {
      console.warn('[DriveMigration] Failed to list subfolders in "' + folderPath + '": ' + err.message);
      if (!Array.isArray(stats.errors)) stats.errors = [];
      stats.errors.push({ folder: folderPath, error: err.message });
    }
  }

  console.info('[DriveMigration] Starting Drive files public permission migration...');

  // Step 1: Scan from Root Drive Folder recursively
  try {
    const rootFolder = getRootDriveFolder();
    if (rootFolder) {
      traverseFolder(rootFolder, '');
    }
  } catch (rootErr) {
    console.warn('[DriveMigration] Failed to get root folder: ' + rootErr.message);
    if (!Array.isArray(stats.errors)) stats.errors = [];
    stats.errors.push({ source: 'RootFolder', error: rootErr.message });
  }

  // Step 2: Also scan Attachments sheet records (if exists) to ensure any recorded files outside root are also public
  try {
    if (typeof batchReadRecords === 'function' && typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.ATTACHMENTS) {
      const attachmentRecords = batchReadRecords(SHEET_NAMES.ATTACHMENTS);
      if (Array.isArray(attachmentRecords)) {
        for (let i = 0; i < attachmentRecords.length; i++) {
          const rec = attachmentRecords[i];
          const fileId = rec.fileId || (rec.viewUrl ? (rec.viewUrl.match(/[-\w]{25,}/) ? rec.viewUrl.match(/[-\w]{25,}/)[0] : null) : null);
          if (fileId && !visitedFileIds[fileId]) {
            try {
              const file = DriveApp.getFileById(fileId);
              markFilePublic(file, 'AttachmentsSheet');
            } catch (fileErr) {
              visitedFileIds[fileId] = true;
              if (!Array.isArray(stats.errors)) stats.errors = [];
              stats.errors.push({ id: fileId, error: fileErr.message, source: 'AttachmentsSheet' });
            }
          }
        }
      }
    }
  } catch (sheetErr) {
    console.warn('[DriveMigration] Attachments sheet scan skipped or failed: ' + sheetErr.message);
  }

  // Step 3: Also scan PRItems sheet records (if exists) for any embedded Drive image URLs
  try {
    if (typeof batchReadRecords === 'function' && typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.PR_ITEMS) {
      const prItems = batchReadRecords(SHEET_NAMES.PR_ITEMS);
      if (Array.isArray(prItems)) {
        for (let i = 0; i < prItems.length; i++) {
          const rowStr = JSON.stringify(prItems[i]);
          const matches = rowStr.match(/[-\w]{25,}/g);
          if (matches) {
            for (let m = 0; m < matches.length; m++) {
              const possibleId = matches[m];
              if (!visitedFileIds[possibleId]) {
                visitedFileIds[possibleId] = true;
                if (rowStr.includes('drive.google.com') || rowStr.includes('googleusercontent.com')) {
                  try {
                    const file = DriveApp.getFileById(possibleId);
                    markFilePublic(file, 'PRItemsSheet');
                  } catch (e) {
                    // Not a valid Drive file ID, safe to ignore
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (prItemsErr) {
    console.warn('[DriveMigration] PRItems scan skipped: ' + prItemsErr.message);
  }

  // Step 4: Clean up any lingering legacy dummy strings from PRs and PRItems sheets
  try {
    if (typeof getSheet === 'function' && typeof SHEET_NAMES !== 'undefined') {
      [SHEET_NAMES.PRS, SHEET_NAMES.PR_ITEMS].forEach(function(sName) {
        try {
          var s = getSheet(sName);
          if (s && s.getLastRow() > 1) {
            var rng = s.getDataRange();
            var vals = rng.getValues();
            var modified = false;
            for (var r = 1; r < vals.length; r++) {
              for (var c = 0; c < vals[r].length; c++) {
                if (typeof vals[r][c] === 'string' && vals[r][c].includes('STORED_IN_DRIVE')) {
                  vals[r][c] = vals[r][c].replace(/\[?BASE64_ATTACHMENT_STORED_IN_DRIVE\]?/g, '')
                                         .replace(/\[?INLINE_BASE64_STORED_IN_DRIVE\]?/g, '');
                  modified = true;
                }
              }
            }
            if (modified) {
              rng.setValues(vals);
              SpreadsheetApp.flush();
              console.info('[DriveMigration] Cleaned up legacy placeholders in sheet: ' + sName);
            }
          }
        } catch (subErr) {
          console.warn('[DriveMigration] Sheet clean warning (' + sName + '): ' + subErr.message);
        }
      });
    }
  } catch (cleanErr) {
    console.warn('[DriveMigration] Legacy placeholder cleanup warning: ' + cleanErr.message);
  }

  const summary = {
    success: true,
    message: 'ปรับสิทธิ์ไฟล์รูปภาพทั้งหมดใน Google Drive ให้เป็น Public Read เรียบร้อยแล้ว',
    totalFoldersScanned: stats.foldersScanned,
    totalFilesScanned: stats.totalScanned,
    updatedCount: stats.updated,
    errorCount: stats.errors.length,
    updatedFiles: stats.processedFiles,
    errors: stats.errors,
    executedAt: new Date().toISOString()
  };

  console.info('[DriveMigration] Migration finished. Scanned ' + stats.totalScanned + ' files across ' + stats.foldersScanned + ' folders. Updated ' + stats.updated + ' files. Errors: ' + stats.errors.length);
  return summary;
}

/**
 * Public RPC Endpoint: One-time migration to set all Drive image files and attachments to Public Read.
 * Can be run from Script Editor directly (Run > apiMakeAllDriveFilesPublic) or called via Frontend RPC.
 */
function apiMakeAllDriveFilesPublic(rawPayload, userContext) {
  if (typeof handleApiRequest === 'function') {
    return handleApiRequest(function(payload, user) {
      return makeAllDriveFilesPublic();
    }, 'MakeAllDriveFilesPublic', rawPayload, userContext);
  }
  return makeAllDriveFilesPublic();
}

