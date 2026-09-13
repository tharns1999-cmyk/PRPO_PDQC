/**
 * Google Drive Document Routing & Upload Service
 * 
 * Manages automated routing and file uploads into the structured ERP Google Drive hierarchy:
 * [ERP] PR-PO-Stock-System/
 *   ├── 01_PR_Attachments/{YYYY-MM}/
 *   ├── 02_PO_Documents/{YYYY-MM}/
 *   ├── 03_GRN_Evidence/{YYYY-MM}/{PO_NUMBER}/
 *   └── 04_Claim_Evidence/{YYYY-MM}/{PO_NUMBER}/
 */

import { callGAS } from './gasClient.js';

export const DRIVE_ROOT_FOLDER = '[ERP] PR-PO-Stock-System';

export const DRIVE_CATEGORIES = {
  PR: '01_PR_Attachments',
  PO: '02_PO_Documents',
  GRN: '03_GRN_Evidence',
  CLAIM: '04_Claim_Evidence'
};

/**
 * Normalizes category code to canonical folder segment name
 */
export const normalizeCategory = (category = '') => {
  const cat = String(category).toUpperCase().trim();
  if (cat.startsWith('01') || cat.includes('PR')) return DRIVE_CATEGORIES.PR;
  if (cat.startsWith('02') || cat.includes('PO')) return DRIVE_CATEGORIES.PO;
  if (cat.startsWith('03') || cat.includes('GRN') || cat.includes('RECEIV')) return DRIVE_CATEGORIES.GRN;
  if (cat.startsWith('04') || cat.includes('CLAIM') || cat.includes('DISPUTE')) return DRIVE_CATEGORIES.CLAIM;
  return DRIVE_CATEGORIES.PR;
};

/**
 * Resolves the structured Drive folder hierarchy path string
 * 
 * @param {string} category 'PR' | 'PO' | 'GRN' | 'CLAIM'
 * @param {string} [poNumber] Optional PO number for GRN and Claim evidence
 * @param {Date|string} [date] Optional date for YYYY-MM stamping
 * @returns {string} Fully qualified folder path in Drive
 */
export const resolveDriveFolderPath = (category, poNumber = '', date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const yearMonth = !isNaN(d.getTime()) 
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 7);

  const folderCategory = normalizeCategory(category);
  const cleanPo = String(poNumber || '').trim();

  if (cleanPo && (folderCategory === DRIVE_CATEGORIES.GRN || folderCategory === DRIVE_CATEGORIES.CLAIM)) {
    return `${DRIVE_ROOT_FOLDER}/${folderCategory}/${yearMonth}/${cleanPo}`;
  }

  return `${DRIVE_ROOT_FOLDER}/${folderCategory}/${yearMonth}`;
};

/**
 * Converts a browser File or Blob to a clean Base64 string
 * Strips data URI header (e.g. data:image/png;base64,) if present
 * 
 * @param {File|Blob} file 
 * @returns {Promise<{ base64Data: string, mimeType: string, fileName: string, size: number }>}
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided for Base64 conversion'));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const base64Index = result.indexOf(';base64,');
      let pureBase64 = '';
      let mimeType = file.type || 'application/octet-stream';

      if (base64Index !== -1) {
        pureBase64 = result.substring(base64Index + 8);
        mimeType = result.substring(5, base64Index);
      } else {
        pureBase64 = result.replace(/^data:[^;]+;base64,/, '');
      }

      resolve({
        base64Data: pureBase64,
        mimeType: mimeType || file.type || 'application/octet-stream',
        fileName: file.name || `file_${Date.now()}`,
        size: file.size || 0
      });
    };

    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads a document or evidence image to Google Drive via the GAS Bridge
 * 
 * @param {Object} options
 * @param {File|Blob} [options.file] Browser file instance
 * @param {string} [options.base64Data] Raw base64 string if already converted
 * @param {string} [options.fileName] File name (e.g. 'damaged_item_1.jpg')
 * @param {string} [options.mimeType] MIME type (e.g. 'image/jpeg')
 * @param {string} options.category 'PR' | 'PO' | 'GRN' | 'CLAIM'
 * @param {string} [options.poNumber] Relevant Purchase Order number
 * @param {string} [options.description] Human-readable description
 * @returns {Promise<{ success: boolean, fileId: string, fileUrl: string, fileName: string, folderPath: string }>}
 */
export const uploadFileToDrive = async ({
  file,
  base64Data,
  fileName,
  mimeType,
  category = 'PR',
  poNumber = '',
  description = ''
}) => {
  let resolvedBase64 = base64Data || '';
  let resolvedMime = mimeType || 'image/jpeg';
  let resolvedName = fileName || 'attachment.jpg';

  if (file) {
    const converted = await fileToBase64(file);
    resolvedBase64 = converted.base64Data;
    resolvedMime = converted.mimeType;
    resolvedName = converted.fileName;
  }

  if (!resolvedBase64) {
    throw new Error('ไม่พบข้อมูลไฟล์ (Base64 data is empty)');
  }

  const folderPath = resolveDriveFolderPath(category, poNumber);

  const payload = {
    base64Data: resolvedBase64,
    mimeType: resolvedMime,
    fileName: resolvedName,
    category: normalizeCategory(category),
    poNumber: poNumber || '',
    folderPath,
    description: description || ''
  };

  const response = await callGAS('apiUploadFile', payload);

  return {
    success: true,
    fileId: response.fileId,
    fileUrl: response.fileUrl,
    fileName: response.fileName || resolvedName,
    mimeType: response.mimeType || resolvedMime,
    folderPath: response.folderPath || folderPath,
    uploadedAt: response.uploadedAt || new Date().toISOString()
  };
};

export const driveService = {
  DRIVE_ROOT_FOLDER,
  DRIVE_CATEGORIES,
  normalizeCategory,
  resolveDriveFolderPath,
  fileToBase64,
  uploadFileToDrive
};

export default driveService;
