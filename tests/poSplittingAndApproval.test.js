import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { ROLES } from '../src/config/constants';
import { workflowEngine } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';

describe('Scenario 3: Auto-PO Creation, Splitting Logic & Vendor Assignment', () => {
  beforeEach(() => {
    storageService.resetData();
    // Setup Vendors and Products
    storageService.saveVendors([
      { id: 'VEN-01', code: 'V01', name: 'บริษัท ซัพพลาย เอ จำกัด' },
      { id: 'VEN-02', code: 'V02', name: 'บริษัท ซัพพลาย บี จำกัด' }
    ]);

    storageService.saveProducts([
      { id: 'PROD-A', code: 'A01', name: 'สินค้า A (Vendor 1)', category: 'PD', price: 100, supplierId: 'VEN-01', stockBalance: 5, unit: 'ชิ้น' },
      { id: 'PROD-B', code: 'B01', name: 'สินค้า B (Vendor 2)', category: 'PD', price: 200, supplierId: 'VEN-02', stockBalance: 5, unit: 'ชิ้น' },
      { id: 'PROD-C', code: 'C01', name: 'สินค้า C (ไม่มี Vendor)', category: 'PD', price: 300, supplierId: null, stockBalance: 5, unit: 'ชิ้น' }
    ]);
  });

  it('Single Vendor PR generates 1 PO on Final Approval', async () => {
    const pr = await workflowEngine.createPR({
      department: 'PD',
      source: 'FACTORY',
      purchaseChannel: 'SELF',
      requiredDate: '2026-09-15',
      items: [{ productId: 'PROD-A', code: 'A01', name: 'สินค้า A', qty: 10, price: 100 }],
      totalAmount: 1000,
      reason: 'Single vendor purchase',
      isDraft: false
    }, ROLES.REQUESTER_PD);

    // Pass Level 1 Review
    await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);

    // Level 2 Final Approve (Plant Manager)
    const { pr: approvedPR, po: generatedPO } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

    expect(approvedPR.status).toBe('PO_ISSUED');
    expect(generatedPO).toBeDefined();
    expect(generatedPO.vendorId).toBe('VEN-01');
    expect(generatedPO.vendorName).toBe('บริษัท ซัพพลาย เอ จำกัด');
    expect(generatedPO.grandTotal).toBe(1000);
    expect(generatedPO.status).toBe('ISSUED');
  });

  it('Multi-Vendor PR splits into multiple POs (including null supplier group)', async () => {
    const pr = await workflowEngine.createPR({
      department: 'PD',
      source: 'FACTORY',
      purchaseChannel: 'SELF',
      requiredDate: '2026-09-15',
      items: [
        { productId: 'PROD-A', code: 'A01', name: 'สินค้า A (Vendor 1)', qty: 2, price: 100 },
        { productId: 'PROD-B', code: 'B01', name: 'สินค้า B (Vendor 2)', qty: 3, price: 200 },
        { productId: 'PROD-C', code: 'C01', name: 'สินค้า C (ไม่มี Vendor)', qty: 1, price: 300 }
      ],
      totalAmount: 1100,
      reason: 'Multi-vendor purchase',
      isDraft: false
    }, ROLES.REQUESTER_PD);

    // Final Approve
    await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
    const { po: generatedPOs } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

    // Must be split into 3 distinct POs
    expect(Array.isArray(generatedPOs)).toBe(true);
    expect(generatedPOs.length).toBe(3);

    // PO 1: Vendor 1
    const po1 = generatedPOs.find(p => p.vendorId === 'VEN-01');
    expect(po1).toBeDefined();
    expect(po1.items.length).toBe(1);
    expect(po1.items[0].productId).toBe('PROD-A');

    // PO 2: Vendor 2
    const po2 = generatedPOs.find(p => p.vendorId === 'VEN-02');
    expect(po2).toBeDefined();
    expect(po2.items[0].productId).toBe('PROD-B');

    // PO 3: No Vendor (TBD)
    const po3 = generatedPOs.find(p => p.vendorId === null);
    expect(po3).toBeDefined();
    expect(po3.vendorName).toBe('ไม่ระบุผู้ขาย (รอจัดซื้อดำเนินการ)');
    expect(po3.items[0].productId).toBe('PROD-C');
  });

  it('Assign Vendor to PO updates vendorId and logs activity', async () => {
    const pr = await workflowEngine.createPR({
      department: 'PD',
      source: 'FACTORY',
      purchaseChannel: 'SELF',
      requiredDate: '2026-09-15',
      items: [{ productId: 'PROD-C', code: 'C01', name: 'สินค้า C (ไม่มี Vendor)', qty: 1, price: 300 }],
      totalAmount: 300,
      reason: 'Missing vendor',
      isDraft: false
    }, ROLES.REQUESTER_PD);

    await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
    const { po } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

    expect(po.vendorId).toBeNull();

    // Assign Vendor to this PO
    const updatedPO = await workflowEngine.assignVendorToPO(po.id, 'VEN-01', 'บริษัท ซัพพลาย เอ จำกัด', ROLES.ADMIN);
    expect(updatedPO.vendorId).toBe('VEN-01');
    expect(updatedPO.vendorName).toBe('บริษัท ซัพพลาย เอ จำกัด');
    expect(updatedPO.activityLog.some(l => l.action.includes('ระบุผู้ขาย'))).toBe(true);
  });

  it('Online Purchase creates PO with IN_PROGRESS_ONLINE for Online Purchaser', async () => {
    const pr = await workflowEngine.createPR({
      department: 'PD',
      source: 'FACTORY',
      purchaseChannel: 'ONLINE',
      requiredDate: '2026-09-15',
      items: [{ productId: 'PROD-A', code: 'A01', name: 'สินค้า A', qty: 1, price: 500 }],
      totalAmount: 500,
      reason: 'Buy from Shopee',
      isDraft: false
    }, ROLES.REQUESTER_PD);

    await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
    const { po: onlinePO } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

    expect(onlinePO.status).toBe('IN_PROGRESS_ONLINE');
    expect(onlinePO.purchaseChannel).toBe('ONLINE');
  });
});
