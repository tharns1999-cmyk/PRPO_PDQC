import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialProducts, initialVendors } from '../src/data/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Project root data directory
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

// Ensure data directory exists
if (!fsSync.existsSync(dataDir)) {
  fsSync.mkdirSync(dataDir, { recursive: true });
}

// Initial mock data definitions for seeding if files don't exist
const initialStorageLocations = [
  { id: 'LOC-PD-001', name: 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)', department: 'PD' },
  { id: 'LOC-PD-002', name: 'ชั้นวาง A-02 (อะไหล่เครื่องจักร & สายพาน)', department: 'PD' },
  { id: 'LOC-PD-003', name: 'ตู้เก็บอุปกรณ์ความปลอดภัย (PPE)', department: 'PD' },
  { id: 'LOC-PD-004', name: 'ห้องแพ็คเกจจิ้ง', department: 'PD' },
  { id: 'LOC-QC-001', name: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)', department: 'QC' },
  { id: 'LOC-QC-002', name: 'ชั้นวางอาหารเลี้ยงเชื้อ (Media Shelf B)', department: 'QC' },
  { id: 'LOC-QC-003', name: 'ตู้เก็บแก้วและอุปกรณ์สอบเทียบ (Calibration Room)', department: 'QC' },
  { id: 'LOC-QC-004', name: 'จุดพักตัวอย่างรอตรวจ (Pending Sample Area)', department: 'QC' }
];

const initialUsageUnits = [
  { id: 'UNIT-PD-001', name: 'ห้อง K1', department: 'PD', dot: 'bg-blue-500', color: 'bg-blue-50 text-blue-700 border-blue-200/80', status: 'ACTIVE' },
  { id: 'UNIT-PD-002', name: 'ห้อง K2', department: 'PD', dot: 'bg-violet-500', color: 'bg-violet-50 text-violet-700 border-violet-200/80', status: 'ACTIVE' },
  { id: 'UNIT-PD-003', name: 'ห้องผลไม้', department: 'PD', dot: 'bg-emerald-500', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', status: 'ACTIVE' },
  { id: 'UNIT-PD-004', name: 'ห้องแพ็ค', department: 'PD', dot: 'bg-amber-500', color: 'bg-amber-50 text-amber-700 border-amber-200/80', status: 'ACTIVE' },
  { id: 'UNIT-PD-005', name: 'ออฟฟิศ PD', department: 'PD', dot: 'bg-slate-500', color: 'bg-slate-100 text-slate-700 border-slate-200/80', status: 'ACTIVE' },
  { id: 'UNIT-QC-001', name: 'Lab เคมี', department: 'QC', dot: 'bg-cyan-500', color: 'bg-cyan-50 text-cyan-700 border-cyan-200/80', status: 'ACTIVE' },
  { id: 'UNIT-QC-002', name: 'Lab จุลชีววิทยา', department: 'QC', dot: 'bg-teal-500', color: 'bg-teal-50 text-teal-700 border-teal-200/80', status: 'ACTIVE' },
  { id: 'UNIT-QC-003', name: 'ห้อง Sensory', department: 'QC', dot: 'bg-fuchsia-500', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80', status: 'ACTIVE' }
];

const initialDepartments = [
  {
    id: 'DEPT-PD',
    code: 'PD',
    name: 'ฝ่ายผลิต',
    nameEn: 'Production',
    prefix: 'PD',
    description: 'รับผิดชอบกระบวนการแปรรูป ควบคุมการผลิต และดูแลไลน์ผลิตสินค้า',
    monthlyBudget: 250000,
    isActive: true,
    color: 'blue',
    managerName: 'คุณประเสริฐ ยิ่งยง',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'DEPT-QC',
    code: 'QC',
    name: 'ฝ่ายควบคุมคุณภาพ',
    nameEn: 'Quality Control & Lab',
    prefix: 'QC',
    description: 'ตรวจสอบคุณภาพ วัตถุดิบ สารเคมี บรรจุภัณฑ์ และงานแล็บวิเคราะห์',
    monthlyBudget: 150000,
    isActive: true,
    color: 'amber',
    managerName: 'ดร. กรรณิการ์ จิตเจริญ',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'DEPT-WH',
    code: 'WH',
    name: 'ฝ่ายคลังสินค้า',
    nameEn: 'Warehouse & Inventory',
    prefix: 'WH',
    description: 'บริหารคลังจัดเก็บสินค้า วัตถุดิบ ชิ้นส่วน และตรวจรับกระจายสต็อก',
    monthlyBudget: 120000,
    isActive: true,
    color: 'emerald',
    managerName: 'คุณสมคิด คลังทอง',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'DEPT-PUR',
    code: 'PUR',
    name: 'ฝ่ายจัดซื้อ',
    nameEn: 'Procurement & Sourcing',
    prefix: 'PUR',
    description: 'จัดหาผู้จัดจำหน่าย เปรียบเทียบราคา จัดซื้อพัสดุและอุปกรณ์',
    monthlyBudget: 100000,
    isActive: true,
    color: 'purple',
    managerName: 'คุณสุดา จัดหาดี',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'DEPT-ENG',
    code: 'ENG',
    name: 'ฝ่ายวิศวกรรมและซ่อมบำรุง',
    nameEn: 'Engineering & Maintenance',
    prefix: 'ENG',
    description: 'ดูแลรักษาเครื่องจักร ระบบสาธารณูปโภค และงานซ่อมบำรุงโรงงาน',
    monthlyBudget: 180000,
    isActive: true,
    color: 'cyan',
    managerName: 'วิศวกร ช่างทอง',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

const initialUsers = [
  {
    id: 'USR-0001',
    employeeId: 'EMP-PD-001',
    username: 'wichai.pd',
    password: 'password123',
    name: 'คุณวิชัย (PD)',
    employeeName: 'คุณวิชัย สุขใจ',
    displayName: 'Wichai (PD)',
    primaryDepartment: 'PD',
    department: 'PD',
    allowedDepartments: ['PD'],
    roleId: 'REQUESTER_PD',
    positionKey: 'REQUESTER_PD',
    title: 'Requester (PD)',
    level: 1,
    status: 'ACTIVE',
    pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    description: 'สร้าง/ส่ง PR ฝ่ายผลิต, เบิกจ่ายสินค้า, ตรวจรับของเข้าสต็อก'
  },
  {
    id: 'USR-0002',
    employeeId: 'EMP-QC-001',
    username: 'somying.qc',
    password: 'password123',
    name: 'คุณสมหญิง (QC)',
    employeeName: 'คุณสมหญิง รักดี',
    displayName: 'Somying (QC)',
    primaryDepartment: 'QC',
    department: 'QC',
    allowedDepartments: ['QC'],
    roleId: 'REQUESTER_QC',
    positionKey: 'REQUESTER_QC',
    title: 'Requester (QC)',
    level: 1,
    status: 'ACTIVE',
    pictureUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    description: 'สร้าง/ส่ง PR ฝ่าย QC/Lab, เบิกจ่ายสารเคมี, ตรวจรับของ'
  },
  {
    id: 'USR-0003',
    employeeId: 'EMP-MGR-001',
    username: 'somchai.am',
    password: 'password123',
    name: 'คุณสมชาย (Asst. Mgr)',
    employeeName: 'คุณสมชาย มุ่งมั่น',
    displayName: 'Somchai (Asst Mgr)',
    primaryDepartment: 'PD',
    department: 'PD',
    departments: ['PD', 'QC'],
    assignedDepartments: ['PD', 'QC'],
    allowedDepartments: ['PD', 'QC'],
    roleId: 'ASST_MANAGER',
    positionKey: 'REVIEWER',
    title: 'Assistant Manager',
    level: 2,
    status: 'ACTIVE',
    pictureUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    description: 'ตรวจทาน PR (Level 1 Reviewer), ดูแลฝ่ายผลิต (PD) และฝ่ายควบคุมคุณภาพ (QC)'
  },
  {
    id: 'USR-0004',
    employeeId: 'EMP-PUR-001',
    username: 'nat.on',
    password: 'password123',
    name: 'คุณนัท (Online Purchaser)',
    employeeName: 'คุณนัท จัดซื้อ',
    displayName: 'Nat (Online)',
    primaryDepartment: 'ALL',
    department: 'ALL',
    allowedDepartments: ['*'],
    roleId: 'ONLINE_PURCHASER',
    positionKey: 'ONLINE_PURCHASER',
    title: 'Online Purchaser (คุณนัท)',
    level: 2,
    status: 'ACTIVE',
    pictureUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    description: 'จัดการสั่งซื้อออนไลน์ Shopee/Lazada, บันทึกราคาจริง'
  },
  {
    id: 'USR-0005',
    employeeId: 'EMP-MGR-002',
    username: 'prasert.pm',
    password: 'password123',
    name: 'คุณประเสริฐ (Plant Mgr)',
    employeeName: 'คุณประเสริฐ ยิ่งยง',
    displayName: 'Prasert (Plant Mgr)',
    primaryDepartment: 'ALL',
    department: 'ALL',
    allowedDepartments: ['*'],
    roleId: 'PLANT_MANAGER',
    positionKey: 'APPROVER',
    title: 'Plant Manager',
    level: 3,
    status: 'ACTIVE',
    pictureUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    description: 'อนุมัติสั่งซื้อ (Final Approver), ออก PO อัตโนมัติ, คุมงบประมาณ'
  },
  {
    id: 'USR-0006',
    employeeId: 'EMP-SYS-999',
    username: 'admin',
    password: 'admin123',
    name: 'Admin System',
    displayName: 'Admin',
    primaryDepartment: 'ALL',
    department: 'ALL',
    allowedDepartments: ['*'],
    roleId: 'ADMIN',
    positionKey: 'ADMIN',
    title: 'System Administrator',
    level: 99,
    status: 'ACTIVE',
    pictureUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    description: 'ผู้ดูแลระบบ สิทธิ์สูงสุดในการจัดการข้อมูลทุกส่วน'
  }
];

const initialBudgets = {
  PD: { monthlyBudget: 250000, spent: 0, pending: 0, variance: 250000, history: {}, historicalSpent: {} },
  QC: { monthlyBudget: 150000, spent: 0, pending: 0, variance: 150000, history: {}, historicalSpent: {} },
  WH: { monthlyBudget: 120000, spent: 0, pending: 0, variance: 120000, history: {}, historicalSpent: {} },
  PUR: { monthlyBudget: 100000, spent: 0, pending: 0, variance: 100000, history: {}, historicalSpent: {} },
  ENG: { monthlyBudget: 180000, spent: 0, pending: 0, variance: 180000, history: {}, historicalSpent: {} }
};

const initialCounters = {
  PD: { PR: 0, PO: 0 },
  QC: { PR: 0, PO: 0 },
  WH: { PR: 0, PO: 0 },
  PUR: { PR: 0, PO: 0 },
  ENG: { PR: 0, PO: 0 }
};

// Seed product items from initial catalog (Only used if file does not exist on disk)
const defaultSeedCatalog = {
  'products.json': initialProducts,
  'vendors.json': initialVendors,
  'storageLocations.json': initialStorageLocations,
  'usageUnits.json': initialUsageUnits,
  'departments.json': initialDepartments,
  'users.json': initialUsers,
  'budgets.json': initialBudgets,
  'prCounters.json': initialCounters,
  'prs.json': [],
  'pos.json': [],
  'stockLogs.json': [],
  'budgetTransactions.json': [],
  'auditLogs.json': [],
  'notifications.json': []
};

// File helpers with atomic write to prevent read-during-write corruption
const getFilePath = (fileName) => path.join(dataDir, fileName);

// Central synchronous atomic file writer with formatted Pretty JSON (SSOT)
function saveDataToFile(fileName, data) {
  const filePath = getFilePath(fileName);
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fsSync.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fsSync.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fsSync.unlinkSync(tmpPath); } catch {}
    fsSync.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

async function writeFile(fileName, data) {
  saveDataToFile(fileName, data);
}

// Single Source of Truth (SSOT) reader
async function readFile(fileName, defaultValue = []) {
  const filePath = getFilePath(fileName);
  try {
    if (!fsSync.existsSync(filePath)) {
      const fallback = defaultSeedCatalog[fileName] !== undefined ? defaultSeedCatalog[fileName] : defaultValue;
      saveDataToFile(fileName, fallback);
      return fallback;
    }
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content || !content.trim()) {
      const fallback = defaultSeedCatalog[fileName] !== undefined ? defaultSeedCatalog[fileName] : defaultValue;
      saveDataToFile(fileName, fallback);
      return fallback;
    }
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const fallback = defaultSeedCatalog[fileName] !== undefined ? defaultSeedCatalog[fileName] : defaultValue;
      saveDataToFile(fileName, fallback);
      return fallback;
    }
    console.error(`[Backend SSOT] Read error for ${fileName}:`, err);
    return defaultSeedCatalog[fileName] !== undefined ? defaultSeedCatalog[fileName] : defaultValue;
  }
}

// ── One-Time Bootstrap Lock ──
// Strictly preserves existing data on disk. Only seeds if file is missing completely.
function ensureBootstrapData() {
  console.log('[SSOT Lock] Verifying Single Source of Truth data files...');
  for (const [fileName, seedData] of Object.entries(defaultSeedCatalog)) {
    const filePath = getFilePath(fileName);
    if (!fsSync.existsSync(filePath)) {
      console.log(`[SSOT Lock] Initializing missing master data file on disk: ${fileName}`);
      saveDataToFile(fileName, seedData);
    } else {
      console.log(`[SSOT Lock] File exists on disk, preserving on-disk user data: ${fileName}`);
    }
  }
}

// Execute one-time bootstrap on startup
ensureBootstrapData();

// ── Permanent Blacklist Guard against Test / Mock Artifacts ──
export const DUMMY_BLACKLIST = new Set(['P01', 'P02', 'PROD-01', 'PROD-02']);
export const isBlacklistedProduct = (item) => {
  if (!item || typeof item !== 'object') return false;
  const actual = item.product || item.item || item;
  const code = String(actual.code || actual.id || '').trim().toUpperCase();
  const id = String(actual.id || '').trim().toUpperCase();
  const name = String(actual.name || actual.itemName || actual.title || '').trim().toLowerCase();
  return DUMMY_BLACKLIST.has(code) || DUMMY_BLACKLIST.has(id) || name === 'item 1' || name === 'item 2';
};

// ── 1. Products ──
app.get('/api/products', async (req, res) => {
  try {
    const rawProducts = await readFile('products.json', []);
    const sanitized = (Array.isArray(rawProducts) ? rawProducts : [])
      .flatMap(p => Array.isArray(p) ? p : [p])
      .filter(p => p && typeof p === 'object' && (p.name || p.itemName || p.title) && !isBlacklistedProduct(p));
    const map = new Map();
    sanitized.forEach(item => {
      const key = String(item.code || item.id || '').trim().toUpperCase();
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });
    res.json(Array.from(map.values()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      const sanitized = data
        .flatMap(p => Array.isArray(p) ? p : [p])
        .filter(p => p && typeof p === 'object' && (p.name || p.itemName || p.title) && !isBlacklistedProduct(p));
      const map = new Map();
      sanitized.forEach(item => {
        const key = String(item.code || item.id || '').trim().toUpperCase();
        if (key && !map.has(key)) {
          map.set(key, item);
        }
      });
      const deduped = Array.from(map.values());
      await writeFile('products.json', deduped);
      return res.json(deduped);
    }
    if (isBlacklistedProduct(data)) {
      return res.json(data);
    }
    const products = (await readFile('products.json', []))
      .flatMap(p => Array.isArray(p) ? p : [p])
      .filter(p => p && typeof p === 'object' && (p.name || p.itemName || p.title) && !isBlacklistedProduct(p));
    products.unshift(data);
    const map = new Map();
    products.forEach(item => {
      const key = String(item.code || item.id || '').trim().toUpperCase();
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });
    const deduped = Array.from(map.values());
    await writeFile('products.json', deduped);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/batch', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      const sanitized = data
        .flatMap(p => Array.isArray(p) ? p : [p])
        .filter(p => p && typeof p === 'object' && (p.name || p.itemName || p.title) && !isBlacklistedProduct(p));
      const map = new Map();
      sanitized.forEach(item => {
        const key = String(item.code || item.id || '').trim().toUpperCase();
        if (key && !map.has(key)) {
          map.set(key, item);
        }
      });
      const deduped = Array.from(map.values());
      await writeFile('products.json', deduped);
      return res.json(deduped);
    }
    res.status(400).json({ error: 'Expected array body for batch update' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = decodeURIComponent(String(id || '')).trim().toLowerCase();
    const updated = req.body;
    const rawProducts = await readFile('products.json', []);
    const products = (Array.isArray(rawProducts) ? rawProducts : [])
      .flatMap(p => Array.isArray(p) ? p : [p])
      .filter(p => p && typeof p === 'object' && (p.name || p.itemName || p.title) && !isBlacklistedProduct(p));
    const idx = products.findIndex(p => {
      const pId = String(p.id || '').trim().toLowerCase();
      const pCode = String(p.code || '').trim().toLowerCase();
      return pId === targetId || pCode === targetId;
    });
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...updated };
    } else if (!isBlacklistedProduct(updated)) {
      products.unshift(updated);
    }
    await writeFile('products.json', products);
    res.json(products[idx !== -1 ? idx : 0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const target = decodeURIComponent(String(req.params.id || '')).trim().toLowerCase();
    const rawProducts = await readFile('products.json', []);
    const products = (Array.isArray(rawProducts) ? rawProducts : [])
      .flatMap(p => Array.isArray(p) ? p : [p])
      .filter(p => p && typeof p === 'object' && (p.name || p.itemName || p.title));
    const initialLength = products.length;
    const filtered = products.filter(p => {
      const pId = String(p.id || '').trim().toLowerCase();
      const pCode = String(p.code || '').trim().toLowerCase();
      return pId !== target && pCode !== target && !isBlacklistedProduct(p);
    });
    await writeFile('products.json', filtered);
    res.json({ success: true, count: filtered.length, deleted: initialLength - filtered.length, id: req.params.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2. Storage Locations ──
app.get('/api/storage-locations', async (req, res) => {
  try {
    const locs = await readFile('storageLocations.json', initialStorageLocations);
    res.json(locs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/storage-locations', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('storageLocations.json', data);
      return res.json(data);
    }
    const locs = await readFile('storageLocations.json', initialStorageLocations);
    locs.unshift(data);
    await writeFile('storageLocations.json', locs);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/storage-locations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const locs = await readFile('storageLocations.json', initialStorageLocations);
    const idx = locs.findIndex(l => l.id === id);
    if (idx !== -1) {
      locs[idx] = { ...locs[idx], ...updated };
    } else {
      locs.push(updated);
    }
    await writeFile('storageLocations.json', locs);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/storage-locations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const locs = await readFile('storageLocations.json', initialStorageLocations);
    const filtered = locs.filter(l => l.id !== id);
    await writeFile('storageLocations.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2.1 Usage Units (Department-Scoped) ──
app.get('/api/usage-units', async (req, res) => {
  try {
    const { department } = req.query;
    const units = await readFile('usageUnits.json', initialUsageUnits);
    if (department && department !== 'ALL') {
      return res.json(units.filter(u => u.department === department));
    }
    res.json(units);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/usage-units', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('usageUnits.json', data);
      return res.json(data);
    }
    const units = await readFile('usageUnits.json', initialUsageUnits);
    const newUnit = {
      id: data.id || `UNIT-${data.department || 'GEN'}-${Date.now().toString().slice(-6)}`,
      status: data.status || 'ACTIVE',
      ...data
    };
    units.push(newUnit);
    await writeFile('usageUnits.json', units);
    res.json(newUnit);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/usage-units/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const units = await readFile('usageUnits.json', initialUsageUnits);
    const idx = units.findIndex(u => u.id === id);
    if (idx !== -1) {
      units[idx] = { ...units[idx], ...updated };
      await writeFile('usageUnits.json', units);
      res.json(units[idx]);
    } else {
      units.push(updated);
      await writeFile('usageUnits.json', units);
      res.json(updated);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/usage-units/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const units = await readFile('usageUnits.json', initialUsageUnits);
    const filtered = units.filter(u => u.id !== id);
    await writeFile('usageUnits.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2.2 Users & Access Management ──
app.get('/api/users', async (req, res) => {
  try {
    const users = await readFile('users.json', initialUsers);
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('users.json', data);
      return res.json(data);
    }
    const users = await readFile('users.json', initialUsers);
    const newId = data.id || `USR-${Date.now().toString().slice(-4)}`;
    const primaryDept = data.primaryDepartment || data.department || 'PD';
    const allowedDepts = Array.isArray(data.allowedDepartments) && data.allowedDepartments.length > 0 
      ? data.allowedDepartments 
      : (primaryDept === 'ALL' ? ['*'] : [primaryDept]);

    const newUser = {
      ...data,
      id: newId,
      primaryDepartment: primaryDept,
      department: primaryDept,
      allowedDepartments: allowedDepts,
      status: data.status || 'ACTIVE'
    };
    users.push(newUser);
    await writeFile('users.json', users);
    res.json(newUser);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const users = await readFile('users.json', initialUsers);
    const idx = users.findIndex(u => u.id === id);
    
    const primaryDept = updated.primaryDepartment || updated.department || (idx !== -1 ? users[idx].primaryDepartment : 'PD');
    const allowedDepts = Array.isArray(updated.allowedDepartments) 
      ? updated.allowedDepartments 
      : (idx !== -1 ? users[idx].allowedDepartments : [primaryDept]);

    const merged = {
      ...(idx !== -1 ? users[idx] : {}),
      ...updated,
      id,
      primaryDepartment: primaryDept,
      department: primaryDept,
      allowedDepartments: allowedDepts
    };

    if (idx !== -1) {
      users[idx] = merged;
    } else {
      users.push(merged);
    }
    await writeFile('users.json', users);
    res.json(merged);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const users = await readFile('users.json', initialUsers);
    const filtered = users.filter(u => u.id !== id);
    await writeFile('users.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Departments Master Data ──
app.get('/api/departments', async (req, res) => {
  try {
    const depts = await readFile('departments.json', initialDepartments);
    res.json(depts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('departments.json', data);
      return res.json(data);
    }
    const depts = await readFile('departments.json', initialDepartments);
    const code = (data.code || '').toUpperCase().trim();
    const newId = data.id || `DEPT-${code || Date.now().toString().slice(-4)}`;
    const newDept = {
      ...data,
      id: newId,
      code,
      name: data.name || '',
      nameEn: data.nameEn || '',
      prefix: data.prefix || code,
      description: data.description || '',
      monthlyBudget: Number(data.monthlyBudget) || 0,
      isActive: data.isActive !== undefined ? data.isActive : true,
      color: data.color || 'blue',
      managerName: data.managerName || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    depts.push(newDept);
    await writeFile('departments.json', depts);
    res.json(newDept);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const depts = await readFile('departments.json', initialDepartments);
    const idx = depts.findIndex(d => d.id === id || d.code === id);
    const existing = idx !== -1 ? depts[idx] : {};
    const code = (updated.code || existing.code || id).toUpperCase().trim();
    const merged = {
      ...existing,
      ...updated,
      id: existing.id || id,
      code,
      name: updated.name !== undefined ? updated.name : existing.name,
      isActive: updated.isActive !== undefined ? updated.isActive : (existing.isActive !== undefined ? existing.isActive : true),
      monthlyBudget: updated.monthlyBudget !== undefined ? Number(updated.monthlyBudget) : (existing.monthlyBudget || 0),
      updatedAt: new Date().toISOString()
    };
    if (idx !== -1) {
      depts[idx] = merged;
    } else {
      depts.push(merged);
    }
    await writeFile('departments.json', depts);
    res.json(merged);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const depts = await readFile('departments.json', initialDepartments);
    const filtered = depts.filter(d => d.id !== id && d.code !== id);
    await writeFile('departments.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 3. Vendors ──
app.get('/api/vendors', async (req, res) => {
  try {
    const vendors = await readFile('vendors.json', []);
    res.json(vendors);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('vendors.json', data);
      return res.json(data);
    }
    const vendors = await readFile('vendors.json', []);
    vendors.unshift(data);
    await writeFile('vendors.json', vendors);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = decodeURIComponent(String(id || '')).trim().toLowerCase();
    const updated = req.body;
    const vendors = await readFile('vendors.json', []);
    const idx = vendors.findIndex(v => {
      const vId = String(v.id || '').trim().toLowerCase();
      const vCode = String(v.code || '').trim().toLowerCase();
      return vId === targetId || vCode === targetId;
    });
    if (idx !== -1) {
      vendors[idx] = { ...vendors[idx], ...updated };
    } else {
      vendors.unshift(updated);
    }
    await writeFile('vendors.json', vendors);
    res.json(vendors[idx !== -1 ? idx : 0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = decodeURIComponent(String(id || '')).trim().toLowerCase();
    const vendors = await readFile('vendors.json', []);
    const filtered = vendors.filter(v => {
      const vId = String(v.id || '').trim().toLowerCase();
      const vCode = String(v.code || '').trim().toLowerCase();
      return vId !== targetId && vCode !== targetId;
    });
    await writeFile('vendors.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 4. PRs ──
app.get('/api/prs', async (req, res) => {
  try {
    const prs = await readFile('prs.json', []);
    res.json(prs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/prs', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      const seen = new Set();
      const unique = data.filter(p => {
        const key = p.id || p.prNo;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await writeFile('prs.json', unique);
      return res.json(unique);
    }
    const prs = await readFile('prs.json', []);
    const idx = prs.findIndex(p => p.id === data.id || (data.prNo && p.prNo === data.prNo));
    if (idx !== -1) {
      prs[idx] = { ...prs[idx], ...data };
    } else {
      prs.unshift(data);
    }
    await writeFile('prs.json', prs);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/prs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const prs = await readFile('prs.json', []);
    const idx = prs.findIndex(p => p.id === id);
    if (idx !== -1) {
      prs[idx] = { ...prs[idx], ...updated };
    } else {
      prs.unshift(updated);
    }
    await writeFile('prs.json', prs);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/prs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prs = await readFile('prs.json', []);
    const filtered = prs.filter(p => p.id !== id && p.prNo !== id);
    await writeFile('prs.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 5. POs ──
app.get('/api/pos', async (req, res) => {
  try {
    const pos = await readFile('pos.json', []);
    res.json(pos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/pos', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      const pos = await readFile('pos.json', []);
      for (const item of data) {
        const idx = pos.findIndex(p => 
          (item.id && p.id === item.id) || 
          (item.poNo && (p.poNo === item.poNo || p.poNumber === item.poNo)) ||
          (item.prNo && p.prNo === item.prNo && item.vendorId && p.vendorId === item.vendorId)
        );
        if (idx !== -1) {
          pos[idx] = { ...pos[idx], ...item };
        } else {
          pos.unshift(item);
        }
      }
      await writeFile('pos.json', pos);
      return res.json(data);
    }
    const pos = await readFile('pos.json', []);
    const idx = pos.findIndex(p => 
      (data.id && p.id === data.id) || 
      (data.poNo && (p.poNo === data.poNo || p.poNumber === data.poNo)) ||
      (data.poNumber && (p.poNo === data.poNumber || p.poNumber === data.poNumber)) ||
      (data.prNo && p.prNo === data.prNo && (!data.vendorId || p.vendorId === data.vendorId))
    );
    if (idx !== -1) {
      pos[idx] = { ...pos[idx], ...data };
    } else {
      pos.unshift(data);
    }
    await writeFile('pos.json', pos);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/pos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const pos = await readFile('pos.json', []);
    const idx = pos.findIndex(p => p.id === id);
    if (idx !== -1) {
      pos[idx] = { ...pos[idx], ...updated };
    } else {
      pos.push(updated);
    }
    await writeFile('pos.json', pos);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/pos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pos = await readFile('pos.json', []);
    const filtered = pos.filter(p => p.id !== id && p.poNo !== id && p.poNumber !== id);
    await writeFile('pos.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 5.1 Goods Receipt (GR) Atomic Transaction Endpoint ──
app.post(['/api/pos/:id/receive', '/api/receive-goods'], async (req, res) => {
  try {
    const poId = req.params.id || req.body.poId;
    const { receivingItems = [], user = {}, note = '', options = {}, grNumber: bodyGrNo } = req.body;
    const timestamp = new Date().toLocaleString('th-TH');

    const [pos, products, stockLogs, budgets] = await Promise.all([
      readFile('pos.json', []),
      readFile('products.json', []),
      readFile('stockLogs.json', []),
      readFile('budgets.json', initialBudgets)
    ]);

    const poIndex = pos.findIndex(p => p.id === poId || p.poNo === poId);
    if (poIndex === -1) {
      return res.status(404).json({ error: `ไม่พบเอกสารใบสั่งซื้อ PO ID: ${poId}` });
    }

    const po = pos[poIndex];
    const roundNumber = options?.round || options?.roundNumber || (po.grnHistory?.length || 0) + 1;
    const cleanPoNo = (po.poNo || po.id || '').trim();
    const safeRound = String(Math.max(1, Number(roundNumber) || 1)).padStart(2, '0');
    const grNumber = bodyGrNo || options?.grNumber || options?.grId || (cleanPoNo ? `GRN-${cleanPoNo}-${safeRound}` : `GRN-${Date.now()}-01`);

    // 1. PO Status Validity Check
    if (['CLOSED', 'CANCELLED', 'RECEIVED'].includes(po.status)) {
      return res.status(400).json({ error: `ไม่สามารถตรวจรับได้เนื่องจาก PO ${po.poNo || po.id} อยู่ในสถานะ "${po.status}" เรียบร้อยแล้ว` });
    }

    // 2. Idempotency Check on grNumber
    const existingLogsForGr = stockLogs.filter(l => l.grNumber && l.grNumber === grNumber);
    if (existingLogsForGr.length > 0) {
      return res.json({
        success: true,
        message: 'Idempotent replay: รายการตรวจรับนี้ถูกบันทึกเข้าระบบแล้ว',
        po,
        products,
        stockLogs,
        budgets
      });
    }

    // 3. Form Boundary & Quantity Boundary Validation
    const receiveMap = {};
    for (const r of receivingItems) {
      receiveMap[r.productId] = Number(r.receivedThisTime) || 0;
    }

    for (const item of (po.items || [])) {
      const ordered = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
      const already = Number(item.receivedQty) || 0;
      const incoming = receiveMap[item.productId] ?? 0;

      if (incoming < 0) {
        return res.status(400).json({ error: `จำนวนรับสำหรับรายการ "${item.name}" ต้องไม่ติดลบ` });
      }
      if (already + incoming > ordered) {
        return res.status(400).json({
          error: `จำนวนตรวจรับรายการ "${item.name}" เกินยอดสั่งซื้อ: รับไปแล้ว ${already} + จะรับเพิ่ม ${incoming} = ${already + incoming} (สั่งซื้อ ${ordered})`
        });
      }
    }

    // 4. Atomic Transaction Processing
    let allFullyReceived = true;
    let hasAnyClaim = false;
    const problematicItems = options?.problematicItems || {};
    const receivingLocations = options?.receivingLocations || {};
    const grAttachments = options?.grAttachments || [];
    const receivedSummaryParts = [];
    const problematicSummaryParts = [];
    const claimItemList = [];

    const REASON_LABELS = {
      'SHORT_SHIPMENT': 'ได้รับสินค้าไม่ครบ (ขาดส่ง)',
      'DAMAGED': 'สินค้าชำรุด / เสียหาย',
      'WRONG_SPEC': 'สินค้าไม่ตรงสเปก / ส่งผิดรุ่น',
      'OTHER': 'อื่นๆ (ตามรายละเอียด)'
    };

    po.items.forEach(poItem => {
      const pQty = Number(poItem.orderedQty ?? poItem.purchaseQty ?? poItem.qty) || 0;
      const alreadyReceived = Number(poItem.receivedQty) || 0;
      const incomingQty = receiveMap[poItem.productId] ?? 0;
      const thisReceive = Math.min(incomingQty, Math.max(0, pQty - alreadyReceived));

      if (receivingLocations[poItem.productId]) {
        poItem.receivingLocation = receivingLocations[poItem.productId];
      }

      const probInfo = problematicItems[poItem.productId];
      const isProb = Boolean(probInfo?.isProblematic);
      const claimedQty = isProb ? (Number(probInfo?.claimedQty) > 0 ? Number(probInfo.claimedQty) : (thisReceive > 0 ? thisReceive : Math.max(1, pQty - (alreadyReceived + thisReceive)))) : 0;
      const rawReason = probInfo?.reason || 'DAMAGED';
      const reasonLabel = REASON_LABELS[rawReason] || rawReason;
      const defectNote = (probInfo?.description || probInfo?.defectReason || '').trim();

      const rate = Number(poItem.conversionRate) > 0 ? Number(poItem.conversionRate) : 1;
      const tId = String(poItem.productId || poItem.id || '').trim().toLowerCase();
      const tCode = String(poItem.code || poItem.productCode || '').trim().toLowerCase();
      const tName = String(poItem.name || '').trim().toLowerCase();

      const prodIndex = products.findIndex(p => {
        if (!p) return false;
        const pId = String(p.id || '').trim().toLowerCase();
        const pCode = String(p.code || '').trim().toLowerCase();
        const pName = String(p.name || '').trim().toLowerCase();
        return (
          (tId && (pId === tId || pCode === tId)) ||
          (tCode && (pCode === tCode || pId === tCode)) ||
          (tName && pName === tName)
        );
      });
      const prod = prodIndex !== -1 ? products[prodIndex] : null;
      const sUnit = prod?.stockUnit || prod?.unit || poItem.stockUnit || poItem.unit || 'ชิ้น';
      const pUnit = prod?.purchaseUnit || prod?.unit || poItem.purchaseUnit || sUnit;
      const itemUnitPrice = Number(poItem.actUnitPrice ?? poItem.actualPrice ?? poItem.price ?? prod?.price) || 0;
      const stockUnitPrice = itemUnitPrice > 0 && rate > 0 ? (itemUnitPrice / rate) : (Number(prod?.price) || 0);

      // 4.1 Update stock and write stockLogs only for actual accepted quantity
      if (thisReceive > 0) {
        const stockReceive = thisReceive * rate;
        poItem.receivedQty = alreadyReceived + thisReceive;
        poItem.receivedStockQty = (Number(poItem.receivedStockQty) || 0) + stockReceive;
        poItem.orderedQty = pQty;
        poItem.remainingQty = Math.max(0, pQty - poItem.receivedQty);

        if (prod) {
          const currentBal = Number(prod.stockBalance) || 0;
          if (!isProb) {
            const newBal = currentBal + stockReceive;
            prod.stockBalance = newBal;

            const logNote = rate > 1
              ? `รับสินค้า ${thisReceive} ${pUnit} (= ${stockReceive} ${sUnit}) จาก PO ${po.poNo}`
              : `รับสินค้า ${thisReceive} ${sUnit} จาก PO ${po.poNo}`;

            stockLogs.unshift({
              id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              grNumber,
              documentNo: grNumber,
              docNo: grNumber,
              grnNo: grNumber,
              grnNumber: grNumber,
              date: timestamp,
              isoDate: new Date().toISOString(),
              productId: prod.id,
              productCode: prod.code,
              name: prod.name,
              type: 'IN',
              poNo: po.poNo,
              poNumber: po.poNo,
              refPo: po.poNo,
              roundNumber,
              qty: stockReceive,
              receivedQty: thisReceive,
              unit: sUnit,
              balance: newBal,
              unitPrice: stockUnitPrice,
              totalPrice: stockUnitPrice * stockReceive,
              actualPrice: itemUnitPrice,
              user: `${user.name || 'System'} (${user.title || 'Requester'})`,
              locationId: prod.locationId || '',
              locationName: prod.locationName || '',
              note: note || logNote
            });
          } else {
            stockLogs.unshift({
              id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              grNumber,
              documentNo: grNumber,
              docNo: grNumber,
              grnNo: grNumber,
              grnNumber: grNumber,
              date: timestamp,
              productId: poItem.productId,
              productCode: poItem.code,
              type: 'IN_NG',
              poNo: po.poNo,
              poNumber: po.poNo,
              refPo: po.poNo,
              roundNumber,
              qty: stockReceive,
              unit: sUnit,
              balance: currentBal,
              user: `${user.name || 'System'} (${user.title || 'Requester'})`,
              locationId: prod.locationId || '',
              locationName: prod.locationName || '',
              note: `[สินค้าชำรุด/NG] ${defectNote || reasonLabel}`
            });
          }
        }
        receivedSummaryParts.push(`${poItem.name}: ${thisReceive} ${pUnit}`);
      }

      // 4.2 Process Problematic / Claimed Items
      if (isProb) {
        hasAnyClaim = true;
        allFullyReceived = false;

        const claimedStockQty = claimedQty * rate;
        poItem.hasDefect = true;
        poItem.claimedQty = (Number(poItem.claimedQty) || 0) + claimedQty;
        poItem.receivedNgQty = (Number(poItem.receivedNgQty) || 0) + claimedStockQty;
        poItem.defectReason = defectNote || reasonLabel;
        poItem.defectNote = defectNote || reasonLabel;

        po.ngItems = po.ngItems || [];
        po.ngItems.push({
          productId: poItem.productId,
          productCode: poItem.code,
          name: poItem.name,
          qty: claimedStockQty,
          unit: sUnit,
          defectNote: defectNote || reasonLabel,
          defectReason: defectNote || reasonLabel,
          reason: rawReason,
          date: timestamp
        });

        stockLogs.unshift({
          id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          grNumber,
          date: timestamp,
          productId: poItem.productId,
          productCode: poItem.code,
          type: 'NG',
          docNo: po.poNo,
          qty: claimedStockQty,
          unit: sUnit,
          balance: prod ? prod.stockBalance : 0,
          user: `${user.name || 'System'} (${user.title || 'Requester'})`,
          note: `[สินค้ามีปัญหา/เคลม (${reasonLabel})] ${defectNote || '-'} (PO ${po.poNo})`
        });

        claimItemList.push({
          productId: poItem.productId,
          code: poItem.code,
          name: poItem.name,
          orderedQty: pQty,
          receivedQty: thisReceive,
          claimedQty: claimedQty,
          purchaseUnit: pUnit,
          stockUnit: sUnit,
          reason: rawReason,
          reasonLabel: reasonLabel,
          description: defectNote || reasonLabel,
          photo: probInfo.photo || null
        });

        problematicSummaryParts.push(`${poItem.name}: มีปัญหา ${claimedQty} ${pUnit} (${reasonLabel}${defectNote ? ` - ${defectNote}` : ''})`);
      } else {
        if (poItem.receivedQty < pQty) {
          allFullyReceived = false;
        }
      }
    });

    if (Array.isArray(grAttachments) && grAttachments.length > 0) {
      po.grAttachments = [...(po.grAttachments || []), ...grAttachments];
    }

    // 4.3 Update PO status
    if (hasAnyClaim) {
      po.status = 'CLAIM_REPORTED';
    } else {
      po.status = allFullyReceived ? 'CLOSED' : 'PARTIAL';
    }

    const summaryParts = [];
    if (receivedSummaryParts.length > 0) summaryParts.push(`รับปกติ: ${receivedSummaryParts.join(', ')}`);
    if (problematicSummaryParts.length > 0) summaryParts.push(`ส่งเรื่องเคลม: ${problematicSummaryParts.join(', ')}`);
    const summaryNote = summaryParts.join(' | ') + (note ? ` (หมายเหตุ: ${note})` : '');

    po.activityLog = po.activityLog || [];
    po.activityLog.push({
      action: allFullyReceived ? 'รับสินค้าครบและปิด PO (Goods Received – Closed)' : (hasAnyClaim ? 'ตรวจรับสินค้าพร้อมแจ้งเคลม' : 'รับสินค้าบางส่วน (Partial Receiving)'),
      user: user.name || 'System',
      role: user.title || 'Requester',
      timestamp,
      note: summaryNote,
      grNumber
    });

    // 4.4 Budget Arithmetic on Full Receipt
    if (allFullyReceived && !hasAnyClaim) {
      const dept = po.department || 'PD';
      if (budgets[dept]) {
        const poAmount = Number(po.grandTotal || po.totalAmount || po.subtotal || 0);
        if (poAmount > 0) {
          budgets[dept].pending = Math.max(0, (Number(budgets[dept].pending) || 0) - poAmount);
          budgets[dept].spent = (Number(budgets[dept].spent) || 0) + poAmount;
          budgets[dept].variance = (Number(budgets[dept].monthlyBudget) || 0) - budgets[dept].spent;

          const today = new Date();
          const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          if (!budgets[dept].historicalSpent) budgets[dept].historicalSpent = {};
          budgets[dept].historicalSpent[monthKey] = (Number(budgets[dept].historicalSpent[monthKey]) || 0) + poAmount;
        }
      }
    }

    pos[poIndex] = po;

    // 4.5 Atomic File Persistence
    await Promise.all([
      writeFile('pos.json', pos),
      writeFile('products.json', products),
      writeFile('stockLogs.json', stockLogs),
      writeFile('budgets.json', budgets)
    ]);

    res.json({
      success: true,
      po,
      products,
      stockLogs,
      budgets
    });
  } catch (err) {
    console.error('[Backend] GR Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 6. Stock Movement Logs ──
app.get('/api/stock-logs', async (req, res) => {
  try {
    const logs = await readFile('stockLogs.json', []);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/stock-logs', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('stockLogs.json', data);
      return res.json(data);
    }
    const logs = await readFile('stockLogs.json', []);
    logs.unshift(data);
    await writeFile('stockLogs.json', logs);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 7. Budgets ──
app.get('/api/budgets', async (req, res) => {
  try {
    const { year, month } = req.query;
    const budgets = await readFile('budgets.json', initialBudgets);
    const departments = await readFile('departments.json', initialDepartments);
    let changed = false;

    // Ensure all departments from departments.json exist in budgets.json
    departments.forEach(dept => {
      if (!budgets[dept.code]) {
        budgets[dept.code] = {
          monthlyBudget: Number(dept.monthlyBudget) || 200000,
          spent: 0,
          pending: 0,
          variance: Number(dept.monthlyBudget) || 200000,
          history: {},
          historicalSpent: {}
        };
        changed = true;
      }
    });

    if (changed) {
      await writeFile('budgets.json', budgets);
    }

    if (year && month) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthData = {};
      Object.keys(budgets).forEach(dept => {
        const d = budgets[dept] || {};
        monthData[dept] = {
          baseAllocated: d.history?.[monthKey] || d.monthlyBudget || 200000,
          actualSpent: d.historicalSpent?.[monthKey] || 0,
          committed: 0
        };
      });
      return res.json({ monthKey, data: monthData, budgets });
    }
    res.json(budgets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    await writeFile('budgets.json', req.body);
    res.json(req.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/budgets', async (req, res) => {
  try {
    await writeFile('budgets.json', req.body);
    res.json(req.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 7.1 Budget Adjustment & Top-up Endpoint (Writes budgets.json + budgetTransactions.json) ──
app.post('/api/budgets/adjust', async (req, res) => {
  try {
    const { dept, action, newAmount, previousAmount, delta, reason, actor, targetMonth } = req.body;
    if (!dept) {
      return res.status(400).json({ error: 'Missing department code' });
    }

    const budgets = await readFile('budgets.json', initialBudgets);
    const departments = await readFile('departments.json', initialDepartments);
    const transactions = await readFile('budgetTransactions.json', []);

    if (!budgets[dept]) {
      budgets[dept] = { monthlyBudget: 0, spent: 0, pending: 0, variance: 0, history: {}, historicalSpent: {} };
    }

    const currentMonthly = Number(budgets[dept].monthlyBudget) || 0;
    const prev = previousAmount !== undefined ? Number(previousAmount) : currentMonthly;
    let finalAmount = prev;

    if (action === 'TOP_UP') {
      finalAmount = prev + Number(delta || 0);
      budgets[dept].monthlyBudget = finalAmount;
      const spent = Number(budgets[dept].spent) || 0;
      budgets[dept].variance = finalAmount - spent;
    } else if (action === 'BUDGET_ROLLBACK') {
      const rollbackAmt = Number(delta || 0);
      const curSpent = previousAmount !== undefined ? Number(previousAmount) : Number(budgets[dept].spent ?? budgets[dept].actualExpense ?? 0);
      const newSpent = newAmount !== undefined ? Number(newAmount) : Math.max(0, curSpent - rollbackAmt);
      budgets[dept].spent = newSpent;
      budgets[dept].actualExpense = newSpent;
      budgets[dept].variance = (Number(budgets[dept].variance) || (currentMonthly - curSpent)) + rollbackAmt;
      budgets[dept].remainingBudget = budgets[dept].variance;
      if (!budgets[dept].refundCredits) budgets[dept].refundCredits = {};
      budgets[dept].refundCredits[monthKey] = (Number(budgets[dept].refundCredits[monthKey]) || 0) + rollbackAmt;
      finalAmount = currentMonthly;
    } else if (action === 'SET_BUDGET' || action === 'ADJUST') {
      finalAmount = Number(newAmount !== undefined ? newAmount : prev);
      budgets[dept].monthlyBudget = finalAmount;
      const spent = Number(budgets[dept].spent) || 0;
      budgets[dept].variance = finalAmount - spent;
    }

    const today = new Date();
    const monthKey = targetMonth || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (!budgets[dept].history) budgets[dept].history = {};
    if (action !== 'BUDGET_ROLLBACK') {
      budgets[dept].history[monthKey] = finalAmount;
    }

    // 1. Write budgets.json
    await writeFile('budgets.json', budgets);

    // 2. Sync monthlyBudget to departments.json if present
    if (action !== 'BUDGET_ROLLBACK') {
      const deptObj = departments.find(d => d.code === dept);
      if (deptObj) {
        deptObj.monthlyBudget = finalAmount;
        await writeFile('departments.json', departments);
      }
    }

    // 3. Create and append transaction log to budgetTransactions.json
    const nowStr = today.toISOString().replace('T', ' ').slice(0, 19);
    const amountDiff = action === 'BUDGET_ROLLBACK' ? Number(delta || 0) : finalAmount - prev;
    const newTx = {
      id: `BTX-${Date.now()}`,
      date: nowStr,
      createdAt: today.toISOString(),
      dept,
      type: action || 'ADJUST',
      typeLabel: action === 'SET_BUDGET' 
        ? 'กำหนดงบประมาณประจำเดือน (Monthly Allocation)' 
        : action === 'TOP_UP' 
          ? 'เติมงบประมาณพิเศษ (Budget Top-up)' 
          : action === 'BUDGET_ROLLBACK'
            ? 'คืนงบประมาณ (Budget Reversal)'
            : 'ปรับยอดงบประมาณ (Adjustment)',
      previousAmount: prev,
      newAmount: finalAmount,
      amount: amountDiff,
      actor: actor || 'ผู้ดูแลระบบ (Admin)',
      note: reason || 'ปรับปรุงงบประมาณประจำเดือน',
      targetMonth: monthKey
    };

    transactions.unshift(newTx);
    await writeFile('budgetTransactions.json', transactions);

    res.json({
      success: true,
      budget: budgets[dept],
      transaction: newTx,
      budgets,
      transactions
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 7.2 Budget Transactions Log Endpoints ──
app.get('/api/budget-transactions', async (req, res) => {
  try {
    const transactions = await readFile('budgetTransactions.json', []);
    res.json(transactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/budget-transactions', async (req, res) => {
  try {
    const transactions = await readFile('budgetTransactions.json', []);
    const tx = req.body;
    const newTx = {
      id: tx.id || `BTX-${Date.now()}`,
      date: tx.date || new Date().toISOString().replace('T', ' ').slice(0, 19),
      createdAt: tx.createdAt || new Date().toISOString(),
      ...tx
    };
    transactions.unshift(newTx);
    await writeFile('budgetTransactions.json', transactions);
    res.json(newTx);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 7.1 Notifications ──
app.get('/api/notifications', async (req, res) => {
  try {
    const notis = await readFile('notifications.json', []);
    res.json(notis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('notifications.json', data);
      return res.json(data);
    }
    const notis = await readFile('notifications.json', []);
    notis.unshift(data);
    const trimmed = notis.slice(0, 100);
    await writeFile('notifications.json', trimmed);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const notis = await readFile('notifications.json', []);
    const idx = notis.findIndex(n => n.id === id);
    if (idx !== -1) {
      notis[idx] = { ...notis[idx], ...updated };
    }
    await writeFile('notifications.json', notis);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notis = await readFile('notifications.json', []);
    const filtered = notis.filter(n => n.id !== id);
    await writeFile('notifications.json', filtered);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/notifications', async (req, res) => {
  try {
    await writeFile('notifications.json', []);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 7.2 Audit Logs ──
app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await readFile('auditLogs.json', []);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('auditLogs.json', data);
      return res.json(data);
    }
    const logs = await readFile('auditLogs.json', []);
    logs.unshift(data);
    await writeFile('auditLogs.json', logs);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/audit-logs', async (req, res) => {
  try {
    await writeFile('auditLogs.json', []);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 8. Generic Key-Value Bulk Storage (For backward compatibility & quick sync) ──
app.get('/api/storage', async (req, res) => {
  try {
    const [products, vendors, storageLocations, usageUnits, users, prs, pos, stockLogs, budgets, prCounters, budgetTransactions, auditLogs, notifications] = await Promise.all([
      readFile('products.json', []),
      readFile('vendors.json', []),
      readFile('storageLocations.json', initialStorageLocations),
      readFile('usageUnits.json', initialUsageUnits),
      readFile('users.json', initialUsers),
      readFile('prs.json', []),
      readFile('pos.json', []),
      readFile('stockLogs.json', []),
      readFile('budgets.json', initialBudgets),
      readFile('prCounters.json', initialCounters),
      readFile('budgetTransactions.json', []),
      readFile('auditLogs.json', []),
      readFile('notifications.json', [])
    ]);

    res.json({
      prpo_products_data: products,
      prpo_vendors_data: vendors,
      prpo_storage_locations_data: storageLocations,
      prpo_usage_units_data: usageUnits,
      prpo_users_data: users,
      prpo_prs_data: prs,
      prpo_pos_data: pos,
      prpo_stock_logs: stockLogs,
      prpo_budgets_data: budgets,
      prpo_pr_counters: prCounters,
      prpo_budget_transactions: budgetTransactions,
      prpo_audit_logs: auditLogs,
      prpo_notifications: notifications
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.post('/api/storage', async (req, res) => {
  try {
    const data = req.body || {};
    const writes = [];

    if (Array.isArray(data.prpo_products_data) && data.prpo_products_data.length > 0) {
      const sanitizedProds = data.prpo_products_data
        .flatMap(p => Array.isArray(p) ? p : [p])
        .filter(p => p && typeof p === 'object' && !isBlacklistedProduct(p));
      writes.push(writeFile('products.json', sanitizedProds));
    }
    if (Array.isArray(data.prpo_vendors_data) && data.prpo_vendors_data.length > 0) {
      writes.push(writeFile('vendors.json', data.prpo_vendors_data));
    }
    if (Array.isArray(data.prpo_storage_locations_data) && data.prpo_storage_locations_data.length > 0) {
      writes.push(writeFile('storageLocations.json', data.prpo_storage_locations_data));
    }
    if (Array.isArray(data.prpo_usage_units_data) && data.prpo_usage_units_data.length > 0) {
      writes.push(writeFile('usageUnits.json', data.prpo_usage_units_data));
    }
    if (Array.isArray(data.prpo_users_data) && data.prpo_users_data.length > 0) {
      writes.push(writeFile('users.json', data.prpo_users_data));
    }
    if (data.prpo_budgets_data && typeof data.prpo_budgets_data === 'object' && Object.keys(data.prpo_budgets_data).length > 0) {
      writes.push(writeFile('budgets.json', data.prpo_budgets_data));
    }
    if (data.prpo_pr_counters && typeof data.prpo_pr_counters === 'object' && Object.keys(data.prpo_pr_counters).length > 0) {
      writes.push(writeFile('prCounters.json', data.prpo_pr_counters));
    }

    // Operational/Transaction Data
    if (data.prpo_prs_data !== undefined) {
      const seenPr = new Set();
      const uniquePrs = (Array.isArray(data.prpo_prs_data) ? data.prpo_prs_data : []).filter(p => {
        const key = p.id || p.prNo;
        if (!key || seenPr.has(key)) return false;
        seenPr.add(key);
        return true;
      });
      writes.push(writeFile('prs.json', uniquePrs));
    }
    if (data.prpo_pos_data !== undefined) {
      const seenPo = new Set();
      const uniquePos = (Array.isArray(data.prpo_pos_data) ? data.prpo_pos_data : []).filter(p => {
        const key = p.poNo || p.poNumber || p.id;
        if (!key || seenPo.has(key)) return false;
        seenPo.add(key);
        return true;
      });
      writes.push(writeFile('pos.json', uniquePos));
    }
    if (data.prpo_stock_logs !== undefined) writes.push(writeFile('stockLogs.json', data.prpo_stock_logs));
    if (data.prpo_budget_transactions !== undefined) writes.push(writeFile('budgetTransactions.json', data.prpo_budget_transactions));
    if (data.prpo_audit_logs !== undefined) writes.push(writeFile('auditLogs.json', data.prpo_audit_logs));
    if (data.prpo_notifications !== undefined) writes.push(writeFile('notifications.json', data.prpo_notifications));

    await Promise.all(writes);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// File Upload Endpoint (Local Express Storage)
const uploadsDir = path.join(dataDir, 'uploads');
if (!fsSync.existsSync(uploadsDir)) {
  fsSync.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/api/uploads', express.static(uploadsDir));

app.post('/api/upload', async (req, res) => {
  try {
    const { base64Data, fileName, mimeType, category, poNumber, folderPath, description } = req.body || {};
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data' });
    }

    const fileId = `FILE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const safeName = (fileName || `${fileId}.bin`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFileName = `${Date.now()}_${safeName}`;
    const filePath = path.join(uploadsDir, storedFileName);

    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/api/uploads/${storedFileName}`;
    res.json({
      success: true,
      fileId,
      fileUrl,
      fileName: fileName || safeName,
      folderPath: folderPath || category || '',
      description: description || '',
      size: buffer.length
    });
  } catch (err) {
    console.error('[server] File upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Local API Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Local API Backend] Data stored at: ${dataDir}`);
});
