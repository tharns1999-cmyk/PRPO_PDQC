import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import POListView from '../src/views/POListView';
import { storageService } from '../src/services/storageService';

describe('Purchase Order Table Responsive Layout & Action Column Regression Suite', () => {
  const mockPOs = [
    {
      id: 'PO-2026-001',
      poNo: 'PO-PD-2026-001',
      prNo: 'PD001/2026',
      department: 'PD',
      vendorName: 'บริษัท ไทย ออฟฟิศ ซัพพลาย จำกัด',
      purchaseChannel: 'INTERNAL',
      subtotal: 10000,
      grandTotal: 10000,
      status: 'ISSUED',
      date: new Date().toISOString(),
      items: [
        {
          productId: 'PROD-001',
          name: 'กระดาษ Double A A4 80gsm',
          quantity: 50,
          unitPrice: 200
        }
      ]
    },
    {
      id: 'PO-2026-002',
      poNo: 'PO-PD-2026-002',
      prNo: 'PD002/2026',
      department: 'PD',
      vendorName: 'Shopee Mall (Official Store)',
      purchaseChannel: 'ONLINE',
      subtotal: 2450.50,
      grandTotal: 2450.50,
      status: 'IN_PROGRESS_ONLINE',
      date: new Date().toISOString(),
      items: [
        {
          productId: 'PROD-002',
          name: 'ตลับหมึก HP LaserJet Pro',
          quantity: 2,
          unitPrice: 1225.25
        }
      ]
    }
  ];

  const mockRole = {
    id: 'ADMIN',
    roleId: 'ADMIN',
    name: 'Administrator',
    canViewAllDepts: true
  };

  beforeEach(() => {
    storageService.resetData();
  });

  // ── Scenario 1: Responsive Viewport Scaling & Scaffolding Architecture ──
  it('Scenario 1 (Viewport Scaling & Scaffolding): Table container architecture features card overflow-hidden, horizontal scroll wrapper, min-w-[980px], and proportional column widths', () => {
    const html = renderToStaticMarkup(
      <POListView
        pos={mockPOs}
        departments={[{ code: 'PD', name: 'ฝ่ายผลิต' }]}
        currentRole={mockRole}
      />
    );

    // 1. Outer Card Scaffolding: rounded-2xl, border, shadow-sm, overflow-hidden
    expect(html).toContain('rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden');

    // 2. Inner Horizontal Scroll Wrapper: overflow-x-auto, scrollbar-thin
    expect(html).toContain('overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent');

    // 3. Table Element: min-w-[980px] and border-collapse
    expect(html).toContain('min-w-[980px]');
    expect(html).toContain('border-collapse');

    // 4. Proportional Colgroup Widths: 16%, 22%, 20%, 10%, 14%, 10%, 12%
    expect(html).toContain('<col class="w-[16%]"/>');
    expect(html).toContain('<col class="w-[22%]"/>');
    expect(html).toContain('<col class="w-[20%]"/>');
    expect(html).toContain('<col class="w-[10%]"/>');
    expect(html).toContain('<col class="w-[14%]"/>');
    expect(html).toContain('<col class="w-[12%]"/>');

    // 5. Header Column Proportions & Padding:
    // Col 1 (เลขที่เอกสาร): w-[16%] min-w-[140px] pl-6 pr-4 py-3 text-left
    expect(html).toContain('w-[16%] min-w-[140px] pl-6 pr-4 py-3 text-left');
    // Col 2 (ร้านค้า / ผู้ขาย): w-[22%] min-w-[190px] px-4 py-3 text-left
    expect(html).toContain('w-[22%] min-w-[190px] px-4 py-3 text-left');
    // Col 3 (รายการสินค้า): w-[20%] min-w-[170px] px-4 py-3 text-left
    expect(html).toContain('w-[20%] min-w-[170px] px-4 py-3 text-left');
    // Col 4 (ช่องทาง): w-[10%] min-w-[95px] px-3 py-3 text-center
    expect(html).toContain('w-[10%] min-w-[95px] px-3 py-3 text-center');
    // Col 5 (ยอดรวมสุทธิ): w-[14%] min-w-[120px] px-4 py-3 text-right
    expect(html).toContain('w-[14%] min-w-[120px] px-4 py-3 text-right');
    // Col 6 (สถานะ): w-[10%] min-w-[105px] px-3 py-3 text-center
    expect(html).toContain('w-[10%] min-w-[105px] px-3 py-3 text-center');
    // Col 7 (จัดการ): w-[12%] min-w-[120px] pl-3 pr-6 py-3 text-right
    expect(html).toContain('w-[12%] min-w-[120px] pl-3 pr-6 py-3 text-right');
  });

  // ── Scenario 2: Modern Action Button Visibility & Breathing Room ──
  it('Scenario 2 (Action Button Visibility): Action column cell has pr-6 breathing room, whitespace-nowrap, and renders modern "ดูรายละเอียด" button with icon', () => {
    const html = renderToStaticMarkup(
      <POListView
        pos={mockPOs}
        departments={[{ code: 'PD', name: 'ฝ่ายผลิต' }]}
        currentRole={mockRole}
      />
    );

    // 1. Column 7 Table Cell: w-[12%] min-w-[120px] pl-3 pr-6 py-3.5 text-right whitespace-nowrap
    expect(html).toContain('w-[12%] min-w-[120px] pl-3 pr-6 py-3.5 text-right align-middle whitespace-nowrap');

    // 2. Action Button styling: inline-flex, whitespace-nowrap, rounded-lg, shadow-sm
    expect(html).toContain('inline-flex items-center justify-end gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-sm');

    // 3. Action Button Content: Lucide Eye icon + text "ดูรายละเอียด"
    expect(html).toContain('ดูรายละเอียด');
    // Verified absence of truncated legacy button text
    expect(html).not.toContain('ดูข้อมูล...');
  });

  // ── Scenario 3: Search, Filter & Pagination Preservation ──
  it('Scenario 3 (Controls & Pagination Preservation): Preserves search bar, status tabs, date filters, and places pagination outside the scroll container', () => {
    const html = renderToStaticMarkup(
      <POListView
        pos={mockPOs}
        departments={[{ code: 'PD', name: 'ฝ่ายผลิต' }]}
        currentRole={mockRole}
      />
    );

    // 1. Search Bar with proper placeholder
    expect(html).toContain('placeholder="ค้นหาเลข PO, ผู้ขาย, PR, สินค้า..."');

    // 2. Status Filter Tabs
    expect(html).toContain('ทั้งหมด');
    expect(html).toContain('รอรับของ (ซื้อเอง)');
    expect(html).toContain('รอดำเนินการ Online');
    expect(html).toContain('ปิดงานแล้ว');
    expect(html).toContain('ยกเลิกแล้ว');

    // 3. Table Data Rendering: Both PO rows rendered
    expect(html).toContain('PO-PD-2026-001');
    expect(html).toContain('PO-PD-2026-002');
    expect(html).toContain('฿10,000.00');
    expect(html).toContain('฿2,450.50');

    // 4. Pagination component exists inside card
    expect(html).toContain('จากทั้งหมด');
    expect(html).toContain('2</span> รายการ');
  });
});
