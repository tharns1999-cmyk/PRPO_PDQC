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
});
