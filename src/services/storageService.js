import { STORAGE_KEYS, ROLES } from '../config/constants.js';
import { initialProducts, initialVendors, initialPRs, initialPOs, initialStockLogs, initialBudgets, initialCounters } from '../data/mockData.js';

const DATA_VERSION = 'prpo_clean_v4';

export const storageService = {
  // Initialize storage if empty or version mismatch
  init() {
    const currentVer = localStorage.getItem('prpo_data_version');
    if (!currentVer || currentVer !== DATA_VERSION) {
      this.resetData();
    }
  },

  // Reset data to initial defaults
  resetData() {
    localStorage.setItem('prpo_data_version', DATA_VERSION);
    localStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, JSON.stringify(ROLES.REQUESTER_PD));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(initialProducts));
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(initialVendors));
    localStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(initialPRs));
    localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(initialPOs));
    localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify(initialStockLogs));
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(initialBudgets));
    localStorage.setItem(STORAGE_KEYS.PR_COUNTERS, JSON.stringify(initialCounters));
    console.log('[StorageService] Mock data reset to default successfully.');
  },

  // Role
  getCurrentRole() {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_ROLE);
    return data ? JSON.parse(data) : ROLES.REQUESTER_PD;
  },
  setCurrentRole(role) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, JSON.stringify(role));
  },

  // Products (with Lazy Migration)
  getProducts() {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const products = data ? JSON.parse(data) : initialProducts;
    
    let needsSave = false;
    const migrated = products.map(p => {
      if (!p.purchaseUnit || !p.stockUnit || p.conversionRate === undefined) {
        needsSave = true;
        const fallbackUnit = p.unit || 'ชิ้น';
        const rate = Number(p.conversionRate) > 0 ? Number(p.conversionRate) : 1;
        return {
          ...p,
          purchaseUnit: p.purchaseUnit || fallbackUnit,
          stockUnit: p.stockUnit || fallbackUnit,
          conversionRate: rate,
          unit: p.stockUnit || fallbackUnit
        };
      }
      return p;
    });

    if (needsSave) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(migrated));
    }
    return migrated;
  },
  saveProducts(products) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },

  // Vendors
  getVendors() {
    const data = localStorage.getItem(STORAGE_KEYS.VENDORS);
    return data ? JSON.parse(data) : initialVendors;
  },
  saveVendors(vendors) {
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(vendors));
  },

  // PRs (with Lazy Migration)
  getPRs() {
    const data = localStorage.getItem(STORAGE_KEYS.PRS);
    const prs = data ? JSON.parse(data) : initialPRs;
    const filtered = prs.filter(pr => pr.department === 'PD' || pr.department === 'QC');
    
    let needsSave = false;
    const migrated = filtered.map(pr => {
      let itemsMigrated = false;
      const items = (pr.items || []).map(item => {
        if (!item.purchaseUnit || !item.stockUnit || item.purchaseQty === undefined || item.stockQty === undefined) {
          itemsMigrated = true;
          needsSave = true;
          const pQty = Number(item.purchaseQty ?? item.qty) || 1;
          const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
          const sQty = Number(item.stockQty) || (pQty * rate);
          const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
          const sUnit = item.stockUnit || item.unit || 'ชิ้น';
          return {
            ...item,
            purchaseQty: pQty,
            stockQty: sQty,
            qty: pQty,
            purchaseUnit: pUnit,
            stockUnit: sUnit,
            unit: pUnit,
            conversionRate: rate
          };
        }
        return item;
      });
      return itemsMigrated ? { ...pr, items } : pr;
    });

    if (needsSave) {
      localStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(migrated));
    }
    return migrated;
  },
  savePRs(prs) {
    localStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(prs));
  },

  // POs (with Lazy Migration)
  getPOs() {
    const data = localStorage.getItem(STORAGE_KEYS.POS);
    const pos = data ? JSON.parse(data) : initialPOs;
    const filtered = pos.filter(po => po.department === 'PD' || po.department === 'QC');

    let needsSave = false;
    const migrated = filtered.map(po => {
      let poUpdated = false;
      let items = po.items || [];

      // If PO has legacy VAT, reset it so it matches PR exactly
      let vat = po.vat;
      let grandTotal = po.grandTotal;
      if (vat > 0) {
        vat = 0;
        grandTotal = po.subtotal || po.totalAmount || grandTotal;
        poUpdated = true;
        needsSave = true;
      }

      items = items.map(item => {
        const needsUnitMigration = !item.purchaseUnit || !item.stockUnit || item.purchaseQty === undefined || item.stockQty === undefined;
        const needsQtyMigration = item.orderedQty === undefined || item.remainingQty === undefined;

        if (needsUnitMigration || needsQtyMigration) {
          poUpdated = true;
          needsSave = true;
          const pQty = Number(item.purchaseQty ?? item.qty) || 1;
          const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
          const sQty = Number(item.stockQty) || (pQty * rate);
          const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
          const sUnit = item.stockUnit || item.unit || 'ชิ้น';
          const orderedQty = item.orderedQty ?? pQty;
          const receivedQty = Number(item.receivedQty) || 0;
          return {
            ...item,
            purchaseQty: pQty,
            stockQty: sQty,
            qty: pQty,
            purchaseUnit: pUnit,
            stockUnit: sUnit,
            unit: pUnit,
            conversionRate: rate,
            orderedQty,
            receivedQty,
            remainingQty: item.remainingQty ?? (orderedQty - receivedQty),
            receivedStockQty: item.receivedStockQty ?? (receivedQty * rate)
          };
        }
        return item;
      });
      return poUpdated ? { ...po, vat, grandTotal, items } : po;
    });

    if (needsSave) {
      localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(migrated));
    }
    return migrated;
  },
  savePOs(pos) {
    localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(pos));
  },

  // Stock Logs
  getStockLogs() {
    const data = localStorage.getItem(STORAGE_KEYS.STOCK_LOGS);
    return data ? JSON.parse(data) : initialStockLogs;
  },
  saveStockLogs(logs) {
    localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify(logs));
  },

  // Budgets
  getBudgets() {
    const data = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    const budgets = data ? JSON.parse(data) : initialBudgets;
    const sanitized = {};
    if (budgets.PD) sanitized.PD = budgets.PD;
    if (budgets.QC) sanitized.QC = budgets.QC;
    return sanitized;
  },
  saveBudgets(budgets) {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  },

  // PR Counters (for generating PR No.)
  getPRCounters() {
    const data = localStorage.getItem(STORAGE_KEYS.PR_COUNTERS);
    return data ? JSON.parse(data) : initialCounters;
  },
  savePRCounters(counters) {
    localStorage.setItem(STORAGE_KEYS.PR_COUNTERS, JSON.stringify(counters));
  },

  // Signatures Management (Admin Managed)
  getSignatures() {
    const data = localStorage.getItem(STORAGE_KEYS.SIGNATURES);
    if (data) {
      try { return JSON.parse(data); } catch (e) { return {}; }
    }
    const defaultSignatures = {
      'ASST_MANAGER': {
        roleId: 'ASST_MANAGER',
        name: 'คุณสมชาย (Asst. Mgr)',
        signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20 50 Q 50 10, 80 50 T 140 50 T 180 30" fill="none" stroke="%231e3a8a" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Somchai (Asst. Mgr)</text></svg>',
        updatedAt: '2026-08-01 09:00:00',
        updatedBy: 'Admin'
      },
      'PLANT_MANAGER': {
        roleId: 'PLANT_MANAGER',
        name: 'คุณประเสริฐ (Plant Mgr)',
        signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M15 45 Q 60 5, 90 45 T 150 45 T 190 25" fill="none" stroke="%230f766e" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Prasert (Plant Mgr)</text></svg>',
        updatedAt: '2026-08-01 09:00:00',
        updatedBy: 'Admin'
      },
      'REVIEWER': {
        roleId: 'REVIEWER',
        name: 'Reviewer',
        signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20 50 Q 50 10, 80 50 T 140 50 T 180 30" fill="none" stroke="%231e3a8a" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Reviewer</text></svg>',
        updatedAt: '2026-08-01 09:00:00',
        updatedBy: 'Admin'
      },
      'APPROVER': {
        roleId: 'APPROVER',
        name: 'Approver',
        signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M15 45 Q 60 5, 90 45 T 150 45 T 190 25" fill="none" stroke="%230f766e" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Approver</text></svg>',
        updatedAt: '2026-08-01 09:00:00',
        updatedBy: 'Admin'
      },
      'ADMIN': {
        roleId: 'ADMIN',
        name: 'Admin System',
        signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20 40 Q 60 10, 100 40 T 170 30" fill="none" stroke="%233730a3" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">System Admin</text></svg>',
        updatedAt: '2026-08-01 09:00:00',
        updatedBy: 'Admin'
      },
      'REQUESTER_PD': {
        roleId: 'REQUESTER_PD',
        name: 'คุณวิชัย (PD)',
        signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M25 45 Q 65 15, 95 45 T 160 40" fill="none" stroke="%232563eb" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Wichai (PD)</text></svg>',
        updatedAt: '2026-08-01 09:00:00',
        updatedBy: 'Admin'
      },
      'REQUESTER_QC': {
        roleId: 'REQUESTER_QC',
        name: 'คุณสมหญิง (QC)',
        signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20 45 Q 55 15, 85 45 T 150 40" fill="none" stroke="%23d97706" stroke-width="3" stroke-linecap="round"/><text x="20" y="70" font-family="sans-serif" font-size="12" fill="%23475569">Somying (QC)</text></svg>',
        updatedAt: '2026-08-01 09:00:00',
        updatedBy: 'Admin'
      }
    };
    localStorage.setItem(STORAGE_KEYS.SIGNATURES, JSON.stringify(defaultSignatures));
    return defaultSignatures;
  },
  saveSignatures(signatures) {
    localStorage.setItem(STORAGE_KEYS.SIGNATURES, JSON.stringify(signatures));
  },
  getSignatureByRole(userOrRoleId) {
    if (!userOrRoleId) return null;
    const sigs = this.getSignatures();
    if (typeof userOrRoleId === 'object') {
      const key = userOrRoleId.roleId || userOrRoleId.id;
      return (
        (key && sigs[key]) ||
        (key && sigs[key.toUpperCase()]) ||
        (userOrRoleId.id && sigs[userOrRoleId.id]) ||
        null
      );
    }
    return sigs[userOrRoleId] || sigs[userOrRoleId?.toUpperCase()] || null;
  },
  saveSignatureForRole(roleId, data) {
    const sigs = this.getSignatures();
    sigs[roleId] = {
      roleId,
      ...data,
      updatedAt: new Date().toLocaleString('th-TH')
    };
    this.saveSignatures(sigs);
    return sigs[roleId];
  },
  deleteSignatureForRole(roleId) {
    const sigs = this.getSignatures();
    delete sigs[roleId];
    delete sigs[roleId?.toUpperCase()];
    if (roleId === 'ASST_MANAGER') delete sigs['REVIEWER'];
    if (roleId === 'PLANT_MANAGER') delete sigs['APPROVER'];
    if (roleId === 'REVIEWER') delete sigs['ASST_MANAGER'];
    if (roleId === 'APPROVER') delete sigs['PLANT_MANAGER'];
    this.saveSignatures(sigs);
  }
};
