import { Router } from 'express';
import { readFile, writeFile } from '../storage.js';

const router = Router();

/**
 * Procurement Subsystem (PR & PO Workflows)
 * Routes mounted at /api, /api/pr, /api/po
 */

// ── 1. Purchase Requests (PRs) ──
router.get(['/prs', '/pr'], async (req, res) => {
  try {
    const prs = await readFile('prs.json', []);
    res.json(prs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post(['/prs', '/pr'], async (req, res) => {
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

router.put(['/prs/:id', '/pr/:id'], async (req, res) => {
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

router.delete(['/prs/:id', '/pr/:id'], async (req, res) => {
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

// ── 2. Purchase Orders (POs) ──
router.get(['/pos', '/po'], async (req, res) => {
  try {
    const pos = await readFile('pos.json', []);
    res.json(pos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post(['/pos', '/po'], async (req, res) => {
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

router.put(['/pos/:id', '/po/:id'], async (req, res) => {
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

router.delete(['/pos/:id', '/po/:id'], async (req, res) => {
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

export default router;
