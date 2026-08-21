import React from 'react';
import KPICards from '../components/dashboard/KPICards';
import LowStockTable from '../components/dashboard/LowStockTable';
import { PR_STATUS, PO_STATUS } from '../config/constants';
import { ArrowRight, FileText, ShoppingCart, Clock, AlertTriangle, PlusCircle, ChevronRight, Store, Building2, Eye, Package, ShieldCheck } from 'lucide-react';

export default function DashboardView({ prs = [], pos = [], products = [], budgetSummary, currentRole, onNavigate, onQuickPR, onOpenPR, onOpenPO }) {
  const recentPRs = prs.slice(0, 5);
  const recentPOs = pos.slice(0, 5);

  const isOnlinePurchaser = currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER';
  const lowStockList = isOnlinePurchaser ? [] : products.filter(p => 
    (currentRole.canViewAllDepts || p.category === currentRole.department) && 
    p.stockBalance <= p.reorderPoint
  );

  const recentPRTotal = recentPRs.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const recentPOTotal = recentPOs.reduce((sum, p) => sum + (p.grandTotal || p.subtotal || 0), 0);

  return (
    <div className="w-full space-y-6 animate-fade-in pb-10">

      {/* ROP Alert Top Banner */}
      {!isOnlinePurchaser && lowStockList.length > 0 && (
        <div className="bg-white border border-rose-200/80 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs shadow-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 font-bold text-base text-slate-900 flex-wrap">
                <span>มีสินค้าแตะจุดสั่งซื้อซ้ำ (Reorder Point Alert)</span>
                <span className="bg-rose-50 text-rose-700 text-xs px-3 py-0.5 rounded-full font-semibold border border-rose-200">
                  {lowStockList.length} รายการ
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl font-normal">
                ตรวจพบสินค้าคงเหลือในคลังน้อยกว่าหรือเท่ากับจุด ROP ({lowStockList.slice(0, 3).map(p => p.name).join(', ')}{lowStockList.length > 3 ? ` และอีก ${lowStockList.length - 3} รายการ` : ''}) แนะนำให้เปิด PR ด่วน
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (lowStockList[0] && onQuickPR) onQuickPR(lowStockList[0]);
              else onNavigate('warehouse');
            }}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>เปิด PR สั่งซื้อด่วนทันที</span>
          </button>
        </div>
      )}

      {/* ROP Normal State Banner */}
      {!isOnlinePurchaser && lowStockList.length === 0 && (
        <div className="bg-white border border-emerald-200/70 rounded-3xl p-4 sm:p-5 shadow-2xs flex items-center gap-3.5 animate-fade-in">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm text-slate-900">
              ระดับสต็อกสินค้าทุกรายการอยู่ในเกณฑ์ปกติ
            </p>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              (All Stock Levels Normal • ไม่มีสินค้าแตะจุดสั่งซื้อซ้ำ)
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <KPICards
        prs={prs}
        pos={pos}
        products={products}
        budgetSummary={budgetSummary}
        currentRole={currentRole}
      />

      {/* Low Stock Warning Section */}
      <LowStockTable products={products} onQuickPR={onQuickPR} />

      {/* Recent Workflow Stream Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* ── CARD 1: Recent PRs ── */}
        <div className="bg-white border border-slate-200/80 rounded-3xl flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          {/* Header */}
          <div className="p-5 sm:px-7 border-b border-slate-100 flex items-center justify-between gap-2 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <span>ใบขอซื้อล่าสุด</span>
                  <span className="text-xs font-normal text-slate-400 font-sans">(Recent PRs)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-normal">
                  {recentPRs.length > 0 ? `แสดง ${recentPRs.length} รายการล่าสุด` : 'ยังไม่มีข้อมูลใบขอซื้อ'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('pr-list')}
              className="group text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl border border-transparent hover:border-indigo-100 hover:bg-indigo-50 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>ดูทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 flex flex-col">
            {recentPRs.length === 0 ? (
              <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-dashed border-indigo-200 flex items-center justify-center text-indigo-400 mb-3 shadow-2xs">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">ยังไม่มีใบขอซื้อในระบบ</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4 font-normal">
                  คุณสามารถสร้างใบขอซื้อใหม่เพื่อเริ่มกระบวนการจัดซื้อวัตถุดิบหรืออุปกรณ์
                </p>
                <button
                  onClick={() => onNavigate('pr-create')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>สร้างใบ PR ใหม่</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPRs.map((pr) => {
                  const statusInfo = PR_STATUS[pr.status] || { label: pr.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
                  const itemCount = pr.items?.length || 1;
                  const firstItemName = pr.items?.[0]?.name || pr.note || 'ไม่มีรายการระบุ';

                  return (
                    <div
                      key={pr.id}
                      onClick={() => onOpenPR ? onOpenPR(pr.id) : onNavigate('pr-list')}
                      className="p-4 sm:px-7 hover:bg-slate-50/80 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                      title="คลิกเพื่อเปิดดูรายละเอียดใบขอซื้อ"
                    >
                      {/* Left: PR Meta & Items Info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                            {pr.prNo}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            pr.department === 'PD' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200/60' 
                              : 'bg-amber-50 text-amber-700 border-amber-200/60'
                          }`}>
                            {pr.department}
                          </span>
                          {pr.purchaseChannel === 'ONLINE' && (
                            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <ShoppingCart className="w-3 h-3 text-purple-600" />
                              <span>Online</span>
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-normal">
                            • {pr.requestedBy}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate max-w-md font-normal">
                          <span className="text-slate-400 font-mono">{itemCount} รายการ:</span> {firstItemName}
                        </p>
                      </div>

                      {/* Right: Amount & Status */}
                      <div className="flex items-center gap-2 shrink-0 text-right">
                        <div>
                          <div className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                            ฿{(pr.totalAmount || 0).toLocaleString()}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${statusInfo.color}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                            {statusInfo.label}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Summary */}
          {recentPRs.length > 0 && (
            <div className="p-4 sm:px-7 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-normal">
              <span>รวม {recentPRs.length} รายการล่าสุด</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                ยอดรวม ฿{recentPRTotal.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* ── CARD 2: Recent POs ── */}
        <div className="bg-white border border-slate-200/80 rounded-3xl flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          {/* Header */}
          <div className="p-5 sm:px-7 border-b border-slate-100 flex items-center justify-between gap-2 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <span>ใบสั่งซื้อล่าสุด</span>
                  <span className="text-xs font-normal text-slate-400 font-sans">(Recent POs)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-normal">
                  {recentPOs.length > 0 ? `แสดง ${recentPOs.length} รายการล่าสุด` : 'ยังไม่มีข้อมูลใบสั่งซื้อ'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('po-list')}
              className="group text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl border border-transparent hover:border-emerald-100 hover:bg-emerald-50 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>ดูทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 flex flex-col">
            {recentPOs.length === 0 ? (
              <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border-2 border-dashed border-emerald-200 flex items-center justify-center text-emerald-500 mb-3 shadow-2xs">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">ยังไม่มีใบสั่งซื้อในระบบ</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4 font-normal">
                  ใบสั่งซื้อ (PO) จะถูกสร้างอัตโนมัติเมื่อ PR ผ่านการอนุมัติขั้นสุดท้ายจาก Plant Manager
                </p>
                <button
                  onClick={() => onNavigate('pr-list')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>เปิดดูรายการ PR เพื่อติดตาม</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPOs.map((po) => {
                  const statusInfo = PO_STATUS[po.status] || { label: po.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
                  const vendorDisplay = po.vendorName && po.vendorName !== 'Shopee / Lazada (ระบุร้านภายหลัง)' 
                    ? po.vendorName 
                    : po.purchaseChannel === 'ONLINE' ? 'สั่งซื้อออนไลน์ (Shopee/Lazada)' : 'ยังไม่ระบุผู้ขาย';

                  return (
                    <div
                      key={po.id}
                      onClick={() => onOpenPO ? onOpenPO(po.id) : onNavigate('po-list')}
                      className="p-4 sm:px-7 hover:bg-slate-50/80 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                      title="คลิกเพื่อเปิดดูรายละเอียดใบสั่งซื้อ"
                    >
                      {/* Left: PO Meta & Vendor */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">
                            {po.poNo}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            po.department === 'PD' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200/60' 
                              : 'bg-amber-50 text-amber-700 border-amber-200/60'
                          }`}>
                            {po.department}
                          </span>
                          {po.prNo && (
                            <span className="text-xs text-slate-400 font-mono">
                              (อ้างอิง {po.prNo})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 truncate max-w-md font-normal flex items-center gap-1.5">
                          {po.purchaseChannel === 'ONLINE' ? (
                            <Store className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{vendorDisplay}</span>
                        </p>
                      </div>

                      {/* Right: Amount & Status */}
                      <div className="flex items-center gap-2 shrink-0 text-right">
                        <div>
                          <div className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                            ฿{(po.grandTotal || po.subtotal || 0).toLocaleString()}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${statusInfo.color}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                            {statusInfo.label}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Summary */}
          {recentPOs.length > 0 && (
            <div className="p-4 sm:px-7 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-normal">
              <span>รวม {recentPOs.length} รายการล่าสุด</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                ยอดรวม ฿{recentPOTotal.toLocaleString()}
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
