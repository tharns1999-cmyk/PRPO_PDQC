import { STORAGE_KEYS, ROLES, INITIAL_USAGE_UNITS } from '../config/constants.js';
import { initialProducts, initialVendors, initialStorageLocations, initialPRs, initialPOs, initialStockLogs, initialBudgets, initialCounters } from '../data/mockData.js';

const DATA_VERSION = 'prpo_clean_v14';
const API_URL = 'http://localhost:3001/api/storage';

// In-Memory Storage Cache backed by Local File API Server
let _cache = {};
let _apiReady = false;

const _syncApi = async () => {
  if (!_apiReady) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_cache)
    });
  } catch (e) {
    console.warn('[StorageService] Local API Sync warning:', e.message);
  }
};

const _getItem = (key) => {
  if (_apiReady && _cache[key] !== undefined) {
    return _cache[key];
  }
  const local = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  return local ? JSON.parse(local) : null;
};

const _setItem = (key, value) => {
  _cache[key] = value;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore storage quota error
    }
  }
  _syncApi();
};

export const storageService = {
  // Initialize storage from Local Node.js Backend with fallback to LocalStorage & Mock Data
  async init() {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        _cache = data || {};
        _apiReady = true;

        // Seed empty backend data from initial defaults if first time
        let needSync = false;
        if (!_cache[STORAGE_KEYS.PRODUCTS] || _cache[STORAGE_KEYS.PRODUCTS].length === 0) {
          _cache[STORAGE_KEYS.PRODUCTS] = initialProducts;
          needSync = true;
        }
        if (!_cache[STORAGE_KEYS.VENDORS] || _cache[STORAGE_KEYS.VENDORS].length === 0) {
          _cache[STORAGE_KEYS.VENDORS] = initialVendors;
          needSync = true;
        }
        if (!_cache[STORAGE_KEYS.STORAGE_LOCATIONS] || _cache[STORAGE_KEYS.STORAGE_LOCATIONS].length === 0) {
          _cache[STORAGE_KEYS.STORAGE_LOCATIONS] = initialStorageLocations;
          needSync = true;
        }
        if (!_cache[STORAGE_KEYS.USAGE_UNITS] || _cache[STORAGE_KEYS.USAGE_UNITS].length === 0) {
          _cache[STORAGE_KEYS.USAGE_UNITS] = INITIAL_USAGE_UNITS;
          needSync = true;
        }
        if (!_cache[STORAGE_KEYS.BUDGETS]) {
          _cache[STORAGE_KEYS.BUDGETS] = initialBudgets;
          needSync = true;
        }
        if (!_cache[STORAGE_KEYS.PR_COUNTERS]) {
          _cache[STORAGE_KEYS.PR_COUNTERS] = initialCounters;
          needSync = true;
        }

        if (needSync) {
          await _syncApi();
        }
        console.log('[StorageService] Synced with Local Node.js File API successfully.');
        return;
      }
    } catch (e) {
      console.warn('[StorageService] Local API not reachable. Using in-memory / LocalStorage fallback.');
    }

    // Fallback to local storage version check
    if (typeof localStorage !== 'undefined') {
      const currentVer = localStorage.getItem('prpo_data_version');
      if (!currentVer || currentVer !== DATA_VERSION) {
        this.resetData();
      }
    }
  },

  // Reset data to initial defaults
  resetData() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('prpo_data_version', DATA_VERSION);
    }
    _setItem(STORAGE_KEYS.CURRENT_ROLE, ROLES.REQUESTER_PD);
    _setItem(STORAGE_KEYS.PRODUCTS, initialProducts);
    _setItem(STORAGE_KEYS.VENDORS, initialVendors);
    _setItem(STORAGE_KEYS.STORAGE_LOCATIONS, initialStorageLocations);
    _setItem(STORAGE_KEYS.USAGE_UNITS, INITIAL_USAGE_UNITS);
    _setItem(STORAGE_KEYS.PRS, []);
    _setItem(STORAGE_KEYS.POS, []);
    _setItem(STORAGE_KEYS.STOCK_LOGS, []);
    _setItem(STORAGE_KEYS.BUDGETS, {
      PD: { monthlyBudget: 250000, spent: 0, pending: 0, variance: 0 },
      QC: { monthlyBudget: 150000, spent: 0, pending: 0, variance: 0 }
    });
    _setItem(STORAGE_KEYS.PR_COUNTERS, {
      PD: { PR: 0, PO: 0 },
      QC: { PR: 0, PO: 0 }
    });
    _setItem('prpo_budget_transactions', []);
    _setItem('prpo_audit_logs', []);
    _setItem('prpo_notifications', []);
    console.log('[StorageService] Operational mock data cleared. Master data preserved.');
  },

  // Role
  getCurrentRole() {
    const data = _getItem(STORAGE_KEYS.CURRENT_ROLE);
    return data || ROLES.REQUESTER_PD;
  },
  setCurrentRole(role) {
    _setItem(STORAGE_KEYS.CURRENT_ROLE, role);
  },

  // Products (with Lazy Migration)
  getProducts() {
    const data = _getItem(STORAGE_KEYS.PRODUCTS);
    const products = data || initialProducts;
    
    let needsSave = false;
    const migrated = products.map(p => {
      let item = { ...p };
      const cat = item.category || item.department || 'PD';
      if (!item.category || !item.department || item.category !== cat || item.department !== cat) {
        needsSave = true;
        item.category = cat;
        item.department = cat;
      }
      // Migrate legacy 'คู่' unit to 'ชิ้น'
      if (item.stockUnit === 'คู่' || item.unit === 'คู่' || item.code === 'PD-GLV-NBR') {
        if (item.stockUnit === 'คู่' || item.unit === 'คู่') {
          needsSave = true;
          item.stockUnit = 'ชิ้น';
          item.unit = 'ชิ้น';
          if (item.purchaseUnit === 'กล่อง (100 ชิ้น)' && (item.conversionRate === 50 || item.conversionRate === 1)) {
            item.conversionRate = 100;
          }
        }
      }
      if (!item.purchaseUnit || !item.stockUnit || item.conversionRate === undefined) {
        needsSave = true;
        const fallbackUnit = item.unit || 'ชิ้น';
        const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
        item = {
          ...item,
          purchaseUnit: item.purchaseUnit || fallbackUnit,
          stockUnit: item.stockUnit || fallbackUnit,
          conversionRate: rate,
          unit: item.stockUnit || fallbackUnit
        };
      }
      return item;
    });

    if (needsSave) {
      _setItem(STORAGE_KEYS.PRODUCTS, migrated);
    }
    return migrated;
  },
  saveProducts(products) {
    _setItem(STORAGE_KEYS.PRODUCTS, products);
  },

  // Storage Locations (Simple Name & Department)
  getStorageLocations() {
    const data = _getItem(STORAGE_KEYS.STORAGE_LOCATIONS);
    if (!data) {
      this.saveStorageLocations(initialStorageLocations);
      return initialStorageLocations;
    }
    return data;
  },
  saveStorageLocations(locations) {
    _setItem(STORAGE_KEYS.STORAGE_LOCATIONS, locations);
  },

  // Usage Units (Department-Scoped Rooms / Units)
  getUsageUnits(department) {
    const data = _getItem(STORAGE_KEYS.USAGE_UNITS);
    const list = data || INITIAL_USAGE_UNITS;
    if (!data) {
      this.saveUsageUnits(INITIAL_USAGE_UNITS);
    }
    if (department && department !== 'ALL') {
      return list.filter(u => u.department === department);
    }
    return list;
  },
  saveUsageUnits(units) {
    _setItem(STORAGE_KEYS.USAGE_UNITS, units);
  },
  saveUsageUnit(unitObj) {
    const units = [...this.getUsageUnits()];
    let updatedUnit = { ...unitObj };
    const isUpdate = Boolean(updatedUnit.id);
    if (!isUpdate) {
      const dept = updatedUnit.department || 'PD';
      updatedUnit.id = `UNIT-${dept}-${Date.now().toString().slice(-6)}`;
      updatedUnit.status = updatedUnit.status || 'ACTIVE';
      units.push(updatedUnit);
    } else {
      const idx = units.findIndex(u => u.id === updatedUnit.id);
      if (idx !== -1) {
        units[idx] = { ...units[idx], ...updatedUnit };
      } else {
        units.push(updatedUnit);
      }
    }
    this.saveUsageUnits(units);
    return updatedUnit;
  },
  deleteUsageUnit(unitId) {
    const units = this.getUsageUnits();
    const filtered = units.filter(u => u.id !== unitId);
    this.saveUsageUnits(filtered);
    return true;
  },
  saveStorageLocation(locationObj) {
    const locations = this.getStorageLocations();
    let updatedLoc = { ...locationObj };
    const isUpdate = Boolean(updatedLoc.id);

    if (!isUpdate) {
      const dept = updatedLoc.department || 'ALL';
      updatedLoc.id = `LOC-${dept}-${Date.now().toString().slice(-6)}`;
      locations.unshift(updatedLoc);
    } else {
      const idx = locations.findIndex(l => l.id === updatedLoc.id);
      if (idx !== -1) {
        locations[idx] = { ...locations[idx], ...updatedLoc };
      } else {
        locations.unshift(updatedLoc);
      }
    }
    this.saveStorageLocations(locations);

    // Cascading Sync on Update: sync all products referencing this locationId
    if (isUpdate) {
      const products = this.getProducts();
      let productsNeedUpdate = false;
      const updatedProducts = products.map(p => {
        if (p.locationId === updatedLoc.id) {
          productsNeedUpdate = true;
          return {
            ...p,
            locationName: updatedLoc.name
          };
        }
        return p;
      });
      if (productsNeedUpdate) {
        this.saveProducts(updatedProducts);
      }
    }

    return updatedLoc;
  },
  deleteStorageLocation(locationId, { reassignToLocationId = null, unlinkProducts = false } = {}) {
    const products = this.getProducts();
    const locations = this.getStorageLocations();
    const assignedProducts = products.filter(p => p.locationId === locationId);

    if (assignedProducts.length > 0 && !unlinkProducts && !reassignToLocationId) {
      throw new Error(`ไม่สามารถลบจุดเก็บนี้ได้ เนื่องจากมีสินค้าผูกอยู่ ${assignedProducts.length} รายการ กรุณาย้ายหรือเปลี่ยนจุดเก็บของสินค้าออกก่อน`);
    }

    if (assignedProducts.length > 0) {
      let targetLoc = null;
      if (reassignToLocationId) {
        targetLoc = locations.find(l => l.id === reassignToLocationId);
      }

      const updatedProducts = products.map(p => {
        if (p.locationId === locationId) {
          if (reassignToLocationId && targetLoc) {
            return {
              ...p,
              locationId: targetLoc.id,
              locationName: targetLoc.name
            };
          } else if (unlinkProducts) {
            return {
              ...p,
              locationId: null,
              locationName: null
            };
          }
        }
        return p;
      });

      this.saveProducts(updatedProducts);
    }

    const filtered = locations.filter(l => l.id !== locationId);
    this.saveStorageLocations(filtered);
    return true;
  },

  // Vendors
  getVendors() {
    const data = _getItem(STORAGE_KEYS.VENDORS);
    return data || initialVendors;
  },
  saveVendors(vendors) {
    _setItem(STORAGE_KEYS.VENDORS, vendors);
  },

  // PRs (with Lazy Migration)
  getPRs() {
    const data = _getItem(STORAGE_KEYS.PRS);
    const prs = Array.isArray(data) ? data : (initialPRs || []);
    const filtered = prs;
    
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
      _setItem(STORAGE_KEYS.PRS, migrated);
    }
    return migrated;
  },
  savePRs(prs) {
    _setItem(STORAGE_KEYS.PRS, prs);
  },

  // POs (with Lazy Migration & Deduplication)
  getPOs() {
    const data = _getItem(STORAGE_KEYS.POS);
    const pos = Array.isArray(data) ? data : (initialPOs || []);
    const filtered = pos.filter(po => po.department === 'PD' || po.department === 'QC');

    // Deduplicate POs by unique identifier
    const seen = new Set();
    const deduplicated = filtered.filter(p => {
      const key = p.poNo || p.poNumber || p.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let needsSave = deduplicated.length !== filtered.length;
    const migrated = deduplicated.map(po => {
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
      _setItem(STORAGE_KEYS.POS, migrated);
    }
    return migrated;
  },
  savePOs(pos) {
    const seen = new Set();
    const unique = (Array.isArray(pos) ? pos : []).filter(p => {
      const key = p.poNo || p.poNumber || p.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    _setItem(STORAGE_KEYS.POS, unique);
  },

  // Stock Logs
  getStockLogs() {
    const data = _getItem(STORAGE_KEYS.STOCK_LOGS);
    return data || initialStockLogs;
  },
  saveStockLogs(logs) {
    _setItem(STORAGE_KEYS.STOCK_LOGS, logs);
  },

  // Budgets
  getBudgets() {
    const data = _getItem(STORAGE_KEYS.BUDGETS);
    const budgets = data || initialBudgets;
    const sanitized = {};
    if (budgets.PD) sanitized.PD = budgets.PD;
    if (budgets.QC) sanitized.QC = budgets.QC;
    return sanitized;
  },
  saveBudgets(budgets) {
    _setItem(STORAGE_KEYS.BUDGETS, budgets);
  },

  // Budget Transaction Log (Refund / Restore entries)
  getBudgetTransactions() {
    const data = _getItem(STORAGE_KEYS.BUDGET_TRANSACTIONS);
    return data || [];
  },
  saveBudgetTransactions(transactions) {
    _setItem(STORAGE_KEYS.BUDGET_TRANSACTIONS, transactions);
  },
  appendBudgetTransaction(tx) {
    const existing = this.getBudgetTransactions();
    existing.unshift({ ...tx, id: `BTX-${Date.now()}` }); // prepend newest first
    _setItem(STORAGE_KEYS.BUDGET_TRANSACTIONS, existing);
  },

  getPRCounters() {
    const data = _getItem(STORAGE_KEYS.PR_COUNTERS);
    return data || initialCounters;
  },
  savePRCounters(counters) {
    _setItem(STORAGE_KEYS.PR_COUNTERS, counters);
  },

  // Signatures Management (Admin Managed)
  getSignatures() {
    const data = _getItem(STORAGE_KEYS.SIGNATURES);
    if (data) {
      return data;
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
    _setItem(STORAGE_KEYS.SIGNATURES, defaultSignatures);
    return defaultSignatures;
  },
  saveSignatures(signatures) {
    _setItem(STORAGE_KEYS.SIGNATURES, signatures);
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
