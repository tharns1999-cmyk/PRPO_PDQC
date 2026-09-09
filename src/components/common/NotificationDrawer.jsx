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
    if (filter === 'UNREAD') return !n.isRead;
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

  return createPortal(
    <>
      {/* ── Invisible Backdrop (Click-outside) ── */}
      <div 
        className="fixed inset-0 z-40 bg-transparent no-print" 
        onClick={onClose} 
      />

      {/* ── Floating Popover Dropdown (Linear / Raycast Style) ── */}
      <div className="fixed left-4 sm:left-[265px] top-4 z-50 w-[calc(100vw-32px)] sm:w-[420px] max-h-[500px] rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 animate-zoom-in no-print">
        
        {/* ── 1. Ultra-Compact Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">
              การแจ้งเตือน
            </h3>
            {unreadCount > 0 && (
              <span className="font-mono text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center shrink-0">
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="ทำเครื่องหมายอ่านแล้วทั้งหมด"
                aria-label="ทำเครื่องหมายอ่านแล้วทั้งหมด"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1 cursor-pointer"
              title="ปิด"
              aria-label="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 2. Streamlined Segmented Filter (2 Minimal Tabs) ── */}
        <div className="px-4 pt-2.5 pb-1 shrink-0">
          <div className="flex items-center gap-1 bg-slate-50/90 p-1 rounded-xl border border-slate-100">
            <button
              onClick={() => setFilter('ALL')}
              className={`flex-1 text-center text-xs py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-slate-100 text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              ทั้งหมด ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('UNREAD')}
              className={`flex-1 text-center text-xs py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
                filter === 'UNREAD'
                  ? 'bg-slate-100 text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              ยังไม่อ่าน {unreadCount > 0 ? `(${unreadCount})` : ''}
            </button>
          </div>
        </div>

        {/* ── 3. Flat Feed Notification Items (3-Layer Hierarchy) ── */}
        <div className="overflow-y-auto flex-1 px-2 py-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-4 text-slate-400">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-300 mb-2 shadow-2xs">
                <Bell className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h4 className="text-xs font-semibold text-slate-700">ไม่มีการแจ้งเตือน</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal max-w-[200px]">
                {filter === 'UNREAD' ? 'คุณอ่านการแจ้งเตือนทั้งหมดแล้ว' : 'เมื่อมีกิจกรรมใหม่จะปรากฏที่นี่'}
              </p>
            </div>
          ) : (
            filtered.map(noti => {
              const typeConfig = NOTIFICATION_TYPES[noti.type] || noti.typeInfo || {};
              const Icon = ICON_MAP[typeConfig.icon] || Bell;
              
              const isDanger = ['PR_REJECTED', 'PR_CANCELLED', 'PO_CANCELLED', 'PO_CLAIM', 'SELF_CLAIM'].includes(noti.type) || noti.type?.includes('REJECT');
              const isWarning = ['LOW_STOCK_ROP', 'PR_SUBMITTED'].includes(noti.type);
              const isSuccess = ['PR_APPROVED', 'GOODS_RECEIVED'].includes(noti.type);
              const isOnline = ['ONLINE_TASK', 'PO_ONLINE'].includes(noti.type) || noti.type?.includes('ONLINE');

              let iconBoxClass = 'bg-slate-100 text-slate-600';
              let chipClass = 'bg-slate-100 text-slate-700';
              if (isOnline) {
                iconBoxClass = 'bg-purple-50 text-purple-600';
                chipClass = 'bg-purple-50 text-purple-700';
              } else if (isSuccess) {
                iconBoxClass = 'bg-emerald-50 text-emerald-600';
                chipClass = 'bg-emerald-50 text-emerald-700';
              } else if (isDanger) {
                iconBoxClass = 'bg-rose-50 text-rose-600';
                chipClass = 'bg-rose-50 text-rose-700';
              } else if (isWarning) {
                iconBoxClass = 'bg-amber-50 text-amber-600';
                chipClass = 'bg-amber-50 text-amber-700';
              } else {
                iconBoxClass = 'bg-indigo-50 text-indigo-600';
                chipClass = 'bg-indigo-50 text-indigo-700';
              }

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
                  className="group p-3.5 hover:bg-slate-50/90 rounded-xl transition-all cursor-pointer relative flex gap-3 items-start border-b border-slate-100/90 last:border-0"
                >
                  {/* Left: Soft Pastel Box */}
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 mt-0.5 ${iconBoxClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Center: 3-Layer Hierarchy */}
                  <div className="flex-1 min-w-0">
                    {/* Layer 1: Top Meta Row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap ${chipClass}`}>
                        {typeConfig.label || 'ทั่วไป'}
                      </span>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap flex items-center gap-1 font-normal shrink-0">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {noti.timeFormatted || noti.timestamp}
                      </span>
                    </div>

                    {/* Layer 2: Title & Status Row */}
                    <div className="flex items-start justify-between gap-3">
                      <h5 className="text-xs font-semibold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                        {noti.title}
                      </h5>
                      {!noti.isRead && (
                        <span 
                          className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1 shadow-xs" 
                          title="ยังไม่ได้อ่าน" 
                        />
                      )}
                    </div>

                    {/* Layer 3: Document & Snippet Row (Single line, font-mono) */}
                    <p className="text-[11px] text-slate-500 mt-1 font-mono leading-relaxed truncate">
                      {noti.docNo ? `${noti.docNo} • ` : ''}{displayMessage}
                    </p>

                    {/* Rejection Reason if any */}
                    {rejectionReason && (
                      <div className="bg-rose-50/80 border border-rose-100 rounded-lg p-2 text-[11px] text-rose-900 mt-2 flex items-start gap-1.5">
                        <MessageSquareQuote className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span className="leading-snug break-words font-sans">{rejectionReason}</span>
                      </div>
                    )}
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
