import React from 'react';
import { Clock, ShoppingCart, AlertTriangle, DollarSign } from 'lucide-react';

export default function KPICards({ prs, pos, products, budgetSummary, currentRole }) {
  const pendingPRs = prs.filter(p => ['SUBMITTED', 'REVIEWED_L1', 'REVIEWED_L2'].includes(p.status)).length;
  const activePOs = pos.filter(p => p.status === 'ISSUED' || p.status === 'PARTIAL').length;
  const lowStockCount = products.filter(p => p.stockBalance <= p.reorderPoint).length;

  const deptKey = currentRole.department === 'ALL' ? 'PD' : currentRole.department;
  
  let totalSpent = 0;
  let totalAllocated = 0;
  
  if (currentRole.department === 'ALL') {
    Object.values(budgetSummary || {}).forEach(dept => {
      totalSpent += (dept.actualSpent || 0) + (dept.committed || 0);
      totalAllocated += dept.allocated || 0;
    });
  } else {
    const deptInfo = budgetSummary?.[deptKey];
    totalSpent = (deptInfo?.actualSpent || 0) + (deptInfo?.committed || 0);
    totalAllocated = deptInfo?.allocated || 0;
  }
  
  const budgetPercent = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;
  const budgetLabel = currentRole.department === 'ALL' ? 'รวมทุกแผนก' : `ฝ่าย ${deptKey}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Pending PRs Card */}
      <div className="impeccable-card p-5 sm:p-6 bg-white border border-slate-200/90 hover:border-amber-300 transition-all group flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">PR รอพิจารณาอนุมัติ</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1.5 font-mono tracking-tight group-hover:text-amber-600 transition-colors">
              {pendingPRs} <span className="text-xs font-semibold text-slate-400 font-sans">รายการ</span>
            </h3>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 group-hover:scale-105 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>รอ Asst / Plant Mgr</span>
          <span className="text-amber-600 font-bold">Action Queue</span>
        </div>
      </div>

      {/* Active POs Card */}
      <div className="impeccable-card p-5 sm:p-6 bg-white border border-slate-200/90 hover:border-blue-300 transition-all group flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">PO รอรับเข้าคลัง</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1.5 font-mono tracking-tight group-hover:text-blue-600 transition-colors">
              {activePOs} <span className="text-xs font-semibold text-slate-400 font-sans">ฉบับ</span>
            </h3>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 group-hover:scale-105 transition-transform">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>รอส่งมอบสินค้า</span>
          <span className="text-blue-600 font-bold">In Delivery</span>
        </div>
      </div>

      {/* Low Stock Warning Card */}
      <div className="impeccable-card p-5 sm:p-6 bg-white border border-slate-200/90 hover:border-rose-300 transition-all group flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">สินค้าแตะจุดสั่งซื้อ (ROP)</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1.5 font-mono tracking-tight">
              {lowStockCount} <span className="text-xs font-semibold text-slate-400 font-sans">รายการ</span>
            </h3>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>ความเสี่ยงของขาดสต็อก</span>
          <span className="text-rose-600 font-bold">{lowStockCount > 0 ? 'ควรเปิด PR ด่วน' : 'ปกติ'}</span>
        </div>
      </div>

      {/* Budget Summary Card */}
      <div className="impeccable-card p-5 sm:p-6 bg-white border border-slate-200/90 hover:border-emerald-300 transition-all group flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">งบประจำเดือน ({budgetLabel})</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1.5 font-mono tracking-tight truncate">
                ฿{totalSpent.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0 group-hover:scale-105 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
            <span className="text-emerald-700">ใช้ไป {budgetPercent}%</span>
            <span className="text-slate-400 font-normal">เป้า: ฿{totalAllocated.toLocaleString()}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-all ${budgetPercent > 90 ? 'bg-rose-500' : budgetPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
