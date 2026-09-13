import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext';
import OnlineOrderCard, { calculateDisputeMetrics } from '../src/views/procurement/OnlineOrderCard';
import { workflowEngine } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';

describe('Online Order Claim Directives Verification (image_bb8943.png)', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. calculateDisputeMetrics Multi-key & Precision Logic', () => {
    it('supports item.receivedQty, item.grnReceivedQty, and item.goodQty', () => {
      // 1. receivedQty: 2 of 3 -> shortage = 1
      const it1 = { actualQty: 3, receivedQty: 2, unitPrice: 150 };
      const m1 = calculateDisputeMetrics(it1);
      expect(m1.shortageQty).toBe(1);
      expect(m1.disputedQty).toBe(1);
      expect(m1.claimableAmount).toBe(150);
      expect(m1.hasDispute).toBe(true);

      // 2. grnReceivedQty: 2 of 3 -> shortage = 1
      const it2 = { actualQty: 3, grnReceivedQty: 2, unitPrice: 150 };
      const m2 = calculateDisputeMetrics(it2);
      expect(m2.shortageQty).toBe(1);
      expect(m2.claimableAmount).toBe(150);
      expect(m2.hasDispute).toBe(true);

      // 3. goodQty: 2 of 3 -> shortage = 1
      const it3 = { actualQty: 3, goodQty: 2, unitPrice: 150 };
      const m3 = calculateDisputeMetrics(it3);
      expect(m3.shortageQty).toBe(1);
      expect(m3.claimableAmount).toBe(150);
      expect(m3.hasDispute).toBe(true);
    });

    it('forces hasDispute = false when item is fully received (e.g. 3/3 สายรัดพาเลท)', () => {
      const fullItem = {
        name: 'สายรัดพาเลท',
        actualQty: 3,
        receivedQty: 3,
        damagedQty: 0,
        unitPrice: 50
      };
      const metrics = calculateDisputeMetrics(fullItem);
      expect(metrics.orderedQty).toBe(3);
      expect(metrics.receivedQty).toBe(3);
      expect(metrics.shortageQty).toBe(0);
      expect(metrics.damagedQty).toBe(0);
      expect(metrics.disputedQty).toBe(0);
      expect(metrics.claimableAmount).toBe(0);
      expect(metrics.hasDispute).toBe(false);
    });

    it('calculates shortage accurately for 2 received of 3 ordered (1 missing, NOT 3 full claim)', () => {
      const partialItem = {
        name: 'ฟิล์มยืดพันพาเลท',
        actualQty: 3,
        receivedQty: 2,
        damagedQty: 0,
        unitPrice: 150
      };
      const metrics = calculateDisputeMetrics(partialItem);
      expect(metrics.orderedQty).toBe(3);
      expect(metrics.receivedQty).toBe(2);
      expect(metrics.shortageQty).toBe(1);
      expect(metrics.disputedQty).toBe(1);
      expect(metrics.claimableAmount).toBe(150); // 1 * 150 = 150, NOT 450!
      expect(metrics.hasDispute).toBe(true);
    });
  });

  describe('2. OnlineOrderCard UI Rendering in Claim Mode (image_bb8943.png)', () => {
    it('collapses complete store (สายรัดพาเลท 3/3) to Slim Muted Row and expands disputed store (ฟิล์มยืด 2/3)', () => {
      const testPO = {
        id: 'PO-BB8943-TEST',
        poNo: 'PO-2026-BB8943',
        status: 'PARTIALLY_RECEIVED_IN_CLAIM',
        department: 'PD',
        hasGRN: true,
        grnNumber: 'GRN-PO-2026-BB8943-01',
        items: [
          // Store 1: สายรัดพาเลท (3/3 intact) -> Complete Store
          {
            id: 'it-strap',
            name: 'สายรัดพาเลท',
            code: 'STRAP-01',
            actualQty: 3,
            purchaseQty: 3,
            receivedQty: 3,
            damagedQty: 0,
            shortageQty: 0,
            unitPrice: 50,
            actualPrice: 50,
            unit: 'ม้วน',
            purchaseUnit: 'ม้วน',
            storePlatform: 'Shopee',
            actualStoreName: 'ร้านขายสายรัด'
          },
          // Store 2: ฟิล์มยืดพันพาเลท (2/3 received, 1 shortage) -> Disputed Store
          {
            id: 'it-film',
            name: 'ฟิล์มยืดพันพาเลท',
            code: 'FILM-01',
            actualQty: 3,
            purchaseQty: 3,
            receivedQty: 2,
            damagedQty: 0,
            shortageQty: 1,
            unitPrice: 150,
            actualPrice: 150,
            unit: 'ม้วน',
            purchaseUnit: 'ม้วน',
            storePlatform: 'Shopee',
            actualStoreName: 'ร้านขายฟิล์ม'
          }
        ],
        storeClaims: {}
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={testPO}
              activeTab="CLAIM"
              currentRole={{ id: 'PURCHASER', name: 'Online Purchaser' }}
              onUpdate={vi.fn()}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // Store 1: Must be collapsed into Slim Muted Row
      expect(html).toContain('ร้าน: ร้านขายสายรัด');
      expect(html).toContain('(รับของครบสมบูรณ์)');

      // Store 2: Must be expanded in claim mode
      expect(html).toContain('ร้าน: ร้านขายฟิล์ม');
      expect(html).toContain('⚠️ ร้านนี้มีรายการติดปัญหา');

      // Product Row UI for Disputed Item (Directives 1 & 2):
      // 1. Badge 🚨 ขาด 1 ม้วน must be shown
      expect(html).toContain('🚨 ขาด 1 ม้วน');

      // 2. Equation {qty} x ฿{price} must be hidden on the right, replaced with claim container
      expect(html).toContain('มูลค่าที่ต้องเคลม');
      expect(html).toContain('฿150.00');

      // 3. Quick Settlement Bar default refund must be ฿150.00 (NOT ฿450.00!)
      expect(html).toContain('value="150"');
      expect(html).not.toContain('value="450"');
    });
  });

  describe('3. workflowEngine.receiveGoods Synchronization', () => {
    it('synchronizes poItem.shortageQty and poItem.damagedQty accurately upon goods receipt', async () => {
      const mockPO = {
        id: 'PO-SYNC-TEST',
        poNo: 'PO-2026-SYNC',
        status: 'ORDERED',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            id: 'item-1',
            productId: 'PROD-1',
            code: 'FILM-01',
            name: 'ฟิล์มยืดพันพาเลท',
            actualQty: 3,
            purchaseQty: 3,
            actualPrice: 150,
            unitPrice: 150,
            unit: 'ม้วน',
            receivedQty: 0
          }
        ],
        activityLog: []
      };

      storageService.savePOs([mockPO]);

      // Receive 2 out of 3, with 0 damaged -> shortage = 1
      const updatedPO = await workflowEngine.receiveGoods(
        'PO-SYNC-TEST',
        [{ productId: 'PROD-1', receivedThisTime: 2 }],
        { name: 'Staff', title: 'Warehouse', id: 'WH-01' },
        'รับ 2 ขาด 1'
      );

      const updatedItem = updatedPO.items[0];

      expect(updatedItem.receivedQty).toBe(2);
      expect(updatedItem.remainingQty).toBe(1);
      expect(updatedItem.shortageQty).toBe(1);
      expect(updatedItem.orderedQty).toBe(3);
    });
  });
});
