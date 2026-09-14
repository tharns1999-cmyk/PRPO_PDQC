import express from 'express';
import cors from 'cors';
import { 
  dataDir, 
  uploadsDir, 
  ensureBootstrapData, 
  performAutoBackup,
  DUMMY_BLACKLIST,
  isBlacklistedProduct
} from './storage.js';

import authRouter from './routes/authRoutes.js';
import masterDataRouter from './routes/masterDataRoutes.js';
import budgetRouter from './routes/budgetRoutes.js';
import procurementRouter from './routes/procurementRoutes.js';
import inventoryRouter from './routes/inventoryRoutes.js';
import uploadRouter from './routes/uploadRoutes.js';
import systemRouter from './routes/systemRoutes.js';

const app = express();

// ── 1. Global Middlewares ──
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── 2. Static File Serving ──
app.use('/api/uploads', express.static(uploadsDir));

// ── 3. Modular Route Mounts (Scoped Standards) ──
app.use('/api/auth', authRouter);
app.use('/api/master-data', masterDataRouter);
app.use('/api/budgets', budgetRouter);
app.use('/api/pr', procurementRouter);
app.use('/api/po', procurementRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/upload', uploadRouter);

// ── 4. Backward-Compatible Direct Mounts (100% Zero Breaking Changes) ──
// Allows existing frontend calls (e.g. /api/products, /api/prs, /api/receive-goods) to work seamlessly
app.use('/api', masterDataRouter);
app.use('/api', budgetRouter);
app.use('/api', procurementRouter);
app.use('/api', inventoryRouter);
app.use('/api', uploadRouter);
app.use('/api', systemRouter);

// ── 5. Health Check & Root Info ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    modular: true,
    timestamp: new Date().toISOString(),
    service: 'PRPO_PDQC Local Express Backend'
  });
});

// ── 6. Bootstrap Data & Automated Backup ──
ensureBootstrapData();
performAutoBackup('STARTUP');

// ── 7. Server Listener ──
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Local API Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Local API Backend] Data stored at: ${dataDir}`);
});

export { DUMMY_BLACKLIST, isBlacklistedProduct };
export default app;
