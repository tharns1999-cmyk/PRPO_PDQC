import React, { useState, useEffect, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { useAppContext } from '../../context/AppContext';

export default function NotificationBell({ currentRole, onClick, count, className }) {
  const context = useAppContext();
  const contextNotifications = context?.notifications;

  const [serviceNotifs, setServiceNotifs] = useState(() => {
    return notificationService.getNotificationsForRole(currentRole);
  });

  useEffect(() => {
    setServiceNotifs(notificationService.getNotificationsForRole(currentRole));
    const unsub = notificationService.subscribe?.(() => {
      setServiceNotifs(notificationService.getNotificationsForRole(currentRole));
    });
    return () => {
      if (unsub) unsub();
    };
  }, [currentRole]);

  const activeNotifs = useMemo(() => {
    const raw = (contextNotifications && contextNotifications.length > 0) ? contextNotifications : serviceNotifs;
    return (raw || []).filter(n => notificationService.isNotificationTarget(n, currentRole));
  }, [contextNotifications, serviceNotifs, currentRole]);

  const unreadCount = useMemo(() => {
    if (count !== undefined) return count;
    return activeNotifs.filter(n => !(n.isRead === true || n.read === true || n.status === 'read')).length;
  }, [count, activeNotifs]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={className || "relative w-8 h-8 rounded-xl border border-slate-200/80 hover:bg-slate-100/80 hover:border-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-95 group cursor-pointer shrink-0"}
      title={`การแจ้งเตือน (${unreadCount} รายการใหม่)`}
    >
      <Bell className="w-4 h-4 transition-transform group-hover:rotate-12" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex items-center justify-center text-[9px] font-black text-white bg-rose-500 rounded-full h-3.5 min-w-3.5 px-1 shadow-2xs ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      )}
    </button>
  );
}
