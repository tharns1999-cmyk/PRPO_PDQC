import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReceivingModal from '../src/views/inventory/ReceivingModal';
import { storageService } from '../src/services/storageService';

describe('ReceivingModal Clean Workspace & UI/UX Overhaul', () => {
  const basePO = {
    id: 'PO-TEST-001',
    poNo: 'PO-PD-2026-001',
    status: 'ORDERED_PENDING_DELIVERY',
    department: 'PD',
    vendorName: 'บริษัท เคมีคอล ซัพพลาย จำกัด',
    items: [
      {
        productId: 'PROD-01',
        code: 'OIL-HYD-68',
        name: 'น้ำมันไฮดรอลิกเกรด 68 (200L)',
        orderedQty: 10,
        purchaseQty: 10,
        receivedQty: 0,
        purchaseUnit: 'ถัง',
        price: 2500
      }
    ]
  };

  beforeEach(() => {
    storageService.resetData();
  });

  it('1. Renders clean workspace without purple banner or dev jargon', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // No purple banner
    expect(html).not.toContain('ระบบตรวจรับบางส่วน &amp; แยกคลังสินค้าอัตโนมัติ');
    expect(html).not.toContain('acceptedQty &lt; orderedQty');
    expect(html).not.toContain('PARTIALLY_RECEIVED_IN_CLAIM');
    expect(html).not.toContain('WAITING_DELIVERY_ROUND_2');

    // Title and Header
    expect(html).toContain('ตรวจรับพัสดุเข้าคลัง (Goods Receipt / GRN)');
    expect(html).toContain('PO-PD-2026-001');
    expect(html).toContain('บริษัท เคมีคอล ซัพพลาย จำกัด');
    expect(html).toContain('กรอกรับครบทุกรายการ');
    expect(html).toContain('ยกเลิกและย้อนกลับ');
  });

  it('2. Renders compact table with 6 columns: สินค้า, สั่งมา, รับแล้ว, ตรวจรับรอบนี้, ชำรุด/NG, สถานะ / การจัดการ', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // Table headers
    expect(html).toContain('สินค้า');
    expect(html).toContain('สั่งมา');
    expect(html).toContain('รับแล้ว');
    expect(html).toContain('ตรวจรับรอบนี้');
    expect(html).toContain('ชำรุด/NG');
    expect(html).toContain('สถานะ / การจัดการ');

    // Product info
    expect(html).toContain('OIL-HYD-68');
    expect(html).toContain('น้ำมันไฮดรอลิกเกรด 68 (200L)');
    expect(html).toContain('10'); // orderedQty

    // By default when full quantity is receivable, badge is green "ครบสมบูรณ์"
    expect(html).toContain('ครบสมบูรณ์');
  });

  it('3. Renders emerald action button "[ ✓ ยืนยันรับเข้าคลังสมบูรณ์ ]" when 100% fully received', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // Emerald button
    expect(html).toContain('✓ ยืนยันรับเข้าคลังสมบูรณ์');
    expect(html).toContain('bg-emerald-600');
    expect(html).not.toContain('bg-rose-600');
  });

  it('4. Renders compact note & photos in 2-column grid layout', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    expect(html).toContain('หมายเหตุการตรวจรับ');
    expect(html).toContain('ภาพถ่ายพัสดุ / ใบปะหน้ากล่อง');
    expect(html).toContain('+ เพิ่มไฟล์');
  });

  it('5. Renders summary status badge with clean human language', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    expect(html).toContain('ตรวจรับครบถ้วนสมบูรณ์ — บันทึกรับเข้าสต็อกและปิดเอกสาร PO');
    expect(html).toContain('รับเข้าสต็อก:');
  });

  it('6. Demotes Auto-fill helper from Primary CTA to Ghost Utility Action (eliminating dual green button ambiguity)', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // Header Auto-fill helper is Ghost utility
    expect(html).toContain('⚡ กรอกรับครบทุกรายการ');
    expect(html).toContain('text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200/80');

    // Solid emerald button bg-emerald-600 is exclusively for bottom confirmation button
    expect(html).toContain('✓ ยืนยันรับเข้าคลังสมบูรณ์');
    expect(html).not.toContain('bg-emerald-700/90');
  });

  it('7. Layout separation: Status banner has mb-4 and renders accepted item counter cleanly, footer has "ยกเลิกและย้อนกลับ"', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // Status banner separation & clean layout
    expect(html).toContain('w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-800 text-xs font-medium mb-4');
    expect(html).toContain('10 รายการ');

    // Clarified exit button in footer
    expect(html).toContain('ยกเลิกและย้อนกลับ');
    expect(html).toContain('text-slate-600 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-xs font-semibold');
  });
});
