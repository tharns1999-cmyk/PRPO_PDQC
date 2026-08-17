import React, { useState } from 'react';
import { Menu, User } from 'lucide-react';
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
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 no-print">
      <div className="w-full px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Mobile Menu Button & System Title */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <button 
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 -ml-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0"
            aria-label="Open Navigation Menu"
            title="เปิดเมนูการใช้งาน"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="overflow-hidden">
            <h2 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
              <span className="sm:hidden">ระบบ PR/PO & คลัง</span>
              <span className="hidden sm:inline">ระบบขอซื้อและคลังสินค้า (PR/PO & Inventory)</span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              {currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER'
                ? 'ฝ่ายจัดซื้อออนไลน์ (Shopee / Lazada)'
                : 'ควบคุมงานฝ่ายผลิต (PD) และฝ่ายควบคุมคุณภาพ (QC)'}
            </p>
          </div>
        </div>

        {/* Right Section: Notification Bell + User Profile Badge */}
        <div className="flex items-center gap-3">
          {/* In-App Notification Bell */}
          <NotificationBell 
            currentRole={currentRole} 
            onClick={() => setShowNotiDrawer(true)} 
          />

          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* User Profile Badge */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all text-xs shadow-sm group cursor-pointer"
            title="คลิกเพื่อดูข้อมูลผู้ใช้งานและสิทธิ์การทำงาน"
          >
            <div className="relative">
              {currentRole?.pictureUrl ? (
                <img
                  src={currentRole.pictureUrl}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-indigo-500"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white absolute -bottom-0.5 -right-0.5"></span>
            </div>

            <div className="text-left hidden sm:block">
              <span className="font-bold text-slate-800 block leading-tight truncate max-w-[130px]">
                {currentRole?.name || 'User'}
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight font-medium">
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
