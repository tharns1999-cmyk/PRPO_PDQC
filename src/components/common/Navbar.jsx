import React, { useState } from 'react';
import { Menu, User, Building2 } from 'lucide-react';
import NotificationBell from './NotificationBell';
import NotificationDrawer from './NotificationDrawer';
import UserProfileModal from './UserProfileModal';

export default function Navbar({ 
  currentRole, 
  onNavigate, 
  onOpenPR, 
  onOpenPO, 
  onLogout,
  onRefresh,
  onToggleMobileSidebar
}) {
  const [showNotiDrawer, setShowNotiDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 no-print">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Mobile Menu Button & System Title */}
        <div className="flex items-center gap-3 overflow-hidden">
          <button 
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 -ml-1 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0"
            aria-label="Open Navigation Menu"
            title="เปิดเมนูการใช้งาน"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm sm:text-base truncate tracking-tight">
                <span className="sm:hidden">ระบบ PR/PO & คลัง</span>
                <span className="hidden sm:inline">ระบบขอซื้อและคลังสินค้า (PR/PO & Inventory)</span>
              </h2>
              {currentRole?.department && currentRole.department !== 'ALL' && (
                <span className={`hidden sm:inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                  currentRole.department === 'PD' 
                    ? 'bg-blue-50 text-blue-700 border-blue-200/70' 
                    : 'bg-amber-50 text-amber-700 border-amber-200/70'
                }`}>
                  ฝ่าย {currentRole.department}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
              {currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER'
                ? 'ฝ่ายจัดซื้อออนไลน์ (Shopee / Lazada)'
                : 'ฝ่ายผลิต (PD) & ควบคุมคุณภาพ (QC)'}
            </p>
          </div>
        </div>

        {/* Right Section: Notification Bell + User Profile Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* In-App Notification Bell */}
          <NotificationBell 
            currentRole={currentRole} 
            onClick={() => setShowNotiDrawer(true)} 
          />

          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* User Profile Badge */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200/60 transition-all text-xs group cursor-pointer"
            title="คลิกเพื่อดูข้อมูลผู้ใช้งานและสิทธิ์การทำงาน"
          >
            <div className="relative">
              {currentRole?.pictureUrl ? (
                <img
                  src={currentRole.pictureUrl}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold border border-slate-200 shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5"></span>
            </div>

            <div className="text-left hidden sm:block">
              <span className="font-bold text-slate-900 block leading-tight truncate max-w-[130px]">
                {currentRole?.name || 'User'}
              </span>
              <span className="text-[11px] text-slate-500 block leading-tight font-normal">
                {currentRole?.title || 'Staff'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Notification Drawer Component */}
      <NotificationDrawer
        isOpen={showNotiDrawer}
        onClose={() => setShowNotiDrawer(false)}
        currentRole={currentRole}
        onNavigate={onNavigate}
        onOpenPR={onOpenPR}
        onOpenPO={onOpenPO}
        onRefresh={onRefresh}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentRole={currentRole}
        onLogout={onLogout}
      />
    </header>
  );
}
