import React, { useState, useMemo } from 'react';
import { Warehouse, AlertTriangle, PlusCircle, History, Search, PackagePlus, BarChart3, TrendingUp, Edit3, CheckCircle, X, ChevronRight, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import StockMovementTable from '../components/stock/StockMovementTable';
import ManualStockInModal from '../components/stock/ManualStockInModal';
import StockAdjustmentModal from '../components/stock/StockAdjustmentModal';
import EmptyState from '../components/common/EmptyState';
import { storageService } from '../services/storageService';
import { modalService } from '../services/modalService';

export default function StockCardView({ products, stockLogs, currentRole, onQuickPR, onRefresh }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('stock-list');
  const [showManualIn, setShowManualIn] = useState(false);
  const [showAdjustStock, setShowAdjustStock] = useState(false);

  const viewableProducts = useMemo(() => {
    return products.filter(p => {
      const pCat = p.category || p.department || 'PD';
      return currentRole.canViewAllDepts || pCat === currentRole.department;
    });
  }, [products, currentRole]);

  // Filter & Priority Sort
  const sortedAndFilteredProducts = useMemo(() => {
    return viewableProducts
      .filter(p => {
        const pCat = p.category || p.department || 'PD';
        const matchesCat = categoryFilter === 'ALL' || pCat === categoryFilter;
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch = !q || 
          (p.name && p.name.toLowerCase().includes(q)) || 
          (p.code && p.code.toLowerCase().includes(q));
        return matchesCat && matchesSearch;
      })
      .sort((a, b) => {
        const aLow = a.stockBalance <= a.reorderPoint ? 1 : 0;
        const bLow = b.stockBalance <= b.reorderPoint ? 1 : 0;
        if (aLow !== bLow) return bLow - aLow;
        const aRatio = a.reorderPoint > 0 ? (a.stockBalance / a.reorderPoint) : 999;
        const bRatio = b.reorderPoint > 0 ? (b.stockBalance / b.reorderPoint) : 999;
        if (aRatio !== bRatio) return aRatio - bRatio;
        return (a.code || '').localeCompare(b.code || '');
      });
  }, [viewableProducts, categoryFilter, searchQuery]);

  // Count of items requiring reorder
  const lowStockCount = useMemo(() => {
    return viewableProducts.filter(p => p.stockBalance <= p.reorderPoint).length;
  }, [viewableProducts]);

  // ROP Analytics Computation
  const ropAnalytics = useMemo(() => {
    const viewableProducts = currentRole.canViewAllDepts
      ? products
      : products.filter(p => p.category === currentRole.department);

    return viewableProducts.map(prod => {
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

  const handleApplyROP = async (product, suggestedROP) => {
    const confirmed = await modalService.confirm({
      title: 'ยืนยันปรับจุดสั่งซื้อ (ROP)',
      message: `ต้องการปรับจุดสั่งซื้อ (Reorder Point) ของ "${product.name}" เป็น ${suggestedROP} ${product.unit} หรือไม่?`,
      confirmText: 'ยืนยันการปรับ',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;

    const allProducts = storageService.getProducts();
    const idx = allProducts.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      allProducts[idx].reorderPoint = suggestedROP;
      storageService.saveProducts(allProducts);
      modalService.success('ปรับ ROP เรียบร้อย', `ปรับ ROP ของ "${product.name}" เป็น ${suggestedROP} ${product.unit} สำเร็จ`);
      onRefresh();
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in pb-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-2xs">
              <Warehouse className="w-5 h-5" />
            </div>
            <span>คลังสินค้าและสต็อก (Warehouse & Inventory)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            บริหารจัดการสต็อกสินค้า รับเข้า-เบิกจ่าย และวิเคราะห์จุดสั่งซื้อ (ROP)
          </p>
        </div>
        {currentRole?.roleId !== 'ONLINE_PURCHASER' && (currentRole?.canReceiveGoods || currentRole?.roleId === 'ASST_MANAGER' || currentRole?.id === 'ADMIN') && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAdjustStock(true)}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span>ปรับปรุงสต็อก (+/-)</span>
            </button>
            <button
              onClick={() => setShowManualIn(true)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>รับสินค้าเข้าคลัง</span>
            </button>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Left: View Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl shrink-0 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('stock-list')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stock-list' 
                  ? 'bg-white text-slate-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Warehouse className="w-4 h-4 text-indigo-600" />
              <span>รายการสต็อก ({sortedAndFilteredProducts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('rop-analysis')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'rop-analysis' 
                  ? 'bg-white text-slate-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-amber-600" />
              <span>วิเคราะห์ ROP & Safety Stock</span>
              {lowStockCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500 text-white">
                  {lowStockCount}
                </span>
              )}
            </button>
          </div>

          {/* Right: Department Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 lg:max-w-xl justify-end">
            {currentRole.canViewAllDepts ? (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    categoryFilter === 'ALL' 
                      ? 'bg-white text-slate-900 shadow-xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทุกแผนก
                </button>
                <button
                  onClick={() => setCategoryFilter('PD')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    categoryFilter === 'PD' 
                      ? 'bg-white text-blue-700 shadow-xs font-bold' 
                      : 'text-slate-600 hover:text-blue-700'
                  }`}
                >
                  ฝ่ายผลิต (PD)
                </button>
                <button
                  onClick={() => setCategoryFilter('QC')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    categoryFilter === 'QC' 
                      ? 'bg-white text-amber-700 shadow-xs font-bold' 
                      : 'text-slate-600 hover:text-amber-700'
                  }`}
                >
                  ฝ่ายตรวจสอบ (QC)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 shrink-0 text-xs">
                <span className="text-slate-500 font-medium">คลังแผนก:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {currentRole.department}
                </span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative w-full sm:w-72 md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือ รหัสสินค้า..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: Stock List View */}
      {activeTab === 'stock-list' && (
        <>
          {/* Slim ROP Alert Banner */}
          {lowStockCount > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm text-amber-950 font-medium leading-tight">
                  <span className="font-bold text-amber-900">สินค้าถึงจุดสั่งซื้อซ้ำ (ROP)</span>
                  <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                    {lowStockCount} รายการ
                  </span>
                  <span className="text-slate-500 ml-2 hidden md:inline font-normal">
                    (ระบบได้จัดเรียงไว้ที่ด้านบนสุดของตารางแล้ว)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {onQuickPR && (
                  <button
                    onClick={() => {
                      const firstLow = sortedAndFilteredProducts.find(p => p.stockBalance <= p.reorderPoint);
                      if (firstLow) onQuickPR(firstLow);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>เปิด PR สั่งซื้อด่วน</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stock Table Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-20 shadow-2xs bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 pl-6">รหัสสินค้า</th>
                    <th className="py-3.5 px-4 w-2/5">ชื่อสินค้า</th>
                    <th className="py-3.5 px-4">แผนก</th>
                    <th className="py-3.5 px-4 text-right">คงเหลือปัจจุบัน</th>
                    <th className="py-3.5 px-4 text-right">จุดเตือน (ROP)</th>
                    <th className="py-3.5 px-4 text-center">สถานะ</th>
                    <th className="py-3.5 pr-6 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedAndFilteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-0">
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
                          className={`hover:bg-slate-50/80 group transition-colors ${
                            isLow ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-4 pl-6 whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-800 font-mono text-xs px-2.5 py-1 rounded-md font-bold border border-slate-200/60">{prod.code}</span>
                          </td>

                          <td className="py-4 px-4 break-words max-w-md">
                            <div className="font-semibold text-slate-900 text-sm leading-snug">
                              {prod.name}
                            </div>
                            {rate > 1 && (
                              <div className="text-xs text-slate-500 font-medium mt-0.5">
                                อัตราแปลง: 1 {pUnit} = {rate} {sUnit}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              prod.category === 'PD' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200/60' 
                                : 'bg-amber-50 text-amber-700 border-amber-200/60'
                            }`}>
                              {prod.category}
                            </span>
                          </td>

                          <td className={`py-4 px-4 text-right font-bold whitespace-nowrap tabular-nums ${
                            isLow ? 'text-amber-800' : 'text-slate-900'
                          }`}>
                            <div className="text-sm sm:text-base font-mono font-bold">
                              {Number(prod.stockBalance || 0).toLocaleString()} <span className="font-normal text-slate-400 text-xs font-sans ml-0.5">{sUnit}</span>
                            </div>
                            {purchaseEquivStr && (
                              <div className="text-xs font-normal text-slate-400 mt-0.5 font-mono">
                                ≈ {purchaseEquivStr} {pUnit}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4 text-right font-medium text-slate-600 font-mono tabular-nums whitespace-nowrap text-sm">
                            {Number(prod.reorderPoint || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans ml-0.5">{sUnit}</span>
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                ถึงจุด ROP
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                สต็อกปกติ
                              </span>
                            )}
                          </td>

                          <td className="py-4 pr-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              {isLow && (
                                <button
                                  onClick={() => onQuickPR(prod)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 shadow-2xs"
                                  title="เปิด PR สินค้านี้ทันที"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>สั่งซื้อ</span>
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedProduct(prod)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer border-slate-200 hover:bg-slate-50 text-slate-700 bg-white shadow-2xs"
                                title="ดูประวัติเคลื่อนไหว (Stock Card)"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>ประวัติ</span>
                              </button>
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

      {/* Tab 2: ROP Analytics */}
      {activeTab === 'rop-analysis' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl shadow-2xs">
            <TrendingUp className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-indigo-950">
              <span className="font-bold text-indigo-900">สูตรคำนวณ ROP ที่แนะนำ:</span>
              <span className="text-indigo-700 ml-1.5">
                ROP แนะนำ = (ค่าเฉลี่ยการใช้ต่อวัน × Lead Time) + Safety Stock &nbsp;|&nbsp; Safety Stock = ค่าเฉลี่ยต่อวัน × Lead Time × 1.5
              </span>
              <p className="text-xs text-slate-500 mt-1">คำนวณจากประวัติการเบิก (OUT) ย้อนหลัง 30 วัน</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm">
            <div className="overflow-x-auto overflow-y-auto max-h-[560px] custom-scrollbar relative">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-20 bg-slate-50/90 shadow-2xs border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 pl-6">รหัส / ชื่อสินค้า</th>
                    <th className="py-3.5 px-4 text-right">คงเหลือ</th>
                    <th className="py-3.5 px-4 text-right">เบิก 30 วัน</th>
                    <th className="py-3.5 px-4 text-right">ใช้เฉลี่ย/วัน</th>
                    <th className="py-3.5 px-4 text-right">Lead Time</th>
                    <th className="py-3.5 px-4 text-right">ROP ปัจจุบัน</th>
                    <th className="py-3.5 px-4 text-right">ROP แนะนำ</th>
                    <th className="py-3.5 px-4 text-center">สถานะ ROP</th>
                    <th className="py-3.5 pr-6 text-center">ปรับ ROP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ropAnalytics.map(item => (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${item.isRopUnderSuggested ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-4 pl-6 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-500 text-xs">{item.code}</div>
                        <div className="font-semibold text-slate-900 text-sm mt-0.5">{item.name}</div>
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {item.stockBalance} <span className="text-xs font-normal text-slate-400 font-sans">{item.unit}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-600 tabular-nums">
                        {item.totalOut30Days} <span className="text-xs font-normal text-slate-400 font-sans">{item.unit}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-600 tabular-nums">
                        {item.avgDailyUsage}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-600 tabular-nums">
                        {item.leadTimeDays || 7} วัน
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-slate-700 tabular-nums">
                        {item.reorderPoint}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-indigo-600 tabular-nums">
                        {item.suggestedROP}
                      </td>
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {item.isRopUnderSuggested ? (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-rose-200">
                            ROP ต่ำเกินไป (-{item.ropGap})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-200">
                            เหมาะสมแล้ว
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-6 text-center whitespace-nowrap">
                        {item.isRopUnderSuggested ? (
                          <button
                            onClick={() => handleApplyROP(item, item.suggestedROP)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                          >
                            ใช้ค่า {item.suggestedROP}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
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

      {/* Stock Movement Modal */}
      {selectedProduct && (
        <StockMovementTable
          product={selectedProduct}
          stockLogs={stockLogs.filter(l => l.productId === selectedProduct.id || l.productCode === selectedProduct.code)}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Manual Stock In Modal */}
      {showManualIn && (
        <ManualStockInModal
          products={products}
          currentRole={currentRole}
          onClose={() => setShowManualIn(false)}
          onRefresh={onRefresh}
        />
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustStock && (
        <StockAdjustmentModal
          products={products}
          currentRole={currentRole}
          onClose={() => setShowAdjustStock(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
