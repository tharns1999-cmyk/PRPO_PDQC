import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext.jsx';
import OnlineOrderCard from '../src/views/procurement/OnlineOrderCard.jsx';
import { workflowEngine, FALLBACK_SEED_ATTACHMENTS } from '../src/services/workflowEngine.js';
import { storageService } from '../src/services/storageService.js';

describe('Online Order Image Priority - User Upload First vs Fallback Mock', () => {
  const customUserBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...CUSTOM_USER_PHOTO';

  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. WorkflowEngine PR to PO Conversion Priority', () => {
    it('prioritizes user-uploaded image over FALLBACK_SEED_ATTACHMENTS for ITM-001 in createPOFromPR', async () => {
      const pr = {
        id: 'PR-TEST-USER-IMG',
        prNo: 'PD888/2026',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        status: 'APPROVED',
        items: [
          {
            productId: 'PROD-01',
            code: 'ITM-001', // code that has fallback gloves mock SVG
            name: 'ถุงมือยางเกรดพิเศษของฉัน',
            price: 250,
            qty: 5,
            images: [
              {
                url: customUserBase64,
                previewUrl: customUserBase64,
                name: 'my-real-glove-photo.jpg'
              }
            ],
            attachments: [
              {
                url: customUserBase64,
                previewUrl: customUserBase64,
                name: 'my-real-glove-photo.jpg'
              }
            ]
          }
        ]
      };

      const user = { name: 'Admin System', employeeName: 'คุณประเสริฐ ยิ่งยง' };
      const po = await workflowEngine.createPOFromPR(pr, user);

      expect(po).toBeDefined();
      expect(po.items).toBeDefined();
      expect(po.items.length).toBe(1);

      const poItem = po.items[0];
      // Must contain user's custom photo
      expect(poItem.images.length).toBe(1);
      expect(poItem.images[0].url).toBe(customUserBase64);
      expect(poItem.attachments[0].url).toBe(customUserBase64);

      // Must NOT be the fallback seed mock SVG
      const fallbackSvg = FALLBACK_SEED_ATTACHMENTS['ITM-001'][0].url;
      expect(poItem.images[0].url).not.toBe(fallbackSvg);
    });

    it('falls back to FALLBACK_SEED_ATTACHMENTS only when user did not attach any image', async () => {
      const prWithoutImage = {
        id: 'PR-TEST-NO-IMG',
        prNo: 'PD889/2026',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        status: 'APPROVED',
        items: [
          {
            productId: 'PROD-01',
            code: 'ITM-001',
            name: 'ถุงมือยาง (ไม่มีรูป)',
            price: 150,
            qty: 2,
            images: [],
            attachments: []
          }
        ]
      };

      const user = { name: 'Admin System', employeeName: 'คุณประเสริฐ ยิ่งยง' };
      const po = await workflowEngine.createPOFromPR(prWithoutImage, user);
      const poItem = po.items[0];

      // Fallback is used when no user images exist
      expect(poItem.images.length).toBeGreaterThan(0);
      expect(poItem.images[0].url).toContain('data:image/svg+xml');
    });
  });

  describe('2. OnlineOrderCard Component Rendering Priority', () => {
    it('renders user-uploaded Base64 image in thumbnail instead of mock glove SVG', () => {
      const onlinePOWithUserUpload = {
        id: 'PO-ONLINE-USER-IMG',
        poNo: 'PO-PD-2026-999',
        status: 'IN_PROGRESS_ONLINE',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            id: 'item-1',
            code: 'ITM-001', // code that has mock gloves
            name: 'ถุงมือยางไนไตรล์สั่งพิเศษ',
            purchaseQty: 10,
            unitPrice: 200,
            actualPrice: 200,
            actualQty: 10,
            storePlatform: 'Shopee',
            actualStoreName: 'Medical Store Thailand',
            images: [
              {
                url: customUserBase64,
                previewUrl: customUserBase64,
                name: 'custom-user-gloves.jpg'
              }
            ],
            attachments: [
              {
                url: customUserBase64,
                previewUrl: customUserBase64,
                name: 'custom-user-gloves.jpg'
              }
            ]
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={onlinePOWithUserUpload}
              activeTab="PENDING"
              currentRole={{ id: 'ONLINE_PURCHASER', name: 'ฝ่ายจัดซื้อออนไลน์', canOnlinePurchase: true }}
              onUpdate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // Thumbnail must render the user's custom Base64 image
      expect(html).toContain(customUserBase64);

      // Thumbnail must NOT render the mock glove SVG
      const mockSvg = FALLBACK_SEED_ATTACHMENTS['ITM-001'][0].url;
      expect(html).not.toContain(mockSvg);
    });
  });
});
