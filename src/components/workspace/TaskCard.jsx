import React from 'react';
import { Building2, Store } from 'lucide-react';
import { PR_STATUS, PO_STATUS } from '../../config/constants.js';

/**
 * TaskCard Component
 * Modern Minimal Bento Card (Linear/Raycast style) for PR & PO documents
 */
export default function TaskCard({ task, activeTab, currentRole, onClick }) {
  const isPR = task.docType === 'PR';
  
  const docNo = task.docNo || task.poNo || task.prNo || task.id || (isPR ? 'PR-XXXX' : 'PO-XXXX');
  const date = task.date || task.issueDate || task.requestedDate || task.createdAt || '2026-09-10';
  
  // Format Title / Item name
  const title = task.title || (task.items && task.items.length > 0 
    ? (task.items.length === 1 
        ? task.items[0].name 
        : `${task.items[0].name} (+${task.items.length - 1} รายการ)`)
    : (isPR ? 'ใบขอซื้อ' : 'ใบสั่งซื้อ'));

  // Vendor / Requester Name
  const entityName = isPR 
    ? (task.requestedBy ? `${task.requestedBy}${task.department ? ` (${task.department})` : ''}` : (task.department || 'ฝ่ายผลิต'))
    : (task.vendorName || task.vendor || 'ไม่ระบุผู้ขาย');

  // Purchase Channel / Tag
  const channelLabel = task.purchaseChannel === 'ONLINE' 
    ? 'ออนไลน์' 
    : (task.purchaseChannel === 'SELF' 
        ? 'ซื้อเอง' 
        : (task.department ? `แผนก ${task.department}` : 'ทั่วไป'));

  const amount = task.amount ?? task.grandTotal ?? task.totalAmount ?? 0;
  
  const statusInfo = isPR 
    ? (PR_STATUS[task.status] || { label: task.status, color: 'bg-slate-50 text-slate-700 border-slate-200' })
    : (PO_STATUS[task.status] || { label: task.status, color: 'bg-slate-50 text-slate-700 border-slate-200' });

  const canViewPrice = currentRole?.canViewBudget !== false;

  const actionText = (activeTab === 'todo' || activeTab === 'action')
    ? (isPR && currentRole?.level >= 2 ? 'ตรวจสอบ' : 'ดูรายละเอียด')
    : 'ดูรายละเอียด';

  return (
    <div 
      onClick={onClick}
      className="group bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between cursor-pointer w-full h-full relative"
    >
      {/* ── 1. Card Header: Tag, Doc No, Date & Status Badge in one tidy row ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono border shrink-0 ${
            isPR 
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
          }`}>
            {isPR ? 'PR' : 'PO'}
          </span>
          <span className="font-mono text-xs font-bold text-slate-900 tracking-tight truncate">
            {docNo}
          </span>
          <span className="text-slate-300 text-xs shrink-0">•</span>
          <span className="text-[11px] font-medium text-slate-400 font-sans shrink-0">
            {date}
          </span>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 shadow-2xs ${statusInfo.color || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse"></span>
          <span>{statusInfo?.label || task.status || 'รอดำเนินการ'}</span>
        </span>
      </div>

      {/* ── 2. Card Body: Item Name & Minimal Metadata Chip ── */}
      <div className="flex-1 mt-3">
        <h4 
          className="text-sm font-bold text-slate-900 line-clamp-1 leading-snug group-hover:text-indigo-600 transition-colors" 
          title={title}
        >
          {title}
        </h4>

        <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-slate-600">
          {isPR ? (
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          ) : (
            <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className="truncate max-w-[190px] sm:max-w-[220px] font-medium text-slate-700" title={entityName}>
            {entityName}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-indigo-600 font-semibold text-[11px] shrink-0">
            {channelLabel}
          </span>
        </div>
      </div>

      {/* ── 3. Card Footer: Net Amount & Minimal Action Button on same baseline ── */}
      <div className="border-t border-slate-100 pt-3.5 mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">มูลค่าสุทธิ</p>
          <p className="text-base font-black font-mono text-slate-900 leading-tight tabular-nums">
            {canViewPrice 
              ? `฿${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
              : '฿ ••••••'}
          </p>
        </div>

        <button
          type="button"
          className="h-8 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <span>{actionText}</span>
          <span className="text-xs">➔</span>
        </button>
      </div>
    </div>
  );
}
