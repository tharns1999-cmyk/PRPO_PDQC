import React, { useState, useMemo } from 'react';
import { workflowEngine } from '../services/workflowEngine';
import { PR_STATUS, PO_STATUS } from '../config/constants';
import { AlertCircle, Clock, CheckCircle2, ArrowRight, FileText, ShoppingBag, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import PRDetailsModal from '../components/pr/PRDetailsModal';
import PODetailsModal from '../components/po/PODetailsModal';

export default function MyWorkView({ prs, pos, currentRole, onNavigate, onRefresh }) {
  const [activeTab, setActiveTab] = useState('action');
  const [selectedPR, setSelectedPR] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);

  // ─── Helper: ตรวจสอบว่า user เคยดำเนินการกับ doc นี้โดยตรงหรือไม่
  // (สร้าง หรือ มีใน activityLog) → ใช้เป็น base สำหรับ "waiting" bucket
  const hasDirectlyActedOn = (doc) => {
    if (!doc || !currentRole) return false;
    const names = [currentRole.name, currentRole.employeeName, currentRole.displayName, currentRole.username].filter(Boolean);

    // 1. เป็นผู้สร้างเอกสาร
    if (names.includes(doc.requestedBy) || names.includes(doc.applicantName1)) return true;

    // 2. มี activity log ของตัวเองใน doc นี้
    if (doc.activityLog?.some(log =>
      names.includes(log.user) ||
      (currentRole.title && log.role === currentRole.title)
    )) return true;

    return false;
  };

  const tasks = useMemo(() => {
    const actionRequired = [];
    const waiting = [];
    const completed = [];

    const userLevel = Number(currentRole?.level || 1);
    const isAdmin = currentRole?.id === 'ADMIN' || currentRole?.roleId === 'ADMIN' || userLevel >= 99;
    const isOnlinePurchaser = currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER' || currentRole?.positionKey === 'ONLINE_PURCHASER';
    const isPlantMgr = userLevel >= 3 || currentRole?.canFinalApprove;
    const isAsstMgr = userLevel === 2 && !isOnlinePurchaser;

    // ─── PR Status ที่หมายความว่า "task ผ่านมือ role นี้ไปแล้ว" ───
    // ถ้า PR อยู่ใน statuses เหล่านี้ แสดงว่า role นั้นๆ ดำเนินการเสร็จแล้ว
    // และตอนนี้รอ downstream (คนถัดไปใน workflow) ทำงาน
    const waitingStatusesFor = {
      // Plant Manager: task ของตัวเองคือ REVIEWED → ถ้าผ่านไปเป็น APPROVED/PO_ISSUED/IN_PROGRESS_ONLINE แล้วรอ downstream
      plantMgr: ['APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE'],
      // Asst. Mgr: task ของตัวเองคือ SUBMITTED/REJECTED_TO_L2 → ถ้าผ่านไปเป็น REVIEWED+ แล้วรอ Plant Mgr
      asstMgr: ['REVIEWED', 'APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE'],
      // Requester: task ของตัวเองคือ DRAFT/REJECTED_TO_DRAFT → ถ้า submit ไปแล้ว รออีก 2 ชั้น
      requester: ['SUBMITTED', 'REJECTED_TO_L2', 'REVIEWED', 'APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE'],
      // Online Purchaser: task คือ IN_PROGRESS_ONLINE (PO) → ถ้า ordered ไปแล้วรอ department รับของ
      onlinePurchaser: ['ORDERED_PENDING_DELIVERY', 'IN_DELIVERY', 'PARTIAL'],
    };

    // Process PRs
    prs.forEach(pr => {
      const canAction = pr.status !== 'CLOSED' && pr.status !== 'CANCELLED' && workflowEngine.canAction(currentRole, pr);
      const isDone = pr.status === 'CLOSED' || pr.status === 'CANCELLED';
      const actedOn = hasDirectlyActedOn(pr);

      // ─── ตรรกะ "รอผู้อื่นดำเนินการ" สำหรับ PR ───
      // เงื่อนไข: doc ผ่านมือตัวเอง (actedOn) หรือเป็น Admin/high-level ที่มองเห็น
      // AND status อยู่ "หลัง" จุดที่ตัวเองดำเนินการแล้ว
      let isWaiting = false;
      if (!canAction && !isDone) {
        if (isAdmin) {
          // Admin เห็น doc ที่ยังไม่เสร็จทุกใบ
          isWaiting = true;
        } else if (isPlantMgr) {
          // Plant Manager: รอผู้อื่น = PR ที่ตัวเองอนุมัติไปแล้ว (status หลัง APPROVED)
          // ต้องมี actedOn (ตัวเองเคย approve หรือ reject ใน log) หรือ PR อยู่ใน scope ที่ตัวเองเคย action ไปแล้ว
          isWaiting = actedOn && waitingStatusesFor.plantMgr.includes(pr.status);
        } else if (isAsstMgr) {
          // Asst. Mgr: รอผู้อื่น = PR ที่ตัวเอง review ผ่านไปแล้ว (status หลัง REVIEWED)
          isWaiting = actedOn && waitingStatusesFor.asstMgr.includes(pr.status);
        } else if (isOnlinePurchaser) {
          // Online Purchaser ไม่มีส่วนใน PR flow โดยตรง
          isWaiting = false;
        } else {
          // Requester (level 1): รอผู้อื่น = PR ที่ตัวเองสร้างและ submit ไปแล้ว
          isWaiting = actedOn && waitingStatusesFor.requester.includes(pr.status);
        }
      }

      const taskItem = {
        id: pr.id,
        type: 'PR',
        docNo: pr.prNo,
        date: pr.requestedDate,
        title: pr.items.map(i => i.name).join(', '),
        status: pr.status,
        amount: pr.totalAmount,
        raw: pr,
        statusInfo: PR_STATUS[pr.status]
      };

      if (canAction) {
        actionRequired.push(taskItem);
      } else if (isWaiting) {
        waiting.push(taskItem);
      } else if (isDone && actedOn) {
        completed.push(taskItem);
      }
    });

    // ─── Helper: PO ไม่มี requestedBy ใน legacy data → cross-reference จาก parent PR ───
    // ใช้เพื่อตรวจสอบว่า Requester/Asst.Mgr เป็นเจ้าของ PO นี้ผ่าน PR ที่เชื่อมกันอยู่
    const isLinkedToOwnPR = (po) => {
      if (!po.prId && !po.prNo) return false;
      return prs.some(pr =>
        (pr.id === po.prId || pr.prNo === po.prNo) && hasDirectlyActedOn(pr)
      );
    };

    // Process POs
    pos.forEach(po => {
      const isDone = po.status === 'CLOSED' || po.status === 'CANCELLED' || po.status === 'RECEIVED';
      const canAction = !isDone && workflowEngine.canAction(currentRole, po);
      // isOwnerOfPO: ตรวจสอบ ownership ทั้งจาก PO โดยตรง และจาก parent PR (fallback สำหรับ legacy POs)
      const actedOnPO = hasDirectlyActedOn(po);
      const isOwnerOfPO = actedOnPO || isLinkedToOwnPR(po);

      // ─── ตรรกะ "รอผู้อื่นดำเนินการ" สำหรับ PO ───
      //
      // Workflow:
      //   SELF:   PR approved → [ISSUED] → Requester ซื้อ+รับของ → [RECEIVED] → CLOSED
      //   ONLINE: PR approved → [IN_PROGRESS_ONLINE] → Online Purchaser สั่งซื้อ
      //           → [ORDERED_PENDING_DELIVERY] → Requester รับของ → [RECEIVED] → CLOSED
      //
      // Role  | ต้องทำ                             | รอผู้อื่น
      // -------|------------------------------------|-----------------------------------------
      // REQ   | ISSUED, ORDERED_PENDING_DELIVERY,  | IN_PROGRESS_ONLINE (รอ Online Purchaser)
      //        | IN_DELIVERY, PARTIAL               |
      // ONLINE| IN_PROGRESS_ONLINE                 | ORDERED_PENDING_DELIVERY, IN_DELIVERY, PARTIAL
      // ASST  | -                                  | ISSUED, IN_PROGRESS_ONLINE, ORDERED..., PARTIAL
      // PLANT | -                                  | ISSUED, IN_PROGRESS_ONLINE, ORDERED..., PARTIAL
      // ADMIN | ทุกอย่าง (canAction ด้าน workflowEngine) | ใบที่ยังไม่เสร็จ

      let isWaiting = false;
      if (!canAction && !isDone) {
        if (isAdmin) {
          // Admin เห็นทุก PO ที่ยังไม่เสร็จ
          isWaiting = true;
        } else if (isOnlinePurchaser) {
          // Online Purchaser: รอผู้อื่น = PO ที่ตัวเองสั่งซื้อแล้ว รอ Requester รับของ
          // (ORDERED_PENDING_DELIVERY, IN_DELIVERY, PARTIAL → รอ dept รับ)
          isWaiting = actedOnPO && waitingStatusesFor.onlinePurchaser.includes(po.status);
        } else if (isPlantMgr) {
          // Plant Manager: รอผู้อื่น = PO ที่ตัวเอง approve PR มาแล้ว ตอนนี้รอ downstream
          // actedOnPO = true เพราะ Plant Mgr อยู่ใน PO activityLog (สร้าง PO จาก PR approval)
          isWaiting = actedOnPO && [
            'ISSUED', 'IN_PROGRESS_ONLINE', 'ORDERED_PENDING_DELIVERY', 'IN_DELIVERY', 'PARTIAL'
          ].includes(po.status);
        } else if (isAsstMgr) {
          // Asst. Manager: อยู่ใน PR activityLog (review) แต่ไม่อยู่ใน PO activityLog
          // ใช้ isLinkedToOwnPR เพื่อ trace กลับไปที่ PR ที่ตัวเอง review แล้ว
          isWaiting = isLinkedToOwnPR(po) && [
            'ISSUED', 'IN_PROGRESS_ONLINE', 'ORDERED_PENDING_DELIVERY', 'IN_DELIVERY', 'PARTIAL'
          ].includes(po.status);
        } else {
          // Requester (level 1):
          // SELF purchase: ISSUED → canAction = true (ไปซื้อและรับของ) → ไม่มาถึงบรรทัดนี้
          // ONLINE purchase: IN_PROGRESS_ONLINE → canAction = false → รอผู้อื่น (Online Purchaser กำลังสั่งซื้อ)
          // ONLINE purchase: ORDERED_PENDING_DELIVERY → canAction = true (รับของ) → ไม่มาถึงบรรทัดนี้
          isWaiting = isOwnerOfPO && po.status === 'IN_PROGRESS_ONLINE';
        }
      }

      const taskItem = {
        id: po.id,
        type: 'PO',
        docNo: po.poNo,
        date: po.issueDate,
        title: `ใบสั่งซื้อ: ${po.vendorName}`,
        status: po.status,
        amount: po.grandTotal,
        raw: po,
        statusInfo: PO_STATUS[po.status]
      };

      if (canAction) {
        actionRequired.push(taskItem);
      } else if (isWaiting) {
        waiting.push(taskItem);
      } else if (isDone && isOwnerOfPO) {
        // ใช้ isOwnerOfPO แทน actedOnPO เพื่อรองรับ legacy POs ที่ไม่มี requestedBy
        completed.push(taskItem);
      }
    });

    // Sort by date descending
    const sortByDate = (a, b) => new Date(b.date) - new Date(a.date);
    
    return {
      action: actionRequired.sort(sortByDate),
      waiting: waiting.sort(sortByDate),
      completed: completed.sort(sortByDate).slice(0, 50) // Limit completed to 50
    };
  }, [prs, pos, currentRole]);

  const activeTasks = tasks[activeTab];

  const handleTaskClick = (task) => {
    if (task.type === 'PR') {
      setSelectedPR(task.raw);
    } else if (task.type === 'PO') {
      setSelectedPO(task.raw);
    }
  };

  // Keep active modal item synced with latest prs/pos state
  const currentActivePR = selectedPR ? (prs.find(p => p.id === selectedPR.id) || selectedPR) : null;
  const currentActivePO = selectedPO ? (pos.find(p => p.id === selectedPO.id) || selectedPO) : null;

  return (
    <div className="w-full space-y-5 animate-fade-in-up">
      {/* Sleek Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            พื้นที่ทำงานของฉัน (My Workspace)
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            ศูนย์รวมงานที่คุณต้องดำเนินการ และติดตามสถานะงานที่คุณเกี่ยวข้องทั้งหมด
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl w-full sm:w-fit overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('action')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'action'
              ? 'bg-white text-rose-600 shadow-md ring-1 ring-rose-100'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/80'
          }`}
        >
          <AlertCircle className={`w-4 h-4 ${activeTab === 'action' ? 'animate-bounce-slight' : ''}`} />
          ต้องดำเนินการ
          {tasks.action.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'action' ? 'bg-rose-100 text-rose-700' : 'bg-slate-300 text-slate-700'
            }`}>
              {tasks.action.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('waiting')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'waiting'
              ? 'bg-white text-indigo-600 shadow-md ring-1 ring-indigo-100'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/80'
          }`}
        >
          <Loader2 className={`w-4 h-4 ${activeTab === 'waiting' ? 'animate-spin-slow' : ''}`} />
          รอผู้อื่นดำเนินการ
          {tasks.waiting.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'waiting' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-300 text-slate-700'
            }`}>
              {tasks.waiting.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'completed'
              ? 'bg-white text-emerald-600 shadow-md ring-1 ring-emerald-100'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/80'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          เสร็จสิ้นแล้ว
        </button>
      </div>

      {/* Task List Content */}
      <div className="impeccable-card min-h-[400px] p-4 bg-slate-50/50">
        {activeTasks.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            {activeTab === 'action' && (
              <EmptyState 
                title="ไม่มีงานค้าง ยอดเยี่ยมมาก!" 
                description="คุณได้ดำเนินการทุกอย่างที่อยู่ในความรับผิดชอบเสร็จสิ้นแล้ว"
                icon={CheckCircle2}
              />
            )}
            {activeTab === 'waiting' && (
              <EmptyState 
                title="ไม่มีรายการที่รอผู้อื่น" 
                description="คุณยังไม่ได้สร้างคำขอหรือมีงานที่รอการดำเนินการจากแผนกอื่น"
                icon={Clock}
              />
            )}
            {activeTab === 'completed' && (
              <EmptyState 
                title="ยังไม่มีรายการที่เสร็จสิ้น" 
                description="ประวัติงานที่สำเร็จแล้วของคุณจะแสดงที่นี่"
                icon={FileText}
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTasks.map(task => {
              const isPR = task.type === 'PR';
              const Icon = isPR ? FileText : ShoppingBag;
              
              return (
                <div 
                  key={`${task.type}-${task.id}`} 
                  onClick={() => handleTaskClick(task)}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden"
                >
                  {/* Glowing Top Border */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                    activeTab === 'action' ? 'bg-gradient-to-r from-rose-400 to-rose-500' :
                    activeTab === 'waiting' ? 'bg-gradient-to-r from-indigo-400 to-indigo-500' :
                    'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  }`}></div>

                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${
                        isPR ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-800">{task.docNo}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-600">
                            {task.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {task.date}
                        </div>
                      </div>
                    </div>
                    
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border ${task.statusInfo?.color}`}>
                      {task.statusInfo?.label}
                    </span>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700 leading-snug line-clamp-2">
                      {task.title}
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    {currentRole.canViewBudget ? (
                      <span className="text-xs font-black text-slate-800">
                        ฿{task.amount?.toLocaleString() || 0}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">***</span>
                    )}
                    
                    <span className={`text-[11px] font-bold flex items-center gap-1 transition-colors ${
                      activeTab === 'action' ? 'text-rose-600 group-hover:text-rose-700' :
                      activeTab === 'waiting' ? 'text-indigo-600 group-hover:text-indigo-700' :
                      'text-emerald-600 group-hover:text-emerald-700'
                    }`}>
                      {activeTab === 'action' ? 'อนุมัติ / ดำเนินการ' : 'ดูรายละเอียด'} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PR Details & Approval Modal */}
      {currentActivePR && (
        <PRDetailsModal
          selectedPR={currentActivePR}
          currentRole={currentRole}
          onClose={() => setSelectedPR(null)}
          onRefresh={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* PO Details Modal */}
      {currentActivePO && (
        <PODetailsModal
          selectedPO={currentActivePO}
          currentRole={currentRole}
          onClose={() => setSelectedPO(null)}
          onRefresh={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
