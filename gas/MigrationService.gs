/**
 * @file MigrationService.gs
 * @description Data Seeding and Legacy Data Migration Service
 * Migrates local JSON data (Master Data & POS.json 258KB) into Google Sheets
 * ensuring seamless transition without loss of document numbering or history.
 * @version 2.0.0
 */

/**
 * Baseline Seed Master Data for Initial System Setup
 */
const SEED_DATA = {
  DEPARTMENTS: [
    { id: 'DEPT-PD', code: 'PD', name: 'ฝ่ายผลิต', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'DEPT-QC', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'DEPT-WH', code: 'WH', name: 'ฝ่ายคลังสินค้า', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'DEPT-ALL', code: 'ALL', name: 'ส่วนกลาง / ทุกฝ่าย', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }
  ],

  STORAGE_LOCATIONS: [
    { id: 'LOC-PD-001', name: 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)', department: 'PD', isActive: true },
    { id: 'LOC-PD-002', name: 'ชั้นวาง A-02 (อะไหล่เครื่องจักร & สายพาน)', department: 'PD', isActive: true },
    { id: 'LOC-PD-003', name: 'ตู้เก็บอุปกรณ์ความปลอดภัย (PPE)', department: 'PD', isActive: true },
    { id: 'LOC-PD-004', name: 'ห้องแพ็คเกจจิ้ง', department: 'PD', isActive: true },
    { id: 'LOC-QC-001', name: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)', department: 'QC', isActive: true },
    { id: 'LOC-QC-002', name: 'ชั้นวางอาหารเลี้ยงเชื้อ (Media Shelf B)', department: 'QC', isActive: true },
    { id: 'LOC-QC-003', name: 'ตู้เก็บตัวอย่างควบคุม (Retain Sample Room)', department: 'QC', isActive: true },
    { id: 'LOC-QC-004', name: 'ห้องปฏิบัติการกลาง (Central Lab)', department: 'QC', isActive: true }
  ],

  USAGE_UNITS: [
    { id: 'UNIT-PD-001', name: 'ห้อง K1', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-002', name: 'ห้อง K2', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-003', name: 'ห้องผลไม้', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-004', name: 'ห้องสลัด', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-005', name: 'ห้องล้าง/เตรียมผัก', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-006', name: 'ห้องเตรียมวัตถุดิบ 1', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-007', name: 'ห้องพาสเจอร์ไรซ์ (Hot Process)', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-008', name: 'ห้องบรรจุขวด/แพ็คเกจจิ้ง (Aseptic Filling)', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-QC-001', name: 'ห้อง Lab 1 (เคมี)', department: 'QC', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-QC-002', name: 'ห้อง Lab 2 (จุลชีววิทยา)', department: 'QC', status: 'ACTIVE', isActive: true }
  ],

  USERS: [
    {
      id: 'USR-0001',
      employeeId: 'EMP-PD-001',
      username: 'siraphat.pd',
      email: '',
      name: 'สิรภัทร แจ่มมิน',
      employeeName: 'สิรภัทร แจ่มมิน',
      displayName: 'สิรภัทร แจ่มมิน',
      department: 'PD',
      primaryDepartment: 'PD',
      departments: ['PD'],
      allowedDepartments: ['PD'],
      roleId: 'REQUESTER_PD',
      canonicalRole: 'REQUESTER',
      level: 1,
      status: 'ACTIVE',
      isActive: true,
      description: 'สร้าง/ส่ง PR ฝ่ายผลิต, เบิกจ่ายสินค้า, ตรวจรับของเข้าสต็อก'
    },
    {
      id: 'USR-0002',
      employeeId: 'EMP-QC-001',
      username: 'natthinee.qc',
      email: '',
      name: 'ณัฐธินีย์ สอนครบบุรี',
      employeeName: 'ณัฐธินีย์ สอนครบบุรี',
      displayName: 'ณัฐธินีย์ สอนครบบุรี',
      department: 'QC',
      primaryDepartment: 'QC',
      departments: ['QC'],
      allowedDepartments: ['QC'],
      roleId: 'REQUESTER_QC',
      canonicalRole: 'REQUESTER',
      level: 1,
      status: 'ACTIVE',
      isActive: true,
      description: 'สร้าง/ส่ง PR ฝ่าย QC/Lab, เบิกจ่ายสารเคมี, ตรวจรับของ'
    },
    {
      id: 'USR-0003',
      employeeId: 'EMP-MGR-001',
      username: 'kallayani.mgr',
      email: '',
      name: 'กัลยาณี พลไกร',
      employeeName: 'กัลยาณี พลไกร',
      displayName: 'กัลยาณี พลไกร',
      department: 'PD',
      primaryDepartment: 'PD',
      departments: ['PD', 'QC'],
      allowedDepartments: ['PD', 'QC'],
      roleId: 'ASST_MANAGER',
      canonicalRole: 'REVIEWER',
      level: 2,
      status: 'ACTIVE',
      isActive: true,
      description: 'ตรวจทาน PR (Level 1 Reviewer)'
    },
    {
      id: 'USR-0004',
      employeeId: 'EMP-PUR-001',
      username: 'nat.on',
      email: '',
      name: 'คุณนัท จัดซื้อ',
      employeeName: 'คุณนัท จัดซื้อ',
      displayName: 'คุณนัท จัดซื้อ',
      department: 'ALL',
      primaryDepartment: 'ALL',
      departments: ['PD', 'QC', 'ALL'],
      allowedDepartments: ['PD', 'QC', 'ALL'],
      roleId: 'ONLINE_PURCHASER',
      canonicalRole: 'PURCHASER',
      level: 2,
      status: 'ACTIVE',
      isActive: true,
      description: 'จัดการสั่งซื้อออนไลน์ Shopee/Lazada'
    },
    {
      id: 'USR-0005',
      employeeId: 'EMP-MGR-002',
      username: 'prasert.pm',
      email: '',
      name: 'คุณประเสริฐ ยิ่งยง',
      employeeName: 'คุณประเสริฐ ยิ่งยง',
      displayName: 'คุณประเสริฐ ยิ่งยง',
      department: 'ALL',
      primaryDepartment: 'ALL',
      departments: ['PD', 'QC', 'ALL'],
      allowedDepartments: ['PD', 'QC', 'ALL'],
      roleId: 'PLANT_MANAGER',
      canonicalRole: 'APPROVER',
      level: 3,
      status: 'ACTIVE',
      isActive: true,
      description: 'อนุมัติสั่งซื้อ (Final Approver)'
    },
    {
      id: 'USR-0006',
      employeeId: 'EMP-SYS-999',
      username: 'admin',
      email: '',
      name: 'ผู้ดูแลระบบ',
      employeeName: 'ผู้ดูแลระบบ',
      displayName: 'ผู้ดูแลระบบ',
      department: 'ALL',
      primaryDepartment: 'ALL',
      departments: ['*'],
      allowedDepartments: ['*'],
      roleId: 'ADMIN',
      canonicalRole: 'ADMIN',
      level: 99,
      status: 'ACTIVE',
      isActive: true,
      description: 'ผู้ดูแลระบบ สิทธิ์สูงสุด'
    }
  ],

  BUDGETS: [
    {
      dept: 'PD',
      monthlyBudget: 1000000,
      spent: 0,
      pending: 0,
      variance: 1000000,
      year: 2026,
      month: 9,
      historicalSpent: { '2026-09': 0 },
      history: { '2026-09': 1000000 },
      refundCredits: { '2026-09': 817 },
      updatedAt: new Date().toISOString()
    },
    {
      dept: 'QC',
      monthlyBudget: 150000,
      spent: 0,
      pending: 0,
      variance: 150000,
      year: 2026,
      month: 9,
      historicalSpent: { '2026-09': 0 },
      history: { '2026-09': 150000 },
      refundCredits: {},
      updatedAt: new Date().toISOString()
    },
    {
      dept: 'WH',
      monthlyBudget: 120000,
      spent: 0,
      pending: 0,
      variance: 120000,
      year: 2026,
      month: 9,
      historicalSpent: { '2026-09': 0 },
      history: { '2026-09': 120000 },
      refundCredits: {},
      updatedAt: new Date().toISOString()
    }
  ],

  PR_COUNTERS: [
    { dept: 'PD', docType: 'PR', lastNumber: 2, prefix: 'PD', year: 2026, updatedAt: new Date().toISOString() },
    { dept: 'PD', docType: 'PO', lastNumber: 2, prefix: 'PO', year: 2026, updatedAt: new Date().toISOString() },
    { dept: 'QC', docType: 'PR', lastNumber: 0, prefix: 'QC', year: 2026, updatedAt: new Date().toISOString() },
    { dept: 'QC', docType: 'PO', lastNumber: 0, prefix: 'PO', year: 2026, updatedAt: new Date().toISOString() }
  ]
};

/**
 * Seeds base master data into the Google Sheet if sheets are empty.
 * Idempotent: Only inserts records if not already existing.
 * 
 * @returns {Object} Seeding execution report
 */
function seedInitialMasterData() {
  console.info('[MigrationService] Seeding baseline Master Data...');
  const report = {
    departmentsInserted: 0,
    locationsInserted: 0,
    unitsInserted: 0,
    usersInserted: 0,
    budgetsInserted: 0,
    countersInserted: 0
  };

  // 1. Departments
  report.departmentsInserted = seedSheetIfEmpty(SHEET_NAMES.DEPARTMENTS, SEED_DATA.DEPARTMENTS, 'code');

  // 2. Storage Locations
  report.locationsInserted = seedSheetIfEmpty(SHEET_NAMES.STORAGE_LOCATIONS, SEED_DATA.STORAGE_LOCATIONS, 'id');

  // 3. Usage Units
  report.unitsInserted = seedSheetIfEmpty(SHEET_NAMES.USAGE_UNITS, SEED_DATA.USAGE_UNITS, 'id');

  // 4. Users (Seed if empty; also assigns active developer email to Admin if empty)
  const currentEmail = getCurrentUserEmail();
  const usersToSeed = SEED_DATA.USERS.map(u => {
    if (u.roleId === 'ADMIN' && currentEmail && !u.email) {
      return Object.assign({}, u, { email: currentEmail });
    }
    return u;
  });
  report.usersInserted = seedSheetIfEmpty(SHEET_NAMES.USERS, usersToSeed, 'username');

  // 5. Budgets
  report.budgetsInserted = seedSheetIfEmpty(SHEET_NAMES.BUDGETS, SEED_DATA.BUDGETS, 'dept');

  // 6. Counters
  report.countersInserted = seedSheetIfEmpty(SHEET_NAMES.PR_COUNTERS, SEED_DATA.PR_COUNTERS, 'dept');

  console.info('[MigrationService] Master Data Seeding completed:', JSON.stringify(report));
  return report;
}

/**
 * Helper to seed records only if target sheet has no data rows.
 */
function seedSheetIfEmpty(sheetName, records, idField) {
  const existing = batchReadRecords(sheetName);
  if (existing.length === 0) {
    batchAppendRecords(sheetName, records);
    return records.length;
  }

  // If partially populated, upsert missing records
  let count = 0;
  records.forEach(rec => {
    const found = existing.some(ex => String(ex[idField]) === String(rec[idField]));
    if (!found) {
      appendRecord(sheetName, rec);
      count++;
    }
  });

  return count;
}

/**
 * Sanitizes PO items before writing to Sheet to avoid exceeding 50,000 chars per cell limit.
 * Strips huge inline base64 image strings while preserving product codes, quantities, and metadata.
 * 
 * @param {Array|string} items
 * @returns {string} JSON string of sanitized items
 */
function sanitizePoItemsForStorage(items) {
  if (!items) return '[]';
  let rawItems = items;
  if (typeof items === 'string') {
    try {
      rawItems = JSON.parse(items);
    } catch (e) {
      return items;
    }
  }

  if (!Array.isArray(rawItems)) return JSON.stringify(rawItems);

  const cleanItems = rawItems.map(it => {
    if (!it || typeof it !== 'object') return it;
    const cleanIt = Object.assign({}, it);

    if (Array.isArray(cleanIt.images)) {
      cleanIt.images = cleanIt.images.map(img => {
        if (img && typeof img === 'object') {
          return {
            name: img.name || 'image',
            size: img.size || 0,
            type: img.type || 'image/jpeg',
            previewUrl: (img.previewUrl && String(img.previewUrl).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (img.previewUrl || ''),
            url: (img.url && String(img.url).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (img.url || '')
          };
        }
        return img;
      });
    }

    if (Array.isArray(cleanIt.attachments)) {
      cleanIt.attachments = cleanIt.attachments.map(att => {
        if (att && typeof att === 'object') {
          return {
            name: att.name || 'file',
            size: att.size || 0,
            type: att.type || 'application/octet-stream',
            previewUrl: (att.previewUrl && String(att.previewUrl).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (att.previewUrl || ''),
            url: (att.url && String(att.url).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (att.url || '')
          };
        }
        return att;
      });
    }

    return cleanIt;
  });

  return JSON.stringify(cleanItems);
}

/**
 * Migrates a batch of PO records (such as from data/pos.json) into the POs sheet.
 * Preserves all existing IDs, document numbers, timestamps, and nested items.
 * 
 * @param {Object[]} poRecords Array of PO records
 * @returns {number} Count of successfully imported POs
 */
function migratePOsBatch(poRecords = []) {
  if (!poRecords || poRecords.length === 0) return 0;

  console.info(`[MigrationService] Migrating batch of ${poRecords.length} PO records...`);
  
  // Read existing PO numbers to avoid duplicate collisions
  const existingPOs = batchReadRecords(SHEET_NAMES.POS);
  const existingPoNos = new Set(existingPOs.map(p => String(p.poNo || p.id).trim()));

  const recordsToInsert = [];

  poRecords.forEach(po => {
    const key = String(po.poNo || po.id).trim();
    if (!key || existingPoNos.has(key)) {
      return; // Skip existing
    }

    // Sanitize and serialize complex structures
    const cleanPo = {
      id: po.id || `PO-${Date.now()}`,
      poNo: po.poNo || po.id,
      prId: po.prId || '',
      prNo: po.prNo || po.prNumber || '',
      department: po.department || 'PD',
      vendorName: po.vendorName || po.vendor || '',
      vendorId: po.vendorId || '',
      purchaseChannel: po.purchaseChannel || (po.isOnline ? 'ONLINE' : 'DIRECT'),
      issueDate: po.issueDate || po.createdAt || '',
      orderDate: po.orderDate || '',
      status: po.status || 'PENDING',
      workflowStatus: po.workflowStatus || po.status || 'PENDING',
      items: sanitizePoItemsForStorage(po.items),
      subtotal: Number(po.subtotal || 0),
      vat: Number(po.vat || 0),
      grandTotal: Number(po.grandTotal || 0),
      isOnline: Boolean(po.isOnline),
      isClosed: Boolean(po.isClosed),
      claimStatus: po.claimStatus || '',
      ngItems: typeof po.ngItems === 'object' ? JSON.stringify(po.ngItems) : (po.ngItems || '[]'),
      reviewedBy: typeof po.reviewedBy === 'object' ? JSON.stringify(po.reviewedBy) : (po.reviewedBy || ''),
      reviewedAt: po.reviewedAt || '',
      approvedBy: typeof po.approvedBy === 'object' ? JSON.stringify(po.approvedBy) : (po.approvedBy || ''),
      approvedAt: po.approvedAt || '',
      activityLog: typeof po.activityLog === 'object' ? JSON.stringify(po.activityLog) : (po.activityLog || '[]'),
      createdAt: po.createdAt || new Date().toISOString(),
      completedAt: po.completedAt || '',
      updatedAt: po.updatedAt || new Date().toISOString()
    };

    recordsToInsert.push(cleanPo);
    existingPoNos.add(key);
  });

  if (recordsToInsert.length > 0) {
    batchAppendRecords(SHEET_NAMES.POS, recordsToInsert);
    console.info(`[MigrationService] Successfully inserted ${recordsToInsert.length} POs.`);
  }

  return recordsToInsert.length;
}

/**
 * Generic Batch Importer for Master Data or Transactions.
 * 
 * @param {string} sheetName Name of target sheet tab
 * @param {Object[]} records Array of record objects
 * @param {string} idField Unique identifier field
 * @returns {number} Number of records inserted/updated
 */
function migrateGenericRecords(sheetName, records = [], idField = 'id') {
  if (!records || records.length === 0) return 0;
  console.info(`[MigrationService] Migrating ${records.length} records into "${sheetName}"...`);

  let count = 0;
  records.forEach(rec => {
    upsertRecordById(sheetName, idField, rec);
    count++;
  });

  return count;
}
