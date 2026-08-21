import React from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, Shield, X, LogOut, CheckCircle2, User, Check } from 'lucide-react';

export default function UserProfileModal({ isOpen, onClose, currentRole, onLogout }) {
  if (!isOpen || !currentRole) return null;

  const deptColor = currentRole.department === 'QC'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : currentRole.department === 'ALL'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-blue-50 text-blue-700 border-blue-200';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
        
        {/* ── 1. Fixed Header (Sticky Top / Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-2xs shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base tracking-tight">
                ข้อมูลผู้ใช้งาน (User Profile)
              </h3>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                สถานะและสิทธิ์การทำงานในระบบ
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 2. Scrollable Content Body (Flex-1 / Dynamic Height) ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 custom-scrollbar bg-slate-50/30">
          {/* User Info Card */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            {currentRole.pictureUrl ? (
              <img
                src={currentRole.pictureUrl}
                alt="Profile"
                className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl border-2 border-indigo-300 shrink-0">
                {currentRole.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-900 text-base truncate">{currentRole.name}</h4>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${deptColor}`}>
                  {currentRole.department}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
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
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-2.5 text-xs shadow-xs">
            <p className="font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>สิทธิ์การเข้าถึงและการดำเนินงาน:</span>
            </p>
            <ul className="space-y-2 text-slate-600 text-xs pt-1">
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
                <span>จัดการ Master Data:</span>
                <span className={`font-semibold inline-flex items-center gap-1 ${currentRole.canManageMaster ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {currentRole.canManageMaster ? <><Check className="w-3.5 h-3.5" /> มีสิทธิ์</> : <><X className="w-3.5 h-3.5" /> ไม่มีสิทธิ์</>}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── 3. Sticky Action Footer (Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0 z-20">
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          ) : <span />}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
