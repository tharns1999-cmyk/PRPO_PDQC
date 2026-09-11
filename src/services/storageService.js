import { STORAGE_KEYS, ROLES, INITIAL_USAGE_UNITS, INITIAL_DEPARTMENTS } from '../config/constants.js';
import { initialProducts, initialVendors, initialStorageLocations, initialPRs, initialPOs, initialStockLogs, initialBudgets, initialCounters } from '../data/mockData.js';
import { DEFAULT_EMPLOYEE_ACCOUNTS } from './authService.js';

const DATA_VERSION = 'prpo_clean_v16_empty_state';
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

const _migrateLocalStorageCache = () => {
  if (typeof localStorage === 'undefined') return;
  try {
    const currentVersion = localStorage.getItem('prpo_data_version');
    if (currentVersion !== DATA_VERSION) {
      console.log(`[StorageService] Migrating LocalStorage cache to ${DATA_VERSION} (Clean Transactional State)...`);

      // 1. Reset all Transactional Data to empty arrays []
      localStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.BUDGET_TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
      localStorage.setItem('prpo_in_app_notifications', JSON.stringify([]));
      localStorage.setItem('prpo_notifications', JSON.stringify([]));

      // 2. Reset counters to 0
      try {
        localStorage.removeItem(STORAGE_KEYS.PR_COUNTERS);
        localStorage.removeItem('pr_counter');
        localStorage.removeItem('currentRunningIndex');
      } catch (e) {}

      // 3. Reset budget spent and pending to 0 while strictly preserving master monthlyBudget configurations
      const storedBudgets = localStorage.getItem(STORAGE_KEYS.BUDGETS);
      if (storedBudgets) {
        try {
          const parsedB = JSON.parse(storedBudgets);
          if (parsedB && typeof parsedB === 'object') {
            const resetB = {};
            for (const [dept, b] of Object.entries(parsedB)) {
              resetB[dept] = {
                ...b,
                spent: 0,
                pending: 0,
                variance: b.monthlyBudget || 0,
                historicalSpent: {}
              };
            }
            localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(resetB));
          }
        } catch (e) {}
      }

      // Master Data (Vendors, Products, Users, Locations, Usage Units, Signatures, Departments) is 100% PRESERVED!

      localStorage.setItem('prpo_data_version', DATA_VERSION);
    }
  } catch (e) {
    console.warn('[StorageService] LocalStorage migration error:', e.message);
  }
};

// Immediately run migration if in browser environment
_migrateLocalStorageCache();

const _getItem = (key) => {
  if (_apiReady && _cache[key] !== undefined) {
    return _cache[key];
  }
  const local = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  return local ? JSON.parse(local) : null;
};

const _setItem = (key, value, syncWithBackend = false) => {
  _cache[key] = value;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore storage quota error
    }
  }
  if (syncWithBackend) {
    _syncApi();
  }
};

export const storageService = {
  // Initialize storage from Local Node.js Backend with fallback to LocalStorage
  async init() {
    _migrateLocalStorageCache();
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        _cache = data || {};
        _apiReady = true;
        console.log('[StorageService] Synced with Local Node.js File API successfully.');
        return;
      }
    } catch (e) {
      console.warn('[StorageService] Local API not reachable. Using in-memory / LocalStorage fallback.');
    }
  },

  // Reset local browser cache only (Strictly NEVER overwrites server SSOT files)
  resetData() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('prpo_data_version', DATA_VERSION);
    }
    _setItem(STORAGE_KEYS.CURRENT_ROLE, ROLES.REQUESTER_PD, false);
    _setItem(STORAGE_KEYS.PRODUCTS, initialProducts, false);
    _setItem(STORAGE_KEYS.VENDORS, initialVendors, false);
    _setItem(STORAGE_KEYS.STORAGE_LOCATIONS, initialStorageLocations, false);
    _setItem(STORAGE_KEYS.USAGE_UNITS, INITIAL_USAGE_UNITS, false);
    _setItem(STORAGE_KEYS.USERS, DEFAULT_EMPLOYEE_ACCOUNTS, false);
    _setItem(STORAGE_KEYS.PRS, [], false);
    _setItem(STORAGE_KEYS.POS, [], false);
    _setItem(STORAGE_KEYS.STOCK_LOGS, [], false);
    _setItem(STORAGE_KEYS.BUDGETS, {
      PD: { monthlyBudget: 250000, spent: 0, pending: 0, variance: 0 },
      QC: { monthlyBudget: 150000, spent: 0, pending: 0, variance: 0 }
    }, false);
    _setItem(STORAGE_KEYS.PR_COUNTERS, {
      PD: { PR: 0, PO: 0 },
      QC: { PR: 0, PO: 0 }
    }, false);
    _setItem('prpo_budget_transactions', [], false);
    _setItem('prpo_audit_logs', [], false);
    _setItem('prpo_notifications', [], false);
    _setItem('prpo_in_app_notifications', [], false);
    console.log('[StorageService] Local browser cache reset. Server SSOT preserved.');
  },

  // Clear transactional data only (PRs, POs, Stock movement, Notifications, Audit logs) while preserving 100% of Master Data
  clearTransactionalData(syncWithBackend = false) {
    _setItem(STORAGE_KEYS.PRS, [], syncWithBackend);
    _setItem(STORAGE_KEYS.POS, [], syncWithBackend);
    _setItem(STORAGE_KEYS.STOCK_LOGS, [], syncWithBackend);
    _setItem(STORAGE_KEYS.BUDGET_TRANSACTIONS, [], syncWithBackend);
    _setItem(STORAGE_KEYS.AUDIT_LOGS, [], syncWithBackend);
    _setItem('prpo_budget_transactions', [], syncWithBackend);
    _setItem('prpo_audit_logs', [], syncWithBackend);
    _setItem('prpo_notifications', [], syncWithBackend);
    _setItem('prpo_in_app_notifications', [], false);
    _setItem(STORAGE_KEYS.PR_COUNTERS, {
      PD: { PR: 0, PO: 0 },
      QC: { PR: 0, PO: 0 }
    }, syncWithBackend);

    // Reset budget spent / pending to 0
    const currentBudgets = this.getBudgets();
    const cleanBudgets = {};
    for (const [dept, b] of Object.entries(currentBudgets)) {
      cleanBudgets[dept] = {
        ...b,
        spent: 0,
        pending: 0,
        variance: b.monthlyBudget || 0,
        historicalSpent: {}
      };
    }
    this.saveBudgets(cleanBudgets);
    console.log('[StorageService] Transactional data cleared. Master data preserved.');
    return true;
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

  // Departments Master Data
  getDepartments() {
    const data = _getItem(STORAGE_KEYS.DEPARTMENTS);
    if (!data || !Array.isArray(data) || data.length === 0) {
      this.saveDepartments(INITIAL_DEPARTMENTS);
      return INITIAL_DEPARTMENTS;
    }
    return data;
  },
  saveDepartments(departments) {
    _setItem(STORAGE_KEYS.DEPARTMENTS, departments);
  },
  saveDepartment(deptObj) {
    const depts = [...this.getDepartments()];
    let updatedDept = { ...deptObj };
    const code = (updatedDept.code || '').toUpperCase().trim();
    if (!updatedDept.id) {
      updatedDept.id = `DEPT-${code || Date.now().toString().slice(-4)}`;
      updatedDept.code = code;
      updatedDept.isActive = updatedDept.isActive !== undefined ? updatedDept.isActive : true;
      updatedDept.createdAt = new Date().toISOString();
      updatedDept.updatedAt = new Date().toISOString();
      depts.push(updatedDept);
    } else {
      const idx = depts.findIndex(d => d.id === updatedDept.id || d.code === updatedDept.code);
      updatedDept.code = code;
      updatedDept.updatedAt = new Date().toISOString();
      if (idx !== -1) {
        depts[idx] = { ...depts[idx], ...updatedDept };
      } else {
        depts.push(updatedDept);
      }
    }
    this.saveDepartments(depts);
    return updatedDept;
  },
  deleteDepartment(deptId) {
    const depts = this.getDepartments();
    const filtered = depts.filter(d => d.id !== deptId && d.code !== deptId);
    this.saveDepartments(filtered);
    return true;
  },

  // Users & Access Management
  getUsers() {
    const data = _getItem(STORAGE_KEYS.USERS);
    if (!data) {
      this.saveUsers(DEFAULT_EMPLOYEE_ACCOUNTS);
      return DEFAULT_EMPLOYEE_ACCOUNTS;
    }
    return data;
  },
  saveUsers(users) {
    _setItem(STORAGE_KEYS.USERS, users);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('prpo_registered_users', JSON.stringify(users));
    }
  },
  saveUser(userObj) {
    const users = [...this.getUsers()];
    let updatedUser = { ...userObj };
    const isUpdate = Boolean(updatedUser.id);
    const primaryDept = updatedUser.primaryDepartment || updatedUser.department || 'PD';
    const allowedDepts = Array.isArray(updatedUser.allowedDepartments) && updatedUser.allowedDepartments.length > 0
      ? updatedUser.allowedDepartments
      : (primaryDept === 'ALL' ? ['*'] : [primaryDept]);

    updatedUser = {
      ...updatedUser,
      primaryDepartment: primaryDept,
      department: primaryDept,
      allowedDepartments: allowedDepts
    };

    if (!isUpdate) {
      updatedUser.id = `USR-${Date.now().toString().slice(-4)}`;
      updatedUser.status = updatedUser.status || 'ACTIVE';
      users.push(updatedUser);
    } else {
      const idx = users.findIndex(u => u.id === updatedUser.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updatedUser };
      } else {
        users.push(updatedUser);
      }
    }
    this.saveUsers(users);
    return updatedUser;
  },
  deleteUser(userId) {
    const users = this.getUsers();
    const filtered = users.filter(u => u.id !== userId);
    this.saveUsers(filtered);
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

    // Auto-heal / cascade sync: if a PR has a PO that is already closed/completed, sync PR status to 'completed'
    const posData = _getItem(STORAGE_KEYS.POS);
    const pos = Array.isArray(posData) ? posData : [];
    const syncedPRs = migrated.map(pr => {
      // Sanitize PD002/2026: Strictly detach from PO-PD-2026-001 and preserve WAITING_REVIEW status
      if (pr.prNo === 'PD002/2026' || pr.id === 'PR-1789100542800-9OZ') {
        if (pr.poNumber || pr.poNo || pr.poId || pr.status === 'completed' || pr.status === 'CLOSED') {
          needsSave = true;
          const cleaned = { ...pr };
          delete cleaned.poNumber;
          delete cleaned.poNo;
          delete cleaned.poId;
          if (cleaned.status === 'completed' || cleaned.status === 'CLOSED') {
            cleaned.status = 'WAITING_REVIEW';
          }
          return cleaned;
        }
      }

      // Only cascade sync if PR has already been approved/processed (Never sync pending or review-stage PRs)
      const isPRApproved = ['approved', 'ordered', 'completed', 'closed', 'po_issued', 'in_progress_online'].includes(String(pr.status).toLowerCase());
      if (isPRApproved) {
        const relatedPO = pos.find(po =>
          (po.prId && (po.prId === pr.id || po.prId === pr.prNo)) ||
          (po.prNo && (po.prNo === pr.prNo || po.prNo === pr.id)) ||
          (po.prNumber && (po.prNumber === pr.id || po.prNumber === pr.prNo)) ||
          (pr.poNo && (po.poNo === pr.poNo || po.id === pr.poNo)) ||
          (pr.poNumber && (po.poNo === pr.poNumber || po.poNumber === pr.poNumber))
        );
        if (relatedPO) {
          const poIsDone = ['closed', 'cancelled', 'received', 'completed', 'fully_received'].includes(String(relatedPO.status).toLowerCase());
          if (poIsDone && !['closed', 'cancelled', 'completed'].includes(String(pr.status).toLowerCase())) {
            needsSave = true;
            return {
              ...pr,
              status: 'completed',
              poNumber: relatedPO.poNo || relatedPO.poNumber || pr.poNumber || pr.poNo,
              poNo: relatedPO.poNo || relatedPO.poNumber || pr.poNumber || pr.poNo,
              fullyReceivedAt: relatedPO.fullyReceivedAt || new Date().toISOString()
            };
          }
        }
      }
      return pr;
    });

    if (needsSave) {
      _setItem(STORAGE_KEYS.PRS, syncedPRs);
    }
    return syncedPRs;
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

      // Sanitize PO-PD-2026-001: Ensure it points to PD001/2026 (Hydraulic Oil)
      let prNo = po.prNo;
      let prNumber = po.prNumber || po.prNo;
      let prId = po.prId;
      if ((po.poNo === 'PO-PD-2026-001' || po.id === 'PO-1789003809083-1') && (prNo === 'PD002/2026' || prNumber === 'PD002/2026' || !prNumber)) {
        prNo = 'PD001/2026';
        prNumber = 'PD001/2026';
        prId = 'PR-PD001-2026';
        poUpdated = true;
        needsSave = true;
      }

      return poUpdated ? { ...po, prNo, prNumber, prId, vat, grandTotal, items } : po;
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
    // Live calculation from documents array (Directive 4: Single Source of Truth, no floating counter)
    const prs = this.getPRs() || [];
    const pos = this.getPOs() || [];
    const pdPRs = prs.filter(p => p && (p.department === 'PD' || String(p.prNo).startsWith('PD'))).length;
    const qcPRs = prs.filter(p => p && (p.department === 'QC' || String(p.prNo).startsWith('QC'))).length;
    const pdPOs = pos.filter(p => p && (p.department === 'PD' || String(p.poNo).includes('-PD-'))).length;
    const qcPOs = pos.filter(p => p && (p.department === 'QC' || String(p.poNo).includes('-QC-'))).length;
    return {
      PD: { PR: pdPRs, PO: pdPOs },
      QC: { PR: qcPRs, PO: qcPOs }
    };
  },
  savePRCounters(counters) {
    // Dynamic single-source-of-truth from documents array - no decoupled floating counter
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
