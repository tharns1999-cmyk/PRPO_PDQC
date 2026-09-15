/**
 * @file prepare-gas.js
 * @description Prepares and validates the deployment staging directory (gas-deploy/)
 * for Google Apps Script deployment via Clasp.
 * 
 * Staging Workflow:
 * 1. Verifies that single-file HTML bundle exists in dist-gas/index.html
 * 2. Cleans and initializes gas-deploy/ staging directory
 * 3. Copies all .gs backend files from gas/
 * 4. Copies gas/appsscript.json manifest
 * 5. Copies dist-gas/index.html as gas-deploy/index.html
 * 6. Performs self-contained integrity validations (checks for unbundled assets)
 * 7. Outputs a formatted staging summary table
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SRC_GAS_DIR = path.join(ROOT_DIR, 'gas');
const SRC_DIST_GAS_DIR = path.join(ROOT_DIR, 'dist-gas');
const STAGING_DIR = path.join(ROOT_DIR, 'gas-deploy');

const REQUIRED_GS_FILES = [
  'AuthService.gs',
  'Code.gs',
  'Config.gs',
  'DriveService.gs',
  'Initializer.gs',
  'LockService.gs',
  'MigrationService.gs',
  'SheetService.gs'
];

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

async function prepareGasDeployment() {
  console.log('\n=============================================================');
  console.log('  Google Apps Script (GAS) Deployment Staging Pipeline');
  console.log('=============================================================\n');

  // 1. Verify single-file HTML bundle
  const builtHtmlPath = path.join(SRC_DIST_GAS_DIR, 'index.html');
  if (!fs.existsSync(builtHtmlPath)) {
    console.error('❌ ERROR: Built HTML bundle not found at: ' + builtHtmlPath);
    console.error('   Please run "npm run build:gas" first before staging.\n');
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(builtHtmlPath, 'utf8');
  const htmlStats = fs.statSync(builtHtmlPath);

  // 2. Validate bundle is self-contained (no external script or link tags pointing to local /assets)
  const hasExternalScript = /<script\s+[^>]*src=["'](?!\/\/|https?:\/\/|data:)[^"']+["']/i.test(htmlContent);
  const hasExternalStylesheet = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["'](?!\/\/|https?:\/\/|data:)[^"']+["']/i.test(htmlContent);

  if (hasExternalScript || hasExternalStylesheet) {
    console.error('❌ BUNDLE INTEGRITY ERROR: index.html contains non-inlined local asset links!');
    if (hasExternalScript) console.error('   - Found unbundled <script src="...">');
    if (hasExternalStylesheet) console.error('   - Found unbundled <link rel="stylesheet" href="...">');
    console.error('   GAS HtmlService requires all scripts and styles to be 100% inlined.');
    process.exit(1);
  }

  // 3. Reset and recreate staging directory
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  const stagedFiles = [];

  // 4. Copy backend .gs files
  for (const gsFile of REQUIRED_GS_FILES) {
    const srcPath = path.join(SRC_GAS_DIR, gsFile);
    const destPath = path.join(STAGING_DIR, gsFile);

    if (!fs.existsSync(srcPath)) {
      console.error(`❌ ERROR: Missing required backend file: ${srcPath}`);
      process.exit(1);
    }

    fs.copyFileSync(srcPath, destPath);
    const stat = fs.statSync(destPath);
    stagedFiles.push({ name: gsFile, size: stat.size, type: 'GAS Script' });
  }

  // 5. Copy appsscript.json manifest
  const manifestSrc = path.join(SRC_GAS_DIR, 'appsscript.json');
  const manifestDest = path.join(STAGING_DIR, 'appsscript.json');
  if (!fs.existsSync(manifestSrc)) {
    console.error('❌ ERROR: Missing appsscript.json manifest at: ' + manifestSrc);
    process.exit(1);
  }
  fs.copyFileSync(manifestSrc, manifestDest);
  stagedFiles.push({ name: 'appsscript.json', size: fs.statSync(manifestDest).size, type: 'GAS Manifest' });

  // 6. Copy single-file index.html
  const destHtmlPath = path.join(STAGING_DIR, 'index.html');
  fs.copyFileSync(builtHtmlPath, destHtmlPath);
  stagedFiles.push({ name: 'index.html', size: htmlStats.size, type: 'SPA Bundle (HTML/CSS/JS)' });

  // 7. Summary output
  console.log(`📁 Staging Directory: ${STAGING_DIR}\n`);
  console.log('┌────────────────────────────┬─────────────┬──────────────────────────┐');
  console.log('│ Staged File Name           │ File Size   │ File Type                │');
  console.log('├────────────────────────────┼─────────────┼──────────────────────────┤');
  let totalBytes = 0;
  for (const file of stagedFiles) {
    totalBytes += file.size;
    const nameStr = file.name.padEnd(26);
    const sizeStr = formatBytes(file.size).padStart(11);
    const typeStr = file.type.padEnd(24);
    console.log(`│ ${nameStr} │ ${sizeStr} │ ${typeStr} │`);
  }
  console.log('├────────────────────────────┼─────────────┼──────────────────────────┤');
  console.log(`│ TOTAL (${stagedFiles.length} files)`.padEnd(29) + `│ ${formatBytes(totalBytes).padStart(11)} │                          │`);
  console.log('└────────────────────────────┴─────────────┴──────────────────────────┘\n');

  console.log('✅ Staging preparation completed successfully!');
  console.log('   Next step: Run "clasp push" or "npm run gas:deploy" to push to Google Apps Script.\n');
}

prepareGasDeployment().catch(err => {
  console.error('Unexpected error during GAS staging:', err);
  process.exit(1);
});
