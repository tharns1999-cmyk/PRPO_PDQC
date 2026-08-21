import React from 'react';
import { MEMO_CLASSIFICATION, MEMO_CONCLUSION } from '../../config/constants';

export default function MEMODetailsSection({ memo, onViewAttachment }) {
  if (!memo) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden mt-6 shadow-2xs">
      <div className="bg-slate-100/80 border-b border-slate-200 px-5 py-3.5 flex items-center gap-2">
        <h4 className="font-bold text-sm sm:text-base text-slate-800 tracking-wide uppercase">รายละเอียด MEMO (Request For Approval)</h4>
      </div>
      <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">วันที่ขออนุมัติ (Date)</p>
          <p className="text-sm sm:text-base font-semibold text-slate-900">{memo.date}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">ประเภทค่าใช้จ่าย (Classification)</p>
          <p className="text-sm sm:text-base font-semibold text-slate-900">{MEMO_CLASSIFICATION[memo.classification]?.label || memo.classification}</p>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">หัวข้อ / โครงการ (Subject)</p>
          <p className="text-base sm:text-lg font-bold text-slate-900">{memo.subject}</p>
        </div>

        <div className="space-y-1.5 md:col-span-2 bg-white p-4 rounded-sm border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">วัตถุประสงค์ (Purpose of Request)</p>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap">{memo.purpose}</p>
        </div>

        <div className="space-y-1.5 md:col-span-2 bg-white p-4 rounded-sm border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">รายละเอียด / พื้นเพ (Background / Details)</p>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap">{memo.background}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">ราคาประมาณการ (Estimated Cost)</p>
          <p className="text-base sm:text-lg font-black font-mono text-rose-600">฿{memo.estimatedCost?.toLocaleString()}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">เงื่อนไขการชำระเงิน (Payment Term)</p>
          <p className="text-sm sm:text-base font-semibold text-slate-900">{memo.paymentTerm}</p>
        </div>

        {memo.remarkAttachedFile && (
          <div className="space-y-1.5 md:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">เอกสารแนบ (Remark - Attached File)</p>
            <button
              type="button"
              onClick={() => onViewAttachment ? onViewAttachment({ name: memo.remarkAttachedFile, title: memo.remarkAttachedFile }) : null}
              className="text-xs sm:text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-sm inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>{memo.remarkAttachedFile}</span>
              <span className="text-xs text-indigo-500 underline font-normal">(คลิกเพื่อเปิดดู)</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
