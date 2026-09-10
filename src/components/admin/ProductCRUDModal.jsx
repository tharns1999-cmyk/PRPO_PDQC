import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { modalService } from '../../services/modalService';
import { 
  Package, X, Building2, Tag, Hash, 
  Coins, Clock, AlertTriangle, Boxes, Sparkles, Check,
  ArrowRight, Repeat, Info, MapPin, Plus, Edit3, Trash2
} from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';
import StorageLocationCRUDModal from './StorageLocationCRUDModal';
import DeleteLocationModal from './DeleteLocationModal';
import { useAppContext } from '../../context/AppContext';

const COMMON_PURCHASE_UNITS = ['ถัง (200L)', 'แกลลอน (20L)', 'ลัง', 'กล่อง', 'ถุง', 'ม้วน', 'ชุด', 'ชิ้น'];
const COMMON_STOCK_UNITS = ['ลิตร', 'มล.', 'กก.', 'กรัม', 'ชิ้น', 'คู่', 'แผ่น', 'ม้วน', 'ขวด', 'กระป๋อง'];

export default function ProductCRUDModal({
  editProd: propEditProd,
  product,
  products = [],
  vendors = [],
  departments: propDepartments,
  storageLocations = [],
  currentRole,
  onClose,
  onRefresh
}) {
  const context = useAppContext();
  const rawDepartments = propDepartments || context?.departments;
  const deptList = useMemo(() => {
    const list = (rawDepartments && rawDepartments.length > 0) ? rawDepartments : (storageService.getDepartments?.() || []);
    return (list || []).filter(d => d.status === 'active' || d.isActive !== false);
  }, [rawDepartments]);

  const editProd = propEditProd || product;
  const isSupervisor = !currentRole?.canViewAllDepts;
  const lockedCategory = isSupervisor ? currentRole?.department : null;

  const [itemCode, setItemCode] = useState(editProd?.code || '');
  const [category, setCategory] = useState(() => editProd?.category || lockedCategory || deptList[0]?.code || 'PD');
  const [purchaseUnit, setPurchaseUnit] = useState(editProd?.purchaseUnit || editProd?.unit || 'ชิ้น');
  const [stockUnit, setStockUnit] = useState(editProd?.stockUnit || editProd?.unit || 'ชิ้น');
  const [conversionRate, setConversionRate] = useState(editProd?.conversionRate ?? 1);
  const [selectedSupplierId, setSelectedSupplierId] = useState(editProd?.supplierId || '');
  const [selectedLocationId, setSelectedLocationId] = useState(editProd?.locationId || '');
  const [locsList, setLocsList] = useState(() => (storageLocations && storageLocations.length > 0) ? storageLocations : (storageService.getStorageLocations?.() || []));
  const [showCreateLocModal, setShowCreateLocModal] = useState(false);
  const [editLocItem, setEditLocItem] = useState(null);
  const [deleteLocItem, setDeleteLocItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (storageLocations && storageLocations.length > 0) {
      setLocsList(storageLocations);
    } else {
      setLocsList(storageService.getStorageLocations?.() || []);
    }
  }, [storageLocations]);

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
      if (currentRole?.canViewAllDepts) return true;
      return v.department === currentRole?.department || v.department === 'BOTH';
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

  // Filter locations visible to product category
  const locationOptions = useMemo(() => {
    const activeCat = lockedCategory || category || deptList[0]?.code || 'PD';
    const filtered = locsList.filter(l => (l.department === activeCat || l.department === 'ALL'));
    return [
      { value: '', label: '-- ยังไม่ระบุจุดจัดเก็บสินค้า --', subLabel: 'สามารถเลือกหรือระบุภายหลังได้' },
      ...filtered.map(l => {
        const dObj = deptList.find(d => d.code === l.department || d.id === l.department);
        return {
          value: l.id,
          label: l.name,
          badge: l.department === 'ALL' ? 'ส่วนกลาง' : (dObj ? dObj.name : `แผนก ${l.department}`),
          keywords: `${l.name} ${l.department}`
        };
      })
    ];
  }, [locsList, lockedCategory, category, deptList]);

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
      const selectedLoc = locsList.find(l => l.id === selectedLocationId);

      const prodObj = {
        id: editProd?.id || '',
        code: (formData.get('code') || itemCode)?.trim().toUpperCase(),
        name: formData.get('name')?.trim(),
        category: lockedCategory || category || formData.get('category'),
        purchaseUnit: pUnit,
        stockUnit: sUnit,
        conversionRate: convRate > 0 ? convRate : 1,
        unit: sUnit, // Primary unit in stock for backward compatibility
        price: Number(formData.get('price')) || 0,
        stockBalance: editProd ? (editProd.stockBalance || 0) : (Number(formData.get('stockBalance')) || 0),
        reorderPoint: Number(formData.get('reorderPoint')) || 0,
        leadTimeDays: Number(formData.get('leadTimeDays')) || 7,
        supplierId: selectedSupplierId || null,
        locationId: selectedLocationId || null,
        locationName: selectedLoc ? selectedLoc.name : (selectedLocationId ? selectedLocationId : null)
      };

      await apiService.saveProduct(prodObj);
      modalService.success('บันทึกสินค้าเรียบร้อย', `บันทึกข้อมูลสินค้า "${prodObj.name}" สำเร็จ`);
      onClose();
      if (onRefresh) onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const activeCategory = editProd?.category || category || lockedCategory || 'PD';
  const deptBadgeClass = activeCategory === 'QC'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
        <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
          
          {/* ── 1. Fixed Header (Sticky Top / Non-scrollable) ── */}
          <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4 sticky top-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-2xs shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-lg tracking-tight">
                    {editProd ? 'แก้ไขข้อมูลสินค้า Master Data' : 'เพิ่มสินค้าใหม่ใน Master Data'}
                  </h3>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${deptBadgeClass}`}>
                    {activeCategory === 'PD' ? 'ฝ่ายผลิต (PD)' : 'ฝ่ายควบคุมคุณภาพ (QC)'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {editProd ? (
                    <>
                      <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/80">
                        {editProd.code}
                      </span>
                      <span className="text-xs text-slate-500 truncate max-w-md">
                        {editProd.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">
                      กำหนดข้อมูลสเปกสินค้า หน่วยนับ ราคา และจุดสั่งซื้อ ROP
                    </span>
                  )}
                </div>
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
          <div className="flex-1 overflow-y-auto max-h-[72vh] p-6 space-y-6 min-h-0 custom-scrollbar bg-slate-50/30">
            <form id="product-form" onSubmit={handleSaveProduct} className="space-y-6">
              
              {/* ── SECTION 1: ข้อมูลพื้นฐานสินค้า ── */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider pb-2 border-b border-slate-200/60">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <span>1. ข้อมูลพื้นฐานสินค้า (Basic Product Specs)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SKU / Item Code */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <span>รหัสสินค้า (SKU / Item Code)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      {isCodeDuplicate && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-rose-500" /> รหัสซ้ำ!
                        </span>
                      )}
                    </div>
                    <div className="relative flex rounded-xl shadow-2xs">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-600 text-xs font-mono font-bold select-none">
                        SKU
                      </span>
                      <input
                        name="code"
                        value={itemCode}
                        onChange={e => setItemCode(e.target.value)}
                        placeholder="เช่น PD-OIL-068"
                        required
                        className={`w-full h-10 px-3.5 bg-white border rounded-r-xl text-xs sm:text-sm font-mono font-bold uppercase tracking-wide placeholder:font-normal placeholder:text-slate-400 focus:outline-none transition-all ${
                          isCodeDuplicate 
                            ? 'border-rose-400 text-rose-900 bg-rose-50/30 focus:ring-2 focus:ring-rose-500/20' 
                            : 'border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      แผนกเจ้าของสต็อก (Department) <span className="text-rose-500">*</span>
                    </label>
                    {lockedCategory ? (
                      <div className="h-10 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3.5 text-xs font-semibold flex items-center justify-between shadow-2xs select-none">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>
                            {(() => {
                              const d = deptList.find(item => item.code === lockedCategory || item.id === lockedCategory);
                              return d ? `${d.name} (${d.code})` : lockedCategory;
                            })()}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                          {lockedCategory}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          name="category"
                          value={category}
                          onChange={e => setCategory(e.target.value)}
                          className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
                        >
                          {deptList.map(d => (
                            <option key={d.code} value={d.code}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Name */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    ชื่อสินค้า / สเปกแบบละเอียด <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="name"
                    defaultValue={editProd?.name}
                    placeholder="เช่น น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)"
                    required
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                  />
                </div>

                {/* Preferred Supplier */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    ผู้ขายหลักที่แนะนำ (Preferred Supplier)
                  </label>
                  <SearchableSelect
                    options={supplierOptions}
                    value={selectedSupplierId}
                    onChange={val => setSelectedSupplierId(val)}
                    placeholder="-- ค้นหาหรือเลือกผู้ขายหลัก (ปล่อยว่างเพื่อให้จัดซื้อเลือก) --"
                    searchPlaceholder="พิมพ์ชื่อบริษัทผู้ขาย รหัส หรือเบอร์โทร เพื่อค้นหา..."
                    emptyMessage="ไม่พบข้อมูลผู้ขาย"
                    buttonClassName="h-10 text-xs sm:text-sm font-medium"
                  />
                </div>

                {/* Storage Location Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>จุดจัดเก็บสินค้า (Storage Location)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCreateLocModal(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มจุดเก็บใหม่</span>
                    </button>
                  </div>
                  <SearchableSelect
                    options={locationOptions}
                    value={selectedLocationId}
                    onChange={val => setSelectedLocationId(val)}
                    placeholder="-- ค้นหาหรือเลือกจุดจัดเก็บสินค้า --"
                    searchPlaceholder="พิมพ์ชื่อจุดจัดเก็บ..."
                    emptyMessage="ไม่พบข้อมูลจุดจัดเก็บ"
                    buttonClassName="h-10 text-xs sm:text-sm font-medium"
                    onAddOption={() => setShowCreateLocModal(true)}
                    addOptionLabel="เพิ่มจุดจัดเก็บใหม่"
                    onEditOption={(opt) => {
                      const l = locsList.find(loc => loc.id === opt.value);
                      if (l) setEditLocItem(l);
                    }}
                    onDeleteOption={(opt) => {
                      const l = locsList.find(loc => loc.id === opt.value);
                      if (l) setDeleteLocItem(l);
                    }}
                  />
                </div>
              </div>

              {/* ── SECTION 2: ระบบแปลงหน่วยนับ (Unit Conversion System) ── */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <Repeat className="w-4 h-4 text-indigo-600" />
                    <span>2. ระบบแปลงหน่วยนับ (Unit Conversion)</span>
                  </div>
                  <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-100">
                    รองรับหน่วยซื้อ & ตัดสต็อกย่อย
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Purchase Unit (หน่วยซื้อ) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      หน่วยใหญ่ที่จัดซื้อ (Purchase Unit) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="purchaseUnit"
                      value={purchaseUnit}
                      onChange={e => setPurchaseUnit(e.target.value)}
                      placeholder="เช่น ถัง (200L) หรือ กล่อง"
                      required
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {COMMON_PURCHASE_UNITS.map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setPurchaseUnit(u)}
                          className={`px-2 py-0.5 text-xs rounded-lg border transition-all cursor-pointer ${
                            purchaseUnit === u
                              ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stock Unit (หน่วยเบิกจ่าย) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      หน่วยย่อยในสต็อก (Stock Unit) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="stockUnit"
                      value={stockUnit}
                      onChange={e => setStockUnit(e.target.value)}
                      placeholder="เช่น ลิตร หรือ ชิ้น"
                      required
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {COMMON_STOCK_UNITS.map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setStockUnit(u)}
                          className={`px-2 py-0.5 text-xs rounded-lg border transition-all cursor-pointer ${
                            stockUnit === u
                              ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Conversion Multiplier & Equation Capsule */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                  <div className="sm:col-span-1">
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      อัตราแปลงหน่วย (Conversion Rate) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="conversionRate"
                      min="0.0001"
                      step="any"
                      value={conversionRate}
                      onChange={e => setConversionRate(e.target.value)}
                      required
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                  </div>

                  {/* Formula Capsule */}
                  <div className="sm:col-span-2">
                    <div className="bg-white border border-slate-200/80 rounded-xl py-2 px-4 text-center font-mono text-xs font-bold text-indigo-900 shadow-2xs flex items-center justify-center gap-2">
                      <span className="text-slate-500 font-sans font-medium text-xs">สูตรแปลง:</span>
                      <span>1 {purchaseUnit || 'หน่วยซื้อ'} = {conversionRate || 1} {stockUnit || 'หน่วยสต็อก'}</span>
                    </div>
                  </div>
                </div>

                {/* Live Preview Callout */}
                <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs flex items-center gap-2 text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="text-slate-600">
                    สั่งซื้อ <span className="font-mono font-bold text-slate-900">1 {purchaseUnit || 'หน่วยซื้อ'}</span> ระบบจะรับเข้าสต็อก <span className="font-mono font-bold text-emerald-700">{conversionRate || 1} {stockUnit || 'หน่วยสต็อก'}</span> อัตโนมัติ
                  </div>
                </div>
              </div>

              {/* ── SECTION 3: ราคา & จุดสั่งซื้อ (Price & ROP) ── */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    <span>3. ราคาประเมิน & การควบคุมสต็อก (Pricing & ROP Control)</span>
                  </div>
                  {editProd && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
                      คงเหลือในคลัง: {editProd.stockBalance} {editProd.stockUnit || editProd.unit}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      ราคาประเมิน/หน่วย (฿) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex rounded-xl shadow-2xs">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-xs font-mono font-bold select-none">
                        ฿
                      </span>
                      <input
                        type="number"
                        name="price"
                        min="0"
                        step="any"
                        defaultValue={editProd?.price ?? 100}
                        required
                        className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-r-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      ระยะเวลาส่งมอบ (Lead Time วัน)
                    </label>
                    <input
                      type="number"
                      name="leadTimeDays"
                      min="1"
                      defaultValue={editProd?.leadTimeDays ?? 7}
                      required
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      จุดสั่งซื้อ ROP (Reorder Point) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="reorderPoint"
                      min="0"
                      step="any"
                      defaultValue={editProd?.reorderPoint ?? 10}
                      required
                      className="w-full h-10 px-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Initial Stock (Only on creation) */}
                {!editProd && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        จำนวนสต็อกเริ่มต้น (Opening Stock Balance)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ระบุจำนวนคงเหลือในคลังจริงเริ่มต้น (หน่วย: {stockUnit || 'หน่วยสต็อก'})
                      </p>
                    </div>
                    <div className="w-full sm:w-36">
                      <input
                        type="number"
                        name="stockBalance"
                        min="0"
                        step="any"
                        defaultValue={0}
                        required
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-center text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                  </div>
                )}
              </div>

            </form>
          </div>

          {/* ── 3. Sticky Action Footer (Non-scrollable) ── */}
          <div className="shrink-0 px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between sticky bottom-0 z-20">
            <span className="text-xs text-slate-400 font-medium">
              <span className="text-rose-500 font-bold">*</span> จำเป็นต้องระบุข้อมูล
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={isSaving || isCodeDuplicate}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'กำลังบันทึก...' : (editProd ? 'บันทึกการแก้ไข' : 'บันทึกสินค้าใหม่')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCreateLocModal && (
        <StorageLocationCRUDModal
          departments={deptList}
          storageLocations={locsList}
          currentRole={currentRole}
          onClose={() => setShowCreateLocModal(false)}
          onCreated={(newLoc) => {
            setLocsList(prev => [newLoc, ...prev.filter(l => l.id !== newLoc.id)]);
            setSelectedLocationId(newLoc.id);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {editLocItem && (
        <StorageLocationCRUDModal
          departments={deptList}
          location={editLocItem}
          storageLocations={locsList}
          currentRole={currentRole}
          onClose={() => setEditLocItem(null)}
          onSaved={(updatedLoc) => {
            setLocsList(prev => prev.map(l => l.id === updatedLoc.id ? updatedLoc : l));
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {deleteLocItem && (
        <DeleteLocationModal
          location={deleteLocItem}
          products={allProducts}
          storageLocations={locsList}
          currentRole={currentRole}
          onClose={() => setDeleteLocItem(null)}
          onDeleted={(deletedId) => {
            setLocsList(prev => prev.filter(l => l.id !== deletedId));
            if (selectedLocationId === deletedId) {
              setSelectedLocationId('');
            }
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </>,
    document.body
  );
}
