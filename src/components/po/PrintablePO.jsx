import React from 'react';
import { storageService } from '../../services/storageService.js';

/**
 * Thai Unicode Text Normalizer
 * Enforces NFC normalization and fixes any misordered tone marks/vowels
 */
function cleanThaiText(rawText) {
  if (rawText === null || rawText === undefined) return '';
  let text = String(rawText).normalize('NFC');
  text = text.replace(/([\u0E48-\u0E4C])([\u0E31\u0E34-\u0E37\u0E47\u0E4D])/g, '$2$1');
  text = text.replace(/([\u0E31\u0E34-\u0E37\u0E47\u0E4D])\1+/g, '$1');
  text = text.replace(/([\u0E48-\u0E4C])\1+/g, '$1');
  return text;
}

/**
 * Document Date Time Formatter
 * Formats ISO timestamps or Thai date strings to "วันที่ DD/MM/YYYY เวลา HH:mm น."
 */
export function formatDocDateTime(dt) {
  if (!dt || dt === '-') return 'วันที่ ..... / ..... / .........';
  try {
    const str = String(dt).trim();
    const cleanStr = str.replace(/^วันที่\s*/, '');
    
    // 1. ตรวจสอบว่าเป็น ISO String หรือ Date Parseable (ยกเว้นรูปแบบ DD/MM/YYYY ที่มีเครื่องหมาย / เพื่อป้องกัน JS ตีความเป็น MM/DD/YYYY)
    const d = !cleanStr.includes('/') ? new Date(cleanStr) : new Date(NaN);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      let year = d.getFullYear();
      if (year > 2400) year -= 543; // บังคับแปลง พ.ศ. เป็น ค.ศ.
      
      if (cleanStr.includes('T') || cleanStr.includes(':')) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `วันที่ ${day}/${month}/${year} เวลา ${hours}:${minutes} น.`;
      }
      return `วันที่ ${day}/${month}/${year}`;
    }

    // 2. จัดการกรณีสตริงภาษาไทยที่มีเวลาปนมา เช่น "11/09/2026 08:30" หรือ "11/9/2569 เวลา 21:42 น."
    const match = cleanStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(?:เวลา\s*)?(\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const [, day, month, rawYear, hh, mm] = match;
      let year = Number(rawYear);
      if (year > 2400) year -= 543;
      const dd = String(Number(day)).padStart(2, '0');
      const mmStr = String(Number(month)).padStart(2, '0');
      if (hh !== undefined && mm !== undefined) {
        return `วันที่ ${dd}/${mmStr}/${year} เวลา ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} น.`;
      }
      return `วันที่ ${dd}/${mmStr}/${year}`;
    }

    return str.startsWith('วันที่') ? str : `วันที่ ${str}`;
  } catch {
    return String(dt);
  }
}

export default function PrintablePO({ po }) {
  if (!po) return null;

  let prData = null;
  try {
    const prs = storageService.getPRs();
    prData = prs.find(p => p.id === po.prId || p.prNo === po.prNo);
  } catch { }

  let users = [];
  try {
    users = storageService.getUsers() || [];
  } catch { }

  const reviewedLog = Array.isArray(prData?.approvalHistory)
    ? prData.approvalHistory.find(h => h.action === 'REVIEWED')
    : null;

  const approvedLog = Array.isArray(prData?.approvalHistory)
    ? prData.approvalHistory.find(h => h.action === 'APPROVED')
    : null;

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

  // ดึงเวลาเปิด PR จาก Log แรก หรือ submittedAt / createdAt ของ PR
  const submitLog = Array.isArray(prData?.approvalHistory)
    ? prData.approvalHistory.find(h => h.action === 'SUBMITTED' || h.action === 'CREATED')
    : null;

  // ดึงเวลาของ PR เท่านั้น ห้ามดึง po.createdAt หรือ approverDate มาทับ
  const requesterDate = submitLog?.timestamp || 
                        prData?.submittedAt || 
                        prData?.createdAt || 
                        prData?.date || 
                        po.prCreatedAt || 
                        '';

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

  const approverDate = po.approvedAt || approvedLog?.timestamp || approvedLog?.date || po.createdAt || '';

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

  const itemsSubtotal = (po.items || []).reduce((sum, item) => {
    const p = parseFloat(item.price) || 0;
    const q = parseFloat(item.qty ?? item.purchaseQty) || 1;
    const disc = parseFloat(item.discountAmount) || 0;
    const lineTotal = item.total !== undefined ? parseFloat(item.total) : ((p * q) - disc);
    return sum + (lineTotal > 0 ? lineTotal : 0);
  }, 0);

  const subtotal = (po.financials?.subtotal !== undefined && Number(po.financials.subtotal) > 0)
    ? Number(po.financials.subtotal)
    : ((po.subtotal !== undefined && Number(po.subtotal) > 0) ? Number(po.subtotal) : itemsSubtotal);

  const hasVat = po.hasVat !== undefined
    ? Boolean(po.hasVat)
    : (po.financials?.hasVat !== undefined
      ? Boolean(po.financials.hasVat)
      : (po.financials?.vatMode ? po.financials.vatMode !== 'NONE' : Number(po.vat) > 0));

  const vatAmount = hasVat
    ? (po.financials?.vatAmount !== undefined
      ? Number(po.financials.vatAmount)
      : (po.vat !== undefined && Number(po.vat) > 0 ? Number(po.vat) : parseFloat((subtotal * 0.07).toFixed(2))))
    : 0;

  const grandTotal = (po.financials?.grandTotal !== undefined && Number(po.financials.grandTotal) > 0)
    ? Number(po.financials.grandTotal)
    : (po.grandTotal !== undefined && Number(po.grandTotal) > 0
      ? Number(po.grandTotal)
      : (po.totalAmount !== undefined && Number(po.totalAmount) > 0
        ? Number(po.totalAmount)
        : parseFloat((subtotal + vatAmount).toFixed(2))));

  return (
    <div
      className="font-sarabun text-slate-900 bg-white p-8 max-w-[210mm] mx-auto text-sm thai-doc-container"
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
      {/* HEADER BLOCK: Clean Flow with generous line heights to prevent overlapping */}
      <div className="w-full mb-6 pb-4 border-b border-black">
        <div className="flex justify-between items-start">
          {/* Left Column: Logo + Company Info */}
          <div className="flex items-start gap-4">
            <img
              src="/images/sc-logo.png"
              alt="Logo"
              className="h-16 w-auto object-contain shrink-0 mt-1"
            />
            <div className="flex flex-col space-y-1.5">
              <h1 className="text-base font-bold text-slate-900 leading-normal">
                {cleanThaiText('บริษัท เศรษฐชล จำกัด (สำนักงานใหญ่)')}
              </h1>
              <p className="text-xs text-slate-700 leading-relaxed">
                {cleanThaiText('ที่อยู่ 225 หมู่ที่ 12 ถนนเทพารักษ์ ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ 10540')}
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">
                {cleanThaiText('เลขประจำตัวผู้เสียภาษี (TAX ID):')} <span className="font-mono font-medium">0-10553-2104-63-7</span>
              </p>
              <div className="pt-1">
                <span className="text-sm font-bold text-blue-900 block leading-normal">
                  {cleanThaiText('ใบสั่งซื้อสินค้า / PURCHASE ORDER')}
                </span>
                <span className="text-xs text-slate-600 leading-relaxed block mt-0.5">
                  {cleanThaiText('อ้างอิงใบขอซื้อ (PR):')} <strong className="text-slate-900 font-mono">{po.prNumber || po.prId || '-'}</strong> | {cleanThaiText('แผนกผู้ขอ:')} <strong className="text-slate-900">{po.department || '-'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: PO Number Box (Aligned to top) */}
          <div className="border border-black rounded p-2.5 bg-gray-50 shrink-0 w-52 text-xs leading-relaxed">
            <div className="flex justify-between mb-1">
              <span className="text-slate-600 font-medium">{cleanThaiText('เลขที่ PO:')}</span>
              <span className="font-mono font-bold text-slate-900">{po.id || po.poNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 font-medium">{cleanThaiText('วันที่ออก PO:')}</span>
              <span className="font-mono text-slate-800">{po.issuedDate || po.createdAt ? new Date(po.issuedDate || po.createdAt).toLocaleDateString('th-TH') : '2026-09-11'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* VENDOR DETAILS BLOCK: Clean Stacked Grid with Natural Flow */}
      <div className="mb-6 p-3 border border-black rounded bg-gray-50/50 text-xs leading-relaxed">
        <div className="font-bold text-slate-900 border-b border-black pb-1 mb-2 flex justify-between items-center">
          <span>{cleanThaiText('ข้อมูลคู่ค้า / ผู้จำหน่าย (Vendor Details)')}</span>
          <span className="font-mono font-normal text-slate-700">{cleanThaiText('รหัสผู้ขาย:')} {po.vendorCode || po.vendorDetails?.code || '-'}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          <div>
            <span className="font-medium text-slate-600">{cleanThaiText('ชื่อบริษัท/ร้านค้า:')}</span>{' '}
            <span className="text-slate-900 font-semibold break-words">{cleanThaiText(po.vendorName || po.vendorDetails?.name || '-')}</span>
          </div>
          <div>
            <span className="font-medium text-slate-600">{cleanThaiText('ผู้ติดต่อ:')}</span>{' '}
            <span className="text-slate-800 break-words">{cleanThaiText(po.vendorDetails?.contactPerson || '-')}</span>
          </div>
          <div>
            <span className="font-medium text-slate-600">{cleanThaiText('เลขประจำตัวผู้เสียภาษี:')}</span>{' '}
            <span className="font-mono text-slate-800">{po.vendorDetails?.taxId || '-'}</span>
          </div>
          <div>
            <span className="font-medium text-slate-600">{cleanThaiText('โทรศัพท์:')}</span>{' '}
            <span className="font-mono text-slate-800">{po.vendorDetails?.phone || '-'}</span>
          </div>
          <div className="col-span-2">
            <span className="font-medium text-slate-600">{cleanThaiText('ที่อยู่:')}</span>{' '}
            <span className="text-slate-800 break-words leading-relaxed">{cleanThaiText(po.vendorDetails?.address || '-')}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-black mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-4 w-12 text-center">{cleanThaiText('ลำดับ')}<br />(No.)</th>
            <th className="border border-black p-4 w-24 text-center">{cleanThaiText('รหัสสินค้า')}<br />(Code)</th>
            <th className="border border-black p-4 text-left">{cleanThaiText('รายการสินค้า')}<br />(Description)</th>
            <th className="border border-black p-4 w-20 text-center">{cleanThaiText('จำนวน')}<br />(Qty)</th>
            <th className="border border-black p-4 w-24 text-right">{cleanThaiText('ราคาหน่วย')}<br />(Unit Price)</th>
            <th className="border border-black p-4 w-32 text-right">{cleanThaiText('จำนวนเงิน')}<br />(Amount)</th>
          </tr>
        </thead>
        <tbody>
          {(po.items || []).map((item, index) => (
            <tr key={index}>
              <td className="border border-black p-4 text-center">{index + 1}</td>
              <td className="border border-black p-4 text-center font-mono text-sm">{cleanThaiText(item.code)}</td>
              <td className="border border-black p-4 break-words whitespace-normal text-xs leading-relaxed">{cleanThaiText(item.name)}</td>
              <td className="border border-black p-4 text-center">{item.qty} {cleanThaiText(item.unit)}</td>
              <td className="border border-black p-4 text-right">{(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border border-black p-4 text-right">{(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}

          {(po.items || []).length < 5 && Array.from({ length: 5 - (po.items || []).length }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td className="border-x border-black p-4 h-8"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4 break-words whitespace-normal text-xs leading-relaxed"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
            </tr>
          ))}
          <tr>
            <td colSpan="6" className="border-t border-black"></td>
          </tr>
        </tbody>
      </table>

      {/* Financial Summary Breakdown */}
      <div className="flex justify-between items-start my-4 text-xs">
        <div className="w-1/2 align-top text-slate-700 pr-4">
          <span className="font-semibold text-sm text-slate-900">{cleanThaiText('หมายเหตุ (Remarks):')}</span>
          <p className="mt-1 leading-relaxed">{cleanThaiText('1. โปรดระบุเลขที่ใบสั่งซื้อ (PO No.) ในเอกสารใบกำกับภาษีทุกครั้ง')}</p>
          <p className="leading-relaxed">{cleanThaiText('2. กรณีส่งมอบล่าช้ากว่ากำหนด บริษัทขอสงวนสิทธิ์ในการคิดค่าปรับตามระเบียบบริษัท')}</p>
          {po.note && (
            <p className="mt-1 text-slate-800 leading-relaxed font-medium break-words whitespace-normal">
              <strong>{cleanThaiText('ข้อความเพิ่มเติม: ')}</strong>{cleanThaiText(po.note)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end">
          <div className="w-80 border-t border-slate-300 pt-2 space-y-1.5">
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">{cleanThaiText('รวมมูลค่าสินค้า (Subtotal):')}</span>
              <span className="font-mono font-semibold text-slate-900">
                ฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between text-slate-700">
              <span className="font-medium">{cleanThaiText('ภาษีมูลค่าเพิ่ม 7% (VAT 7%):')}</span>
              <span className="font-mono font-semibold text-slate-900">
                {hasVat && vatAmount > 0
                  ? `฿${vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : cleanThaiText('ไม่มี VAT (0%)')}
              </span>
            </div>

            <div className="flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-800 pt-2 mt-1.5">
              <span>{cleanThaiText('ยอดเงินรวมสุทธิ (Grand Total):')}</span>
              <span className="font-mono text-emerald-800 text-base">
                ฿{grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

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
                      {cleanThaiText(formatDocDateTime(po.receivedAt) || 'วันที่ ..... / ..... / .........')}
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