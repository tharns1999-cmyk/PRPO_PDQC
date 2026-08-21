import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { modalService } from '../../services/modalService';
import { 
  Package, X, Building2, Tag, Hash, 
  Coins, Clock, AlertTriangle, Boxes, Sparkles, Check, Lightbulb,
  ArrowRight, Repeat, Info
} from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';

const COMMON_PURCHASE_UNITS = ['ถัง (200L)', 'แกลลอน (20L)', 'ลัง', 'กล่อง', 'ถุง', 'ม้วน', 'ชุด', 'ชิ้น'];
const COMMON_STOCK_UNITS = ['ลิตร', 'มล.', 'กก.', 'กรัม', 'ชิ้น', 'คู่', 'แผ่น', 'ม้วน', 'ขวด', 'กระป๋อง'];

export default function ProductCRUDModal({ editProd, products = [], vendors = [], currentRole, onClose, onRefresh }) {
  const isSupervisor = !currentRole.canViewAllDepts;
  const lockedCategory = isSupervisor ? currentRole.department : null;

  const [itemCode, setItemCode] = useState(editProd?.code || '');
  const [purchaseUnit, setPurchaseUnit] = useState(editProd?.purchaseUnit || editProd?.unit || 'ชิ้น');
  const [stockUnit, setStockUnit] = useState(editProd?.stockUnit || editProd?.unit || 'ชิ้น');
  const [conversionRate, setConversionRate] = useState(editProd?.conversionRate ?? 1);
  const [selectedSupplierId, setSelectedSupplierId] = useState(editProd?.supplierId || '');
  const [isSaving, setIsSaving] = useState(false);

  // Duplicate Item Code Check (Case-insensitive + trimmed)
  const allProducts = useMemo(() => {
    return products.length > 0 ? products : storageService.getProducts();
  }, [products]);

  const isCodeDuplicate = useMemo(() => {
    const cleanCode = itemCode.trim().toUpperCase();
    if (!cleanCode) return false;
    return allProducts.some(p => p.id !== editProd?.id && (p.code || '').trim().toUpperCase() === cleanCode);
  }, [itemCode, allProducts, editProd]);

  // Filter vendors visible to this role
  const visibleVendors = useMemo(() => {
    return vendors.filter(v => {
      if (currentRole.canViewAllDepts) return true;
      return v.department === currentRole.department || v.department === 'BOTH';
    });
  }, [vendors, currentRole]);

  const supplierOptions = useMemo(() => {
    return [
      { value: '', label: '-- ไม่ระบุผู้ขายหลัก (จัดซื้อจะเลือกในใบขอซื้อ PR) --', subLabel: 'ปล่อยว่างไว้เพื่อให้ฝ่ายจัดซื้อเสนอราคา' },
      ...visibleVendors.map(v => ({
        value: v.id,
        label: v.name,
        code: v.code,
        subLabel: `ผู้ติดต่อ: ${v.contactPerson || '-'} • โทร: ${v.phone || '-'}`,
        badge: v.department === 'BOTH' ? 'ใช้ร่วมกัน' : `เฉพาะ ${v.department}`,
        keywords: `${v.code} ${v.name} ${v.contactPerson} ${v.phone}`
      }))
    ];
  }, [visibleVendors]);

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (isCodeDuplicate) {
      return modalService.warning('รหัสสินค้านี้มีอยู่ในระบบแล้ว', 'กรุณาระบุรหัสสินค้าใหม่ที่ไม่ซ้ำกับสินค้าอื่น');
    }

    setIsSaving(true);
    try {
      const formData = new FormData(e.target);
      const pUnit = formData.get('purchaseUnit')?.trim() || purchaseUnit || 'ชิ้น';
      const sUnit = formData.get('stockUnit')?.trim() || stockUnit || 'ชิ้น';
      const convRate = Number(formData.get('conversionRate')) || Number(conversionRate) || 1;

      const prodObj = {
        id: editProd?.id || '',
        code: (formData.get('code') || itemCode)?.trim().toUpperCase(),
        name: formData.get('name')?.trim(),
        category: lockedCategory || formData.get('category'),
        purchaseUnit: pUnit,
        stockUnit: sUnit,
        conversionRate: convRate > 0 ? convRate : 1,
        unit: sUnit, // Primary unit in stock for backward compatibility
        price: Number(formData.get('price')) || 0,
        stockBalance: editProd ? (editProd.stockBalance || 0) : (Number(formData.get('stockBalance')) || 0),
        reorderPoint: Number(formData.get('reorderPoint')) || 0,
        leadTimeDays: Number(formData.get('leadTimeDays')) || 7,
        supplierId: selectedSupplierId || null
      };

      await apiService.saveProduct(prodObj);
      modalService.success('บันทึกสินค้าเรียบร้อย', `บันทึกข้อมูลสินค้า "${prodObj.name}" สำเร็จ`);
      onClose();
      onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const category = editProd?.category || lockedCategory || 'PD';
  const deptColor = category === 'QC'
    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
    : 'bg-blue-500/20 text-blue-300 border-blue-400/40';

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-3 sm:p-6 print:hidden animate-fade-in">
      <div className="modal-content w-full max-w-4xl max-h-[92vh] bg-white rounded-sm shadow-md border-2 border-slate-300 ring-1 ring-black/10 overflow-hidden flex flex-col animate-zoom-in text-slate-800">
        
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              <Package className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-400" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {editProd ? 'แก้ไขข้อมูลสินค้า (Edit Product)' : 'เพิ่มสินค้าใหม่ (Add New Product)'}
                </h3>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${deptColor}`}>
                  {category === 'PD' ? 'ฝ่ายผลิต (PD)' : 'ฝ่ายควบคุมคุณภาพ (QC)'}
                </span>
              </div>
              <p className="text-sm text-indigo-200/90 font-medium truncate">
                {editProd ? `รหัสสินค้า: ${editProd.code} • ${editProd.name}` : 'กำหนดข้อมูลสินค้า สเปก ราคา และจุดสั่งซื้อ ROP'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white p-2.5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-3"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── Form Content ── */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-7 custom-scrollbar bg-[#f8fafc]">
          <form id="product-form" onSubmit={handleSaveProduct} className="space-y-7 text-slate-800">
            
            {/* ── SECTION 1: ข้อมูลทั่วไป (General Info) ── */}
            <div className="bg-white p-6 sm:p-7 rounded-sm border border-slate-300 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-indigo-950 pb-3.5 border-b border-slate-100">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-sm">
                  <Tag className="w-5 h-5" />
                </div>
                <span>1. ข้อมูลพื้นฐานสินค้า (Basic Details)</span>
              </div>

              {/* Code & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm sm:text-[15px] font-bold text-slate-800">
                      รหัสสินค้า (Item Code) <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {isCodeDuplicate && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>รหัสซ้ำในระบบ!</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-5 h-5" />
                    </div>
                    <input
                      name="code"
                      value={itemCode}
                      onChange={e => setItemCode(e.target.value)}
                      placeholder="เช่น PD-OIL-068 หรือ QC-BUF-001"
                      required
                      className={`w-full h-12 pl-11 pr-4 bg-white border rounded-sm text-base sm:text-lg font-mono font-bold uppercase tracking-wider placeholder:text-slate-400 placeholder:font-normal placeholder:text-sm focus:outline-none shadow-xs transition-all ${
                        isCodeDuplicate 
                          ? 'border-rose-400 text-rose-900 bg-rose-50/40 ring-2 ring-rose-500/20 focus:border-rose-500' 
                          : 'border-slate-300 text-indigo-950 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                      }`}
                    />
                  </div>
                  {isCodeDuplicate ? (
                    <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>รหัสสินค้านี้ถูกใช้งานแล้ว กรุณาระบุรหัสอื่นที่ไม่ซ้ำ</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      * รหัสเฉพาะสำหรับอ้างอิงในสต็อกการ์ดและใบขอซื้อ
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm sm:text-[15px] font-bold text-slate-800 mb-2">
                    แผนกเจ้าของสต็อก (Department) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  {lockedCategory ? (
                    <div className={`w-full h-12 border rounded-sm px-4 text-base font-bold flex items-center gap-2.5 ${
                      lockedCategory === 'PD' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                      <Building2 className="w-5 h-5 shrink-0" />
                      <span>{lockedCategory === 'PD' ? 'ฝ่ายผลิต (Production - PD)' : 'ฝ่ายควบคุมคุณภาพ (QC/Lab)'}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <select
                        name="category"
                        defaultValue={editProd?.category || 'PD'}
                        className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-sm text-base font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition-all cursor-pointer"
                      >
                        <option value="PD">ฝ่ายผลิต (Production - PD)</option>
                        <option value="QC">ฝ่ายควบคุมคุณภาพ (Quality Control - QC)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm sm:text-[15px] font-bold text-slate-800 mb-2">
                  ชื่อสินค้า / สเปก / รายการ (Product Name & Specification) <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Package className="w-5 h-5" />
                  </div>
                  <input
                    name="name"
                    defaultValue={editProd?.name}
                    placeholder="เช่น น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)"
                    required
                    className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-sm text-base font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition-all"
                  />
                </div>
              </div>

              {/* Preferred Supplier with Autocomplete */}
              <div>
                <label className="block text-sm sm:text-[15px] font-bold text-slate-800 mb-2">
                  ผู้ขายหลักที่แนะนำ (Preferred Supplier)
                </label>
                <SearchableSelect
                  options={supplierOptions}
                  value={selectedSupplierId}
                  onChange={val => setSelectedSupplierId(val)}
                  placeholder="-- ค้นหาหรือเลือกผู้ขายหลัก (ไม่บังคับ) --"
                  searchPlaceholder="พิมพ์ชื่อบริษัทผู้ขาย รหัส หรือเบอร์โทร เพื่อค้นหา..."
                  emptyMessage="ไม่พบข้อมูลผู้ขายที่ตรงกับคำค้นหา"
                  buttonClassName="h-12 text-base font-medium"
                />
              </div>
            </div>

            {/* ── SECTION 2: ราคาและหน่วยนับ (Pricing & Unit Conversion) ── */}
            <div className="bg-white p-6 sm:p-7 rounded-sm border border-slate-300 shadow-xs space-y-6">
              <div className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-indigo-950 pb-3.5 border-b border-slate-100">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-sm">
                  <Coins className="w-5 h-5" />
                </div>
                <span>2. ราคาและการแปลงหน่วยนับ (Pricing & Unit Conversion)</span>
              </div>

              {/* Base Unit Rule Banner */}
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-sm flex items-start gap-1.5 shadow-2xs">
                <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-amber-900 leading-relaxed font-medium">
                  <span className="font-bold text-amber-950">ข้อกำหนดหน่วยนับขั้นต่ำ (Base Unit Rule): </span>
                  ช่องหน่วยนับขั้นต่ำของสินค้าทุกตัว <strong className="text-amber-950 underline">ต้องใส่เป็นหน่วยที่เล็กที่สุดที่นับได้จริง</strong> เช่น ถุงมือต้องใช้หน่วยเป็น <strong>ชิ้น</strong> (ห้ามใส่เป็นคู่หรือกล่อง), ของเหลวต้องใช้หน่วยเป็น <strong>ลิตร</strong> (ห้ามใส่เป็นแกลลอนหรือถัง)
                </div>
              </div>

              {/* Price and Lead Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Price per Purchase Unit */}
                <div>
                  <label className="block text-sm sm:text-[15px] font-bold text-slate-800 mb-2">
                    ราคาต่อหน่วยซื้อ (฿ / {purchaseUnit || 'หน่วยซื้อ'}) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 font-bold text-base">
                      ฿
                    </div>
                    <input
                      type="number"
                      name="price"
                      min="0"
                      step="0.01"
                      defaultValue={editProd?.price ?? 100}
                      required
                      placeholder="0.00"
                      className="w-full h-12 pl-9 pr-4 bg-white border border-slate-300 rounded-sm text-base sm:text-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition-all"
                    />
                  </div>
                </div>

                {/* Lead Time */}
                <div>
                  <label className="block text-sm sm:text-[15px] font-bold text-slate-800 mb-2">
                    ระยะเวลาจัดส่ง (Lead Time - วัน) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      name="leadTimeDays"
                      min="1"
                      max="365"
                      defaultValue={editProd?.leadTimeDays ?? 7}
                      required
                      className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-sm text-base font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Unit Configuration Box (Purchase Unit, Base Unit, Conversion Rate) */}
              <div className="p-2 bg-white rounded-sm border border-slate-300 shadow-2xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-600 text-white rounded-sm shadow-xs shadow-indigo-200">
                      <Repeat className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-indigo-950">การจับคู่แปลงหน่วยนับ (Purchase & Base Unit)</h4>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium">กำหนดหน่วยตอนเปิดใบสั่งซื้อ (PR/PO) และหน่วยนับขั้นต่ำเพื่อคำนวณรับเข้าสต็อก</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide border transition-all ${
                    Number(conversionRate) === 1
                      ? 'bg-white text-slate-700 border-slate-300'
                      : 'bg-indigo-100 text-indigo-900 border-indigo-300 shadow-xs'
                  }`}>
                    {Number(conversionRate) === 1 ? 'อัตราส่วน 1 : 1 (หน่วยเดียวกัน)' : `1 หน่วยซื้อ = ${conversionRate} หน่วยขั้นต่ำ`}
                  </span>
                </div>

                {/* 3-Column Harmonized Card Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-stretch">
                  {/* 1. Purchase Unit */}
                  <div className="flex flex-col justify-between bg-white p-2 rounded-sm border border-slate-300 shadow-2xs hover:border-indigo-300 transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-bold text-slate-800 flex items-center gap-1">
                          <span>หน่วยสั่งซื้อ (Purchase)</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">PR / PO</span>
                      </div>
                      <input
                        name="purchaseUnit"
                        value={purchaseUnit}
                        onChange={e => setPurchaseUnit(e.target.value)}
                        placeholder="เช่น ถัง, กล่อง, ลัง"
                        required
                        className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-sm text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-500 block mb-2">หน่วยซื้อที่พบบ่อย:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_PURCHASE_UNITS.slice(0, 5).map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setPurchaseUnit(u)}
                            className={`text-xs px-2.5 py-1.5 rounded-sm transition-all cursor-pointer font-medium ${
                              purchaseUnit === u
                                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 2. Base Unit (Smallest unit) */}
                  <div className="flex flex-col justify-between bg-white p-2 rounded-sm border border-slate-300 shadow-2xs hover:border-indigo-300 transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-bold text-slate-800 flex items-center gap-1">
                          <span>หน่วยนับขั้นต่ำ (Base Unit)</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">เล็กที่สุด</span>
                      </div>
                      <input
                        name="stockUnit"
                        value={stockUnit}
                        onChange={e => setStockUnit(e.target.value)}
                        placeholder="เช่น ลิตร, ชิ้น, กรัม"
                        required
                        className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-sm text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-500 block mb-2">หน่วยขั้นต่ำที่พบบ่อย:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_STOCK_UNITS.slice(0, 5).map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setStockUnit(u)}
                            className={`text-xs px-2.5 py-1.5 rounded-sm transition-all cursor-pointer font-medium ${
                              stockUnit === u
                                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. Conversion Rate */}
                  <div className="flex flex-col justify-between bg-white p-2 rounded-sm border border-indigo-100/90 shadow-xs hover:border-indigo-300 transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-bold text-slate-800 flex items-center gap-1">
                          <span>อัตราการแปลง (Rate)</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">ตัวคูณรับเข้า</span>
                      </div>
                      <input
                        type="number"
                        name="conversionRate"
                        min="0.001"
                        step="any"
                        value={conversionRate}
                        onChange={e => setConversionRate(e.target.value)}
                        required
                        className="w-full h-11 px-3.5 bg-indigo-50/50 border border-indigo-200 rounded-sm text-lg font-mono font-black text-center text-indigo-950 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col justify-center">
                      <span className="text-xs font-bold text-slate-500 block mb-1.5 text-center">สมการการแปลงหน่วย:</span>
                      <div className="p-2 bg-indigo-50/70 rounded-sm border border-indigo-100 text-center">
                        <span className="text-xs sm:text-sm font-mono font-bold text-indigo-950">
                          1 {purchaseUnit || 'หน่วยซื้อ'} = {conversionRate || 1} {stockUnit || 'หน่วยขั้นต่ำ'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Conversion Banner Callout */}
                <div className="p-4 bg-white rounded-sm border border-indigo-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 text-sm">
                    <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 mr-2">ตัวอย่างผลลัพธ์:</span>
                      <span className="font-bold text-slate-900 font-mono inline-flex items-center gap-1.5 flex-wrap">
                        สั่งซื้อ <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-bold">1 {purchaseUnit || 'หน่วยซื้อ'}</span>
                        <ArrowRight className="w-4 h-4 text-indigo-400 inline" />
                        ระบบจะรับเข้าคลัง <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">{conversionRate || 1} {stockUnit || 'หน่วยขั้นต่ำ'}</span>
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                    ✓ คำนวณตัดสต็อกและรับเข้าอัตโนมัติ
                  </span>
                </div>
              </div>
            </div>

            {/* ── SECTION 3: คลังสินค้า & จุดสั่งซื้อ (Inventory & ROP) ── */}
            <div className="bg-white p-6 sm:p-7 rounded-sm border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-indigo-950">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-sm">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <span>3. การควบคุมสต็อกและจุดสั่งซื้อ (Inventory Control & ROP)</span>
                </div>
                {editProd && (
                  <span className="text-sm font-bold px-3.5 py-1.5 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    สต็อกปัจจุบัน: <span className="font-mono text-emerald-950">{editProd.stockBalance}</span> {editProd.stockUnit || editProd.unit}
                  </span>
                )}
              </div>

              <div>
                {/* ROP */}
                <label className="block text-sm sm:text-[15px] font-bold text-slate-800 mb-2">
                  จุดสั่งซื้อ ROP (Reorder Point) <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-amber-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <input
                    type="number"
                    name="reorderPoint"
                    min="0"
                    step="any"
                    defaultValue={editProd?.reorderPoint ?? 10}
                    required
                    className="w-full h-12 pl-11 pr-4 bg-amber-50/40 border border-amber-300 rounded-sm text-base sm:text-lg font-mono font-bold text-amber-900 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs transition-all"
                  />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed flex items-start gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>เมื่อยอดคงเหลือในคลัง <span className="font-bold text-amber-900">≤ จุดสั่งซื้อ (ROP)</span> ระบบจะแจ้งเตือนให้เปิดใบขอซื้อ (PR) อัตโนมัติ</span>
                </p>
              </div>

              {/* Initial Stock (Only on creation) */}
              {!editProd && (
                <div className="mt-4 p-5 rounded-sm bg-indigo-50/80 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      จำนวนสต็อกเริ่มต้น (Opening Balance)
                    </span>
                    <p className="text-xs sm:text-sm text-indigo-800/80 font-medium">
                      ยอดสินค้าที่มีอยู่ในคลังจริง ณ ปัจจุบัน (หน่วย: {stockUnit || 'หน่วยขั้นต่ำ'})
                    </p>
                  </div>
                  <div className="w-full sm:w-40">
                    <input
                      type="number"
                      name="stockBalance"
                      min="0"
                      step="any"
                      defaultValue={0}
                      required
                      className="w-full h-12 bg-white border border-indigo-200 rounded-sm text-lg font-mono font-bold text-center text-indigo-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-6 sm:px-8 py-5 border-t border-slate-200 bg-white shadow-xs">
          <span className="text-xs sm:text-sm text-slate-500 font-medium">
            <span className="text-rose-500 font-bold">*</span> จำเป็นต้องระบุข้อมูล
          </span>
          <div className="flex items-center gap-1.5.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-sm transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={isSaving || isCodeDuplicate}
              className="px-6 sm:px-8 py-2.5 sm:py-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-sm shadow-sm shadow-indigo-600/30 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Check className="w-5 h-5" />
              <span>{isSaving ? 'กำลังบันทึก...' : (editProd ? 'บันทึกการแก้ไข' : 'บันทึกสินค้าใหม่')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

