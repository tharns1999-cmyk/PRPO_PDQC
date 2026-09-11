import { describe, it, expect } from 'vitest';
import './setup.js';
import { generateNextPRId, generateNextPOId } from '../src/utils/idGenerator.js';
import { workflowEngine } from '../src/services/workflowEngine.js';
import { storageService } from '../src/services/storageService.js';
import fs from 'fs';
import path from 'path';

describe('Auto-increment Running Number Generator & Collision Guard', () => {
  describe('1. Robust Max-ID Scanner (Regex without Year Conflation)', () => {
    it('scans max running number accurately and skips the year 2026', () => {
      const mockPRs = [
        { id: 'PR-1', prNo: 'PD001/2026' },
        { id: 'PR-2', prNo: 'PD002/2026' },
        { id: 'PR-3', prNo: 'PD004/2026' },
      ];
      const nextId = generateNextPRId(mockPRs, 'PD', 2026);
      expect(nextId).toBe('PD005/2026');
    });

    it('handles empty PR array by starting at 001', () => {
      const nextId = generateNextPRId([], 'PD', 2026);
      expect(nextId).toBe('PD001/2026');
    });

    it('scans POs max sequence with PO-PD-2026-XXX format', () => {
      const mockPOs = [
        { id: 'PO-1', poNo: 'PO-PD-2026-001' },
        { id: 'PO-2', poNo: 'PO-PD-2026-004' }
      ];
      const nextPOId = generateNextPOId(mockPOs, 'PD', 2026);
      expect(nextPOId).toBe('PO-PD-2026-005');
    });
  });

  describe('2. Collision Guard (Prevent Overwrite)', () => {
    it('auto-increments (+1) until finding a unique sequence if collision detected', () => {
      const mockPRs = [
        { id: 'PR-1', prNo: 'PD001/2026' },
        { id: 'PR-2', prNo: 'PD002/2026' },
        { id: 'PR-3', prNo: 'PD003/2026' },
        // Suppose PD004 is taken as an ID
        { id: 'PD004/2026', prNo: 'PD003/2026' }
      ];
      const nextId = generateNextPRId(mockPRs, 'PD', 2026);
      expect(nextId).toBe('PD005/2026');
    });

    it('createPR prepends and never overwrites existing documents', async () => {
      storageService.resetData();
      const existing = [
        { id: 'PR-1', prNo: 'PD001/2026', department: 'PD', items: [{ code: 'OIL', name: 'Oil', price: 100, qty: 1 }], totalAmount: 100, status: 'CLOSED' }
      ];
      storageService.savePRs(existing);

      const user = { name: 'คุณวิชัย', title: 'Requester (PD)', department: 'PD' };
      const newPR = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [{ productId: 'PROD-PD-008', code: 'PD-STF-001', name: 'Film', price: 500, qty: 1 }]
      }, user);

      const allPRs = storageService.getPRs();
      expect(allPRs.length).toBe(2);
      expect(allPRs[0].id).toBe(newPR.id);
      expect(allPRs[1].id).toBe('PR-1');
      expect(allPRs[1].prNo).toBe('PD001/2026');
      expect(newPR.prNo).toBe('PD002/2026');
    });
  });

  describe('3. Data Migration & Cleanup Verification in data/prs.json', () => {
    it('data/prs.json contains rubber gloves as PD005/2026 and restores Hydraulic Oil as PD001/2026', () => {
      const prsPath = path.resolve(process.cwd(), 'data/prs.json');
      const prs = JSON.parse(fs.readFileSync(prsPath, 'utf-8'));

      const glovesPR = prs.find(p => p.id === 'PR-1789117749515-OJZ');
      expect(glovesPR).toBeDefined();
      expect(glovesPR.prNo).toBe('PD005/2026');
      expect(glovesPR.totalAmount).toBeCloseTo(397.54, 1);
      expect(glovesPR.poNumber).toBeUndefined();

      const oilPR = prs.find(p => p.id === 'PR-PD001-2026' || p.prNo === 'PD001/2026');
      expect(oilPR).toBeDefined();
      expect(oilPR.items[0].code).toBe('PD-OIL-068');
      expect(oilPR.poNumber).toBe('PO-PD-2026-001');

      const cancelledPR = prs.find(p => p.id === 'PR-1789040675492-2BP');
      expect(cancelledPR).toBeDefined();
      expect(cancelledPR.status).toBe('CANCELLED');
      expect(cancelledPR.totalAmount).toBe(170994);
    });
  });
});
