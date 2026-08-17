import React, { useState, useMemo } from 'react';
import { Database, Plus, Edit3, Trash2, ShieldAlert, Building2, Search, X, Package, Store, PenTool } from 'lucide-react';
import ProductCRUDModal from '../components/admin/ProductCRUDModal';
import VendorCRUDModal from '../components/admin/VendorCRUDModal';
import SignatureManagerSection from '../components/admin/SignatureManagerSection';
import { storageService } from '../services/storageService';

export default function MasterDataView({ products, vendors, currentRole, onRefresh }) {
  const [activeTab, setActiveTab] = useState('products');
  const [showProdModal, setShowProdModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [editVendor, setEditVendor] = useState(null);

  // Search & Dept Filter States
  const [prodSearch, setProdSearch] = useState('');
  const [prodCategoryFilter, setProdCategoryFilter] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorDeptFilter, setVendorDeptFilter] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);

  const canSeeAll = currentRole?.canViewAllDepts;
  const myDept = currentRole?.department;

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesDeptRole = canSeeAll || p.category === myDept;
      const matchesCategory = prodCategoryFilter === 'ALL' || p.category === prodCategoryFilter;
      const q = prodSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        p.code?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
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

  // Access check
  if (!currentRole?.canManageMaster) {
    return (
      <div className="w-full my-12 text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-4 animate-fade-in-up">
        <div className="p-4 bg-rose-100 text-rose-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">ไม่มีสิทธิ์เข้าถึง</h3>
        <p className="text-sm text-slate-600">
          บทบาท <b>{currentRole?.title}</b> ไม่ได้รับอนุญาตให้จัดการ Master Data
        </p>
      </div>
    );
  }

  const handleDeleteProduct = (prod) => {
    if (!currentRole.canDeleteMaster) return;
    if (!window.confirm(`ยืนยันการลบสินค้า "${prod.name}" ออกจากระบบ?`)) return;
    const prods = storageService.getProducts().filter(p => p.id !== prod.id);
    storageService.saveProducts(prods);
    onRefresh();
  };

  const handleDeleteVendor = (vendor) => {
    if (!currentRole.canDeleteMaster) return;
    if (!window.confirm(`ยืนยันการลบผู้ขาย "${vendor.name}" ออกจากระบบ?`)) return;
    const vends = storageService.getVendors().filter(v => v.id !== vendor.id);
    storageService.saveVendors(vends);
    onRefresh();
  };

  const deptBadge = (dept) => {
    if (!dept) return null;
    const colors = {
      PD: 'bg-blue-50 text-blue-600 border-blue-100',
      QC: 'bg-amber-50 text-amber-600 border-amber-100',
      BOTH: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    };
    return (
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colors[dept] || 'bg-slate-100 text-slate-600'}`}>
        {dept}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <Database className="w-5 h-5 text-indigo-600" />
            จัดการข้อมูลหลัก (Master Data)
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            {canSeeAll
              ? 'จัดการและค้นหารายการสินค้าและข้อมูลผู้ขาย (Vendor) ทุกแผนก'
              : `สิทธิ์เฉพาะแผนก ${myDept} — เพิ่ม/แก้ไขข้อมูลสินค้าและ Vendor ของคุณ`}
          </p>
        </div>
      </div>

      {!canSeeAll && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800 font-semibold">
            คุณกำลังมองเห็นและจัดการ Master Data ของแผนก <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md">{myDept}</span>
          </p>
        </div>
      )}

      {/* Tabs & Insight Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${activeTab === 'products' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Package className="w-4 h-4" />
            รายการสินค้า ({filteredProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${activeTab === 'vendors' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Store className="w-4 h-4" />
            ผู้ขาย / Vendor ({filteredVendors.length})
          </button>
          {(currentRole?.canFinalApprove || currentRole?.id === 'ADMIN' || currentRole?.level >= 2) && (
            <button
              onClick={() => setActiveTab('signatures')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${activeTab === 'signatures' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <PenTool className="w-4 h-4" />
              จัดการลายเซ็น (E-Sign)
            </button>
          )}
        </div>

        {/* Action Button */}
        {activeTab === 'products' ? (
          <button
            onClick={() => { setEditProd(null); setShowProdModal(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> เพิ่มสินค้าใหม่
          </button>
        ) : activeTab === 'vendors' ? (
          <button
            onClick={() => { setEditVendor(null); setShowVendorModal(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> เพิ่มผู้ขายใหม่
          </button>
        ) : null}
      </div>

      {/* Product Master View */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            {canSeeAll && (
              <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl">
                <button
                  onClick={() => setProdCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${prodCategoryFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                  ทุกแผนก
                </button>
                <button
                  onClick={() => setProdCategoryFilter('PD')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${prodCategoryFilter === 'PD' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                  ฝ่ายผลิต (PD)
                </button>
                <button
                  onClick={() => setProdCategoryFilter('QC')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${prodCategoryFilter === 'QC' ? 'bg-white text-amber-600 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                  ควบคุมคุณภาพ (QC)
                </button>
              </div>
            )}

            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหารหัสสินค้า, ชื่อ, ตำแหน่ง..."
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
              {prodSearch && (
                <button onClick={() => setProdSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="impeccable-card overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
                  <tr className="text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <th className="p-4 pl-6 bg-slate-100">รหัส</th>
                    <th className="p-4 bg-slate-100">ชื่อสินค้า</th>
                    <th className="p-4 bg-slate-100">แผนก</th>
                    <th className="p-4 bg-slate-100">หน่วยนับ</th>
                    <th className="p-4 text-right bg-slate-100">ราคา/หน่วย</th>
                    <th className="p-4 text-right bg-slate-100">ROP</th>
                    <th className="p-4 text-right bg-slate-100">Lead Time</th>
                    <th className="p-4 text-center pr-6 bg-slate-100">การกระทำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {filteredProducts.map(p => {
                    const pUnit = p.purchaseUnit || p.unit || 'ชิ้น';
                    const sUnit = p.stockUnit || p.unit || pUnit;
                    const rate = Number(p.conversionRate) > 0 ? Number(p.conversionRate) : 1;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="p-4 pl-6 font-mono font-medium text-slate-600">{p.code}</td>
                        <td className="p-4 font-semibold text-slate-800">{p.name}</td>
                        <td className="p-4">{deptBadge(p.category)}</td>
                        <td className="p-4 text-slate-600">
                          <span className="font-semibold text-slate-800">{pUnit}</span>
                          {rate > 1 && (
                            <span className="block text-[11px] text-indigo-600 font-mono mt-0.5">
                              1 {pUnit} = {rate} {sUnit}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right font-semibold text-slate-700">฿{p.price?.toLocaleString()} / {pUnit}</td>
                        <td className="p-4 text-right font-medium text-slate-500">{p.reorderPoint} {sUnit}</td>
                        <td className="p-4 text-right text-slate-500">{p.leadTimeDays || 7} วัน</td>
                        <td className="p-4 pr-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setEditProd(p); setShowProdModal(true); }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {currentRole.canDeleteMaster && (
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="ลบ (Admin only)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Master View */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            {canSeeAll && (
              <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl">
                <button
                  onClick={() => setVendorDeptFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${vendorDeptFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                  ทุกแผนก
                </button>
                <button
                  onClick={() => setVendorDeptFilter('PD')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${vendorDeptFilter === 'PD' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                  PD (ผลิต)
                </button>
                <button
                  onClick={() => setVendorDeptFilter('QC')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${vendorDeptFilter === 'QC' ? 'bg-white text-amber-600 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                >
                  QC (แล็บ)
                </button>
              </div>
            )}

            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้ขาย, เบอร์โทร, เลขภาษี..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
              {vendorSearch && (
                <button onClick={() => setVendorSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="impeccable-card overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
                  <tr className="text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <th className="p-4 pl-6 bg-slate-100">รหัส</th>
                    <th className="p-4 bg-slate-100">ชื่อผู้ขาย / บริษัท</th>
                    <th className="p-4 bg-slate-100">แผนก</th>
                    <th className="p-4 bg-slate-100">ผู้ติดต่อ</th>
                    <th className="p-4 bg-slate-100">เบอร์โทร</th>
                    <th className="p-4 text-center pr-6 bg-slate-100">การกระทำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {filteredVendors.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="p-4 pl-6 font-mono font-medium text-slate-600">{v.code}</td>
                      <td className="p-4 font-semibold text-slate-800">{v.name}</td>
                      <td className="p-4">{deptBadge(v.department || 'BOTH')}</td>
                      <td className="p-4 text-slate-600">{v.contactPerson}</td>
                      <td className="p-4 font-mono text-slate-600">{v.phone}</td>
                      <td className="p-4 pr-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setEditVendor(v); setShowVendorModal(true); }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {currentRole.canDeleteMaster && (
                            <button
                              onClick={() => handleDeleteVendor(v)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="ลบ (Admin only)"
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
          </div>
        </div>
      )}

      {/* E-Signatures Management View */}
      {activeTab === 'signatures' && (
        <SignatureManagerSection currentRole={currentRole} onRefresh={onRefresh} />
      )}

      {/* Product Modal */}
      {showProdModal && (
        <ProductCRUDModal
          editProd={editProd}
          vendors={vendors}
          currentRole={currentRole}
          onClose={() => { setShowProdModal(false); setEditProd(null); }}
          onRefresh={onRefresh}
        />
      )}

      {/* Vendor Modal */}
      {showVendorModal && (
        <VendorCRUDModal
          editVendor={editVendor}
          currentRole={currentRole}
          onClose={() => { setShowVendorModal(false); setEditVendor(null); }}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
