import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { workflowEngine } from '../src/services/workflowEngine.js';
import { storageService } from '../src/services/storageService.js';
import { ROLES } from '../src/config/constants.js';
import fs from 'fs';
import path from 'path';

describe('Workflow State Machine Guards & Mock Data Consistency', () => {
  beforeEach(() => {
    storageService.resetData();
    storageService.saveProducts([
      { id: 'PROD-PD-001', code: 'PD-OIL-068', name: 'น้ำมันไฮดรอลิกอุตสาหกรรม', category: 'PD', price: 14500, stockBalance: 5, unit: 'ลิตร' },
      { id: 'PROD-PD-008', code: 'PD-STF-001', name: 'ฟิล์มยืดพันพาเลท', category: 'PD', price: 1100, stockBalance: 10, unit: 'ม้วน' }
    ]);
  });

  describe('1. Mock Data Consistency (Clean Transactional State & Master Data Preservation)', () => {
    it('data/pos.json and data/prs.json are clean empty arrays for zero-state initialization', () => {
      const posPath = path.resolve(process.cwd(), 'data/pos.json');
      const pos = JSON.parse(fs.readFileSync(posPath, 'utf-8'));
      const prsPath = path.resolve(process.cwd(), 'data/prs.json');
      const prs = JSON.parse(fs.readFileSync(prsPath, 'utf-8'));

      expect(Array.isArray(pos)).toBe(true);
      expect(Array.isArray(prs)).toBe(true);
      expect(pos.length).toBe(0);
      expect(prs.length).toBe(0);
    });

    it('Master Data files (vendors.json, products.json, users.json) are 100% preserved', () => {
      const vendorsPath = path.resolve(process.cwd(), 'data/vendors.json');
      const vendors = JSON.parse(fs.readFileSync(vendorsPath, 'utf-8'));
      const productsPath = path.resolve(process.cwd(), 'data/products.json');
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
      const usersPath = path.resolve(process.cwd(), 'data/users.json');
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

      expect(Array.isArray(vendors)).toBe(true);
      expect(vendors.length).toBeGreaterThan(0);
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });
  });

  describe('2. State Machine Guard for PO Creation', () => {
    it('throws error when createPOFromPR is called on a PR with status WAITING_REVIEW', async () => {
      const unapprovedPR = {
        id: 'PR-TEST-WAITING',
        prNo: 'PD999/2026',
        department: 'PD',
        status: 'WAITING_REVIEW',
        purchaseChannel: 'SELF',
        items: [
          { productId: 'PROD-PD-008', qty: 10, price: 100 }
        ]
      };

      await expect(
        workflowEngine.createPOFromPR(unapprovedPR, ROLES.PLANT_MANAGER)
      ).rejects.toThrow(/ไม่อนุญาตให้ออกใบสั่งซื้อ \(PO\)/);
    });

    it('throws error when createPOFromPR is called on a PR with status SUBMITTED or DRAFT', async () => {
      const submittedPR = {
        id: 'PR-TEST-SUBMITTED',
        prNo: 'PD998/2026',
        department: 'PD',
        status: 'SUBMITTED',
        purchaseChannel: 'SELF',
        items: [{ productId: 'PROD-PD-008', qty: 5, price: 100 }]
      };

      await expect(
        workflowEngine.createPOFromPR(submittedPR, ROLES.PLANT_MANAGER)
      ).rejects.toThrow(/ไม่อนุญาตให้ออกใบสั่งซื้อ/);
    });

    it('allows createPOFromPR when PR status is APPROVED', async () => {
      const approvedPR = {
        id: 'PR-TEST-APPROVED',
        prNo: 'PD997/2026',
        department: 'PD',
        status: 'APPROVED',
        purchaseChannel: 'SELF',
        items: [
          { productId: 'PROD-PD-001', qty: 2, price: 14500 }
        ]
      };

      const po = await workflowEngine.createPOFromPR(approvedPR, ROLES.PLANT_MANAGER);
      expect(po).toBeDefined();
      expect(po.prNo).toBe('PD997/2026');
      expect(po.prNumber).toBe('PD997/2026');
      expect(po.status).toBe('ISSUED');
    });

    it('blocks updatePRStatus to APPROVED if current status is WAITING_REVIEW or SUBMITTED', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        source: 'FACTORY',
        purchaseChannel: 'SELF',
        items: [{ productId: 'PROD-PD-001', qty: 1, price: 14500 }],
        totalAmount: 14500,
        isDraft: false
      }, ROLES.REQUESTER_PD);

      // Status is SUBMITTED
      await expect(
        workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER)
      ).rejects.toThrow(/ไม่อนุญาตให้อนุมัติออกใบสั่งซื้อ/);
    });

    it('successfully approves and issues PO when PR has been reviewed (status REVIEWED)', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        source: 'FACTORY',
        purchaseChannel: 'SELF',
        items: [{ productId: 'PROD-PD-001', qty: 1, price: 14500 }],
        totalAmount: 14500,
        isDraft: false
      }, ROLES.REQUESTER_PD);

      // Pass Level 1 review
      await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);

      // Final approve
      const result = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);
      expect(result.pr.status).toBe('PO_ISSUED');
      expect(result.po).toBeDefined();
      expect(result.pr.poNumber).toBe(result.po.poNo);
    });
  });

  describe('3. Storage Service Sanitization & Healing', () => {
    it('storageService.getPRs() strips legacy poNumber from PD002/2026', () => {
      const prs = [
        {
          id: 'PR-1789100542800-9OZ',
          prNo: 'PD002/2026',
          department: 'PD',
          status: 'completed',
          poNumber: 'PO-PD-2026-001',
          poNo: 'PO-PD-2026-001',
          items: []
        }
      ];
      storageService.savePRs(prs);

      const loaded = storageService.getPRs();
      const pd002 = loaded.find(p => p.prNo === 'PD002/2026');
      expect(pd002).toBeDefined();
      expect(pd002.poNumber).toBeUndefined();
      expect(pd002.poNo).toBeUndefined();
      expect(pd002.status).toBe('WAITING_REVIEW');
    });

    it('storageService.getPOs() heals PO-PD-2026-001 if referencing PD002/2026', () => {
      const pos = [
        {
          id: 'PO-1789003809083-1',
          poNo: 'PO-PD-2026-001',
          prNo: 'PD002/2026',
          prNumber: 'PD002/2026',
          department: 'PD',
          items: []
        }
      ];
      storageService.savePOs(pos);

      const loaded = storageService.getPOs();
      const po001 = loaded.find(p => p.poNo === 'PO-PD-2026-001');
      expect(po001).toBeDefined();
      expect(po001.prNo).toBe('PD001/2026');
      expect(po001.prNumber).toBe('PD001/2026');
      expect(po001.prId).toBe('PR-PD001-2026');
    });
  });
});
