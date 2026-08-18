import React, { useState, useMemo } from 'react';
import { workflowEngine } from '../services/workflowEngine';
import { PR_STATUS, PO_STATUS } from '../config/constants';
import { AlertCircle, Clock, CheckCircle2, ArrowRight, FileText, ShoppingBag, Loader2, Sparkles, ShieldCheck, Building2, Store } from 'lucide-react';
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
    // เมื่อ PR ออก PO แล้ว (PO_ISSUED / APPROVED) ถือว่าจบกระบวนการ PR แล้ว (ย้ายไปเสร็จสิ้นแล้ว)
    // เหลือเฉพาะขั้นตอนที่ PR กำลังอยู่ระหว่างการตรวจสอบ (SUBMITTED / REVIEWED) เท่านั้นที่อยู่ใน "รอผู้อื่น"
    const waitingStatusesFor = {
      // Plant Manager: ไม่อยู่ใน waiting ของ PR (เมื่อ approve แล้ว PR เสร็จสิ้น)
      plantMgr: [],
      // Asst. Mgr: รอผู้อื่น = PR ที่ตัวเอง review ผ่านไปแล้ว และกำลังรอ Plant Mgr (REVIEWED)
      asstMgr: ['REVIEWED'],
      // Requester: รอผู้อื่น = PR ที่ส่งไปแล้วและกำลังรอ Asst Mgr หรือ Plant Mgr อนุมัติ (SUBMITTED, REJECTED_TO_L2, REVIEWED)
      requester: ['SUBMITTED', 'REJECTED_TO_L2', 'REVIEWED'],
      // Online Purchaser: ไม่มีส่วนใน PR flow โดยตรง
      onlinePurchaser: [],
    };

    // Process PRs
    prs.forEach(pr => {
      // PR ถือว่าเสร็จสิ้นเมื่อออก PO แล้ว (PO_ISSUED / APPROVED) หรือ ปิด/ยกเลิก (CLOSED / CANCELLED)
      const isDone = ['PO_ISSUED', 'APPROVED', 'CLOSED', 'CANCELLED'].includes(pr.status);
      const canAction = !isDone && workflowEngine.canAction(currentRole, pr);
      const actedOn = hasDirectlyActedOn(pr);

      // ─── ตรรกะ "รอผู้อื่นดำเนินการ" สำหรับ PR ───
      let isWaiting = false;
      if (!canAction && !isDone) {
        if (isAdmin) {
          // Admin เห็น PR ที่ยังไม่เสร็จ
          isWaiting = true;
        } else if (isPlantMgr) {
          isWaiting = false;
        } else if (isAsstMgr) {
          // Asst. Mgr: รอผู้อื่น = PR ที่ตัวเอง review แล้ว และกำลังรอ Plant Mgr
          isWaiting = actedOn && waitingStatusesFor.asstMgr.includes(pr.status);
        } else if (isOnlinePurchaser) {
          isWaiting = false;
        } else {
          // Requester (level 1): รอผู้อื่น = PR ที่ตัวเองสร้างและ submit ไปแล้ว (ยังไม่อนุมัติ)
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
          isWaiting = actedOnPO && waitingStatusesFor.onlinePurchaser.includes(po.status);
        } else if (isPlantMgr || isAsstMgr) {
          // ─── Plant Manager & Asst Manager ไม่เห็น PO ใน waiting เลย ───
          // PO เป็นงานของ Requester (รับของ) และ Online Purchaser (สั่งซื้อ) เท่านั้น
          // ผู้บริหารดู PO ได้จากหน้า PO List โดยตรง
          isWaiting = false;
        } else {
          // Requester / Supervisor:
          // SELF purchase: ISSUED → canAction = true → เข้า Action Required
          // ONLINE purchase: IN_PROGRESS_ONLINE → รอ Online Purchaser สั่งซื้อ → แสดงใน Waiting
          // ONLINE purchase: ORDERED_PENDING_DELIVERY → canAction = true → เข้า Action Required
          const isDeptMember = currentRole?.department === 'ALL' || currentRole?.department === po.department;
          isWaiting = (isOwnerOfPO || isDeptMember) && po.status === 'IN_PROGRESS_ONLINE';
        }
      }

      const poSubtitle = (() => {
        if (po.status === 'ISSUED') return '📦 รอดำเนินการ: ตรวจรับสินค้าเข้าคลัง';
        if (po.status === 'ORDERED_PENDING_DELIVERY') return '🚚 สินค้ากำลังจัดส่ง: รอตรวจรับของ';
        if (po.status === 'PARTIAL') return '⚠️ รับของบางส่วนแล้ว: ยังมียอดค้างส่ง';
        if (po.status === 'IN_PROGRESS_ONLINE') return '🛒 รอจัดซื้อออนไลน์ดำเนินการ';
        return null;
      })();

      const productTitle = po.items && po.items.length > 0
        ? (po.items.length === 1 
            ? `${po.items[0].name} (x${Number((po.items[0].orderedQty ?? po.items[0].purchaseQty ?? po.items[0].qty) || 0).toLocaleString()} ${po.items[0].purchaseUnit || po.items[0].unit || 'ชิ้น'})`
            : `${po.items.map(i => i.name).join(', ')} (${po.items.length} รายการ)`)
        : `ใบสั่งซื้อ: ${po.vendorName}`;

      const taskItem = {
        id: po.id,
        type: 'PO',
        docNo: po.poNo,
        date: po.issueDate,
        title: productTitle,
        vendorName: po.vendorName,
        subtitle: poSubtitle,
        status: po.status,
        amount: po.grandTotal || po.totalAmount || po.subtotal || 0,
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
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <AlertCircle className={`w-4 h-4 ${activeTab === 'action' ? 'animate-bounce-slight' : ''}`} />
          ต้องดำเนินการ
          {tasks.action.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'action' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {tasks.action.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('waiting')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'waiting'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Loader2 className={`w-4 h-4 ${activeTab === 'waiting' ? 'animate-spin-slow' : ''}`} />
          รอผู้อื่นดำเนินการ
          {tasks.waiting.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'waiting' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {tasks.waiting.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'completed'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          เสร็จสิ้นแล้ว
        </button>
      </div>

      {/* Task List Content */}
      <div className="impeccable-card min-h-[400px] p-5 sm:p-6 bg-slate-50/60 border border-slate-200">
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
              
              // Distinguish Themes
              const themeColor = isPR 
                ? 'indigo' 
                : 'emerald';
                
              const activeBorderClass = activeTab === 'action' 
                ? (isPR ? 'border-indigo-400 shadow-indigo-100/50' : 'border-emerald-400 shadow-emerald-100/50')
                : 'border-slate-200';

              return (
                <div 
                  key={`${task.type}-${task.id}`} 
                  onClick={() => handleTaskClick(task)}
                  className={`group bg-white border ${activeBorderClass} rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col relative overflow-hidden`}
                >
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                    activeTab === 'action' ? (isPR ? 'bg-indigo-600' : 'bg-emerald-600') :
                    activeTab === 'waiting' ? 'bg-amber-400' :
                    'bg-slate-300'
                  }`}></div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${
                        isPR ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isPR ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isPR ? 'ใบขอซื้อ (PR)' : 'ใบสั่งซื้อ (PO)'}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-700">{task.docNo}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                          <Clock className="w-3 h-3" /> {task.date}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 mb-2">
                    <p className={`text-[13px] font-bold leading-relaxed line-clamp-2 ${isPR ? 'text-indigo-950' : 'text-emerald-950'}`}>
                      {task.title}
                    </p>
                    
                    {isPR && task.raw?.department && (
                      <p className="text-[11px] text-indigo-600/80 mt-1.5 flex items-center gap-1 font-medium">
                        <Building2 className="w-3.5 h-3.5" /> แผนก: {task.raw.department}
                      </p>
                    )}

                    {!isPR && task.vendorName && (
                      <p className="text-[11px] text-emerald-700/80 mt-1.5 flex items-center gap-1 font-medium truncate">
                        <Store className="w-3.5 h-3.5 shrink-0" /> {task.vendorName}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border ${task.statusInfo?.color}`}>
                      {task.statusInfo?.label}
                    </span>
                    
                    {task.subtitle && (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md truncate max-w-[130px] ${
                        task.status === 'ISSUED' ? 'bg-teal-50 text-teal-700' :
                        task.status === 'ORDERED_PENDING_DELIVERY' ? 'bg-blue-50 text-blue-700' :
                        task.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700' :
                        task.status === 'IN_PROGRESS_ONLINE' ? 'bg-purple-50 text-purple-700' :
                        'bg-slate-100 text-slate-600'
                      }`} title={task.subtitle}>
                        {task.subtitle}
                      </span>
                    )}
                  </div>
                  
                  <div className={`mt-auto pt-3 border-t flex items-center justify-between ${
                    isPR ? 'border-indigo-50' : 'border-emerald-50'
                  }`}>
                    {currentRole.canViewBudget ? (
                      <span className="text-xs font-black text-slate-700">
                        ฿{task.amount?.toLocaleString() || 0}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">***</span>
                    )}
                    
                    <span className={`text-[11px] font-bold flex items-center gap-1 transition-colors ${
                      activeTab === 'action' ? 'text-rose-600 group-hover:text-rose-700' :
                      (isPR ? 'text-indigo-600 group-hover:text-indigo-700' : 'text-emerald-600 group-hover:text-emerald-700')
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
