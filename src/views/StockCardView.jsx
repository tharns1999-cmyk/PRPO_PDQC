import React, { useState, useMemo } from 'react';
import { Warehouse, AlertTriangle, PlusCircle, History, Search, PackagePlus, BarChart3, TrendingUp, Edit3, CheckCircle, X } from 'lucide-react';
import StockMovementTable from '../components/stock/StockMovementTable';
import ManualStockInModal from '../components/stock/ManualStockInModal';
import EmptyState from '../components/common/EmptyState';
import { storageService } from '../services/storageService';

export default function StockCardView({ products, stockLogs, currentRole, onQuickPR, onRefresh }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('stock-list');
  const [showManualIn, setShowManualIn] = useState(false);

  // ─── Filter & Priority Sort: Items with low stock (stockBalance <= reorderPoint) appear FIRST ───
  const sortedAndFilteredProducts = useMemo(() => {
    return products
      .filter(p => {
        const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
        const matchesSearch = !searchQuery.trim() || 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          p.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = currentRole.canViewAllDepts || p.category === currentRole.department;
        return matchesCat && matchesSearch && matchesDept;
      })
      .sort((a, b) => {
        const aLow = a.stockBalance <= a.reorderPoint ? 1 : 0;
        const bLow = b.stockBalance <= b.reorderPoint ? 1 : 0;
        if (aLow !== bLow) return bLow - aLow; // Low stock / ROP reached items placed at the VERY TOP
        const aRatio = a.reorderPoint > 0 ? (a.stockBalance / a.reorderPoint) : 999;
        const bRatio = b.reorderPoint > 0 ? (b.stockBalance / b.reorderPoint) : 999;
        if (aRatio !== bRatio) return aRatio - bRatio;
        return a.code.localeCompare(b.code);
      });
  }, [products, categoryFilter, searchQuery, currentRole]);

  // Count of items requiring reorder (ROP Reached)
  const lowStockCount = useMemo(() => {
    return products.filter(p => 
      (currentRole.canViewAllDepts || p.category === currentRole.department) && 
      p.stockBalance <= p.reorderPoint
    ).length;
  }, [products, currentRole]);

  // ── ROP Analytics Computation ──
  const ropAnalytics = useMemo(() => {
    const viewableProducts = currentRole.canViewAllDepts
      ? products
      : products.filter(p => p.category === currentRole.department);

    return viewableProducts.map(prod => {
      // Get OUT logs for this product in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentOuts = stockLogs.filter(log =>
        log.productId === prod.id &&
        log.type === 'OUT' &&
        new Date(log.date) >= thirtyDaysAgo
      );

      const totalOutQty = recentOuts.reduce((sum, l) => sum + (l.qty || 0), 0);
      const avgDailyUsage = totalOutQty / 30;
      const leadTime = prod.leadTimeDays || 7;

      // Safety Stock = avg daily * lead time * 1.5 safety factor
      const safetyStock = Math.ceil(avgDailyUsage * leadTime * 1.5);
      const suggestedROP = Math.ceil(avgDailyUsage * leadTime) + safetyStock;
      const ropGap = suggestedROP - (prod.reorderPoint || 0);

      return {
        ...prod,
        avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
        totalOut30Days: totalOutQty,
        suggestedROP,
        safetyStock,
        ropGap,
        isRopUnderSuggested: prod.reorderPoint < suggestedROP && suggestedROP > 0,
      };
    });
  }, [products, stockLogs, currentRole]);

  const handleApplyROP = (product, suggestedROP) => {
    if (!window.confirm(`ปรับ ROP ของ "${product.name}" เป็น ${suggestedROP} ${product.unit}?`)) return;
    const allProducts = storageService.getProducts();
    const idx = allProducts.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      allProducts[idx].reorderPoint = suggestedROP;
      storageService.saveProducts(allProducts);
      onRefresh();
    }
  };

  return (
    <div className="w-full space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <Warehouse className="w-5 h-5 text-indigo-600" />
            คลังสต็อก (Warehouse & Inventory)
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            บริหารจัดการสต็อกสินค้า รับเข้า-เบิกจ่าย และวิเคราะห์จุดสั่งซื้อ (ROP)
          </p>
        </div>
        {currentRole?.roleId !== 'ONLINE_PURCHASER' && (currentRole?.canReceiveGoods || currentRole?.roleId === 'ASST_MANAGER' || currentRole?.id === 'ADMIN') && (
          <button
            onClick={() => setShowManualIn(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            รับสินค้าเข้าคลัง
          </button>
        )}
      </div>

      {/* ─── Unified Control Bar (View Tabs + Department Filter + Search Bar in 1 Line) ─── */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Left: View Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl shrink-0 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('stock-list')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stock-list' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Warehouse className="w-4 h-4" />
              <span>รายการสต็อก ({products.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('rop-analysis')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'rop-analysis' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>วิเคราะห์ ROP & Safety Stock</span>
              {lowStockCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {lowStockCount}
                </span>
              )}
            </button>
          </div>

          {/* Right: Department Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 lg:max-w-xl">
            {currentRole.canViewAllDepts ? (
              <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200 shrink-0">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ทุกแผนก
                </button>
                <button
                  onClick={() => setCategoryFilter('PD')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'PD' ? 'bg-white text-blue-600 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ฝ่ายผลิต (PD)
                </button>
                <button
                  onClick={() => setCategoryFilter('QC')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'QC' ? 'bg-white text-amber-600 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ฝ่ายตรวจสอบ (QC)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 shrink-0">
                <span className="text-xs font-semibold text-slate-500">คลังแผนก:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  currentRole.department === 'PD' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}>
                  {currentRole.department}
                </span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือ รหัสสินค้า..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tab 1: Stock List View ─── */}
      {activeTab === 'stock-list' && (
        <>
          {/* ROP Alert Banner */}
          {lowStockCount > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    แจ้งเตือนสินค้าถึงจุดสั่งซื้อซ้ำ (ROP Alert)
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                      {lowStockCount} รายการที่ต้องเติมสต็อก
                    </span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    สินค้ากลุ่มนี้มีคงเหลือต่ำกว่าหรือเท่ากับจุดเตือน (ROP) ระบบได้เรียงขึ้นแสดงผลที่ลำดับแรกของตารางอัตโนมัติแล้ว
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onQuickPR && (
                  <button
                    onClick={() => {
                      const firstLow = sortedAndFilteredProducts.find(p => p.stockBalance <= p.reorderPoint);
                      if (firstLow) onQuickPR(firstLow);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/30 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    เปิด PR สั่งซื้อด่วน
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stock Table */}
          <div className="impeccable-card overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
                  <tr className="text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <th className="p-4 pl-6 bg-slate-100">รหัสสินค้า</th>
                    <th className="p-4 bg-slate-100">ชื่อสินค้า</th>
                    <th className="p-4 bg-slate-100">หมวด</th>
                    <th className="p-4 bg-slate-100">ตำแหน่งจัดเก็บ</th>
                    <th className="p-4 text-right bg-slate-100">คงเหลือปัจจุบัน</th>
                    <th className="p-4 text-right bg-slate-100">จุดเตือน (ROP)</th>
                    <th className="p-4 text-center bg-slate-100">สถานะ</th>
                    <th className="p-4 text-center pr-6 bg-slate-100">การกระทำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {sortedAndFilteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-0">
                        <EmptyState title="ไม่พบสินค้าในสต็อก" description="ไม่มีสินค้าที่ตรงกับคำค้นหา หรือกรองหมวดหมู่ผิดประเภท" />
                      </td>
                    </tr>
                  ) : (
                    sortedAndFilteredProducts.map(prod => {
                      const isLow = prod.stockBalance <= prod.reorderPoint;
                      const sUnit = prod.stockUnit || prod.unit || 'ชิ้น';
                      const pUnit = prod.purchaseUnit || prod.unit || sUnit;
                      const rate = Number(prod.conversionRate) > 0 ? Number(prod.conversionRate) : 1;
                      const purchaseEquiv = rate > 1 ? (Number(prod.stockBalance || 0) / rate) : null;
                      const purchaseEquivStr = purchaseEquiv !== null
                        ? (purchaseEquiv % 1 === 0 ? purchaseEquiv.toLocaleString() : purchaseEquiv.toFixed(1).replace(/\.0$/, ''))
                        : null;

                      return (
                        <tr 
                          key={prod.id} 
                          className={`transition-colors group ${
                            isLow 
                              ? 'bg-amber-50/80 hover:bg-amber-100/90 border-l-4 border-l-amber-500' 
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="p-4 pl-6 font-mono font-bold text-slate-700">{prod.code}</td>
                          <td className="p-4">
                            <div className="font-semibold text-slate-800 flex items-center gap-2">
                              <span>{prod.name}</span>
                              {isLow && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                                  ถึงจุด ROP
                                </span>
                              )}
                            </div>
                            {rate > 1 && (
                              <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                                อัตราแปลง: 1 {pUnit} = {rate} {sUnit}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${prod.category === 'PD' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                              {prod.category}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 font-mono text-sm">{prod.location}</td>
                          <td className={`p-4 text-right font-bold ${isLow ? 'text-amber-800 font-mono font-black text-base' : 'text-slate-700'}`}>
                            <div>
                              {Number(prod.stockBalance || 0).toLocaleString()} <span className="font-medium text-slate-500 text-xs">{sUnit}</span>
                            </div>
                            {purchaseEquivStr && (
                              <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                                ≈ {purchaseEquivStr} {pUnit}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right font-medium text-slate-500">
                            {Number(prod.reorderPoint || 0).toLocaleString()} <span className="text-xs">{sUnit}</span>
                          </td>
                          <td className="p-4 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-300 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                สต็อกต่ำ (ถึงจุด ROP)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                ปกติ
                              </span>
                            )}
                          </td>
                          <td className="p-4 pr-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedProduct(prod)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="ดูประวัติเคลื่อนไหว"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              {isLow && (
                                <button
                                  onClick={() => onQuickPR(prod)}
                                  className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-100/70 rounded-lg transition-colors"
                                  title="เปิด PR สินค้านี้ทันที"
                                >
                                  <PlusCircle className="w-4 h-4" />
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
          </div>
        </>
      )}

      {/* ─── Tab: ROP Analytics ─── */}
      {activeTab === 'rop-analysis' && (
        <div className="space-y-5">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
            <TrendingUp className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-indigo-900">สูตรคำนวณ ROP ที่แนะนำ</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                ROP แนะนำ = (ค่าเฉลี่ยการใช้ต่อวัน × Lead Time) + Safety Stock &nbsp;|&nbsp; Safety Stock = ค่าเฉลี่ยต่อวัน × Lead Time × 1.5
              </p>
              <p className="text-xs text-slate-500 mt-1">คำนวณจากประวัติการเบิก (OUT) ย้อนหลัง 30 วัน</p>
            </div>
          </div>

          <div className="impeccable-card overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
                  <tr className="text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <th className="p-4 pl-6 bg-slate-100">รหัส / ชื่อสินค้า</th>
                    <th className="p-4 text-right bg-slate-100">คงเหลือ</th>
                    <th className="p-4 text-right bg-slate-100">เบิก 30 วัน</th>
                    <th className="p-4 text-right bg-slate-100">ใช้เฉลี่ย/วัน</th>
                    <th className="p-4 text-right bg-slate-100">Lead Time</th>
                    <th className="p-4 text-right bg-slate-100">ROP ปัจจุบัน</th>
                    <th className="p-4 text-right bg-slate-100">ROP แนะนำ</th>
                    <th className="p-4 text-center bg-slate-100">สถานะ ROP</th>
                    <th className="p-4 text-center pr-6 bg-slate-100">ปรับ ROP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {ropAnalytics.map(item => (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${item.isRopUnderSuggested ? 'bg-amber-50/30' : ''}`}>
                      <td className="p-4 pl-6">
                        <div className="font-mono font-medium text-slate-500 text-xs">{item.code}</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{item.name}</div>
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-700">
                        {item.stockBalance} <span className="text-xs text-slate-400">{item.unit}</span>
                      </td>
                      <td className="p-4 text-right text-slate-600">{item.totalOut30Days} {item.unit}</td>
                      <td className="p-4 text-right text-slate-600">{item.avgDailyUsage} {item.unit}</td>
                      <td className="p-4 text-right text-slate-500">{item.leadTimeDays || 7} วัน</td>
                      <td className="p-4 text-right font-bold text-slate-700">{item.reorderPoint}</td>
                      <td className="p-4 text-right">
                        <span className={`font-bold text-sm ${item.suggestedROP > 0 ? (item.isRopUnderSuggested ? 'text-amber-600' : 'text-emerald-600') : 'text-slate-400'}`}>
                          {item.suggestedROP > 0 ? item.suggestedROP : 'N/A'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {item.suggestedROP === 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">ยังไม่มีข้อมูล</span>
                        ) : item.isRopUnderSuggested ? (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            ROP ต่ำไป
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-100">
                            <CheckCircle className="w-3.5 h-3.5" />
                            เพียงพอ
                          </span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-center">
                        {item.isRopUnderSuggested && (
                          <button
                            onClick={() => handleApplyROP(item, item.suggestedROP)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            ปรับเป็น {item.suggestedROP}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <StockMovementTable
        selectedProduct={selectedProduct}
        stockLogs={stockLogs}
        onClose={() => setSelectedProduct(null)}
      />

      {showManualIn && (
        <ManualStockInModal
          products={products}
          currentRole={currentRole}
          onClose={() => setShowManualIn(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
