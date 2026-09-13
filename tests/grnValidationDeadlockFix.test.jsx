import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReceivingModal, { checkIsFullyAccounted } from '../src/views/inventory/ReceivingModal';
import { storageService } from '../src/services/storageService';
import { recordGoodsReceipt } from '../src/context/ProcurementContext';

describe('GRN Validation Deadlock Resolution & Intelligent PO Finalization', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. checkIsFullyAccounted Utility Logic', () => {
    it('returns true when all items have receivedQty + refundedQty >= orderedQty', () => {
      const items = [
        { orderedQty: 5, receivedQty: 4, refundedQty: 1 },
        { orderedQty: 5, receivedQty: 5, refundedQty: 0 }
      ];
      expect(checkIsFullyAccounted(items)).toBe(true);
    });

    it('returns true when remainingToReceive is 0 for all items', () => {
      const items = [
        { ordered: 5, accumulated: 4, refunded: 1, remainingToReceive: 0 },
        { ordered: 5, accumulated: 5, refunded: 0, remainingToReceive: 0 }
      ];
      expect(checkIsFullyAccounted(items)).toBe(true);
    });

    it('returns false when at least one item has pending physical goods to receive', () => {
      const items = [
        { orderedQty: 5, receivedQty: 4, refundedQty: 0 }, // 1 pending
        { orderedQty: 5, receivedQty: 5, refundedQty: 0 }
      ];
      expect(checkIsFullyAccounted(items)).toBe(false);
    });

    it('returns false for empty item list', () => {
      expect(checkIsFullyAccounted([])).toBe(false);
      expect(checkIsFullyAccounted(null)).toBe(false);
    });
  });

  describe('2. ReceivingModal UI Rendering for Fully Accounted PO (PO-PD-2026-001 Scenario)', () => {
    const fullyAccountedPO = {
      id: 'PO-1789003809083-1',
      poNo: 'PO-PD-2026-001',
      status: 'PARTIALLY_RECEIVED_IN_CLAIM',
      department: 'PD',
      vendorName: 'Shopee Supplier',
      items: [
        {
          productId: 'PROD-PD-002',
          code: 'PD-BOX-002',
          name: 'กล่องลูกฟูกมาตรฐาน',
          orderedQty: 5,
          accumulatedReceived: 4,
          receivedQty: 4,
          refundedQty: 1,
          claimResolution: 'REFUND',
          isSettled: true,
          purchaseUnit: 'ใบ',
          price: 162.32
        },
        {
          productId: 'PROD-PD-001',
          code: 'PD-OIL-068',
          name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
          orderedQty: 5,
          accumulatedReceived: 5,
          receivedQty: 5,
          refundedQty: 0,
          purchaseUnit: 'ถัง',
          price: 14500
        }
      ],
      storeClaims: {
        'Shopee_boxstore': {
          status: 'RESOLVED',
          isResolved: true,
          type: 'REFUND',
          refundAmount: 162.32
        }
      }
    };

    it('renders "✓ ยืนยันปิดงานใบสั่งซื้อ (Finalize PO)" button when all items are 100% accounted for', () => {
      const html = renderToStaticMarkup(
        <ReceivingModal po={fullyAccountedPO} isOpen={true} />
      );

      // Must render Finalize PO label
      expect(html).toContain('ยืนยันปิดงานใบสั่งซื้อ (Finalize PO)');
      // Must NOT render generic confirm receiving label
      expect(html).not.toContain('✓ ยืนยันรับเข้าคลังสมบูรณ์');
      // Must render informational green notice
      expect(html).toContain('สินค้าทุกรายการได้รับการตรวจรับหรือเคลมชดเชยครบถ้วนแล้ว (100% Accounted)');
    });

    it('renders standard "✓ ยืนยันรับเข้าคลังสมบูรณ์" button when goods are still pending', () => {
      const pendingPO = {
        id: 'PO-PENDING-001',
        poNo: 'PO-PD-2026-002',
        status: 'ORDERED_PENDING_DELIVERY',
        department: 'PD',
        items: [
          {
            productId: 'PROD-PD-001',
            code: 'PD-OIL-068',
            name: 'น้ำมันไฮดรอลิกอุตสาหกรรม',
            orderedQty: 5,
            accumulatedReceived: 0,
            receivedQty: 0,
            refundedQty: 0,
            purchaseUnit: 'ถัง',
            price: 14500
          }
        ]
      };

      const html = renderToStaticMarkup(
        <ReceivingModal po={pendingPO} isOpen={true} />
      );

      expect(html).not.toContain('ยืนยันปิดงานใบสั่งซื้อ (Finalize PO)');
    });
  });

  describe('3. storageService.finalizePO & State Machine Integrity', () => {
    it('storageService.finalizePO canonically sets COMPLETED, workflowStatus, isCompleted, isClosed, and clears claim flags', () => {
      const po = {
        id: 'PO-FINALIZE-TEST',
        poNo: 'PO-PD-2026-099',
        status: 'PARTIALLY_RECEIVED_IN_CLAIM',
        department: 'PD',
        isInClaim: true,
        hasDispute: true,
        claimStatus: 'IN_CLAIM',
        items: [
          { productId: 'PROD-01', orderedQty: 5, receivedQty: 4, refundedQty: 1 }
        ]
      };

      storageService.savePOs([po]);
      const updated = storageService.finalizePO('PO-FINALIZE-TEST', { completedAt: '2026-09-13T10:00:00.000Z' });

      expect(updated).toBeDefined();
      expect(updated.status).toBe('COMPLETED');
      expect(updated.workflowStatus).toBe('COMPLETED');
      expect(updated.isCompleted).toBe(true);
      expect(updated.isClosed).toBe(true);
      expect(updated.isInClaim).toBe(false);
      expect(updated.hasDispute).toBe(false);
      expect(updated.claimStatus).toBe('RESOLVED');
      expect(updated.completedAt).toBe('2026-09-13T10:00:00.000Z');

      // Accessible via getCompletedPOsByMonth
      const completedList = storageService.getCompletedPOsByMonth('2026-09');
      expect(completedList.some(p => p.id === 'PO-FINALIZE-TEST')).toBe(true);
    });

    it('recordGoodsReceipt respects statusOverride=COMPLETED and allReceived on fully accounted PO', async () => {
      const po = {
        id: 'PO-GRN-ACCOUNTED-01',
        poNo: 'PO-PD-2026-001',
        status: 'PARTIALLY_RECEIVED_IN_CLAIM',
        department: 'PD',
        items: [
          {
            productId: 'P1',
            name: 'Item 1',
            orderedQty: 5,
            receivedQty: 4,
            accumulatedReceived: 4,
            refundedQty: 1,
            claimResolution: 'REFUND'
          },
          {
            productId: 'P2',
            name: 'Item 2',
            orderedQty: 5,
            receivedQty: 5,
            accumulatedReceived: 5,
            refundedQty: 0
          }
        ]
      };

      storageService.savePOs([po]);

      const res = await recordGoodsReceipt('PO-GRN-ACCOUNTED-01', {
        grnNumber: 'GRN-PO-PD-2026-001-02',
        round: 2,
        statusOverride: 'COMPLETED',
        receivingItems: [
          { productId: 'P1', goodQty: 0, damagedQty: 0, shortageQty: 0 },
          { productId: 'P2', goodQty: 0, damagedQty: 0, shortageQty: 0 }
        ]
      });

      expect(res.po.status).toBe('COMPLETED');
      expect(res.po.hasDispute).toBe(false);
      expect(res.po.isInClaim).toBe(false);
      expect(res.po.items[0].shortageQty).toBe(0);
      expect(res.po.items[1].shortageQty).toBe(0);
    });
  });
});
