import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PODetailsModal from '../src/components/po/PODetailsModal.jsx';
import { storageService } from '../src/services/storageService.js';

describe('PODetailsModal Modern SaaS UX/UI Overhaul', () => {
  const samplePO = {
    id: 'PO-TEST-MODERN-001',
    poNo: 'PO-PD-2026-088',
    status: 'IN_DELIVERY',
    department: 'PD',
    vendorName: 'บริษัท อุตสาหกรรม เคมีคอล จำกัด',
    purchaseChannel: 'ONLINE',
    issueDate: '12/09/2026',
    hasVat: true,
    items: [
      {
        productId: 'PROD-01',
        code: 'OIL-VG-68',
        name: 'น้ำมันไฮดรอลิกเกรด 68 (200L)',
        orderedQty: 5,
        purchaseQty: 5,
        receivedQty: 2,
        purchaseUnit: 'ถัง',
        price: 2800,
        storePlatform: 'Shopee',
        actualStoreName: '3M Official Store',
        productUrl: 'https://shopee.co.th/product/123/456'
      }
    ]
  };

  const operationalRole = {
    id: 'REQUESTER_PD',
    roleId: 'REQUESTER_PD',
    role: 'requester',
    level: 1,
    department: 'PD',
    canReceiveGoods: true
  };

  beforeEach(() => {
    storageService.resetData();
  });

  it('1. Renders Slim Stepper with height <= h-8 and connected progress indicators', () => {
    const html = renderToStaticMarkup(
      <PODetailsModal selectedPO={samplePO} currentRole={operationalRole} onClose={() => {}} />
    );

    // Slim stepper container with h-8
    expect(html).toContain('h-8 bg-slate-50 border border-slate-200/80 rounded-xl px-3');
    // Steps
    expect(html).toContain('ออก PO');
    expect(html).toContain('สั่งซื้อแล้ว');
    expect(html).toContain('กำลังส่ง');
    expect(html).toContain('รับบางส่วน');
    expect(html).toContain('รับครบ');
    expect(html).toContain('ปิด PO');
  });

  it('2. Kills the Table Desert: Renders High-Density Compact Item Cards', () => {
    const html = renderToStaticMarkup(
      <PODetailsModal selectedPO={samplePO} currentRole={operationalRole} onClose={() => {}} />
    );

    // Header of items section
    expect(html).toContain('รายการสินค้าที่สั่งซื้อ');
    expect(html).toContain('1 รายการ');

    // SKU badge & item name
    expect(html).toContain('OIL-VG-68');
    expect(html).toContain('น้ำมันไฮดรอลิกเกรด 68 (200L)');

    // Platform tag & store link
    expect(html).toContain('Shopee');
    expect(html).toContain('3M Official Store');
    expect(html).toContain('เปิดร้านค้า');

    // Compact grouped numbers
    expect(html).toContain('สั่ง:');
    expect(html).toContain('รับแล้ว:');
    expect(html).toContain('รวม');
    expect(html).toContain('14,000.00');
  });

  it('3. Replaces Harsh Black Total Bar with Clean Right-aligned Financial Summary', () => {
    const html = renderToStaticMarkup(
      <PODetailsModal selectedPO={samplePO} currentRole={operationalRole} onClose={() => {}} />
    );

    // Harsh black bar is removed
    expect(html).not.toContain('bg-slate-800 px-4 py-3 flex items-center justify-between');

    // Clean Financial Summary with emerald box for Grand Total
    expect(html).toContain('รวมมูลค่าสินค้า (Subtotal):');
    expect(html).toContain('ภาษีมูลค่าเพิ่ม 7% (VAT 7%):');
    expect(html).toContain('ยอดเงินรวมสุทธิ (Grand Total):');
    expect(html).toContain('bg-emerald-50/80 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-1.5');
    expect(html).toContain('14,980.00'); // 14,000 + 7% VAT (980) = 14,980
  });

  it('4. Prioritizes Action Buttons in Footer: Ghost Close, Subtle Cancel, Outline Claim, and Solid Primary Receive', () => {
    const html = renderToStaticMarkup(
      <PODetailsModal selectedPO={samplePO} currentRole={operationalRole} onClose={() => {}} />
    );

    // Left: Ghost Close button
    expect(html).toContain('✕ ปิดหน้าต่าง');

    // Center: Subtle red Cancel PO
    expect(html).toContain('ยกเลิก PO');
    expect(html).toContain('text-slate-400 hover:text-rose-600');

    // Right: Secondary Outline Claim / Dispute button
    expect(html).toContain('🚨 แจ้งปัญหา / ติดตามร้าน');
    expect(html).toContain('border border-rose-200 text-rose-700 bg-rose-50/60');

    // Right: Primary Solid Receive button
    expect(html).toContain('📥 บันทึกตรวจรับสินค้า (+IN) ➔');
    expect(html).toContain('bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl');
  });

  it('5. View-Swapping / Dedicated Mode: Renders dedicated Claim View without duplicate action buttons', () => {
    const html = renderToStaticMarkup(
      <PODetailsModal selectedPO={samplePO} currentRole={operationalRole} onClose={() => {}} initialView="CLAIM" />
    );

    // Dedicated Header with Back to PO button
    expect(html).toContain('← กลับไปหน้า PO');
    expect(html).toContain('แจ้งปัญหา / รายงานเคลมสินค้า');

    // Claim form fields
    expect(html).toContain('หัวข้อปัญหา');
    expect(html).toContain('รายละเอียดปัญหา');
    expect(html).toContain('+ อัปโหลดรูปภาพหลักฐาน');

    // Dedicated single footer
    expect(html).toContain('← ยกเลิกและย้อนกลับ');
    expect(html).toContain('⚠️ ยืนยันส่งเรื่องแจ้งเคลมไปยังจัดซื้อ');

    // No duplicate buttons or main PO details in claim mode
    expect(html).not.toContain('บันทึกตรวจรับสินค้า (+IN)');
  });
});
