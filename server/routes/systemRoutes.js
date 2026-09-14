import { Router } from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { 
  readFile, 
  writeFile, 
  isBlacklistedProduct, 
  performAutoBackup, 
  backupsDir,
  initialStorageLocations,
  initialUsageUnits,
  initialUsers,
  initialBudgets,
  initialCounters
} from '../storage.js';

const router = Router();

/**
 * System, Bulk Storage, Audit Logs, Notifications & Auto-Backup
 * Routes mounted at /api
 */

// ── 1. Generic Key-Value Bulk Storage ──
router.get('/storage', async (req, res) => {
  try {
    const [
      products, vendors, storageLocations, usageUnits, 
      users, prs, pos, stockLogs, budgets, 
      prCounters, budgetTransactions, auditLogs, notifications
    ] = await Promise.all([
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
  } catch {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

router.post('/storage', async (req, res) => {
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
  } catch {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// ── 2. Notifications ──
router.get('/notifications', async (req, res) => {
  try {
    const notis = await readFile('notifications.json', []);
    res.json(notis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/notifications', async (req, res) => {
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

router.put('/notifications/:id', async (req, res) => {
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

router.delete('/notifications/:id', async (req, res) => {
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

router.delete('/notifications', async (req, res) => {
  try {
    await writeFile('notifications.json', []);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 3. Audit Logs ──
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await readFile('auditLogs.json', []);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/audit-logs', async (req, res) => {
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

router.delete('/audit-logs', async (req, res) => {
  try {
    await writeFile('auditLogs.json', []);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 4. Auto-Backup Endpoints ──
router.post('/backup', async (req, res) => {
  try {
    const reason = req.body?.reason || 'MANUAL_API';
    const result = await performAutoBackup(reason);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/backups', async (req, res) => {
  try {
    if (!fsSync.existsSync(backupsDir)) {
      return res.json({ backups: [] });
    }
    const entries = await fs.readdir(backupsDir, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory() && e.name.startsWith('backup_')).map(e => e.name).sort().reverse();
    
    const details = await Promise.all(folders.map(async (folder) => {
      const manifestPath = path.join(backupsDir, folder, 'manifest.json');
      let manifest = null;
      try {
        if (fsSync.existsSync(manifestPath)) {
          manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        }
      } catch {}
      return {
        folder,
        manifest: manifest || { folder }
      };
    }));

    res.json({ total: details.length, backups: details });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
