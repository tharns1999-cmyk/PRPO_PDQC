import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { modalService } from '../../services/modalService';
import { 
  Store, X, Building2, Phone, User, FileText, 
  MapPin, Hash, Check, Sparkles, AlertTriangle 
} from 'lucide-react';

export default function VendorCRUDModal({ editVendor, vendors = [], currentRole, onClose, onRefresh }) {
  const isSupervisor = !currentRole.canViewAllDepts;
  const lockedDept = isSupervisor ? currentRole.department : null;
  const [vendorCode, setVendorCode] = useState(editVendor?.code || '');
  const [isSaving, setIsSaving] = useState(false);

  const allVendors = useMemo(() => {
    return vendors.length > 0 ? vendors : storageService.getVendors();
  }, [vendors]);

  const isCodeDuplicate = useMemo(() => {
    const cleanCode = vendorCode.trim().toUpperCase();
    if (!cleanCode) return false;
    return allVendors.some(v => v.id !== editVendor?.id && (v.code || '').trim().toUpperCase() === cleanCode);
  }, [vendorCode, allVendors, editVendor]);

  const handleSaveVendor = async (e) => {
    e.preventDefault();
    if (isCodeDuplicate) {
      return modalService.warning('รหัสผู้ขายนี้มีอยู่ในระบบแล้ว', 'กรุณาระบุรหัสผู้ขายใหม่ที่ไม่ซ้ำกับรายอื่น');
    }

    setIsSaving(true);
    try {
      const formData = new FormData(e.target);
      const vendorObj = {
        id: editVendor?.id || '',
        code: (formData.get('code') || vendorCode)?.trim().toUpperCase(),
        name: formData.get('name')?.trim(),
        contactPerson: formData.get('contactPerson')?.trim(),
        phone: formData.get('phone')?.trim(),
        taxId: formData.get('taxId')?.trim(),
        department: lockedDept || formData.get('department'),
        address: formData.get('address')?.trim()
      };

      await apiService.saveVendor(vendorObj);
      modalService.success('บันทึกผู้ขายเรียบร้อย', `บันทึกข้อมูลผู้ขาย "${vendorObj.name}" สำเร็จ`);
      onClose();
      onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const dept = editVendor?.department || lockedDept || 'BOTH';

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-2 print:hidden animate-fade-in">
      <div className="modal-content w-full max-w-2xl max-h-[90vh] bg-white rounded-sm shadow-md border-2 border-slate-300 ring-1 ring-black/10 overflow-hidden flex flex-col animate-zoom-in text-slate-800">
        
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 sm:px-8 py-5 border-b border-slate-300 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-12 h-12 rounded-sm bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
              <Store className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  {editVendor ? 'แก้ไขข้อมูลผู้ขาย' : 'เพิ่มผู้ขายใหม่'}
                </h3>
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-200/80 text-slate-700 border border-slate-300 uppercase tracking-wider">
                  {dept === 'BOTH' ? 'ใช้ร่วมกันทุกแผนก' : `แผนก ${dept}`}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 truncate">
                {editVendor ? `รหัสคู่ค้า: ${editVendor.code} • ${editVendor.name}` : 'กำหนดข้อมูลรายละเอียดคู่ค้าและที่อยู่สำหรับออกใบสั่งซื้อ'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-sm hover:bg-white hover:shadow-xs transition-colors cursor-pointer shrink-0 ml-4 border border-transparent hover:border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Form Content ── */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 custom-scrollbar bg-[#f8fafc]">
          <form id="vendor-form" onSubmit={handleSaveVendor} className="space-y-6 text-sm">
            
            {/* Section 1: ข้อมูลบริษัท & แผนก */}
            <div className="bg-white p-3 sm:p-4 rounded-sm border border-slate-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 pb-3 border-b border-slate-200">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>ข้อมูลบริษัทคู่ค้า (Company Details)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="impeccable-label">
                      รหัสผู้ขาย (Vendor Code) <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {isCodeDuplicate && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>รหัสซ้ำ!</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      name="code"
                      value={vendorCode}
                      onChange={e => setVendorCode(e.target.value)}
                      placeholder="เช่น VND-TH-001"
                      required
                      className={`impeccable-input pl-10 font-mono font-bold uppercase tracking-wider ${
                        isCodeDuplicate 
                          ? 'border-rose-400 text-rose-900 bg-rose-50/40 ring-2 ring-rose-500/20 focus:border-rose-500' 
                          : 'text-indigo-950'
                      }`}
                    />
                  </div>
                  {isCodeDuplicate ? (
                    <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>รหัสผู้ขายนี้มีในระบบแล้ว กรุณาระบุรหัสอื่น</span>
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="impeccable-label mb-1.5 block text-slate-700 font-bold">
                    แผนกที่ใช้งาน (Department Scope) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  {lockedDept ? (
                    <div className={`w-full border rounded-sm px-3 py-1.5 text-sm font-bold flex items-center gap-2 ${
                      lockedDept === 'PD' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'
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
                        className="impeccable-input pl-10 font-bold text-slate-800"
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
                  ชื่อบริษัท / ผู้ขาย (Vendor / Supplier Name) <span className="text-rose-500 font-bold">*</span>
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
                    className="impeccable-input pl-10 font-bold text-slate-900"
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
            <div className="bg-white p-3 sm:p-4 rounded-sm border border-slate-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 pb-3 border-b border-slate-200">
                <Phone className="w-4 h-4 text-indigo-600" />
                <span>ข้อมูลติดต่อและสถานที่ (Contact & Address)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-6 sm:px-8 py-4 sm:py-5 border-t border-slate-300 bg-white shadow-xs">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
            <span className="text-rose-500 font-bold">*</span> จำเป็นต้องระบุข้อมูล
          </span>
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm transition-all cursor-pointer shadow-2xs"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="vendor-form"
              disabled={isSaving || isCodeDuplicate}
              className="px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-sm shadow-md shadow-indigo-600/30 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>{editVendor ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ขายใหม่'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
