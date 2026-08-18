import React, { useState, useMemo } from 'react';
import { PO_STATUS, PURCHASE_CHANNEL } from '../config/constants';
import { workflowEngine } from '../services/workflowEngine';
import { ShoppingBag, FileText, Search, X, DollarSign, PackageCheck, AlertTriangle, Truck, ShoppingCart, Building2, Store } from 'lucide-react';
import PODetailsModal from '../components/po/PODetailsModal';
import EmptyState from '../components/common/EmptyState';

export default function POListView({ pos, currentRole, onRefresh }) {
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
    const today = new Date().toISOString().split('T')[0];
    const totalCount = filteredPOs.length;
    const totalAmount = filteredPOs.reduce((sum, po) => sum + (po.grandTotal || po.subtotal || 0), 0);
    
    const pendingPOs = filteredPOs.filter(po => isPendingReceipt(po.status) || po.status === 'IN_PROGRESS_ONLINE');
    const pendingCount = pendingPOs.length;
    const pendingAmount = pendingPOs.reduce((sum, po) => sum + (po.grandTotal || po.subtotal || 0), 0);
    
    // Urgent/Overdue PO count
    const urgentCount = pendingPOs.filter(po => po.deliveryDate && po.deliveryDate <= today).length;

    return { totalCount, totalAmount, pendingCount, pendingAmount, urgentCount };
  }, [filteredPOs]);

  // Delivery status calculation per row
  const getDeliveryUrgency = (deliveryDate, status) => {
    if (status === 'RECEIVED' || status === 'CLOSED' || status === 'CANCELLED') return null;
    if (!deliveryDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(deliveryDate);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `เกินกำหนด ${Math.abs(diffDays)} วัน`, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    }
    if (diffDays === 0) {
      return { label: 'ครบกำหนดวันนี้', color: 'text-amber-700 bg-amber-50 border-amber-200 font-bold' };
    }
    if (diffDays <= 3) {
      return { label: `อีก ${diffDays} วัน`, color: 'text-amber-600 bg-amber-50 border-amber-100' };
    }
    return { label: `อีก ${diffDays} วัน`, color: 'text-slate-500 bg-slate-50 border-slate-200' };
  };

  const getStatusBadge = (status) => {
    const config = PO_STATUS[status] || { label: status, color: 'bg-slate-100 text-slate-800 border-slate-200' };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
        {config.label}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <ShoppingBag className={`w-5 h-5 ${isOnlinePurchaser ? 'text-violet-600' : 'text-emerald-600'}`} />
            {isOnlinePurchaser ? 'ประวัติใบสั่งซื้อออนไลน์ (Online Purchase Orders)' : 'รายการใบสั่งซื้อ (Purchase Orders)'}
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            {isOnlinePurchaser 
              ? 'ประวัติและสถานะใบสั่งซื้อออนไลน์ทั้งหมด (Shopee / Lazada / ร้านค้าออนไลน์)' 
              : 'ติดตามและจัดการใบสั่งซื้อ ตรวจรับสินค้าเข้าคลัง และบันทึกประวัติการส่งมอบ'}
          </p>
        </div>
      </div>

      {/* Insight Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="impeccable-card p-5 sm:p-6 bg-white hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">ยอดสั่งซื้อตามตัวกรอง</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1.5 font-mono tracking-tight">
                ฿{metrics.totalAmount.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">เอกสารทั้งหมด</span>
            <span className="text-slate-700 font-bold">{metrics.totalCount} ฉบับ</span>
          </div>
        </div>

        <div className="impeccable-card p-5 sm:p-6 bg-white hover:border-blue-200 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">มูลค่ารอรับเข้าคลัง</p>
              <h3 className="text-2xl font-black text-blue-700 mt-1.5 font-mono tracking-tight">
                ฿{metrics.pendingAmount.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">รอตรวจรับเข้าสต็อก</span>
            <span className="text-blue-700 font-bold">{metrics.pendingCount} ฉบับ</span>
          </div>
        </div>

        <div className="impeccable-card p-5 sm:p-6 bg-white hover:border-amber-200 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">กำหนดส่งเร่งด่วน / เกินกำหนด</p>
              <h3 className="text-2xl font-black text-amber-700 mt-1.5 font-mono tracking-tight">
                {metrics.urgentCount} <span className="text-xs font-semibold text-slate-400 font-sans">ฉบับ</span>
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">การติดตาม</span>
            <span className="text-amber-700 font-bold">จาก Supplier</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        {/* Quick Status Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
          <button 
            onClick={() => setFilterStatus('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'ALL' ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            ทั้งหมด
          </button>
          <button 
            onClick={() => setFilterStatus('PENDING')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'PENDING' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            รอรับของ (ซื้อเอง)
          </button>
          <button 
            onClick={() => setFilterStatus('IN_PROGRESS_ONLINE')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'IN_PROGRESS_ONLINE' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            รอดำเนินการ Online
          </button>
          <button 
            onClick={() => setFilterStatus('CLOSED')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'CLOSED' ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            ปิดงานแล้ว
          </button>
          <button 
            onClick={() => setFilterStatus('CANCELLED')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'CANCELLED' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            ยกเลิกแล้ว
          </button>
        </div>

        {/* Right Section: Dept Filter & Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {currentRole.canViewAllDepts && (
            <div className="relative min-w-[140px]">
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="impeccable-input cursor-pointer"
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
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาเลข PO, ผู้ขาย, PR..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="impeccable-input pl-9 pr-8"
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

      {/* PO Table */}
      <div className="impeccable-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[550px] custom-scrollbar relative">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="impeccable-table-th pl-6">เลขที่ PO / อ้างอิง</th>
                <th className="impeccable-table-th w-1/3 min-w-[220px]">รายการสินค้า (Products / Items)</th>
                <th className="impeccable-table-th">ช่องทาง</th>
                <th className="impeccable-table-th">กำหนดส่ง</th>
                <th className="impeccable-table-th text-right">ยอดเงินรวม</th>
                <th className="impeccable-table-th text-center">สถานะ</th>
                <th className="impeccable-table-th text-center pr-6">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-0">
                    <EmptyState 
                      title="ไม่พบข้อมูลใบสั่งซื้อ" 
                      description="ลองเปลี่ยนตัวกรอง ค้นหาด้วยคำอื่น หรือกดล้างการค้นหา"
                    />
                  </td>
                </tr>
              ) : (
                filteredPOs.map(po => {
                  const channel = PURCHASE_CHANNEL[po.purchaseChannel] || PURCHASE_CHANNEL.SELF;
                  
                  // Requester of that dept or doc owner can receive goods & close it
                  const canClose = workflowEngine.canAction(currentRole, po);
                  
                  const urgency = getDeliveryUrgency(po.deliveryDate, po.status);
                  
                  return (
                    <tr key={po.id} className="table-row-impeccable group border-b border-slate-50 last:border-0">
                      <td className="p-4 pl-6 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">{po.poNo}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">PR: <span className="font-semibold">{po.prNo}</span></div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{po.issueDate}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-sm leading-snug">
                          {po.items && po.items.length > 0 ? (
                            <div>
                              {po.items.length === 1 ? (
                                <span>
                                  {po.items[0].name}{' '}
                                  <span className="font-mono text-xs text-slate-500 font-normal">
                                    (x{Number((po.items[0].orderedQty ?? po.items[0].purchaseQty ?? po.items[0].qty) || 0).toLocaleString()} {po.items[0].purchaseUnit || po.items[0].unit || 'ชิ้น'})
                                  </span>
                                </span>
                              ) : (
                                <span>
                                  {po.items.map(i => i.name).join(', ')}
                                  <span className="ml-1.5 text-xs text-indigo-600 font-medium">({po.items.length} รายการ)</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">ไม่ระบุสินค้า</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>ผู้ขาย: <strong className="text-slate-700">{po.vendorName}</strong></span>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md w-max">
                          {po.purchaseChannel === 'ONLINE' ? (
                            <ShoppingCart className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <span>{channel.label}</span>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-[13px] font-mono">{po.deliveryDate || 'ตามระบุ'}</div>
                        {urgency && (
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${urgency.color}`}>
                            {urgency.label}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 text-[13px] whitespace-nowrap">
                        ฿{(po.grandTotal || po.totalAmount || po.subtotal || 0).toLocaleString()}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="p-4 pr-6 text-center whitespace-nowrap">
                        {canClose ? (
                          <button 
                            onClick={() => setSelectedPO(po)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all border shadow-xs cursor-pointer bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>ตรวจรับสินค้า</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => setSelectedPO(po)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all border shadow-xs cursor-pointer bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span>รายละเอียด</span>
                          </button>
                        )}
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
