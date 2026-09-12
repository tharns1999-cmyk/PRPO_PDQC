import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext.jsx';
import PRCreateView from '../src/views/PRCreateView.jsx';
import { workflowEngine } from '../src/services/workflowEngine.js';
import { storageService } from '../src/services/storageService.js';
import { ROLES } from '../src/config/constants.js';

describe('PR Create View - Mandatory Product Image Enforcement & Gen-Z SaaS Media Strip', () => {
  const sampleProducts = [
    {
      id: 'PROD-01',
      code: 'ITM-001',
      name: 'ถุงมือยางไนไตรล์สีฟ้า',
      category: 'PD',
      department: 'PD',
      price: 150,
      unit: 'กล่อง',
      purchaseUnit: 'กล่อง',
      stockUnit: 'กล่อง',
      stockBalance: 40,
      reorderPoint: 10
    }
  ];

  const requesterRole = {
    id: 'REQUESTER_PD',
    roleId: 'REQUESTER_PD',
    name: 'สมชาย ผู้ขอซื้อ',
    title: 'เจ้าหน้าที่ฝ่ายผลิต',
    department: 'PD',
    level: 1,
    canCreatePR: true
  };

  beforeEach(() => {
    storageService.resetData();
    storageService.saveProducts(sampleProducts);
  });

  describe('1. WorkflowEngine Backend Validation Gate', () => {
    it('throws validation error if submitting an online PR with items lacking images', async () => {
      const onlinePRWithoutImages = {
        department: 'PD',
        purchaseChannel: 'ONLINE',
        enforceImageValidation: true,
        items: [
          {
            productId: 'PROD-01',
            price: 150,
            qty: 2,
            onlineUrl: 'https://shopee.co.th/product-item-1',
            images: []
          }
        ],
        isDraft: false
      };

      // Test direct validatePR
      expect(() => workflowEngine.validatePR(onlinePRWithoutImages, false)).toThrow(
        'กรุณาแนบรูปภาพสินค้าให้ครบทุกรายการสำหรับงานจัดซื้อออนไลน์'
      );

      // Test createPR enforcement
      await expect(
        workflowEngine.createPR(onlinePRWithoutImages, requesterRole, false)
      ).rejects.toThrow('กรุณาแนบรูปภาพสินค้าให้ครบทุกรายการสำหรับงานจัดซื้อออนไลน์');
    });

    it('allows online PR submission when all items have at least 1 image attached', async () => {
      const onlinePRWithImages = {
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-01',
            price: 150,
            qty: 2,
            onlineUrl: 'https://shopee.co.th/product-item-1',
            images: [{ url: 'data:image/png;base64,mockImage', name: 'product-shot.png' }]
          }
        ],
        isDraft: false
      };

      const created = await workflowEngine.createPR(onlinePRWithImages, requesterRole, false);
      expect(created).toBeDefined();
      expect(created.status).toBe('SUBMITTED');
      expect(created.items[0].images.length).toBe(1);
    });

    it('allows online PR save when isDraft is true even if items do not have images', async () => {
      const draftOnlinePR = {
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-01',
            price: 150,
            qty: 2,
            images: []
          }
        ],
        isDraft: true
      };

      const draft = await workflowEngine.createPR(draftOnlinePR, requesterRole, true);
      expect(draft).toBeDefined();
      expect(draft.status).toBe('DRAFT');
    });

    it('allows offline / SELF PR submission without images', async () => {
      const selfPRWithoutImages = {
        department: 'PD',
        purchaseChannel: 'SELF',
        vendorId: 'VND-001',
        items: [
          {
            productId: 'PROD-01',
            price: 150,
            qty: 2,
            images: []
          }
        ],
        isDraft: false
      };

      const created = await workflowEngine.createPR(selfPRWithoutImages, requesterRole, false);
      expect(created).toBeDefined();
      expect(created.status).toBe('SUBMITTED');
    });

    it('throws validation error when updating/resubmitting an online PR without images', async () => {
      // First save as draft
      const draft = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [{ productId: 'PROD-01', price: 150, qty: 1, images: [] }],
        isDraft: true
      }, requesterRole, true);

      // Now attempt to updatePR as submitted without images
      await expect(
        workflowEngine.updatePR(draft.id, {
          purchaseChannel: 'ONLINE',
          enforceImageValidation: true,
          items: [{ productId: 'PROD-01', price: 150, qty: 1, images: [] }]
        }, requesterRole, false)
      ).rejects.toThrow('กรุณาแนบรูปภาพสินค้าให้ครบทุกรายการสำหรับงานจัดซื้อออนไลน์');
    });
  });

  describe('2. Gen-Z SaaS Media Strip & Gallery UI Rendering in PRCreateView', () => {
    it('renders Empty State dashed rose banner with mandatory warning when online PR item has no image', () => {
      const editingOnlinePROneEmptyItem = {
        id: 'PR-TEST-001',
        prNo: 'PR-PD-2026-001',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-01',
            name: 'ถุงมือยางไนไตรล์สีฟ้า',
            code: 'ITM-001',
            price: 150,
            qty: 2,
            onlineUrl: 'https://shopee.co.th/product-test',
            platform: 'Shopee',
            images: []
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRCreateView
              currentRole={requesterRole}
              editingPR={editingOnlinePROneEmptyItem}
              products={sampleProducts}
              departments={[{ id: 'PD', name: 'ฝ่ายผลิต' }]}
              onNavigate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // 1. Check Empty State Banner & Text
      expect(html).toContain('แนบรูปภาพสินค้าจริง *');
      expect(html).toContain('(จำเป็นสำหรับจัดซื้อออนไลน์ — คลิกหรือลากวางรูปภาพที่นี่)');
      expect(html).toContain('* กรุณาแนบรูปสินค้าจริงสำหรับจัดซื้อออนไลน์');
      expect(html).toContain('border-dashed border-rose-300 bg-rose-50/50');

      // 2. Verify legacy tiny 24x24px photo box is completely removed
      expect(html).not.toContain('📷 รูปสินค้า (');
      expect(html).not.toContain('w-6 h-6 rounded border border-slate-200');

      // 3. Verify legacy button next to spec is completely removed
      expect(html).not.toContain('📷 แนบรูป</span>');
    });

    it('renders Filled Modern Gallery state with 48x48px thumbnails and emerald badge when image is attached', () => {
      const editingOnlinePRWithItemImage = {
        id: 'PR-TEST-002',
        prNo: 'PR-PD-2026-002',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-01',
            name: 'ถุงมือยางไนไตรล์สีฟ้า',
            code: 'ITM-001',
            price: 150,
            qty: 2,
            onlineUrl: 'https://shopee.co.th/product-test',
            platform: 'Shopee',
            images: [
              {
                url: 'https://example.com/item-photo.png',
                name: 'item-photo.png'
              }
            ]
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRCreateView
              currentRole={requesterRole}
              editingPR={editingOnlinePRWithItemImage}
              products={sampleProducts}
              departments={[{ id: 'PD', name: 'ฝ่ายผลิต' }]}
              onNavigate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // 1. Check Filled Gallery State with emerald badge
      expect(html).toContain('✓ แนบแล้ว (1)');
      expect(html).toContain('bg-emerald-50 border border-emerald-200');

      // 2. Check 48x48px (w-12 h-12) rounded-xl card
      expect(html).toContain('w-12 h-12 rounded-xl overflow-hidden');

      // 3. Check Hover delete button
      expect(html).toContain('title="ลบรูปนี้"');
      expect(html).toContain('bg-rose-600 text-white');

      // 4. Check Quick Add Button "+ เพิ่ม"
      expect(html).toContain('title="เพิ่มรูปภาพอีก"');
      expect(html).toContain('border-dashed border-slate-300');
    });
  });
});
