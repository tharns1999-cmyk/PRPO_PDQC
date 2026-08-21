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

  // Calculate Task Counts for Badges (using unified workflowEngine task aggregator)
  const taskCounts = React.useMemo(() => {
    const userTasks = workflowEngine.getUserTasks(currentRole, prs, pos);
    return userTasks.counts;
  }, [prs, pos, currentRole]);

  const menuItems = [
    { id: 'online-tasks', label: 'จัดซื้อออนไลน์', icon: ShoppingBag, visible: currentRole.canOnlinePurchase, badge: taskCounts.onlineCount > 0 ? taskCounts.onlineCount : null },
    { id: 'dashboard', label: 'ภาพรวมระบบ', icon: LayoutDashboard, visible: !isOnlinePurchaser },
    { id: 'my-workspace', label: 'งานของฉัน', icon: Sparkles, visible: !isOnlinePurchaser, badge: taskCounts.total > 0 ? taskCounts.total : null },
    { id: 'pr-list', label: 'ใบขอซื้อ', icon: ClipboardList, visible: !isOnlinePurchaser, badge: taskCounts.prCount > 0 ? taskCounts.prCount : null },
    { id: 'po-list', label: isOnlinePurchaser ? 'ประวัติใบสั่งซื้อ' : 'ใบสั่งซื้อ', icon: isOnlinePurchaser ? ClipboardList : ShoppingBag, visible: true, badge: !isOnlinePurchaser && taskCounts.poCount > 0 ? taskCounts.poCount : null },
    { id: 'stock-card', label: 'คลังสินค้า (Stock)', icon: Warehouse, visible: !isOnlinePurchaser },
    { id: 'quick-issue', label: 'เบิกใช้งาน', icon: SendToBack, visible: !isOnlinePurchaser },
    { id: 'budget', label: 'งบประมาณ', icon: Wallet, visible: !isOnlinePurchaser && currentRole.canViewBudget },
    { id: 'master-data', label: 'ข้อมูลหลัก', icon: Database, visible: !isOnlinePurchaser && currentRole.canManageMaster }
  ];

  const renderNavContent = (onItemClick = null) => (
    <>
      {/* Logo & System Title */}
      <div className="flex items-center justify-between mb-4 px-3 pt-2 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl shrink-0 flex items-center justify-center shadow-xs shadow-indigo-600/20">
            <Factory className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-tight truncate">
              PR/PO & Inventory
            </h1>
            <span className="text-[11px] text-slate-500 font-normal block truncate mt-0.5">
              {isOnlinePurchaser ? 'ส่วนงานจัดซื้อออนไลน์' : 'ฝ่ายผลิต & ควบคุมคุณภาพ'}
            </span>
          </div>
        </div>
        {onItemClick && (
          <button 
            onClick={onCloseMobile}
            className="md:hidden p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Navigation Links ── */}
      <nav className="space-y-1 flex-1 overflow-y-auto pr-1 pl-0.5 custom-scrollbar">
        <div className="px-3 pb-2 pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isOnlinePurchaser ? 'เมนูจัดซื้อ' : 'เมนูหลัก (Main Menu)'}
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
              className={`group w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-indigo-50/80 text-indigo-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50/90 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold tabular-nums transition-colors ${
                  isActive 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="mt-auto pt-3 border-t border-slate-100">
        {!isOnlinePurchaser && !currentRole.canViewBudget && (
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60 text-xs text-slate-500 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed text-[11px]">การเข้าถึงข้อมูลงบประมาณถูกจำกัด</span>
          </div>
        )}
        {isOnlinePurchaser && (
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-700 flex items-start gap-2.5">
            <ShoppingBag className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed text-[11px] font-medium">สิทธิ์จัดซื้อออนไลน์ (Shopee/Lazada)</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop Sidebar (Fixed Left) ── */}
      <aside className="w-64 bg-white border-r border-slate-200/80 shrink-0 h-screen fixed left-0 top-0 flex flex-col p-4 no-print z-40 hidden md:flex text-slate-900 shadow-sm">
        {renderNavContent()}
      </aside>

      {/* ── Mobile Sidebar Drawer (Overlay) ── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex no-print animate-fade-in">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Container */}
          <aside className="relative w-[280px] max-w-[85vw] bg-white border-r border-slate-200/80 h-full flex flex-col p-5 shadow-2xl z-10 animate-slide-in-left text-slate-900">
            {renderNavContent(onCloseMobile)}
          </aside>
        </div>
      )}
    </>
  );
}
