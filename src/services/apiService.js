import { storageService } from './storageService';
import { workflowEngine } from './workflowEngine';
import { auditService } from './auditService';
import { PO_STATUS } from '../config/constants';

// API Service Layer for Data & Operations
export const apiService = {
  // --- Audit Trail Operations ---
  async getAuditLogs(filters) {
    return auditService.getLogs(filters);
  },
  async clearAuditLogs() {
    return auditService.clearLogs();
  },
  // --- Data Getters ---
  async getProducts() {
    try {
      const res = await fetch('http://localhost:3001/api/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          storageService.saveProducts(data);
          return data;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/products fallback to storageService:', e.message);
    }
    return storageService.getProducts();
  },
  async getVendors() {
    try {
      const res = await fetch('http://localhost:3001/api/vendors');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          storageService.saveVendors(data);
          return data;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/vendors fallback to storageService:', e.message);
    }
    return storageService.getVendors();
  },
  async getStorageLocations() {
    try {
      const res = await fetch('http://localhost:3001/api/storage-locations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          storageService.saveStorageLocations(data);
          return data;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/storage-locations fallback to storageService:', e.message);
    }
    return storageService.getStorageLocations();
  },
  async getUsageUnits(department) {
    try {
      const url = department && department !== 'ALL' 
        ? `http://localhost:3001/api/usage-units?department=${encodeURIComponent(department)}`
        : 'http://localhost:3001/api/usage-units';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          if (!department || department === 'ALL') {
            storageService.saveUsageUnits(data);
          }
          return data;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/usage-units fallback to storageService:', e.message);
    }
    return storageService.getUsageUnits(department);
  },
  async getPRs() {
    try {
      const res = await fetch('http://localhost:3001/api/prs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const seen = new Set();
          const unique = data.filter(p => {
            const key = p.id || p.prNo;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          storageService.savePRs(unique);
          return unique;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/prs fallback to storageService:', e.message);
    }
    const local = storageService.getPRs();
    const seenLocal = new Set();
    return (Array.isArray(local) ? local : []).filter(p => {
      const key = p.id || p.prNo;
      if (!key || seenLocal.has(key)) return false;
      seenLocal.add(key);
      return true;
    });
  },
  async getPOs() {
    try {
      const res = await fetch('http://localhost:3001/api/pos');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const seen = new Set();
          const unique = data.filter(p => {
            const key = p.poNo || p.poNumber || p.id;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          storageService.savePOs(unique);
          return unique;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/pos fallback to storageService:', e.message);
    }
    const local = storageService.getPOs();
    const seenLocal = new Set();
    return (Array.isArray(local) ? local : []).filter(p => {
      const key = p.poNo || p.poNumber || p.id;
      if (!key || seenLocal.has(key)) return false;
      seenLocal.add(key);
      return true;
    });
  },
  async getStockLogs() {
    try {
      const res = await fetch('http://localhost:3001/api/stock-logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          storageService.saveStockLogs(data);
          return data;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/stock-logs fallback to storageService:', e.message);
    }
    return storageService.getStockLogs();
  },
  async getBudgets() {
    try {
      const res = await fetch('http://localhost:3001/api/budgets');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          storageService.saveBudgets(data);
          return data;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/budgets fallback to storageService:', e.message);
    }
    return storageService.getBudgets();
  },
  async getNotifications() {
    try {
      const res = await fetch('http://localhost:3001/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[apiService] GET /api/notifications fallback:', e.message);
    }
    return [];
  },
  
  async updateBudget(department, newAmount, targetMonth = null) {
    const budgets = await this.getBudgets();
    if (!budgets[department]) budgets[department] = { monthlyBudget: 0, spent: 0, pending: 0, variance: 0, history: {} };
    
    budgets[department].monthlyBudget = newAmount;
    
    // Save to target month history to prevent changing past months
    const today = new Date();
    const monthKey = targetMonth || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (!budgets[department].history) budgets[department].history = {};
    budgets[department].history[monthKey] = newAmount;

    try {
      const res = await fetch('http://localhost:3001/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgets)
      });
      if (res.ok) {
        const saved = await res.json();
        storageService.saveBudgets(saved);
        return saved[department] || budgets[department];
      }
    } catch (e) {
      console.warn('[apiService] PUT /api/budgets fallback to storageService:', e.message);
    }

    storageService.saveBudgets(budgets);
    return budgets[department];
  },

  // --- Budget & Over-Budget Check ---
  calculateBudgetSummary(targetMonthStr) {
    return workflowEngine.calculateBudgetSummary(targetMonthStr);
  },

  isOverBudget(department, amount) {
    return workflowEngine.isOverBudget(department, amount);
  },

  // --- PR Operations ---
  async createPR(prData, user, isDraft = false) {
    // 1. Generate new PR payload via workflow engine logic & validation
    const newPR = await workflowEngine.createPR(prData, user, isDraft);

    // 2. Direct Sync to Local API Backend File
    try {
      const res = await fetch('http://localhost:3001/api/prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPR)
      });
      if (res.ok) {
        const savedPR = await res.json();
        return savedPR || newPR;
      }
    } catch (e) {
      console.warn('[apiService] POST /api/prs backend sync warning:', e.message);
    }
    return newPR;
  },

  async updatePR(prId, prData, user, isDraft = false) {
    const updated = await workflowEngine.updatePR(prId, prData, user, isDraft);
    try {
      await fetch(`http://localhost:3001/api/prs/${prId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {}
    return updated;
  },

  async submitPR(prId, user, memoData = null) {
    const result = await workflowEngine.submitPR(prId, user, memoData);
    try {
      await fetch(`http://localhost:3001/api/prs/${prId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
    } catch (e) {}
    return result;
  },

  async updatePRStatus(prId, nextStatus, user, note = '') {
    const result = await workflowEngine.updatePRStatus(prId, nextStatus, user, note);
    try {
      if (result?.pr) {
        await fetch(`http://localhost:3001/api/prs/${prId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.pr)
        });
      }
      if (result?.po) {
        await fetch('http://localhost:3001/api/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.po)
        });
      }
    } catch (e) {}
    return result;
  },

  async rejectPR(prId, user, reason) {
    const updated = await workflowEngine.rejectPR(prId, user, reason);
    try {
      await fetch(`http://localhost:3001/api/prs/${prId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {}
    return updated;
  },

  async editPRItems(prId, items, user, reason = '') {
    const updated = await workflowEngine.editPRItems(prId, items, user, reason);
    try {
      await fetch(`http://localhost:3001/api/prs/${prId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {}
    return updated;
  },

  async cancelPR(prId, user, reason) {
    const cancelled = await workflowEngine.cancelPR(prId, user, reason);
    try {
      await fetch(`http://localhost:3001/api/prs/${prId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cancelled)
      });
    } catch (e) {}
    return cancelled;
  },

  async cancelPO(poId, user, reason) {
    return workflowEngine.cancelPO(poId, user, reason);
  },

  async acknowledgeOnlineTask(poId, vendorName, user, updatedItems = null, varianceNote = '') {
    return workflowEngine.acknowledgeOnlineTask(poId, vendorName, user, updatedItems, varianceNote);
  },

  // --- PO & Receive Goods Operations ---
  async assignVendor(poId, vendorId, customVendorName, user) {
    return workflowEngine.assignVendor(poId, vendorId, customVendorName, user);
  },

  // Generic claim filing — supports both ONLINE and SELF-BUY channels
  async fileClaim(poId, claimData, user) {
    return workflowEngine.fileClaim(poId, claimData, user);
  },
  async fileOnlineClaim(poId, claimData, user) {
    return workflowEngine.fileClaim(poId, claimData, user);
  },

  // Generic claim resolution — supports both ONLINE and SELF-BUY channels
  async resolveClaim(poId, resolution, user) {
    return workflowEngine.resolveClaim(poId, resolution, user);
  },
  async resolveOnlineClaim(poId, resolution, user) {
    return workflowEngine.resolveClaim(poId, resolution, user);
  },

  async updatePOStatus(poId, nextStatus, user, note = '') {
    return workflowEngine.updatePOStatus(poId, nextStatus, user, note);
  },

  async updateActualPrice(poId, itemIndex, actPrice, user) {
    return workflowEngine.updateActualPrice(poId, itemIndex, actPrice, user);
  },

  async closePO(poId, user, note = '') {
    return workflowEngine.closePO(poId, user, note);
  },

  // Partial or Full goods receiving — handles PARTIAL → CLOSED transitions
  async receiveGoods(poId, receivingItems, user, note = '', options = {}) {
    const grNumber = options.grNumber || options.grId || `GR-${poId}-${Date.now()}`;
    const payload = {
      poId,
      receivingItems,
      user,
      note,
      options: { ...options, grNumber, grId: grNumber },
      grNumber
    };

    try {
      const res = await fetch(`http://localhost:3001/api/pos/${poId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.po) {
          const currentPOs = storageService.getPOs();
          const updatedPOs = currentPOs.map(p => p.id === data.po.id ? data.po : p);
          storageService.savePOs(updatedPOs);
        }
        if (data.products) {
          storageService.saveProducts(data.products);
        }
        if (data.stockLogs) {
          storageService.saveStockLogs(data.stockLogs);
        }
        if (data.budgets) {
          storageService.saveBudgets(data.budgets);
        }
        return { ...(data.po || {}), backendData: data };
      } else if (res.status === 404) {
        // PO not in backend disk (e.g. Vitest in-memory test environment) -> fallback to workflowEngine
        return workflowEngine.receiveGoods(poId, receivingItems, user, note, { ...options, grNumber, grId: grNumber });
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
    } catch (e) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Failed to fetch')) {
        throw e; // Validation errors from backend should be thrown to the user
      }
      console.warn('[apiService] Backend receive offline, falling back to workflowEngine:', e.message);
      return workflowEngine.receiveGoods(poId, receivingItems, user, note, { ...options, grNumber, grId: grNumber });
    }
  },

  async receiveAllGoods(poId, user, note = '', options = {}) {
    // Convenience wrapper: build receivingItems from all remaining quantities
    const pos = await this.getPOs();
    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('PO not found');
    const receivingItems = po.items.map(item => ({
      productId: item.productId,
      receivedThisTime: Number(item.orderedQty ?? item.purchaseQty ?? item.qty) - (Number(item.receivedQty) || 0)
    }));
    return workflowEngine.receiveGoods(poId, receivingItems, user, note, options);
  },

  // Short-Close PO (ปิด PO ก่อนกำหนดเมื่อได้ของไม่ครบและไม่รอของแล้ว)
  async shortClosePO(poId, reason, user) {
    return workflowEngine.shortClosePO(poId, reason, user);
  },

  // --- Quick Issue Stock (เบิกจ่าย) ---
  async quickIssueStock(productId, issueQty, user, note = '', issueUnit = '') {
    const updatedProduct = await workflowEngine.quickIssueStock(productId, issueQty, user, note, issueUnit);
    try {
      if (updatedProduct) {
        await fetch(`http://localhost:3001/api/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProduct)
        });
      }
      const logs = storageService.getStockLogs();
      if (logs && logs.length > 0) {
        await fetch('http://localhost:3001/api/stock-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logs)
        });
      }
    } catch (e) {
      console.warn('[apiService] quickIssueStock backend sync warning:', e.message);
    }
    return updatedProduct;
  },

  // --- Master Data CRUD ---
  async saveProduct(product, user = null) {
    const products = await this.getProducts();
    const isUpdate = Boolean(product.id);
    const targetCode = (product.code || '').trim().toUpperCase();

    if (targetCode) {
      const isDuplicate = products.some(p => p.id !== product.id && (p.code || '').trim().toUpperCase() === targetCode);
      if (isDuplicate) {
        throw new Error(`รหัสสินค้า "${targetCode}" มีอยู่ในระบบแล้ว กรุณาระบุรหัสสินค้าอื่น`);
      }
    }

    const cat = product.category || product.department || 'PD';
    product.category = cat;
    product.department = cat;

    if (!product.id) {
      product.id = `PROD-${cat}-${Date.now()}`;
    }

    try {
      const url = isUpdate ? `http://localhost:3001/api/products/${product.id}` : 'http://localhost:3001/api/products';
      const method = isUpdate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      if (res.ok) {
        const saved = await res.json();
        const updatedList = isUpdate ? products.map(p => p.id === product.id ? saved : p) : [saved, ...products];
        storageService.saveProducts(updatedList);
        
        auditService.logAction({
          action: isUpdate ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
          actor: user || 'Admin / Master Manager',
          department: product.category,
          docNo: product.code || product.id,
          docType: 'PRODUCT',
          details: `${isUpdate ? 'ปรับปรุงข้อมูลสินค้า' : 'สร้างรายการสินค้าใหม่'} "${product.name}" (${product.code}) แผนก ${product.category}`
        });

        return saved;
      }
    } catch (e) {
      console.warn('[apiService] saveProduct API error, falling back:', e.message);
    }

    if (isUpdate) {
      const idx = products.findIndex(p => p.id === product.id);
      if (idx !== -1) products[idx] = { ...products[idx], ...product };
    } else {
      products.unshift(product);
    }
    storageService.saveProducts(products);

    auditService.logAction({
      action: isUpdate ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
      actor: user || 'Admin / Master Manager',
      department: product.category,
      docNo: product.code || product.id,
      docType: 'PRODUCT',
      details: `${isUpdate ? 'ปรับปรุงข้อมูลสินค้า' : 'สร้างรายการสินค้าใหม่'} "${product.name}" (${product.code}) แผนก ${product.category}`
    });

    return product;
  },

  async deleteProduct(productId, user = null) {
    try {
      await fetch(`http://localhost:3001/api/products/${productId}`, { method: 'DELETE' });
    } catch (e) {}
    const products = (await this.getProducts()).filter(p => p.id !== productId && p.code !== productId);
    storageService.saveProducts(products);
    return true;
  },

  async saveVendor(vendor, user = null) {
    const vendors = await this.getVendors();
    const isUpdate = Boolean(vendor.id);
    const targetCode = (vendor.code || '').trim().toUpperCase();

    if (targetCode) {
      const isDuplicate = vendors.some(v => v.id !== vendor.id && (v.code || '').trim().toUpperCase() === targetCode);
      if (isDuplicate) {
        throw new Error(`รหัสผู้ขาย "${targetCode}" มีอยู่ในระบบแล้ว กรุณาระบุรหัสผู้ขายอื่น`);
      }
    }

    if (!vendor.id) {
      vendor.id = `VEN-${Date.now()}`;
    }

    try {
      const url = isUpdate ? `http://localhost:3001/api/vendors/${vendor.id}` : 'http://localhost:3001/api/vendors';
      const method = isUpdate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendor)
      });
      if (res.ok) {
        const saved = await res.json();
        const updatedList = isUpdate ? vendors.map(v => v.id === vendor.id ? saved : v) : [saved, ...vendors];
        storageService.saveVendors(updatedList);
        
        auditService.logAction({
          action: isUpdate ? 'VENDOR_UPDATED' : 'VENDOR_CREATED',
          actor: user || 'Admin / Vendor Manager',
          department: vendor.category || 'ALL',
          docNo: vendor.code || vendor.id,
          docType: 'VENDOR',
          details: `${isUpdate ? 'ปรับปรุงข้อมูลผู้ขาย' : 'เพิ่มผู้ขายรายใหม่'} "${vendor.name}" (${vendor.code || vendor.id})`
        });

        return saved;
      }
    } catch (e) {
      console.warn('[apiService] saveVendor API fallback:', e.message);
    }

    if (isUpdate) {
      const idx = vendors.findIndex(v => v.id === vendor.id);
      if (idx !== -1) vendors[idx] = vendor;
    } else {
      vendors.unshift(vendor);
    }
    storageService.saveVendors(vendors);

    auditService.logAction({
      action: isUpdate ? 'VENDOR_UPDATED' : 'VENDOR_CREATED',
      actor: user || 'Admin / Vendor Manager',
      department: vendor.category || 'ALL',
      docNo: vendor.code || vendor.id,
      docType: 'VENDOR',
      details: `${isUpdate ? 'ปรับปรุงข้อมูลผู้ขาย' : 'เพิ่มผู้ขายรายใหม่'} "${vendor.name}" (${vendor.code || vendor.id})`
    });

    return vendor;
  },

  async deleteVendor(vendorId, user = null) {
    try {
      await fetch(`http://localhost:3001/api/vendors/${vendorId}`, { method: 'DELETE' });
    } catch (e) {}
    const vendors = (await this.getVendors()).filter(v => v.id !== vendorId);
    storageService.saveVendors(vendors);
    return true;
  },

  async saveStorageLocation(location, user = null) {
    const locations = await this.getStorageLocations();
    const isUpdate = Boolean(location.id);
    const targetName = (location.name || '').trim().toLowerCase();

    if (targetName) {
      const isDuplicate = locations.some(l => l.id !== location.id && (l.name || '').trim().toLowerCase() === targetName);
      if (isDuplicate) {
        throw new Error(`ชื่อจุดจัดเก็บ "${location.name}" มีอยู่ในระบบแล้ว กรุณาระบุชื่ออื่น`);
      }
    }

    if (!location.id) {
      const dept = location.department || 'ALL';
      location.id = `LOC-${dept}-${Date.now().toString().slice(-6)}`;
    }

    try {
      const url = isUpdate ? `http://localhost:3001/api/storage-locations/${location.id}` : 'http://localhost:3001/api/storage-locations';
      const method = isUpdate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
      });
      if (res.ok) {
        const saved = await res.json();
        const updatedList = isUpdate ? locations.map(l => l.id === location.id ? saved : l) : [saved, ...locations];
        storageService.saveStorageLocations(updatedList);
        
        auditService.logAction({
          action: isUpdate ? 'LOCATION_UPDATED' : 'LOCATION_CREATED',
          actor: user || 'Admin / Warehouse Manager',
          department: location.department || 'ALL',
          docNo: saved.id,
          docType: 'LOCATION',
          details: `${isUpdate ? 'แก้ไขจุดจัดเก็บ' : 'เพิ่มจุดจัดเก็บใหม่'} "${saved.name}" (${saved.department || 'ALL'})`
        });

        return saved;
      }
    } catch (e) {
      console.warn('[apiService] saveStorageLocation API fallback:', e.message);
    }

    const saved = storageService.saveStorageLocation(location);

    auditService.logAction({
      action: isUpdate ? 'LOCATION_UPDATED' : 'LOCATION_CREATED',
      actor: user || 'Admin / Warehouse Manager',
      department: location.department || 'ALL',
      docNo: saved.id,
      docType: 'LOCATION',
      details: `${isUpdate ? 'แก้ไขจุดจัดเก็บ' : 'เพิ่มจุดจัดเก็บใหม่'} "${saved.name}" (${saved.department || 'ALL'})`
    });

    return saved;
  },

  async deleteStorageLocation(locationId, options = {}, user = null) {
    try {
      await fetch(`http://localhost:3001/api/storage-locations/${locationId}`, { method: 'DELETE' });
    } catch (e) {}
    const locations = storageService.getStorageLocations();
    const loc = locations.find(l => l.id === locationId);
    storageService.deleteStorageLocation(locationId, options);

    if (loc) {
      auditService.logAction({
        action: 'LOCATION_DELETED',
        actor: user || 'Admin / Warehouse Manager',
        department: loc.department || 'ALL',
        docNo: loc.id,
        docType: 'LOCATION',
        details: `ลบจุดจัดเก็บสินค้า "${loc.name}" ออกจากระบบ${options.unlinkProducts ? ' (ปลดสินค้าที่ผูกอยู่ออก)' : options.reassignToLocationId ? ' (ย้ายสินค้าไปยังจุดจัดเก็บใหม่)' : ''}`
      });
    }

    return true;
  },

  async saveUsageUnit(unit, user = null) {
    const isUpdate = Boolean(unit.id);
    const units = storageService.getUsageUnits();

    // Check duplicate name in same department
    const isDuplicate = units.some(u => 
      u.name.trim().toLowerCase() === unit.name.trim().toLowerCase() &&
      u.department === unit.department &&
      u.id !== unit.id
    );

    if (isDuplicate) {
      throw new Error(`ชื่อหน่วย/ห้อง "${unit.name}" มีอยู่ในแผนก ${unit.department} แล้ว`);
    }

    if (!unit.id) {
      const dept = unit.department || 'PD';
      unit.id = `UNIT-${dept}-${Date.now().toString().slice(-6)}`;
    }

    try {
      const url = isUpdate ? `http://localhost:3001/api/usage-units/${unit.id}` : 'http://localhost:3001/api/usage-units';
      const method = isUpdate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unit)
      });
      if (res.ok) {
        const saved = await res.json();
        const updatedList = isUpdate ? units.map(u => u.id === unit.id ? saved : u) : [...units, saved];
        storageService.saveUsageUnits(updatedList);

        auditService.logAction({
          action: isUpdate ? 'USAGE_UNIT_UPDATED' : 'USAGE_UNIT_CREATED',
          actor: user || 'Admin / Department Manager',
          department: unit.department || 'PD',
          docNo: saved.id,
          docType: 'USAGE_UNIT',
          details: `${isUpdate ? 'แก้ไขหน่วยเบิกใช้งาน' : 'เพิ่มหน่วยเบิกใช้งานใหม่'} "${saved.name}" (${saved.department})`
        });

        return saved;
      }
    } catch (e) {
      console.warn('[apiService] saveUsageUnit API fallback:', e.message);
    }

    const saved = storageService.saveUsageUnit(unit);

    auditService.logAction({
      action: isUpdate ? 'USAGE_UNIT_UPDATED' : 'USAGE_UNIT_CREATED',
      actor: user || 'Admin / Department Manager',
      department: unit.department || 'PD',
      docNo: saved.id,
      docType: 'USAGE_UNIT',
      details: `${isUpdate ? 'แก้ไขหน่วยเบิกใช้งาน' : 'เพิ่มหน่วยเบิกใช้งานใหม่'} "${saved.name}" (${saved.department})`
    });

    return saved;
  },

  async deleteUsageUnit(unitId, user = null) {
    try {
      await fetch(`http://localhost:3001/api/usage-units/${unitId}`, { method: 'DELETE' });
    } catch (e) {}
    const units = storageService.getUsageUnits();
    const unit = units.find(u => u.id === unitId);
    storageService.deleteUsageUnit(unitId);

    if (unit) {
      auditService.logAction({
        action: 'USAGE_UNIT_DELETED',
        actor: user || 'Admin / Department Manager',
        department: unit.department || 'PD',
        docNo: unit.id,
        docType: 'USAGE_UNIT',
        details: `ลบหน่วยเบิกใช้งาน "${unit.name}" (${unit.department}) ออกจากระบบ`
      });
    }

    return true;
  }
};
