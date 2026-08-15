import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/apiService';
import { 
  Store, X, Building2, Phone, User, FileText, 
  MapPin, Hash, Check, Sparkles 
} from 'lucide-react';

export default function VendorCRUDModal({ editVendor, currentRole, onClose, onRefresh }) {
  const isSupervisor = !currentRole.canViewAllDepts;
  const lockedDept = isSupervisor ? currentRole.department : null;
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveVendor = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData(e.target);
      const vendorObj = {
        id: editVendor?.id || '',
        code: formData.get('code')?.trim().toUpperCase(),
        name: formData.get('name')?.trim(),
        contactPerson: formData.get('contactPerson')?.trim(),
        phone: formData.get('phone')?.trim(),
        taxId: formData.get('taxId')?.trim(),
        department: lockedDept || formData.get('department'),
        address: formData.get('address')?.trim()
      };

      await apiService.saveVendor(vendorObj);
      onClose();
      onRefresh();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const dept = editVendor?.department || lockedDept || 'BOTH';

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-3 sm:p-4 print:hidden animate-fade-in">
      <div className="modal-content w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-zoom-in text-slate-800">
        
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold shadow-inner shrink-0">
              <Store className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {editVendor ? 'แก้ไขข้อมูลผู้ขาย (Edit Supplier/Vendor)' : 'เพิ่มผู้ขายใหม่ (Add New Vendor)'}
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                  {dept === 'BOTH' ? 'ทุกแผนก (BOTH)' : `เฉพาะแผนก ${dept}`}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5 font-medium truncate">
                {editVendor ? `รหัสผู้ขาย: ${editVendor.code} • ${editVendor.name}` : 'กำหนดข้อมูลคู่ค้า, รายละเอียดผู้ติดต่อ และที่อยู่ออกใบสั่งซื้อ'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Form Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50">
          <form id="vendor-form" onSubmit={handleSaveVendor} className="space-y-6 text-sm">
            
            {/* Section 1: ข้อมูลบริษัท & แผนก */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider pb-2 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>1. ข้อมูลบริษัทคู่ค้า (Company Details)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="impeccable-label">
                    รหัสผู้ขาย (Vendor Code) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      name="code"
                      defaultValue={editVendor?.code}
                      placeholder="เช่น VND-TH-001"
                      required
                      className="impeccable-input pl-10 font-mono font-bold uppercase tracking-wider text-indigo-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="impeccable-label">
                    แผนกที่ใช้งาน (Department Scope) <span className="text-rose-500">*</span>
                  </label>
                  {lockedDept ? (
                    <div className={`w-full border rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 ${
                      lockedDept === 'PD' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>{lockedDept} ({lockedDept === 'PD' ? 'ฝ่ายผลิต' : 'ฝ่ายควบคุมคุณภาพ'})</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <select
                        name="department"
                        defaultValue={editVendor?.department || 'BOTH'}
                        className="impeccable-input pl-10 font-semibold"
                      >
                        <option value="BOTH">ใช้ร่วมกันทุกแผนก (PD & QC - BOTH)</option>
                        <option value="PD">เฉพาะฝ่ายผลิต (PD Only)</option>
                        <option value="QC">เฉพาะฝ่ายควบคุมคุณภาพ (QC Only)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="impeccable-label">
                  ชื่อบริษัท / ผู้ขาย (Vendor / Supplier Name) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Store className="w-4 h-4" />
                  </div>
                  <input
                    name="name"
                    defaultValue={editVendor?.name}
                    placeholder="เช่น บริษัท สยามอินดัสเตรียล ซัพพลาย แอนด์ เซอร์วิส จำกัด"
                    required
                    className="impeccable-input pl-10 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="impeccable-label">
                  เลขประจำตัวผู้เสียภาษี 13 หลัก (Tax ID)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <input
                    name="taxId"
                    defaultValue={editVendor?.taxId}
                    placeholder="0105558012341"
                    maxLength="13"
                    className="impeccable-input pl-10 font-mono font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: ข้อมูลติดต่อ & ที่อยู่ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider pb-2 border-b border-slate-100">
                <Phone className="w-4 h-4 text-indigo-600" />
                <span>2. ข้อมูลผู้ติดต่อและสถานที่ (Contact & Address)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="impeccable-label">
                    ชื่อผู้ติดต่อ (Contact Person)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      name="contactPerson"
                      defaultValue={editVendor?.contactPerson}
                      placeholder="คุณธนากร สมบูรณ์"
                      className="impeccable-input pl-10 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="impeccable-label">
                    เบอร์โทรศัพท์ (Phone Number)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      name="phone"
                      defaultValue={editVendor?.phone}
                      placeholder="02-345-6789 หรือ 081-xxx-xxxx"
                      className="impeccable-input pl-10 font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="impeccable-label">
                  ที่อยู่สำหรับออกเอกสารใบสั่งซื้อ (Billing & Delivery Address)
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3.5 pointer-events-none text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <textarea
                    name="address"
                    rows="3"
                    defaultValue={editVendor?.address}
                    placeholder="เลขที่ อาคาร ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์"
                    className="impeccable-input pl-10 font-medium leading-relaxed resize-none"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-white shadow-xs">
          <span className="text-xs text-slate-400 font-medium">
            <span className="text-rose-500">*</span> ฟิลด์ที่จำเป็นต้องกรอก
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="vendor-form"
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : (editVendor ? 'บันทึกการแก้ไข' : 'บันทึกผู้ขายใหม่')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
