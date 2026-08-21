import React from 'react';
import { createPortal } from 'react-dom';
import { PenTool, ShieldCheck, X, AlertTriangle, Lock } from 'lucide-react';
import { storageService } from '../../services/storageService';

export default function ElectronicSignatureModal({ isOpen, user, actionText, onConfirm, onCancel }) {
  if (!isOpen) return null;

  const signatureData = storageService.getSignatureByRole(user);
  const hasSignature = Boolean(signatureData && signatureData.signatureUrl);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
        
        {/* ── 1. Fixed Header (Sticky Top / Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-2xs shrink-0">
              <PenTool className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base tracking-tight">
                ลายเซ็นอิเล็กทรอนิกส์ (E-Signature)
              </h3>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                ยืนยันตัวตนก่อนดำเนินการอนุมัติหรือตรวจทาน
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 2. Scrollable Content Body (Flex-1 / Dynamic Height) ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 custom-scrollbar bg-slate-50/30">
          <p className="text-xs text-slate-600 font-medium">
            คุณกำลังดำเนินการ: <strong className="font-bold text-slate-900">{actionText}</strong>
          </p>

          {/* If Signature exists: Show Signature image & details */}
          {hasSignature ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center space-y-3 shadow-2xs">
              <div className="flex justify-center items-center h-20 overflow-hidden my-1">
                <img
                  src={signatureData.signatureUrl}
                  alt={`Signature of ${user.name}`}
                  className="max-h-16 max-w-full object-contain filter drop-shadow-xs"
                />
              </div>
              <div className="h-px w-3/4 bg-slate-100 mx-auto"></div>
              <p className="text-xs font-bold text-slate-900 uppercase">{user.name}</p>
              <p className="text-xs text-slate-500 font-medium">{user.title}</p>
              <p className="text-[11px] text-slate-400 font-mono">Timestamp: {new Date().toLocaleString('th-TH')}</p>
            </div>
          ) : (
            /* If NO Signature exists: Show Blocking Alert */
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-rose-900 text-sm flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>ไม่อนุญาตให้อนุมัติ (ไม่มีลายเซ็นในระบบ)</span>
                </h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed font-normal">
                  คุณยังไม่มีลายเซ็นอิเล็กทรอนิกส์ในระบบ ระบบจึงไม่อนุญาตให้ดำเนินการอนุมัติได้ <br />
                  <strong className="font-bold">กรุณาติดต่อ Admin เพื่อตั้งค่าลายเซ็นก่อน</strong>
                </p>
              </div>
            </div>
          )}

          {hasSignature && (
            <div className="flex items-start gap-2.5 bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-100 text-indigo-950 text-xs shadow-2xs">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
              <p className="leading-relaxed font-medium">
                การกดยืนยันถือเป็นการลงลายเซ็นอิเล็กทรอนิกส์และมีผลผูกพันตามระเบียบจัดซื้อของบริษัท
              </p>
            </div>
          )}
        </div>

        {/* ── 3. Sticky Action Footer (Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 z-20">
          <button 
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
          >
            {hasSignature ? 'ยกเลิก' : 'ปิด'}
          </button>
          
          {hasSignature && (
            <button 
              type="button"
              onClick={onConfirm}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <PenTool className="w-4 h-4" />
              <span>ยืนยันและลงนาม</span>
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
