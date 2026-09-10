import React from 'react';

/**
 * Thai Unicode Text Normalizer
 * Enforces NFC normalization and fixes any misordered tone marks/vowels
 */
function cleanThaiText(rawText) {
  if (rawText === null || rawText === undefined) return '';
  let text = String(rawText).normalize('NFC');
  // Swap tone mark and upper vowel if misordered
  text = text.replace(/([\u0E48-\u0E4C])([\u0E31\u0E34-\u0E37\u0E47\u0E4D])/g, '$2$1');
  // Remove duplicate consecutive vowels or tone marks
  text = text.replace(/([\u0E31\u0E34-\u0E37\u0E47\u0E4D])\1+/g, '$1');
  text = text.replace(/([\u0E48-\u0E4C])\1+/g, '$1');
  return text;
}

export default function PrintablePO({ po }) {
  if (!po) return null;

  return (
    <div 
      className="bg-white text-black p-8 max-w-[210mm] mx-auto text-sm thai-doc-container"
      style={{
        fontFamily: "'Sarabun', 'TH Sarabun New', 'Prompt', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif",
        letterSpacing: '0px',
        fontVariantLigatures: 'normal',
        fontFeatureSettings: '"liga" 1, "kern" 1',
        textRendering: 'optimizeLegibility',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase">{cleanThaiText('บริษัท พีดีคิวซี จำกัด (PDQC Co., Ltd.)')}</h1>
          <p className="text-sm mt-1">{cleanThaiText('123/45 ถนนอุตสาหกรรม ตำบลโรงงาน อำเภอผลิตผล 10000')}</p>
          <p className="text-sm">{cleanThaiText('โทร: 02-123-4567 | อีเมล: info@pdqc.co.th')}</p>
          <p className="text-sm mt-2 font-semibold">
            {cleanThaiText('อ้างอิงใบขอซื้อ (PR Ref):')} <span className="font-bold">{cleanThaiText(po.prNo)}</span> 
            <span className="ml-4">{cleanThaiText('แผนกที่ขอซื้อ:')} {cleanThaiText(po.department)}</span>
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-black uppercase text-gray-800">{cleanThaiText('ใบสั่งซื้อ')}</h2>
          <h2 className="text-xl font-bold uppercase text-gray-600 mb-2">Purchase Order</h2>
          <p className="font-bold text-lg">{cleanThaiText(po.poNo)}</p>
          <p className="text-sm mt-1">{cleanThaiText('วันที่ (Date):')} {cleanThaiText(po.issueDate)}</p>
        </div>
      </div>

      {/* Vendor Info */}
      <div className="border border-black p-4 mb-6 rounded-sm">
        <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">{cleanThaiText('ข้อมูลผู้ขาย (Vendor Information)')}</h3>
        <p><span className="font-semibold w-24 inline-block">{cleanThaiText('ชื่อบริษัท:')}</span> {cleanThaiText(po.vendorName)}</p>
        <p><span className="font-semibold w-24 inline-block">{cleanThaiText('รหัสผู้ขาย:')}</span> {cleanThaiText(po.vendorId)}</p>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-black mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-4 w-12 text-center">{cleanThaiText('ลำดับ')}<br/>(No.)</th>
            <th className="border border-black p-4 w-24 text-center">{cleanThaiText('รหัสสินค้า')}<br/>(Code)</th>
            <th className="border border-black p-4 text-left">{cleanThaiText('รายการสินค้า')}<br/>(Description)</th>
            <th className="border border-black p-4 w-20 text-center">{cleanThaiText('จำนวน')}<br/>(Qty)</th>
            <th className="border border-black p-4 w-24 text-right">{cleanThaiText('ราคาหน่วย')}<br/>(Unit Price)</th>
            <th className="border border-black p-4 w-32 text-right">{cleanThaiText('จำนวนเงิน')}<br/>(Amount)</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((item, index) => (
            <tr key={index}>
              <td className="border border-black p-4 text-center">{index + 1}</td>
              <td className="border border-black p-4 text-center font-mono text-sm">{cleanThaiText(item.code)}</td>
              <td className="border border-black p-4">{cleanThaiText(item.name)}</td>
              <td className="border border-black p-4 text-center">{item.qty} {cleanThaiText(item.unit)}</td>
              <td className="border border-black p-4 text-right">{(item.price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-4 text-right">{(item.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          ))}
          
          {/* Empty rows for padding if few items */}
          {po.items.length < 5 && Array.from({ length: 5 - po.items.length }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td className="border-x border-black p-4 h-8"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
            </tr>
          ))}

          {/* Totals */}
          {po.vat > 0 ? (
            <>
              <tr>
                <td colSpan="4" rowSpan="3" className="border border-black p-4 align-top">
                  <span className="font-semibold text-sm">{cleanThaiText('หมายเหตุ (Remarks):')}</span>
                  <p className="text-sm mt-1">{cleanThaiText('1. โปรดระบุเลขที่ใบสั่งซื้อ (PO No.) ในเอกสารใบกำกับภาษีทุกครั้ง')}</p>
                  <p className="text-sm">{cleanThaiText('2. กรณีส่งมอบล่าช้ากว่ากำหนด บริษัทขอสงวนสิทธิ์ในการปรับ')}</p>
                </td>
                <td className="border border-black p-4 text-right font-bold text-sm">{cleanThaiText('รวมเป็นเงิน')}<br/>(Sub Total)</td>
                <td className="border border-black p-4 text-right font-bold">{(po.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td className="border border-black p-4 text-right font-bold text-sm">{cleanThaiText('ภาษีมูลค่าเพิ่ม')}<br/>(VAT 7%)</td>
                <td className="border border-black p-4 text-right font-bold">{(po.vat || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td className="border border-black p-4 text-right font-bold text-sm bg-gray-100">{cleanThaiText('ยอดเงินสุทธิ')}<br/>(Grand Total)</td>
                <td className="border border-black p-4 text-right font-bold text-sm bg-gray-100">{(po.grandTotal || po.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan="4" className="border border-black p-4 align-top">
                <span className="font-semibold text-sm">{cleanThaiText('หมายเหตุ (Remarks):')}</span>
                <p className="text-sm mt-1">{cleanThaiText('1. โปรดระบุเลขที่ใบสั่งซื้อ (PO No.) ในเอกสารใบกำกับภาษีทุกครั้ง')}</p>
                <p className="text-sm">{cleanThaiText('2. กรณีส่งมอบล่าช้ากว่ากำหนด บริษัทขอสงวนสิทธิ์ในการปรับ')}</p>
              </td>
              <td className="border border-black p-4 text-right font-bold text-sm bg-gray-100">{cleanThaiText('ยอดเงินสุทธิ')}<br/>(Grand Total)</td>
              <td className="border border-black p-4 text-right font-bold text-sm bg-gray-100">{(po.grandTotal || po.totalAmount || po.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Electronic Approvals & Acknowledgement */}
      <div className="grid grid-cols-3 gap-3 mt-10 text-center text-xs">
        <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50">
          <p className="font-semibold text-slate-800">{cleanThaiText('ผู้จัดทำ (Prepared By)')}</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">{cleanThaiText('✓ อนุมัติทางอิเล็กทรอนิกส์')}</p>
          <p className="text-[11px] font-medium text-slate-700 mt-0.5">{cleanThaiText(po.createdBy || po.createdByName || po.requesterName || 'คุณวิชัย (PD)')}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{cleanThaiText('วันที่:')} {cleanThaiText(po.issuedDate || po.createdAt || '-')}</p>
        </div>
        <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50">
          <p className="font-semibold text-slate-800">{cleanThaiText('ผู้อนุมัติ (Authorized By)')}</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">{cleanThaiText('✓ อนุมัติทางอิเล็กทรอนิกส์')}</p>
          <p className="text-[11px] font-medium text-slate-700 mt-0.5">{cleanThaiText(po.approvedBy || 'คุณประเสริฐ ยิ่งยง')}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{cleanThaiText('วันที่:')} {cleanThaiText(po.approvedAt || po.issuedDate || '-')}</p>
        </div>
        <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 flex flex-col justify-between">
          <p className="font-semibold text-slate-800">{cleanThaiText('ผู้ขายรับเอกสาร (Accepted By)')}</p>
          <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto my-2"></div>
          <p className="text-[10px] text-slate-400">{cleanThaiText('วันที่:')} ___________________</p>
        </div>
      </div>
    </div>
  );
}



