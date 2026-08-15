import React from 'react';
import { createPortal } from 'react-dom';
import { PenTool, ShieldCheck, X, AlertTriangle, Lock } from 'lucide-react';
import { storageService } from '../../services/storageService';

export default function ElectronicSignatureModal({ isOpen, user, actionText, onConfirm, onCancel }) {
  if (!isOpen) return null;

  const signatureData = storageService.getSignatureByRole(user);
  const hasSignature = Boolean(signatureData && signatureData.signatureUrl);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-zoom-in border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-700">
            <PenTool className="w-5 h-5" />
            <h3 className="font-bold">ลงลายเซ็นอิเล็กทรอนิกส์ (E-Signature)</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            คุณกำลังดำเนินการ: <span className="font-bold text-slate-800">{actionText}</span>
          </p>

          {/* If Signature exists: Show Signature image & details */}
          {hasSignature ? (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed text-center space-y-2">
              <div className="flex justify-center items-center h-20 overflow-hidden my-1">
                <img
                  src={signatureData.signatureUrl}
                  alt={`Signature of ${user.name}`}
                  className="max-h-16 max-w-full object-contain filter drop-shadow-sm"
                />
              </div>
              <div className="h-px w-3/4 bg-slate-300 mx-auto"></div>
              <p className="text-xs font-bold text-slate-700 uppercase">{user.name}</p>
              <p className="text-[11px] text-slate-500">{user.title}</p>
              <p className="text-[10px] text-slate-400 font-mono">Timestamp: {new Date().toLocaleString('th-TH')}</p>
            </div>
          ) : (
            /* If NO Signature exists: Show Blocking Alert */
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-rose-800 text-base flex items-center justify-center gap-1.5">
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
            <div className="flex items-start gap-2 bg-indigo-50 p-3 rounded-lg border border-indigo-200 text-indigo-900 text-xs mt-4">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
              <p>
                การกดยืนยันถือเป็นการลงลายเซ็นอิเล็กทรอนิกส์และมีผลผูกพันตามระเบียบจัดซื้อของบริษัท
              </p>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            {hasSignature ? 'ยกเลิก' : 'ปิด'}
          </button>
          
          {hasSignature && (
            <button 
              onClick={onConfirm}
              className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/30 transition-all cursor-pointer"
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
