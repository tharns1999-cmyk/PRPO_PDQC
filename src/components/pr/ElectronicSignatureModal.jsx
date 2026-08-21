import React from 'react';
import { createPortal } from 'react-dom';
import { PenTool, ShieldCheck, X, AlertTriangle, Lock } from 'lucide-react';
import { storageService } from '../../services/storageService';

export default function ElectronicSignatureModal({ isOpen, user, actionText, onConfirm, onCancel }) {
  if (!isOpen) return null;

  const signatureData = storageService.getSignatureByRole(user);
  const hasSignature = Boolean(signatureData && signatureData.signatureUrl);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center glass-backdrop p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-zoom-in border border-slate-200">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-100 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-indigo-700">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <PenTool className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm sm:text-base text-slate-800">ลงลายเซ็นอิเล็กทรอนิกส์ (E-Signature)</h3>
          </div>
          <button 
            onClick={onCancel} 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 bg-slate-50/50">
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            คุณกำลังดำเนินการ: <strong className="font-semibold text-slate-800">{actionText}</strong>
          </p>

          {/* If Signature exists: Show Signature image & details */}
          {hasSignature ? (
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 text-center space-y-2 shadow-2xs">
              <div className="flex justify-center items-center h-20 overflow-hidden my-1">
                <img
                  src={signatureData.signatureUrl}
                  alt={`Signature of ${user.name}`}
                  className="max-h-16 max-w-full object-contain filter drop-shadow-xs"
                />
              </div>
              <div className="h-px w-3/4 bg-slate-100 mx-auto"></div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 uppercase">{user.name}</p>
              <p className="text-xs text-slate-500 font-medium">{user.title}</p>
              <p className="text-[11px] text-slate-400 font-mono">Timestamp: {new Date().toLocaleString('th-TH')}</p>
            </div>
          ) : (
            /* If NO Signature exists: Show Blocking Alert */
            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 text-center space-y-2.5 shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-rose-800 text-sm flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>ไม่อนุญาตให้อนุมัติ (ไม่มีลายเซ็นในระบบ)</span>
                </h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  คุณยังไม่มีลายเซ็นอิเล็กทรอนิกส์ในระบบ ระบบจึงไม่อนุญาตให้ดำเนินการอนุมัติได้ <br />
                  <b>กรุณาติดต่อ Admin เพื่อตั้งค่าลายเซ็นก่อน</b>
                </p>
              </div>
            </div>
          )}

          {hasSignature && (
            <div className="flex items-start gap-2.5 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 text-indigo-950 text-xs shadow-2xs">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
              <p className="leading-relaxed font-medium">
                การกดยืนยันถือเป็นการลงลายเซ็นอิเล็กทรอนิกส์และมีผลผูกพันตามระเบียบจัดซื้อของบริษัท
              </p>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 sm:px-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
          <button 
            onClick={onCancel}
            className="bg-white border border-slate-300/80 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer"
          >
            {hasSignature ? 'ยกเลิก' : 'ปิด'}
          </button>
          
          {hasSignature && (
            <button 
              onClick={onConfirm}
              className="px-4 py-2 text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              ยืนยันและลงนาม
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
