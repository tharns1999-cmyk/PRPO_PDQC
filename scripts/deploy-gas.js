/**
 * @file deploy-gas.js
 * @description One-Click Full Deployment Pipeline for Google Apps Script
 * 
 * Pipeline Phases:
 * 1. Quality Gate 1: Static Analysis & Lint (npm run lint)
 * 2. Quality Gate 2: Full Unit & Domain Test Suite (npm test)
 * 3. Build: Single-File HTML Vite compilation (npm run build:gas)
 * 4. Stage: Package & validate staging folder (node scripts/prepare-gas.js)
 * 5. Pre-flight Check: Validate .clasp.json scriptId configuration
 * 6. Push: Upload staged files to Google Apps Script (clasp push)
 * 7. Deploy: Create an immutable production release version (clasp deploy)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function runCommand(command, description) {
  console.log(`\n▶ [Step] ${description}...`);
  console.log(`  $ ${command}`);
  try {
    execSync(command, { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`✔ [Step Passed] ${description}`);
  } catch (error) {
    console.error(`\n❌ [Step Failed] ${description}`);
    console.error(`Command exited with error: ${error.message}`);
    process.exit(1);
  }
}

function checkClaspConfig() {
  const claspJsonPath = path.join(ROOT_DIR, '.clasp.json');
  if (!fs.existsSync(claspJsonPath)) {
    console.error('\n❌ ERROR: .clasp.json file not found!');
    console.error('   Please copy .clasp.json.sample to .clasp.json and enter your Apps Script ID:');
    console.error('   cp .clasp.json.sample .clasp.json\n');
    process.exit(1);
  }

  try {
    const config = JSON.parse(fs.readFileSync(claspJsonPath, 'utf8'));
    if (!config.scriptId || config.scriptId.includes('YOUR_APPS_SCRIPT_ID_HERE') || config.scriptId.includes('YOUR_')) {
      console.error('\n❌ CONFIGURATION ERROR: Invalid scriptId in .clasp.json!');
      console.error('   Current scriptId: "' + (config.scriptId || '') + '"');
      console.error('   Please update .clasp.json with your actual Google Apps Script Project ID.');
      console.error('   You can find it in your Google Sheet -> Extensions -> Apps Script -> Project Settings (Gear icon) -> Script ID\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ ERROR: Failed to parse .clasp.json: ' + err.message);
    process.exit(1);
  }
}

async function main() {
  const startTime = Date.now();
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   PRPO_PDQC — Google Apps Script Automated Deployment     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Step 1: Quality Gate - Linter
  runCommand('npm run lint', 'Quality Gate 1: Code Style & Static Linting');

  // Step 2: Quality Gate - Test Suite
  runCommand('npm test', 'Quality Gate 2: Automated Unit & Domain Tests');

  // Step 3: Compile Single-File HTML Bundle
  runCommand('npm run build:gas', 'Build: Single-File HTML SPA Bundle');

  // Step 4: Stage files into gas-deploy/
  runCommand('node scripts/prepare-gas.js', 'Stage: Collect and validate deployment files');

  // Step 5: Check Clasp configuration
  console.log('\n▶ [Step] Pre-flight Clasp Credentials Check...');
  checkClaspConfig();
  console.log('✔ [Step Passed] .clasp.json configuration verified.');

  // Step 6: Push to Apps Script
  runCommand('npx clasp push --force', 'Push: Synchronize files to Google Apps Script');

  // Step 7: Deploy new version (Update existing deployment by default)
  const releaseDesc = `Production Release ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`;
  const deploymentId = process.env.DEPLOYMENT_ID || 'AKfycbxqrjcJXtuDntYAd9ixki_f8-V6piifKTLmV9vhqkhgj_bQhX6fqscieLvIrsx2JzeI';
  const deployCmd = deploymentId 
    ? `npx clasp deploy -i ${deploymentId} --description "${releaseDesc}"`
    : `npx clasp deploy --description "${releaseDesc}"`;
  runCommand(deployCmd, `Deploy: Update Production Release (${deploymentId})`);

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`🎉 DEPLOYMENT COMPLETE in ${elapsedSec}s!`);
  console.log('   The new Web App version has been deployed to Google Apps Script.');
  console.log('   Verify by visiting your Web App Executable URL.');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Deployment process aborted:', err);
  process.exit(1);
});
