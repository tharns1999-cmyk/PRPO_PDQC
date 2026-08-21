import React, { useMemo } from 'react';
import { workflowEngine } from '../../services/workflowEngine';
import { PR_STATUS, PO_STATUS } from '../../config/constants';
import { Bell, CheckCircle2, XCircle, Clock, FileText, ShoppingBag, X, AlertCircle } from 'lucide-react';

export default function NotificationDropdown({ prs, pos, currentRole, onNavigate, onClose }) {
  
  const notifications = useMemo(() => {
    const notifs = [];

    const addNotif = (id, title, desc, time, type, docType, docId) => {
      notifs.push({ id, title, desc, time, type, docType, docId, rawTime: new Date(time).getTime() });
    };

    // 1. Action Required (High Priority) from unified task aggregator
    const userTasks = workflowEngine.getUserTasks(currentRole, prs, pos);
    userTasks.action.forEach(task => {
      let title = 'รอการดำเนินการ';
      let desc = `${task.docNo} กำลังรอคุณดำเนินการ`;

      if (task.type === 'PR') {
        title = 'รอการอนุมัติด่วน (PR)';
        desc = `ใบขอซื้อ ${task.docNo} กำลังรอคุณตรวจสอบและอนุมัติ`;
      } else if (task.type === 'PO') {
        if (task.isClaim || ['CLAIM_REPORTED', 'CLAIM_IN_PROGRESS'].includes(task.status)) {
          title = '🚨 เคสสินค้ามีปัญหา (เคลม)';
          desc = `ใบสั่งซื้อ ${task.docNo} มีรายงานสินค้ามีปัญหา รอคุณจัดการเคส`;
        } else if (task.status === 'IN_PROGRESS_ONLINE') {
          title = '🛒 งานสั่งซื้อออนไลน์';
          desc = `ใบสั่งซื้อออนไลน์ ${task.docNo} รอคุณดำเนินการสั่งซื้อ`;
        } else {
          title = '📦 รอตรวจรับสินค้าเข้าคลัง';
          desc = `ใบสั่งซื้อ ${task.docNo} รอตรวจรับของเข้าคลัง`;
        }
      }

      addNotif(
        `act-${task.type.toLowerCase()}-${task.id}`,
        title,
        desc,
        task.date || new Date().toISOString(),
        'action',
        task.type,
        task.id
      );
    });

    // 2. Activity Updates for My Requests
    prs.forEach(pr => {
      if (pr.requestedBy === currentRole.name && pr.activityLog) {
        pr.activityLog.forEach((log, idx) => {
          // Don't notify self-actions unless it's important
          if (log.user !== currentRole.name) {
            let type = 'info';
            let title = 'อัปเดตสถานะ (PR)';
            if (log.action.includes('อนุมัติ') || log.action.includes('Approve')) { type = 'success'; title = 'อนุมัติแล้ว'; }
            if (log.action.includes('ตีกลับ') || log.action.includes('Reject')) { type = 'error'; title = 'ถูกตีกลับ'; }
            
            addNotif(
              `upd-pr-${pr.id}-${idx}`,
              title,
              `${log.user} ได้ดำเนินการ: ${log.action} กับใบขอซื้อ ${pr.prNo}`,
              log.timestamp || pr.requestedDate,
              type,
              'PR',
              pr.id
            );
          }
        });
      }
    });

    pos.forEach(po => {
      // For POs, notify if user created PR for this PO or if they are in the log
      const involved = po.activityLog?.some(log => log.user === currentRole.name);
      if (involved && po.activityLog) {
        po.activityLog.forEach((log, idx) => {
          if (log.user !== currentRole.name) {
            let type = 'info';
            let title = 'อัปเดตสถานะ (PO)';
            if (log.action.includes('รับสินค้า') || log.action.includes('ปิด')) { type = 'success'; title = 'อัปเดต PO'; }
            
            addNotif(
              `upd-po-${po.id}-${idx}`,
              title,
              `${log.user} ได้ดำเนินการ: ${log.action} กับใบสั่งซื้อ ${po.poNo}`,
              log.timestamp || po.issueDate,
              type,
              'PO',
              po.id
            );
          }
        });
      }
    });

    // Sort by timestamp descending
    return notifs.sort((a, b) => b.rawTime - a.rawTime).slice(0, 15); // limit to 15
  }, [prs, pos, currentRole]);

  return (
    <div className="absolute top-14 left-0 w-80 bg-slate-900 border border-slate-700/80 rounded-sm shadow-md shadow-black/50 z-50 overflow-hidden animate-fade-in-up">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">การแจ้งเตือน</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-slate-500 flex flex-col items-center gap-2">
            <Bell className="w-8 h-8 opacity-20" />
            <span className="text-sm">ไม่มีการแจ้งเตือนใหม่</span>
          </div>
        ) : (
          notifications.map(notif => {
            let Icon = Clock;
            let iconColor = 'text-slate-400 bg-slate-800/50';
            
            if (notif.type === 'action') {
              Icon = AlertCircle;
              iconColor = 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
            } else if (notif.type === 'success') {
              Icon = CheckCircle2;
              iconColor = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
            } else if (notif.type === 'error') {
              Icon = XCircle;
              iconColor = 'text-red-400 bg-red-500/10 border border-red-500/20';
            }

            return (
              <div 
                key={notif.id}
                onClick={() => {
                  onNavigate(notif.docType === 'PR' ? 'pr-list' : 'po-list');
                  onClose();
                }}
                className="flex gap-1.5 p-3 rounded-sm hover:bg-slate-800 cursor-pointer transition-colors group"
              >
                <div className={`p-2 rounded-full shrink-0 h-fit ${iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className={`text-xs font-bold truncate ${notif.type === 'action' ? 'text-rose-300' : 'text-slate-200'}`}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(notif.time).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2 group-hover:text-slate-300">
                    {notif.desc}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {notifications.length > 0 && (
        <div className="p-2 border-t border-slate-800 bg-slate-900">
          <button 
            onClick={() => { onNavigate('my-workspace'); onClose(); }}
            className="w-full py-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-sm transition-colors"
          >
            ไปที่พื้นที่ทำงานของฉัน
          </button>
        </div>
      )}
    </div>
  );
}
