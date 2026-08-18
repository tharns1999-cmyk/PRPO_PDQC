import React, { useState, useMemo, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { 
  ShoppingCart, CheckCircle2, Package, AlertCircle, Send, Check, 
  Search, ExternalLink, Copy, Clock, Sparkles, Building2, Eye, FileText, 
  ChevronRight, DollarSign, Truck, Calendar, Store, Tag, RotateCcw, AlertTriangle, X
} from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import AttachmentViewerModal from '../components/common/AttachmentViewerModal';
import PODetailsModal from '../components/po/PODetailsModal';
import { modalService } from '../services/modalService';

export default function OnlineTaskView({ currentRole, onRefresh }) {
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

  const pendingTasks = useMemo(() => pos.filter(po => po.status === 'IN_PROGRESS_ONLINE'), [pos]);
  const orderedTasks = useMemo(() => pos.filter(po => po.status === 'ORDERED_PENDING_DELIVERY'), [pos]);
  const closedTasks = useMemo(() => pos.filter(po => po.status === 'CLOSED'), [pos]);

  // Overall Metrics for Purchaser
  const metrics = useMemo(() => {
    const totalCount = pos.length;
    const totalAmount = pos.reduce((sum, p) => sum + (p.grandTotal || p.subtotal || 0), 0);
    return {
      pending: pendingTasks.length,
      ordered: orderedTasks.length,
      closed: closedTasks.length,
      total: totalCount,
      totalAmount
    };
  }, [pos, pendingTasks, orderedTasks, closedTasks]);

  // Filtered list
  const filteredTasks = useMemo(() => {
    return pos.filter(po => {
      // Tab filter
      let matchTab = true;
      if (activeTab === 'PENDING') matchTab = po.status === 'IN_PROGRESS_ONLINE';
      else if (activeTab === 'ORDERED') matchTab = po.status === 'ORDERED_PENDING_DELIVERY';
      else if (activeTab === 'CLOSED') matchTab = po.status === 'CLOSED';

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
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-violet-600 text-white rounded-2xl shadow-md shadow-violet-500/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span>งานจัดซื้อออนไลน์ (Online Procurement Hub)</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            ศูนย์จัดการคำสั่งซื้อผ่าน Shopee / Lazada / ร้านค้าออนไลน์ — สามารถปรับปรุงราคาจริงและจำนวนสต็อกก่อนสั่งซื้อได้
          </p>
        </div>
      </div>

      {/* 1. Interactive Metric Filter Deck (Clickable Cards as Primary Navigation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Order */}
        <button 
          type="button"
          onClick={() => setActiveTab('PENDING')}
          className={`relative text-left p-5 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden group border ${
            activeTab === 'PENDING' 
              ? 'bg-gradient-to-br from-violet-50/95 via-violet-50/40 to-white border-violet-400 ring-2 ring-violet-500/20 shadow-md shadow-violet-500/10 before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-violet-600' 
              : 'bg-white border-slate-200/90 hover:border-violet-200 hover:bg-slate-50/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${activeTab === 'PENDING' ? 'bg-violet-600 ring-2 ring-violet-300' : 'bg-slate-300'}`} />
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">รอดำเนินการ (Action Required)</p>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mt-2 font-mono tracking-tight flex items-baseline gap-1.5">
                {metrics.pending}
                <span className="text-xs font-bold text-slate-400 font-sans">รายการ</span>
              </h3>
            </div>
            <div className={`p-3 rounded-2xl transition-colors ${
              activeTab === 'PENDING' 
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30' 
                : 'bg-violet-100/80 text-violet-700 group-hover:bg-violet-200/70'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">ขั้นตอน</span>
            <span className={`font-bold ${activeTab === 'PENDING' ? 'text-violet-700' : 'text-slate-600'}`}>
              ต้องระบุร้าน & สั่งซื้อ
            </span>
          </div>
        </button>

        {/* Card 2: Ordered / In Transit */}
        <button 
          type="button"
          onClick={() => setActiveTab('ORDERED')}
          className={`relative text-left p-5 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden group border ${
            activeTab === 'ORDERED' 
              ? 'bg-gradient-to-br from-purple-50/95 via-purple-50/40 to-white border-purple-400 ring-2 ring-purple-500/20 shadow-md shadow-purple-500/10 before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-purple-600' 
              : 'bg-white border-slate-200/90 hover:border-purple-200 hover:bg-slate-50/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${activeTab === 'ORDERED' ? 'bg-purple-600 ring-2 ring-purple-300' : 'bg-slate-300'}`} />
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">สั่งซื้อแล้ว (รอจัดส่ง)</p>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mt-2 font-mono tracking-tight flex items-baseline gap-1.5">
                {metrics.ordered}
                <span className="text-xs font-bold text-slate-400 font-sans">รายการ</span>
              </h3>
            </div>
            <div className={`p-3 rounded-2xl transition-colors ${
              activeTab === 'ORDERED' 
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30' 
                : 'bg-purple-100/80 text-purple-700 group-hover:bg-purple-200/70'
            }`}>
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">ขั้นตอน</span>
            <span className={`font-bold ${activeTab === 'ORDERED' ? 'text-purple-700' : 'text-slate-600'}`}>
              อยู่ระหว่างขนส่ง
            </span>
          </div>
        </button>

        {/* Card 3: Closed */}
        <button 
          type="button"
          onClick={() => setActiveTab('CLOSED')}
          className={`relative text-left p-5 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden group border ${
            activeTab === 'CLOSED' 
              ? 'bg-gradient-to-br from-teal-50/95 via-teal-50/40 to-white border-teal-400 ring-2 ring-teal-500/20 shadow-md shadow-teal-500/10 before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-teal-600' 
              : 'bg-white border-slate-200/90 hover:border-teal-200 hover:bg-slate-50/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${activeTab === 'CLOSED' ? 'bg-teal-600 ring-2 ring-teal-300' : 'bg-slate-300'}`} />
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">ปิดงานสำเร็จ (Completed)</p>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mt-2 font-mono tracking-tight flex items-baseline gap-1.5">
                {metrics.closed}
                <span className="text-xs font-bold text-slate-400 font-sans">รายการ</span>
              </h3>
            </div>
            <div className={`p-3 rounded-2xl transition-colors ${
              activeTab === 'CLOSED' 
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-500/30' 
                : 'bg-teal-100/80 text-teal-700 group-hover:bg-teal-200/70'
            }`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">ขั้นตอน</span>
            <span className={`font-bold ${activeTab === 'CLOSED' ? 'text-teal-700' : 'text-slate-600'}`}>
              แผนกตรวจรับเรียบร้อย
            </span>
          </div>
        </button>

        {/* Card 4: Total Value & View All */}
        <button 
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`relative text-left p-5 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden group border ${
            activeTab === 'ALL' 
              ? 'bg-gradient-to-br from-slate-100 via-slate-50 to-white border-slate-700 ring-2 ring-slate-800/20 shadow-md before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-slate-800' 
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${activeTab === 'ALL' ? 'bg-slate-800 ring-2 ring-slate-400' : 'bg-slate-300'}`} />
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider truncate">รวมทั้งหมด ({metrics.total} ฉบับ)</p>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mt-2 font-mono tracking-tight truncate">
                ฿{metrics.totalAmount.toLocaleString()}
              </h3>
            </div>
            <div className={`p-3 rounded-2xl transition-colors shrink-0 ${
              activeTab === 'ALL' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
            }`}>
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">โหมดแสดงผล</span>
            <span className={`font-bold ${activeTab === 'ALL' ? 'text-slate-900 underline underline-offset-2' : 'text-slate-600'}`}>
              ดูทุกสถานะ (ทั้งหมด)
            </span>
          </div>
        </button>
      </div>

      {/* 2. Streamlined Search & Filter Utility Toolbar (No Redundant Tabs) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Active Scope Indicator Badge */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-400 font-medium">กำลังแสดง:</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold border ${
            activeTab === 'PENDING' ? 'bg-violet-50 text-violet-800 border-violet-200' :
            activeTab === 'ORDERED' ? 'bg-purple-50 text-purple-800 border-purple-200' :
            activeTab === 'CLOSED' ? 'bg-teal-50 text-teal-800 border-teal-200' :
            'bg-slate-100 text-slate-800 border-slate-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              activeTab === 'PENDING' ? 'bg-violet-600 animate-pulse' :
              activeTab === 'ORDERED' ? 'bg-purple-600' :
              activeTab === 'CLOSED' ? 'bg-teal-600' :
              'bg-slate-700'
            }`} />
            {activeTab === 'PENDING' ? 'รอดำเนินการสั่งซื้อ' :
             activeTab === 'ORDERED' ? 'สั่งซื้อแล้ว / รอจัดส่ง' :
             activeTab === 'CLOSED' ? 'ตรวจรับสำเร็จแล้ว' :
             'รายการทั้งหมด'}
            <span className="opacity-70 font-mono">({filteredTasks.length})</span>
          </span>

          {(searchQuery || deptFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setDeptFilter('ALL'); }}
              className="text-slate-400 hover:text-slate-600 font-semibold underline underline-offset-2 ml-1 cursor-pointer transition-colors"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* Right: Search & Department Controls */}
        <div className="flex items-center gap-2.5 flex-1 md:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหา PO, PR, สินค้า, ร้านค้า..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer shrink-0"
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
              onUpdate={() => { fetchPOs(); if (onRefresh) onRefresh(); }} 
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
          onRefresh={() => { fetchPOs(); if (onRefresh) onRefresh(); }}
        />
      )}
    </div>
  );
}

function OnlineTaskCard({ po, currentRole, onUpdate, onViewAttachment, onShowDetails }) {
  const [vendorName, setVendorName] = useState(
    po.vendorName && po.vendorName !== 'Shopee / Lazada (ระบุร้านภายหลัง)' ? po.vendorName : ''
  );
  const [varianceNote, setVarianceNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const isPending = po.status === 'IN_PROGRESS_ONLINE';
  const isOrdered = po.status === 'ORDERED_PENDING_DELIVERY';
  const isClosed = po.status === 'CLOSED';

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
    if (!vendorName.trim()) {
      return modalService.warning('กรุณาระบุชื่อร้านค้าออนไลน์ / ช่องทางที่สั่งซื้อ (เช่น Shopee ร้าน ABC, Lazada Official)');
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
      await apiService.acknowledgeOnlineTask(po.id, vendorName.trim(), currentRole, items, varianceNote.trim());
      await modalService.success('บันทึกการสั่งซื้อเรียบร้อย', `บันทึกการสั่งซื้อสำหรับ PO ${po.poNo} เรียบร้อยแล้ว! ระบบแจ้งเตือนแผนก ${po.department} ให้รอตรวจรับสินค้า`);
      onUpdate();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึก', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasOnlineUrl = po.onlineUrl && po.onlineUrl.trim().length > 0;

  return (
    <div className={`bg-white border rounded-2xl shadow-xs overflow-hidden transition-all hover:shadow-md ${
      isPending ? 'border-violet-200/90 ring-1 ring-violet-100' : 'border-slate-200/90'
    }`}>
      {/* 1. Header Bar: Identity & Quick Actions */}
      <div className="bg-slate-50/90 border-b border-slate-100 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* PO Number & Copy */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="font-bold text-slate-800 text-sm font-mono">{po.poNo}</span>
            <button 
              onClick={() => handleCopy(po.poNo)}
              title="คัดลอกเลขที่ PO"
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Department Badge */}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
            po.department === 'PD' 
              ? 'bg-blue-50 text-blue-700 border-blue-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {po.department === 'PD' ? 'ฝ่ายผลิต (PD)' : 'ฝ่าย QC'}
          </span>

          {/* Status Badge */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl border ${
            isPending ? 'bg-violet-100/90 text-violet-800 border-violet-200' :
            isOrdered ? 'bg-purple-100/90 text-purple-800 border-purple-200' :
            'bg-teal-100/90 text-teal-800 border-teal-200'
          }`}>
            {isPending && <Clock className="w-3.5 h-3.5 text-violet-600 shrink-0" />}
            {isOrdered && <Package className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
            {!isPending && !isOrdered && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
            <span>{isPending ? 'รอดำเนินการสั่งซื้อ' : isOrdered ? 'สั่งซื้อแล้ว (รอจัดส่ง)' : 'ตรวจรับปิดงานแล้ว'}</span>
          </span>

          {/* PO Total Amount Pill */}
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            ยอดประเมินรวม: ฿{totalEstimatedAmount.toLocaleString()}
          </span>

          {/* Modification Indicator Badge */}
          {hasModifications && isPending && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg animate-pulse-slow">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              มีการปรับราคา/จำนวนจริง (ส่วนต่าง {priceDiff >= 0 ? '+' : ''}฿{priceDiff.toLocaleString()})
            </span>
          )}
        </div>

        {/* View Full PO Details Button */}
        <button
          onClick={() => onShowDetails(po)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 hover:text-slate-900 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs border border-slate-200/90 shrink-0 group self-start sm:self-auto"
        >
          <FileText className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" />
          <span>เปิดดูข้อมูล PO ฉบับเต็ม</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* 2. Metadata Strip */}
      <div className="px-5 sm:px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span>อ้างอิง PR:</span>
          <strong className="text-slate-800 font-mono">{po.prNo}</strong>
        </div>

        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>วันที่ต้องการ:</span>
          <strong className="text-slate-800">{po.deliveryDate || 'ไม่ระบุ'}</strong>
        </div>

        {po.vendorName && po.vendorName !== 'Shopee / Lazada (ระบุร้านภายหลัง)' && (
          <div className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-violet-500" />
            <span>ร้านค้า:</span>
            <strong className="text-violet-700">{po.vendorName}</strong>
          </div>
        )}

        {po.remarks && (
          <div className="flex items-center gap-1.5 text-slate-500 italic max-w-md truncate">
            <span>หมายเหตุ PR:</span>
            <span>"{po.remarks}"</span>
          </div>
        )}

        {/* Links & Attachments */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {hasOnlineUrl && (
            <a
              href={po.onlineUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1 rounded-lg transition-colors border border-violet-200/80"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              เปิดลิงก์ Shopee / Lazada
            </a>
          )}

          {po.specUrl && (
            <button
              onClick={() => onViewAttachment({ name: 'เอกสาร/สเปกสินค้า', url: po.specUrl, type: 'link' })}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors border border-indigo-200/80 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              ดูสเปก/เอกสาร
            </button>
          )}
        </div>
      </div>

      {/* 3. Action Box (Only for Pending Orders) */}
      {isPending && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-violet-50/90 via-purple-50/70 to-slate-50 border-b border-violet-100 flex flex-col gap-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-violet-600 text-white rounded-xl shadow-xs shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-violet-950">ระบุร้านค้าและยืนยันการสั่งซื้อสินค้า</p>
                <p className="text-[11px] text-slate-500">
                  คุณสามารถแก้ไขราคาต่อหน่วยและจำนวนที่สั่งซื้อได้ตามสต็อกจริงในตารางด้านล่างก่อนกดยืนยัน
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
              <input 
                type="text" 
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="ระบุร้าน เช่น Shopee ร้าน ABC, Lazada Official..."
                className="text-xs bg-white border border-slate-300 rounded-xl px-3.5 py-2 w-full sm:w-60 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all font-medium outline-none shadow-xs"
              />
              <button
                onClick={handleAcknowledgeAndOrder}
                disabled={isSubmitting}
                className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md shadow-violet-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmitting ? 'กำลังบันทึก...' : 'รับทราบและสั่งซื้อแล้ว'}
              </button>
            </div>
          </div>

          {/* Variance Note Input (Shows if price/qty modified) */}
          {hasModifications && (
            <div className="pt-2 border-t border-violet-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 p-3 rounded-xl border border-amber-200/80">
              <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ระบุเหตุผลการปรับปรุงยอด (ถ้ามี):</span>
              </div>
              <div className="flex items-center gap-2 flex-1 sm:max-w-lg">
                <input
                  type="text"
                  value={varianceNote}
                  onChange={e => setVarianceNote(e.target.value)}
                  placeholder="เช่น สินค้าในร้านเหลือ 5 ชิ้น เลยกดซื้อมาก่อน, มีส่วนลดคูปอง..."
                  className="w-full bg-white border border-amber-300 text-xs rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                  title="คืนค่าเดิมจากใบขอซื้อ PR ทั้งหมด"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>คืนค่าเดิม</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Items Table */}
      <div className="p-5 sm:p-6 overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar relative">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
            <tr className="text-slate-700 text-xs font-bold uppercase tracking-wider">
              <th className="py-3 pl-3 bg-slate-100">รหัสสินค้า</th>
              <th className="py-3 bg-slate-100">รายการสินค้าที่ต้องซื้อ</th>
              <th className="py-3 text-right bg-slate-100">
                {isPending ? 'ราคาซื้อจริง / หน่วย (฿)' : 'ราคาต่อหน่วย (฿)'}
              </th>
              <th className="py-3 text-center bg-slate-100">
                {isPending ? 'จำนวนที่สั่งซื้อได้จริง' : 'จำนวนสั่งซื้อ (Qty)'}
              </th>
              <th className="py-3 text-right bg-slate-100">ยอดรวมจริง (Line Total)</th>
              <th className="py-3 text-center bg-slate-100">ยอดเข้าคลัง (Stock)</th>
              <th className="py-3 text-right pr-3 bg-slate-100">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/90">
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
                <tr key={idx} className={`hover:bg-slate-50/70 transition-colors ${isItemModified && isPending ? 'bg-amber-50/20' : ''}`}>
                  {/* Code & Thumbnail */}
                  <td className="py-4 pl-3 font-mono font-medium text-slate-500 text-xs">
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
                        <span className="text-slate-700 font-semibold">{item.code}</span>
                        {item.onlineUrl && (
                          <a 
                            href={item.onlineUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[10px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200/80 px-2 py-0.5 rounded-md mt-1 flex items-center gap-1 transition-colors w-fit"
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> ลิงก์สินค้า
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Name & Note */}
                  <td className="py-4 font-semibold text-slate-800 max-w-sm">
                    <div className="line-clamp-2 text-sm leading-snug" title={item.name}>{item.name}</div>
                    {item.note && (
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-normal">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{item.note}</span>
                      </div>
                    )}
                  </td>

                  {/* Unit Price (Editable if Pending) */}
                  <td className="py-4 text-right">
                    {isPending ? (
                      <div className="inline-flex flex-col items-end">
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-2.5 text-xs text-slate-400 font-bold">฿</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={e => handlePriceChange(idx, e.target.value)}
                            className={`w-28 pl-6 pr-2 py-1.5 bg-white border rounded-xl text-xs font-mono font-bold text-right text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all shadow-2xs ${
                              isPriceChanged ? 'border-amber-400 bg-amber-50/40 text-amber-900 ring-1 ring-amber-300' : 'border-slate-300'
                            }`}
                            title="แก้ไขราคาต่อหน่วยจริงที่สั่งซื้อได้"
                          />
                        </div>
                        {isPriceChanged && (
                          <div className="text-[10px] text-amber-600 mt-1 font-mono font-medium">
                            เดิม: ฿{item.originalEstimatedPrice?.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-semibold text-slate-700 font-mono">
                          ฿{price.toLocaleString()} <span className="text-[10px] text-slate-400 font-sans">/ {pUnit}</span>
                        </span>
                        {isPriceChanged && (
                          <div className="text-[10px] text-amber-600 line-through font-mono">
                            เดิม ฿{item.originalEstimatedPrice?.toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Purchase Qty (Editable if Pending) */}
                  <td className="py-4 text-center">
                    {isPending ? (
                      <div className="inline-flex flex-col items-center">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.purchaseQty}
                            onChange={e => handleQtyChange(idx, e.target.value)}
                            className={`w-16 px-2 py-1.5 bg-white border rounded-xl text-xs font-mono font-bold text-center text-violet-700 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all shadow-2xs ${
                              isQtyChanged ? 'border-amber-400 bg-amber-50/40 text-amber-900 ring-1 ring-amber-300' : 'border-slate-300'
                            }`}
                            title="แก้ไขจำนวนที่สั่งซื้อจริงตามสต็อกร้านค้า"
                          />
                          <span className="text-xs font-medium text-slate-500">{pUnit}</span>
                        </div>
                        {isQtyChanged && (
                          <span className="text-[10px] text-amber-600 mt-1 font-mono font-medium">
                            ขอมา: {item.originalPurchaseQty} {pUnit}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-sm text-violet-700 font-mono">
                          {pQty.toLocaleString()}
                        </span>{' '}
                        <span className="text-xs font-medium text-slate-500">{pUnit}</span>
                        {isQtyChanged && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ขอมา: {item.originalPurchaseQty} {pUnit}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Line Total Price */}
                  <td className="py-4 text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                      isItemModified 
                        ? 'text-amber-800 bg-amber-50 border border-amber-200/80 shadow-2xs' 
                        : 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
                    }`}>
                      <DollarSign className="w-3 h-3 text-emerald-500" />
                      ฿{lineTotal.toLocaleString()}
                    </span>
                  </td>

                  {/* Stock Qty */}
                  <td className="py-4 text-center font-medium text-slate-600 text-xs">
                    <span className="font-mono font-semibold">{sQty.toLocaleString()}</span>{' '}
                    <span className="text-slate-400">{sUnit}</span>
                    {rate > 1 && (
                      <div className="text-[10px] text-slate-400">(อัตรา 1:{rate})</div>
                    )}
                  </td>

                  {/* Actions (Copy + Revert) */}
                  <td className="py-4 text-right pr-3">
                    <div className="inline-flex items-center gap-1.5">
                      {isPending && isItemModified && (
                        <button
                          type="button"
                          onClick={() => handleResetItem(idx)}
                          className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                          title="คืนค่าเดิมของรายการนี้"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleCopy(item.name)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="คัดลอกชื่อสินค้าไปค้นหาใน Shopee/Lazada"
                      >
                        {copiedCode === item.name ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
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
          {/* Table Summary Footer */}
          <tfoot>
            <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-200/90 text-slate-800 text-xs">
              <td colSpan={3} className="py-3.5 pl-3 text-slate-600">
                <div className="flex items-center gap-2">
                  <span>ยอดรวมประเมินทั้งฉบับ ({items.length} รายการ)</span>
                  {hasModifications && isPending && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">
                      ยอดเดิม: ฿{originalTotalAmount.toLocaleString()}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3.5 text-center text-xs font-mono font-bold text-violet-700">
                {totalPurchaseQty.toLocaleString()} ชิ้น
              </td>
              <td className="py-3.5 text-right font-mono font-black text-sm text-emerald-700">
                ฿{totalEstimatedAmount.toLocaleString()}
              </td>
              <td colSpan={2} className="py-3.5 text-right pr-3">
                {hasModifications && isPending && (
                  <span className="text-[11px] text-slate-500 font-mono font-semibold">
                    ส่วนต่าง: {priceDiff >= 0 ? '+' : ''}฿{priceDiff.toLocaleString()}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {/* 5. Footer Info Strip */}
      <div className="bg-slate-50/80 border-t border-slate-100 px-5 sm:px-6 py-3 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0" />
          <span>เมื่อกดสั่งซื้อแล้ว หน้าที่ตรวจรับของและบันทึกปิด PO จะส่งต่อให้แผนก <strong>{po.department}</strong> อัตโนมัติ</span>
        </span>
        <div className="flex items-center gap-3 font-mono">
          <span>รวม {items.length} รายการ ({totalPurchaseQty.toLocaleString()} ชิ้น)</span>
          <span>•</span>
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
            ยอดสั่งซื้อรวม ฿{totalEstimatedAmount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
