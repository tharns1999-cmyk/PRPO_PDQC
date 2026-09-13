import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { storageService } from '../src/services/storageService';
import PODetailsModal from '../src/components/po/PODetailsModal';
import ReceivingModal from '../src/views/inventory/ReceivingModal';

describe('Enterprise Dual-UOM Engine & Stock Movement Pipeline', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. Dual-UOM Master Matrix & Lookup Engine', () => {
    it('accurately resolves PD-OIL-068 multi-UOM bulk drum to liter conversion', () => {
      const uom = storageService.getUomConversion('PD-OIL-068');
      expect(uom.product).toBeDefined();
      expect(uom.purchaseUom).toBe('ถัง (200L)');
      expect(uom.baseUom).toBe('ลิตร');
      expect(uom.conversionRatio).toBe(200);
      expect(uom.purchaseUnitPrice).toBe(14500);
      expect(uom.baseUnitCost).toBe(72.50);
    });

    it('accurately resolves standard 1:1 UOM for PD-BOX-002', () => {
      const uom = storageService.getUomConversion('PD-BOX-002');
      expect(uom.product).toBeDefined();
      expect(uom.purchaseUom).toBe('ใบ');
      expect(uom.baseUom).toBe('ใบ');
      expect(uom.conversionRatio).toBe(1);
      expect(uom.purchaseUnitPrice).toBe(15);
      expect(uom.baseUnitCost).toBe(15);
    });

    it('Case F: safely defaults to ratio 1 when conversionRatio is missing, null, 0, or negative', () => {
      const missingUom = storageService.getUomConversion('NON-EXISTENT-ITEM');
      expect(missingUom.conversionRatio).toBe(1);

      const baseQtyZero = storageService.calculateBaseQuantity(10, 0);
      expect(baseQtyZero).toBe(10); // Defaults ratio to 1

      const baseQtyNegative = storageService.calculateBaseQuantity(10, -5);
      expect(baseQtyNegative).toBe(10); // Defaults ratio to 1

      const baseQtyNull = storageService.calculateBaseQuantity(10, null);
      expect(baseQtyNull).toBe(10); // Defaults ratio to 1
    });

    it('satisfies calculation invariants: Base Qty * Base Unit Cost === Purchase Qty * Purchase Unit Price', () => {
      const purchaseQty = 5; // 5 drums
      const uom = storageService.getUomConversion('PD-OIL-068');
      const valuation = storageService.calculateValuation({
        purchaseQty,
        purchaseUnitPrice: uom.purchaseUnitPrice,
        conversionRatio: uom.conversionRatio
      });

      expect(valuation.baseStockQty).toBe(1000); // 5 * 200 = 1,000 Liters
      expect(valuation.baseUnitCost).toBe(72.50); // 14,500 / 200 = 72.50
      expect(valuation.totalValue).toBe(72500.00); // 1000 * 72.50 = 72,500
      expect(valuation.totalValue).toBe(purchaseQty * uom.purchaseUnitPrice);
    });
  });

  describe('2. Sanitization & Valuation Bug Elimination (฿174,000.00 vs ฿34.8M)', () => {
    it('ensures INITIAL-BALANCE of PD-OIL-068 is 2,400 Liters @ ฿72.50 = ฿174,000.00', () => {
      const stockLogs = storageService.getStockLogs();
      const oilInitialLog = stockLogs.find(l => 
        (l.id === 'INIT-PROD-PD-001' || l.documentNo === 'INITIAL-BALANCE') &&
        (l.productId === 'PROD-PD-001' || l.productCode === 'PD-OIL-068')
      );

      expect(oilInitialLog).toBeDefined();
      expect(Number(oilInitialLog.qty)).toBe(2400);
      expect(Number(oilInitialLog.unitPrice)).toBe(72.50);
      expect(Number(oilInitialLog.totalPrice)).toBe(174000);
      // Valuation sanity: strictly NOT ฿34.8M
      expect(Number(oilInitialLog.totalPrice)).not.toBe(34800000);
    });
  });

  describe('3. GRN-to-StockMovement Pipeline & Edge-Case Architecture', () => {
    it('Case A (Standard 1:1 UOM): logs movement for PD-BOX-002 with 1:1 mapping', () => {
      const emitted = storageService.logStockMovements([{
        documentNo: 'GRN-2026-TEST-001',
        poNumber: 'PO-PD-2026-001',
        itemCode: 'PD-BOX-002',
        quantity: 4,
        purchaseUnitPrice: 15,
        conversionRatio: 1,
        purchaseUom: 'ใบ',
        baseUom: 'ใบ'
      }]);

      expect(emitted).toHaveLength(1);
      const log = emitted[0];
      expect(log.documentNo).toBe('GRN-2026-TEST-001');
      expect(log.poNumber).toBe('PO-PD-2026-001');
      expect(log.itemCode).toBe('PD-BOX-002');
      expect(log.quantity).toBe(4);
      expect(log.unitPrice).toBe(15);
      expect(log.totalValue).toBe(60);
    });

    it('Case B (Multi-UOM Bulk to Sub-unit): converts 5 drums to +1,000 Liters @ ฿72.50 = ฿72,500', () => {
      const uom = storageService.getUomConversion('PD-OIL-068');
      const purchaseQty = 5;
      const baseQty = purchaseQty * uom.conversionRatio; // 1,000
      const baseCost = uom.baseUnitCost; // 72.50

      const emitted = storageService.logStockMovements([{
        documentNo: 'GRN-2026-TEST-002',
        poNumber: 'PO-PD-2026-002',
        itemCode: 'PD-OIL-068',
        quantity: baseQty,
        receivedQty: purchaseQty,
        unitPrice: baseCost,
        totalValue: baseQty * baseCost,
        conversionRatio: uom.conversionRatio,
        purchaseUom: uom.purchaseUom,
        baseUom: uom.baseUom,
        createdAt: new Date().toISOString()
      }]);

      expect(emitted).toHaveLength(1);
      const log = emitted[0];
      expect(log.documentNo).toBe('GRN-2026-TEST-002');
      expect(log.poNumber).toBe('PO-PD-2026-002');
      expect(log.itemCode).toBe('PD-OIL-068');
      expect(log.quantity).toBe(1000); // 1,000 Liters
      expect(log.receivedQty).toBe(5); // 5 drums
      expect(log.unitPrice).toBe(72.50);
      expect(log.totalValue).toBe(72500);
      expect(log.baseUom).toBe('ลิตร');
      expect(log.purchaseUom).toBe('ถัง (200L)');
    });

    it('Case C (Partial Receipts across multiple rounds): emits distinct movements per GRN round', () => {
      // Round 1: 2 drums (+400 Liters)
      const round1 = storageService.logStockMovements([{
        documentNo: 'GRN-PO-PD-003-01',
        poNumber: 'PO-PD-2026-003',
        itemCode: 'PD-OIL-068',
        quantity: 400,
        receivedQty: 2,
        unitPrice: 72.50,
        totalValue: 29000,
        conversionRatio: 200
      }]);

      // Round 2: 3 drums (+600 Liters)
      const round2 = storageService.logStockMovements([{
        documentNo: 'GRN-PO-PD-003-02',
        poNumber: 'PO-PD-2026-003',
        itemCode: 'PD-OIL-068',
        quantity: 600,
        receivedQty: 3,
        unitPrice: 72.50,
        totalValue: 43500,
        conversionRatio: 200
      }]);

      expect(round1[0].documentNo).toBe('GRN-PO-PD-003-01');
      expect(round1[0].quantity).toBe(400);

      expect(round2[0].documentNo).toBe('GRN-PO-PD-003-02');
      expect(round2[0].quantity).toBe(600);

      const logs = storageService.getStockLogs();
      expect(logs.some(l => l.documentNo === 'GRN-PO-PD-003-01' && l.quantity === 400)).toBe(true);
      expect(logs.some(l => l.documentNo === 'GRN-PO-PD-003-02' && l.quantity === 600)).toBe(true);
    });

    it('Case D (Zero-Physical / Refund Finalization): strictly enforces zero phantom movements for quantity 0', () => {
      const logsBefore = storageService.getStockLogs().length;

      const emitted = storageService.logStockMovements([{
        documentNo: 'GRN-2026-ZERO',
        poNumber: 'PO-PD-2026-001',
        itemCode: 'PD-BOX-002',
        quantity: 0, // 0 quantity (resolved via monetary refund)
        unitPrice: 15,
        totalValue: 0
      }]);

      expect(emitted).toHaveLength(0);
      const logsAfter = storageService.getStockLogs().length;
      expect(logsAfter).toBe(logsBefore); // Zero records added
    });

    it('Case E (Damaged / Rejected Goods): zero positive movement when acceptedQty is 0', () => {
      const logsBefore = storageService.getStockLogs().length;

      // Defective goods that were 100% rejected (accepted = 0, damaged = 5)
      const acceptedQty = 0;
      const damagedQty = 5;

      const emitted = storageService.logStockMovements([{
        documentNo: 'GRN-2026-REJECT',
        poNumber: 'PO-PD-2026-004',
        itemCode: 'PD-OIL-068',
        quantity: acceptedQty * 200, // 0
        damagedQty: damagedQty
      }]);

      expect(emitted).toHaveLength(0);
      expect(storageService.getStockLogs().length).toBe(logsBefore);
    });
  });

  describe('4. PO Details Transparency & Refund Badges (UX/UI)', () => {
    it('renders distinct refund badges [รับแล้ว: 4] + [คืนเงินแล้ว: 1 ใบ (ปิดรับ)] in PODetailsModal', () => {
      const mockPO = {
        id: 'PO-TEST-REFUND',
        poNo: 'PO-PD-2026-001',
        status: 'COMPLETED',
        workflowStatus: 'COMPLETED',
        createdAt: '2026-09-01T08:00:00Z',
        vendor: { name: 'Thai Supplier Co.' },
        items: [
          {
            id: 'ITEM-1',
            code: 'PD-BOX-002',
            name: 'กล่องกระดาษลูกฟูก เบอร์ 2',
            actualQty: 5,
            qty: 5,
            purchaseUnit: 'ใบ',
            actualPrice: 15,
            receivedQty: 4,
            refundedQty: 1, // 1 unit refunded
            total: 75
          }
        ]
      };

      const html = renderToStaticMarkup(
        <PODetailsModal
          selectedPO={mockPO}
          currentRole="REQUESTER_PD"
          onClose={() => {}}
        />
      );

      // Verify receipt & refund badge
      expect(html).toContain('รับแล้ว: 4');
      expect(html).toContain('คืนเงินแล้ว: 1 ใบ (ปิดรับ)');
    });

    it('renders Dual-UOM specifications: 5 ถัง (1,000 ลิตร) @ ฿14,500 / ถัง (฿72.50 / ลิตร)', () => {
      const mockPO = {
        id: 'PO-TEST-DUAL-UOM',
        poNo: 'PO-PD-2026-002',
        status: 'PENDING_DELIVERY',
        workflowStatus: 'PENDING_DELIVERY',
        createdAt: '2026-09-01T08:00:00Z',
        vendor: { name: 'Oil Refinery Co.' },
        items: [
          {
            id: 'ITEM-OIL',
            code: 'PD-OIL-068',
            name: 'น้ำมันหล่อลื่นอุตสาหกรรม Drum (200L)',
            actualQty: 5,
            qty: 5,
            purchaseUom: 'ถัง (200L)',
            purchaseUnit: 'ถัง (200L)',
            baseUom: 'ลิตร',
            stockUnit: 'ลิตร',
            conversionRatio: 200,
            actualPrice: 14500,
            receivedQty: 0,
            total: 72500
          }
        ]
      };

      const html = renderToStaticMarkup(
        <PODetailsModal
          selectedPO={mockPO}
          currentRole="REQUESTER_PD"
          onClose={() => {}}
        />
      );

      // Verify Dual-UOM specification display
      expect(html).toContain('5 ถัง (200L)');
      expect(html).toContain('(1,000 ลิตร)');
      expect(html).toContain('฿14,500 / ถัง (200L)');
      expect(html).toContain('(฿72.50 / ลิตร)');
    });
  });
});
