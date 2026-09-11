import React from 'react';
import { storageService } from '../../services/storageService.js';

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

  // Extract Reviewer & Approver dynamically from PR if possible
  let prData = null;
  try {
    const prs = storageService.getPRs();
    prData = prs.find(p => p.id === po.prId || p.prNo === po.prNo);
  } catch(e) {}

  let reviewerName = po.reviewedBy || '';
  let reviewerDate = po.reviewedDate || '';
  let approverName = po.approvedBy || '';
  let approverDate = po.approvedAt || '';

  if (prData && Array.isArray(prData.approvalHistory)) {
    // Reviewer is typically action 'REVIEWED' or level 2
    const reviewedLog = prData.approvalHistory.find(h => h.action === 'REVIEWED');
    if (reviewedLog) {
      reviewerName = reviewedLog.actorName || reviewerName;
      reviewerDate = reviewedLog.date || reviewerDate;
    }
    // Approver is typically action 'APPROVED' or level 3
    const approvedLog = prData.approvalHistory.find(h => h.action === 'APPROVED');
    if (approvedLog) {
      approverName = approvedLog.actorName || approverName;
      approverDate = approvedLog.date || approverDate;
    }
  }

  // Fallbacks
  const requesterName = po.createdBy || po.createdByName || po.requesterName || po.requestedBy || '-';
  const requesterDate = po.issuedDate || po.createdAt || '-';
  const rTime = requesterDate.includes(' ') ? requesterDate.split(' ')[1].substring(0, 5) : '-';
  const rDate = requesterDate.includes(' ') ? requesterDate.split(' ')[0] : requesterDate;

  reviewerName = reviewerName || '-';
  reviewerDate = reviewerDate || '-';
  const revTime = reviewerDate.includes(' ') ? reviewerDate.split(' ')[1].substring(0, 5) : '-';
  const revDate = reviewerDate.includes(' ') ? reviewerDate.split(' ')[0] : reviewerDate;

  approverName = approverName || '-';
  approverDate = approverDate || '-';
  const appTime = approverDate.includes(' ') ? approverDate.split(' ')[1].substring(0, 5) : '-';
  const appDate = approverDate.includes(' ') ? approverDate.split(' ')[0] : approverDate;

  const receiverName = po.receivedBy || '-';
  const receiverDate = po.receivedAt ? po.receivedAt.split(' ')[0] : '-';
  const receiverTime = po.receivedAt && po.receivedAt.includes(' ') ? po.receivedAt.split(' ')[1].substring(0, 5) : '-';

  return (
      <div 
        className="font-sarabun bg-white text-black p-8 max-w-[210mm] mx-auto text-sm thai-doc-container"
        style={{
          fontFamily: "'TH Sarabun New', 'Sarabun', 'Prompt', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif",
          letterSpacing: '0px',
          fontVariantLigatures: 'normal',
          fontFeatureSettings: '"liga" 1, "kern" 1',
          textRendering: 'optimizeLegibility',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
        <div className="flex items-center gap-3.5">
          {/* ตราสัญลักษณ์บริษัท */}
          <img 
            src="/images/sc-logo.png" 
            alt="Logo บริษัท เศรษฐชล จำกัด" 
            className="h-11 w-auto max-w-none object-contain shrink-0" 
            style={{
              height: '44px',
              width: 'auto',
              maxWidth: 'none',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          />
          {/* กลุ่มข้อความชื่อบริษัทและประเภทเอกสาร */}
          <div className="flex flex-col">
            <h1 className="text-base font-bold text-slate-900 leading-snug">
              {cleanThaiText('บริษัท เศรษฐชล จำกัด (สำนักงานใหญ่)')}
            </h1>
            <p className="text-sm font-semibold text-blue-950/80 leading-tight">
              {cleanThaiText('ใบสั่งซื้อสินค้า / PURCHASE ORDER')}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {cleanThaiText('123/45 ถนนอุตสาหกรรม ตำบลโรงงาน อำเภอผลิตผล 10000 | โทร: 02-123-4567')}
            </p>
          </div>
        </div>

        {/* กล่องเลขที่ PO / วันที่ออก PO ฝั่งขวา */}
        <div className="text-right border border-black p-2.5 rounded-sm min-w-[180px] bg-slate-50/50">
          <p className="text-xs font-bold text-slate-900">
            {cleanThaiText('เลขที่ PO:')} <span className="font-mono text-sm font-bold">{cleanThaiText(po.poNo || po.id || '-')}</span>
          </p>
          <p className="text-xs text-slate-700 mt-0.5">
            {cleanThaiText('วันที่ออก PO:')} {cleanThaiText(po.issueDate || po.createdAt || '-')}
          </p>
        </div>
      </div>

      {/* PR Ref & Department Info */}
      <div className="flex justify-between items-center mb-4 text-xs">
        <p>
          <span className="font-semibold">{cleanThaiText('อ้างอิงใบขอซื้อ (PR Ref):')}</span>{' '}
          <span className="font-bold font-mono">{cleanThaiText(po.prNo || '-')}</span>
          <span className="ml-4 font-semibold">{cleanThaiText('แผนกที่ขอซื้อ:')}</span>{' '}
          <span>{cleanThaiText(po.department || '-')}</span>
        </p>
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
      <table className="w-full table-fixed border-collapse border border-black text-center mt-10">
        <thead>
          <tr className="bg-slate-50 border-b border-black">
            {[
              { role: 'ผู้ขอซื้อ' },
              { role: 'ผู้ทบทวน' },
              { role: 'ผู้อนุมัติ' },
              { role: 'ผู้ตรวจรับ / บันทึกสต็อก' }
            ].map((stamp, idx) => (
              <th key={idx} className={`w-1/4 py-1.5 px-2 ${idx < 3 ? 'border-r border-black' : ''} text-[11px] font-bold text-slate-800`}>
                {cleanThaiText(stamp.role)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {[ 
              { name: requesterName, date: rDate, time: rTime },
              { name: reviewerName, date: revDate, time: revTime },
              { name: approverName, date: appDate, time: appTime },
              { name: receiverName, date: receiverDate, time: receiverTime }
            ].map((stamp, idx) => (
              <td key={idx} className={`w-1/4 p-2 align-top ${idx < 3 ? 'border-r border-black' : ''}`}>
                <div className="flex flex-col items-center justify-start min-h-[120px] w-full">
                  <div className="h-12 w-full mb-2 flex items-center justify-center"></div> {/* Image Placeholder */}
                  <p className="text-[11px] font-medium text-slate-800">{cleanThaiText(stamp.name === '-' ? '-' : `( ${stamp.name} )`)}</p>
                  {stamp.date !== '-' && (
                    <p className="text-[10px] text-slate-500 mt-1">{cleanThaiText(`วันที่ ${stamp.date}${stamp.time !== '-' ? ` เวลา ${stamp.time} น.` : ''}`)}</p>
                  )}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}



