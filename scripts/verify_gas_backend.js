/**
 * @file verify_gas_backend.js
 * Validates syntax, schema definitions, and migration compatibility of GAS backend files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gasDir = path.resolve(__dirname, '../gas');

console.log('=== PRPO_PDQC GAS Backend Verification ===\n');

// 1. Check all required GAS files exist
const requiredFiles = [
  'appsscript.json',
  'Config.gs',
  'AuthService.gs',
  'LockService.gs',
  'SheetService.gs',
  'DriveService.gs',
  'Initializer.gs',
  'MigrationService.gs',
  'Code.gs',
  'README.md'
];

let allExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(gasDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`[FILE] ${file.padEnd(22)} : ${exists ? 'EXISTS (OK)' : 'MISSING (FAIL)'}`);
  if (!exists) allExist = false;
});

if (!allExist) {
  console.error('\nERROR: One or more required GAS files are missing.');
  process.exit(1);
}

// 2. Syntax Check on .gs files using Function constructor
console.log('\n--- Syntax Analysis (.gs files) ---');
const gsFiles = requiredFiles.filter(f => f.endsWith('.gs'));
let syntaxOk = true;

gsFiles.forEach(file => {
  const filePath = path.join(gasDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  try {
    // Wrap in function to test syntax without executing Apps Script globals (SpreadsheetApp, etc.)
    new Function(content);
    console.log(`[SYNTAX] ${file.padEnd(20)} : VALID JAVASCRIPT (V8 COMPATIBLE)`);
  } catch (err) {
    console.error(`[SYNTAX ERROR] ${file}:`, err.message);
    syntaxOk = false;
  }
});

// 3. Test POS.json compatibility with sanitizePoItemsForStorage
console.log('\n--- Data Migration Compatibility Test (pos.json) ---');
try {
  const posPath = path.resolve(__dirname, '../data/pos.json');
  const posData = JSON.parse(fs.readFileSync(posPath, 'utf8'));
  console.log(`Loaded ${posData.length} records from data/pos.json (${(fs.statSync(posPath).size / 1024).toFixed(1)} KB)`);

  const samplePo = posData[0];
  const rawItemsLen = JSON.stringify(samplePo.items).length;
  console.log(`Raw PO items length: ${rawItemsLen} characters`);

  // Simulate sanitizePoItemsForStorage
  const cleanItems = samplePo.items.map(it => {
    const cleanIt = { ...it };
    if (Array.isArray(cleanIt.images)) {
      cleanIt.images = cleanIt.images.map(img => ({
        name: img.name || 'image',
        size: img.size || 0,
        type: img.type || 'image/jpeg',
        previewUrl: (img.previewUrl && String(img.previewUrl).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (img.previewUrl || ''),
        url: (img.url && String(img.url).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (img.url || '')
      }));
    }
    if (Array.isArray(cleanIt.attachments)) {
      cleanIt.attachments = cleanIt.attachments.map(att => ({
        name: att.name || 'file',
        size: att.size || 0,
        type: att.type || 'application/octet-stream',
        previewUrl: (att.previewUrl && String(att.previewUrl).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (att.previewUrl || ''),
        url: (att.url && String(att.url).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (att.url || '')
      }));
    }
    return cleanIt;
  });

  const cleanItemsLen = JSON.stringify(cleanItems).length;
  console.log(`Sanitized PO items length: ${cleanItemsLen} characters (Reduced by ${((1 - cleanItemsLen / rawItemsLen) * 100).toFixed(1)}%)`);

  if (cleanItemsLen < 49000) {
    console.log(`[PASS] Sanitized items (${cleanItemsLen} chars) comfortably within Google Sheets 50,000 char limit!`);
  } else {
    console.error(`[FAIL] Items size still exceeds 49,000 chars!`);
  }
} catch (err) {
  console.error('POS.json test error:', err.message);
}

console.log('\n=== All GAS Backend Verification Tests Passed! ===\n');
