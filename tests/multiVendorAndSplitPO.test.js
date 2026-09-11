import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { workflowEngine } from '../src/services/workflowEngine.js';
import { storageService } from '../src/services/storageService.js';
import { apiService } from '../src/services/apiService.js';

describe('Multi-Vendor PR & Auto-Split POs by Vendor', () => {
  beforeEach(() => {
    storageService.resetData();
    storageService.saveVendors([
      {
        id: 'VEND-001',
        code: 'VEND-IND-01',
        name: 'บริษัท สยามอินดัสเตรียลซัพพลาย จำกัด',
        taxId: '0105551234567',
        address: '88/9 หมู่ 4 นิคมอุตสาหกรรมบางชัน ถ.เสรีไทย คันนายาว กทม. 10230',
        contactPerson: 'คุณสมชาย มุ่งมั่น',
        phone: '02-123-4567',
        email: 'sales@siamind.co.th',
        department: 'PD'
      },
      {
        id: 'VEND-002',
        code: 'VEND-OIL-02',
        name: 'บริษัท ปิโตรเลียมแอนด์ลูบริแคนท์ เทรดดิ้ง จำกัด',
        taxId: '0105559876543',
        address: '123/45 ถ.วิภาวดีรังสิต จตุจักร กทม. 10900',
        contactPerson: 'คุณวิภาวรรณ ชัยเจริญ',
        phone: '02-987-6543',
        email: 'contact@petrolube.com',
        department: 'PD'
      }
    ]);
  });

  it('1. Splits 1 Multi-Vendor PR into multiple consecutive POs grouped by vendor', async () => {
    const user = { name: 'คุณวิชัย (PD)', title: 'Requester (PD)', department: 'PD' };
    const plantMgr = { name: 'คุณประเสริฐ (Plant Mgr)', title: 'Plant Manager', department: 'PD', roleId: 'PLANT_MANAGER', level: 3 };

    // Create PR with 2 items from 2 different vendors
    const prData = {
      department: 'PD',
      purchaseChannel: 'SELF',
      hasVat: true,
      financials: { vatMode: 'AFTER_DISCOUNT', vatAmount: 140, grandTotal: 2140 },
      items: [
        {
          productId: 'PROD-1',
          code: 'CODE-1',
          name: 'สินค้าผู้ขาย 1',
          price: 1000,
          qty: 1,
          vendorId: 'VEND-001'
        },
        {
          productId: 'PROD-2',
          code: 'CODE-2',
          name: 'สินค้าผู้ขาย 2',
          price: 1000,
          qty: 1,
          vendorId: 'VEND-002'
        }
      ]
    };

    const newPR = await workflowEngine.createPR(prData, user);
    expect(newPR).toBeDefined();

    // Advance PR to APPROVED
    newPR.status = 'APPROVED';
    storageService.savePRs([newPR]);

    // Create POs from approved Multi-Vendor PR
    const generatedPOs = await workflowEngine.createPOFromPR(newPR, plantMgr);
    expect(Array.isArray(generatedPOs)).toBe(true);
    expect(generatedPOs.length).toBe(2);

    // Verify consecutive PO numbers
    const [po1, po2] = generatedPOs;
    expect(po1.prNo).toBe(newPR.prNo);
    expect(po2.prNo).toBe(newPR.prNo);
    expect(po1.poNo).not.toBe(po2.poNo);

    // Verify 5-point vendor data in PO 1
    expect(po1.vendorName).toBe('บริษัท สยามอินดัสเตรียลซัพพลาย จำกัด');
    expect(po1.vendorId).toBe('VEND-001');
    expect(po1.vendor?.taxId).toBe('0105551234567');
    expect(po1.vendor?.address).toContain('นิคมอุตสาหกรรมบางชัน');
    expect(po1.vendor?.contactPerson).toBe('คุณสมชาย มุ่งมั่น');
    expect(po1.vendor?.phone).toBe('02-123-4567');

    // Verify 5-point vendor data in PO 2
    expect(po2.vendorName).toBe('บริษัท ปิโตรเลียมแอนด์ลูบริแคนท์ เทรดดิ้ง จำกัด');
    expect(po2.vendorId).toBe('VEND-002');
    expect(po2.vendor?.taxId).toBe('0105559876543');
    expect(po2.vendor?.contactPerson).toBe('คุณวิภาวรรณ ชัยเจริญ');
    expect(po2.vendor?.phone).toBe('02-987-6543');

    // Financial verification
    expect(po1.subtotal).toBe(1000);
    expect(po1.vat).toBe(70);
    expect(po1.grandTotal).toBe(1070);

    expect(po2.subtotal).toBe(1000);
    expect(po2.vat).toBe(70);
    expect(po2.grandTotal).toBe(1070);
  });

  it('2. Records real store name as vendorName when Online Purchaser confirms order', async () => {
    const user = { name: 'คุณนัท (จัดซื้อออนไลน์)', title: 'Online Purchaser', roleId: 'ONLINE_PURCHASER' };
    const onlinePO = {
      id: 'PO-ONLINE-TEST',
      poNo: 'PO-PD-2026-099',
      prNo: 'PD099/2026',
      department: 'PD',
      purchaseChannel: 'ONLINE',
      vendorName: 'รอจัดซื้อดำเนินการ',
      status: 'ORDERED_PENDING_DELIVERY',
      items: [
        { productId: 'PROD-3', name: 'สินค้าออนไลน์', price: 500, qty: 1, unitPrice: 500, purchaseQty: 1 }
      ]
    };
    storageService.savePOs([onlinePO]);

    const result = await apiService.acknowledgeOnlineTask(
      onlinePO.id,
      'Shopee: 3M Official Store',
      user,
      onlinePO.items,
      'สั่งซื้อเสร็จสิ้น ใช้คูปองส่วนลด'
    );

    expect(result).toBeDefined();
    const updatedPO = storageService.getPOs().find(p => p.id === onlinePO.id);
    expect(updatedPO.vendorName).toBe('Shopee: 3M Official Store');
  });

  it('3. Single PR Document Guarantee: Form submission creates only 1 PR for all vendors, reviewed as 1 document, and splits into N POs only on approval', async () => {
    const requester = { name: 'คุณวิชัย (PD)', title: 'Requester (PD)', department: 'PD', roleId: 'REQUESTER_PD' };
    const asstMgr = { name: 'คุณสมชาย (Asst. Mgr)', title: 'Assistant Manager', department: 'PD', roleId: 'ASST_MANAGER', level: 1 };
    const plantMgr = { name: 'คุณประเสริฐ (Plant Mgr)', title: 'Plant Manager', department: 'PD', roleId: 'PLANT_MANAGER', level: 2 };

    const prPayload = {
      department: 'PD',
      purchaseChannel: 'SELF',
      hasVat: true,
      items: [
        { productId: 'PROD-A', code: 'A01', name: 'Item 1 from Vendor 1', price: 1000, qty: 2, vendorId: 'VEND-001' },
        { productId: 'PROD-B', code: 'B01', name: 'Item 2 from Vendor 2', price: 2000, qty: 1, vendorId: 'VEND-002' },
        { productId: 'PROD-C', code: 'C01', name: 'Item 3 without Vendor', price: 500, qty: 1, vendorId: null }
      ]
    };

    // 1. PR Creation Phase: MUST create exactly 1 single PR document
    const createdPR = await workflowEngine.createPR(prPayload, requester);
    expect(createdPR).toBeDefined();

    const allPRs = storageService.getPRs();
    expect(allPRs.length).toBe(1);
    expect(allPRs[0].id).toBe(createdPR.id);
    expect(allPRs[0].items.length).toBe(3);

    // Subtotal: (1000*2) + (2000*1) + (500*1) = 4500
    // VAT 7% = 315
    // Grand Total = 4815
    expect(createdPR.financials.subtotal).toBe(4500);
    expect(createdPR.financials.vatAmount).toBe(315);
    expect(createdPR.financials.grandTotal).toBe(4815);
    expect(createdPR.totalAmount).toBe(4815);

    // 2. Review & Approval Phase: Single document throughout
    const { pr: reviewedPR } = await workflowEngine.updatePRStatus(createdPR.id, 'REVIEWED', asstMgr);
    expect(reviewedPR.status).toBe('REVIEWED');
    expect(storageService.getPRs().length).toBe(1);

    // 3. PO Generation Phase: Group by Vendor happens strictly upon approval (1 PR to N POs)
    const { pr: approvedPR, po: generatedPOs } = await workflowEngine.updatePRStatus(createdPR.id, 'APPROVED', plantMgr);
    expect(approvedPR.status).toBe('PO_ISSUED');
    expect(Array.isArray(generatedPOs)).toBe(true);
    expect(generatedPOs.length).toBe(3); // VEND-001, VEND-002, NULL

    // PR document count remains 1
    expect(storageService.getPRs().length).toBe(1);
    // PO document count is 3
    expect(storageService.getPOs().length).toBe(3);
  });

  it('4. 1 PR = 1 Vendor (Internal Purchase): Header Vendor selector ensures 1 PR maps directly to 1 PO with full Master Vendor data, VAT 7%, and accurate financials without splitting', async () => {
    const requester = { name: 'คุณวิชัย (PD)', title: 'Requester (PD)', department: 'PD', roleId: 'REQUESTER_PD' };
    const plantMgr = { name: 'คุณประเสริฐ (Plant Mgr)', title: 'Plant Manager', department: 'PD', roleId: 'PLANT_MANAGER', level: 2 };

    const prPayload = {
      department: 'PD',
      purchaseChannel: 'SELF',
      vendorId: 'VEND-001',
      hasVat: true,
      items: [
        { productId: 'PROD-A', code: 'A01', name: 'Item 1 from Master Vendor', price: 1500, qty: 2 },
        { productId: 'PROD-B', code: 'B01', name: 'Item 2 from Master Vendor', price: 2000, qty: 1 }
      ]
    };

    // 1 PR Created with Header Vendor
    const createdPR = await workflowEngine.createPR(prPayload, requester);
    expect(createdPR).toBeDefined();
    expect(createdPR.vendorId).toBe('VEND-001');
    expect(createdPR.items.length).toBe(2);
    expect(createdPR.items[0].vendorId).toBe('VEND-001');
    expect(createdPR.items[1].vendorId).toBe('VEND-001');

    // Subtotal = (1500 * 2) + (2000 * 1) = 5000
    // VAT 7% = 350
    // Grand Total = 5350
    expect(createdPR.financials.subtotal).toBe(5000);
    expect(createdPR.financials.vatAmount).toBe(350);
    expect(createdPR.financials.grandTotal).toBe(5350);

    // Fast-track to APPROVED
    createdPR.status = 'APPROVED';
    storageService.savePRs([createdPR]);

    // Generate PO (1 PR = 1 PO)
    const generatedPO = await workflowEngine.createPOFromPR(createdPR, plantMgr);
    expect(generatedPO).toBeDefined();
    expect(Array.isArray(generatedPO) ? generatedPO.length : 1).toBe(1);

    const po = Array.isArray(generatedPO) ? generatedPO[0] : generatedPO;
    expect(po.vendorId).toBe('VEND-001');
    expect(po.vendorName).toBe('บริษัท สยามอินดัสเตรียลซัพพลาย จำกัด');
    expect(po.vendor?.taxId).toBe('0105551234567');
    expect(po.vendor?.address).toContain('นิคมอุตสาหกรรมบางชัน');
    expect(po.vendor?.contactPerson).toBe('คุณสมชาย มุ่งมั่น');
    expect(po.vendor?.phone).toBe('02-123-4567');
    expect(po.subtotal).toBe(5000);
    expect(po.vat).toBe(350);
    expect(po.grandTotal).toBe(5350);
    expect(po.status).toBe('ISSUED');
  });

  it('5. Online Purchase: Form without header vendor, multi-item with product URLs, approved into 1 Online PO (IN_PROGRESS_ONLINE) dispatched to Online Procurement Hub', async () => {
    const requester = { name: 'คุณวิชัย (PD)', title: 'Requester (PD)', department: 'PD', roleId: 'REQUESTER_PD' };
    const plantMgr = { name: 'คุณประเสริฐ (Plant Mgr)', title: 'Plant Manager', department: 'PD', roleId: 'PLANT_MANAGER', level: 2 };

    const prPayload = {
      department: 'PD',
      purchaseChannel: 'ONLINE',
      specUrl: 'https://shopee.co.th/cart',
      items: [
        { productId: 'PROD-ONLINE-1', code: 'ON-01', name: 'เมาส์ไร้สาย', price: 350, qty: 2, productUrl: 'https://shopee.co.th/mouse' },
        { productId: 'PROD-ONLINE-2', code: 'ON-02', name: 'คีย์บอร์ดบลูทูธ', price: 800, qty: 1, productUrl: 'https://lazada.co.th/keyboard' }
      ]
    };

    const createdPR = await workflowEngine.createPR(prPayload, requester);
    expect(createdPR).toBeDefined();
    expect(createdPR.purchaseChannel).toBe('ONLINE');
    expect(createdPR.vendorId).toBeNull();
    expect(createdPR.financials.subtotal).toBe(1500); // (350*2) + 800
    expect(createdPR.financials.grandTotal).toBe(1500);

    // Fast-track to APPROVED
    createdPR.status = 'APPROVED';
    storageService.savePRs([createdPR]);

    const generatedPO = await workflowEngine.createPOFromPR(createdPR, plantMgr);
    const po = Array.isArray(generatedPO) ? generatedPO[0] : generatedPO;
    expect(po).toBeDefined();
    expect(po.purchaseChannel).toBe('ONLINE');
    expect(po.status).toBe('IN_PROGRESS_ONLINE');
    expect(po.items.length).toBe(2);
    expect(po.grandTotal).toBe(1500);
  });
});
