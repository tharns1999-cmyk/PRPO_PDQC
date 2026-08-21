import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { notificationService, NOTIFICATION_TYPES } from '../../services/notificationService';
import { modalService } from '../../services/modalService';
import { 
  Bell, X, CheckCheck, Trash2, ExternalLink, 
  FileText, ShieldCheck, CheckCircle2, XCircle, ShoppingBag, PackageCheck, AlertTriangle, ArrowDownRight, Clock, Flame, Info
} from 'lucide-react';

const ICON_MAP = {
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  PackageCheck,
  AlertTriangle,
  ArrowDownRight
};

export default function NotificationDrawer({ isOpen, onClose, currentRole, onNavigate, onOpenPR, onOpenPO, onRefresh }) {
  const [filter, setFilter] = useState('ALL');

  if (!isOpen) return null;

  const isOnlinePurchaser = currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER';
  const notifications = notificationService.getNotificationsForRole(currentRole);

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
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[60] animate-fade-in" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[65] flex flex-col border-l border-slate-200/80 animate-slide-left">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex items-center justify-center shadow-2xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">ศูนย์แจ้งเตือน (Notifications)</h3>
              <p className="text-xs text-slate-500">กิจกรรมและสถานะงานในระบบ</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills & Actions */}
        <div className="p-3 bg-white border-b border-slate-100 space-y-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            {[
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'ACTION', label: `ด่วน / ต้องทำ${actionCount > 0 ? ` (${actionCount})` : ''}` },
              { id: 'INFO', label: 'แจ้งเตือนทั่วไป' },
              ...(!isOnlinePurchaser ? [{ id: 'STOCK', label: 'สต๊อก & คลัง' }] : []),
              { id: 'UNREAD', label: `ยังไม่อ่าน (${notifications.filter(n => !n.isRead).length})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" /> อ่านทั้งหมดแล้ว
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> ล้างประวัติ
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/50">
          {filtered.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Bell className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">ไม่มีรายการแจ้งเตือน</p>
              <p className="text-xs text-slate-400 mt-0.5">การแจ้งเตือนใหม่จะปรากฏที่นี่เมื่อมีกิจกรรมในระบบ</p>
            </div>
          ) : (
            filtered.map(noti => {
              const typeConfig = NOTIFICATION_TYPES[noti.type] || noti.typeInfo || {};
              const Icon = ICON_MAP[typeConfig.icon] || Bell;
              const isUrgent = typeConfig.priority === 'URGENT' || ['PR_SUBMITTED', 'PR_REVIEWED', 'PR_REJECTED', 'PR_CANCELLED', 'PO_CANCELLED', 'ONLINE_TASK', 'LOW_STOCK_ROP'].includes(noti.type);

              return (
                <div 
                  key={noti.id}
                  onClick={() => handleItemClick(noti)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:shadow-md ${
                    !noti.isRead 
                      ? 'bg-white border-indigo-200/80 shadow-xs ring-1 ring-indigo-500/10' 
                      : 'bg-white/80 border-slate-200/80 text-slate-600'
                  }`}
                >
                  {!noti.isRead && (
                    <div className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${typeConfig.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isUrgent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Flame className="w-3 h-3 text-rose-500" /> ด่วน / ต้องทำ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <Info className="w-3 h-3 text-slate-400" /> ทั่วไป
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {noti.title}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed font-normal">
                        {noti.message}
                      </p>

                      <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" /> {noti.timeFormatted}
                        </span>
                      </div>
                    </div>
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
