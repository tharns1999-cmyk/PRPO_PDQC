import React, { useState, useMemo } from 'react';
import { PR_STATUS, PURCHASE_CHANNEL } from '../config/constants';
import { workflowEngine } from '../services/workflowEngine';
import PRDetailsModal from '../components/pr/PRDetailsModal';
import EmptyState from '../components/common/EmptyState';
import { ClipboardList, Plus, FileSearch, Search, X, DollarSign, Clock, CheckCircle2, Building2, Tag, ShoppingCart, Pencil, ArrowRight } from 'lucide-react';

const PR_TABS = [
  { id: 'ALL', label: 'ทั้งหมด', filter: () => true },
  { id: 'PENDING_REVIEW', label: 'รอตรวจสอบ (Asst. Mgr)', filter: pr => ['SUBMITTED', 'REJECTED_TO_L2'].includes(pr.status) },
  { id: 'PENDING_APPROVE', label: 'รออนุมัติ (Plant Mgr)', filter: pr => pr.status === 'REVIEWED' },
  { id: 'APPROVED', label: 'อนุมัติแล้ว / ออก PO', filter: pr => ['APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE', 'CLOSED'].includes(pr.status) },
  { id: 'DRAFT_RETURNED', label: 'ร่าง / ส่งกลับแก้ไข', filter: pr => ['DRAFT', 'REJECTED_TO_DRAFT'].includes(pr.status) },
  { id: 'REJECTED', label: 'ไม่อนุมัติ / ยกเลิก', filter: pr => ['REJECTED', 'CANCELLED'].includes(pr.status) },
];

export default function PRListView({ prs = [], currentRole, onRefresh, onNavigate, onEditPR }) {
  const [selectedPR, setSelectedPR] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [searchQuery, setSearchQuery] = useState('');

  // Department-based access check
  const accessiblePRs = useMemo(() => {
    return (prs || []).filter(pr => {
      if (currentRole.canViewAllDepts || currentRole.id === 'ADMIN') return true;
      return pr.department === currentRole.department;
    });
  }, [prs, currentRole]);

  // Combined Search & Filter Logic
  const filteredPRs = useMemo(() => {
    const activeTab = PR_TABS.find(t => t.id === filterStatus) || PR_TABS[0];
    return accessiblePRs.filter(pr => {
      // Status filter via active tab logic
      const matchesStatus = activeTab.filter(pr);

      // Department filter
      const matchesDept = deptFilter === 'ALL' || pr.department === deptFilter;

      // Search Query
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || (
        pr.prNo?.toLowerCase().includes(q) ||
        pr.requestedBy?.toLowerCase().includes(q) ||
        pr.department?.toLowerCase().includes(q) ||
        pr.note?.toLowerCase().includes(q) ||
        pr.items?.some(item => item.name?.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q))
      );

      return matchesStatus && matchesDept && matchesSearch;
    });
  }, [accessiblePRs, filterStatus, deptFilter, searchQuery]);

  // Tab Badge Counters
  const tabCounts = useMemo(() => {
    const counts = {};
    PR_TABS.forEach(tab => {
      counts[tab.id] = accessiblePRs.filter(pr => {
        const matchesDept = deptFilter === 'ALL' || pr.department === deptFilter;
        return matchesDept && tab.filter(pr);
      }).length;
    });
    return counts;
  }, [accessiblePRs, deptFilter]);

  // Calculated Metrics for Filtered Result
  const metrics = useMemo(() => {
    const totalCount = filteredPRs.length;
    const totalAmount = filteredPRs.reduce((sum, pr) => sum + (pr.totalAmount || 0), 0);
    const pendingPRs = filteredPRs.filter(pr => ['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(pr.status));
    const pendingCount = pendingPRs.length;
    const pendingAmount = pendingPRs.reduce((sum, pr) => sum + (pr.totalAmount || 0), 0);
    const approvedCount = filteredPRs.filter(pr => ['APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE', 'CLOSED'].includes(pr.status)).length;

    return { totalCount, totalAmount, pendingCount, pendingAmount, approvedCount };
  }, [filteredPRs]);

  return (
    <div className="w-full space-y-6 animate-fade-in pb-10">
      
      {/* Header & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-2xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span>รายการใบขอซื้อ (Purchase Requisitions)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            จัดการ ติดตามสถานะ และอนุมัติใบขอซื้อวัตถุดิบและอุปกรณ์
          </p>
        </div>

        {currentRole.canCreatePR && (
          <button 
            onClick={() => onNavigate('pr-create')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างใบ PR ใหม่</span>
          </button>
        )}
      </div>

      {/* Insight Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ยอดรวม PR ในตัวกรอง</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
                ฿{metrics.totalAmount.toLocaleString()}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>รายการทั้งหมด</span>
            <span className="font-bold text-slate-900 font-mono tabular-nums bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200/60">{metrics.totalCount} รายการ</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">รออนุมัติสั่งซื้อ</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
                {metrics.pendingCount} <span className="text-xs font-semibold text-slate-400 font-sans">รายการ</span>
              </h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>มูลค่ารออนุมัติ</span>
            <span className="font-bold text-amber-800 font-mono tabular-nums bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60">฿{metrics.pendingAmount.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">อนุมัติแล้ว / ออก PO</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
                {metrics.approvedCount} <span className="text-xs font-semibold text-slate-400 font-sans">รายการ</span>
              </h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>สถานะ</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 text-[11px]">ผ่านการอนุมัติแล้ว</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar Container */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Business Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl overflow-x-auto custom-scrollbar">
          {PR_TABS.map(tab => {
            const isSelected = filterStatus === tab.id;
            const count = tabCounts[tab.id] || 0;
            return (
              <button 
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-white text-slate-900 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isSelected 
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                      : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Controls: Dept Filter & Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {currentRole.canViewAllDepts && (
            <div className="relative min-w-[140px]">
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="ALL">ทุกแผนก</option>
                <option value="PD">ฝ่ายผลิต (PD)</option>
                <option value="QC">ควบคุมคุณภาพ (QC)</option>
                <option value="HR">HR & Admin (HR)</option>
                <option value="ACCT">ฝ่ายบัญชี (ACCT)</option>
                <option value="LAB">Micro Lab (LAB)</option>
              </select>
            </div>
          )}

          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาเลข PR, ผู้ขอ, สินค้า..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 font-bold text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PR Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar relative">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-20 shadow-2xs bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 pl-6">เลขที่ PR</th>
                <th className="py-3.5 px-4">ผู้ขอซื้อ / ฝ่าย</th>
                <th className="py-3.5 px-4 w-1/3">รายการสินค้า</th>
                <th className="py-3.5 px-4">ช่องทาง</th>
                <th className="py-3.5 px-4 text-right">ยอดรวม</th>
                <th className="py-3.5 px-4 text-center">สถานะ</th>
                <th className="py-3.5 pr-6 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPRs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-0">
                    <EmptyState 
                      title="ไม่พบข้อมูลใบ PR" 
                      description="ลองเปลี่ยนตัวกรอง ค้นหาด้วยคำอื่น หรือกดล้างการค้นหา"
                    />
                  </td>
                </tr>
              ) : (
                filteredPRs.map(pr => {
                  const canAction = workflowEngine.canAction(currentRole, pr);
                  const channel = PURCHASE_CHANNEL[pr.purchaseChannel] || PURCHASE_CHANNEL.SELF || { label: 'ซื้อเอง' };
                  const statusConf = PR_STATUS[pr.status] || { label: pr.status || 'ไม่ระบุสถานะ', color: 'bg-slate-100 text-slate-700 border-slate-200' };
                  const itemsList = pr.items || [];
                  const isEditable = (pr.status === 'DRAFT' || pr.status === 'REJECTED_TO_DRAFT') && 
                    (currentRole.id === 'ADMIN' || currentRole.canCreatePR || workflowEngine.canAction(currentRole, pr));
                  
                  return (
                    <tr key={pr.id} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 pl-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100 text-slate-800 font-mono font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200/60">{pr.prNo}</span>
                          {pr.memo && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" title="มี MEMO แนบ">
                              <Tag className="w-3 h-3" /> MEMO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">{pr.requestedDate}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{pr.requestedBy}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>ฝ่าย {pr.department}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        <div className="font-semibold text-slate-900 whitespace-nowrap font-mono">{itemsList.length} รายการ</div>
                        <div className="text-xs text-slate-500 truncate max-w-[240px]">
                          {itemsList.map(i => i?.name || '').filter(Boolean).join(', ') || '-'}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 px-2.5 py-1 rounded-full w-max shadow-2xs">
                          {pr.purchaseChannel === 'ONLINE' ? (
                            <ShoppingCart className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <span>{channel.label}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold font-mono text-slate-900 tabular-nums whitespace-nowrap text-sm">
                        ฿{(pr.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${statusConf.color}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"></span>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEditable && onEditPR && (
                            <button
                              onClick={() => onEditPR(pr)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer shadow-2xs"
                              title="แก้ไขใบ PR นี้"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>แก้ไข</span>
                            </button>
                          )}
                          <button 
                            onClick={() => setSelectedPR(pr)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                              canAction 
                                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-sm' 
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white shadow-2xs'
                            }`}
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                            <span>{canAction ? 'ดำเนินการ' : 'รายละเอียด'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PR DETAIL MODAL */}
      {selectedPR && (
        <PRDetailsModal 
          selectedPR={selectedPR}
          currentRole={currentRole}
          onClose={() => setSelectedPR(null)}
          onRefresh={onRefresh}
          onEditPR={onEditPR}
        />
      )}
    </div>
  );
}
