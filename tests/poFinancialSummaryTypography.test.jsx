import { describe, it, expect } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintablePO from '../src/components/po/PrintablePO.jsx';

describe('PrintablePO Financial Summary Typography Scale Down & Layout', () => {
  const samplePO = {
    id: 'PO-TEST-FINANCIAL',
    poNo: 'PO-2026-001',
    status: 'APPROVED',
    department: 'PD',
    vendorName: 'บริษัท เคมีคอล ซัพพลาย จำกัด',
    hasVat: true,
    items: [
      {
        name: 'น้ำมันไฮดรอลิกเกรด 68 (200L)',
        code: 'OIL-68',
        qty: 2,
        price: 2500,
        unit: 'ถัง'
      }
    ]
  };

  it('renders subtotal and vat with explicit inline style 10px and text-[10px]', () => {
    const html = renderToStaticMarkup(<PrintablePO po={samplePO} />);

    // Subtotal layout & typography
    expect(html).toContain('font-size:10px');
    expect(html).toContain('line-height:14px');
    expect(html).toContain('text-[10px] leading-tight text-slate-600');
    expect(html).toContain('text-[10px] font-mono text-slate-800');
    expect(html).toContain('รวมมูลค่าสินค้า (Subtotal):');
    expect(html).toContain('5,000.00');

    // VAT layout & typography
    expect(html).toContain('ภาษีมูลค่าเพิ่ม 7% (VAT 7%):');
    expect(html).toContain('350.00');
  });

  it('renders grand total with explicit inline style 11px font-bold and text-[11px]', () => {
    const html = renderToStaticMarkup(<PrintablePO po={samplePO} />);

    // Thin divider
    expect(html).toContain('border-top:1px solid #E2E8F0');

    // Grand total label & value typography
    expect(html).toContain('font-size:11px');
    expect(html).toContain('line-height:16px');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('text-[11px] leading-tight font-bold text-slate-900');
    expect(html).toContain('text-[11px] font-mono font-bold');
    expect(html).toContain('ยอดเงินรวมสุทธิ (Grand Total):');
    expect(html).toContain('color:#047857');
    expect(html).toContain('5,350.00');

    // No overly huge font sizes like text-base or text-lg in financial summary value
    expect(html).not.toContain('text-base font-bold font-mono text-white');
    expect(html).not.toContain('text-lg font-black');
  });

  it('renders right-aligned 2-column container w-64 with comfortable top padding', () => {
    const html = renderToStaticMarkup(<PrintablePO po={samplePO} />);
    expect(html).toContain('w-64 space-y-1 text-right');
    expect(html).toContain('padding-top:12px');
  });

  it('verifies generatePoPdf.js has scaled down size 9 and size 10 in PDF engine with comfortable vertical spacing', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const pdfFilePath = path.resolve(process.cwd(), 'src/utils/generatePoPdf.js');
    const content = fs.readFileSync(pdfFilePath, 'utf-8');

    // Subtotal: size: 9 with +10pt vertical offset from divider line
    expect(content).toContain("normalizeThaiText('รวมมูลค่าสินค้า (Subtotal):'), { x: 330, y: rowY - 28, size: 9, font: boldFont }");
    // VAT: size: 9
    expect(content).toContain("normalizeThaiText('ภาษีมูลค่าเพิ่ม 7% (VAT 7%):'), { x: 330, y: rowY - 41, size: 9, font: boldFont }");
    // Grand total: size: 10
    expect(content).toContain("normalizeThaiText('ยอดเงินรวมสุทธิ (Grand Total):'), { x: 330, y: rowY - 55, size: 10, font: boldFont }");
  });
});
