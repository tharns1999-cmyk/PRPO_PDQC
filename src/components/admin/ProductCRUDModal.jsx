import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/apiService';
import { 
  Package, X, Building2, Tag, Layers, MapPin, Hash, 
  Coins, Clock, AlertTriangle, Boxes, Store, Sparkles, Check, Lightbulb
} from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';

const COMMON_PURCHASE_UNITS = ['ถัง (200L)', 'แกลลอน (20L)', 'ลัง', 'กล่อง', 'ถุง', 'ม้วน', 'ชุด', 'ชิ้น'];
const COMMON_STOCK_UNITS = ['ลิตร', 'มล.', 'กก.', 'กรัม', 'ชิ้น', 'คู่', 'แผ่น', 'ม้วน', 'ขวด', 'กระป๋อง'];

export default function ProductCRUDModal({ editProd, vendors = [], currentRole, onClose, onRefresh }) {
  const isSupervisor = !currentRole.canViewAllDepts;
  const lockedCategory = isSupervisor ? currentRole.department : null;

  const [purchaseUnit, setPurchaseUnit] = useState(editProd?.purchaseUnit || editProd?.unit || 'ชิ้น');
  const [stockUnit, setStockUnit] = useState(editProd?.stockUnit || editProd?.unit || 'ชิ้น');
  const [conversionRate, setConversionRate] = useState(editProd?.conversionRate ?? 1);
  const [selectedSupplierId, setSelectedSupplierId] = useState(editProd?.supplierId || '');
  const [isSaving, setIsSaving] = useState(false);

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
    setIsSaving(true);
    try {
      const formData = new FormData(e.target);
      const pUnit = formData.get('purchaseUnit')?.trim() || purchaseUnit || 'ชิ้น';
      const sUnit = formData.get('stockUnit')?.trim() || stockUnit || 'ชิ้น';
      const convRate = Number(formData.get('conversionRate')) || Number(conversionRate) || 1;

      const prodObj = {
        id: editProd?.id || '',
        code: formData.get('code')?.trim().toUpperCase(),
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
        location: formData.get('location')?.trim() || 'A-01',
        supplierId: selectedSupplierId || null
      };

      await apiService.saveProduct(prodObj);
      onClose();
      onRefresh();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const category = editProd?.category || lockedCategory || 'PD';
  const deptColor = category === 'QC'
    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    : 'bg-blue-500/15 text-blue-300 border-blue-500/30';

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-3 sm:p-4 print:hidden animate-fade-in">
      <div className="modal-content w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-zoom-in text-slate-800">
        
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold shadow-inner shrink-0">
              <Package className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {editProd ? 'แก้ไขข้อมูลสินค้า (Edit Product)' : 'เพิ่มสินค้าใหม่ (Add New Product)'}
                </h3>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${deptColor}`}>
                  {category === 'PD' ? 'ฝ่ายผลิต (PD)' : 'ฝ่ายควบคุมคุณภาพ (QC)'}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5 font-medium truncate">
                {editProd ? `รหัสสินค้า: ${editProd.code} • ${editProd.name}` : 'กำหนดข้อมูลสินค้า สเปก ราคา และจุดสั่งซื้อ ROP'}
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
          <form id="product-form" onSubmit={handleSaveProduct} className="space-y-6 text-sm">
            
            {/* ── SECTION 1: ข้อมูลทั่วไป (General Info) ── */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider pb-2 border-b border-slate-100">
                <Tag className="w-4 h-4 text-indigo-600" />
                <span>1. ข้อมูลพื้นฐานสินค้า (Basic Details)</span>
              </div>

              {/* Code & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="impeccable-label">
                    รหัสสินค้า (Item Code) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      name="code"
                      defaultValue={editProd?.code}
                      placeholder="เช่น PD-OIL-068 หรือ QC-BUF-001"
                      required
                      className="impeccable-input pl-10 font-mono font-bold uppercase tracking-wider text-indigo-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="impeccable-label">
                    แผนกเจ้าของสต็อก (Department) <span className="text-rose-500">*</span>
                  </label>
                  {lockedCategory ? (
                    <div className={`w-full border rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 ${
                      lockedCategory === 'PD' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>{lockedCategory === 'PD' ? 'ฝ่ายผลิต (Production - PD)' : 'ฝ่ายควบคุมคุณภาพ (QC/Lab)'}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <select
                        name="category"
                        defaultValue={editProd?.category || 'PD'}
                        className="impeccable-input pl-10 font-semibold"
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
                <label className="impeccable-label">
                  ชื่อสินค้า / สเปก / รายการ (Product Name & Specification) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Package className="w-4 h-4" />
                  </div>
                  <input
                    name="name"
                    defaultValue={editProd?.name}
                    placeholder="เช่น น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)"
                    required
                    className="impeccable-input pl-10 font-medium"
                  />
                </div>
              </div>

              {/* Preferred Supplier with Autocomplete */}
              <div>
                <label className="impeccable-label">
                  ผู้ขายหลักที่แนะนำ (Preferred Supplier - ค้นหาอัตโนมัติ)
                </label>
                <SearchableSelect
                  options={supplierOptions}
                  value={selectedSupplierId}
                  onChange={val => setSelectedSupplierId(val)}
                  placeholder="-- ค้นหาหรือเลือกผู้ขายหลัก --"
                  searchPlaceholder="พิมพ์ชื่อบริษัทผู้ขาย รหัส หรือเบอร์โทร..."
                  emptyMessage="ไม่พบข้อมูลผู้ขาย"
                />
              </div>
            </div>

            {/* ── SECTION 2: ราคาและหน่วยนับ (Pricing & Unit Conversion) ── */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider pb-2 border-b border-slate-100">
                <Coins className="w-4 h-4 text-indigo-600" />
                <span>2. ราคา หน่วยจัดซื้อ และหน่วยคลัง (Pricing & Unit Conversion)</span>
              </div>

              {/* Price and Lead Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Price per Purchase Unit */}
                <div>
                  <label className="impeccable-label">
                    ราคาต่อหน่วยซื้อ (฿ / {purchaseUnit}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
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
                      className="impeccable-input pl-8 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    * ราคาต่อ 1 {purchaseUnit} ที่สั่งซื้อจาก Supplier
                  </span>
                </div>

                {/* Lead Time */}
                <div>
                  <label className="impeccable-label">
                    ระยะเวลาจัดส่ง (Lead Time - วัน)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <input
                      type="number"
                      name="leadTimeDays"
                      min="1"
                      max="365"
                      defaultValue={editProd?.leadTimeDays ?? 7}
                      required
                      className="impeccable-input pl-10 font-medium"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    * วันที่ต้องสั่งล่วงหน้าก่อนของหมด
                  </span>
                </div>
              </div>

              {/* Unit Configuration Grid (Purchase Unit, Stock Unit, Conversion Rate) */}
              <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/80 space-y-4">
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>การแปลงหน่วยนับ (2-Way Unit Mapping)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Purchase Unit */}
                  <div>
                    <label className="impeccable-label">
                      หน่วยสั่งซื้อ (Purchase Unit) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="purchaseUnit"
                      value={purchaseUnit}
                      onChange={e => setPurchaseUnit(e.target.value)}
                      placeholder="เช่น ถัง, กล่อง, ลัง"
                      required
                      className="impeccable-input font-medium bg-white"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {COMMON_PURCHASE_UNITS.slice(0, 4).map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setPurchaseUnit(u)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                            purchaseUnit === u
                              ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stock Unit */}
                  <div>
                    <label className="impeccable-label">
                      หน่วยคลัง/เบิก (Stock Unit) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="stockUnit"
                      value={stockUnit}
                      onChange={e => setStockUnit(e.target.value)}
                      placeholder="เช่น ลิตร, ชิ้น, ม้วน"
                      required
                      className="impeccable-input font-medium bg-white"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {COMMON_STOCK_UNITS.slice(0, 4).map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setStockUnit(u)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                            stockUnit === u
                              ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conversion Rate */}
                  <div>
                    <label className="impeccable-label">
                      อัตราการแปลง (Conversion Rate) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="conversionRate"
                      min="0.001"
                      step="any"
                      value={conversionRate}
                      onChange={e => setConversionRate(e.target.value)}
                      required
                      className="impeccable-input font-mono font-bold text-center text-indigo-950 bg-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block text-center">
                      1 {purchaseUnit || 'หน่วยซื้อ'} = {conversionRate || 1} {stockUnit || 'หน่วยเบิก'}
                    </span>
                  </div>
                </div>

                {/* Conversion Live Preview Callout */}
                <div className="p-3 bg-white rounded-xl border border-indigo-200/80 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    <span className="font-semibold text-slate-600">สรุปอัตราการแปลง:</span>
                    <span className="font-bold text-indigo-900 font-mono">
                      1 {purchaseUnit} = {conversionRate} {stockUnit}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    Number(conversionRate) === 1
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {Number(conversionRate) === 1 ? '1:1 (หน่วยเดียวกัน)' : 'แปลงอัตโนมัติเมื่อรับเข้า'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── SECTION 3: คลังสินค้า & จุดสั่งซื้อ (Inventory & ROP) ── */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  <span>3. การควบคุมสต็อกและตำแหน่งจัดเก็บ (Inventory & Storage)</span>
                </div>
                {editProd && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    สต็อกปัจจุบัน: {editProd.stockBalance} {editProd.unit}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ROP */}
                <div>
                  <label className="impeccable-label flex items-center justify-between">
                    <span>จุดสั่งซื้อ ROP (Reorder Point) <span className="text-rose-500">*</span></span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-500">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <input
                      type="number"
                      name="reorderPoint"
                      min="0"
                      step="any"
                      defaultValue={editProd?.reorderPoint ?? 10}
                      required
                      className="impeccable-input pl-10 font-mono font-bold text-amber-700 bg-amber-50/40 border-amber-200 focus:border-amber-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-snug flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 inline" />
                    <span>เมื่อสต็อกคงเหลือ <span className="font-semibold text-slate-700">≤ ROP</span> ระบบจะขึ้นเตือนให้เปิดใบขอซื้อ (PR) โดยอัตโนมัติ</span>
                  </p>
                </div>

                {/* Storage Location */}
                <div>
                  <label className="impeccable-label">
                    ตำแหน่งจัดเก็บในคลัง (Storage Location) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <input
                      name="location"
                      defaultValue={editProd?.location || 'Zone A-01'}
                      placeholder="เช่น Rack A-01, Shelf B-02, Cabinet L-01"
                      required
                      className="impeccable-input pl-10 font-medium"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    * ระบุชื่อตู้, ชั้นวาง หรือโซนจัดเก็บเพื่อให้ค้นหาได้รวดเร็ว
                  </p>
                </div>
              </div>

              {/* Initial Stock (Only on creation) */}
              {!editProd && (
                <div className="mt-4 p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      จำนวนสต็อกเริ่มต้น (Opening Balance)
                    </span>
                    <p className="text-[11px] text-indigo-700/80">
                      ยอดสินค้าที่มีอยู่ในคลังจริง ณ ปัจจุบัน
                    </p>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      name="stockBalance"
                      min="0"
                      step="any"
                      defaultValue={0}
                      required
                      className="impeccable-input font-mono font-bold text-center text-indigo-950 bg-white"
                    />
                  </div>
                </div>
              )}
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
              form="product-form"
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : (editProd ? 'บันทึกการแก้ไข' : 'บันทึกสินค้าใหม่')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
