import React from 'react';
import { Clock, ShoppingCart, AlertTriangle, DollarSign, ArrowUpRight } from 'lucide-react';
import { hasDepartmentAccess } from '../../utils/permissions';

export default function KPICards({ prs, pos, products, budgetSummary, currentRole, onNavigate, onQuickPR }) {
  const accessiblePRs = prs.filter(p => hasDepartmentAccess(currentRole, p.department));
  const accessiblePOs = pos.filter(p => hasDepartmentAccess(currentRole, p.department));

  const pendingPRs = accessiblePRs.filter(p => ['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(p.status)).length;
  const activePOs = accessiblePOs.filter(p => ['ISSUED', 'ORDERED_PENDING_DELIVERY', 'IN_DELIVERY', 'PARTIAL', 'IN_PROGRESS_ONLINE', 'CLAIM_REPORTED', 'CLAIM_IN_PROGRESS'].includes(p.status)).length;
  
  const lowStockItems = products.filter(p => (currentRole.canViewAllDepts || p.category === currentRole.department) && p.stockBalance <= p.reorderPoint);
  const lowStockCount = lowStockItems.length;

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

  const handleLowStockClick = () => {
    if (lowStockCount > 0 && lowStockItems[0] && onQuickPR) {
      onQuickPR(lowStockItems[0]);
    } else if (onNavigate) {
      onNavigate('warehouse');
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      
      {/* 1. Pending PRs Card */}
      <div 
        onClick={() => onNavigate && onNavigate('pr-list')}
        className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
        title="คลิกเพื่อดูรายการ PR รออนุมัติ"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">PR รอพิจารณาอนุมัติ</p>
            <h3 className="text-4xl sm:text-5xl font-semibold text-slate-900 mt-3 font-mono tabular-nums tracking-tight">
              {pendingPRs} <span className="text-sm font-normal text-slate-400 font-sans">รายการ</span>
            </h3>
          </div>
          <div className="w-12 h-12 bg-amber-50/70 text-amber-600 rounded-xl border border-amber-100/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-normal">รอ Asst / Plant Mgr</span>
          <span className="text-amber-700/90 font-medium bg-amber-50/80 px-2.5 py-1 rounded-full border border-amber-200/50 font-mono text-[11px]">
            Action Queue
          </span>
        </div>
      </div>

      {/* 2. Active POs Card */}
      <div 
        onClick={() => onNavigate && onNavigate('po-list')}
        className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
        title="คลิกเพื่อดูรายการ PO รอส่งมอบ"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">PO รอรับเข้าคลัง</p>
            <h3 className="text-4xl sm:text-5xl font-semibold text-slate-900 mt-3 font-mono tabular-nums tracking-tight">
              {activePOs} <span className="text-sm font-normal text-slate-400 font-sans">ฉบับ</span>
            </h3>
          </div>
          <div className="w-12 h-12 bg-indigo-50/70 text-indigo-600 rounded-xl border border-indigo-100/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-normal">รอส่งมอบสินค้า</span>
          <span className="text-indigo-700/90 font-medium bg-indigo-50/80 px-2.5 py-1 rounded-full border border-indigo-200/50 font-mono text-[11px]">
            In Delivery
          </span>
        </div>
      </div>

      {/* 3. Low Stock Warning Card */}
      <div 
        onClick={handleLowStockClick}
        className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
        title={lowStockCount > 0 ? 'คลิกเพื่อเปิด PR สั่งซื้อด่วน หรือตรวจดูสินค้า ROP' : 'คลิกเพื่อดูคลังสินค้า'}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">สินค้าแตะจุดสั่งซื้อ (ROP)</p>
            <h3 className="text-4xl sm:text-5xl font-semibold text-slate-900 mt-3 font-mono tabular-nums tracking-tight">
              {lowStockCount} <span className="text-sm font-normal text-slate-400 font-sans">รายการ</span>
            </h3>
          </div>
          <div className="w-12 h-12 bg-rose-50/70 text-rose-600 rounded-xl border border-rose-100/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-normal">ความเสี่ยงสต็อกขาด</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLowStockClick();
            }}
            className={`font-medium px-2.5 py-1 rounded-full border text-[11px] transition-all cursor-pointer inline-flex items-center gap-1 ${
              lowStockCount > 0 
                ? 'bg-rose-50/80 text-rose-700 border-rose-200/50 hover:bg-rose-100/80' 
                : 'bg-emerald-50/80 text-emerald-700 border-emerald-200/50 hover:bg-emerald-100/80'
            }`}
          >
            <span>{lowStockCount > 0 ? 'ควรเปิด PR ด่วน' : 'ระดับปกติ'}</span>
            {lowStockCount > 0 && <ArrowUpRight className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 4. Budget Summary Card */}
      <div 
        onClick={() => onNavigate && onNavigate('budget')}
        className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
        title="คลิกเพื่อดูแผงควบคุมงบประมาณ"
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase truncate">งบประจำเดือน ({budgetLabel})</p>
              <h3 className="text-3xl sm:text-4xl font-semibold text-slate-900 mt-3 font-mono tabular-nums tracking-tight truncate">
                ฿{totalSpent.toLocaleString()}
              </h3>
            </div>
            <div className="w-12 h-12 bg-emerald-50/70 text-emerald-600 rounded-xl border border-emerald-100/60 shrink-0 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-slate-100/80 rounded-full h-1.5 mt-4 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                budgetPercent > 90 ? 'bg-rose-500' : budgetPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            ></div>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-slate-100/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-normal">ใช้ไปแล้ว {budgetPercent}%</span>
          <span className="font-mono text-slate-500 font-semibold text-[11px]">
            งบ ฿{totalAllocated.toLocaleString()}
          </span>
        </div>
      </div>

    </div>
  );
}
