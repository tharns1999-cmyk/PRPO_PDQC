import React from 'react';
import { createPortal } from 'react-dom';
import { 
  Shield, X, Check, User, ArrowRightLeft, 
  RotateCcw, LogOut, AlertTriangle, Mail, IdCard, Building2, CheckCircle2, XCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth, normalizeRole } from '../../context/AuthContext';
import { getUserDepartments } from '../../utils/permissions';
import { getRolePermissionsChecklist, isUATEnv } from '../../services/authService';

const getDeptBadgeStyle = (dept) => {
  switch (dept?.toUpperCase()) {
    case 'QC':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'PD':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'WH':
    case 'WAREHOUSE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PUR':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'ENG':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'ALL':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export default function UserProfileModal({ 
  isOpen, 
  onClose, 
  currentRole, 
  currentUser,
  onLogout,
  isDev
}) {
  const appContext = useAppContext() || {};
  const { availableUsers = [], handleSwitchUser } = appContext;

  let auth = null;
  try {
    auth = useAuth();
  } catch {
    auth = null;
  }

  if (!isOpen) return null;

  // Resolved active user
  const targetUser = currentRole || currentUser || auth?.currentUser || auth?.currentRole;
  if (!targetUser) return null;

  // Environment & Role Simulation Gating:
  // ONLY if isAdmin === true OR import.meta.env.VITE_APP_ENV === 'uat'
  const isUAT = isUATEnv();
  const isAdmin = Boolean(
    auth?.isAdmin || 
    targetUser?.isAdmin === true || 
    targetUser?.role === 'admin' || 
    targetUser?.roleId === 'ADMIN' || 
    targetUser?.username === 'admin' || 
    Number(targetUser?.level) >= 99 ||
    auth?.originalUser?.roleId === 'ADMIN'
  );
  
  // Can impersonate roles only in UAT or Admin mode
  const canImpersonate = Boolean(isAdmin || isUAT);

  // Simulation status & original admin account
  const isSimulating = Boolean(auth?.isSimulating || (auth?.originalUser && auth.originalUser.id !== targetUser.id));
  const originalUser = auth?.originalUser;

  const currentDepts = getUserDepartments(targetUser);
  const canonicalRole = targetUser?.canonicalRole || 
    (targetUser ? normalizeRole(targetUser) : null) || 
    auth?.canonicalRole || 
    'REQUESTER';

  // Permission Checklist (PR creation, Approval, Purchasing, Inventory)
  const permissionChecklist = getRolePermissionsChecklist(targetUser);

  const handleSelectUser = (userAcc) => {
    if (auth?.switchRoleDev) {
      auth.switchRoleDev(userAcc);
    }
    if (handleSwitchUser) {
      handleSwitchUser(userAcc);
    }
    onClose();
  };

  const handleRevertSimulation = () => {
    if (auth?.revertSimulation) {
      const restored = auth.revertSimulation();
      if (restored && handleSwitchUser) {
        handleSwitchUser(restored);
      }
    }
  };

  const handleLogoutFromModal = (e) => {
    if (e) e.stopPropagation();
    onClose();
    if (onLogout) {
      onLogout();
    } else if (appContext?.handleLogout) {
      appContext.handleLogout();
    } else if (auth?.logout) {
      auth.logout();
    }
  };

  const modalContent = (
    <div 
      data-testid="user-profile-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:hidden"
    >
      <div 
        data-testid="user-profile-modal"
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in"
      >
        
        {/* ── 1. Header (Sticky Top / Non-scrollable) ── */}
        <div className="shrink-0 px-5 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-2xs shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 
                data-testid="profile-modal-title"
                className="font-bold text-slate-900 text-base tracking-tight truncate"
              >
                {canImpersonate ? 'โปรไฟล์ผู้ใช้งาน & สลับบทบาท' : 'โปรไฟล์ผู้ใช้งานและสิทธิ์ในระบบ'}
              </h3>
              <p 
                data-testid="profile-modal-subtitle"
                className="text-xs text-slate-500 font-normal truncate mt-0.5"
              >
                {canImpersonate 
                  ? 'ตรวจสอบสิทธิ์ RBAC และจำลองบทบาทผู้ใช้งาน (UAT / Admin)' 
                  : 'ข้อมูลยืนยันตัวตน Google Workspace และสิทธิ์การใช้งาน (Read-Only)'}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Active Simulation Warning Banner (Subtle, 1-Click Revert) ── */}
        {isSimulating && (
          <div 
            data-testid="impersonation-warning-banner"
            className="shrink-0 bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">
                กำลังจำลองสิทธิ์: <strong className="font-bold text-amber-950">{targetUser.title || targetUser.name || canonicalRole}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleRevertSimulation}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] shadow-2xs transition-colors shrink-0 cursor-pointer"
              title="ยกเลิกการจำลองและกลับสู่บัญชีหลักของผู้ดูแลระบบ"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>กลับสู่บัญชีหลัก</span>
            </button>
          </div>
        )}

        {/* ── 2. Scrollable Body (Max-height: 85vh container constraint) ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 custom-scrollbar bg-slate-50/40">
          
          {/* Production-Ready User Profile Card */}
          <div 
            data-testid="user-profile-card"
            className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-start sm:items-center gap-3.5"
          >
            {targetUser.pictureUrl ? (
              <img
                src={targetUser.pictureUrl}
                alt={targetUser.name || 'User Profile'}
                className="w-13 h-13 rounded-2xl object-cover border border-indigo-200 shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
                {targetUser.name?.charAt(0) || 'U'}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-900 text-base leading-snug truncate">
                  {targetUser.name || 'ผู้ใช้งานระบบ'}
                </h4>
                {currentDepts.map(d => (
                  <span key={d} className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getDeptBadgeStyle(d)}`}>
                    {d}
                  </span>
                ))}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Authenticated
                </span>
              </div>

              {/* Department Tag & Title */}
              <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>ตำแหน่ง: <strong className="text-slate-800">{targetUser.title || targetUser.positionKey || canonicalRole}</strong></span>
                {targetUser.employeeName && (
                  <span className="text-slate-500">({targetUser.employeeName})</span>
                )}
              </p>

              {/* Company Email & Employee ID */}
              <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500 flex-wrap">
                <div className="inline-flex items-center gap-1 min-w-0" title="Company Email">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono text-slate-600 truncate">{targetUser.email || `${targetUser.username || 'user'}@company.com`}</span>
                </div>
                {targetUser.employeeId && (
                  <div className="inline-flex items-center gap-1 shrink-0" title="Employee ID">
                    <IdCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono font-medium text-slate-600">{targetUser.employeeId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Permissions Checklist (PR creation, Approval, Purchasing, Inventory) ── */}
          <div 
            data-testid="rbac-permissions-card"
            className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-2.5 text-xs shadow-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>สิทธิ์การเข้าถึงและการดำเนินงาน (RBAC Permissions):</span>
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {canonicalRole}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {permissionChecklist.map((perm) => (
                <div 
                  key={perm.key} 
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    perm.allowed 
                      ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950' 
                      : 'bg-slate-50/60 border-slate-200/60 text-slate-400'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs leading-tight truncate">
                      {perm.label}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      {perm.description}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold shrink-0 ${
                    perm.allowed ? 'text-emerald-700' : 'text-slate-400'
                  }`}>
                    {perm.allowed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>มีสิทธิ์</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-300" />
                        <span>ไม่มีสิทธิ์</span>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Gated Role Simulation Section (Admin & UAT Mode ONLY) ── */}
          {canImpersonate && (
            <div 
              data-testid="dev-account-switcher-section" 
              className="p-4 bg-white border border-indigo-100/90 rounded-2xl space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                  <span>จำลองสิทธิ์บทบาท (Role Simulation — Admin / UAT)</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {availableUsers.length} บทบาท
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableUsers.map((userAcc) => {
                  const isCurrent = userAcc.id === targetUser.id || 
                    userAcc.username === targetUser.username || 
                    (userAcc.roleId && userAcc.roleId === targetUser.roleId);

                  return (
                    <button
                      key={userAcc.id}
                      type="button"
                      onClick={() => handleSelectUser(userAcc)}
                      className={`p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 group ${
                        isCurrent
                          ? 'bg-indigo-50/90 border-indigo-300 shadow-xs ring-1 ring-indigo-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {userAcc.pictureUrl ? (
                            <img
                              src={userAcc.pictureUrl}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                              {userAcc.name?.charAt(0) || <User className="w-3.5 h-3.5" />}
                            </div>
                          )}
                          {isCurrent && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className={`text-xs font-bold block truncate ${
                            isCurrent ? 'text-indigo-900' : 'text-slate-800 group-hover:text-indigo-600'
                          }`}>
                            {userAcc.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {userAcc.title || userAcc.canonicalRole}
                          </span>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          จำลอง
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── 3. Sticky Action Footer (Iframe-friendly Compact Visibility) ── */}
        <div className="shrink-0 px-5 py-3 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between gap-3 sticky bottom-0 z-20">
          <div className="flex items-center gap-2">
            {isSimulating && (
              <button
                type="button"
                onClick={handleRevertSimulation}
                className="px-3.5 py-1.5 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                title="กลับสู่บัญชีหลักของผู้ดูแลระบบ"
                data-testid="modal-revert-admin-btn"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>กลับสู่บัญชีหลัก</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogoutFromModal}
              data-testid="modal-logout-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ (Sign Out)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="modal-close-btn"
            className="px-5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
