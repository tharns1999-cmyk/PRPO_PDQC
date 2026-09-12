import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { workflowEngine, FALLBACK_SEED_ATTACHMENTS, getFallbackAttachmentsForCode } from '../src/services/workflowEngine.js';
import { storageService } from '../src/services/storageService.js';

describe('End-to-End Multi-Attachment System Verification', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  it('1. Provides fallback seed data for ITM-001 (2 images) and PD-STF-001 (1 image)', () => {
    // Check ITM-001 fallback attachments
    const glovesFallback = getFallbackAttachmentsForCode('ITM-001');
    expect(glovesFallback).toBeDefined();
    expect(glovesFallback).toHaveLength(2);
    expect(glovesFallback[0].name).toContain('แพ็คเกจ');
    expect(glovesFallback[1].name).toContain('สินค้าจริง');
    expect(glovesFallback[0].url).toContain('data:image/svg+xml');
    expect(glovesFallback[1].url).toContain('data:image/svg+xml');

    // Check PD-STF-001 fallback attachments
    const filmFallback = getFallbackAttachmentsForCode('PD-STF-001');
    expect(filmFallback).toBeDefined();
    expect(filmFallback).toHaveLength(1);
    expect(filmFallback[0].name).toContain('ฟิล์มยืดพันพาเลท');
    expect(filmFallback[0].url).toContain('data:image/svg+xml');

    // Case-insensitive & trimmed lookups
    expect(getFallbackAttachmentsForCode('  itm-001  ')).toHaveLength(2);
    expect(getFallbackAttachmentsForCode('pd-stf-001')).toHaveLength(1);
    expect(getFallbackAttachmentsForCode('NON-EXISTENT')).toHaveLength(0);
  });

  it('2. Maps item-level attachments and PR-level documents when PR is converted to PO in workflowEngine', async () => {
    const mockUser = {
      id: 'USR-0005',
      name: 'คุณประเสริฐ ยิ่งยง',
      employeeName: 'คุณประเสริฐ ยิ่งยง',
      title: 'Plant Manager',
      roleId: 'PLANT_MANAGER',
      level: 3
    };

    const testPR = {
      id: 'PR-TEST-ATTACH-001',
      prNo: 'PD888/2026',
      department: 'PD',
      status: 'APPROVED',
      purchaseChannel: 'ONLINE',
      quotationFiles: [
        { name: 'Quotation-Vendor-A.pdf', url: 'blob:mock-pdf-url', size: 102400, type: 'application/pdf' }
      ],
      generalAttachments: [
        { name: 'Spec-Document-Overall.jpg', url: 'blob:mock-spec-url', size: 51200, type: 'image/jpeg' }
      ],
      attachments: [
        { name: 'Quotation-Vendor-A.pdf', previewUrl: 'blob:mock-pdf-url', size: 102400, type: 'application/pdf', category: 'QUOTATION' },
        { name: 'Spec-Document-Overall.jpg', previewUrl: 'blob:mock-spec-url', size: 51200, type: 'image/jpeg', category: 'GENERAL' }
      ],
      items: [
        {
          productId: 'PROD-PD-001',
          code: 'CUSTOM-ITEM-A',
          name: 'สินค้าสั่งทำพิเศษ A',
          qty: 2,
          price: 150,
          platform: 'Shopee',
          productUrl: 'https://shopee.co.th/product/123/456',
          images: [
            { name: 'item-front.jpg', url: 'data:image/jpeg;base64,frontImg', previewUrl: 'data:image/jpeg;base64,frontImg' },
            { name: 'item-back.jpg', url: 'data:image/jpeg;base64,backImg', previewUrl: 'data:image/jpeg;base64,backImg' },
            { name: 'item-detail.jpg', url: 'data:image/jpeg;base64,detailImg', previewUrl: 'data:image/jpeg;base64,detailImg' }
          ]
        },
        {
          productId: 'PROD-PD-002',
          code: 'ITM-001', // Should get fallback 2 images
          name: 'ถุงมือยางไนไตรล์',
          qty: 10,
          price: 100,
          platform: 'Lazada',
          productUrl: 'https://lazada.co.th/product/789',
          images: [] // Empty -> fallback should kick in
        }
      ]
    };

    const po = await workflowEngine.createPOFromPR(testPR, mockUser);
    expect(po).toBeDefined();

    // Check PR-Level Attachments forwarded to PO
    expect(po.prAttachments).toBeDefined();
    expect(po.prAttachments.length).toBeGreaterThanOrEqual(2);
    const hasQuotation = po.prAttachments.some(a => a.name === 'Quotation-Vendor-A.pdf');
    const hasGeneral = po.prAttachments.some(a => a.name === 'Spec-Document-Overall.jpg');
    expect(hasQuotation).toBe(true);
    expect(hasGeneral).toBe(true);

    // Check Item 1 attachments forwarded
    const item1 = po.items[0];
    expect(item1.attachments).toBeDefined();
    expect(item1.attachments).toHaveLength(3);
    expect(item1.attachments[0].name).toBe('item-front.jpg');
    expect(item1.productUrl).toBe('https://shopee.co.th/product/123/456');
    expect(item1.storePlatform).toBe('Shopee');

    // Check Item 2 fallback seed attachments
    const item2 = po.items[1];
    expect(item2.attachments).toBeDefined();
    expect(item2.attachments).toHaveLength(2);
    expect(item2.attachments[0].name).toContain('แพ็คเกจ');
    expect(item2.attachments[1].name).toContain('สินค้าจริง');
    expect(item2.productUrl).toBe('https://lazada.co.th/product/789');
    expect(item2.storePlatform).toBe('Lazada');
  });

  it('3. Non-regression: Financial calculations and line item contracts are preserved', async () => {
    const mockUser = {
      id: 'USR-0005',
      name: 'คุณประเสริฐ ยิ่งยง',
      title: 'Plant Manager',
      roleId: 'PLANT_MANAGER',
      level: 3
    };

    const testPR = {
      id: 'PR-MATH-TEST',
      prNo: 'PD999/2026',
      department: 'PD',
      status: 'APPROVED',
      purchaseChannel: 'ONLINE',
      items: [
        {
          productId: 'PROD-1',
          code: 'ITM-001',
          name: 'Item 1',
          qty: 5,
          price: 200,
          discountAmount: 50
        }
      ]
    };

    const po = await workflowEngine.createPOFromPR(testPR, mockUser);
    expect(po.items[0].orderedQty).toBe(5);
    expect(po.items[0].remainingQty).toBe(5);
    expect(po.items[0].receivedQty).toBe(0);
    expect(po.subtotal).toBe(1000);
    expect(po.status).toBe('IN_PROGRESS_ONLINE');
  });
});
