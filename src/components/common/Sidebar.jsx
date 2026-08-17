import React from 'react';
import { 
  LayoutDashboard, ClipboardList, ShoppingBag, Warehouse, 
  SendToBack, Wallet, Database, ShieldAlert, Factory, Sparkles, X 
} from 'lucide-react';
import { workflowEngine } from '../../services/workflowEngine';

export default function Sidebar({ 
  activeView, 
  setActiveView, 
  currentRole, 
  prs = [], 
  pos = [],
  isMobileOpen = false,
  onCloseMobile = () => {}
}) {
  const isOnlinePurchaser = currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER';

  // Calculate Task Counts for Badges
  const taskCounts = React.useMemo(() => {
    let prCount = 0;
    let poCount = 0;
    let onlineCount = 0;
    
    pos.forEach(po => {
      if (po.purchaseChannel === 'ONLINE' && po.status === 'IN_PROGRESS_ONLINE') {
        onlineCount++;
      }
    });

    if (isOnlinePurchaser) {
      return { prCount: 0, poCount: 0, onlineCount, total: onlineCount };
    }

    prs.forEach(pr => {
      if (pr.status !== 'CLOSED' && pr.status !== 'CANCELLED' && workflowEngine.canAction(currentRole, pr)) prCount++;
    });
    
    pos.forEach(po => {
      if (['ISSUED', 'PARTIAL', 'ORDERED_PENDING_DELIVERY', 'IN_DELIVERY'].includes(po.status)) {
        if (workflowEngine.canAction(currentRole, po)) poCount++;
      }
    });
    
    return { prCount, poCount, onlineCount: 0, total: prCount + poCount };
  }, [prs, pos, currentRole, isOnlinePurchaser]);

  const menuItems = [
    { id: 'online-tasks', label: 'จัดซื้อออนไลน์', icon: ShoppingBag, visible: currentRole.canOnlinePurchase, badge: taskCounts.onlineCount > 0 ? taskCounts.onlineCount : null },
    { id: 'dashboard', label: 'ภาพรวมระบบ', icon: LayoutDashboard, visible: !isOnlinePurchaser },
    { id: 'my-workspace', label: 'งานของฉัน', icon: Sparkles, visible: !isOnlinePurchaser, badge: taskCounts.total > 0 ? taskCounts.total : null },
    { id: 'pr-list', label: 'ใบขอซื้อ', icon: ClipboardList, visible: !isOnlinePurchaser, badge: taskCounts.prCount > 0 ? taskCounts.prCount : null },
    { id: 'po-list', label: isOnlinePurchaser ? 'ประวัติใบสั่งซื้อ' : 'ใบสั่งซื้อ', icon: isOnlinePurchaser ? ClipboardList : ShoppingBag, visible: true, badge: !isOnlinePurchaser && taskCounts.poCount > 0 ? taskCounts.poCount : null },
    { id: 'stock-card', label: 'คลัง stock', icon: Warehouse, visible: !isOnlinePurchaser },
    { id: 'quick-issue', label: 'เบิกใช้งาน', icon: SendToBack, visible: !isOnlinePurchaser },
    { id: 'budget', label: 'งบประมาณ', icon: Wallet, visible: !isOnlinePurchaser && currentRole.canViewBudget },
    { id: 'master-data', label: 'ข้อมูลหลัก', icon: Database, visible: !isOnlinePurchaser && currentRole.canManageMaster }
  ];

  const renderNavContent = (onItemClick = null) => (
    <>
      {/* Logo & System Title */}
      <div className="flex items-center justify-between mb-5 px-1.5 pt-1 pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="bg-gradient-to-tr from-indigo-500 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/30 shrink-0">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm tracking-tight text-white leading-tight truncate">
              ระบบ PR/PO & คลัง
            </h1>
            <span className="text-[11px] text-indigo-300 font-medium block truncate mt-0.5">
              {isOnlinePurchaser ? 'จัดซื้อออนไลน์' : 'ควบคุมงาน PD & QC'}
            </span>
          </div>
        </div>
        {onItemClick && (
          <button 
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Navigation Links ── */}
      <nav className="space-y-1 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isOnlinePurchaser ? 'เมนูจัดซื้อ' : 'เมนูหลัก'}
        </div>
        {menuItems.filter(item => item.visible).map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                if (onItemClick) onItemClick();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-[13px] transition-all cursor-pointer ${
                isActive
                  ? isOnlinePurchaser 
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25 font-bold translate-x-0.5'
                    : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 font-bold translate-x-0.5'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white hover:translate-x-0.5'
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Icon className={`w-4.5 h-4.5 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white text-violet-600' : 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'} animate-pulse-slow`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="mt-auto pt-3 border-t border-slate-800/60">
        {!isOnlinePurchaser && !currentRole.canViewBudget && (
          <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/30 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500/80 shrink-0 mt-0.5" />
            <span className="leading-snug">สิทธิ์ Supervisor ไม่เห็นงบประมาณ</span>
          </div>
        )}
        {isOnlinePurchaser && (
          <div className="p-2.5 bg-violet-950/40 rounded-xl border border-violet-800/30 text-[11px] text-violet-300 flex items-start gap-2">
            <ShoppingBag className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
            <span className="leading-snug">ฝ่ายจัดซื้อออนไลน์</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop Sidebar (Fixed Left) ── */}
      <aside className="w-60 bg-slate-900 border-r border-slate-800 shrink-0 h-screen fixed left-0 top-0 flex-col p-3.5 no-print z-40 hidden md:flex shadow-2xl shadow-slate-900/50">
        {renderNavContent()}
      </aside>

      {/* ── Mobile Sidebar Drawer (Overlay) ── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex no-print animate-fade-in">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Container */}
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 h-full flex flex-col p-4 shadow-2xl z-10 animate-slide-in-left border-r border-slate-800">
            {renderNavContent(onCloseMobile)}
          </aside>
        </div>
      )}
    </>
  );
}
