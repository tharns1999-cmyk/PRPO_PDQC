import React, { useState, useMemo, useEffect } from 'react';
import { Database, Plus, Edit3, Trash2, ShieldAlert, Building2, Search, X, Package, Store, PenTool, MapPin, Layers, Boxes, DoorClosed } from 'lucide-react';
import ProductCRUDModal from '../components/admin/ProductCRUDModal';
import VendorCRUDModal from '../components/admin/VendorCRUDModal';
import StorageLocationCRUDModal from '../components/admin/StorageLocationCRUDModal';
import DeleteLocationModal from '../components/admin/DeleteLocationModal';
import UsageUnitCRUDModal from '../components/admin/UsageUnitCRUDModal';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { modalService } from '../services/modalService';
import Pagination from '../components/common/Pagination';

export default function MasterDataView({ products = [], vendors = [], storageLocations: initialLocations = [], usageUnits: initialUnits = [], currentRole, onRefresh, onSaveUsageUnit, onDeleteUsageUnit }) {
  const [activeTab, setActiveTab] = useState('products');
  const [showProdModal, setShowProdModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showUsageUnitModal, setShowUsageUnitModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [editVendor, setEditVendor] = useState(null);
  const [editLocation, setEditLocation] = useState(null);
  const [editUsageUnit, setEditUsageUnit] = useState(null);
  const [deleteLocationItem, setDeleteLocationItem] = useState(null);
  const [locsList, setLocsList] = useState(() => {
    if (initialLocations && initialLocations.length > 0) return initialLocations;
    return storageService.getStorageLocations?.() || [];
  });
  const [unitsList, setUnitsList] = useState(() => {
    if (initialUnits && initialUnits.length > 0) return initialUnits;
    return storageService.getUsageUnits?.() || [];
  });

  useEffect(() => {
    if (initialUnits && initialUnits.length > 0) {
      setUnitsList(initialUnits);
    } else {
      setUnitsList(storageService.getUsageUnits?.() || []);
    }
  }, [initialUnits]);

  useEffect(() => {
    if (initialLocations && initialLocations.length > 0) {
      setLocsList(initialLocations);
    } else {
      setLocsList(storageService.getStorageLocations?.() || []);
    }
  }, [initialLocations, products]);

  // Search & Dept Filter States
  const [prodSearch, setProdSearch] = useState('');
  const [prodCategoryFilter, setProdCategoryFilter] = useState(currentRole?.canViewAllDepts ? 'ALL' : currentRole?.department || 'ALL');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorDeptFilter, setVendorDeptFilter] = useState(currentRole?.canViewAllDepts ? 'ALL' : currentRole?.department || 'ALL');
  const [locSearch, setLocSearch] = useState('');
  const [locDeptFilter, setLocDeptFilter] = useState(currentRole?.canViewAllDepts ? 'ALL' : currentRole?.department || 'ALL');
  const [unitSearch, setUnitSearch] = useState('');
  const [unitDeptFilter, setUnitDeptFilter] = useState(currentRole?.canViewAllDepts ? 'ALL' : currentRole?.department || 'ALL');

  // Pagination states
  const [prodPage, setProdPage] = useState(1);
  const prodPageSize = 10;
  const [vendorPage, setVendorPage] = useState(1);
  const vendorPageSize = 10;
  const [locPage, setLocPage] = useState(1);
  const locPageSize = 10;
  const [unitPage, setUnitPage] = useState(1);
  const unitPageSize = 10;

  // Auto-resets on filter/search change
  useEffect(() => { setProdPage(1); }, [prodCategoryFilter, prodSearch]);
  useEffect(() => { setVendorPage(1); }, [vendorDeptFilter, vendorSearch]);
  useEffect(() => { setLocPage(1); }, [locDeptFilter, locSearch]);
  useEffect(() => { setUnitPage(1); }, [unitDeptFilter, unitSearch]);

  const canSeeAll = currentRole?.canViewAllDepts;
  const myDept = currentRole?.department;
  const isAdmin = currentRole?.id === 'ADMIN' || currentRole?.roleId === 'ADMIN' || Number(currentRole?.level) >= 99;
  const canDeleteMaster = currentRole?.canDeleteMaster || currentRole?.canManageMaster || isAdmin;


  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesDeptRole = canSeeAll || p.category === myDept;
      const matchesCategory = prodCategoryFilter === 'ALL' || p.category === prodCategoryFilter;
      const q = prodSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        p.code?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.locationName?.toLowerCase().includes(q)
      );
      return matchesDeptRole && matchesCategory && matchesSearch;
    });
  }, [products, canSeeAll, myDept, prodCategoryFilter, prodSearch]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesDeptRole = canSeeAll || v.department === myDept || v.department === 'BOTH';
      const matchesDeptFilter = vendorDeptFilter === 'ALL' || v.department === vendorDeptFilter || v.department === 'BOTH';
      const q = vendorSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        v.code?.toLowerCase().includes(q) ||
        v.name?.toLowerCase().includes(q) ||
        v.contactPerson?.toLowerCase().includes(q) ||
        v.phone?.toLowerCase().includes(q) ||
        v.taxId?.toLowerCase().includes(q)
      );
      return matchesDeptRole && matchesDeptFilter && matchesSearch;
    });
  }, [vendors, canSeeAll, myDept, vendorDeptFilter, vendorSearch]);

  // Filtered Storage Locations (Clean Simple by Name)
  const filteredLocations = useMemo(() => {
    return locsList.filter(l => {
      const matchesDeptRole = canSeeAll || l.department === myDept || l.department === 'ALL';
      const matchesDeptFilter = locDeptFilter === 'ALL' || l.department === locDeptFilter;
      const q = locSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        l.name?.toLowerCase().includes(q)
      );
      return matchesDeptRole && matchesDeptFilter && matchesSearch;
    });
  }, [locsList, canSeeAll, myDept, locDeptFilter, locSearch]);

  // Paginated collections
  const prodTotalPages = Math.ceil(filteredProducts.length / prodPageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (prodPage - 1) * prodPageSize;
    return filteredProducts.slice(start, start + prodPageSize);
  }, [filteredProducts, prodPage, prodPageSize]);

  const vendorTotalPages = Math.ceil(filteredVendors.length / vendorPageSize) || 1;
  const paginatedVendors = useMemo(() => {
    const start = (vendorPage - 1) * vendorPageSize;
    return filteredVendors.slice(start, start + vendorPageSize);
  }, [filteredVendors, vendorPage, vendorPageSize]);

  const locTotalPages = Math.ceil(filteredLocations.length / locPageSize) || 1;
  const paginatedLocations = useMemo(() => {
    const start = (locPage - 1) * locPageSize;
    return filteredLocations.slice(start, start + locPageSize);
  }, [filteredLocations, locPage, locPageSize]);

  // Filtered Usage Units (Department-Scoped Rooms)
  const filteredUsageUnits = useMemo(() => {
    return unitsList.filter(u => {
      const matchesDeptRole = canSeeAll || u.department === myDept;
      const matchesDeptFilter = unitDeptFilter === 'ALL' || u.department === unitDeptFilter;
      const q = unitSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        u.name?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q)
      );
      return matchesDeptRole && matchesDeptFilter && matchesSearch;
    });
  }, [unitsList, canSeeAll, myDept, unitDeptFilter, unitSearch]);

  const unitTotalPages = Math.ceil(filteredUsageUnits.length / unitPageSize) || 1;
  const paginatedUsageUnits = useMemo(() => {
    const start = (unitPage - 1) * unitPageSize;
    return filteredUsageUnits.slice(start, start + unitPageSize);
  }, [filteredUsageUnits, unitPage, unitPageSize]);

  // Access check
  if (!currentRole?.canManageMaster) {
    return (
      <div className="w-full my-12 text-center p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4 animate-fade-in">
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center border border-rose-100">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">ไม่มีสิทธิ์เข้าถึง (Access Restricted)</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          บทบาท <b>{currentRole?.title}</b> ไม่ได้รับอนุญาตให้จัดการ Master Data
        </p>
      </div>
    );
  }

  const handleDeleteProduct = async (prod) => {
    if (!canDeleteMaster) return;
    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบสินค้า',
      message: `ต้องการลบรายการสินค้า "${prod.name}" (${prod.code}) ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบสินค้า',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;
    const prods = storageService.getProducts().filter(p => p.id !== prod.id);
    storageService.saveProducts(prods);
    modalService.success('ลบสินค้าสำเร็จ', `ลบ "${prod.name}" เรียบร้อยแล้ว`);
    onRefresh();
  };

  const handleDeleteVendor = async (vendor) => {
    if (!canDeleteMaster) return;
    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบผู้ขาย',
      message: `ต้องการลบข้อมูลผู้จัดจำหน่าย "${vendor.name}" ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบผู้ขาย',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;
    const vends = storageService.getVendors().filter(v => v.id !== vendor.id);
    storageService.saveVendors(vends);
    modalService.success('ลบผู้ขายสำเร็จ', `ลบ "${vendor.name}" เรียบร้อยแล้ว`);
    onRefresh();
  };

  // ─── Requirement 1: Data Integrity Guardrail on Delete ───
  const handleDeleteLocation = async (loc) => {
    if (!canDeleteMaster) return;
    
    // Check if any product is assigned to this storage location
    const allProds = storageService.getProducts();
    const assigned = allProds.filter(p => p.locationId === loc.id);
    
    if (assigned.length > 0) {
      return modalService.warning(
        'ไม่สามารถลบจุดเก็บนี้ได้',
        `เนื่องจากมีสินค้าผูกอยู่ ${assigned.length} รายการ กรุณาย้ายหรือเปลี่ยนจุดเก็บของสินค้าออกก่อน`
      );
    }

    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบจุดจัดเก็บ',
      message: `ต้องการลบจุดจัดเก็บสินค้า "${loc.name}" ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบจุดจัดเก็บ',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;

    try {
      await apiService.deleteStorageLocation(loc.id, currentRole?.name);
      modalService.success('ลบจุดจัดเก็บสำเร็จ', `ลบ "${loc.name}" เรียบร้อยแล้ว`);
      onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
    }
  };

  const handleDeleteUsageUnit = async (unit) => {
    if (!canDeleteMaster) return;
    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบหน่วยเบิกใช้งาน',
      message: `ต้องการลบหน่วยเบิกใช้งาน "${unit.name}" (${unit.department}) ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบหน่วยเบิก',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;
    try {
      if (onDeleteUsageUnit) {
        await onDeleteUsageUnit(unit.id);
      } else {
        await apiService.deleteUsageUnit(unit.id, currentRole?.name);
      }
      setUnitsList(prev => prev.filter(u => u.id !== unit.id));
      modalService.success('ลบหน่วยเบิกสำเร็จ', `ลบ "${unit.name}" เรียบร้อยแล้ว`);
      if (onRefresh) onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
    }
  };

  const deptBadge = (dept) => {
    if (!dept) return null;
    const colors = {
      PD: 'bg-blue-50 text-blue-700 border-blue-200/80',
      QC: 'bg-amber-50 text-amber-700 border-amber-200/80',
      BOTH: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      ALL: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[dept] || 'bg-slate-100 text-slate-600'}`}>
        {dept === 'BOTH' || dept === 'ALL' ? 'ส่วนกลาง (ALL)' : dept}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6 animate-fade-in pb-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-2xs">
                <Database className="w-5 h-5" />
              </div>
              <span>จัดการข้อมูลหลัก (Master Data)</span>
            </h2>
            {!canSeeAll && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                <Building2 className="w-4 h-4" />
                แผนก {myDept}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            {canSeeAll
              ? 'จัดการและค้นหารายการสินค้า ข้อมูลผู้ขาย (Vendor) และจุดจัดเก็บสินค้าในคลัง'
              : `สิทธิ์เฉพาะแผนก ${myDept} — เพิ่ม/แก้ไขข้อมูลสินค้า จุดจัดเก็บ และ Vendor ของคุณ`}
          </p>
        </div>

        {/* Primary Action Button in Header */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'products' ? (
            <button
              onClick={() => { setEditProd(null); setShowProdModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินค้าใหม่</span>
            </button>
          ) : activeTab === 'vendors' ? (
            <button
              onClick={() => { setEditVendor(null); setShowVendorModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มผู้ขายใหม่</span>
            </button>
          ) : activeTab === 'locations' ? (
            <button
              onClick={() => { setEditLocation(null); setShowLocationModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มจุดจัดเก็บใหม่</span>
            </button>
          ) : activeTab === 'usageUnits' ? (
            <button
              onClick={() => { setEditUsageUnit(null); setShowUsageUnitModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มหน่วยเบิกใหม่</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/60 shadow-2xs overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'products'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Package className="w-4 h-4 text-indigo-600" />
          <span>แคตตาล็อกสินค้า ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          aria-label="ผู้ขาย / Vendor"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'vendors'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Store className="w-4 h-4 text-emerald-600" />
          <span>รายชื่อผู้ขาย / ร้านค้า ({filteredVendors.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'locations'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <MapPin className="w-4 h-4 text-violet-600" />
          <span>จุดจัดเก็บสินค้า ({filteredLocations.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('usageUnits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'usageUnits'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <DoorClosed className="w-4 h-4 text-cyan-600" />
          <span>หน่วยเบิกใช้งาน / ห้อง ({filteredUsageUnits.length})</span>
        </button>
      </div>

      {/* Tab 1: Products */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {canSeeAll && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0">
                {['ALL', 'PD', 'QC'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setProdCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      prodCategoryFilter === cat
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat === 'ALL' ? 'ทุกแผนก' : cat === 'PD' ? 'ฝ่ายผลิต (PD)' : 'ฝ่าย QC'}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex-1 sm:w-80 ml-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหารหัส, ชื่อสินค้า, จุดเก็บ หรือโซน..."
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {prodSearch && (
                <button onClick={() => setProdSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5">✕</button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[580px] custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs border-b border-slate-200/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 pl-5">รหัสสินค้า</th>
                    <th className="py-3 px-4 w-1/3">ชื่อสินค้า / สเปก & จุดจัดเก็บ</th>
                    <th className="py-3 px-4">แผนก</th>
                    <th className="py-3 px-4 text-right">ราคาต่อหน่วย</th>
                    <th className="py-3 px-4 text-right">สต็อกคงเหลือ</th>
                    <th className="py-3 px-4 text-right">จุดสั่งซื้อ (ROP)</th>
                    <th className="py-3 pr-5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-6 font-mono font-bold text-slate-800 text-xs">{p.code}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50/80 text-indigo-700 border border-indigo-100">
                            <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{p.locationName || 'ไม่ระบุจุดจัดเก็บ'}</span>
                          </span>
                          {Number(p.conversionRate) > 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              1 {p.purchaseUnit || p.unit} = {p.conversionRate} {p.stockUnit || p.unit}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{deptBadge(p.category)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        ฿{p.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700 tabular-nums">
                        {p.stockBalance || 0} <span className="text-xs text-slate-400 font-sans">{p.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                        {p.reorderPoint || 0} <span className="text-xs text-slate-400 font-sans">{p.unit}</span>
                      </td>
                      <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => { setEditProd(p); setShowProdModal(true); }}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขสินค้า"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {canDeleteMaster && (
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="ลบสินค้า"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={prodPage}
              totalPages={prodTotalPages}
              totalItems={filteredProducts.length}
              pageSize={prodPageSize}
              onPageChange={setProdPage}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Vendors */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {canSeeAll && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0">
                {['ALL', 'PD', 'QC'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setVendorDeptFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      vendorDeptFilter === cat
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat === 'ALL' ? 'ทุกแผนก' : cat === 'PD' ? 'ฝ่ายผลิต (PD)' : 'ฝ่าย QC'}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex-1 sm:w-80 ml-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้ขาย, เบอร์โทร, เลขภาษี..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {vendorSearch && (
                <button onClick={() => setVendorSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5">✕</button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[580px] custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs border-b border-slate-200/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 pl-5">รหัสผู้ขาย</th>
                    <th className="py-3 px-4 w-1/3">ชื่อบริษัท / ร้านค้า</th>
                    <th className="py-3 px-4">ผู้ติดต่อ</th>
                    <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                    <th className="py-3 px-4">แผนก</th>
                    <th className="py-3 pr-5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedVendors.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-6 font-mono font-bold text-slate-800 text-xs">{v.code}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{v.name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{v.contactPerson || '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{v.phone || '-'}</td>
                      <td className="py-3.5 px-4">{deptBadge(v.department)}</td>
                      <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => { setEditVendor(v); setShowVendorModal(true); }}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขข้อมูลผู้ขาย"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {canDeleteMaster && (
                            <button
                              onClick={() => handleDeleteVendor(v)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="ลบผู้ขาย"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={vendorPage}
              totalPages={vendorTotalPages}
              totalItems={filteredVendors.length}
              pageSize={vendorPageSize}
              onPageChange={setVendorPage}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Storage Locations */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {canSeeAll && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0">
                {['ALL', 'PD', 'QC'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setLocDeptFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      locDeptFilter === cat
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat === 'ALL' ? 'ทุกแผนก' : cat === 'PD' ? 'ฝ่ายผลิต (PD)' : 'ฝ่าย QC'}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex-1 sm:w-80 ml-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อจุดจัดเก็บสินค้า..."
                value={locSearch}
                onChange={e => setLocSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {locSearch && (
                <button onClick={() => setLocSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5">✕</button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[580px] custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs border-b border-slate-200/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 pl-5 w-16">ลำดับ</th>
                    <th className="py-3 px-4 w-1/2">ชื่อจุดจัดเก็บสินค้า</th>
                    <th className="py-3 px-4">แผนกที่ใช้งาน</th>
                    <th className="py-3 px-4 text-center">จำนวนสินค้าที่จัดเก็บ</th>
                    <th className="py-3 pr-5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLocations.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-400">
                        ไม่พบข้อมูลจุดจัดเก็บสินค้าตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    paginatedLocations.map((loc, idx) => {
                      const assignedProducts = products.filter(p => p.locationId === loc.id);
                      return (
                        <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 pl-6 font-mono font-bold text-slate-400 text-xs whitespace-nowrap">
                            #{idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shrink-0 shadow-2xs">
                                <MapPin className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-slate-900 text-sm">{loc.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">{deptBadge(loc.department)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border tabular-nums ${
                              assignedProducts.length > 0
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}>
                              <Boxes className="w-3.5 h-3.5" />
                              <span>{assignedProducts.length} รายการ</span>
                            </span>
                          </td>
                          <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => { setEditLocation(loc); setShowLocationModal(true); }}
                                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
                                title="แก้ไขจุดจัดเก็บ"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {canDeleteMaster && (
                                <button
                                  onClick={() => setDeleteLocationItem(loc)}
                                  className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                                  title="ลบจุดจัดเก็บ"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={locPage}
              totalPages={locTotalPages}
              totalItems={filteredLocations.length}
              pageSize={locPageSize}
              onPageChange={setLocPage}
            />
          </div>
        </div>
      )}

      {/* Tab 4: Usage Units (Department-Scoped Rooms) */}
      {activeTab === 'usageUnits' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {canSeeAll && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setUnitDeptFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    unitDeptFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ทุกแผนก
                </button>
                <button
                  onClick={() => setUnitDeptFilter('PD')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    unitDeptFilter === 'PD'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-blue-600'
                  }`}
                >
                  ฝ่ายผลิต (PD)
                </button>
                <button
                  onClick={() => setUnitDeptFilter('QC')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    unitDeptFilter === 'QC'
                      ? 'bg-white text-amber-700 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-amber-600'
                  }`}
                >
                  ฝ่าย QC (QC)
                </button>
              </div>
            )}

            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                placeholder="ค้นหาชื่อหน่วยเบิก / ห้อง / รหัสหน่วย..."
                className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
              />
              {unitSearch && (
                <button
                  onClick={() => setUnitSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Units Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 pl-6">ชื่อหน่วยเบิก / ห้อง</th>
                    <th className="py-3.5 px-4 text-center">แผนก</th>
                    <th className="py-3.5 px-4">รหัสระบบ</th>
                    <th className="py-3.5 px-4 text-center">รูปแบบสีแท็ก (Color Pill)</th>
                    <th className="py-3.5 px-4 text-center">สถานะ</th>
                    <th className="py-3.5 pr-6 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {paginatedUsageUnits.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <DoorClosed className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">ไม่พบรายการหน่วยเบิกใช้งาน</p>
                        <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือเพิ่มหน่วยเบิกใหม่</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsageUnits.map(unit => {
                      const dot = unit.dot || 'bg-slate-500';
                      const color = unit.color || 'bg-slate-50 text-slate-700 border-slate-200/80';
                      return (
                        <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 pl-6 font-semibold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                              <span className="text-sm font-bold text-slate-800">{unit.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {deptBadge(unit.department)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                            {unit.id}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${color}`}>
                              <span className={`w-2 h-2 rounded-full ${dot}`} />
                              <span>{unit.name}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              unit.status === 'INACTIVE'
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {unit.status === 'INACTIVE' ? 'ปิดใช้งาน' : 'ใช้งานปกติ'}
                            </span>
                          </td>
                          <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => { setEditUsageUnit(unit); setShowUsageUnitModal(true); }}
                                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
                                title="แก้ไขหน่วยเบิก"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {canDeleteMaster && (
                                <button
                                  onClick={() => handleDeleteUsageUnit(unit)}
                                  className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                                  title="ลบหน่วยเบิก"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={unitPage}
              totalPages={unitTotalPages}
              totalItems={filteredUsageUnits.length}
              pageSize={unitPageSize}
              onPageChange={setUnitPage}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {showProdModal && (
        <ProductCRUDModal
          editProd={editProd}
          product={editProd}
          products={products}
          vendors={vendors}
          storageLocations={locsList}
          currentRole={currentRole}
          onClose={() => { setShowProdModal(false); setEditProd(null); }}
          onRefresh={onRefresh}
        />
      )}

      {showVendorModal && (
        <VendorCRUDModal
          editVendor={editVendor}
          vendor={editVendor}
          vendors={vendors}
          currentRole={currentRole}
          onClose={() => { setShowVendorModal(false); setEditVendor(null); }}
          onRefresh={onRefresh}
        />
      )}

      {showLocationModal && (
        <StorageLocationCRUDModal
          editLocation={editLocation}
          location={editLocation}
          storageLocations={locsList}
          currentRole={currentRole}
          onClose={() => { setShowLocationModal(false); setEditLocation(null); }}
          onSaved={(saved) => {
            setLocsList(prev => prev.map(l => l.id === saved.id ? saved : l));
            if (onRefresh) onRefresh();
          }}
          onCreated={(created) => {
            setLocsList(prev => [created, ...prev.filter(l => l.id !== created.id)]);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {deleteLocationItem && (
        <DeleteLocationModal
          location={deleteLocationItem}
          products={products}
          storageLocations={locsList}
          currentRole={currentRole}
          onClose={() => setDeleteLocationItem(null)}
          onDeleted={(deletedId) => {
            setLocsList(prev => prev.filter(l => l.id !== deletedId));
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {showUsageUnitModal && (
        <UsageUnitCRUDModal
          unit={editUsageUnit}
          usageUnits={unitsList}
          currentRole={currentRole}
          onClose={() => { setShowUsageUnitModal(false); setEditUsageUnit(null); }}
          onSaved={(saved) => {
            setUnitsList(prev => prev.map(u => u.id === saved.id ? saved : u));
            if (onRefresh) onRefresh();
          }}
          onCreated={(created) => {
            setUnitsList(prev => [created, ...prev.filter(u => u.id !== created.id)]);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
