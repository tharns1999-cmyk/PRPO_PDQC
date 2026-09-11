import { storageService } from './storageService.js';
import { workflowEngine } from './workflowEngine.js';
import { apiService } from './apiService.js';
import { generateNextPRId } from '../utils/idGenerator.js';

export const prService = {
  generateNextPRId(department = 'PD', year = new Date().getFullYear()) {
    const prs = storageService.getPRs() || [];
    return generateNextPRId(prs, department, year);
  },

  async createPR(prData, user, isDraft = false) {
    return apiService.createPR(prData, user, isDraft);
  },

  async updatePR(prId, prData, user, isDraft = false) {
    return apiService.updatePR(prId, prData, user, isDraft);
  },

  getPRs() {
    return storageService.getPRs() || [];
  },

  getPRById(id) {
    const prs = this.getPRs();
    return prs.find(p => p.id === id || p.prNo === id || p.prNumber === id);
  }
};

export default prService;
