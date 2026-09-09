import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  { id: 'UNIT-QC-003', name: 'ห้อง Sensory', department: 'QC', dot: 'bg-fuchsia-500', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80', status: 'ACTIVE' },
  { id: 'UNIT-QC-004', name: 'ออฟฟิศ QC', department: 'QC', dot: 'bg-rose-500', color: 'bg-rose-50 text-rose-700 border-rose-200/80', status: 'ACTIVE' }
];

const initialBudgets = {
  PD: {
    monthlyBudget: 250000,
    spent: 0,
    pending: 0,
    variance: 0,
    history: {
      "2024-10": 250000, "2024-11": 250000, "2024-12": 250000,
      "2025-01": 250000, "2025-02": 250000, "2025-03": 250000,
      "2025-04": 250000, "2025-05": 250000, "2025-06": 250000,
      "2025-07": 250000, "2025-08": 250000, "2025-09": 250000,
      "2025-10": 250000, "2025-11": 250000, "2025-12": 250000,
      "2026-01": 250000, "2026-02": 250000, "2026-03": 250000,
      "2026-04": 250000, "2026-05": 250000, "2026-06": 250000,
      "2026-07": 250000, "2026-08": 250000, "2026-09": 250000
    },
    historicalSpent: {
      "2024-10": 0, "2024-11": 0, "2024-12": 0,
      "2025-01": 0, "2025-02": 0, "2025-03": 0,
      "2025-04": 0, "2025-05": 0, "2025-06": 0,
      "2025-07": 0, "2025-08": 0, "2025-09": 0,
      "2025-10": 0, "2025-11": 0, "2025-12": 0,
      "2026-01": 0, "2026-02": 0, "2026-03": 0,
      "2026-04": 0, "2026-05": 0, "2026-06": 0,
      "2026-07": 0, "2026-08": 0, "2026-09": 0
    }
  },
  QC: {
    monthlyBudget: 150000,
    spent: 0,
    pending: 0,
    variance: 0,
    history: {
      "2024-10": 150000, "2024-11": 150000, "2024-12": 150000,
      "2025-01": 150000, "2025-02": 150000, "2025-03": 150000,
      "2025-04": 150000, "2025-05": 150000, "2025-06": 150000,
      "2025-07": 150000, "2025-08": 150000, "2025-09": 150000,
      "2025-10": 150000, "2025-11": 150000, "2025-12": 150000,
      "2026-01": 150000, "2026-02": 150000, "2026-03": 150000,
      "2026-04": 150000, "2026-05": 150000, "2026-06": 150000,
      "2026-07": 150000, "2026-08": 150000, "2026-09": 150000
    },
    historicalSpent: {
      "2024-10": 0, "2024-11": 0, "2024-12": 0,
      "2025-01": 0, "2025-02": 0, "2025-03": 0,
      "2025-04": 0, "2025-05": 0, "2025-06": 0,
      "2025-07": 0, "2025-08": 0, "2025-09": 0,
      "2025-10": 0, "2025-11": 0, "2025-12": 0,
      "2026-01": 0, "2026-02": 0, "2026-03": 0,
      "2026-04": 0, "2026-05": 0, "2026-06": 0,
      "2026-07": 0, "2026-08": 0, "2026-09": 0
    }
  }
};

const initialCounters = {
  PD: { PR: 0, PO: 0 },
  QC: { PR: 0, PO: 0 }
};

// Seed product items from initial catalog
const defaultSeedCatalog = {
  'storageLocations.json': initialStorageLocations,
  'usageUnits.json': initialUsageUnits,
  'prs.json': [],
  'pos.json': [],
  'stockLogs.json': [],
  'budgets.json': initialBudgets,
  'prCounters.json': initialCounters,
  'budgetTransactions.json': [],
  'auditLogs.json': [],
  'notifications.json': []
};

// File helpers with atomic write to prevent read-during-write corruption
const getFilePath = (fileName) => path.join(dataDir, fileName);

async function writeFile(fileName, data) {
  const filePath = getFilePath(fileName);
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch {}
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

async function readFile(fileName, defaultValue = []) {
  const filePath = getFilePath(fileName);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content || !content.trim()) {
      const fallback = defaultSeedCatalog[fileName] !== undefined ? defaultSeedCatalog[fileName] : defaultValue;
      await writeFile(fileName, fallback);
      return fallback;
    }
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const fallback = defaultSeedCatalog[fileName] !== undefined ? defaultSeedCatalog[fileName] : defaultValue;
      await writeFile(fileName, fallback);
      return fallback;
    }
    console.error(`[Backend] Read error for ${fileName}:`, err);
    return defaultSeedCatalog[fileName] !== undefined ? defaultSeedCatalog[fileName] : defaultValue;
  }
}

// ── 1. Products ──
app.get('/api/products', async (req, res) => {
  try {
    const products = await readFile('products.json', []);
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('products.json', data);
      return res.json(data);
    }
    const products = await readFile('products.json', []);
    products.unshift(data);
    await writeFile('products.json', products);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const products = await readFile('products.json', []);
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...updated };
    } else {
      products.push(updated);
    }
    await writeFile('products.json', products);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const products = await readFile('products.json', []);
    const filtered = products.filter(p => p.id !== id && p.code !== id);
    await writeFile('products.json', filtered);
    res.json({ success: true, id });
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
    const updated = req.body;
    const vendors = await readFile('vendors.json', []);
    const idx = vendors.findIndex(v => v.id === id);
    if (idx !== -1) {
      vendors[idx] = { ...vendors[idx], ...updated };
    } else {
      vendors.push(updated);
    }
    await writeFile('vendors.json', vendors);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vendors = await readFile('vendors.json', []);
    const filtered = vendors.filter(v => v.id !== id);
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
      const seen = new Set();
      const unique = data.filter(p => {
        const key = p.poNo || p.poNumber || p.id;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await writeFile('pos.json', unique);
      return res.json(unique);
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
    const grNumber = bodyGrNo || options?.grNumber || options?.grId || `GR-${poId}-${Date.now()}`;
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
      const prodIndex = products.findIndex(p => p.id === poItem.productId);
      const prod = prodIndex !== -1 ? products[prodIndex] : null;
      const sUnit = prod?.stockUnit || prod?.unit || poItem.stockUnit || poItem.unit || 'ชิ้น';
      const pUnit = prod?.purchaseUnit || prod?.unit || poItem.purchaseUnit || sUnit;

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
              date: timestamp,
              productId: poItem.productId,
              productCode: poItem.code,
              type: 'IN',
              docNo: po.poNo,
              qty: stockReceive,
              unit: sUnit,
              balance: newBal,
              user: `${user.name || 'System'} (${user.title || 'Requester'})`,
              note: note || logNote
            });
          } else {
            stockLogs.unshift({
              id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              grNumber,
              date: timestamp,
              productId: poItem.productId,
              productCode: poItem.code,
              type: 'IN_NG',
              docNo: po.poNo,
              qty: stockReceive,
              unit: sUnit,
              balance: currentBal,
              user: `${user.name || 'System'} (${user.title || 'Requester'})`,
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
    const [products, vendors, storageLocations, usageUnits, prs, pos, stockLogs, budgets, prCounters, budgetTransactions, auditLogs, notifications] = await Promise.all([
      readFile('products.json', []),
      readFile('vendors.json', []),
      readFile('storageLocations.json', initialStorageLocations),
      readFile('usageUnits.json', initialUsageUnits),
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

    if (data.prpo_products_data) writes.push(writeFile('products.json', data.prpo_products_data));
    if (data.prpo_vendors_data) writes.push(writeFile('vendors.json', data.prpo_vendors_data));
    if (data.prpo_storage_locations_data) writes.push(writeFile('storageLocations.json', data.prpo_storage_locations_data));
    if (data.prpo_usage_units_data) writes.push(writeFile('usageUnits.json', data.prpo_usage_units_data));
    if (data.prpo_prs_data) {
      const seenPr = new Set();
      const uniquePrs = (Array.isArray(data.prpo_prs_data) ? data.prpo_prs_data : []).filter(p => {
        const key = p.id || p.prNo;
        if (!key || seenPr.has(key)) return false;
        seenPr.add(key);
        return true;
      });
      writes.push(writeFile('prs.json', uniquePrs));
    }
    if (data.prpo_pos_data) {
      const seenPo = new Set();
      const uniquePos = (Array.isArray(data.prpo_pos_data) ? data.prpo_pos_data : []).filter(p => {
        const key = p.poNo || p.poNumber || p.id;
        if (!key || seenPo.has(key)) return false;
        seenPo.add(key);
        return true;
      });
      writes.push(writeFile('pos.json', uniquePos));
    }
    if (data.prpo_stock_logs) writes.push(writeFile('stockLogs.json', data.prpo_stock_logs));
    if (data.prpo_budgets_data) writes.push(writeFile('budgets.json', data.prpo_budgets_data));
    if (data.prpo_pr_counters) writes.push(writeFile('prCounters.json', data.prpo_pr_counters));
    if (data.prpo_budget_transactions) writes.push(writeFile('budgetTransactions.json', data.prpo_budget_transactions));
    if (data.prpo_audit_logs) writes.push(writeFile('auditLogs.json', data.prpo_audit_logs));
    if (data.prpo_notifications) writes.push(writeFile('notifications.json', data.prpo_notifications));

    await Promise.all(writes);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Local API Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Local API Backend] Data stored at: ${dataDir}`);
});
