import React, { useState, useMemo } from 'react';
import { workflowEngine } from '../services/workflowEngine';
import { useAppContext } from '../context/AppContext';
import { PR_STATUS, PO_STATUS } from '../config/constants';
import { AlertCircle, Clock, CheckCircle2, ArrowRight, FileText, ShoppingBag, Loader2, Sparkles, Building2, Store } from 'lucide-react';
import PRDetailsModal from '../components/pr/PRDetailsModal';
import PODetailsModal from '../components/po/PODetailsModal';

const EMPTY_ARRAY = [];

export default function MyWorkView({ 
  prs: propPrs, 
  pos: propPos, 
  currentRole: propRole, 
  onNavigate: propNavigate, 
  onRefresh: propRefresh, 
  onEditPR: propEditPR 
} = {}) {
  const context = useAppContext();
  const prs = propPrs ?? context.prs ?? EMPTY_ARRAY;
  const pos = propPos ?? context.pos ?? EMPTY_ARRAY;
  const currentRole = propRole ?? context.currentRole;
  const onRefresh = propRefresh ?? context.refreshData;
  const onEditPR = propEditPR ?? context.handleEditPR;

  const [activeTab, setActiveTab] = useState('action');
  const [selectedPR, setSelectedPR] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);

  // Recalculate tasks reactively whenever prs, pos, or currentRole changes
  const tasks = useMemo(() => {
    return workflowEngine.getUserTasks(currentRole, prs, pos);
  }, [prs, pos, currentRole]);

  // Active tab filter calculated strictly via useMemo from central AppContext state
  const activeTasks = useMemo(() => {
    return tasks[activeTab] || [];
  }, [tasks, activeTab]);

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
    <div className="w-full space-y-6 animate-fade-in pb-10">
      {/* ── 1. Header & Summary Hero Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <span>พื้นที่ทำงานของฉัน (My Workspace)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            ศูนย์รวมงานที่คุณต้องดำเนินการ และติดตามสถานะงานที่คุณเกี่ยวข้องทั้งหมด
          </p>
        </div>

        {/* Quick Stats Strip */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-xs">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>รอคุณดำเนินการ</span>
            <span className="font-mono font-bold text-rose-600 tabular-nums">
              {tasks.action.length}
            </span>
            <span>รายการ</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span>มูลค่ารวม</span>
            {currentRole.canViewBudget ? (
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                ฿{tasks.action.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
              </span>
            ) : (
              <span className="font-mono text-slate-400">***</span>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Floating Segmented Tabs ── */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl inline-flex gap-1 border border-slate-200/60 overflow-x-auto max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab('action')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'action'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertCircle className={`w-4 h-4 ${activeTab === 'action' ? 'text-rose-500' : 'text-slate-400'}`} />
          <span>ต้องดำเนินการ (To Do)</span>
          {tasks.action.length > 0 && (
            <span className="bg-rose-500 text-white font-bold px-2 py-0.5 rounded-full text-[10px] font-mono shadow-2xs">
              {tasks.action.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('waiting')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'waiting'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Loader2 className={`w-4 h-4 ${activeTab === 'waiting' ? 'text-amber-500 animate-spin-slow' : 'text-slate-400'}`} />
          <span>รอผู้อื่นดำเนินการ (In Progress)</span>
          {tasks.waiting.length > 0 && (
            <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px] font-mono border border-amber-200/60">
              {tasks.waiting.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 ${activeTab === 'completed' ? 'text-emerald-500' : 'text-slate-400'}`} />
          <span>เสร็จสิ้นแล้ว (Completed)</span>
          {tasks.completed.length > 0 && (
            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] font-mono border border-emerald-200/60">
              {tasks.completed.length}
            </span>
          )}
        </button>
      </div>

      {/* ── 3. Task Action Grid / Modern Empty State ── */}
      {activeTasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[340px]">
          {activeTab === 'action' && (
            <div className="max-w-sm flex flex-col items-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-4 shadow-xs">
                <Sparkles className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5">เคลียร์งานครบเรียบร้อย</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                ไม่มีงานค้างท่อในขณะนี้ คุณได้ตรวจสอบและอนุมัติเอกสารในความรับผิดชอบครบถ้วนแล้ว
              </p>
            </div>
          )}
          {activeTab === 'waiting' && (
            <div className="max-w-sm flex flex-col items-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-4 shadow-xs">
                <Clock className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5">ไม่มีรายการที่รอผู้อื่น</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                คุณไม่มีคำขอ PR หรือ PO ที่อยู่ระหว่างรอการดำเนินการจากแผนกอื่น
              </p>
            </div>
          )}
          {activeTab === 'completed' && (
            <div className="max-w-sm flex flex-col items-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center mb-4 shadow-xs">
                <FileText className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5">ยังไม่มีรายการที่เสร็จสิ้น</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                ประวัติงานที่คุณอนุมัติหรือตรวจรับเสร็จสิ้นแล้วจะบันทึกไว้ที่นี่
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {activeTasks.map(task => {
            const isPR = task.type === 'PR';
            const uniqueCardKey = task.raw?.poNo || task.raw?.poNumber || task.raw?.prNo || task.raw?.prNumber || `${task.type}-${task.id || task.docNo}`;
            
            const requester = isPR 
              ? (task.raw?.requestedBy ? `${task.raw.requestedBy} ${task.raw?.department ? `(${task.raw.department})` : ''}` : task.raw?.department || 'ฝ่ายผลิต')
              : (task.vendorName || task.raw?.createdBy || 'ฝ่ายจัดซื้อ');

            return (
              <div 
                key={uniqueCardKey} 
                onClick={() => handleTaskClick(task)}
                className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-xl hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300 relative flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Card Top: Type Badge + DocNo + Date */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider uppercase border ${
                        isPR 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                      }`}>
                        {isPR ? 'PR' : 'PO'}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800 tracking-tight">
                        {task.docNo}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {task.date}
                    </span>
                  </div>

                  {/* Card Body: Requester, Title, Amount & Status */}
                  <div className="pt-3.5 space-y-2.5">
                    {/* Requester Info */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        {isPR ? <Building2 className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                      </div>
                      <span className="font-medium text-slate-700 truncate" title={requester}>
                        {requester}
                      </span>
                    </div>

                    {/* Task Title / Items */}
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
                      {task.title}
                    </h4>

                    {/* Amount & Status Badge Row */}
                    <div className="pt-2 flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">มูลค่าคำขอ</span>
                        {currentRole.canViewBudget ? (
                          <span className="font-mono text-xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                            ฿{task.amount?.toLocaleString() || 0}
                          </span>
                        ) : (
                          <span className="font-mono text-base font-bold text-slate-400">***</span>
                        )}
                      </div>

                      <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200/70 text-xs px-2.5 py-1 rounded-full font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span className="text-[11px]">{task.statusInfo?.label || 'รอการดำเนินการ'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Full-width Interactive Action Button */}
                <button
                  type="button"
                  className="w-full bg-slate-950 group-hover:bg-indigo-600 text-white py-2.5 px-4 rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
                >
                  <span>{activeTab === 'action' ? 'ตรวจสอบและอนุมัติ' : 'ดูรายละเอียดเอกสาร'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* PR Details & Approval Modal */}
      {currentActivePR && (
        <PRDetailsModal
          selectedPR={currentActivePR}
          currentRole={currentRole}
          onClose={() => setSelectedPR(null)}
          onRefresh={() => {
            if (onRefresh) onRefresh();
          }}
          onEditPR={onEditPR}
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
