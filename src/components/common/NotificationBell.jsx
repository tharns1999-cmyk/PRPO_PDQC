import React from 'react';
import { Bell } from 'lucide-react';
import { notificationService } from '../../services/notificationService';

export default function NotificationBell({ currentRole, onClick }) {
  const unreadCount = notificationService.getUnreadCount(currentRole);

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100/80 rounded-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-95 group"
      title={`การแจ้งเตือน (${unreadCount} รายการใหม่)`}
    >
      <Bell className="w-5 h-5 transition-transform group-hover:rotate-12" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center px-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex items-center justify-center text-[10px] font-black text-white bg-rose-500 rounded-full h-4 min-w-4 px-1 shadow-sm ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      )}
    </button>
  );
}
