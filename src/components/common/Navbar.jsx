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
  onRefresh 
}) {
  const [showNotiDrawer, setShowNotiDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 no-print">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Mobile Menu Button */}
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="hidden sm:block">
            <h2 className="font-bold text-slate-800 text-sm">ระบบขอซื้อและคลังสินค้า (PR/PO & Inventory)</h2>
            <p className="text-[11px] text-slate-400">
              {currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER'
                ? 'ฝ่ายจัดซื้อออนไลน์ (Shopee / Lazada) — Online Procurement Hub'
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
