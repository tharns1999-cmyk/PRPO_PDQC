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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      
      {/* 1. Pending PRs Card */}
      <div 
        onClick={() => onNavigate && onNavigate('pr-list')}
        className="bg-white border border-slate-200/70 rounded-3xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
        title="คลิกเพื่อดูรายการ PR รออนุมัติ"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-400 font-bold tracking-wider uppercase">PR รอพิจารณาอนุมัติ</p>
            <h3 className="text-3xl lg:text-4xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
              {pendingPRs} <span className="text-xs font-medium text-slate-400 font-sans">รายการ</span>
            </h3>
          </div>
          <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-normal">รอ Asst / Plant Mgr</span>
          <span className="text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60 font-mono text-[11px]">
            Action Queue
          </span>
        </div>
      </div>

      {/* 2. Active POs Card */}
      <div 
        onClick={() => onNavigate && onNavigate('po-list')}
        className="bg-white border border-slate-200/70 rounded-3xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
        title="คลิกเพื่อดูรายการ PO รอส่งมอบ"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-400 font-bold tracking-wider uppercase">PO รอรับเข้าคลัง</p>
            <h3 className="text-3xl lg:text-4xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
              {activePOs} <span className="text-xs font-medium text-slate-400 font-sans">ฉบับ</span>
            </h3>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-normal">รอส่งมอบสินค้า</span>
          <span className="text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60 font-mono text-[11px]">
            In Delivery
          </span>
        </div>
      </div>

      {/* 3. Low Stock Warning Card */}
      <div 
        onClick={handleLowStockClick}
        className="bg-white border border-slate-200/70 rounded-3xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
        title={lowStockCount > 0 ? 'คลิกเพื่อเปิด PR สั่งซื้อด่วน หรือตรวจดูสินค้า ROP' : 'คลิกเพื่อดูคลังสินค้า'}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-400 font-bold tracking-wider uppercase">สินค้าแตะจุดสั่งซื้อ (ROP)</p>
            <h3 className="text-3xl lg:text-4xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
              {lowStockCount} <span className="text-xs font-medium text-slate-400 font-sans">รายการ</span>
            </h3>
          </div>
          <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-normal">ความเสี่ยงสต็อกขาด</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLowStockClick();
            }}
            className={`font-semibold px-2.5 py-0.5 rounded-full border text-[11px] transition-all cursor-pointer inline-flex items-center gap-1 ${
              lowStockCount > 0 
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>{lowStockCount > 0 ? 'ควรเปิด PR ด่วน' : 'ระดับปกติ'}</span>
            {lowStockCount > 0 && <ArrowUpRight className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 4. Budget Summary Card (Fixed Text Overflow) */}
      <div 
        onClick={() => onNavigate && onNavigate('budget')}
        className="bg-white border border-slate-200/70 rounded-3xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
        title="คลิกเพื่อดูแผงควบคุมงบประมาณ"
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-400 font-bold tracking-wider uppercase truncate">งบประจำเดือน ({budgetLabel})</p>
              <h3 className="font-mono text-2xl lg:text-3xl font-black text-slate-900 tracking-tight whitespace-nowrap mt-2 tabular-nums">
                ฿{totalSpent.toLocaleString()}
              </h3>
            </div>
            <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          {/* Progress Bar งบประมาณ Gradient */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                budgetPercent >= 90 ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600' : budgetPercent >= 70 ? 'bg-gradient-to-r from-indigo-500 to-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
              }`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            ></div>
          </div>
        </div>
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">ใช้ไปแล้ว <span className={`font-mono font-bold ${budgetPercent >= 90 ? 'text-rose-600' : 'text-slate-700'}`}>{budgetPercent}%</span></span>
          <span className="font-mono text-slate-400 font-semibold text-[11px] whitespace-nowrap">
            จาก ฿{totalAllocated.toLocaleString()}
          </span>
        </div>
      </div>

    </div>
  );
}
