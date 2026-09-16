import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StockMovementTable, { isStockIn, isStockOut } from '../src/components/stock/StockMovementTable';

describe('Stock Movement Type Classifier & Filter Logic', () => {
  describe('Helper functions: isStockIn and isStockOut', () => {
    it('correctly identifies incoming stock movements', () => {
      expect(isStockIn({ type: 'IN', quantity: 10 })).toBe(true);
      expect(isStockIn({ type: 'RECEIVE', quantity: 5 })).toBe(true);
      expect(isStockIn({ type: 'GRN', changeQty: 12 })).toBe(true);
      expect(isStockIn({ type: 'PURCHASE', quantity: 3 })).toBe(true);
      expect(isStockIn({ type: 'ADJUST_IN', quantity: 2 })).toBe(true);
      expect(isStockIn({ type: 'IN_NG', quantity: 1 })).toBe(true);
      expect(isStockIn({ changeQty: 15 })).toBe(true);
      expect(isStockIn({ quantity: 8 })).toBe(true);

      // Negative cases
      expect(isStockIn(null)).toBe(false);
      expect(isStockIn(undefined)).toBe(false);
      expect(isStockIn({ type: 'OUT', quantity: 5 })).toBe(false);
      expect(isStockIn({ type: 'ISSUE', changeQty: -2 })).toBe(false);
      expect(isStockIn({ type: 'DISPATCH', changeQty: -4 })).toBe(false);
    });

    it('correctly identifies outgoing stock movements (ISSUE, OUT, negative quantities)', () => {
      expect(isStockOut({ type: 'OUT', quantity: 5 })).toBe(true);
      expect(isStockOut({ type: 'ISSUE', changeQty: -2 })).toBe(true);
      expect(isStockOut({ type: 'DISPATCH', quantity: 4 })).toBe(true);
      expect(isStockOut({ type: 'CONSUME', quantity: 1 })).toBe(true);
      expect(isStockOut({ type: 'REDUCE', quantity: 3 })).toBe(true);
      expect(isStockOut({ type: 'ADJUST_OUT', quantity: 2 })).toBe(true);
      expect(isStockOut({ changeQty: -5 })).toBe(true);

      // Negative cases
      expect(isStockOut(null)).toBe(false);
      expect(isStockOut(undefined)).toBe(false);
      expect(isStockOut({ type: 'IN', quantity: 10 })).toBe(false);
      expect(isStockOut({ type: 'GRN', changeQty: 12 })).toBe(false);
      expect(isStockOut({ changeQty: 5 })).toBe(false);
    });
  });

  describe('StockMovementTable Filtering & Rendering', () => {
    const mockProduct = {
      id: 'PROD-001',
      code: 'SKU-001',
      name: 'ถุงมือไนไตรสีฟ้า',
      unit: 'กล่อง',
      balance: 100
    };

    const mockLogs = [
      {
        id: 'LOG-001',
        productId: 'PROD-001',
        type: 'ISSUE',
        changeQty: -2,
        quantity: 2,
        balanceAfter: 98,
        documentNo: 'ISSUE-2026-001',
        referenceDoc: 'REF-ISS-01',
        actorName: 'สมชาย',
        notes: 'เบิกไปใช้งานสายการผลิต 1',
        timestamp: new Date().toISOString()
      },
      {
        id: 'LOG-002',
        productId: 'PROD-001',
        type: 'issue',
        changeQty: -3,
        quantity: 3,
        balanceAfter: 95,
        documentNo: 'ISSUE-2026-002',
        actorName: 'วิชัย',
        notes: 'เบิกเติมแผนก QC',
        timestamp: new Date().toISOString()
      },
      {
        id: 'LOG-003',
        productId: 'PROD-001',
        type: 'GRN',
        changeQty: 12,
        quantity: 12,
        balanceAfter: 107,
        documentNo: 'GRN-PO-2026-001',
        poNo: 'PO-2026-001',
        actorName: 'สมศักดิ์',
        notes: 'รับสินค้าเข้าคลัง',
        timestamp: new Date().toISOString()
      },
      {
        id: 'LOG-004',
        productId: 'PROD-001',
        type: 'IN',
        changeQty: 5,
        quantity: 5,
        balanceAfter: 112,
        documentNo: 'GRN-PO-2026-002',
        poNo: 'PO-2026-002',
        actorName: 'สมศักดิ์',
        notes: 'รับสินค้าเข้าคลังรอบ 2',
        timestamp: new Date().toISOString()
      }
    ];

    it('displays all 4 logs when "ทั้งหมด" (ALL) filter is selected', () => {
      const html = renderToStaticMarkup(
        <StockMovementTable
          product={mockProduct}
          stockLogs={mockLogs}
          initialFilterType="ALL"
        />
      );

      expect(html).toContain('ISSUE-2026-001');
      expect(html).toContain('ISSUE-2026-002');
      expect(html).toContain('GRN-PO-2026-001');
      expect(html).toContain('GRN-PO-2026-002');
    });

    it('displays only OUT/ISSUE logs (2 rows) when "-OUT (เบิกจ่าย)" tab is selected', () => {
      const html = renderToStaticMarkup(
        <StockMovementTable
          product={mockProduct}
          stockLogs={mockLogs}
          initialFilterType="OUT"
        />
      );

      // Should show ISSUE logs
      expect(html).toContain('ISSUE-2026-001');
      expect(html).toContain('ISSUE-2026-002');

      // Should NOT show incoming GRN/IN logs
      expect(html).not.toContain('GRN-PO-2026-001');
      expect(html).not.toContain('GRN-PO-2026-002');

      // Should display quantities formatted with single negative sign
      expect(html).toContain('-2');
      expect(html).toContain('-3');
    });

    it('displays only IN/GRN logs (2 rows) when "+IN (รับเข้า)" tab is selected', () => {
      const html = renderToStaticMarkup(
        <StockMovementTable
          product={mockProduct}
          stockLogs={mockLogs}
          initialFilterType="IN"
        />
      );

      // Should show IN logs
      expect(html).toContain('GRN-PO-2026-001');
      expect(html).toContain('GRN-PO-2026-002');

      // Should NOT show outgoing ISSUE logs
      expect(html).not.toContain('ISSUE-2026-001');
      expect(html).not.toContain('ISSUE-2026-002');

      expect(html).toContain('+12');
      expect(html).toContain('+5');
    });

    it('supports controlled filterType prop with -OUT / +IN string variants', () => {
      const htmlOut = renderToStaticMarkup(
        <StockMovementTable
          product={mockProduct}
          stockLogs={mockLogs}
          filterType="-OUT"
        />
      );

      expect(htmlOut).toContain('ISSUE-2026-001');
      expect(htmlOut).toContain('ISSUE-2026-002');
      expect(htmlOut).not.toContain('GRN-PO-2026-001');

      const htmlIn = renderToStaticMarkup(
        <StockMovementTable
          product={mockProduct}
          stockLogs={mockLogs}
          filterType="+IN"
        />
      );

      expect(htmlIn).not.toContain('ISSUE-2026-001');
      expect(htmlIn).toContain('GRN-PO-2026-001');
      expect(htmlIn).toContain('GRN-PO-2026-002');
    });
  });
});
