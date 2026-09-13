import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';
import OnlineOrderCard, { calculateDisputeMetrics } from '../src/views/procurement/OnlineOrderCard';
import { AppProvider } from '../src/context/AppContext';
import { storageService } from '../src/services/storageService';

describe('Online Procurement Dispute Metrics & Settlement Business Logic', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. calculateDisputeMetrics Function Precision', () => {
    it('Case 1 (Shortage Only): ordered=5, received=4, unitPrice=254.10 -> disputedQty=1, claimableAmount=254.10', () => {
      const item = {
        name: 'สารเคมีทำความสะอาด',
        actualQty: 5,
        receivedQty: 4,
        unitPrice: 254.10,
        unit: 'ขวด'
      };

      const metrics = calculateDisputeMetrics(item);
      expect(metrics.orderedQty).toBe(5);
      expect(metrics.receivedQty).toBe(4);
      expect(metrics.shortageQty).toBe(1);
      expect(metrics.damagedQty).toBe(0);
      expect(metrics.disputedQty).toBe(1);
      expect(metrics.unitPrice).toBe(254.10);
      expect(metrics.claimableAmount).toBe(254.10);
      expect(metrics.hasDispute).toBe(true);
    });

    it('Case 2 (Damaged Only): ordered=5, received=5, damaged=2, unitPrice=254.10 -> disputedQty=2, claimableAmount=508.20', () => {
      const item = {
        name: 'สารเคมีทำความสะอาด',
        actualQty: 5,
        receivedQty: 5,
        damagedQty: 2,
        unitPrice: 254.10,
        unit: 'ขวด'
      };

      const metrics = calculateDisputeMetrics(item);
      expect(metrics.orderedQty).toBe(5);
      expect(metrics.receivedQty).toBe(5);
      expect(metrics.shortageQty).toBe(0);
      expect(metrics.damagedQty).toBe(2);
      expect(metrics.disputedQty).toBe(2);
      expect(metrics.claimableAmount).toBe(508.20);
      expect(metrics.hasDispute).toBe(true);
    });

    it('Case 3 (Shortage and Damaged): ordered=5, received=3, damaged=1, unitPrice=254.10 -> disputedQty=2, claimableAmount=508.20', () => {
      const item = {
        name: 'สารเคมีทำความสะอาด',
        actualQty: 5,
        receivedQty: 3,
        damagedQty: 1,
        unitPrice: 254.10,
        unit: 'ขวด'
      };

      const metrics = calculateDisputeMetrics(item);
      expect(metrics.orderedQty).toBe(5);
      expect(metrics.receivedQty).toBe(3);
      expect(metrics.shortageQty).toBe(1);
      expect(metrics.damagedQty).toBe(1);
      expect(metrics.disputedQty).toBe(2);
      expect(metrics.claimableAmount).toBe(508.20);
      expect(metrics.hasDispute).toBe(true);
    });

    it('Case 4 (100% Received): ordered=5, received=5, damaged=0, unitPrice=254.10 -> disputedQty=0, claimableAmount=0, hasDispute=false', () => {
      const item = {
        name: 'สารเคมีทำความสะอาด',
        actualQty: 5,
        receivedQty: 5,
        damagedQty: 0,
        unitPrice: 254.10,
        unit: 'ขวด'
      };

      const metrics = calculateDisputeMetrics(item);
      expect(metrics.orderedQty).toBe(5);
      expect(metrics.receivedQty).toBe(5);
      expect(metrics.shortageQty).toBe(0);
      expect(metrics.damagedQty).toBe(0);
      expect(metrics.disputedQty).toBe(0);
      expect(metrics.claimableAmount).toBe(0);
      expect(metrics.hasDispute).toBe(false);
    });

    it('Respects explicit shortageQty if provided, without falling back to orderedQty', () => {
      const item = {
        actualQty: 10,
        shortageQty: 3,
        unitPrice: 100
      };

      const metrics = calculateDisputeMetrics(item);
      expect(metrics.shortageQty).toBe(3);
      expect(metrics.disputedQty).toBe(3);
      expect(metrics.claimableAmount).toBe(300);
      expect(metrics.hasDispute).toBe(true);
    });

    it('Does NOT fall back to orderedQty (ordered=5, received=4) - strictly 1 unit disputed', () => {
      const itemWithoutExplicitShortage = {
        purchaseQty: 5,
        actualQty: 5,
        receivedQty: 4,
        unitPrice: 254.10
      };

      const metrics = calculateDisputeMetrics(itemWithoutExplicitShortage);
      // Strictly 1, NOT 5!
      expect(metrics.disputedQty).toBe(1);
      expect(metrics.claimableAmount).toBe(254.10);
    });
  });

  describe('2. OnlineOrderCard Alert Banner & Settlement Bar Calculation', () => {
    it('renders exact Alert Banner and Default Refund for 1 shortage item (฿254.10, NOT ฿1,270.50)', () => {
      const poWithSingleShortage = {
        id: 'PO-TEST-DISPUTE-01',
        poNo: 'PO-2026-DISP-01',
        status: 'IN_CLAIM',
        department: 'QC',
        vendorName: 'Shopee Official Shop',
        items: [
          {
            id: 'item-1',
            code: 'CHEM-01',
            name: 'น้ำยาทำความสะอาดหัววัด pH',
            purchaseQty: 5,
            actualQty: 5,
            receivedQty: 4,
            shortageQty: 1,
            damagedQty: 0,
            unit: 'ขวด',
            purchaseUnit: 'ขวด',
            unitPrice: 254.10,
            actualPrice: 254.10,
            storePlatform: 'Shopee',
            actualStoreName: 'ChemSupply Pro'
          }
        ],
        storeClaims: {}
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={poWithSingleShortage}
              activeTab="CLAIM"
              currentRole={{ id: 'PURCHASER', name: 'Online Purchaser' }}
              onUpdate={vi.fn()}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // 1. High-Contrast Issue Chip and Pop-out Claim Value check (Alert banner eliminated)
      expect(html).not.toContain('⚠️ คลังแจ้งปัญหา:');
      expect(html).toContain('น้ำยาทำความสะอาดหัววัด pH');
      expect(html).toContain('🚨 ขาด 1 ขวด');
      expect(html).toContain('มูลค่าที่ต้องเคลม');
      expect(html).toContain('฿254.10');
      // Must NOT claim 5 items
      expect(html).not.toContain('🚨 ขาด 5 ขวด');
      expect(html).not.toContain('value="1270.5"');

      // 2. Refund input default value in DOM must be 254.10 (not 1270.50)
      expect(html).toContain('value="254.1"');
      expect(html).toContain('คืนเต็มจำนวน');

      // 3. Quick Settlement Bar present
      expect(html).toContain('💰 คืนเงิน (Refund)');
      expect(html).toContain('✓ บันทึกผลเจรจา');
    });

    it('multi-store: collapses fully received store into Slim Muted Row, expands disputed store only', () => {
      const multiStorePO = {
        id: 'PO-MULTI-02',
        poNo: 'PO-2026-MULTI-02',
        status: 'IN_CLAIM',
        department: 'PD',
        items: [
          // Store 1: Disputed (Ordered 5, Received 4 -> 1 missing @ 254.10)
          {
            id: 'it-1',
            name: 'Item In Store 1',
            actualQty: 5,
            receivedQty: 4,
            unitPrice: 254.10,
            unit: 'ชิ้น',
            storePlatform: 'Shopee',
            actualStoreName: 'Disputed Store'
          },
          // Store 2: Fully received (Ordered 3, Received 3 -> 0 missing @ 100)
          {
            id: 'it-2',
            name: 'Item In Store 2',
            actualQty: 3,
            receivedQty: 3,
            unitPrice: 100,
            unit: 'ชิ้น',
            storePlatform: 'Lazada',
            actualStoreName: 'Complete Store'
          }
        ],
        storeClaims: {}
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={multiStorePO}
              activeTab="CLAIM"
              currentRole={{ id: 'PURCHASER', name: 'Online Purchaser' }}
              onUpdate={vi.fn()}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // Store 1: Disputed -> expanded with Quick Settlement Bar & High-Contrast Issue Chip
      expect(html).toContain('ร้าน: Disputed Store');
      expect(html).toContain('🚨 ขาด 1 ชิ้น');
      expect(html).toContain('มูลค่าที่ต้องเคลม');
      expect(html).toContain('฿254.10');
      expect(html).toContain('ย่อเก็บ ▴');

      // Store 2: 100% Received -> Slim Muted Row
      expect(html).toContain('ร้าน: Complete Store');
      expect(html).toContain('(รับของครบสมบูรณ์)');
      expect(html).toContain('เปิดดู / จัดการเคลม ▾');
    });
  });
});
