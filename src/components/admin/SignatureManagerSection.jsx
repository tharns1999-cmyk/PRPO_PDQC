import React, { useState } from 'react';
import { storageService } from '../../services/storageService';
import { modalService } from '../../services/modalService';
import { PenTool, CheckCircle, AlertTriangle, Upload, Trash2, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';

const APPROVER_ROLES = [
  { id: 'ASST_MANAGER', title: 'Assistant Manager (Level 2)', name: 'คุณสมชาย (Asst. Mgr)', dept: 'ALL' },
  { id: 'PLANT_MANAGER', title: 'Plant Manager (Level 3)', name: 'คุณประเสริฐ (Plant Mgr)', dept: 'ALL' },
  { id: 'REVIEWER', title: 'Reviewer (Level 2)', name: 'Reviewer', dept: 'ALL' },
  { id: 'APPROVER', title: 'Approver (Level 3)', name: 'Approver', dept: 'ALL' },
  { id: 'ADMIN', title: 'System Administrator', name: 'Admin System', dept: 'ALL' },
];

export default function SignatureManagerSection({ currentRole, onRefresh }) {
  const [signatures, setSignatures] = useState(() => storageService.getSignatures());
  const [selectedRole, setSelectedRole] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const isAdmin = currentRole?.id === 'ADMIN' || currentRole?.roleId === 'ADMIN' || Number(currentRole?.level) >= 99;

  if (!isAdmin) {
    return (
      <div className="w-full my-8 text-center p-8 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center border border-amber-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น</h4>
        <p className="text-xs text-slate-500">สิทธิ์การตั้งค่าและจัดการลายเซ็นอิเล็กทรอนิกส์ของผู้อนุมัติ ถูกจำกัดไว้เฉพาะบัญชี Admin เท่านั้น</p>
      </div>
    );
  }

  const refreshSignatures = () => {
    setSignatures(storageService.getSignatures());
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      modalService.warning('กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, SVG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setUploadPreview(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignature = () => {
    if (!selectedRole || !uploadPreview) {
      modalService.warning('กรุณาเลือกรูปภาพลายเซ็น');
      return;
    }

    storageService.saveSignatureForRole(selectedRole.id, {
      roleId: selectedRole.id,
      name: selectedRole.name,
      signatureUrl: uploadPreview
    });

    refreshSignatures();
    modalService.success('บันทึกสำเร็จ', `บันทึกภาพลายเซ็นสำหรับ ${selectedRole.name} เรียบร้อยแล้ว`);
    setSelectedRole(null);
    setUploadPreview('');
    if (onRefresh) onRefresh();
  };

  const handleDeleteSignature = async (roleId, roleName) => {
    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบลายเซ็น',
      message: `ยืนยันการลบลายเซ็นของ ${roleName} หรือไม่?\n(เมื่อลบแล้ว ระบบจะบล็อกไม่อนุญาตให้ผู้ใช้ท่านนี้อนุมัติจนกว่าจะตั้งค่าใหม่)`,
      type: 'error',
      confirmText: 'ลบลายเซ็น',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;

    storageService.deleteSignatureForRole(roleId);
    refreshSignatures();
    modalService.success('ลบลายเซ็นสำเร็จ', `ลบลายเซ็นของ ${roleName} เรียบร้อยแล้ว`);
    if (onRefresh) onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Overview Info Banner */}
      <div className="bg-indigo-50/70 border border-indigo-200 rounded-sm p-4 flex items-start gap-1.5">
        <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 leading-relaxed">
          <h4 className="font-bold text-sm text-indigo-900 mb-0.5">ระบบควบคุมลายเซ็นอิเล็กทรอนิกส์ (E-Signature Policy)</h4>
          <p>
            ผู้อนุมัติทุกท่าน (Level 2 และ Level 3) จำเป็นต้องมีรูปภาพลายเซ็นที่ลงทะเบียนโดย Admin ในระบบ จึงจะสามารถกดอนุมัติ (Approve) เอกสาร PR/PO ได้ หากยังไม่มีลายเซ็น ระบบจะบล็อกการอนุมัติอัตโนมัติ
          </p>
        </div>
      </div>

      {/* Grid of Approver Roles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {APPROVER_ROLES.map(role => {
          const sig = signatures[role.id];
          const hasSig = Boolean(sig && sig.signatureUrl);

          return (
            <div key={role.id} className="bg-white border border-slate-200 rounded-sm p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{role.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{role.title}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                    hasSig ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {hasSig ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {hasSig ? 'มีลายเซ็นแล้ว' : 'ยังไม่มีลายเซ็น (Blocked)'}
                  </span>
                </div>

                {/* Signature Preview Box */}
                <div className="mt-3 bg-white border border-slate-200 border-dashed rounded-sm p-3 h-24 flex items-center justify-center overflow-hidden">
                  {hasSig ? (
                    <img 
                      src={sig.signatureUrl} 
                      alt={`Signature of ${role.name}`} 
                      className="max-h-20 max-w-full object-contain filter drop-shadow-xs" 
                    />
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">ยังไม่ได้ลงทะเบียนลายเซ็น</span>
                  )}
                </div>

                {hasSig && sig.updatedAt && (
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">อัปเดตล่าสุด: {sig.updatedAt}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                {hasSig && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSignature(role.id, role.name)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-sm text-xs font-semibold transition-colors cursor-pointer"
                    title="ลบลายเซ็น (เพื่อทดสอบ Block Approve)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(role);
                    setUploadPreview(sig?.signatureUrl || '');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-sm text-xs font-bold transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {hasSig ? 'เปลี่ยนลายเซ็น' : 'อัปโหลดลายเซ็น'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Signature Modal */}
      {selectedRole && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-sm w-full max-w-md overflow-hidden shadow-md animate-zoom-in border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">ตั้งค่าลายเซ็น: {selectedRole.name}</h3>
              <button onClick={() => setSelectedRole(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-sm hover:bg-slate-100 transition-colors cursor-pointer" title="ปิด">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">เลือกไฟล์รูปภาพลายเซ็น (PNG / JPG / SVG โปร่งแสง)</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />

              {uploadPreview && (
                <div className="bg-white border border-slate-200 rounded-sm p-4 text-center">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2">ภาพตัวอย่าง (Preview)</span>
                  <div className="h-24 flex items-center justify-center">
                    <img src={uploadPreview} alt="Signature Preview" className="max-h-20 max-w-full object-contain" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!uploadPreview}
                onClick={handleSaveSignature}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-sm shadow-md transition-all cursor-pointer"
              >
                บันทึกภาพลายเซ็น
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
