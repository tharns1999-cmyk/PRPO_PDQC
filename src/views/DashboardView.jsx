import React from 'react';
import KPICards from '../components/dashboard/KPICards';
import LowStockTable from '../components/dashboard/LowStockTable';
import { PR_STATUS, PO_STATUS } from '../config/constants';
import { ArrowRight, FileText, ShoppingCart, PlusCircle, ChevronRight, Store, Building2, Eye } from 'lucide-react';

export default function DashboardView({ prs = [], pos = [], products = [], budgetSummary, currentRole, onNavigate, onQuickPR, onOpenPR, onOpenPO }) {
  const recentPRs = prs.slice(0, 5);
  const recentPOs = pos.slice(0, 5);



  const recentPRTotal = recentPRs.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const recentPOTotal = recentPOs.reduce((sum, p) => sum + (p.grandTotal || p.subtotal || 0), 0);

  return (
    <div className="w-full space-y-8 animate-fade-in pb-12">

      {/* KPI Cards */}
      <KPICards
        prs={prs}
        pos={pos}
        products={products}
        budgetSummary={budgetSummary}
        currentRole={currentRole}
        onNavigate={onNavigate}
        onQuickPR={onQuickPR}
      />

      {/* Low Stock Warning Section */}
      <LowStockTable products={products} onQuickPR={onQuickPR} />

      {/* Recent Workflow Stream Cards Grid (Activity Hub) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* ── CARD 1: Recent PRs ── */}
        <div className="bg-white border border-slate-200/70 rounded-3xl flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          {/* Header */}
          <div className="p-5 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2 tracking-tight">
                  <span>ใบขอซื้อล่าสุด</span>
                  <span className="text-xs font-normal text-slate-400 font-sans hidden sm:inline">(Recent PRs)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-normal">
                  {recentPRs.length > 0 ? `แสดง ${recentPRs.length} รายการล่าสุด` : 'ยังไม่มีข้อมูลใบขอซื้อ'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('pr-list')}
              className="group text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl border border-transparent hover:border-indigo-100 hover:bg-indigo-50/70 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>ดูทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 flex flex-col justify-start">
            {recentPRs.length === 0 ? (
              <div className="flex-1 py-10 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-400 mb-3 shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">ยังไม่มีใบขอซื้อในระบบ</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4 font-normal">
                  คุณสามารถสร้างใบขอซื้อใหม่เพื่อเริ่มกระบวนการจัดซื้อวัตถุดิบหรืออุปกรณ์
                </p>
                <button
                  onClick={() => onNavigate('pr-create')}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-slate-300" />
                  <span>สร้างใบ PR ใหม่</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {recentPRs.map((pr) => {
                  const statusInfo = PR_STATUS[pr.status] || { label: pr.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
                  const itemCount = pr.items?.length || 1;
                  const firstItemName = pr.items?.[0]?.name || pr.note || 'ไม่มีรายการระบุ';

                  return (
                    <div
                      key={pr.id}
                      onClick={() => onOpenPR ? onOpenPR(pr.id) : onNavigate('pr-list')}
                      className="p-3.5 sm:px-6 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                      title="คลิกเพื่อเปิดดูรายละเอียดใบขอซื้อ"
                    >
                      {/* Left: PR Meta & Items Info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-950 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors">
                            {pr.prNo}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            pr.department === 'PD' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {pr.department}
                          </span>
                          {pr.purchaseChannel === 'ONLINE' && (
                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <ShoppingCart className="w-3 h-3 text-purple-600" />
                              <span>Online</span>
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-normal truncate">
                            • {pr.requestedBy}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate max-w-md font-medium">
                          <span className="text-slate-400 font-mono text-[11px] font-normal">{itemCount} รายการ:</span> {firstItemName}
                        </p>
                      </div>

                      {/* Right: Amount & Glowing Status Dot */}
                      <div className="flex items-center gap-2.5 shrink-0 text-right">
                        <div>
                          <div className="font-mono font-bold text-xs sm:text-sm text-slate-900 tabular-nums">
                            ฿{(pr.totalAmount || 0).toLocaleString()}
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border mt-0.5 ${statusInfo.color}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse"></span>
                            <span>{statusInfo.label}</span>
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
            <div className="p-3.5 sm:px-6 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>รวม {recentPRs.length} รายการล่าสุด</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                ยอดรวม ฿{recentPRTotal.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* ── CARD 2: Recent POs ── */}
        <div className="bg-white border border-slate-200/70 rounded-3xl flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          {/* Header */}
          <div className="p-5 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2 tracking-tight">
                  <span>ใบสั่งซื้อล่าสุด</span>
                  <span className="text-xs font-normal text-slate-400 font-sans hidden sm:inline">(Recent POs)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-normal">
                  {recentPOs.length > 0 ? `แสดง ${recentPOs.length} รายการล่าสุด` : 'ยังไม่มีข้อมูลใบสั่งซื้อ'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('po-list')}
              className="group text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl border border-transparent hover:border-emerald-100 hover:bg-emerald-50/70 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>ดูทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 flex flex-col justify-start">
            {recentPOs.length === 0 ? (
              <div className="flex-1 py-10 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100/70 border border-dashed border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">ยังไม่มีใบสั่งซื้อในระบบ</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-4 font-normal">
                  ใบสั่งซื้อ (PO) จะถูกสร้างอัตโนมัติเมื่อ PR ผ่านการอนุมัติขั้นสุดท้ายจาก Plant Manager
                </p>
                <button
                  onClick={() => onNavigate('pr-list')}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-300" />
                  <span>เปิดดูรายการ PR เพื่อติดตาม</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {recentPOs.map((po) => {
                  const statusInfo = PO_STATUS[po.status] || { label: po.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
                  const vendorDisplay = po.vendorName && po.vendorName !== 'Shopee / Lazada (ระบุร้านภายหลัง)' 
                    ? po.vendorName 
                    : po.purchaseChannel === 'ONLINE' ? 'สั่งซื้อออนไลน์ (Shopee/Lazada)' : 'ยังไม่ระบุผู้ขาย';

                  return (
                    <div
                      key={po.id}
                      onClick={() => onOpenPO ? onOpenPO(po.id) : onNavigate('po-list')}
                      className="p-3.5 sm:px-6 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                      title="คลิกเพื่อเปิดดูรายละเอียดใบสั่งซื้อ"
                    >
                      {/* Left: PO Meta & Vendor */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-950 text-xs sm:text-sm group-hover:text-emerald-600 transition-colors">
                            {po.poNo}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            po.department === 'PD' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {po.department}
                          </span>
                          {po.prNo && (
                            <span className="text-xs text-slate-400 font-mono">
                              (อ้างอิง {po.prNo})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 truncate max-w-md font-medium flex items-center gap-1.5">
                          {po.purchaseChannel === 'ONLINE' ? (
                            <Store className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{vendorDisplay}</span>
                        </p>
                      </div>

                      {/* Right: Amount & Status */}
                      <div className="flex items-center gap-2.5 shrink-0 text-right">
                        <div>
                          <div className="font-mono font-bold text-xs sm:text-sm text-slate-900 tabular-nums">
                            ฿{(po.grandTotal || po.subtotal || 0).toLocaleString()}
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border mt-0.5 ${statusInfo.color}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse"></span>
                            <span>{statusInfo.label}</span>
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
            <div className="p-3.5 sm:px-6 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
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
