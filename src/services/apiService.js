import { storageService } from './storageService';
import { workflowEngine } from './workflowEngine';
import { PO_STATUS } from '../config/constants';

// API Service Layer for Data & Operations
export const apiService = {
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
  async assignVendorToPO(poId, vendorId, vendorName, user) {
    return workflowEngine.assignVendorToPO(poId, vendorId, vendorName, user);
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

  async receiveAllGoods(poId, user, note = '') {
    // Current implementation uses closePO directly for receiveAllGoods
    return workflowEngine.closePO(poId, user, note);
  },

  // --- Quick Issue Stock (เบิกจ่าย) ---
  async quickIssueStock(productId, issueQty, user, note = '') {
    return workflowEngine.quickIssueStock(productId, issueQty, user, note);
  },

  // --- Master Data CRUD ---
  async saveProduct(product) {
    const products = storageService.getProducts();
    if (product.id) {
      const idx = products.findIndex(p => p.id === product.id);
      if (idx !== -1) products[idx] = product;
    } else {
      product.id = `PROD-${product.category}-${Date.now()}`;
      products.push(product);
    }
    storageService.saveProducts(products);
    return product;
  },

  async saveVendor(vendor) {
    const vendors = storageService.getVendors();
    if (vendor.id) {
      const idx = vendors.findIndex(v => v.id === vendor.id);
      if (idx !== -1) vendors[idx] = vendor;
    } else {
      vendor.id = `VEN-${Date.now()}`;
      vendors.push(vendor);
    }
    storageService.saveVendors(vendors);
    return vendor;
  }
};
