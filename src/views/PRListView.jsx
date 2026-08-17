import React, { useState, useMemo } from 'react';
import { PR_STATUS, PURCHASE_CHANNEL } from '../config/constants';
import { workflowEngine } from '../services/workflowEngine';
import PRDetailsModal from '../components/pr/PRDetailsModal';
import EmptyState from '../components/common/EmptyState';
import { ClipboardList, Plus, FileSearch, Search, X, DollarSign, Clock, CheckCircle2, Building2, Tag, ShoppingCart } from 'lucide-react';

export default function PRListView({ prs, currentRole, onRefresh, onNavigate }) {
  const [selectedPR, setSelectedPR] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [searchQuery, setSearchQuery] = useState('');

  // Department-based access check
  const accessiblePRs = useMemo(() => {
    return prs.filter(pr => {
      if (currentRole.canViewAllDepts || currentRole.id === 'ADMIN') return true;
      return pr.department === currentRole.department;
    });
  }, [prs, currentRole]);

  // Combined Search & Filter Logic
  const filteredPRs = useMemo(() => {
    return accessiblePRs.filter(pr => {
      // Status filter
      const matchesStatus = filterStatus === 'ALL' || 
        pr.status === filterStatus || 
        (filterStatus === 'APPROVED' && ['APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE'].includes(pr.status));

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

  // Calculated Metrics for Filtered Result
  const metrics = useMemo(() => {
    const totalCount = filteredPRs.length;
    const totalAmount = filteredPRs.reduce((sum, pr) => sum + (pr.totalAmount || 0), 0);
    const pendingPRs = filteredPRs.filter(pr => ['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(pr.status));
    const pendingCount = pendingPRs.length;
    const pendingAmount = pendingPRs.reduce((sum, pr) => sum + (pr.totalAmount || 0), 0);
    const approvedCount = filteredPRs.filter(pr => ['APPROVED', 'PO_ISSUED', 'IN_PROGRESS_ONLINE'].includes(pr.status)).length;

    return { totalCount, totalAmount, pendingCount, pendingAmount, approvedCount };
  }, [filteredPRs]);

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Header & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            รายการใบขอซื้อ (Purchase Requisitions)
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            จัดการ ติดตาม และอนุมัติใบขอซื้อวัตถุดิบและอุปกรณ์
          </p>
        </div>

        {currentRole.canCreatePR && (
          <button 
            onClick={() => onNavigate('pr-create')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            สร้างใบ PR ใหม่
          </button>
        )}
      </div>

      {/* Insight Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="impeccable-card p-5 sm:p-6 bg-white border border-slate-200/90 hover:border-indigo-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">ยอดรวม PR ในตัวกรอง</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1.5 font-mono tracking-tight">
                ฿{metrics.totalAmount.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">รายการทั้งหมด</span>
            <span className="text-indigo-700 font-bold">{metrics.totalCount} รายการ</span>
          </div>
        </div>

        <div className="impeccable-card p-5 sm:p-6 bg-white border border-slate-200/90 hover:border-amber-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">รออนุมัติสั่งซื้อ</p>
              <h3 className="text-2xl font-black text-amber-700 mt-1.5 font-mono tracking-tight">
                {metrics.pendingCount} <span className="text-xs font-semibold text-slate-400 font-sans">รายการ</span>
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">มูลค่ารออนุมัติ</span>
            <span className="text-amber-700 font-bold">฿{metrics.pendingAmount.toLocaleString()}</span>
          </div>
        </div>

        <div className="impeccable-card p-5 sm:p-6 bg-white border border-slate-200/90 hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">อนุมัติแล้ว / ออก PO</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1.5 font-mono tracking-tight">
                {metrics.approvedCount} <span className="text-xs font-semibold text-slate-400 font-sans">รายการ</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">สถานะ</span>
            <span className="text-emerald-700 font-bold">ผ่านการอนุมัติแล้ว</span>
          </div>
        </div>
      </div>

      {/* Unified Search & Filter Control Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setFilterStatus('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'ALL' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ทั้งหมด
          </button>
          {['DRAFT', 'SUBMITTED', 'REJECTED_TO_L2', 'REVIEWED', 'APPROVED', 'REJECTED_TO_DRAFT'].map(key => {
            const status = PR_STATUS[key];
            if (!status) return null;
            return (
              <button 
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === key ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {status.label}
              </button>
            )
          })}
        </div>

        {/* Right Controls: Dept Filter & Search Input */}
        <div className="flex items-center gap-2">
          {currentRole.canViewAllDepts && (
            <div className="relative">
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
              >
                <option value="ALL">ทุกแผนก</option>
                <option value="PD">ฝ่ายผลิต (PD)</option>
                <option value="QC">ควบคุมคุณภาพ (QC)</option>
                <option value="HR">HR & Admin (HR)</option>
                <option value="ACCT">ฝ่ายบัญชี (ACCT)</option>
                <option value="LAB">Microbiology Lab (LAB)</option>
              </select>
            </div>
          )}

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาเลข PR, ผู้ขอ, สินค้า..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PR Table */}
      <div className="impeccable-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar relative">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
              <tr className="text-slate-700 font-bold text-xs uppercase tracking-wider">
                <th className="p-4 pl-7 bg-slate-100">เลขที่ PR</th>
                <th className="p-4 bg-slate-100">ผู้ขอซื้อ / ฝ่าย</th>
                <th className="p-4 bg-slate-100">รายการสินค้า</th>
                <th className="p-4 bg-slate-100">ช่องทาง</th>
                <th className="p-4 text-right bg-slate-100">ยอดรวม</th>
                <th className="p-4 text-center bg-slate-100">สถานะ</th>
                <th className="p-4 text-center pr-7 bg-slate-100">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
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
                  const channel = PURCHASE_CHANNEL[pr.purchaseChannel] || PURCHASE_CHANNEL.SELF;
                  
                  return (
                    <tr key={pr.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="p-5 pl-7">
                        <div className="font-mono font-medium text-slate-600 flex items-center gap-2">
                          {pr.prNo}
                          {pr.memo && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1" title="มี MEMO แนบ">
                              <Tag className="w-3 h-3" /> MEMO
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{pr.requestedDate}</div>
                      </td>
                      <td className="p-5">
                        <div className="font-semibold text-slate-800">{pr.requestedBy}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{pr.department}</span>
                        </div>
                      </td>
                      <td className="p-5 text-slate-600">
                        <div className="font-medium">{pr.items.length} รายการ</div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">
                          {pr.items.map(i => i.name).join(', ')}
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded w-max">
                          {pr.purchaseChannel === 'ONLINE' ? (
                            <ShoppingCart className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <span>{channel.label}</span>
                        </div>
                      </td>
                      <td className="p-5 text-right font-semibold text-slate-700">
                        ฿{pr.totalAmount?.toLocaleString()}
                      </td>
                      <td className="p-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${PR_STATUS[pr.status]?.color}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                          {PR_STATUS[pr.status]?.label}
                        </span>
                      </td>
                      <td className="p-5 pr-7 text-center">
                        <button 
                          onClick={() => setSelectedPR(pr)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${canAction ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
                        >
                          <FileSearch className="w-4 h-4" />
                          {canAction ? 'ดำเนินการ' : 'ดูรายละเอียด'}
                        </button>
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
        />
      )}
    </div>
  );
}
