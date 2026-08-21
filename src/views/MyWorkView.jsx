import React, { useState, useMemo } from 'react';
import { workflowEngine } from '../services/workflowEngine';
import { PR_STATUS, PO_STATUS } from '../config/constants';
import { AlertCircle, Clock, CheckCircle2, ArrowRight, FileText, ShoppingBag, Loader2, Sparkles, ShieldCheck, Building2, Store } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import PRDetailsModal from '../components/pr/PRDetailsModal';
import PODetailsModal from '../components/po/PODetailsModal';

export default function MyWorkView({ prs, pos, currentRole, onNavigate, onRefresh, onEditPR }) {
  const [activeTab, setActiveTab] = useState('action');
  const [selectedPR, setSelectedPR] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);

  const tasks = useMemo(() => {
    return workflowEngine.getUserTasks(currentRole, prs, pos);
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
    <div className="w-full space-y-6 animate-fade-in pb-10">
      {/* Sleek Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
      </div>

      {/* Modern Segmented Filter Tabs */}
      <div className="flex gap-1.5 p-1.5 bg-slate-100/80 rounded-2xl w-full sm:w-fit overflow-x-auto custom-scrollbar border border-slate-200/60 shadow-2xs">
        <button
          onClick={() => setActiveTab('action')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'action'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <AlertCircle className={`w-4 h-4 text-indigo-600 ${activeTab === 'action' ? 'animate-bounce-slight' : ''}`} />
          <span>ต้องดำเนินการ (To Do)</span>
          {tasks.action.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {tasks.action.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('waiting')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'waiting'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Loader2 className={`w-4 h-4 text-amber-600 ${activeTab === 'waiting' ? 'animate-spin-slow' : ''}`} />
          <span>รอผู้อื่นดำเนินการ (In Progress)</span>
          {tasks.waiting.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-100">
              {tasks.waiting.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>เสร็จสิ้นแล้ว (Completed)</span>
        </button>
      </div>

      {/* Task List Container */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-sm min-h-[400px]">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {activeTasks.map(task => {
              const isPR = task.type === 'PR';
              const Icon = isPR ? FileText : ShoppingBag;
              
              return (
                <div 
                  key={`${task.type}-${task.id}`} 
                  onClick={() => handleTaskClick(task)}
                  className="group bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
                >
                  <div>
                    {/* Top Type & Date */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isPR ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              isPR ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            }`}>
                              {isPR ? 'ใบขอซื้อ' : 'ใบสั่งซื้อ'}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800">{task.docNo}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {task.date}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Task Title */}
                    <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mt-1">
                      {task.title}
                    </p>
                    
                    {isPR && task.raw?.department && (
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-normal">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" /> ฝ่าย: <strong className="font-semibold text-slate-700">{task.raw.department}</strong>
                      </p>
                    )}

                    {!isPR && task.vendorName && (
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-normal truncate">
                        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" /> <span className="truncate">{task.vendorName}</span>
                      </p>
                    )}
                  </div>
                  
                  {/* Status & Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${task.statusInfo?.color}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                        {task.statusInfo?.label}
                      </span>
                      
                      {currentRole.canViewBudget ? (
                        <span className="text-xs font-bold font-mono text-slate-900 tabular-nums">
                          ฿{task.amount?.toLocaleString() || 0}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">***</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-end">
                      <span className={`text-xs font-semibold flex items-center gap-1 transition-colors ${
                        activeTab === 'action' ? 'text-indigo-600 group-hover:text-indigo-800' : 'text-slate-600 group-hover:text-slate-900'
                      }`}>
                        <span>{activeTab === 'action' ? 'อนุมัติ / ตรวจสอบ' : 'ดูรายละเอียด'}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
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
