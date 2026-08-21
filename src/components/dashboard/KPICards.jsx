import React from 'react';
import { Clock, ShoppingCart, AlertTriangle, DollarSign } from 'lucide-react';

export default function KPICards({ prs, pos, products, budgetSummary, currentRole }) {
  const accessiblePRs = currentRole.canViewAllDepts ? prs : prs.filter(p => p.department === currentRole.department);
  const accessiblePOs = currentRole.canViewAllDepts ? pos : pos.filter(p => p.department === currentRole.department);

  const pendingPRs = accessiblePRs.filter(p => ['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(p.status)).length;
  const activePOs = accessiblePOs.filter(p => ['ISSUED', 'ORDERED_PENDING_DELIVERY', 'IN_DELIVERY', 'PARTIAL', 'IN_PROGRESS_ONLINE', 'CLAIM_REPORTED', 'CLAIM_IN_PROGRESS'].includes(p.status)).length;
  const lowStockCount = products.filter(p => (currentRole.canViewAllDepts || p.category === currentRole.department) && p.stockBalance <= p.reorderPoint).length;

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
      
      {/* 1. Pending PRs Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">PR รอพิจารณาอนุมัติ</p>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
              {pendingPRs} <span className="text-xs font-semibold text-slate-400 font-sans">รายการ</span>
            </h3>
          </div>
          <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex items-center justify-center shrink-0 shadow-2xs">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">รอ Asst / Plant Mgr</span>
          <span className="text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80 font-mono text-[11px]">
            Action Queue
          </span>
        </div>
      </div>

      {/* 2. Active POs Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">PO รอรับเข้าคลัง</p>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
              {activePOs} <span className="text-xs font-semibold text-slate-400 font-sans">ฉบับ</span>
            </h3>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">รอส่งมอบสินค้า</span>
          <span className="text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/80 font-mono text-[11px]">
            In Delivery
          </span>
        </div>
      </div>

      {/* 3. Low Stock Warning Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">สินค้าแตะจุดสั่งซื้อ (ROP)</p>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
              {lowStockCount} <span className="text-xs font-semibold text-slate-400 font-sans">รายการ</span>
            </h3>
          </div>
          <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">ความเสี่ยงสต็อกขาด</span>
          <span className={`font-semibold px-2.5 py-0.5 rounded-full border text-[11px] ${
            lowStockCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200/80' : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
          }`}>
            {lowStockCount > 0 ? 'ควรเปิด PR ด่วน' : 'ระดับปกติ'}
          </span>
        </div>
      </div>

      {/* 4. Budget Summary Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider truncate">งบประจำเดือน ({budgetLabel})</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight truncate">
                ฿{totalSpent.toLocaleString()}
              </h3>
            </div>
            <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0 flex items-center justify-center shadow-2xs">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1.5">
            <span className="text-emerald-700 font-bold font-mono">ใช้ไป {budgetPercent}%</span>
            <span className="text-slate-400 font-mono text-[11px]">เป้า: ฿{totalAllocated.toLocaleString()}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                budgetPercent > 90 ? 'bg-rose-500' : budgetPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`} 
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
