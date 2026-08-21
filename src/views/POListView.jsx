import React, { useState, useMemo } from 'react';
import { PO_STATUS, PURCHASE_CHANNEL } from '../config/constants';
import { workflowEngine } from '../services/workflowEngine';
import { ShoppingBag, FileText, Search, X, DollarSign, PackageCheck, AlertTriangle, Truck, ShoppingCart, Building2, Store, FileSearch } from 'lucide-react';
import PODetailsModal from '../components/po/PODetailsModal';
import EmptyState from '../components/common/EmptyState';

export default function POListView({ pos = [], currentRole, onRefresh }) {
  const [selectedPO, setSelectedPO] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [searchQuery, setSearchQuery] = useState('');

  const isPendingReceipt = (status) => ['ISSUED', 'PARTIAL'].includes(status);
  const isOnlinePurchaser = currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER';

  // Department-based and Role-based access check
  const accessiblePOs = useMemo(() => {
    return pos.filter(po => {
      if (isOnlinePurchaser) return po.purchaseChannel === 'ONLINE';
      if (currentRole.canViewAllDepts || currentRole.id === 'ADMIN') return true;
      return po.department === currentRole.department;
    });
  }, [pos, currentRole, isOnlinePurchaser]);

  // Search & Filter Logic
  const filteredPOs = useMemo(() => {
    return accessiblePOs.filter(po => {
      // Hide cancelled by default unless filter is ALL or CANCELLED
      if (po.status === 'CANCELLED' && filterStatus !== 'ALL' && filterStatus !== 'CANCELLED') return false; 

      // Status filter
      let matchesStatus = true;
      if (filterStatus === 'PENDING') matchesStatus = isPendingReceipt(po.status);
      else if (filterStatus === 'RECEIVED' || filterStatus === 'CLOSED') matchesStatus = ['RECEIVED', 'CLOSED'].includes(po.status);
      else if (filterStatus === 'IN_PROGRESS_ONLINE') matchesStatus = po.status === 'IN_PROGRESS_ONLINE';
      else if (filterStatus === 'CANCELLED') matchesStatus = po.status === 'CANCELLED';

      // Dept filter
      const matchesDept = deptFilter === 'ALL' || po.department === deptFilter;

      // Search Query
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || (
        po.poNo?.toLowerCase().includes(q) ||
        po.vendorName?.toLowerCase().includes(q) ||
        po.prNo?.toLowerCase().includes(q) ||
        po.department?.toLowerCase().includes(q) ||
        po.items?.some(item => item.name?.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q))
      );

      return matchesStatus && matchesDept && matchesSearch;
    });
  }, [accessiblePOs, filterStatus, deptFilter, searchQuery]);

  // Calculated Metrics
  const metrics = useMemo(() => {
    const totalCount = filteredPOs.length;
    const totalAmount = filteredPOs.reduce((sum, po) => sum + (po.grandTotal || po.subtotal || 0), 0);
    
    const pendingPOs = filteredPOs.filter(po => isPendingReceipt(po.status) || po.status === 'IN_PROGRESS_ONLINE');
    const pendingCount = pendingPOs.length;
    const pendingAmount = pendingPOs.reduce((sum, po) => sum + (po.grandTotal || po.subtotal || 0), 0);

    return { totalCount, totalAmount, pendingCount, pendingAmount, urgentCount: 0 };
  }, [filteredPOs]);

  const getStatusBadge = (status) => {
    const config = PO_STATUS[status] || { label: status, color: 'bg-slate-100 text-slate-800 border-slate-200' };
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${config.color}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
        {config.label}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs border ${
              isOnlinePurchaser ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}>
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span>{isOnlinePurchaser ? 'ประวัติใบสั่งซื้อออนไลน์ (Online Purchase Orders)' : 'รายการใบสั่งซื้อ (Purchase Orders)'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            {isOnlinePurchaser 
              ? 'ประวัติและสถานะใบสั่งซื้อออนไลน์ทั้งหมด (Shopee / Lazada / ร้านค้าออนไลน์)' 
              : 'ติดตามและจัดการใบสั่งซื้อ ตรวจรับสินค้าเข้าคลัง และบันทึกประวัติการส่งมอบ'}
          </p>
        </div>
      </div>

      {/* Insight Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ยอดสั่งซื้อตามตัวกรอง</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
                ฿{metrics.totalAmount.toLocaleString()}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>เอกสารทั้งหมด</span>
            <span className="font-bold text-slate-900 font-mono tabular-nums bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200/60">{metrics.totalCount} ฉบับ</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">มูลค่ารอรับเข้าคลัง</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
                ฿{metrics.pendingAmount.toLocaleString()}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>รอตรวจรับเข้าสต็อก</span>
            <span className="font-bold text-indigo-700 font-mono tabular-nums bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60">{metrics.pendingCount} ฉบับ</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl overflow-x-auto custom-scrollbar">
          {[
            { id: 'ALL', label: 'ทั้งหมด' },
            { id: 'PENDING', label: 'รอรับของ (ซื้อเอง)' },
            { id: 'IN_PROGRESS_ONLINE', label: 'รอดำเนินการ Online' },
            { id: 'CLOSED', label: 'ปิดงานแล้ว' },
            { id: 'CANCELLED', label: 'ยกเลิกแล้ว' }
          ].map(tab => {
            const isSelected = filterStatus === tab.id;
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
              placeholder="ค้นหาเลข PO, ผู้ขาย, สินค้า..."
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

      {/* PO Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar relative">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-20 shadow-2xs bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 pl-6">เลขที่ PO</th>
                <th className="py-3.5 px-4">อ้างอิง PR / ฝ่าย</th>
                <th className="py-3.5 px-4">ผู้ขาย / ร้านค้า</th>
                <th className="py-3.5 px-4 w-1/3">รายการสินค้า</th>
                <th className="py-3.5 px-4 text-right">ยอดรวมสุทธิ</th>
                <th className="py-3.5 px-4 text-center">สถานะ</th>
                <th className="py-3.5 pr-6 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-0">
                    <EmptyState 
                      title="ไม่พบข้อมูลใบ PO" 
                      description="ลองเปลี่ยนตัวกรอง ค้นหาด้วยคำอื่น หรือกดล้างการค้นหา"
                    />
                  </td>
                </tr>
              ) : (
                filteredPOs.map(po => {
                  const channel = PURCHASE_CHANNEL[po.purchaseChannel] || PURCHASE_CHANNEL.SELF || { label: 'ซื้อเอง' };
                  const canAction = workflowEngine.canAction ? workflowEngine.canAction(currentRole, po) : false;

                  return (
                    <tr key={po.id} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 pl-6 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 font-mono font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200/60">{po.poNo}</span>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">{po.issuedDate || po.createdAt || '-'}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-mono font-semibold text-xs text-indigo-600">{po.prNo || '-'}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>ฝ่าย {po.department}</span>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {po.purchaseChannel === 'ONLINE' ? (
                            <Store className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span>{po.vendorName || (po.purchaseChannel === 'ONLINE' ? 'สั่งซื้อออนไลน์ (Shopee/Lazada)' : 'ยังไม่ระบุ')}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{channel.label}</div>
                      </td>
                      <td className="p-4 text-slate-600">
                        <div className="font-semibold text-slate-900 whitespace-nowrap font-mono">{po.items?.length || 0} รายการ</div>
                        <div className="text-xs text-slate-500 truncate max-w-[240px]">
                          {po.items?.map(i => i.name).join(', ')}
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold font-mono text-slate-900 tabular-nums whitespace-nowrap text-sm">
                        ฿{(po.grandTotal || po.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="p-4 pr-6 text-center whitespace-nowrap">
                        <button 
                          onClick={() => setSelectedPO(po)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                            canAction 
                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm' 
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white shadow-2xs'
                          }`}
                        >
                          <FileSearch className="w-3.5 h-3.5" />
                          <span>{canAction ? 'ตรวจรับ / จัดการ' : 'รายละเอียด'}</span>
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

      {/* PO DETAIL MODAL */}
      {selectedPO && (
        <PODetailsModal 
          selectedPO={selectedPO}
          currentRole={currentRole}
          onClose={() => setSelectedPO(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
