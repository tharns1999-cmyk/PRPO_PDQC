/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StockMovementTable, {
  parseLogTimestamp,
  parseLogDate,
  formatDateTimeThai,
  isStockIn,
  isStockOut
} from '../src/components/stock/StockMovementTable';

describe('Stock Movement Log: Unified Timestamp Sorting & Strict OUT Tab Isolation', () => {
  afterEach(() => {
    cleanup();
  });
  describe('parseLogTimestamp & formatDateTimeThai Helpers', () => {
    it('correctly parses Thai BE (พ.ศ. 2569) and CE (ค.ศ. 2026) to identical or correct epoch timestamps', () => {
      // 16/09/2569 11:01 and 16/09/2026 11:01 represent the exact same point in time
      const timeBE = parseLogTimestamp('16/09/2569 11:01');
      const timeCE = parseLogTimestamp('16/09/2026 11:01');
      expect(timeBE).toBeGreaterThan(0);
      expect(timeCE).toBeGreaterThan(0);
      expect(timeBE).toBe(timeCE);

      // ISO format with Thai BE year
      const isoBE = parseLogTimestamp('2569-09-16T04:01:00.000Z');
      const isoCE = parseLogTimestamp('2026-09-16T04:01:00.000Z');
      expect(isoBE).toBe(isoCE);

      // Verify that today (16/09) is strictly greater than yesterday (15/09), even if yesterday has BE year 2569
      const yesterdayBE = parseLogTimestamp('15/09/2569 11:01');
      const todayCE = parseLogTimestamp('16/09/2026 11:01');
      expect(todayCE).toBeGreaterThan(yesterdayBE);
    });

    it('formats dates into unified Thai Buddhist Era (พ.ศ.) representation consistently', () => {
      const formattedFromCE = formatDateTimeThai('2026-09-16T04:01:00.000Z');
      expect(formattedFromCE).toContain('2569');
      expect(formattedFromCE).not.toContain('2026');

      const formattedFromBE = formatDateTimeThai('16/09/2569 11:01');
      expect(formattedFromBE).toContain('2569');
      expect(formattedFromBE).toContain('16/09/2569');
    });
  });

  describe('Unified Descending Sorting (Latest First)', () => {
    const mockProduct = {
      id: 'PROD-SORT-001',
      code: 'SKU-SORT-001',
      name: 'สินค้าทดสอบเรียงลำดับ',
      unit: 'ชิ้น',
      stockBalance: 100,
      department: 'PD'
    };

    it('places newest item (OUT today 16/09/2026) first before older item (IN yesterday 15/09/2569)', () => {
      const logs = [
        {
          id: 'LOG-YESTERDAY-IN',
          productId: 'PROD-SORT-001',
          type: 'IN',
          changeQty: 10,
          quantity: 10,
          balanceAfter: 100,
          documentNo: 'GRN-YESTERDAY-IN',
          actorName: 'สมศักดิ์',
          timestamp: '15/09/2569 10:00' // Yesterday in Thai BE
        },
        {
          id: 'LOG-TODAY-OUT',
          productId: 'PROD-SORT-001',
          type: 'OUT',
          changeQty: -5,
          quantity: 5,
          balanceAfter: 95,
          documentNo: 'ISSUE-TODAY-OUT',
          actorName: 'สิรภัทร',
          timestamp: '16/09/2026 11:01' // Today in CE
        }
      ];

      const { container } = render(
        <StockMovementTable
          product={mockProduct}
          stockLogs={logs}
          initialFilterType="ALL"
          timeFilter="ALL"
        />
      );

      // We look at all rows in tbody since it's rendered in a Portal
      const rows = Array.from(document.body.querySelectorAll('tbody tr'));
      expect(rows.length).toBe(2);

      // ISSUE-TODAY-OUT must appear before GRN-YESTERDAY-IN
      const firstRowText = rows[0].textContent;
      const secondRowText = rows[1].textContent;

      expect(firstRowText).toContain('ISSUE-TODAY-OUT');
      expect(secondRowText).toContain('GRN-YESTERDAY-IN');
    });

    it('correctly sorts multi-day mixed BE and CE logs in chronological descending order', () => {
      const logs = [
        {
          id: 'LOG-1',
          productId: 'PROD-SORT-001',
          type: 'IN',
          documentNo: 'DOC-DAY-10-BE',
          timestamp: '10/09/2569 09:00'
        },
        {
          id: 'LOG-3',
          productId: 'PROD-SORT-001',
          type: 'IN',
          documentNo: 'DOC-DAY-16-CE-LATE',
          timestamp: '2026-09-16T15:00:00.000Z'
        },
        {
          id: 'LOG-2',
          productId: 'PROD-SORT-001',
          type: 'OUT',
          documentNo: 'DOC-DAY-16-BE-EARLY',
          timestamp: '16/09/2569 08:00'
        }
      ];

      const { container } = render(
        <StockMovementTable
          product={mockProduct}
          stockLogs={logs}
          initialFilterType="ALL"
          timeFilter="ALL"
        />
      );

      const rows = Array.from(document.body.querySelectorAll('tbody tr'));
      expect(rows.length).toBe(3);

      expect(rows[0].textContent).toContain('DOC-DAY-16-CE-LATE');
      expect(rows[1].textContent).toContain('DOC-DAY-16-BE-EARLY');
      expect(rows[2].textContent).toContain('DOC-DAY-10-BE');
    });
  });

  describe('Strict -OUT Tab Isolation & Single-Stream Rendering', () => {
    const mockProduct = {
      id: 'PROD-TAB-001',
      code: 'SKU-TAB-001',
      name: 'สินค้าทดสอบแท็บ',
      unit: 'กล่อง',
      stockBalance: 50,
      department: 'PD'
    };

    const mixedLogs = [
      {
        id: 'LOG-IN-1',
        productId: 'PROD-TAB-001',
        type: 'IN',
        changeQty: 20,
        balanceAfter: 60,
        documentNo: 'GRN-PO-001',
        timestamp: '2026-09-14T08:00:00.000Z'
      },
      {
        id: 'LOG-IN-2',
        productId: 'PROD-TAB-001',
        type: 'GRN',
        changeQty: 10,
        balanceAfter: 70,
        documentNo: 'GRN-PO-002',
        timestamp: '2026-09-15T09:00:00.000Z'
      },
      {
        id: 'LOG-OUT-1',
        productId: 'PROD-TAB-001',
        type: 'OUT',
        changeQty: -2,
        quantity: 2,
        balanceAfter: 68,
        documentNo: 'ISSUE-QC-001',
        timestamp: '2026-09-16T10:00:00.000Z'
      },
      {
        id: 'LOG-IN-3',
        productId: 'PROD-TAB-001',
        type: '+IN',
        changeQty: 5,
        balanceAfter: 73,
        documentNo: 'MAN-IN-999',
        timestamp: '2026-09-16T10:30:00.000Z'
      },
      {
        id: 'LOG-OUT-2',
        productId: 'PROD-TAB-001',
        type: 'ISSUE',
        changeQty: -4,
        quantity: 4,
        balanceAfter: 69,
        documentNo: 'ISSUE-QC-002',
        timestamp: '2026-09-16T11:00:00.000Z'
      },
      {
        id: 'LOG-IN-4',
        productId: 'PROD-TAB-001',
        type: 'INITIAL-BALANCE',
        changeQty: 40,
        balanceAfter: 40,
        documentNo: 'INITIAL-BALANCE',
        timestamp: '2026-09-01T00:00:00.000Z'
      }
    ];

    it('shows ONLY OUT items (100% isolated, 0 IN items) when -OUT tab is active', () => {
      const { container } = render(
        <StockMovementTable
          product={mockProduct}
          stockLogs={mixedLogs}
          initialFilterType="OUT"
          timeFilter="ALL"
        />
      );

      const rows = Array.from(document.body.querySelectorAll('tbody tr'));
      
      // Verify tbody row count: exactly 2 tr rows in tbody
      expect(rows.length).toBe(2);
      
      const allText = rows.map(r => r.textContent).join(' ');

      // Must contain OUT items
      expect(allText).toContain('ISSUE-QC-001');
      expect(allText).toContain('ISSUE-QC-002');

      // MUST NOT contain ANY of the 4 IN items
      expect(allText).not.toContain('GRN-PO-001');
      expect(allText).not.toContain('GRN-PO-002');
      expect(allText).not.toContain('MAN-IN-999');
      expect(allText).not.toContain('INITIAL-BALANCE');

      // Check footer pagination summary matches exactly 2 items
      const summaryText = document.body.textContent;
      expect(summaryText).toMatch(/แสดง 1 - 2 จากทั้งหมด 2 รายการ/);
    });

    it('works identically with controlled prop filterType="-OUT"', () => {
      const { container } = render(
        <StockMovementTable
          product={mockProduct}
          stockLogs={mixedLogs}
          filterType="-OUT"
          timeFilter="ALL"
        />
      );

      const rows = Array.from(document.body.querySelectorAll('tbody tr'));
      expect(rows.length).toBe(2);

      const allText = rows.map(r => r.textContent).join(' ');
      expect(allText).toContain('ISSUE-QC-001');
      expect(allText).toContain('ISSUE-QC-002');
      expect(allText).not.toContain('GRN-PO-001');
      expect(allText).not.toContain('GRN-PO-002');
      expect(allText).not.toContain('MAN-IN-999');
      
      expect(document.body.textContent).toMatch(/จากทั้งหมด 2 รายการ/);
    });

    it('shows ONLY IN items when +IN tab is active', () => {
      const { container } = render(
        <StockMovementTable
          product={mockProduct}
          stockLogs={mixedLogs}
          filterType="+IN"
          timeFilter="ALL"
        />
      );

      const rows = Array.from(document.body.querySelectorAll('tbody tr'));
      expect(rows.length).toBe(4);

      const allText = rows.map(r => r.textContent).join(' ');
      expect(allText).toContain('GRN-PO-001');
      expect(allText).toContain('GRN-PO-002');
      expect(allText).toContain('MAN-IN-999');
      expect(allText).toContain('INITIAL-BALANCE');
      expect(allText).not.toContain('ISSUE-QC-001');
      expect(allText).not.toContain('ISSUE-QC-002');
      
      expect(document.body.textContent).toMatch(/จากทั้งหมด 4 รายการ/);
    });
  });
});
