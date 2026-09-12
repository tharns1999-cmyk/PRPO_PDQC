import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReceivingModal from '../src/views/inventory/ReceivingModal';
import { storageService } from '../src/services/storageService';

describe('ReceivingModal Upscale Typography & Seamless Modal Swapping', () => {
  const basePO = {
    id: 'PO-TEST-002',
    poNo: 'PO-PD-2026-002',
    status: 'ORDERED_PENDING_DELIVERY',
    department: 'PD',
    vendorName: 'บริษัท เคมีคอล ซัพพลาย จำกัด',
    items: [
      {
        productId: 'PROD-02',
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

  it('1. Renders seamless "กลับไปใบ PO" button with single icon when onBack or onBackToPO is provided', () => {
    const htmlWithBack = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} onBack={() => {}} />
    );
    expect(htmlWithBack).toContain('กลับไปใบ PO');
    expect(htmlWithBack).not.toContain('← กลับไปใบ PO');
    expect(htmlWithBack).toContain('title="กลับไปที่หน้าต่างใบสั่งซื้อ (PO)"');

    const htmlWithoutBack = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );
    expect(htmlWithoutBack).not.toContain('กลับไปใบ PO');
  });

  it('2. Upscales Header and Table Header Typography', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // Modal Title: text-base sm:text-lg font-bold text-white
    expect(html).toContain('text-base sm:text-lg font-bold text-white');

    // Table Header: text-xs font-semibold text-slate-500 uppercase tracking-wider
    expect(html).toContain('text-xs font-semibold text-slate-500 uppercase tracking-wider');
  });

  it('3. Upscales Item Name, SKU Badge, and Row Ergonomics', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // SKU badge: text-xs font-mono font-bold
    expect(html).toContain('font-mono text-xs font-bold text-slate-600');
    // Product name: text-sm font-bold text-slate-800
    expect(html).toContain('text-sm font-bold text-slate-800');

    // Row padding: py-3.5 px-4
    expect(html).toContain('py-3.5 px-4');
  });

  it('4. Upscales Number inputs to w-16 h-8 text-sm and hides browser spinners', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // Input size & typography: w-16 h-8 text-sm font-mono font-bold text-slate-900 text-center
    expect(html).toContain('w-16 h-8 text-sm font-mono font-bold');
    expect(html).toContain('[appearance:textfield]');
    expect(html).toContain('[&amp;::-webkit-outer-spin-button]:appearance-none');
    expect(html).toContain('[&amp;::-webkit-inner-spin-button]:appearance-none');
  });

  it('5. Upscales Note and Attachment sections with comfortable text-xs sm:text-sm', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    // Note label & textarea
    expect(html).toContain('text-xs font-bold text-slate-700');
    expect(html).toContain('text-xs sm:text-sm bg-slate-50 focus:bg-white');

    // Attachments label & upload button
    expect(html).toContain('text-xs sm:text-sm font-medium cursor-pointer');
  });

  it('6. Action buttons in footer have text-xs sm:text-sm font-bold', () => {
    const html = renderToStaticMarkup(
      <ReceivingModal po={basePO} isOpen={true} />
    );

    expect(html).toContain('text-xs sm:text-sm font-bold bg-emerald-600');
  });

  it('7. Seamless modal swapping in PODetailsModal avoids stacking backdrops', async () => {
    const { default: PODetailsModal } = await import('../src/components/po/PODetailsModal.jsx');
    
    // Normal PO details modal with operational requester role
    const normalHtml = renderToStaticMarkup(
      <PODetailsModal 
        selectedPO={basePO} 
        currentRole={{ id: 'REQUESTER_PD', roleId: 'REQUESTER_PD', role: 'requester', level: 1, department: 'PD' }} 
        onClose={() => {}} 
      />
    );
    expect(normalHtml).toContain('PO-PD-2026-002');
    expect(normalHtml).toContain('บันทึกตรวจรับสินค้า (+IN)');
    // ReceivingModal should NOT be rendered when showReceivingModal is false
    expect(normalHtml).not.toContain('ตรวจรับพัสดุเข้าคลัง (Goods Receipt / GRN)');
  });
});
