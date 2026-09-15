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
 * Finds an existing subfolder by name or creates it if missing.
 * 
 * @param {GoogleAppsScript.Drive.Folder} parentFolder Parent directory
 * @param {string} subFolderName Name of subfolder
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateSubFolder(parentFolder, subFolderName) {
  const cleanName = String(subFolderName).trim();
  const children = parentFolder.getFoldersByName(cleanName);
  if (children.hasNext()) {
    return children.next();
  }
  return parentFolder.createFolder(cleanName);
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
  const d = date instanceof Date ? date : new Date(date);
  const yearMonth = !isNaN(d.getTime())
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 7);

  const canonicalCat = normalizeDriveCategory(category);
  const categoryFolder = getOrCreateSubFolder(root, canonicalCat);
  const ymFolder = getOrCreateSubFolder(categoryFolder, yearMonth);

  const cleanPo = String(poNumber || '').trim();
  if (cleanPo && (canonicalCat === DRIVE_CATEGORIES.GRN || canonicalCat === DRIVE_CATEGORIES.CLAIM)) {
    const poFolder = getOrCreateSubFolder(ymFolder, cleanPo);
    return {
      folder: poFolder,
      pathString: `${CONFIG.DEFAULTS.DRIVE_ROOT_NAME}/${canonicalCat}/${yearMonth}/${cleanPo}`
    };
  }

  return {
    folder: ymFolder,
    pathString: `${CONFIG.DEFAULTS.DRIVE_ROOT_NAME}/${canonicalCat}/${yearMonth}`
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
    // Allow anyone with link to view document
    createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (driveErr) {
    console.error('[DriveService] Failed to create file in Drive:', driveErr.message);
    throw new Error(`DRIVE_UPLOAD_FAILED: ไม่สามารถบันทึกไฟล์ลง Google Drive: ${driveErr.message}`);
  }

  const fileId = createdFile.getId();
  const viewUrl = createdFile.getUrl();
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
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
    fileName: fileName,
    fileSize: fileSize,
    mimeType: mimeType,
    viewUrl: viewUrl,
    downloadUrl: downloadUrl,
    folderPath: pathString,
    uploadedAt: attachmentRecord.uploadedAt
  };
}
