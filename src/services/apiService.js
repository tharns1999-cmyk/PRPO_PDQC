import { storageService } from './storageService';
import { workflowEngine } from './workflowEngine';
import { auditService } from './auditService';
import { PO_STATUS } from '../config/constants';

// API Service Layer for Data & Operations
export const apiService = {
  // --- Audit Trail Operations (GAS Ready) ---
  async getAuditLogs(filters) {
    return auditService.getLogs(filters);
  },
  async exportAuditLogsToGAS(filters) {
    return auditService.exportToGASPayload(filters);
  },
  async clearAuditLogs() {
    return auditService.clearLogs();
  },
  // --- Data Getters ---
  async getProducts() {
    return storageService.getProducts();
  },
  async getVendors() {
    return storageService.getVendors();
  },
  async getPRs() {
    return storageService.getPRs();
  },
  async getPOs() {
    return storageService.getPOs();
  },
  async getStockLogs() {
    return storageService.getStockLogs();
  },
  async getBudgets() {
    return storageService.getBudgets();
  },
  
  async updateBudget(department, newAmount) {
    const budgets = storageService.getBudgets();
    if (!budgets[department]) budgets[department] = { monthlyBudget: 0, spent: 0, pending: 0, variance: 0, history: {} };
    
    budgets[department].monthlyBudget = newAmount;
    
    // Save to current month history to prevent changing past months
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (!budgets[department].history) budgets[department].history = {};
    budgets[department].history[currentMonth] = newAmount;

    storageService.saveBudgets(budgets);
    return budgets[department];
  },

  // --- Budget & Over-Budget Check ---
  calculateBudgetSummary() {
    return workflowEngine.calculateBudgetSummary();
  },

  isOverBudget(department, amount) {
    return workflowEngine.isOverBudget(department, amount);
  },

  // --- PR Operations ---
  async createPR(prData, user, isDraft = false) {
    return workflowEngine.createPR(prData, user, isDraft);
  },

  async updatePR(prId, prData, user, isDraft = false) {
    return workflowEngine.updatePR(prId, prData, user, isDraft);
  },

  async submitPR(prId, user, memoData = null) {
    return workflowEngine.submitPR(prId, user, memoData);
  },

  async updatePRStatus(prId, nextStatus, user, note = '') {
    return workflowEngine.updatePRStatus(prId, nextStatus, user, note);
  },

  async rejectPR(prId, user, reason) {
    return workflowEngine.rejectPR(prId, user, reason);
  },

  async editPRItems(prId, items, user, reason = '') {
    return workflowEngine.editPRItems(prId, items, user, reason);
  },

  async cancelPR(prId, user, reason) {
    return workflowEngine.cancelPR(prId, user, reason);
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
    return workflowEngine.receiveGoods(poId, receivingItems, user, note, options);
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
    return workflowEngine.quickIssueStock(productId, issueQty, user, note, issueUnit);
  },

  // --- Master Data CRUD ---
  async saveProduct(product, user = null) {
    const products = storageService.getProducts();
    const isUpdate = Boolean(product.id);
    const targetCode = (product.code || '').trim().toUpperCase();

    if (targetCode) {
      const isDuplicate = products.some(p => p.id !== product.id && (p.code || '').trim().toUpperCase() === targetCode);
      if (isDuplicate) {
        throw new Error(`รหัสสินค้า "${targetCode}" มีอยู่ในระบบแล้ว กรุณาระบุรหัสสินค้าอื่น`);
      }
    }

    if (product.id) {
      const idx = products.findIndex(p => p.id === product.id);
      if (idx !== -1) products[idx] = product;
    } else {
      product.id = `PROD-${product.category}-${Date.now()}`;
      products.push(product);
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

  async saveVendor(vendor, user = null) {
    const vendors = storageService.getVendors();
    const isUpdate = Boolean(vendor.id);
    const targetCode = (vendor.code || '').trim().toUpperCase();

    if (targetCode) {
      const isDuplicate = vendors.some(v => v.id !== vendor.id && (v.code || '').trim().toUpperCase() === targetCode);
      if (isDuplicate) {
        throw new Error(`รหัสผู้ขาย "${targetCode}" มีอยู่ในระบบแล้ว กรุณาระบุรหัสผู้ขายอื่น`);
      }
    }

    if (vendor.id) {
      const idx = vendors.findIndex(v => v.id === vendor.id);
      if (idx !== -1) vendors[idx] = vendor;
    } else {
      vendor.id = `VEN-${Date.now()}`;
      vendors.push(vendor);
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
  }
};
