import React from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, Shield, X, LogOut, CheckCircle2, User, Check } from 'lucide-react';

export default function UserProfileModal({ isOpen, onClose, currentRole, onLogout }) {
  if (!isOpen || !currentRole) return null;

  const deptColor = currentRole.department === 'QC'
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : currentRole.department === 'ALL'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : 'bg-blue-100 text-blue-800 border-blue-300';

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-4 print:hidden animate-fade-in">
      <div className="impeccable-card w-full max-w-md flex flex-col bg-white overflow-hidden shadow-2xl animate-zoom-in rounded-3xl border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-bold shadow-inner">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                ข้อมูลผู้ใช้งาน (User Profile)
              </h3>
              <p className="text-xs text-indigo-200">สถานะและสิทธิ์การทำงานในระบบ</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white font-bold p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 bg-slate-50/50">
          {/* User Info Card */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            {currentRole.pictureUrl ? (
              <img
                src={currentRole.pictureUrl}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-md shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl border-2 border-indigo-500 shrink-0">
                {currentRole.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-900 text-base truncate">{currentRole.name}</h4>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${deptColor}`}>
                  {currentRole.department}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                ตำแหน่ง: <span className="font-bold text-slate-800">{currentRole.title}</span>
              </p>
              {currentRole.username && (
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  @{currentRole.username}
                </p>
              )}
            </div>
          </div>

          {/* Permissions Matrix Box */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 text-xs shadow-sm">
            <p className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <Shield className="w-4 h-4 text-indigo-600" />
              สิทธิ์การเข้าถึงและการดำเนินงาน:
            </p>
            <ul className="space-y-1.5 text-slate-600 text-xs pt-1">
              <li className="flex items-center justify-between">
                <span>สร้างใบขอซื้อ (PR):</span>
                <span className={`font-semibold inline-flex items-center gap-1 ${currentRole.canCreatePR ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {currentRole.canCreatePR ? <><Check className="w-3.5 h-3.5" /> มีสิทธิ์</> : <><X className="w-3.5 h-3.5" /> ไม่มีสิทธิ์</>}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>ตรวจทาน PR (Reviewer Level 1):</span>
                <span className={`font-semibold inline-flex items-center gap-1 ${currentRole.canReview ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {currentRole.canReview ? <><Check className="w-3.5 h-3.5" /> มีสิทธิ์</> : <><X className="w-3.5 h-3.5" /> ไม่มีสิทธิ์</>}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>อนุมัติสั่งซื้อ (Final Approver):</span>
                <span className={`font-semibold inline-flex items-center gap-1 ${currentRole.canFinalApprove ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {currentRole.canFinalApprove ? <><Check className="w-3.5 h-3.5" /> มีสิทธิ์</> : <><X className="w-3.5 h-3.5" /> ไม่มีสิทธิ์</>}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>ดูภาพรวมงบประมาณ (Budget):</span>
                <span className={`font-semibold inline-flex items-center gap-1 ${currentRole.canViewBudgetMenu ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {currentRole.canViewBudgetMenu ? <><Check className="w-3.5 h-3.5" /> มีสิทธิ์</> : <><X className="w-3.5 h-3.5" /> ซ่อน</>}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>สั่งซื้อออนไลน์ (Shopee/Lazada):</span>
                <span className={`font-semibold inline-flex items-center gap-1 ${currentRole.canOnlinePurchase ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {currentRole.canOnlinePurchase ? <><Check className="w-3.5 h-3.5" /> มีสิทธิ์</> : <><X className="w-3.5 h-3.5" /> ไม่มีสิทธิ์</>}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
          {onLogout ? (
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ (Sign Out)</span>
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
