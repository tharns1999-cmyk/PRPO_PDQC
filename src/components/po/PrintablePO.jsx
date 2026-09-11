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

/**
 * Document Date Time Formatter
 * Formats ISO timestamps or Thai date strings to "วันที่ DD/MM/YYYY เวลา HH:mm น."
 */
export function formatDocDateTime(dt) {
  if (!dt || dt === '-') return '';
  try {
    if (typeof dt === 'string' && dt.includes('T')) {
      const d = new Date(dt);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear() > 2400 ? d.getFullYear() - 543 : d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `วันที่ ${day}/${month}/${year} เวลา ${hours}:${minutes} น.`;
      }
    }
    const cleanDt = String(dt).replace(' น.', '').trim();
    if (cleanDt.includes(' ')) {
      const parts = cleanDt.split(' ');
      const timePart = parts[1] ? parts[1].substring(0, 5) : '00:00';
      return `วันที่ ${parts[0]} เวลา ${timePart} น.`;
    }
    return `วันที่ ${cleanDt}`;
  } catch {
    return String(dt);
  }
}

export default function PrintablePO({ po }) {
  if (!po) return null;

  // Extract Reviewer, Approver & Requester dynamically from PR & Storage
  let prData = null;
  try {
    const prs = storageService.getPRs();
    prData = prs.find(p => p.id === po.prId || p.prNo === po.prNo);
  } catch(e) {}

  let users = [];
  try {
    users = storageService.getUsers() || [];
  } catch(e) {}

  const reviewedLog = Array.isArray(prData?.approvalHistory)
    ? prData.approvalHistory.find(h => h.action === 'REVIEWED')
    : null;

  const approvedLog = Array.isArray(prData?.approvalHistory)
    ? prData.approvalHistory.find(h => h.action === 'APPROVED')
    : null;

  // 1. Requester (ผู้ขอซื้อ)
  const requesterUser = users.find(u =>
    u.name === (po.requestedBy || prData?.requestedBy) ||
    u.employeeName === (po.requestedBy || prData?.requestedBy) ||
    u.displayName === (po.requestedBy || prData?.requestedBy) ||
    u.id === (po.requesterId || prData?.requesterId) ||
    (po.department === 'QC' ? u.roleId === 'REQUESTER_QC' : u.roleId === 'REQUESTER')
  );
  let requesterName = po.createdBy || po.createdByName || po.requesterName || po.requestedBy || prData?.requestedBy || requesterUser?.employeeName || requesterUser?.name || 'คุณวิชัย สุขใจ';
  if (requesterName === 'Admin System') {
    requesterName = po.department === 'QC' ? 'คุณสมหญิง รักดี' : 'คุณวิชัย สุขใจ';
  }
  const requesterSig = po.requesterSignature || 
    prData?.requesterSignature || 
    requesterUser?.signature || 
    storageService.getSignatureByRole?.(po.department === 'QC' ? 'REQUESTER_QC' : 'REQUESTER_PD')?.signatureUrl || 
    null;
  const requesterDate = po.issueDate || po.createdAt || prData?.createdAt || '';

  // 2. Reviewer (ผู้ทบทวน)
  const isReviewed = Boolean(
    po.reviewedAt ||
    po.reviewerName ||
    po.reviewerSignature ||
    prData?.reviewedBy ||
    reviewedLog ||
    ['REVIEWED', 'APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE', 'CLOSED', 'COMPLETED'].includes(String(prData?.status || '').toUpperCase())
  );

  const reviewerUser = users.find(u =>
    u.id === prData?.reviewedBy?.id ||
    u.roleId === 'ASST_MANAGER' ||
    u.positionKey === 'REVIEWER' ||
    u.name === 'คุณสมชาย (Asst. Mgr)' ||
    u.employeeName === 'คุณสมชาย มุ่งมั่น'
  );

  let reviewerName = po.reviewerName ||
    (prData?.reviewedBy && typeof prData.reviewedBy === 'object' ? prData.reviewedBy.name : null) ||
    (typeof po.reviewedBy === 'string' && po.reviewedBy !== 'Admin System' ? po.reviewedBy : null) ||
    reviewedLog?.actorName ||
    (isReviewed ? 'คุณสมชาย มุ่งมั่น' : '');
  if (!reviewerName || reviewerName === 'Admin System') {
    reviewerName = isReviewed ? 'คุณสมชาย มุ่งมั่น' : '';
  }

  const reviewerSig = po.reviewerSignature ||
    (prData?.reviewedBy && typeof prData.reviewedBy === 'object' ? prData.reviewedBy.signature : null) ||
    reviewerUser?.signature ||
    storageService.getSignatureByRole?.('ASST_MANAGER')?.signatureUrl ||
    null;

  const reviewerDate = po.reviewedAt ||
    (prData?.reviewedBy && typeof prData.reviewedBy === 'object' ? prData.reviewedBy.timestamp : null) ||
    reviewedLog?.date ||
    reviewedLog?.timestamp ||
    po.reviewedDate ||
    '';

  // 3. Approver (ผู้อนุมัติ)
  const isApproved = Boolean(
    po.approvedAt ||
    po.approvedBy ||
    po.approverName ||
    approvedLog ||
    ['APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE', 'CLOSED', 'COMPLETED'].includes(String(po.status || prData?.status || '').toUpperCase())
  );

  const approverUser = users.find(u =>
    u.roleId === 'PLANT_MANAGER' ||
    u.positionKey === 'APPROVER' ||
    u.name === 'คุณประเสริฐ (Plant Mgr)' ||
    u.employeeName === 'คุณประเสริฐ ยิ่งยง'
  );

  let approverName = po.approvedBy || po.approverName || approvedLog?.actorName || approverUser?.employeeName || approverUser?.name || (isApproved ? 'คุณประเสริฐ ยิ่งยง' : '');
  if (approverName === 'Admin System') {
    approverName = 'คุณประเสริฐ ยิ่งยง';
  }

  const approverSig = po.approverSignature ||
    approverUser?.signature ||
    storageService.getSignatureByRole?.('PLANT_MANAGER')?.signatureUrl ||
    null;

  const approverDate = po.approvedAt || approvedLog?.date || approvedLog?.timestamp || po.issueDate || po.createdAt || '';

  // 4. Receiver (ผู้ตรวจรับ / บันทึกสต็อก)
  const isReceived = Boolean(
    po.receivedAt &&
    ['COMPLETED', 'CLOSED', 'RECEIVED'].includes(String(po.status || '').toUpperCase())
  );

  const receiverUser = users.find(u =>
    (po.receivedById && u.id === po.receivedById) ||
    (po.receivedBy && (u.name === po.receivedBy || u.employeeName === po.receivedBy || u.displayName === po.receivedBy)) ||
    (po.receiverName && (u.name === po.receiverName || u.employeeName === po.receiverName || u.displayName === po.receiverName))
  );

  let receiverName = po.receiverName || po.receivedBy || receiverUser?.employeeName || receiverUser?.name || '';
  if (receiverName === 'Admin System') {
    receiverName = '';
  }

  const receiverSig = po.receiverSignature || receiverUser?.signature || null;

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
            {/* 1. ผู้ขอซื้อ */}
            <td className="w-1/4 p-2 align-top border-r border-black">
              <div className="flex flex-col items-center justify-start min-h-[120px] w-full">
                <div className="h-14 flex items-center justify-center">
                  {requesterSig ? (
                    <img 
                      src={requesterSig} 
                      alt="Requester Signature" 
                      className="h-12 max-h-12 max-w-[120px] object-contain" 
                    />
                  ) : null}
                </div>
                <p className="text-[11px] font-medium text-slate-800">
                  ( {cleanThaiText(requesterName)} )
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {cleanThaiText(formatDocDateTime(requesterDate) || 'วันที่ ..... / ..... / .........')}
                </p>
              </div>
            </td>

            {/* 2. ผู้ทบทวน (Reviewer) */}
            <td className="w-1/4 p-2 align-top border-r border-black">
              <div className="flex flex-col items-center justify-start min-h-[120px] w-full">
                {isReviewed ? (
                  <>
                    <div className="h-14 flex items-center justify-center">
                      {reviewerSig ? (
                        <img 
                          src={reviewerSig} 
                          alt="Reviewer Signature" 
                          className="h-12 max-h-12 max-w-[120px] object-contain" 
                        />
                      ) : null}
                    </div>
                    <p className="text-[11px] font-medium text-slate-800">
                      ( {cleanThaiText(reviewerName || 'คุณสมชาย มุ่งมั่น')} )
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {cleanThaiText(formatDocDateTime(reviewerDate) || 'วันที่ ..... / ..... / .........')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-14 flex items-center justify-center"></div>
                    <p className="text-xs text-slate-600">( ............................................................ )</p>
                    <p className="text-[11px] text-slate-400 mt-1">วันที่ ..... / ..... / .........</p>
                  </>
                )}
              </div>
            </td>

            {/* 3. ผู้อนุมัติ (Approver) */}
            <td className="w-1/4 p-2 align-top border-r border-black">
              <div className="flex flex-col items-center justify-start min-h-[120px] w-full">
                {isApproved ? (
                  <>
                    <div className="h-14 flex items-center justify-center">
                      {approverSig ? (
                        <img 
                          src={approverSig} 
                          alt="Approver Signature" 
                          className="h-12 max-h-12 max-w-[120px] object-contain" 
                        />
                      ) : null}
                    </div>
                    <p className="text-[11px] font-medium text-slate-800">
                      ( {cleanThaiText(approverName || 'คุณประเสริฐ ยิ่งยง')} )
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {cleanThaiText(formatDocDateTime(approverDate) || 'วันที่ ..... / ..... / .........')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-14 flex items-center justify-center"></div>
                    <p className="text-xs text-slate-600">( ............................................................ )</p>
                    <p className="text-[11px] text-slate-400 mt-1">วันที่ ..... / ..... / .........</p>
                  </>
                )}
              </div>
            </td>

            {/* 4. ผู้ตรวจรับ / บันทึกสต็อก (Receiver) */}
            <td className="w-1/4 p-2 align-top">
              <div className="flex flex-col items-center justify-start min-h-[120px] w-full">
                {isReceived ? (
                  <>
                    <div className="h-14 flex items-center justify-center">
                      {receiverSig ? (
                        <img 
                          src={receiverSig} 
                          alt="Receiver Signature" 
                          className="h-12 max-h-12 max-w-[120px] object-contain" 
                        />
                      ) : null}
                    </div>
                    <p className="text-[11px] font-medium text-slate-800">
                      ( {cleanThaiText(receiverName || 'คุณวิชัย สุขใจ')} )
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {cleanThaiText(formatDocDateTime(po.receivedAt))}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-14 flex items-center justify-center"></div>
                    <p className="text-xs text-slate-600">( ............................................................ )</p>
                    <p className="text-[11px] text-slate-400 mt-1">วันที่ ..... / ..... / .........</p>
                  </>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}



