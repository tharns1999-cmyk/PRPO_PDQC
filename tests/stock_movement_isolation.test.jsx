import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';

import { renderToStaticMarkup } from 'react-dom/server';
import StockMovementTable from '../src/components/stock/StockMovementTable';
import { StockMovementModal } from '../src/views/inventory/StockMovementModal';
import { warehouseService } from '../src/services/warehouseService';
import { storageService } from '../src/services/storageService';

describe('Domain Suite: Stock Movement Isolation & Strict Department Scoping (Duplicate Code "3" Guard)', () => {
  const pdProductCode3 = {
    id: 'PROD-PD-003',
    code: '3',
    sku: '3',
    name: 'สารเคมีทำความสะอาดระบบผลิต (PD)',
    department: 'PD',
    category: 'PD',
    stockBalance: 100,
    reorderPoint: 20,
    stockUnit: 'ลิตร',
    unit: 'ลิตร',
    price: 250,
    status: 'ACTIVE',
    isActive: true
  };

  const qcProductCode3 = {
    id: 'PROD-QC-003',
    code: '3',
    sku: '3',
    name: 'strip วัดคลอรีน',
    department: 'QC',
    category: 'QC',
    stockBalance: 50,
    reorderPoint: 10,
    stockUnit: 'กล่อง',
    unit: 'กล่อง',
    price: 320,
    status: 'ACTIVE',
    isActive: true
  };

  const mockLogs = [
    // PD Logs for Code 3
    {
      id: 'LOG-PD-01',
      productId: 'PROD-PD-003',
      productCode: '3',
      code: '3',
      name: 'สารเคมีทำความสะอาดระบบผลิต (PD)',
      department: 'PD',
      type: 'IN',
      documentNo: 'GRN-PO-PD-2026-003-01',
      poNo: 'PO-PD-2026-003',
      quantity: 20,
      qty: 20,
      balanceAfter: 100,
      balance: 100,
      unit: 'ลิตร',
      actorName: 'สิรภัทร แจ่มมิน',
      user: 'สิรภัทร แจ่มมิน',
      notes: 'รับของเข้าคลังฝ่ายผลิต (PD)',
      timestamp: '2026-09-15T08:30:00.000Z',
      date: '2026-09-15T08:30:00.000Z'
    },
    {
      id: 'LOG-PD-02',
      productId: 'PROD-PD-003',
      productCode: '3',
      code: '3',
      name: 'สารเคมีทำความสะอาดระบบผลิต (PD)',
      department: 'PD',
      type: 'OUT',
      documentNo: 'ISSUE-PD-2026-001',
      poNo: '-',
      quantity: 5,
      qty: 5,
      balanceAfter: 95,
      balance: 95,
      unit: 'ลิตร',
      actorName: 'สิรภัทร แจ่มมิน',
      user: 'สิรภัทร แจ่มมิน',
      notes: 'เบิกจ่ายล้างถังหมักในสายการผลิต',
      timestamp: '2026-09-15T10:00:00.000Z',
      date: '2026-09-15T10:00:00.000Z'
    },

    // QC Logs for Code 3 (Strip วัดคลอรีน)
    {
      id: 'LOG-QC-01',
      productId: 'PROD-QC-003',
      productCode: '3',
      code: '3',
      name: 'strip วัดคลอรีน',
      department: 'QC',
      type: 'IN',
      documentNo: 'GRN-PO-QC-2026-003-01',
      poNo: 'PO-QC-2026-003',
      quantity: 15,
      qty: 15,
      balanceAfter: 50,
      balance: 50,
      unit: 'กล่อง',
      actorName: 'วิภาดา ตรวจสอบ',
      user: 'วิภาดา ตรวจสอบ',
      notes: 'ตรวจรับ strip วัดคลอรีน สำหรับแล็บ QC',
      timestamp: '2026-09-15T09:00:00.000Z',
      date: '2026-09-15T09:00:00.000Z'
    },
    {
      id: 'LOG-QC-02',
      productId: 'PROD-QC-003',
      productCode: '3',
      code: '3',
      name: 'strip วัดคลอรีน',
      department: 'QC',
      type: 'OUT',
      documentNo: 'ISSUE-QC-2026-001',
      poNo: '-',
      quantity: 2,
      qty: 2,
      balanceAfter: 48,
      balance: 48,
      unit: 'กล่อง',
      actorName: 'วิภาดา ตรวจสอบ',
      user: 'วิภาดา ตรวจสอบ',
      notes: 'เบิกใช้ตรวจสอบน้ำบริสุทธิ์ประจำกะ',
      timestamp: '2026-09-15T11:15:00.000Z',
      date: '2026-09-15T11:15:00.000Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    storageService.resetData();
    storageService.saveProducts([pdProductCode3, qcProductCode3]);
    storageService.saveStockLogs(mockLogs);
  });

  it('1. Opening Stock Card for PD Code "3" displays ONLY PD movement logs and completely hides QC logs', () => {
    const html = renderToStaticMarkup(
      <StockMovementTable
        product={pdProductCode3}
        stockLogs={mockLogs}
        initialFilterType="ALL"
      />
    );

    // Verify PD logs are displayed
    expect(html).toContain('GRN-PO-PD-2026-003-01');
    expect(html).toContain('ISSUE-PD-2026-001');
    expect(html).toContain('รับของเข้าคลังฝ่ายผลิต (PD)');
    expect(html).toContain('เบิกจ่ายล้างถังหมักในสายการผลิต');

    // CRITICAL: Ensure NO QC logs or descriptions contaminate PD Stock Card
    expect(html).not.toContain('GRN-PO-QC-2026-003-01');
    expect(html).not.toContain('ISSUE-QC-2026-001');
    expect(html).not.toContain('strip วัดคลอรีน');
    expect(html).not.toContain('ตรวจรับ strip วัดคลอรีน');
    expect(html).not.toContain('วิภาดา ตรวจสอบ');
  });

  it('2. Opening Stock Card for QC Code "3" displays ONLY QC movement logs and completely hides PD logs', () => {
    const html = renderToStaticMarkup(
      <StockMovementTable
        product={qcProductCode3}
        stockLogs={mockLogs}
        initialFilterType="ALL"
      />
    );

    // Verify QC logs are displayed
    expect(html).toContain('GRN-PO-QC-2026-003-01');
    expect(html).toContain('ISSUE-QC-2026-001');
    expect(html).toContain('ตรวจรับ strip วัดคลอรีน สำหรับแล็บ QC');
    expect(html).toContain('เบิกใช้ตรวจสอบน้ำบริสุทธิ์ประจำกะ');

    // CRITICAL: Ensure NO PD logs contaminate QC Stock Card
    expect(html).not.toContain('GRN-PO-PD-2026-003-01');
    expect(html).not.toContain('ISSUE-PD-2026-001');
    expect(html).not.toContain('สารเคมีทำความสะอาดระบบผลิต (PD)');
    expect(html).not.toContain('รับของเข้าคลังฝ่ายผลิต (PD)');
    expect(html).not.toContain('เบิกจ่ายล้างถังหมักในสายการผลิต');
  });

  it('3. Enforces User Department Protection Guard for single-department user (PD Requester)', () => {
    const pdUser = {
      id: 'USER-PD-01',
      name: 'สิรภัทร แจ่มมิน',
      role: 'requester',
      department: 'PD'
    };

    // Even if an aberrant log from QC has corrupted productId matching PD's product id,
    // the User Department Guard strictly blocks the QC log
    const corruptedLogs = [
      ...mockLogs,
      {
        id: 'LOG-ABERRANT-01',
        productId: 'PROD-PD-003', // Deliberately corrupted ID pointing to PD
        productCode: '3',
        name: 'strip วัดคลอรีน ปลอมปน',
        department: 'QC', // But department is QC
        type: 'IN',
        documentNo: 'GRN-PO-QC-CORRUPTED',
        poNo: 'PO-QC-CORRUPTED',
        qty: 99,
        timestamp: '2026-09-15T12:00:00.000Z'
      }
    ];

    const html = renderToStaticMarkup(
      <StockMovementTable
        product={pdProductCode3}
        stockLogs={corruptedLogs}
        currentUser={pdUser}
      />
    );

    // Should display valid PD logs
    expect(html).toContain('GRN-PO-PD-2026-003-01');
    expect(html).toContain('ISSUE-PD-2026-001');

    // Aberrant cross-department log MUST be filtered out
    expect(html).not.toContain('GRN-PO-QC-CORRUPTED');
  });

  it('4. Correctly matches legacy logs that lack productId using department + code fallback', () => {
    const legacyLogs = [
      {
        id: 'LEGACY-PD-01',
        // productId missing!
        productCode: '3',
        code: '3',
        name: 'สารเคมีทำความสะอาดระบบผลิต (PD)',
        department: 'PD',
        type: 'IN',
        documentNo: 'GRN-LEGACY-PD-003',
        qty: 10,
        balanceAfter: 50,
        timestamp: '2026-09-14T08:00:00.000Z'
      },
      {
        id: 'LEGACY-QC-01',
        // productId missing!
        productCode: '3',
        code: '3',
        name: 'strip วัดคลอรีน',
        department: 'QC',
        type: 'IN',
        documentNo: 'GRN-LEGACY-QC-003',
        qty: 5,
        balanceAfter: 20,
        timestamp: '2026-09-14T09:00:00.000Z'
      }
    ];

    const htmlPD = renderToStaticMarkup(
      <StockMovementTable
        product={pdProductCode3}
        stockLogs={legacyLogs}
      />
    );

    expect(htmlPD).toContain('GRN-LEGACY-PD-003');
    expect(htmlPD).not.toContain('GRN-LEGACY-QC-003');

    const htmlQC = renderToStaticMarkup(
      <StockMovementTable
        product={qcProductCode3}
        stockLogs={legacyLogs}
      />
    );

    expect(htmlQC).toContain('GRN-LEGACY-QC-003');
    expect(htmlQC).not.toContain('GRN-LEGACY-PD-003');
  });

  it('5. warehouseService.getStockMovementLogs isolates logs for duplicate code "3"', () => {
    const pdResults = warehouseService.getStockMovementLogs(pdProductCode3, mockLogs);
    expect(pdResults.length).toBe(2);
    expect(pdResults.every(l => l.department === 'PD')).toBe(true);
    expect(pdResults.some(l => l.documentNo === 'GRN-PO-PD-2026-003-01')).toBe(true);
    expect(pdResults.some(l => l.documentNo === 'ISSUE-PD-2026-001')).toBe(true);
    expect(pdResults.some(l => l.documentNo.includes('QC'))).toBe(false);

    const qcResults = warehouseService.getStockMovementLogs(qcProductCode3, mockLogs);
    expect(qcResults.length).toBe(2);
    expect(qcResults.every(l => l.department === 'QC')).toBe(true);
    expect(qcResults.some(l => l.documentNo === 'GRN-PO-QC-2026-003-01')).toBe(true);
    expect(qcResults.some(l => l.documentNo === 'ISSUE-QC-2026-001')).toBe(true);
    expect(qcResults.some(l => l.documentNo.includes('PD'))).toBe(false);
  });

  it('6. StockMovementModal view-level wrapper functions identically with strict isolation', () => {
    const html = renderToStaticMarkup(
      <StockMovementModal
        product={pdProductCode3}
        stockLogs={mockLogs}
        initialFilterType="ALL"
      />
    );

    expect(html).toContain('GRN-PO-PD-2026-003-01');
    expect(html).not.toContain('GRN-PO-QC-2026-003-01');
  });
});
