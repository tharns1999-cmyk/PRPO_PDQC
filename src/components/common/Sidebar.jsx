import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, ShoppingBag, Warehouse, 
  SendToBack, Wallet, Database, ShieldAlert, Factory, Sparkles, X,
  User, ArrowRightLeft
} from 'lucide-react';
import { workflowEngine } from '../../services/workflowEngine';
import NotificationBell from './NotificationBell';
import NotificationDrawer from './NotificationDrawer';
import UserProfileModal from './UserProfileModal';

export default function Sidebar({ 
  activeView, 
  setActiveView, 
  currentRole, 
  prs = [], 
  pos = [],
  isMobileOpen = false,
  onCloseMobile = () => {},
  onNavigate,
  onOpenPR,
  onOpenPO,
  onLogout,
  onRefresh
}) {
  const [showNotiDrawer, setShowNotiDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const isOnlinePurchaser = currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER';

  // Calculate Task Counts for Badges (using unified workflowEngine task aggregator)
  const taskCounts = React.useMemo(() => {
    const userTasks = workflowEngine.getUserTasks(currentRole, prs, pos);
    return userTasks.counts;
  }, [prs, pos, currentRole]);

  const menuItems = [
    { 
      id: 'online-tasks', 
      path: '/online-tasks', 
      label: 'จัดซื้อออนไลน์', 
      ariaLabel: 'จัดซื้อออนไลน์ (Online Tasks)',
      icon: ShoppingBag, 
      visible: currentRole?.canOnlinePurchase, 
      badge: taskCounts.onlineCount > 0 ? taskCounts.onlineCount : null 
    },
    { 
      id: 'dashboard', 
      path: '/dashboard', 
      label: 'ภาพรวมระบบ', 
      ariaLabel: 'ภาพรวมระบบ Dashboard',
      icon: LayoutDashboard, 
      visible: !isOnlinePurchaser 
    },
    { 
      id: 'my-workspace', 
      path: '/my-workspace', 
      label: 'งานของฉัน', 
      ariaLabel: 'งานของฉัน (My Workspace)',
      icon: Sparkles, 
      visible: !isOnlinePurchaser, 
      badge: taskCounts.total > 0 ? taskCounts.total : null 
    },
    { 
      id: 'pr-list', 
      path: '/prs', 
      label: 'ใบขอซื้อ', 
      ariaLabel: 'ใบขอซื้อ (PR Workflow)',
      icon: ClipboardList, 
      visible: !isOnlinePurchaser, 
      badge: taskCounts.prCount > 0 ? taskCounts.prCount : null 
    },
    { 
      id: 'po-list', 
      path: '/pos', 
      label: isOnlinePurchaser ? 'ประวัติใบสั่งซื้อ' : 'ใบสั่งซื้อ', 
      ariaLabel: 'ใบสั่งซื้อ (PO / รับสินค้า)',
      icon: isOnlinePurchaser ? ClipboardList : ShoppingBag, 
      visible: true, 
      badge: !isOnlinePurchaser && taskCounts.poCount > 0 ? taskCounts.poCount : null 
    },
    { 
      id: 'stock-card', 
      path: '/inventory/stock-card', 
      label: 'คลังสินค้า (Stock)', 
      ariaLabel: 'คลังสต็อก (Warehouse) คลังสินค้า (Stock)',
      icon: Warehouse, 
      visible: true 
    },
    { 
      id: 'quick-issue', 
      path: '/inventory/quick-issue', 
      label: 'เบิกใช้งาน', 
      ariaLabel: 'เบิกสินค้า (Quick Issue) เบิกใช้งาน',
      icon: SendToBack, 
      visible: !isOnlinePurchaser 
    },
    { 
      id: 'budget', 
      path: '/budget', 
      label: 'งบประมาณ', 
      ariaLabel: 'งบประมาณ (Budget)',
      icon: Wallet, 
      visible: !isOnlinePurchaser && currentRole?.canViewBudget 
    },
    { 
      id: 'master-data', 
      path: '/master-data', 
      label: 'ข้อมูลหลัก', 
      ariaLabel: 'จัดการข้อมูลหลัก จัดการ Master Data ข้อมูลหลัก',
      icon: Database, 
      visible: !isOnlinePurchaser && currentRole?.canManageMaster 
    }
  ];

  const renderNavContent = (onItemClick = null) => (
    <div className="flex flex-col h-full">
      {/* ── 1. Top Section: Logo + System Name + Notification Bell ── */}
      <div className="px-3 pt-2 pb-3.5 border-b border-slate-100/90 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl shrink-0 flex items-center justify-center shadow-xs shadow-indigo-600/20">
              <Factory className="w-5 h-5" />
            </div>
            <div className="overflow-hidden min-w-0">
              <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-tight truncate">
                PR/PO & Inventory
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-slate-500 font-normal truncate">
                  {isOnlinePurchaser ? 'จัดซื้อออนไลน์' : 'ฝ่ายผลิต & QC'}
                </span>
                {currentRole?.department && currentRole.department !== 'ALL' && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md border ${
                    currentRole.department === 'PD' 
                      ? 'bg-blue-50 text-blue-700 border-blue-200/70' 
                      : 'bg-amber-50 text-amber-700 border-amber-200/70'
                  }`}>
                    {currentRole.department}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Actions: Notification Bell & Mobile Close Button */}
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell 
              currentRole={currentRole} 
              onClick={() => setShowNotiDrawer(true)} 
            />

            {onItemClick && (
              <button 
                onClick={onCloseMobile}
                className="md:hidden p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Navigation Links (Scrollable Center) ── */}
      <nav className="space-y-1 flex-1 overflow-y-auto py-3 pr-1 pl-0.5 custom-scrollbar min-h-0">
        <div className="px-3 pb-2 pt-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isOnlinePurchaser ? 'เมนูจัดซื้อ' : 'เมนูหลัก (Main Menu)'}
        </div>
        {menuItems.filter(item => item.visible).map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              role="button"
              aria-label={item.ariaLabel || item.label}
              onClick={() => {
                if (setActiveView) setActiveView(item.id);
                if (onItemClick) onItemClick();
              }}
              className={({ isActive: navActive }) => {
                const isActive = navActive || activeView === item.id;
                return `group w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50/80 text-indigo-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50/90 hover:text-slate-900'
                }`;
              }}
            >
              {({ isActive: navActive }) => {
                const isActive = navActive || activeView === item.id;
                return (
                  <>
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
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </nav>

      {/* ── 3. Footer: User Profile & Role Card ── */}
      <div className="mt-auto pt-3 border-t border-slate-100/90 shrink-0 space-y-2">
        {/* Permission status warning for restricted roles */}
        {!isOnlinePurchaser && !currentRole?.canViewBudget && (
          <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/60 text-xs text-slate-500 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="leading-snug text-[10px]">งบประมาณถูกจำกัดสิทธิ์</span>
          </div>
        )}

        {/* User Card with Avatar, Name, Title, and Fast Switcher Button */}
        <div className="p-2.5 bg-slate-50/80 hover:bg-slate-100/80 rounded-2xl border border-slate-200/70 transition-all flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
            title="คลิกเพื่อดูข้อมูลผู้ใช้งานและสลับบทบาทการทำงาน"
          >
            <div className="relative shrink-0">
              {currentRole?.pictureUrl ? (
                <img
                  src={currentRole.pictureUrl}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 shadow-2xs">
                  {currentRole?.name?.charAt(0) || <User className="w-4 h-4" />}
                </div>
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5"></span>
            </div>

            <div className="overflow-hidden min-w-0">
              <span className="font-bold text-slate-900 block leading-tight text-xs truncate group-hover:text-indigo-600 transition-colors">
                {currentRole?.name || 'ผู้ใช้งาน'}
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight font-normal truncate mt-0.5">
                {currentRole?.title || 'Staff'} {currentRole?.department ? `(${currentRole.department})` : ''}
              </span>
            </div>
          </button>

          {/* Fast Switch User Button */}
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer shrink-0"
            title="สลับบัญชีผู้ใช้งาน (Switch Account)"
            aria-label="Switch User"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
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
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-[280px] max-w-[85vw] bg-white border-r border-slate-200/80 h-full flex flex-col p-5 shadow-2xl z-10 animate-slide-in-left text-slate-900">
            {renderNavContent(onCloseMobile)}
          </aside>
        </div>
      )}

      {/* ── Integrated Notification Drawer Modal ── */}
      <NotificationDrawer
        isOpen={showNotiDrawer}
        onClose={() => setShowNotiDrawer(false)}
        currentRole={currentRole}
        onNavigate={onNavigate}
        onOpenPR={onOpenPR}
        onOpenPO={onOpenPO}
        onRefresh={onRefresh}
      />

      {/* ── Integrated User Profile & Role Modal (with Fast Account Switcher) ── */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentRole={currentRole}
        onLogout={onLogout}
      />
    </>
  );
}
