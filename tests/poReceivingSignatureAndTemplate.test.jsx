import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintablePO, { formatThaiDateTime, formatDocDateTime } from '../src/components/po/PrintablePO';
import POPrintTemplate from '../src/components/procurement/POPrintTemplate';
import PODocumentModal from '../src/views/procurement/PODocumentModal';
import { storageService } from '../src/services/storageService';
import { recordGoodsReceipt } from '../src/context/ProcurementContext';
import { workflowEngine } from '../src/services/workflowEngine';

describe('PO Document Template & Receiving Signature Dynamic Rendering (Column 4)', () => {
  beforeEach(() => {
    storageService.resetData();
    storageService.saveProducts([
      { id: 'PROD-01', code: 'P01', name: 'Hydraulic Oil', stockBalance: 20, unit: 'ถัง' }
    ]);
  });

  describe('1. Thai Date-Time Formatter (formatThaiDateTime & formatDocDateTime)', () => {
    it('formats ISO 8601 strings into "DD/MM/YYYY เวลา HH:mm น."', () => {
      const iso = '2026-09-12T10:15:00.000Z';
      const formatted = formatThaiDateTime(iso);
      expect(formatted).toMatch(/^\d{2}\/\d{2}\/2026 เวลา \d{2}:\d{2} น\.$/);
      expect(formatDocDateTime(iso)).toMatch(/^วันที่ \d{2}\/\d{2}\/2026 เวลา \d{2}:\d{2} น\.$/);
    });

    it('converts Buddhist Era year (>2400) to Christian Era year (2026)', () => {
      const thaiDate = '12/09/2569 เวลา 10:15 น.';
      const formatted = formatThaiDateTime(thaiDate);
      expect(formatted).toBe('12/09/2026 เวลา 10:15 น.');
      expect(formatDocDateTime(thaiDate)).toBe('วันที่ 12/09/2026 เวลา 10:15 น.');
    });

    it('handles date-only strings gracefully', () => {
      const dateOnly = '12/09/2026';
      const formatted = formatThaiDateTime(dateOnly);
      expect(formatted).toBe('12/09/2026');
      expect(formatDocDateTime(dateOnly)).toBe('วันที่ 12/09/2026');
    });

    it('returns placeholder dots when input is null, undefined, or empty', () => {
      expect(formatThaiDateTime(null)).toBe('..... / ..... / .........');
      expect(formatThaiDateTime('')).toBe('..... / ..... / .........');
      expect(formatThaiDateTime('-')).toBe('..... / ..... / .........');
      expect(formatDocDateTime(null)).toBe('วันที่ ..... / ..... / .........');
      expect(formatDocDateTime('')).toBe('วันที่ ..... / ..... / .........');
    });
  });

  describe('2. Bridge Re-exports Verification', () => {
    it('POPrintTemplate exports PrintablePO and format utilities', () => {
      expect(POPrintTemplate).toBeDefined();
      expect(POPrintTemplate).toBe(PrintablePO);
    });

    it('PODocumentModal exports PODetailsModal', () => {
      expect(PODocumentModal).toBeDefined();
    });
  });

  describe('3. Receiving Metadata Attachment in Data Layer', () => {
    it('recordGoodsReceipt attaches receivingInfo on 100% completed receiving', async () => {
      const poId = 'PO-TEST-REC-01';
      storageService.savePOs([
        {
          id: poId,
          poNo: poId,
          status: 'ORDERED_PENDING_DELIVERY',
          department: 'PD',
          items: [
            { productId: 'PROD-01', code: 'P01', name: 'Hydraulic Oil', orderedQty: 5, receivedQty: 0, price: 1000 }
          ]
        }
      ]);

      const grnPayload = {
        grnNumber: 'GRN-PO-TEST-REC-01-01',
        round: 1,
        receivedDate: '12/09/2026 10:15:00',
        receivedBy: 'คุณวิชัย สุขใจ (Warehouse Supervisor)',
        receiverSignature: '/signatures/receiver-wichai.png',
        receivingInfo: {
          receiverName: 'คุณวิชัย สุขใจ',
          receiverSignature: '/signatures/receiver-wichai.png',
          receivedAt: '2026-09-12T10:15:00.000Z'
        },
        receivingItems: [
          { productId: 'PROD-01', code: 'P01', name: 'Hydraulic Oil', receivedThisTime: 5, goodQty: 5, damagedQty: 0, shortageQty: 0 }
        ]
      };

      const result = await recordGoodsReceipt(poId, grnPayload);
      expect(result.success).toBe(true);
      expect(result.po.status).toBe('COMPLETED');
      expect(result.po.receivingInfo).toBeDefined();
      expect(result.po.receivingInfo.receiverName).toBe('คุณวิชัย สุขใจ');
      expect(result.po.receivingInfo.receiverSignature).toBe('/signatures/receiver-wichai.png');
      expect(result.po.receivingInfo.receivedAt).toBe('2026-09-12T10:15:00.000Z');
    });

    it('workflowEngine.receiveGoods sets receivingInfo with timestamp and signature', async () => {
      const poId = 'PO-TEST-WF-01';
      storageService.savePOs([
        {
          id: poId,
          poNo: poId,
          status: 'APPROVED',
          department: 'PD',
          items: [
            { productId: 'PROD-01', code: 'P01', name: 'Hydraulic Oil', qty: 2, price: 500 }
          ]
        }
      ]);

      const user = {
        name: 'คุณสมชาย มุ่งมั่น',
        employeeName: 'คุณสมชาย มุ่งมั่น',
        signature: '/signatures/somchai.png',
        title: 'Asst. Manager'
      };

      const po = await workflowEngine.receiveGoods(poId, [{ productId: 'PROD-01', receivedThisTime: 2 }], user, 'ตรวจรับครบถ้วน');
      expect(po.receivingInfo).toBeDefined();
      expect(po.receivingInfo.receiverName).toBe('คุณสมชาย มุ่งมั่น');
      expect(po.receivingInfo.receiverSignature).toBe('/signatures/somchai.png');
      expect(po.receivingInfo.receivedAt).toBeDefined();
    });
  });

  describe('4. PrintablePO UI Component Rendering (Column 4 Receiver Signature)', () => {
    it('renders empty dot placeholders when PO is not yet received', () => {
      const draftPO = {
        id: 'PO-DRAFT-01',
        poNo: 'PO-DRAFT-01',
        status: 'ORDERED_PENDING_DELIVERY',
        department: 'PD',
        items: [{ name: 'Item A', qty: 2, price: 100 }],
        createdBy: 'คุณวิชัย สุขใจ'
      };

      const html = renderToStaticMarkup(<PrintablePO po={draftPO} />);
      
      // Column headers
      expect(html).toContain('ผู้ขอซื้อ');
      expect(html).toContain('ผู้ทบทวน');
      expect(html).toContain('ผู้อนุมัติ');
      expect(html).toContain('ผู้ตรวจรับ / บันทึกสต็อก');

      // Column 4 placeholder
      expect(html).toContain('( ........................................... )');
      expect(html).toContain('วันที่ ..... / ..... / .........');
    });

    it('renders digital signature, dynamic name and formatted Thai date-time when PO has receivingInfo', () => {
      const completedPO = {
        id: 'PO-COMPLETED-01',
        poNo: 'PO-COMPLETED-01',
        status: 'COMPLETED',
        department: 'PD',
        receivingInfo: {
          receiverName: 'คุณสมศักดิ์ คลังสินค้า',
          receiverSignature: '/signatures/somsak.png',
          receivedAt: '2026-09-12T10:15:00.000Z'
        },
        items: [{ name: 'Item A', qty: 2, price: 100 }],
        createdBy: 'คุณวิชัย สุขใจ',
        reviewerName: 'คุณสมชาย มุ่งมั่น',
        reviewedAt: '2026-09-10T08:00:00.000Z',
        approvedBy: 'คุณประเสริฐ ยิ่งยง',
        approvedAt: '2026-09-11T09:00:00.000Z'
      };

      const html = renderToStaticMarkup(<PrintablePO po={completedPO} />);

      // Verify Column 4 rendered content
      expect(html).toContain('( คุณสมศักดิ์ คลังสินค้า )');
      expect(html).not.toContain('( ........................................... )');

      // Verify digital signature img
      expect(html).toContain('src="/signatures/somsak.png"');
      expect(html).toContain('alt="Receiver Signature"');

      // Verify date-time formatting in Column 4
      const expectedFormattedDate = formatThaiDateTime('2026-09-12T10:15:00.000Z');
      expect(html).toContain(`วันที่ ${expectedFormattedDate}`);

      // Verify first 3 columns remain intact
      expect(html).toContain('ผู้ขอซื้อ');
      expect(html).toContain('ผู้ทบทวน');
      expect(html).toContain('ผู้อนุมัติ');
      expect(html).toContain('คุณวิชัย สุขใจ');
      expect(html).toContain('คุณสมชาย มุ่งมั่น');
      expect(html).toContain('คุณประเสริฐ ยิ่งยง');
    });

    it('renders fallback receiver name and signature if receivingInfo has partial data but status is COMPLETED', () => {
      const legacyCompletedPO = {
        id: 'PO-LEGACY-COMPLETED',
        poNo: 'PO-LEGACY-COMPLETED',
        status: 'COMPLETED',
        department: 'PD',
        receivingInfo: {
          receiverName: 'คุณวิชัย สุขใจ',
          receiverSignature: '/signatures/receiver-default.png',
          receivedAt: '2026-09-12T10:15:00.000Z'
        },
        items: [{ name: 'Item A', qty: 2, price: 100 }],
        createdBy: 'คุณวิชัย สุขใจ'
      };

      const html = renderToStaticMarkup(<PrintablePO po={legacyCompletedPO} />);

      // Falls back to receiver name '( คุณวิชัย สุขใจ )'
      expect(html).toContain('( คุณวิชัย สุขใจ )');
      
      // Default signature
      expect(html).toContain('src="/signatures/receiver-default.png"');
      expect(html).toContain('alt="Receiver Signature"');
    });
  });
});
