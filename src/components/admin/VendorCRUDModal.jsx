import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { modalService } from '../../services/modalService';
import { 
  Store, X, Building2, Phone, User, FileText, 
  MapPin, Hash, Check, Sparkles, AlertTriangle 
} from 'lucide-react';

export default function VendorCRUDModal({ editVendor: propEditVendor, vendor, vendors = [], currentRole, onClose, onRefresh }) {
  const editVendor = propEditVendor || vendor;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
        
        {/* ── 1. Fixed Header (Sticky Top / Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-2xs shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base tracking-tight">
                  {editVendor ? 'แก้ไขข้อมูลผู้จัดจำหน่าย / คู่ค้า' : 'เพิ่มผู้จัดจำหน่ายใหม่'}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {dept === 'BOTH' ? 'ใช้ร่วมกันทุกแผนก' : `แผนก ${dept}`}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                {editVendor ? `รหัสคู่ค้า: ${editVendor.code} • ${editVendor.name}` : 'กำหนดข้อมูลรายละเอียดคู่ค้า ผู้ติดต่อ และที่อยู่สำหรับออก PO'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 2. Scrollable Content Body (Flex-1 / Dynamic Height) ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0 custom-scrollbar bg-slate-50/30">
          <form id="vendor-form" onSubmit={handleSaveVendor} className="space-y-5">
            
            {/* Section 1: ข้อมูลบริษัท & รหัสคู่ค้า */}
            <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200/60">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>1. ข้อมูลบริษัทคู่ค้า (Company Details)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      รหัสผู้ขาย (Vendor Code) <span className="text-rose-500">*</span>
                    </label>
                    {isCodeDuplicate && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-500" /> รหัสซ้ำ!
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
                      className={`w-full h-11 pl-10 pr-3 bg-white border rounded-xl text-xs font-mono font-bold uppercase tracking-wide placeholder:font-normal placeholder:text-slate-400 focus:outline-none transition-all ${
                        isCodeDuplicate 
                          ? 'border-rose-400 text-rose-900 bg-rose-50/30 focus:ring-2 focus:ring-rose-500/20' 
                          : 'border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    ขอบเขตแผนกที่ใช้ร่วม (Department Scope) <span className="text-rose-500">*</span>
                  </label>
                  {lockedDept ? (
                    <div className={`h-11 border rounded-xl px-3.5 text-xs font-bold flex items-center gap-2 ${
                      lockedDept === 'PD' ? 'bg-blue-50/80 border-blue-200 text-blue-800' : 'bg-amber-50/80 border-amber-200 text-amber-800'
                    }`}>
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>{lockedDept === 'PD' ? 'เฉพาะฝ่ายผลิต (PD)' : 'เฉพาะฝ่าย QC (QC)'}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <select
                        name="department"
                        defaultValue={editVendor?.department || 'BOTH'}
                        className="w-full h-11 pl-10 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                      >
                        <option value="BOTH">ใช้ร่วมกันทุกแผนก (BOTH)</option>
                        <option value="PD">เฉพาะฝ่ายผลิต (Production - PD)</option>
                        <option value="QC">เฉพาะฝ่าย QC (Quality Control - QC)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Vendor Company Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  ชื่อบริษัท / ร้านค้าผู้จำหน่าย <span className="text-rose-500">*</span>
                </label>
                <input
                  name="name"
                  defaultValue={editVendor?.name}
                  placeholder="เช่น บริษัท วัสดุอุตสาหกรรมไทย จำกัด"
                  required
                  className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Tax ID */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  เลขประจำตัวผู้เสียภาษี (Tax ID)
                </label>
                <input
                  name="taxId"
                  defaultValue={editVendor?.taxId}
                  placeholder="เช่น 0105562012345 (ถ้ามี)"
                  className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Section 2: ผู้ติดต่อ & ที่อยู่ */}
            <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200/60">
                <User className="w-4 h-4 text-indigo-600" />
                <span>2. ข้อมูลการติดต่อ & ที่อยู่ (Contact & Billing Address)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    ชื่อผู้ติดต่อหลัก (Contact Person)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      name="contactPerson"
                      defaultValue={editVendor?.contactPerson}
                      placeholder="เช่น คุณสมศักดิ์ (ฝ่ายขาย)"
                      className="w-full h-11 pl-10 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    เบอร์โทรศัพท์ (Phone Number)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      name="phone"
                      defaultValue={editVendor?.phone}
                      placeholder="เช่น 02-123-4567 หรือ 081-999-8888"
                      className="w-full h-11 pl-10 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  ที่อยู่สำหรับออกเอกสารสั่งซื้อ & ส่งสินค้า
                </label>
                <textarea
                  name="address"
                  rows="3"
                  defaultValue={editVendor?.address}
                  placeholder="เลขที่ อาคาร ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                />
              </div>
            </div>

          </form>
        </div>

        {/* ── 3. Sticky Action Footer (Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0 z-20">
          <span className="text-xs text-slate-500 font-medium">
            <span className="text-rose-500 font-bold">*</span> จำเป็นต้องระบุข้อมูล
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="vendor-form"
              disabled={isSaving || isCodeDuplicate}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : (editVendor ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ขายใหม่')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
