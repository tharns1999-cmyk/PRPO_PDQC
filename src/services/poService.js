import { storageService } from './storageService.js';
import { workflowEngine } from './workflowEngine.js';
import { apiService } from './apiService.js';
import { generateNextPOId } from '../utils/idGenerator.js';

export const poService = {
  generateNextPOId(department = 'PD', year = new Date().getFullYear(), offset = 0) {
    const pos = storageService.getPOs() || [];
    return generateNextPOId(pos, department, year, offset);
  },

  async createPOFromPR(pr, user) {
    return workflowEngine.createPOFromPR(pr, user);
  },

  // 1 PR = 1 Vendor (Internal) or 1 PR = 1 Online PO: direct conversion upon approved PR
  async generatePO(pr, user) {
    return workflowEngine.createPOFromPR(pr, user);
  },

  async generatePOsFromPR(pr, user) {
    return workflowEngine.createPOFromPR(pr, user);
  },

  async acknowledgeOnlineOrder(poId, storeName, user, items = null, note = '') {
    return apiService.acknowledgeOnlineTask(poId, storeName, user, items, note);
  },

  getPOs() {
    return storageService.getPOs() || [];
  },

  getPOById(id) {
    const pos = this.getPOs();
    return pos.find(p => p.id === id || p.poNo === id || p.poNumber === id);
  },

  getPOsByPR(prNo) {
    const pos = this.getPOs();
    return pos.filter(p => p.prNo === prNo || p.prNumber === prNo || p.prId === prNo);
  }
};

export default poService;
