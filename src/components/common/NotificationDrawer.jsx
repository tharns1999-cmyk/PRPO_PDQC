import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { notificationService, NOTIFICATION_TYPES } from '../../services/notificationService';
import { modalService } from '../../services/modalService';
import { 
  Bell, X, CheckCheck, Trash2,
  FileText, ShieldCheck, CheckCircle2, XCircle, ShoppingBag, PackageCheck, 
  AlertTriangle, ArrowDownRight, Clock, Flame, Check, AlertCircle, MessageSquareQuote
} from 'lucide-react';

const ICON_MAP = {
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  PackageCheck,
  AlertTriangle,
  ArrowDownRight,
  Bell
};

export default function NotificationDrawer({ isOpen, onClose, currentRole, onNavigate, onOpenPR, onOpenPO, onRefresh }) {
  const [filter, setFilter] = useState('ALL');

  if (!isOpen) return null;

  const isOnlinePurchaser = currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER';
  const notifications = notificationService.getNotificationsForRole(currentRole);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filtered = notifications.filter(n => {
    const typeInfo = NOTIFICATION_TYPES[n.type] || n.typeInfo || {};
    const isUrgent = typeInfo.priority === 'URGENT' || ['PR_SUBMITTED', 'PR_REVIEWED', 'PR_REJECTED', 'PR_CANCELLED', 'PO_CANCELLED', 'ONLINE_TASK', 'LOW_STOCK_ROP'].includes(n.type);

    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'ACTION') return isUrgent;
    if (filter === 'INFO') return !isUrgent;
    if (filter === 'STOCK') return ['LOW_STOCK_ROP', 'GOODS_RECEIVED', 'STOCK_ISSUED'].includes(n.type);
    return true;
  });

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead(currentRole);
    if (onRefresh) onRefresh();
  };

  const handleClearAll = async () => {
    const confirmed = await modalService.confirm({
      title: 'ล้างการแจ้งเตือน',
      message: 'ต้องการล้างประวัติการแจ้งเตือนทั้งหมดในระบบหรือไม่?',
      type: 'warning',
      confirmText: 'ล้างทั้งหมด',
      cancelText: 'ยกเลิก'
    });
    if (confirmed) {
      notificationService.clearAll();
      if (onRefresh) onRefresh();
    }
  };

  const handleSingleMarkRead = (e, notiId) => {
    e.stopPropagation();
    notificationService.markAsRead(notiId);
    if (onRefresh) onRefresh();
  };

  const handleSingleDelete = (e, notiId) => {
    e.stopPropagation();
    const all = notificationService.getAll().filter(n => n.id !== notiId);
    notificationService.saveAll(all);
    if (onRefresh) onRefresh();
  };

  const handleItemClick = (noti) => {
    notificationService.markAsRead(noti.id);
    if (onRefresh) onRefresh();

    if (isOnlinePurchaser) {
      if (onNavigate) onNavigate('online-tasks');
    } else if (noti.refDocType === 'PR') {
      if (onOpenPR && noti.refDocId) {
        onOpenPR(noti.refDocId);
      } else if (onNavigate) {
        onNavigate('pr-list');
      }
    } else if (noti.refDocType === 'PO') {
      if (onOpenPO && noti.refDocId) {
        onOpenPO(noti.refDocId);
      } else if (onNavigate) {
        onNavigate(noti.type === 'ONLINE_TASK' ? 'online-tasks' : 'po-list');
      }
    } else if (noti.refDocType === 'STOCK') {
      if (onNavigate) onNavigate('stock-card');
    }
    onClose();
  };

  const actionCount = notifications.filter(n => {
    const typeInfo = NOTIFICATION_TYPES[n.type] || n.typeInfo || {};
    return !n.isRead && (typeInfo.priority === 'URGENT' || ['PR_SUBMITTED', 'PR_REVIEWED', 'PR_REJECTED', 'PR_CANCELLED', 'PO_CANCELLED', 'ONLINE_TASK', 'LOW_STOCK_ROP'].includes(n.type));
  }).length;

  return createPortal(
    <>
      {/* ── Glass Backdrop ── */}
      <div 
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-[60] animate-fade-in no-print" 
        onClick={onClose} 
      />

      {/* ── Slide-over Notification Panel ── */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white/95 backdrop-blur-md shadow-2xl shadow-slate-900/10 z-[65] flex flex-col border-l border-slate-200/80 animate-slide-left overflow-hidden no-print">
        
        {/* ── 1. Drawer Header ── */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-20 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-2xs shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-base tracking-tight truncate">
                  ศูนย์แจ้งเตือน
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-slate-900 text-white text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                กิจกรรมและสถานะงานในระบบ
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer shrink-0"
            title="ปิดศูนย์แจ้งเตือน"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 2. Filter Segmented Bar & Ghost Actions ── */}
        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100 space-y-2.5 shrink-0">
          {/* Segmented Filter Pills */}
          <div className="overflow-x-auto scrollbar-none flex gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/50 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'ALL', label: `ทั้งหมด (${notifications.length})` },
              { id: 'ACTION', label: `ด่วน / ต้องทำ${actionCount > 0 ? ` (${actionCount})` : ''}` },
              { id: 'INFO', label: 'แจ้งเตือนทั่วไป' },
              ...(!isOnlinePurchaser ? [{ id: 'STOCK', label: 'สต๊อก & คลัง' }] : []),
              { id: 'UNREAD', label: `ยังไม่อ่าน${unreadCount > 0 ? ` (${unreadCount})` : ''}` }
            ].map(tab => {
              const isSelected = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-medium'
                      : 'text-slate-500 hover:text-slate-800 font-normal hover:bg-white/40'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Ghost Quick Actions */}
          <div className="flex items-center justify-between text-xs px-0.5">
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5 cursor-pointer font-normal hover:bg-slate-100/60 px-2 py-1 rounded-lg"
              title="ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"
            >
              <CheckCheck className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
              <span>ทำเครื่องหมายอ่านแล้วทั้งหมด</span>
            </button>
            
            <button
              onClick={handleClearAll}
              className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1.5 cursor-pointer font-normal hover:bg-slate-100/60 px-2 py-1 rounded-lg"
              title="ล้างประวัติการแจ้งเตือนทั้งหมด"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500" />
              <span>ล้างประวัติ</span>
            </button>
          </div>
        </div>

        {/* ── 3. Notification Card Feed ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar bg-slate-50/30">
          {filtered.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6 text-slate-400 my-auto">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/60 flex items-center justify-center text-slate-300 mb-3 shadow-xs">
                <Bell className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h4 className="text-sm font-medium text-slate-700">ไม่มีการแจ้งเตือนในขณะนี้</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-normal">
                เมื่อมีกิจกรรม การขออนุมัติ หรือการแจ้งเตือนสต๊อกใหม่ รายการจะปรากฏที่นี่โดยอัตโนมัติ
              </p>
            </div>
          ) : (
            filtered.map(noti => {
              const typeConfig = NOTIFICATION_TYPES[noti.type] || noti.typeInfo || {};
              const Icon = ICON_MAP[typeConfig.icon] || Bell;
              
              const isDanger = ['PR_REJECTED', 'PR_CANCELLED', 'PO_CANCELLED', 'PO_CLAIM', 'SELF_CLAIM'].includes(noti.type) || noti.type?.includes('REJECT');
              const isWarning = ['LOW_STOCK_ROP', 'PR_SUBMITTED'].includes(noti.type);
              const isSuccess = ['PR_APPROVED', 'GOODS_RECEIVED'].includes(noti.type);
              const isUrgent = typeConfig.priority === 'URGENT' || isDanger || isWarning || ['ONLINE_TASK'].includes(noti.type);

              // ── Modern Pastel Status Icons (User Directives) ──
              let iconWrapperClass = 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
              let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200/60';
              let badgeLabel = typeConfig.label || 'ทั่วไป';

              if (isSuccess) {
                iconWrapperClass = 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20';
                badgeClass = 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60 font-medium';
              } else if (isDanger) {
                iconWrapperClass = 'bg-rose-50 text-rose-600 ring-1 ring-rose-500/20';
                badgeClass = 'bg-rose-50/80 text-rose-700 border-rose-200/60 font-medium';
              } else if (isWarning) {
                iconWrapperClass = 'bg-amber-50 text-amber-600 ring-1 ring-amber-500/20';
                badgeClass = 'bg-amber-50/80 text-amber-800 border-amber-200/60 font-medium';
              } else if (isUrgent) {
                iconWrapperClass = 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/20';
                badgeClass = 'bg-indigo-50/80 text-indigo-700 border-indigo-200/60 font-medium';
              }

              // Rejection Reason Extraction
              const rejectionReason = noti.rejectReason || noti.reason || (
                isDanger && noti.message && noti.message.includes(': ')
                  ? noti.message.split(': ').slice(1).join(': ').trim()
                  : null
              );
              
              const displayMessage = rejectionReason && noti.message && noti.message.includes(': ')
                ? noti.message.split(': ')[0]
                : noti.message;

              return (
                <div 
                  key={noti.id}
                  onClick={() => handleItemClick(noti)}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative group flex items-start gap-3.5 shadow-xs ${
                    !noti.isRead 
                      ? 'bg-white border-indigo-100/90 hover:bg-slate-50/90 hover:border-indigo-200' 
                      : 'bg-white border-slate-100 hover:bg-slate-50/80 hover:border-slate-200/60'
                  }`}
                >
                  {/* Status Icon Pastel Circle */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-105 ${iconWrapperClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Card Content Column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeClass}`}>
                        {isUrgent && <Flame className="w-2.5 h-2.5 text-rose-500 inline mr-0.5" />}
                        {badgeLabel}
                      </span>
                    </div>

                    <h5 className="font-medium text-slate-900 text-xs mt-1.5 leading-snug">
                      {noti.title}
                    </h5>

                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-normal">
                      {displayMessage}
                    </p>

                    {/* Rejection Reason Box (Highlight Feature) */}
                    {rejectionReason && (
                      <div className="bg-rose-50/60 border border-rose-100/80 rounded-xl p-2.5 text-xs text-rose-900 font-normal mt-2 flex items-start gap-2">
                        <MessageSquareQuote className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-rose-950 block text-[11px] mb-0.5">
                            เหตุผลการส่งกลับ / ไม่อนุมัติ:
                          </span>
                          <span className="leading-relaxed break-words text-rose-900/90">
                            {rejectionReason}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Meta Info Footer */}
                    <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100/80 text-[11px]">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-normal">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {noti.timeFormatted || noti.timestamp}
                      </span>

                      {noti.docNo && (
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {noti.docNo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action / Unread Status Indicator */}
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    {!noti.isRead && (
                      <span 
                        className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50 group-hover:hidden shrink-0" 
                        title="ยังไม่ได้อ่าน" 
                      />
                    )}
                    
                    <button
                      onClick={(e) => handleSingleMarkRead(e, noti.id)}
                      className="hidden group-hover:flex items-center justify-center w-7 h-7 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all cursor-pointer"
                      title="ทำเครื่องหมายว่าอ่านแล้ว"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleSingleDelete(e, noti.id)}
                      className="hidden group-hover:flex items-center justify-center w-7 h-7 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                      title="ลบการแจ้งเตือนนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
