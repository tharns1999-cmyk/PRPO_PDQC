import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { notificationService, NOTIFICATION_TYPES } from '../../services/notificationService';
import { modalService } from '../../services/modalService';
import { 
  Bell, X, CheckCheck, Trash2, ExternalLink, 
  FileText, ShieldCheck, CheckCircle2, XCircle, ShoppingBag, PackageCheck, 
  AlertTriangle, ArrowDownRight, Clock, Flame, Info, AlertOctagon, RefreshCw, Lock, Check
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
  AlertOctagon,
  RefreshCw,
  Lock,
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
      {/* Glass Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[60] animate-fade-in" 
        onClick={onClose} 
      />

      {/* Slide-over Notification Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[65] flex flex-col border-l border-slate-200/80 animate-slide-left overflow-hidden">
        
        {/* ── Sticky Header ── */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white sticky top-0 z-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-2xs shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base tracking-tight">ศูนย์แจ้งเตือน</h3>
                {unreadCount > 0 && (
                  <span className="bg-indigo-600 text-white text-[11px] font-bold font-mono px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-normal">กิจกรรมและสถานะงานในระบบ</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="ปิดศูนย์แจ้งเตือน"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Segmented Control Filter Bar & Quick Actions ── */}
        <div className="p-3 sm:p-3.5 bg-slate-50/70 border-b border-slate-100 space-y-2.5">
          {/* Segmented Filter Pills */}
          <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-1 overflow-x-auto custom-scrollbar no-scrollbar text-xs font-medium border border-slate-200/40">
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between text-xs px-1">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 cursor-pointer font-medium hover:bg-indigo-50/60 px-2 py-1 rounded-lg"
              title="ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"
            >
              <CheckCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>อ่านทั้งหมดแล้ว</span>
            </button>
            
            <button
              onClick={handleClearAll}
              className="text-xs text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1.5 cursor-pointer font-medium hover:bg-rose-50/60 px-2 py-1 rounded-lg"
              title="ล้างประวัติการแจ้งเตือนทั้งหมด"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500" />
              <span>ล้างประวัติ</span>
            </button>
          </div>
        </div>

        {/* ── Feed List (Clean Dividers) ── */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar bg-white">
          {filtered.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6 text-slate-400 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-300 mb-3 shadow-inner">
                <Bell className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">ไม่มีการแจ้งเตือนใหม่ในขณะนี้</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-normal">
                เมื่อมีกิจกรรม การขออนุมัติ หรือการแจ้งเตือนสต๊อกใหม่ รายการจะปรากฏที่นี่โดยอัตโนมัติ
              </p>
            </div>
          ) : (
            filtered.map(noti => {
              const typeConfig = NOTIFICATION_TYPES[noti.type] || noti.typeInfo || {};
              const Icon = ICON_MAP[typeConfig.icon] || Bell;
              const isUrgent = typeConfig.priority === 'URGENT' || ['PR_SUBMITTED', 'PR_REVIEWED', 'PR_REJECTED', 'PR_CANCELLED', 'PO_CANCELLED', 'ONLINE_TASK', 'LOW_STOCK_ROP', 'PO_CLAIM', 'SELF_CLAIM'].includes(noti.type);
              
              const isDanger = ['PR_REJECTED', 'PR_CANCELLED', 'PO_CANCELLED', 'PO_CLAIM', 'SELF_CLAIM'].includes(noti.type);
              const isWarning = ['LOW_STOCK_ROP', 'PR_SUBMITTED'].includes(noti.type);
              const isSuccess = ['PR_APPROVED', 'GOODS_RECEIVED'].includes(noti.type);
              const isOnline = ['ONLINE_TASK', 'ONLINE_ORDERED'].includes(noti.type);

              let capsuleClass = 'bg-slate-100 text-slate-600 border border-slate-200/80';
              let badgeClass = 'bg-slate-100 text-slate-600 border border-slate-200/60';
              let badgeLabel = typeConfig.label || 'ทั่วไป';

              if (isDanger) {
                capsuleClass = 'bg-rose-50 text-rose-600 border border-rose-100';
                badgeClass = 'bg-rose-50 text-rose-700 border border-rose-200/60 font-bold';
              } else if (isWarning) {
                capsuleClass = 'bg-amber-50 text-amber-600 border border-amber-100';
                badgeClass = 'bg-amber-50 text-amber-800 border border-amber-200/60 font-bold';
              } else if (isSuccess) {
                capsuleClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold';
              } else if (isOnline) {
                capsuleClass = 'bg-purple-50 text-purple-600 border border-purple-100';
                badgeClass = 'bg-purple-50 text-purple-700 border border-purple-200/60 font-bold';
              } else if (isUrgent) {
                capsuleClass = 'bg-indigo-50 text-indigo-600 border border-indigo-100';
                badgeClass = 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-bold';
              }

              return (
                <div 
                  key={noti.id}
                  onClick={() => handleItemClick(noti)}
                  className={`px-4 py-3.5 transition-all cursor-pointer relative group flex items-start gap-3.5 ${
                    !noti.isRead 
                      ? 'bg-indigo-50/30 hover:bg-indigo-50/60 border-l-4 border-indigo-600' 
                      : 'bg-white hover:bg-slate-50/80 border-l-4 border-transparent'
                  }`}
                >
                  {/* Icon Capsule */}
                  <div className={`p-2.5 rounded-2xl shrink-0 shadow-2xs mt-0.5 ${capsuleClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content Block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>
                        {isUrgent && <Flame className="w-3 h-3 text-rose-500 inline mr-0.5" />}
                        {badgeLabel}
                      </span>
                    </div>

                    <h5 className="font-semibold text-slate-900 text-xs mt-1 leading-snug">
                      {noti.title}
                    </h5>

                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed font-normal">
                      {noti.message}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-100/60 text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {noti.timeFormatted || noti.timestamp}
                      </span>
                      {noti.docNo && (
                        <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 text-[10px]">
                          {noti.docNo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action / Unread Indicator */}
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    {!noti.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 group-hover:hidden shadow-2xs" title="ยังไม่ได้อ่าน" />
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
