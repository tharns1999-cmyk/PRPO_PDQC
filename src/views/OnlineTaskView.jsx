import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { useAppContext } from '../context/AppContext';
import { 
  ShoppingCart, CheckCircle2, Package, AlertCircle, Send, Check, 
  Search, ExternalLink, Copy, Clock, Sparkles, Building2, Eye, FileText, 
  ChevronRight, DollarSign, Truck, Calendar, Store, Tag, RotateCcw, AlertTriangle, X
} from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import AttachmentViewerModal from '../components/common/AttachmentViewerModal';
import PODetailsModal from '../components/po/PODetailsModal';
import { modalService } from '../services/modalService';
import OnlineOrderCard, { OnlinePurchaseActionCard } from './procurement/OnlineOrderCard';

export default function OnlineTaskView({ currentRole, onRefresh }) {
  const { updatePO } = useAppContext();
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // PENDING | ORDERED | CLAIM | CLOSED | ALL
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [viewingAttachment, setViewingAttachment] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const data = await apiService.getPOs();
      // Filter only ONLINE channel purchase orders
      const onlinePOs = (data || []).filter(p => p.purchaseChannel === 'ONLINE');
      setPOs(onlinePOs);
    } catch (err) {
      console.error('Failed to fetch online tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePO = useCallback((updatedPO) => {
    setPOs(prev => prev.map(p => p.id === updatedPO.id ? updatedPO : p));
    if (updatePO) updatePO(updatedPO);
    if (onRefresh) onRefresh();
  }, [updatePO, onRefresh]);

  // Real-time stage pipeline counts & total amount
  const metrics = useMemo(() => {
    let pending = 0;
    let ordered = 0;
    let claim = 0;
    let closed = 0;
    let totalAmount = 0;

    pos.forEach(po => {
      const s = String(po.status || '').toLowerCase();
      const amount = Number(po.totalAmount || po.grandTotal || po.estimatedAmount || 0);
      totalAmount += amount;

      if (['in_progress_online', 'pending_order', 'pending', 'waiting_order', 'waiting', 'issued', 'รอดำเนินการ', 'รอดำเนินการสั่งซื้อ'].includes(s)) {
        pending++;
      } else if (['ordered_pending_delivery', 'in_delivery', 'ordered', 'partial_received', 'partially_received', 'waiting_delivery', 'waiting_delivery_round_2'].includes(s) || s.startsWith('waiting_delivery')) {
        ordered++;
      } else if (s.includes('claim') && !s.includes('refund')) {
        claim++;
      } else if (['completed', 'received', 'fully_received', 'closed', 'completed_with_refund'].includes(s) || s.startsWith('completed')) {
        closed++;
      }
    });

    return { pending, ordered, claim, closed, total: pos.length, totalAmount };
  }, [pos]);

  // Filter tasks based on activeTab, deptFilter, and searchQuery
  const filteredTasks = useMemo(() => {
    return pos.filter(po => {
      const s = String(po.status || '').toLowerCase();

      // Tab filter
      let matchTab = true;
      if (activeTab === 'PENDING') {
        matchTab = ['in_progress_online', 'pending_order', 'pending', 'waiting_order', 'waiting', 'issued', 'รอดำเนินการ', 'รอดำเนินการสั่งซื้อ'].includes(s);
      } else if (activeTab === 'ORDERED') {
        matchTab = ['ordered_pending_delivery', 'in_delivery', 'ordered', 'partial_received', 'partially_received', 'waiting_delivery', 'waiting_delivery_round_2'].includes(s) || s.startsWith('waiting_delivery');
      } else if (activeTab === 'CLAIM') {
        matchTab = s.includes('claim') && !s.includes('refund');
      } else if (activeTab === 'CLOSED') {
        matchTab = ['completed', 'received', 'fully_received', 'closed', 'completed_with_refund'].includes(s) || s.startsWith('completed');
      }

      // Dept filter
      const matchDept = deptFilter === 'ALL' || po.department === deptFilter;

      // Search query
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || (
        po.poNo?.toLowerCase().includes(q) ||
        po.prNo?.toLowerCase().includes(q) ||
        po.vendorName?.toLowerCase().includes(q) ||
        po.onlineUrl?.toLowerCase().includes(q) ||
        po.items?.some(it => it.name?.toLowerCase().includes(q) || it.code?.toLowerCase().includes(q))
      );

      return matchTab && matchDept && matchSearch;
    });
  }, [pos, activeTab, deptFilter, searchQuery]);

  return (
    <div className="w-full space-y-4 animate-fade-in pb-10 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-2xs">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span>งานจัดซื้อออนไลน์ (Online Procurement Hub)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            ศูนย์จัดการคำสั่งซื้อผ่าน Shopee / Lazada / ร้านค้าออนไลน์ — บันทึกราคาจริงและตรวจสอบสถานะคำสั่งซื้อ
          </p>
        </div>

        {/* Actions & Total Value Capsule */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Reset Mock Data Button */}
          <button
            type="button"
            onClick={async () => {
              const confirmed = await modalService.confirm({
                title: 'รีเซ็ตข้อมูลจำลอง PO-QC-2026-001',
                message: 'ต้องการกู้คืนข้อมูล PO-QC-2026-001 ให้ตรงตามใบ PR ต้นทาง (รายการที่ 1: 2 ขวด @ ฿750 = ฿1,500, รายการที่ 2: 8 ขวด @ ฿70 = ฿560, รวม ฿2,060) หรือไม่?',
                confirmText: 'ยืนยันรีเซ็ต',
                cancelText: 'ยกเลิก'
              });
              if (confirmed) {
                await apiService.resetPOQC2026001();
                await fetchPOs();
                modalService.success('กู้คืนข้อมูลสำเร็จ', 'รีเซ็ตข้อมูล PO-QC-2026-001 ยอดรวม ฿2,060 เรียบร้อยแล้ว');
              }
            }}
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200/80 shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="รีเซ็ตค่า PO-QC-2026-001 ให้ตรงตาม PR"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">รีเซ็ตข้อมูล Mock PO</span>
          </button>

          {/* Total Value Capsule */}
          <div className="flex items-center gap-3 px-3 py-1.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">มูลค่าคำขอในมือ</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                ฿{metrics.totalAmount.toLocaleString()}
              </span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-mono text-xs font-bold">
              {metrics.total}
            </div>
          </div>
        </div>
      </div>

      {/* 1. Unified Compact Segmented Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Left: Segmented Status Tabs */}
        <div className="bg-slate-100/80 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60 max-w-full overflow-x-auto custom-scrollbar">
          {/* Step 1: Pending */}
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PENDING'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${activeTab === 'PENDING' || metrics.pending > 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>รอดำเนินการ</span>
            <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
              metrics.pending > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/60 text-slate-400'
            }`}>
              {metrics.pending}
            </span>
          </button>

          {/* Step 2: Ordered */}
          <button
            type="button"
            onClick={() => setActiveTab('ORDERED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ORDERED'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
            }`}
          >
            <Truck className={`w-3.5 h-3.5 ${activeTab === 'ORDERED' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>สั่งซื้อแล้ว</span>
            <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
              metrics.ordered > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/60 text-slate-400'
            }`}>
              {metrics.ordered}
            </span>
          </button>

          {/* Step 3: Claim */}
          <button
            type="button"
            onClick={() => setActiveTab('CLAIM')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'CLAIM'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${activeTab === 'CLAIM' || metrics.claim > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>รอเคลม</span>
            {metrics.claim > 0 && (
              <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold bg-amber-100 text-amber-800">
                {metrics.claim}
              </span>
            )}
          </button>

          {/* Step 4: Closed */}
          <button
            type="button"
            onClick={() => setActiveTab('CLOSED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'CLOSED'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === 'CLOSED' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>ปิดงานสำเร็จ</span>
            <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
              metrics.closed > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/60 text-slate-400'
            }`}>
              {metrics.closed}
            </span>
          </button>

          {/* All View */}
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60 font-medium'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="font-mono text-[10px] text-slate-400 font-semibold">({metrics.total})</span>
          </button>
        </div>

        {/* Right: Search & Department Filter */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหา PO, PR, สินค้า, ร้านค้า..."
              className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/90 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shrink-0"
          >
            <option value="ALL">ทุกแผนก (ALL)</option>
            <option value="PD">ฝ่ายผลิต (PD)</option>
            <option value="QC">ฝ่าย QC</option>
          </select>
        </div>
      </div>

      {/* Task Cards List */}
      {loading ? (
        <div className="text-center p-12 text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูลรายการจัดซื้อ...</div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState 
          icon={ShoppingCart}
          title={
            searchQuery || deptFilter !== 'ALL'
              ? 'ไม่พบรายการที่ตรงกับการค้นหา'
              : activeTab === 'PENDING'
              ? 'ไม่มีงานค้างรอสั่งซื้อ (ดำเนินการครบถ้วนแล้ว)'
              : activeTab === 'ORDERED'
              ? 'ไม่มีรายการที่อยู่ระหว่างจัดส่ง'
              : activeTab === 'CLOSED'
              ? 'ยังไม่มีรายการที่ปิดงานตรวจรับ'
              : 'ไม่พบรายการสั่งซื้อออนไลน์'
          } 
          description={
            searchQuery || deptFilter !== 'ALL'
              ? 'ลองปรับเปลี่ยนคำค้นหาหรือเปลี่ยนตัวกรองแผนกเพื่อดูรายการอื่น'
              : activeTab === 'PENDING'
              ? 'คำสั่งซื้อออนไลน์ทั้งหมดได้รับการจัดการเรียบร้อยแล้ว เมื่อมี PR ออนไลน์ใหม่ที่ผ่านการอนุมัติ จะมาปรากฏที่นี่โดยอัตโนมัติ'
              : activeTab === 'ORDERED'
              ? 'เมื่อท่านกดยืนยันการสั่งซื้อแล้ว เอกสารจะย้ายมารอจัดส่งและส่งต่อให้แผนกตรวจรับที่นี่'
              : 'ยังไม่มีประวัติรายการจัดซื้อออนไลน์ในสถานะนี้'
          } 
        />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(po => (
            <OnlineOrderCard 
              key={po.id} 
              po={po} 
              activeTab={activeTab}
              currentRole={currentRole}
              onViewAttachment={setViewingAttachment}
              onShowDetails={setSelectedPO}
              onUpdate={handleUpdatePO} 
            />
          ))}
        </div>
      )}

      {/* AttachmentViewerModal */}
      {viewingAttachment && (
        <AttachmentViewerModal
          file={viewingAttachment}
          onClose={() => setViewingAttachment(null)}
        />
      )}

      {/* PO Detail Modal */}
      {selectedPO && (
        <PODetailsModal
          selectedPO={selectedPO}
          currentRole={currentRole}
          onClose={() => setSelectedPO(null)}
          onRefresh={handleUpdatePO}
        />
      )}
    </div>
  );
}

export const OnlineTaskCard = OnlineOrderCard;
export { OnlineOrderCard, OnlinePurchaseActionCard };
