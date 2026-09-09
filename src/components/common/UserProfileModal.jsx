import React from 'react';
import { createPortal } from 'react-dom';
import { 
  UserCheck, Shield, X, Check, User, ArrowRightLeft, 
  Sparkles, Building2, ShoppingBag, Crown, Layers
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export default function UserProfileModal({ isOpen, onClose, currentRole, onLogout }) {
  const { availableUsers = [], handleSwitchUser } = useAppContext();

  if (!isOpen || !currentRole) return null;

  const deptColor = currentRole.department === 'QC'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : currentRole.department === 'ALL'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-blue-50 text-blue-700 border-blue-200';

  const handleSelectUser = (userAcc) => {
    handleSwitchUser(userAcc);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
        
        {/* ── 1. Fixed Header (Sticky Top / Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-2xs shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base tracking-tight">
                ข้อมูลผู้ใช้งาน & สลับบัญชี
              </h3>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                สิทธิ์การทำงานและสลับบทบาทจำลอง (Fast Account Switcher)
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0 custom-scrollbar bg-slate-50/30">
          
          {/* Active User Info Card */}
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
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                ตำแหน่ง: <span className="font-bold text-slate-800">{currentRole.title}</span>
              </p>
              {currentRole.username && (
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  @{currentRole.username} • {currentRole.employeeId || 'Staff'}
                </p>
              )}
            </div>
          </div>

          {/* Fast Account Switcher Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                <span>สลับบัญชีผู้ใช้งาน (Fast Account Switcher)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {availableUsers.length} บัญชีในระบบ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableUsers.map((userAcc) => {
                const isCurrent = userAcc.id === currentRole.id || 
                  userAcc.username === currentRole.username || 
                  (userAcc.roleId && userAcc.roleId === currentRole.roleId);

                return (
                  <button
                    key={userAcc.id}
                    type="button"
                    onClick={() => handleSelectUser(userAcc)}
                    className={`p-3 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between gap-2.5 group ${
                      isCurrent
                        ? 'bg-indigo-50/80 border-indigo-300/80 shadow-xs ring-1 ring-indigo-500/20'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        {userAcc.pictureUrl ? (
                          <img
                            src={userAcc.pictureUrl}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                            {userAcc.name?.charAt(0) || <User className="w-4 h-4" />}
                          </div>
                        )}
                        {isCurrent && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5"></span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold block truncate ${
                            isCurrent ? 'text-indigo-900' : 'text-slate-800 group-hover:text-indigo-600'
                          }`}>
                            {userAcc.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate font-normal">
                          {userAcc.title}
                        </span>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        สลับ
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permissions Matrix Box */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-2.5 text-xs shadow-xs">
            <p className="font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>สิทธิ์การเข้าถึงและการดำเนินงานของบัญชีนี้:</span>
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
                <span>จัดการจัดซื้อออนไลน์ (Online Tasks):</span>
                <span className={`font-semibold inline-flex items-center gap-1 ${currentRole.canOnlinePurchase ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {currentRole.canOnlinePurchase ? <><Check className="w-3.5 h-3.5" /> มีสิทธิ์</> : <><X className="w-3.5 h-3.5" /> ไม่มีสิทธิ์</>}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>จัดการข้อมูลหลัก (Master Data):</span>
                <span className={`font-semibold inline-flex items-center gap-1 ${currentRole.canManageMaster ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {currentRole.canManageMaster ? <><Check className="w-3.5 h-3.5" /> มีสิทธิ์</> : <><X className="w-3.5 h-3.5" /> ไม่มีสิทธิ์</>}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── 3. Sticky Action Footer ── */}
        <div className="shrink-0 px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0 z-20">
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            title="รีเซ็ตกลับเป็นบัญชีเริ่มต้น (คุณวิชัย - PD)"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>รีเซ็ตบัญชีเริ่มต้น</span>
          </button>

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
