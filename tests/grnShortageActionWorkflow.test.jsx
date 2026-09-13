import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';
import { AppProvider } from '../src/context/AppContext';
import { calculateDisputeMetrics } from '../src/views/procurement/OnlineOrderCard';
import OnlineOrderCard from '../src/views/procurement/OnlineOrderCard';
import { warehouseService } from '../src/services/warehouseService';
import { storageService } from '../src/services/storageService';
import ReceivingModal from '../src/views/inventory/ReceivingModal';

describe('GRN Shortage Action Workflow & Online Claim Filtering (CLAIM_SHORTAGE vs WAIT_NEXT_ROUND)', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. calculateDisputeMetrics Function Precision per Directive 3', () => {
    it('calculates disputedQty & claimableAmount when shortageAction is CLAIM_SHORTAGE', () => {
      const item = {
        id: 'ITM-1',
        name: 'สายรัดพลาสติก',
        orderedQty: 5,
        receivedQty: 3,
        shortageQty: 2,
        damagedQty: 0,
        unitPrice: 150,
        shortageAction: 'CLAIM_SHORTAGE'
      };

      const metrics = calculateDisputeMetrics(item, 'PARTIALLY_RECEIVED_IN_CLAIM', true);
      expect(metrics.shortageQty).toBe(2);
      expect(metrics.disputedQty).toBe(2);
      expect(metrics.claimableAmount).toBe(300); // 2 * 150
      expect(metrics.hasDispute).toBe(true);
      expect(metrics.isWaitingNextRound).toBe(false);
    });

    it('sets disputedQty = 0 & hasDispute = false when shortageAction is WAIT_NEXT_ROUND without damage', () => {
      const item = {
        id: 'ITM-2',
        name: 'เทปOPP ใส',
        orderedQty: 10,
        receivedQty: 7,
        shortageQty: 3,
        damagedQty: 0,
        unitPrice: 50,
        shortageAction: 'WAIT_NEXT_ROUND'
      };

      const metrics = calculateDisputeMetrics(item, 'WAITING_DELIVERY_ROUND_2', true);
      expect(metrics.shortageQty).toBe(3);
      expect(metrics.disputedQty).toBe(0); // 0 because waiting next round
      expect(metrics.claimableAmount).toBe(0);
      expect(metrics.hasDispute).toBe(false);
      expect(metrics.isWaitingNextRound).toBe(true);
      expect(metrics.waitingNextRoundQty).toBe(3);
    });

    it('handles combined damagedQty and shortageAction WAIT_NEXT_ROUND: only damagedQty is disputed', () => {
      const item = {
        id: 'ITM-3',
        name: 'กล่องกระดาษ No.5',
        orderedQty: 10,
        receivedQty: 6,
        shortageQty: 3,
        damagedQty: 1,
        unitPrice: 20,
        shortageAction: 'WAIT_NEXT_ROUND'
      };

      const metrics = calculateDisputeMetrics(item, 'PARTIALLY_RECEIVED_IN_CLAIM', true);
      expect(metrics.shortageQty).toBe(3);
      expect(metrics.damagedQty).toBe(1);
      expect(metrics.disputedQty).toBe(1); // strictly 1 damaged unit
      expect(metrics.claimableAmount).toBe(20); // 1 * 20
      expect(metrics.hasDispute).toBe(true);
    });
  });

  describe('2. warehouseService.submitGRN Data Pipeline per Directive 2', () => {
    it('sets poItem.hasDispute = true and PO status = PARTIALLY_RECEIVED_IN_CLAIM when CLAIM_SHORTAGE', async () => {
      const testPO = {
        id: 'PO-TEST-CLAIM',
        poNo: 'PO-2026-901',
        status: 'ORDERED',
        purchaseChannel: 'ONLINE',
        department: 'QC',
        items: [
          {
            id: 'ITM-101',
            productId: 'PROD-101',
            name: 'เครื่องวัดค่า pH',
            orderedQty: 2,
            receivedQty: 0,
            unitPrice: 1200
          }
        ]
      };
      storageService.savePOs([testPO]);

      const grnPayload = {
        grnNumber: 'GRN-2026-901-01',
        receivingItems: [
          {
            productId: 'PROD-101',
            goodQty: 1,
            damagedQty: 0,
            shortageQty: 1,
            shortageAction: 'CLAIM_SHORTAGE'
          }
        ]
      };

      const result = await warehouseService.submitGRN(testPO.id, grnPayload);
      expect(result.success).toBe(true);

      const savedPOs = storageService.getPOs();
      const updated = savedPOs.find(p => p.id === testPO.id);
      expect(updated.status).toBe('PARTIALLY_RECEIVED_IN_CLAIM');
      expect(updated.hasDispute).toBe(true);
      expect(updated.hasGRN).toBe(true);

      const updatedItem = updated.items[0];
      expect(updatedItem.shortageAction).toBe('CLAIM_SHORTAGE');
      expect(updatedItem.hasDispute).toBe(true);
      expect(updatedItem.shortageQty).toBe(1);
      expect(updatedItem.receivedQty).toBe(1);
    });

    it('sets poItem.hasDispute = false and PO status = WAITING_DELIVERY_ROUND_2 when WAIT_NEXT_ROUND', async () => {
      const testPO = {
        id: 'PO-TEST-WAIT',
        poNo: 'PO-2026-902',
        status: 'ORDERED',
        purchaseChannel: 'ONLINE',
        department: 'QC',
        items: [
          {
            id: 'ITM-102',
            productId: 'PROD-102',
            name: 'ถุงมือกันสารเคมี',
            orderedQty: 10,
            receivedQty: 0,
            unitPrice: 85
          }
        ]
      };
      storageService.savePOs([testPO]);

      const grnPayload = {
        grnNumber: 'GRN-2026-902-01',
        receivingItems: [
          {
            productId: 'PROD-102',
            goodQty: 6,
            damagedQty: 0,
            shortageQty: 4,
            shortageAction: 'WAIT_NEXT_ROUND'
          }
        ]
      };

      const result = await warehouseService.submitGRN(testPO.id, grnPayload);
      expect(result.success).toBe(true);

      const savedPOs = storageService.getPOs();
      const updated = savedPOs.find(p => p.id === testPO.id);
      expect(updated.status).toBe('WAITING_DELIVERY_ROUND_2');
      expect(updated.hasDispute).toBe(false);
      expect(updated.hasGRN).toBe(true);

      const updatedItem = updated.items[0];
      expect(updatedItem.shortageAction).toBe('WAIT_NEXT_ROUND');
      expect(updatedItem.hasDispute).toBe(false);
      expect(updatedItem.shortageQty).toBe(4);
      expect(updatedItem.receivedQty).toBe(6);
    });
  });

  describe('3. OnlineOrderCard UI Rendering per Directive 3', () => {
    it('renders Badge 🚨 ขาด {n} and red claimableAmount when shortageAction is CLAIM_SHORTAGE in CLAIM tab', () => {
      const po = {
        id: 'PO-CLAIM-VIEW',
        poNo: 'PO-2026-903',
        status: 'PARTIALLY_RECEIVED_IN_CLAIM',
        purchaseChannel: 'ONLINE',
        hasGRN: true,
        hasDispute: true,
        items: [
          {
            id: 'ITM-903',
            name: 'สว่านไร้สาย 12V',
            orderedQty: 3,
            receivedQty: 2,
            shortageQty: 1,
            damagedQty: 0,
            unitPrice: 890,
            actualPrice: 890,
            hasDispute: true,
            shortageAction: 'CLAIM_SHORTAGE',
            storeName: 'Hardware Store'
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard po={po} activeTab="CLAIM" />
          </AppProvider>
        </MemoryRouter>
      );

      // Verify shortage badge
      expect(html).toContain('🚨 ขาด 1 ชิ้น');
      // Verify claimable amount label and red value
      expect(html).toContain('มูลค่าที่ต้องเคลม');
      expect(html).toContain('฿890.00');
    });

    it('filters out (Hidden 100%) WAIT_NEXT_ROUND items in CLAIM tab', () => {
      const po = {
        id: 'PO-WAIT-VIEW',
        poNo: 'PO-2026-904',
        status: 'WAITING_DELIVERY_ROUND_2',
        purchaseChannel: 'ONLINE',
        hasGRN: true,
        hasDispute: false,
        items: [
          {
            id: 'ITM-904',
            name: 'น้ำยาทำความสะอาดพิเศษ',
            orderedQty: 5,
            receivedQty: 2,
            shortageQty: 3,
            damagedQty: 0,
            unitPrice: 250,
            actualPrice: 250,
            hasDispute: false,
            shortageAction: 'WAIT_NEXT_ROUND',
            storeName: 'Chemical Supply'
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard po={po} activeTab="CLAIM" />
          </AppProvider>
        </MemoryRouter>
      );

      // Item should NOT be rendered in CLAIM tab
      expect(html).not.toContain('น้ำยาทำความสะอาดพิเศษ');
      expect(html).not.toContain('🚨 ขาด 3 ชิ้น');
    });

    it('renders Badge ⏳ รอส่งมอบเพิ่ม {n} in ORDERED tab when shortageAction is WAIT_NEXT_ROUND', () => {
      const po = {
        id: 'PO-ORDERED-VIEW',
        poNo: 'PO-2026-905',
        status: 'WAITING_DELIVERY_ROUND_2',
        purchaseChannel: 'ONLINE',
        hasGRN: true,
        hasDispute: false,
        items: [
          {
            id: 'ITM-905',
            name: 'สายไฟ VAF 2x1.5',
            orderedQty: 4,
            receivedQty: 1,
            shortageQty: 3,
            damagedQty: 0,
            unitPrice: 420,
            actualPrice: 420,
            hasDispute: false,
            shortageAction: 'WAIT_NEXT_ROUND',
            storeName: 'Electric City'
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard po={po} activeTab="ORDERED" />
          </AppProvider>
        </MemoryRouter>
      );

      // Item should be visible with waiting badge
      expect(html).toContain('สายไฟ VAF 2x1.5');
      expect(html).toContain('⏳ รอส่งมอบเพิ่ม 3 ชิ้น');
      expect(html).not.toContain('🚨 ขาด');
    });
  });

  describe('4. ReceivingModal Dropdown & Default Selection per Directive 1', () => {
    it('renders dropdown with CLAIM_SHORTAGE as default option when item has shortage', () => {
      const po = {
        id: 'PO-MODAL-TEST',
        poNo: 'PO-2026-906',
        status: 'ORDERED',
        purchaseChannel: 'ONLINE',
        items: [
          {
            id: 'ITM-906',
            productId: 'PROD-906',
            name: 'มิเตอร์วัดไฟดิจิตอล',
            orderedQty: 5,
            receivedQty: 0,
            initialAcceptedQty: 2, // partial accepted -> shortageQty = 3 -> renders dropdown
            unitPrice: 650
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <ReceivingModal po={po} isOpen={true} />
          </AppProvider>
        </MemoryRouter>
      );

      expect(html).toContain('CLAIM_SHORTAGE');
      expect(html).toContain('WAIT_NEXT_ROUND');
      expect(html).toContain('🚨 ของขาด - ส่งเรื่องจัดซื้อเคลม/ขอเงินคืน');
      expect(html).toContain('📦 ร้านแจ้งแยกส่ง - รอส่งมอบรอบถัดไป');
    });
  });
});
