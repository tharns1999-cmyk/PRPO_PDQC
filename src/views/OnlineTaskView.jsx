import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { useAppContext } from '../context/AppContext';
import { 
  ShoppingCart, CheckCircle2, Package, AlertCircle, Send, Check, 
  Search, ExternalLink, Copy, Clock, Sparkles, Building2, Eye, FileText, 
  ChevronRight, DollarSign, Truck, Calendar, Store, Tag, RotateCcw, AlertTriangle, X
} from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import AttachmentViewerModal from '../components/common/AttachmentViewerModal';
import PODetailsModal from '../components/po/PODetailsModal';
import CollapsibleActivityTimeline from '../components/common/CollapsibleActivityTimeline';
import { modalService } from '../services/modalService';
import { sanitizeExternalUrl, getProductUrl } from '../utils/urlHelper';

export default function OnlineTaskView({ currentRole, onRefresh }) {
  const { updatePO } = useAppContext();
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // PENDING | ORDERED | CLOSED | ALL
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [viewingAttachment, setViewingAttachment] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    setLoading(true);
    const allPOs = await apiService.getPOs();
    // Filter only online POs
    const onlinePOs = allPOs.filter(po => po.purchaseChannel === 'ONLINE');
    setPOs(onlinePOs);
    setLoading(false);
  };

  // Immediate Immutable State Updater across Local & Central Context
  const handleUpdatePO = useCallback((updatedPO) => {
    if (updatedPO && (updatedPO.id || updatedPO.poNo)) {
      setPOs(prev => prev.map(item => 
        (item.id === updatedPO.id || item.poNo === updatedPO.poNo)
          ? { ...item, ...updatedPO }
          : item
      ));
      if (updatePO) {
        updatePO(updatedPO.id || updatedPO.poNo, updatedPO);
      }
    }
    fetchPOs();
    if (onRefresh) onRefresh();
  }, [updatePO, onRefresh]);

  const pendingTasks = useMemo(() => pos.filter(po => {
    const s = String(po.status || '').toLowerCase();
    return ['in_progress_online', 'pending_order', 'pending'].includes(s);
  }), [pos]);

  const orderedTasks = useMemo(() => pos.filter(po => {
    const s = String(po.status || '').toLowerCase();
    return ['ordered_pending_delivery', 'in_delivery', 'ordered', 'partial_received', 'partially_received'].includes(s);
  }), [pos]);

  const claimTasks = useMemo(() => pos.filter(po => {
    const s = String(po.status || '').toLowerCase();
    return s.includes('claim');
  }), [pos]);

  const closedTasks = useMemo(() => pos.filter(po => {
    const s = String(po.status || '').toLowerCase();
    return ['completed', 'received', 'fully_received', 'closed'].includes(s);
  }), [pos]);

  // Overall Metrics for Purchaser
  const metrics = useMemo(() => {
    const totalCount = pos.length;
    const totalAmount = pos.reduce((sum, p) => sum + (p.grandTotal || p.subtotal || 0), 0);
    return {
      pending: pendingTasks.length,
      ordered: orderedTasks.length,
      claim: claimTasks.length,
      closed: closedTasks.length,
      total: totalCount,
      totalAmount
    };
  }, [pos, pendingTasks, orderedTasks, claimTasks, closedTasks]);

  // Filtered list
  const filteredTasks = useMemo(() => {
    return pos.filter(po => {
      // Tab filter
      let matchTab = true;
      const s = String(po.status || '').toLowerCase();
      if (activeTab === 'PENDING') matchTab = ['in_progress_online', 'pending_order', 'pending'].includes(s);
      else if (activeTab === 'ORDERED') matchTab = ['ordered_pending_delivery', 'in_delivery', 'ordered', 'partial_received', 'partially_received'].includes(s);
      else if (activeTab === 'CLAIM') matchTab = s.includes('claim');
      else if (activeTab === 'CLOSED') matchTab = ['completed', 'received', 'fully_received', 'closed'].includes(s);

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
    <div className="w-full space-y-6 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <div className="w-10 h-10 bg-violet-600 text-white rounded-2xl flex items-center justify-center shadow-2xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span>งานจัดซื้อออนไลน์ (Online Procurement Hub)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            ศูนย์จัดการคำสั่งซื้อผ่าน Shopee / Lazada / ร้านค้าออนไลน์ — สามารถปรับปรุงราคาจริงและจำนวนสต็อกก่อนสั่งซื้อได้
          </p>
        </div>
      </div>

      {/* 1. Stage Pipeline Ribbon (Linear/Vercel Segmented Pipeline) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="bg-slate-100/80 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200/60 max-w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
          {/* Step 1: Pending */}
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${
              metrics.pending > 0
                ? activeTab === 'PENDING'
                  ? 'border border-indigo-300 bg-indigo-100/90 text-indigo-950 shadow-2xs font-bold ring-1 ring-indigo-200'
                  : 'border border-indigo-200 bg-indigo-50/80 text-indigo-900 shadow-2xs hover:bg-indigo-100/80 font-bold'
                : activeTab === 'PENDING'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${activeTab === 'PENDING' || metrics.pending > 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>รอดำเนินการสั่งซื้อ</span>
            {metrics.pending > 0 ? (
              <span className="relative flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-black text-white bg-indigo-500 rounded-full shadow-xs ring-2 ring-white">
                {/* คลื่นแสงกะพริบโดยไม่ทะลุขอบคอนเทนเนอร์ */}
                <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-60 pointer-events-none"></span>
                <span className="relative z-10">{metrics.pending}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-200/60 text-slate-400 min-w-[20px] h-5 flex items-center justify-center font-mono">
                0
              </span>
            )}
          </button>

          {/* Step 2: Ordered / In Transit */}
          <button
            type="button"
            onClick={() => setActiveTab('ORDERED')}
            className={`transition-all duration-150 cursor-pointer rounded-xl px-3.5 py-2 text-xs flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ORDERED'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
            }`}
          >
            <Truck className={`w-3.5 h-3.5 ${activeTab === 'ORDERED' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>สั่งซื้อแล้ว / ระหว่างส่ง</span>
            <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold min-w-[20px] h-5 flex items-center justify-center ${
              metrics.ordered > 0 ? 'bg-indigo-100/80 text-indigo-700' : 'bg-slate-200/60 text-slate-400'
            }`}>
              {metrics.ordered}
            </span>
          </button>

          {/* Step 3: Claim */}
          <button
            type="button"
            onClick={() => setActiveTab('CLAIM')}
            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${
              metrics.claim > 0
                ? activeTab === 'CLAIM'
                  ? 'border border-amber-300 bg-amber-100/90 text-amber-950 shadow-2xs font-bold ring-1 ring-amber-200'
                  : 'border border-amber-200 bg-amber-50/80 text-amber-900 shadow-2xs hover:bg-amber-100/80 font-bold'
                : activeTab === 'CLAIM'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${activeTab === 'CLAIM' || metrics.claim > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>รอเคลม</span>
            {metrics.claim > 0 ? (
              <span className="relative flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-black text-white bg-amber-500 rounded-full shadow-xs ring-2 ring-white">
                {/* คลื่นแสงกะพริบโดยไม่ทะลุขอบคอนเทนเนอร์ */}
                <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60 pointer-events-none"></span>
                <span className="relative z-10">{metrics.claim}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-200/60 text-slate-400 min-w-[20px] h-5 flex items-center justify-center font-mono">
                0
              </span>
            )}
          </button>

          {/* Step 4: Closed */}
          <button
            type="button"
            onClick={() => setActiveTab('CLOSED')}
            className={`transition-all duration-150 cursor-pointer rounded-xl px-3.5 py-2 text-xs flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'CLOSED'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === 'CLOSED' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>ปิดงานสำเร็จ</span>
            <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold min-w-[20px] text-center ${
              metrics.closed > 0 ? 'bg-emerald-100/80 text-emerald-700' : 'bg-slate-200/60 text-slate-400'
            }`}>
              {metrics.closed}
            </span>
          </button>

          {/* All View */}
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`transition-all duration-150 cursor-pointer rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60 font-medium'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="font-mono text-[10px] text-slate-400 font-semibold">({metrics.total})</span>
          </button>
        </div>

        {/* Right side: Total Balance Capsule */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/70 shrink-0 self-start lg:self-auto">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">มูลค่าคำขอในมือ</span>
            <span className="font-mono font-bold text-slate-800 text-sm">
              ฿{metrics.totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-200/60 text-slate-600 flex items-center justify-center font-mono text-xs font-bold">
            {metrics.total}
          </div>
        </div>
      </div>

      {/* 2. Streamlined Search & Filter Utility Toolbar */}
      <div className="bg-slate-50/80 p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Left: Active Scope Indicator Badge */}
        <div className="flex items-center gap-2 flex-wrap text-xs px-1">
          <span className="text-slate-500 font-medium">กำลังแสดง:</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold border shadow-2xs ${
            activeTab === 'PENDING' ? 'bg-violet-50 text-violet-800 border-violet-200' :
            activeTab === 'ORDERED' ? 'bg-purple-50 text-purple-800 border-purple-200' :
            activeTab === 'CLAIM' ? 'bg-rose-50 text-rose-800 border-rose-200' :
            activeTab === 'CLOSED' ? 'bg-teal-50 text-teal-800 border-teal-200' :
            'bg-slate-100 text-slate-800 border-slate-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              activeTab === 'PENDING' ? 'bg-violet-600 animate-pulse' :
              activeTab === 'ORDERED' ? 'bg-purple-600' :
              activeTab === 'CLAIM' ? 'bg-rose-600 animate-pulse' :
              activeTab === 'CLOSED' ? 'bg-teal-600' :
              'bg-slate-700'
            }`} />
            {activeTab === 'PENDING' ? 'รอดำเนินการสั่งซื้อ' :
             activeTab === 'ORDERED' ? 'สั่งซื้อแล้ว / รอจัดส่ง' :
             activeTab === 'CLAIM' ? 'แจ้งปัญหา / รอเคลม' :
             activeTab === 'CLOSED' ? 'ตรวจรับสำเร็จแล้ว' :
             'รายการทั้งหมด'}
            <span className="opacity-80 font-mono font-bold">({filteredTasks.length})</span>
          </span>

          {(searchQuery || deptFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setDeptFilter('ALL'); }}
              className="text-slate-600 hover:text-slate-900 font-semibold underline underline-offset-2 ml-1 cursor-pointer transition-colors"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* Right: Search & Department Controls */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหา PO, PR, สินค้า, ร้านค้า..."
              className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
            className="bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shrink-0"
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
        <div className="space-y-5">
          {filteredTasks.map(po => (
            <OnlineTaskCard 
              key={po.id} 
              po={po} 
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

const renderPOStatusBadge = (status) => {
  const s = String(status || '').toLowerCase();
  if (['pending_order', 'in_progress_online', 'pending'].includes(s)) {
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">รอดำเนินการสั่งซื้อ</span>;
  }
  if (s === 'partial_received' || s === 'partially_received') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">รับของแล้วบางส่วน (รอรับเพิ่ม)</span>;
  }
  if (['completed', 'received', 'fully_received', 'closed'].includes(s)) {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">ตรวจรับครบ ปิดงานแล้ว</span>;
  }
  if (s.includes('claim')) {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">รอเคลมสินค้า</span>;
  }
  return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">สั่งซื้อแล้ว (ระหว่างส่ง)</span>;
};

function OnlineTaskCard({ po, currentRole, onUpdate, onViewAttachment, onShowDetails }) {
  const initialVendor = po.vendor || po.shopName || (po.vendorName && po.vendorName !== 'Shopee / Lazada (ระบุร้านภายหลัง)' ? po.vendorName : '');
  const [vendorName, setVendorName] = useState(initialVendor);
  const [varianceNote, setVarianceNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const isVendorValid = Boolean(vendorName && vendorName.trim().length >= 3);

  useEffect(() => {
    const v = po.vendor || po.shopName || (po.vendorName && po.vendorName !== 'Shopee / Lazada (ระบุร้านภายหลัง)' ? po.vendorName : '');
    if (v) setVendorName(v);
  }, [po.vendor, po.shopName, po.vendorName]);

  const statusLower = String(po.status || '').toLowerCase();
  const isPending = ['in_progress_online', 'pending_order', 'pending'].includes(statusLower);
  const isPartialReceived = ['partial_received', 'partially_received'].includes(statusLower);
  const isOrdered = ['ordered_pending_delivery', 'in_delivery', 'ordered'].includes(statusLower) || isPartialReceived;
  const isClaim = statusLower.includes('claim');
  const isClosed = ['completed', 'received', 'fully_received', 'closed'].includes(statusLower);

  // Claim resolution state
  const [claimResolutionType, setClaimResolutionType] = useState('RESEND');
  const [claimNote, setClaimNote] = useState('');
  const [claimExpectedDate, setClaimExpectedDate] = useState('');

  // Initialize editable item state for price & quantity adjustment
  const [items, setItems] = useState(() => 
    po.items.map((item, idx) => {
      const pQty = item.purchaseQty ?? item.qty ?? 1;
      const uPrice = item.unitPrice || item.estimatedPrice || item.price || 0;
      const origPrice = item.originalEstimatedPrice ?? uPrice;
      const origQty = item.originalPurchaseQty ?? pQty;
      return {
        ...item,
        _idx: idx,
        originalEstimatedPrice: origPrice,
        originalPurchaseQty: origQty,
        unitPrice: uPrice,
        purchaseQty: pQty
      };
    })
  );

  // Sync state if po.items changes externally
  useEffect(() => {
    setItems(po.items.map((item, idx) => {
      const pQty = item.purchaseQty ?? item.qty ?? 1;
      const uPrice = item.unitPrice || item.estimatedPrice || item.price || 0;
      const origPrice = item.originalEstimatedPrice ?? uPrice;
      const origQty = item.originalPurchaseQty ?? pQty;
      return {
        ...item,
        _idx: idx,
        originalEstimatedPrice: origPrice,
        originalPurchaseQty: origQty,
        unitPrice: uPrice,
        purchaseQty: pQty
      };
    }));
  }, [po.items]);

  const handlePriceChange = (index, val) => {
    const num = parseFloat(val);
    setItems(prev => prev.map((it, idx) => idx === index ? { ...it, unitPrice: isNaN(num) || num < 0 ? '' : num } : it));
  };

  const handleQtyChange = (index, val) => {
    const num = parseFloat(val);
    setItems(prev => prev.map((it, idx) => idx === index ? { ...it, purchaseQty: isNaN(num) || num <= 0 ? '' : num } : it));
  };

  const handleResetItem = (index) => {
    setItems(prev => prev.map((it, idx) => idx === index ? { 
      ...it, 
      unitPrice: it.originalEstimatedPrice, 
      purchaseQty: it.originalPurchaseQty 
    } : it));
  };

  const handleResetAll = () => {
    setItems(prev => prev.map(it => ({ 
      ...it, 
      unitPrice: it.originalEstimatedPrice, 
      purchaseQty: it.originalPurchaseQty 
    })));
    setVarianceNote('');
  };

  // Check if any item has been modified from original PR
  const hasModifications = useMemo(() => {
    return items.some(it => 
      Number(it.unitPrice) !== Number(it.originalEstimatedPrice) ||
      Number(it.purchaseQty) !== Number(it.originalPurchaseQty)
    );
  }, [items]);

  // Real-time totals
  const totalEstimatedAmount = useMemo(() => {
    return items.reduce((sum, it) => sum + ((Number(it.purchaseQty) || 0) * (Number(it.unitPrice) || 0)), 0);
  }, [items]);

  const originalTotalAmount = useMemo(() => {
    return items.reduce((sum, it) => sum + ((Number(it.originalPurchaseQty) || 0) * (Number(it.originalEstimatedPrice) || 0)), 0);
  }, [items]);

  const totalPurchaseQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.purchaseQty) || 0), 0);
  }, [items]);

  const priceDiff = totalEstimatedAmount - originalTotalAmount;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleAcknowledgeAndOrder = async () => {
    if (!isVendorValid) {
      return modalService.warning('กรุณาระบุชื่อร้านค้าออนไลน์ / ช่องทางที่สั่งซื้อ (อย่างน้อย 3 ตัวอักษร เช่น Shopee: ร้าน ABC, Lazada Mall)');
    }

    // Validate inputs
    for (let it of items) {
      if (it.unitPrice === '' || Number(it.unitPrice) < 0) {
        return modalService.warning(`กรุณาระบุราคาต่อหน่วยของ "${it.name}" ให้ถูกต้อง`);
      }
      if (!it.purchaseQty || Number(it.purchaseQty) <= 0) {
        return modalService.warning(`กรุณาระบุจำนวนสั่งซื้อของ "${it.name}" ให้มากกว่า 0`);
      }
    }

    let confirmMsg = `ยืนยันบันทึกว่าสั่งซื้อสินค้าเรียบร้อยแล้วสำหรับ PO ${po.poNo} จากร้าน "${vendorName.trim()}"\nยอดสั่งซื้อรวม: ฿${totalEstimatedAmount.toLocaleString()}`;
    if (hasModifications) {
      confirmMsg += `\n(มีการปรับยอดจากราคาประเมินเดิม ฿${originalTotalAmount.toLocaleString()} -> ส่วนต่าง ฿${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString()})`;
    }
    confirmMsg += `\n\nต้องการบันทึกและส่งต่องานใช่หรือไม่?`;

    const confirmed = await modalService.confirm({
      title: 'ยืนยันการสั่งซื้อสินค้าออนไลน์',
      message: confirmMsg,
      confirmText: 'ยืนยันสั่งซื้อแล้ว',
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedVendor = vendorName.trim();
      const updatedPO = await apiService.acknowledgeOnlineTask(po.id, trimmedVendor, currentRole, items, varianceNote.trim());
      
      const payload = {
        ...(updatedPO || po),
        status: 'ORDERED_PENDING_DELIVERY',
        vendor: trimmedVendor,
        vendorName: trimmedVendor,
        shopName: trimmedVendor,
        orderedAt: new Date().toISOString(),
        items: items.map(it => ({
          ...it,
          actualPrice: Number(it.unitPrice),
          actualQty: Number(it.purchaseQty)
        }))
      };

      // Immediate immutable state update so card leaves pending tab and badge updates instantly
      onUpdate(payload);

      await modalService.success('บันทึกการสั่งซื้อเรียบร้อย', `บันทึกการสั่งซื้อสำหรับ PO ${po.poNo} เรียบร้อยแล้ว! ระบบแจ้งเตือนแผนก ${po.department} ให้รอตรวจรับสินค้า`);
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึก', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveClaim = async () => {
    if (claimResolutionType === 'RESEND' && !claimExpectedDate) {
      return modalService.warning('กรุณาระบุวันที่คาดว่าจะได้รับสินค้าใหม่');
    }
    if (!claimNote.trim()) {
      return modalService.warning('กรุณาระบุหมายเหตุ/ความคืบหน้าการติดต่อร้านค้า');
    }

    const confirmMsg = `ยืนยันบันทึกผลการเคลม/ติดต่อร้านค้า สำหรับ PO ${po.poNo} ใช่หรือไม่?`;
    const confirmed = await modalService.confirm({
      title: 'ยืนยันผลการดำเนินการ',
      message: confirmMsg,
      confirmText: 'ยืนยันบันทึก',
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await apiService.resolveOnlineClaim(po.id, {
        type: claimResolutionType,
        note: claimNote.trim(),
        expectedDate: claimExpectedDate
      }, currentRole);
      onUpdate(res);
      await modalService.success('ดำเนินการเรียบร้อย', 'บันทึกสถานะการเคลมสำเร็จ');
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึก', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasOnlineUrl = po.onlineUrl && po.onlineUrl.trim().length > 0;

  return (
    <div className={`rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm mb-6 transition-all hover:shadow-md font-sans ${
      isPending ? 'ring-1 ring-violet-200/80' : ''
    }`}>
      {/* 1. Order Header: Consolidated PO, Dept, PR, Shop Name & Ghost Minimal PO View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* PO Number */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="font-mono font-bold text-slate-900 text-sm">{po.poNo}</span>
            <button 
              onClick={() => handleCopy(po.poNo)}
              title="คัดลอกเลขที่ PO"
              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Department Badge */}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
            po.department === 'PD' 
              ? 'bg-blue-50 text-blue-700 border-blue-200/80' 
              : 'bg-amber-50 text-amber-700 border-amber-200/80'
          }`}>
            {po.department}
          </span>

          {/* PR Reference */}
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium pl-1">
            <span>PR:</span>
            <strong className="text-slate-800 font-mono font-semibold">{po.prNo}</strong>
          </div>

          {/* Online Shop / Vendor Badge */}
          {(po.vendor || po.shopName || (po.vendorName && po.vendorName !== 'Shopee / Lazada (ระบุร้านภายหลัง)')) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50/70 border border-violet-200/70 rounded-xl text-xs text-slate-700">
              <Store className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <span className="text-slate-400">ร้านค้า:</span>
              <strong className="text-slate-800 font-semibold max-w-[220px] truncate">
                {po.vendor || po.shopName || po.vendorName}
              </strong>
            </div>
          )}

          {/* Status Badge */}
          {renderPOStatusBadge(po.status)}

          {/* Modification Indicator Badge */}
          {hasModifications && isPending && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/90 px-2.5 py-0.5 rounded-lg">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              ปรับราคา/จำนวน (ส่วนต่าง {priceDiff >= 0 ? '+' : ''}฿{priceDiff.toLocaleString()})
            </span>
          )}
        </div>

        {/* Right: Quick Links & Ghost Minimal 'เปิดดู PO ฉบับเต็ม ↗' */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          {hasOnlineUrl && (
            <a
              href={sanitizeExternalUrl(po.onlineUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50/80 hover:bg-violet-100/80 px-3 py-1.5 rounded-xl transition-colors border border-violet-200/80 shadow-2xs group"
            >
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              <span>ลิงก์คำขอซื้อ</span>
            </a>
          )}

          {po.specUrl && (
            <button
              onClick={() => onViewAttachment({ name: 'เอกสาร/สเปกสินค้า', url: po.specUrl, type: 'link' })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors border border-slate-200 cursor-pointer"
            >
              <FileText className="w-3 h-3 text-slate-500" />
              <span>สเปกแนบ</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onShowDetails(po)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl transition-all cursor-pointer border border-slate-200/70"
          >
            <span>เปิดดู PO ฉบับเต็ม</span>
            <span className="text-slate-400 font-sans">↗</span>
          </button>
        </div>
      </div>

      {/* PO Remarks Strip (If specified) */}
      {po.remarks && (
        <div className="mt-3 py-2 px-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-500 shrink-0">หมายเหตุ PO:</span>
          <span className="text-slate-700">"{po.remarks}"</span>
        </div>
      )}

      {/* 2. Items Summary (Pushed First): Product Line Table */}
      <div className="mt-3.5 overflow-x-auto rounded-2xl border border-slate-200/70">
        <table className="w-full text-left text-xs sm:text-sm font-sans">
          <thead className="bg-slate-50/90 border-b border-slate-200/70 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3 pl-4">รหัสสินค้า</th>
              <th className="py-3 px-3">รายการสินค้า & สเปก</th>
              <th className="py-3 px-3 text-right">
                {isPending ? 'ราคาซื้อจริง / หน่วย' : 'ราคาต่อหน่วย'}
              </th>
              <th className="py-3 px-3 text-center">
                {isPending ? 'จำนวนที่สั่งได้จริง' : 'จำนวนสั่งซื้อ'}
              </th>
              <th className="py-3 px-3 text-right">รวมเงิน (Line Total)</th>
              <th className="py-3 pr-4 text-right">คำสั่ง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const pQty = Number(item.purchaseQty) || 0;
              const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
              const sUnit = item.stockUnit || item.unit || pUnit;
              const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
              const sQty = pQty * rate;
              const price = Number(item.unitPrice) || 0;
              const lineTotal = price * pQty;

              const isPriceChanged = Number(item.unitPrice) !== Number(item.originalEstimatedPrice);
              const isQtyChanged = Number(item.purchaseQty) !== Number(item.originalPurchaseQty);
              const isItemModified = isPriceChanged || isQtyChanged;

              return (
                <tr key={idx} className={`hover:bg-slate-50/60 transition-colors ${isItemModified && isPending ? 'bg-amber-50/25' : ''}`}>
                  {/* Code & Thumbnail */}
                  <td className="py-3.5 pl-4 font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      {item.imageUrl ? (
                        <div className="w-9 h-9 rounded-xl border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 text-slate-400">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <span className="font-mono font-bold text-slate-900">{item.code}</span>
                        {(() => {
                          const rawUrl = getProductUrl(item);
                          if (!rawUrl) return null;
                          return (
                            <div className="mt-1">
                              <a
                                href={sanitizeExternalUrl(rawUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/60 transition-all shadow-2xs group"
                              >
                                <span>ดูร้านค้าออนไลน์</span>
                                <ExternalLink className="w-2.5 h-2.5 text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                              </a>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </td>

                  {/* Name & Note */}
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-slate-900 leading-snug" title={item.name}>
                      {item.name}
                    </div>
                    {item.note && (
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>{item.note}</span>
                      </div>
                    )}
                  </td>

                  {/* Unit Price */}
                  <td className="py-3.5 px-3 text-right whitespace-nowrap">
                    {isPending ? (
                      <div className="inline-flex flex-col items-end">
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-2.5 text-xs text-slate-400 font-mono">฿</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={e => handlePriceChange(idx, e.target.value)}
                            className={`w-28 pl-6 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl font-mono text-xs font-bold text-right text-slate-900 transition-all shadow-2xs outline-none ${
                              isPriceChanged ? 'border-amber-400 bg-amber-50/50 text-amber-900' : ''
                            }`}
                            placeholder="0.00"
                            title="แก้ไขราคาต่อหน่วยจริง"
                          />
                        </div>
                        {isPriceChanged && (
                          <span className="text-[10px] text-amber-600 mt-0.5 font-mono font-semibold">
                            เดิม: ฿{item.originalEstimatedPrice?.toLocaleString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="font-mono text-xs font-bold text-slate-800">
                        ฿{price.toLocaleString()} <span className="text-[10px] text-slate-400 font-sans font-normal">/ {pUnit}</span>
                      </div>
                    )}
                  </td>

                  {/* Purchase Qty */}
                  <td className="py-3.5 px-3 text-center whitespace-nowrap">
                    {isPending ? (
                      <div className="inline-flex flex-col items-center">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.purchaseQty}
                            onChange={e => handleQtyChange(idx, e.target.value)}
                            className={`w-18 px-2 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl font-mono text-xs font-bold text-center text-slate-900 transition-all shadow-2xs outline-none ${
                              isQtyChanged ? 'border-amber-400 bg-amber-50/50 text-amber-900' : ''
                            }`}
                            title="แก้ไขจำนวนที่สั่งซื้อได้จริง"
                          />
                          <span className="text-xs text-slate-500 font-medium">{pUnit}</span>
                        </div>
                        {isQtyChanged && (
                          <span className="text-[10px] text-amber-600 mt-0.5 font-mono font-semibold">
                            ขอมา: {item.originalPurchaseQty} {pUnit}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="font-mono text-xs font-bold text-slate-800">
                        {pQty.toLocaleString()} <span className="text-slate-400 font-sans font-normal">{pUnit}</span>
                      </div>
                    )}
                  </td>

                  {/* Line Total Price */}
                  <td className="py-3.5 px-3 text-right whitespace-nowrap">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      ฿{lineTotal.toLocaleString()}
                    </span>
                  </td>

                  {/* 1-Click Copy & Item Revert */}
                  <td className="py-3.5 pr-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {isPending && isItemModified && (
                        <button
                          type="button"
                          onClick={() => handleResetItem(idx)}
                          className="p-1.5 text-amber-600 hover:bg-amber-100/70 rounded-lg transition-colors cursor-pointer"
                          title="คืนค่าเดิมของรายการนี้"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => handleCopy(item.name)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="คัดลอกชื่อสินค้าไปค้นหาใน Shopee / Lazada"
                      >
                        {copiedCode === item.name ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-semibold">คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>คัดลอกชื่อ</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Variance Note Input (When price/qty is modified in pending mode) */}
      {isPending && hasModifications && (
        <div className="mt-3 p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-sans">
          <div className="flex items-center gap-2 text-xs text-amber-900 font-medium shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>ระบุเหตุผลการปรับยอด (ถ้ามี):</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={varianceNote}
              onChange={e => setVarianceNote(e.target.value)}
              placeholder="เช่น ร้านค้าเหลือ 5 ชิ้น, ได้รับคูปองส่วนลด..."
              className="w-full bg-white border border-amber-300/80 text-xs rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-amber-400 outline-none text-slate-800 shadow-2xs font-sans"
            />
            <button
              type="button"
              onClick={handleResetAll}
              className="px-3 py-1.5 bg-white hover:bg-amber-100/60 text-slate-700 border border-amber-200 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
              title="คืนค่าเดิมจากใบขอซื้อ PR ทั้งหมด"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>คืนค่าเดิมทั้งหมด</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Integrated Checkout Action Dock (Pending) OR Status Info Footer (Non-Pending) */}
      {isPending ? (
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 font-sans">
          {/* Left: Vendor Input with storefront icon & Quick Platform Chips */}
          <div className="w-full md:w-96">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-slate-400">ช่องทางด่วน:</span>
              {[
                { name: 'Shopee', prefix: 'Shopee: ' },
                { name: 'Lazada', prefix: 'Lazada: ' },
                { name: 'เว็บทางการ', prefix: 'Website: ' },
                { name: 'สั่งทาง LINE', prefix: 'LINE: ' },
              ].map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setVendorName(prev => (prev || '').startsWith(p.prefix) ? prev : `${p.prefix}${(prev || '').replace(/^(Shopee|Lazada|Website|LINE):\s*/, '')}`)}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  + {p.name}
                </button>
              ))}
            </div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              ร้านค้าออนไลน์ / ช่องทางที่สั่งซื้อ
            </label>
            <div className="relative flex items-center">
              <Store className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="เช่น Shopee: ร้าน ABC Official, Lazada Mall..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs font-sans"
              />
            </div>
          </div>

          {/* Right: Net Total & Purchase Trigger Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-5">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                ยอดรวมสุทธิ ({items.length} รายการ)
              </span>
              <span className="font-mono text-2xl font-bold text-slate-900 tracking-tight">
                ฿{totalEstimatedAmount.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleAcknowledgeAndOrder}
                disabled={!isVendorValid || isSubmitting}
                className={`text-xs px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap font-semibold ${
                  !isVendorValid || isSubmitting
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-slate-950 hover:bg-indigo-600 text-white cursor-pointer shadow-md active:scale-95'
                }`}
              >
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการสั่งซื้อเรียบร้อย'}</span>
                <span className="font-mono text-sm">→</span>
              </button>
              {!isVendorValid && (
                <span className="text-[10px] text-rose-500 font-medium tracking-tight">
                  * กรุณาระบุชื่อร้านค้าก่อนยืนยัน
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Status Info Footer for Non-Pending Orders */
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-sans">
          <div className="flex items-center gap-1.5">
            {isPartialReceived ? (
              <span className="text-purple-700 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>สินค้าตรวจรับแล้วบางส่วน อยู่ระหว่างรอรับสินค้าที่เหลือให้ครบถ้วน</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>คำสั่งซื้อนี้อยู่ในขั้นตอนการตรวจรับและจัดการโดยแผนก <strong>{po.department}</strong></span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">รวม {items.length} รายการ ({totalPurchaseQty.toLocaleString()} ชิ้น)</span>
            <span>•</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              ฿{totalEstimatedAmount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* 4. Claim Management Box (Balanced Warm Card beneath items summary) */}
      {isClaim && (
        <div className="bg-rose-50/40 border border-rose-200/70 rounded-2xl p-4 mt-3 font-sans">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-rose-950">
                  จัดการปัญหาการสั่งซื้อ / ติดต่อเคลมสินค้า
                </h4>
                {po.claimRound > 0 && (
                  <span className="text-[10px] bg-rose-200/80 text-rose-800 px-2 py-0.5 rounded-md font-mono font-bold">
                    รอบที่ {po.claimRound}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-800/90 mt-0.5 font-medium">
                ปัญหา: <span className="font-semibold">{po.claimData?.reason}</span> — {po.claimData?.description}
              </p>

              {/* Item-level Claim Breakdown Table if available */}
              {Array.isArray(po.claimData?.claimDetails?.items || po.claimDetails?.items) && (po.claimData?.claimDetails?.items || po.claimDetails?.items).length > 0 && (
                <div className="mt-2.5 bg-white/95 border border-rose-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
                  <p className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-rose-600" />
                    <span>รายการสินค้าที่พบปัญหา / เคลม:</span>
                  </p>
                  <div className="space-y-1 text-xs divide-y divide-rose-100">
                    {(po.claimData?.claimDetails?.items || po.claimDetails?.items).map((cIt, cIdx) => (
                      <div key={cIdx} className="pt-1.5 first:pt-0 flex items-center justify-between text-slate-700">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">• {cIt.name}</span>
                          <span className="text-[11px] text-rose-600 font-medium">({cIt.reasonLabel || cIt.reason}: {cIt.description || '-'})</span>
                        </div>
                        <span className="font-mono font-bold text-rose-700 text-xs px-2 py-0.5 bg-rose-50 border border-rose-200 rounded">
                          {cIt.claimedQty} {cIt.purchaseUnit || 'ชิ้น'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Segmented Button Grid (3 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3.5">
            {[
              { id: 'RESEND', title: 'ร้านจะส่งของให้ใหม่/เพิ่ม', desc: 'รอรับสินค้าอีกครั้ง' },
              { id: 'CLOSE_WITH_REFUND', title: 'ได้รับเงินคืนแล้ว', desc: 'ปิดงาน จบเรื่อง' },
              { id: 'CLOSE_NO_ACTION', title: 'ยอมรับสภาพ/ไม่ทำอะไร', desc: 'ปิดงาน จบเรื่อง' }
            ].map(opt => {
              const active = claimResolutionType === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs border-rose-300 font-semibold ring-1 ring-rose-200'
                      : 'bg-white/60 border-slate-200/80 hover:bg-white text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`claimRes-${po.id}`}
                    value={opt.id}
                    checked={active}
                    onChange={() => setClaimResolutionType(opt.id)}
                    className="text-rose-600 focus:ring-rose-500 w-4 h-4 mt-0.5 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <p className={`text-xs ${active ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{opt.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Unified inline inputs & submit button row */}
          <div className="mt-3 flex flex-col md:flex-row items-end gap-3 pt-3 border-t border-rose-100">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3 w-full">
              {claimResolutionType === 'RESEND' ? (
                <>
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                      วันที่คาดว่าจะได้รับใหม่ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={claimExpectedDate}
                      onChange={e => setClaimExpectedDate(e.target.value)}
                      className="w-full bg-white border border-rose-200/90 text-xs rounded-xl px-3 h-9 focus:ring-2 focus:ring-rose-500 outline-none font-mono text-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-8">
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                      หมายเหตุ / ความคืบหน้า <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={claimNote}
                      onChange={e => setClaimNote(e.target.value)}
                      placeholder="เช่น ร้านค้ายืนยันส่งใหม่ทาง Kerry, ได้รับเงินโอนคืนแล้ว..."
                      className="w-full bg-white border border-rose-200/90 text-xs rounded-xl px-3.5 h-9 focus:ring-2 focus:ring-rose-500 outline-none text-slate-800"
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-12">
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    หมายเหตุ / ความคืบหน้า <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={claimNote}
                    onChange={e => setClaimNote(e.target.value)}
                    placeholder="เช่น ได้รับเงินโอนคืนแล้ว, ร้านค้ายืนยันปิดเคส..."
                    className="w-full bg-white border border-rose-200/90 text-xs rounded-xl px-3.5 h-9 focus:ring-2 focus:ring-rose-500 outline-none text-slate-800"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleResolveClaim}
              disabled={isSubmitting}
              className="h-9 px-4 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกสถานะเคลม'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Collapsible Activity Timeline */}
      {po.activityLog && po.activityLog.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <CollapsibleActivityTimeline
            events={po.activityLog}
            title="ประวัติการดำเนินงานคำสั่งซื้อ"
            defaultExpanded={false}
          />
        </div>
      )}
    </div>
  );
}
