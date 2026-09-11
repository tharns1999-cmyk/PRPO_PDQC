import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PR_STATUS } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { useAppContext } from '../../context/AppContext';
import { storageService } from '../../services/storageService';
import { workflowEngine } from '../../services/workflowEngine';
import { modalService } from '../../services/modalService';
import { 
  ExternalLink, History, ShieldCheck, CheckCircle2, XCircle, 
  Trash2, Send, Edit3, Save, RotateCcw, AlertTriangle, Layers, 
  X, User, Calendar, FileText, 
  ChevronRight, MessageSquare, Pencil,
  Paperclip, Globe, Tag, Factory, Building, Package
} from 'lucide-react';
import MEMODetailsSection from './MEMODetailsSection';
import POSplitModal from '../po/POSplitModal';
import AttachmentViewerModal from '../common/AttachmentViewerModal';
import RejectPRModal from './RejectPRModal';
import CollapsibleActivityTimeline from '../common/CollapsibleActivityTimeline';
import { sanitizeExternalUrl, getProductUrl } from '../../utils/urlHelper';

export default function PRDetailsModal({ selectedPR: initialPR, currentRole, onClose, onRefresh, onSelectPO, onEditPR }) {
  const context = useAppContext();
  const allPRs = context?.prs || storageService.getPRs() || [];
  const selectedPR = allPRs.find(p => p.id === initialPR?.id || p.prNo === initialPR?.prNo) || initialPR;
  const [actionNote, setActionNote] = useState('');
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState(null);

  // Reject / Revision Modal State (Decoupled from footer)
  const [showRejectModal, setShowRejectModal] = useState(false);

  const handleConfirmRevision = async (reason) => {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      modalService.warning('กรุณาระบุเหตุผลการส่งกลับแก้ไข');
      return;
    }

    try {
      if (context?.rejectPR) {
        await context.rejectPR(selectedPR.id, trimmedReason);
      } else {
        await apiService.rejectPR(selectedPR.id, currentRole, trimmedReason);
      }
      modalService.success('ส่งกลับเรียบร้อย', `ส่งกลับใบขอซื้อ ${selectedPR.prNo} เพื่อแก้ไขแล้ว`);
      setShowRejectModal(false);
      setActionNote('');
      onClose();
      if (onRefresh) onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
      throw err;
    }
  };
  
  // Approver Item Editing State
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItems, setEditItems] = useState(() => (selectedPR.items || []).map(it => ({ ...it })));
  const [editReason, setEditReason] = useState('');
  const [isSavingItems, setIsSavingItems] = useState(false);

  const canApproverEdit = currentRole.level >= 2 && ['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(selectedPR.status);

  const handleItemFieldChange = (index, field, value) => {
    setEditItems(prev => {
      const next = [...prev];
      const target = { ...next[index] };
      if (field === 'qty') {
        const pQty = Number(value) || 1;
        const rate = Number(target.conversionRate) > 0 ? Number(target.conversionRate) : 1;
        target.purchaseQty = pQty;
        target.qty = pQty;
        target.stockQty = pQty * rate;
        target.total = pQty * (Number(target.price) || 0);
      } else if (field === 'price') {
        const price = Number(value) || 0;
        const pQty = Number(target.purchaseQty ?? target.qty) || 1;
        target.price = price;
        target.total = pQty * price;
      } else if (field === 'conversionRate') {
        const rate = Number(value) > 0 ? Number(value) : 1;
        const pQty = Number(target.purchaseQty ?? target.qty) || 1;
        target.conversionRate = rate;
        target.stockQty = pQty * rate;
      } else if (field === 'purchaseUnit') {
        target.purchaseUnit = value;
      }
      next[index] = target;
      return next;
    });
  };

  const handleSaveItemsEdit = async () => {
    if (!editReason.trim()) {
      modalService.warning('กรุณาระบุเหตุผลการแก้ไขรายการสินค้า');
      return;
    }
    setIsSavingItems(true);
    try {
      // Data Integrity Guard: Ensure master unit conversion and units are locked from original PR items
      const originalItemsMap = new Map((selectedPR.items || []).map(it => [it.id || it.code || it.name, it]));
      const sanitizedItems = editItems.map(item => {
        const orig = originalItemsMap.get(item.id || item.code || item.name);
        const originalRate = Number(orig?.conversionRate ?? item.conversionRate) > 0 ? Number(orig?.conversionRate ?? item.conversionRate) : 1;
        const pQty = Number(item.purchaseQty ?? item.qty) || 1;
        const price = Number(item.price) || 0;
        return {
          ...item,
          purchaseUnit: orig?.purchaseUnit || orig?.unit || item.purchaseUnit || item.unit || 'ชิ้น',
          stockUnit: orig?.stockUnit || orig?.unit || item.stockUnit || item.unit || 'ชิ้น',
          conversionRate: originalRate,
          purchaseQty: pQty,
          qty: pQty,
          stockQty: pQty * originalRate,
          price: price,
          total: pQty * price
        };
      });

      await apiService.editPRItems(selectedPR.id, sanitizedItems, currentRole, editReason.trim());
      setIsEditingItems(false);
      setEditReason('');
      onRefresh();
      modalService.success('บันทึกสำเร็จ', 'บันทึกการแก้ไขรายการสินค้าเรียบร้อย');
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
    } finally {
      setIsSavingItems(false);
    }
  };

  const handleWorkflowAction = async ({ actionText, nextStatus, isSubmit = false }) => {
    // State Machine Guard: Only allow approving / PO issuance if PR has passed review (status is REVIEWED)
    if (nextStatus === 'APPROVED') {
      const statusNorm = String(selectedPR.status || '').toLowerCase();
      if (statusNorm !== 'reviewed') {
        modalService.error('ไม่อนุญาตให้ออกใบสั่งซื้อ (PO)', `ใบขอซื้อเลขที่ ${selectedPR.prNo} อยู่ในสถานะ "${selectedPR.status}" ซึ่งยังไม่ผ่านการตรวจทาน (ต้องผ่านการตรวจทานเป็นสถานะ REVIEWED ก่อนเท่านั้น จึงจะสามารถอนุมัติและออก PO ได้)`);
        return;
      }
    }

    const confirmed = await modalService.confirm({
      title: 'ยืนยันการดำเนินการ',
      message: `ต้องการดำเนินการ "${actionText}" สำหรับใบขอซื้อเลขที่ ${selectedPR.prNo} หรือไม่?`,
      confirmText: 'ยืนยันดำเนินการ',
      cancelText: 'ยกเลิก',
      type: 'info'
    });
    if (!confirmed) return;

    try {
      if (isSubmit) {
        await apiService.submitPR(selectedPR.id, currentRole);
        modalService.success('ส่งใบขอซื้อสำเร็จ', `ใบขอซื้อ ${selectedPR.prNo} ถูกส่งเข้าสู่ระบบแล้ว`);
      } else if (nextStatus === 'REVIEWED' && context?.reviewPR) {
        await context.reviewPR(selectedPR.id, actionNote);
        modalService.success('ดำเนินการสำเร็จ', `อัปเดตสถานะใบขอซื้อ ${selectedPR.prNo} เรียบร้อยแล้ว`);
      } else if (nextStatus === 'APPROVED' && context?.approvePR) {
        await context.approvePR(selectedPR.id, actionNote);
        modalService.success('ดำเนินการสำเร็จ', `อัปเดตสถานะใบขอซื้อ ${selectedPR.prNo} เรียบร้อยแล้ว`);
      } else {
        await apiService.updatePRStatus(selectedPR.id, nextStatus, currentRole, actionNote);
        modalService.success('ดำเนินการสำเร็จ', `อัปเดตสถานะใบขอซื้อ ${selectedPR.prNo} เรียบร้อยแล้ว`);
      }
      setActionNote('');
      onClose();
      if (onRefresh) onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
    }
  };

  const handleCancelPR = async () => {
    const reason = await modalService.prompt({
      title: 'ยกเลิกใบขอซื้อ (PR)',
      message: `กรุณาระบุเหตุผลในการยกเลิกใบขอซื้อเลขที่ ${selectedPR.prNo}:`,
      placeholder: 'ระบุเหตุผลในการยกเลิก...',
      required: true,
      confirmText: 'ยืนยันยกเลิก PR',
      cancelText: 'ปิด',
      type: 'danger'
    });
    if (!reason || !reason.trim()) return;

    setIsCancelling(true);
    try {
      await apiService.cancelPR(selectedPR.id, currentRole, reason.trim());
      await modalService.success('ยกเลิกสำเร็จ', `ยกเลิกใบขอซื้อ ${selectedPR.prNo} เรียบร้อยแล้ว`);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการยกเลิก', err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const displayedItems = isEditingItems ? editItems : (selectedPR.items || []);
  const calculatedTotal = displayedItems.reduce((sum, it) => sum + (Number(it.total) || ((Number(it.purchaseQty ?? it.qty) || 1) * (Number(it.price) || 0))), 0);

  // State Guard: PR must be approved or in PO-linked state to consider related POs
  const isPRApproved = ['approved', 'ordered', 'completed', 'closed', 'po_issued', 'in_progress_online'].includes(selectedPR.status?.toLowerCase());

  const relatedPOs = React.useMemo(() => {
    if (!isPRApproved) return [];
    return (storageService.getPOs() || []).filter(po => 
      (po.prId && (po.prId === selectedPR.id || po.prId === selectedPR.prNo)) ||
      (po.prNo && (po.prNo === selectedPR.prNo || po.prNo === selectedPR.id)) ||
      (po.prNumber && (po.prNumber === selectedPR.id || po.prNumber === selectedPR.prNo)) ||
      (selectedPR.poId && (po.id === selectedPR.poId || po.poNo === selectedPR.poId)) ||
      (selectedPR.poNumber && (po.poNo === selectedPR.poNumber || po.poNumber === selectedPR.poNumber))
    );
  }, [selectedPR, isPRApproved]);

  const isPRCancellable = workflowEngine.canCancelPR(currentRole, selectedPR);
  const statusInfo = PR_STATUS[selectedPR.status] || { label: selectedPR.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  const isOverBudget = apiService.isOverBudget(selectedPR.department, calculatedTotal);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
      <div className="w-full max-w-5xl xl:max-w-6xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
        
        {/* ── 1. Fixed Header (Sticky Top / Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-100/90 bg-white/95 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center justify-between gap-4">
            {/* Left: PR No + Status Badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-950">
                {selectedPR.prNo}
              </span>
              
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${statusInfo.color}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                {statusInfo.label}
              </span>
            </div>

            {/* Right: Hero Metric จิ๋ว + Close button */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex flex-col items-end px-3.5 py-1.5 rounded-xl bg-slate-900 text-white shadow-sm shrink-0">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">ยอดเงินสุทธิ</span>
                <span className="font-mono font-black text-sm text-emerald-400 tabular-nums whitespace-nowrap">
                  ฿{Number(selectedPR.financials?.grandTotal || calculatedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <button 
                onClick={onClose} 
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer shrink-0" 
                title="ปิดหน้าต่าง (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Over-Budget Alert Callout Banner (เมื่อติดเงื่อนไขเกินงบ) */}
          {isOverBudget && (
            <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-3 text-xs text-rose-900 flex items-center gap-2 mt-3 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-bold">คำเตือนงบประมาณ:</span> ยอดคำขอซื้อนี้เกินกรอบงบประมาณคงเหลือของแผนก ({selectedPR.department}) ระบบจะส่งต่อเพื่อพิจารณาอนุมัติแบบ Over Budget
              </div>
            </div>
          )}
        </div>

        {/* ── 2-Column Split Content Architecture ── */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 custom-scrollbar bg-slate-50/40">
          
          {/* Rejection Alert Banner (When PR has been rejected) */}
          {(selectedPR.status === 'REJECTED_TO_DRAFT' || selectedPR.status === 'REJECTED_TO_L2' || selectedPR.rejectReason) && (
            <div className="bg-rose-50/90 border border-rose-200/90 rounded-2xl p-4 flex items-start gap-3 shadow-2xs mb-4">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-rose-950">
                  ใบขอซื้อถูกส่งกลับเพื่อแก้ไข (Revision Required)
                </h4>
                <p className="text-xs text-rose-900 mt-1 bg-white/90 p-3 rounded-xl border border-rose-200/60 font-medium leading-relaxed">
                  {selectedPR.rejectReason || 'กรุณาตรวจสอบรายละเอียดและแก้ไขตามที่ได้รับแจ้งก่อนส่งอีกครั้ง'}
                </p>
              </div>
            </div>
          )}

          {/* Linked PO Banner - แสดงเฉพาะเมื่อ PR ผ่านการอนุมัติแล้วเท่านั้น */}
          {relatedPOs.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs mb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-indigo-950">
                    ออกใบสั่งซื้อ (PO) เรียบร้อยแล้ว {relatedPOs.length} ฉบับ: {relatedPOs.map(p => `${p.poNo || p.id} (${p.vendorName || 'ไม่ระบุผู้ขาย'})`).join(', ')}
                  </h4>
                  {relatedPOs.length > 1 && (
                    <p className="text-xs text-indigo-700/80 mt-0.5">
                      รายการสินค้าถูกแยกตาม Supplier ของแต่ละรายการโดยอัตโนมัติ
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {relatedPOs.map(po => (
                      <button
                        key={po.id || po.poNo}
                        type="button"
                        onClick={() => {
                          if (onSelectPO) onSelectPO(po);
                          else setShowSplitModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 text-[11px] font-mono font-semibold hover:bg-indigo-100/60 shadow-2xs transition-all cursor-pointer"
                      >
                        <span>{po.poNo || po.id}</span>
                        <span className="text-[10px] text-indigo-500 font-sans font-normal">
                          ({po.vendorName || 'ไม่ระบุ'})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSplitModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3.5 py-2 rounded-xl font-medium shadow-xs transition-all cursor-pointer whitespace-nowrap self-end sm:self-center flex items-center gap-1.5"
              >
                <span>ดูรายละเอียด PO {relatedPOs.length > 1 ? `(${relatedPOs.length} ใบ)` : ''}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Grid Layout 2-Column (col-span-7 / col-span-5) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* ── คอลัมน์ซ้าย (Main Detail - col-span-7): รายการสินค้า & ยอดรวม ── */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* รายการสินค้า Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-50/90 px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-700" />
                    <span>รายการสินค้าที่ขอซื้อ</span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full font-mono">({displayedItems.length})</span>
                  </span>

                  {canApproverEdit && (
                    <div>
                      {!isEditingItems ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems((selectedPR.items || []).map(it => ({ ...it })));
                            setIsEditingItems(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>แก้ไขจำนวน/ราคา</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems((selectedPR.items || []).map(it => ({ ...it })));
                            setIsEditingItems(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>ยกเลิกการแก้ไข</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Approver Editing Reason Input Bar */}
                {isEditingItems && (
                  <div className="bg-amber-50/90 p-3.5 border-b border-amber-200 flex flex-col sm:flex-row items-center gap-2.5">
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        placeholder="ระบุเหตุผลที่ปรับแก้จำนวน/ราคา (เช่น ปรับลดตามงบ หรือ ต่อรองราคาได้)... *"
                        value={editReason}
                        onChange={e => setEditReason(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-lg px-3.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSavingItems}
                      onClick={handleSaveItemsEdit}
                      className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingItems ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
                    </button>
                  </div>
                )}

                <div className="w-full overflow-hidden">
                  <table className="w-full text-left text-xs table-fixed">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-2 w-[6%] text-center text-xs text-slate-400">#</th>
                        <th className="py-2.5 px-2 w-[48%] text-left">รายการ & สเปก</th>
                        <th className="py-2.5 px-2 w-[14%] text-right font-mono text-xs whitespace-nowrap">จำนวน</th>
                        <th className="py-2.5 px-2 w-[16%] text-right font-mono text-xs whitespace-nowrap">ราคา/หน่วย</th>
                        <th className="py-2.5 px-2 w-[16%] text-right font-mono text-xs font-bold text-slate-900 pr-3 whitespace-nowrap">รวม (฿)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedItems.map((item, idx) => {
                        const pQty = item.purchaseQty ?? item.qty;
                        const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                        const sUnit = item.stockUnit || item.unit || pUnit;
                        const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
                        const sQty = item.stockQty ?? (pQty * rate);

                        return (
                          <tr key={idx} className={`hover:bg-slate-50/70 transition-colors ${isEditingItems ? 'bg-amber-50/20 hover:bg-amber-50/50' : ''}`}>
                            <td className="py-2.5 px-2 w-[6%] text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-2 w-[48%] text-left">
                              <div className="flex flex-col gap-1 items-start text-left w-full">
                                {/* แถวบนสุด (Eyebrow Row): รหัสสินค้า + ลิงก์สินค้า */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(item.code || item.sku) && (
                                    <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 shrink-0">
                                      {item.code || item.sku}
                                    </span>
                                  )}
                                  {(() => {
                                    const rawUrl = getProductUrl(item);
                                    if (!rawUrl) return null;
                                    return (
                                      <a
                                        href={sanitizeExternalUrl(rawUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/60 transition-all shadow-2xs group"
                                      >
                                        <span>ดูร้านค้าออนไลน์</span>
                                        <ExternalLink className="w-3 h-3 text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                      </a>
                                    );
                                  })()}
                                </div>

                                {/* แถวกลาง (Main Title): แสดงชื่อสินค้าเต็มความกว้าง 100% */}
                                <div className="font-semibold text-slate-900 text-xs sm:text-sm leading-snug break-words w-full" title={item.name}>
                                  {item.name}
                                </div>

                                {/* แถวล่าง (Unit Meta): ชิปอัตราแปลงหน่วย */}
                                {rate > 1 && (
                                  <div className="mt-0.5">
                                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-md inline-block border border-slate-200/60">
                                      1 {pUnit} = {rate} {sUnit}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 w-[14%] text-right font-mono text-xs whitespace-nowrap">
                              {isEditingItems ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.001"
                                    value={item.purchaseQty ?? item.qty}
                                    onChange={e => handleItemFieldChange(idx, 'qty', e.target.value)}
                                    className="w-16 border border-amber-300 rounded p-1 text-center font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500 font-mono"
                                  />
                                  <span className="text-[11px] text-slate-600 font-semibold">{pUnit}</span>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-bold text-slate-900 font-mono text-xs sm:text-sm">{Number(pQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>{' '}
                                  <span className="text-slate-500 text-[11px] font-medium">{pUnit}</span>
                                  {rate > 1 && (
                                    <div className="text-[10px] text-slate-400 font-mono font-normal">
                                      (= {Number(sQty).toLocaleString()} {sUnit})
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 w-[16%] text-right font-mono text-xs whitespace-nowrap">
                              {isEditingItems ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.price}
                                  onChange={e => handleItemFieldChange(idx, 'price', e.target.value)}
                                  className="w-20 border border-amber-300 rounded p-1 text-right font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500 font-mono"
                                />
                              ) : (
                                <span className="font-mono font-semibold text-slate-700 text-xs sm:text-sm">฿{Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 w-[16%] text-right font-mono text-xs font-bold text-slate-900 pr-3 whitespace-nowrap tabular-nums">
                              ฿{(Number(item.total) || ((Number(item.purchaseQty ?? item.qty) || 1) * (Number(item.price) || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Clean Financial Summary Strip (Linear / Stripe Vibe) */}
                <div className="bg-slate-50/80 border-t border-slate-200/80 p-4 rounded-b-2xl flex flex-col gap-1.5 text-xs">
                  {selectedPR.financials ? (
                    <>
                      <div className="flex justify-between items-center text-slate-500 font-medium">
                        <span>ยอดรวมสินค้า (Subtotal)</span>
                        <span className="font-mono font-semibold text-slate-800 tabular-nums">฿{Number(selectedPR.financials.subtotal || calculatedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {selectedPR.financials.totalDiscount > 0 && (
                        <div className="flex justify-between items-center text-rose-600 font-medium">
                          <span>ส่วนลดรวม</span>
                          <span className="font-mono font-semibold tabular-nums">-฿{Number(selectedPR.financials.totalDiscount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {selectedPR.financials.vatAmount > 0 && (
                        <div className="flex justify-between items-center text-slate-500 font-medium">
                          <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                          <span className="font-mono font-semibold text-slate-800 tabular-nums">+฿{Number(selectedPR.financials.vatAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {parseFloat(selectedPR.financials.roundingAdj || 0) !== 0 && (
                        <div className="flex justify-between items-center text-amber-700 font-medium">
                          <span>ปรับเศษทศนิยม</span>
                          <span className="font-mono font-semibold tabular-nums">{parseFloat(selectedPR.financials.roundingAdj) > 0 ? `+฿${parseFloat(selectedPR.financials.roundingAdj).toFixed(2)}` : `-฿${Math.abs(parseFloat(selectedPR.financials.roundingAdj)).toFixed(2)}`}</span>
                        </div>
                      )}
                      <div className="pt-2.5 mt-1 border-t border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">GRAND TOTAL</span>
                          {selectedPR.financials.vatAmount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">รวม VAT</span>
                          )}
                        </div>
                        <span className="font-mono text-xl font-bold text-slate-900 tracking-tight tabular-nums">
                          ฿{Number(selectedPR.financials.grandTotal || calculatedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">GRAND TOTAL</span>
                      <span className="font-mono text-xl font-bold text-slate-900 tracking-tight tabular-nums">
                        ฿{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* MEMO Section (if exists) */}
              <MEMODetailsSection 
                memo={selectedPR.memo} 
                onViewAttachment={(att) => setViewingAttachment(att)}
              />
            </div>

            {/* ── คอลัมน์ขวา (Context & Activity Rail - col-span-5) ── */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Context Bento Box: Clean Minimal Key-Value Pairs */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3.5">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>ข้อมูลคำขอซื้อ (Request Details)</span>
                </span>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">ผู้ขอซื้อ</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">
                      {selectedPR.requestedBy}
                    </p>
                    <span className="text-slate-400 font-mono text-[11px] block">
                      ฝ่าย {selectedPR.department}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">วันที่ขอซื้อ</span>
                    <p className="text-xs font-semibold text-slate-800 font-mono mt-0.5 truncate">
                      {selectedPR.requestedDate || selectedPR.createdAt || '-'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">ช่องทางจัดซื้อ</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">
                      {selectedPR.purchaseChannel === 'ONLINE' ? 'สั่งซื้อออนไลน์' : 'จัดซื้อเอง'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">สถานที่ใช้งาน</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">
                      {selectedPR.source === 'FACTORY' || !selectedPR.source || selectedPR.source === 'PD' ? 'โรงงาน (Factory)' : (selectedPR.source === 'OFFICE' ? 'สำนักงาน (Office)' : selectedPR.source)}
                    </p>
                  </div>

                  {selectedPR.purchaseChannel !== 'ONLINE' && (selectedPR.vendorName || selectedPR.vendor?.name) && (
                    <div className="col-span-2 pt-1 border-t border-slate-100">
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">ผู้จัดจำหน่าย (Vendor)</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                        {selectedPR.vendorName || selectedPR.vendor?.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* เหตุผลการขอซื้อ */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>เหตุผล / วัตถุประสงค์</span>
                </span>
                {selectedPR.note || selectedPR.remarks ? (
                  <p className="text-slate-800 text-xs font-medium leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    {selectedPR.note || selectedPR.remarks}
                  </p>
                ) : (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-400 text-xs italic border border-slate-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span>ไม่ระบุเหตุผลประกอบ</span>
                  </div>
                )}
              </div>

              {/* ไฟล์แนบ & เอกสารอ้างอิง */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  <span>ไฟล์แนบ & เอกสารอ้างอิง</span>
                </span>
                <div>
                  {selectedPR.attachments && selectedPR.attachments.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedPR.attachments.map((att, attIdx) => (
                        <button
                          key={attIdx}
                          type="button"
                          onClick={() => setViewingAttachment({ file: att, title: att.name, url: att.previewUrl })}
                          className="w-full text-left flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 p-2 rounded-xl transition-all group cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
                            <ExternalLink className="w-3 h-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs text-slate-800 group-hover:text-slate-950 truncate">{att.name}</p>
                            <p className="text-[10px] text-slate-400">{att.category || 'เอกสารแนบ'} • เปิดดู</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : selectedPR.specUrl ? (
                    <button
                      type="button"
                      onClick={() => setViewingAttachment({ url: selectedPR.specUrl, title: 'เอกสารอ้างอิง / ลิงก์สินค้า' })}
                      className="w-full text-left flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 p-2 rounded-xl transition-colors group cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
                        <ExternalLink className="w-3 h-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-slate-900 truncate">ดูเอกสารประกอบ / ลิงก์สินค้า</p>
                        <p className="text-[10px] text-slate-400 truncate">{selectedPR.specUrl}</p>
                      </div>
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-400 text-xs italic border border-slate-100 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                      <span>ไม่มีไฟล์แนบ</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Log Timeline (Collapsible & Compact) */}
              <CollapsibleActivityTimeline
                events={selectedPR.activityLog || []}
                title="ลำดับเหตุการณ์ (Activity Timeline)"
                defaultExpanded={Boolean(selectedPR.activityLog && selectedPR.activityLog.length < 2)}
              />

            </div>

          </div>

        </div>

        {/* ── 5. Unified Command Footer Dock ── */}
        <div className="shrink-0 border-t border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 rounded-b-3xl flex flex-col gap-3.5 sticky bottom-0 z-20 backdrop-blur-md">
          {/* Consolidated Action Dock */}
          <div className="space-y-3">
            {/* Elastic Multi-line Textarea (Shown for Approvers/Reviewers when actionable) */}
            {(['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(selectedPR.status)) && 
             (workflowEngine.canAction(currentRole, selectedPR)) && (
              <div className="space-y-2">
                {/* Header เล็กเหนือน่องพิมพ์ */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span>บันทึกช่วยจำ / ข้อความถึงผู้อนุมัติ (ไม่บังคับ)</span>
                  </span>
                  <kbd className="text-[10px] bg-slate-200/60 px-1.5 py-0.5 rounded text-slate-600 font-mono hidden sm:inline-block">
                    ⌘ + Enter เพื่อตรวจผ่าน
                  </kbd>
                </div>

                {/* Multi-line Textarea */}
                <div className="relative">
                  <textarea 
                    rows={2}
                    placeholder="ระบุบันทึกช่วยจำ หรือข้อความประกอบการตรวจผ่าน..." 
                    className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none shadow-xs min-h-[68px]"
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedPR.status === 'REVIEWED') {
                          handleWorkflowAction({ actionText: 'อนุมัติสั่งซื้อและสร้าง PO', nextStatus: 'APPROVED' });
                        } else {
                          handleWorkflowAction({ actionText: 'ตรวจสอบและส่งต่อให้ Plant Manager', nextStatus: 'REVIEWED' });
                        }
                      }
                    }}
                  />
                </div>

                {/* Quick Preset Chips (ชิปพิมพ์ด่วน) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: '✓ สเปกถูกต้อง', text: 'สเปกถูกต้อง' },
                    { label: '⚡ ใช้งานเร่งด่วน', text: 'ใช้งานเร่งด่วน' },
                    { label: '📊 ยืนยันราคาเดิม', text: 'ยืนยันราคาเดิม' }
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        if (!actionNote.trim()) {
                          setActionNote(chip.text);
                        } else if (!actionNote.includes(chip.text)) {
                          setActionNote(prev => `${prev.trim()} / ${chip.text}`);
                        }
                      }}
                      className="text-[11px] font-medium text-slate-600 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 px-2.5 py-1 rounded-full cursor-pointer transition-all shadow-2xs"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons Strip */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              
              {/* ฝั่งซ้าย: ปุ่ม "ยกเลิกคำขอ" สไตล์ Ghost Red (แสดงเฉพาะผู้มีสิทธิ์) */}
              <div>
                {isPRCancellable && (
                  <button 
                    type="button"
                    onClick={handleCancelPR}
                    disabled={isCancelling}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิกคำขอ'}</span>
                  </button>
                )}
              </div>

              {/* ฝั่งขวา: Action Group มีลำดับชั้นความสำคัญชัดเจน */}
              <div className="flex items-center gap-2.5 ml-auto">
                
                {/* Requester Actions (Draft / Rejected to Draft) */}
                {(selectedPR.status === 'DRAFT' || selectedPR.status === 'REJECTED_TO_DRAFT') && 
                 (workflowEngine.canAction(currentRole, selectedPR)) && (
                  <>
                    {onEditPR && (
                      <button 
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditPR(selectedPR);
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300/80"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-600" />
                        <span>แก้ไขใบขอซื้อ</span>
                      </button>
                    )}
                    <button 
                      onClick={() => handleWorkflowAction({ actionText: 'ส่งใบ PR เข้าสู่ระบบ', nextStatus: null, isSubmit: true })}
                      className="bg-slate-950 hover:bg-slate-900 text-white rounded-xl px-5 py-2.5 font-semibold text-xs shadow-lg shadow-slate-950/20 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>ส่งใบขอซื้อ (Submit PR)</span>
                    </button>
                  </>
                )}

                {/* Asst. Manager Actions (Level 1 Review) */}
                {(selectedPR.status === 'SUBMITTED' || selectedPR.status === 'REJECTED_TO_L2') && 
                 (workflowEngine.canAction(currentRole, selectedPR)) && (
                  <>
                    {/* ปุ่มรอง: ส่งกลับแก้ไข */}
                    <button 
                      type="button"
                      onClick={() => setShowRejectModal(true)}
                      className="px-4 py-2.5 bg-rose-50/60 hover:bg-rose-100/70 text-rose-700 border border-rose-200/80 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>ส่งกลับแก้ไข (Reject)</span>
                    </button>

                    {/* ปุ่มหลัก: ตรวจสอบผ่าน */}
                    <button 
                      onClick={() => handleWorkflowAction({ actionText: 'ตรวจสอบและส่งต่อให้ Plant Manager', nextStatus: 'REVIEWED' })}
                      className="bg-slate-950 hover:bg-slate-900 text-white rounded-xl px-5 py-2.5 font-semibold text-xs shadow-lg shadow-slate-950/20 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>ตรวจสอบผ่าน (ส่งต่อ Plant Mgr)</span>
                    </button>
                  </>
                )}

                {/* Plant Manager Actions (Final Approval) */}
                {selectedPR.status === 'REVIEWED' && 
                 (workflowEngine.canAction(currentRole, selectedPR)) && (
                  <>
                    {/* ปุ่มรอง: ส่งกลับแก้ไข */}
                    <button 
                      type="button"
                      onClick={() => setShowRejectModal(true)}
                      className="px-4 py-2.5 bg-rose-50/60 hover:bg-rose-100/70 text-rose-700 border border-rose-200/80 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="ส่งกลับให้ผู้ขอซื้อแก้ไข"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>ส่งกลับแก้ไข (Reject)</span>
                    </button>

                    {/* ปุ่มหลัก: อนุมัติสั่งซื้อ */}
                    <button 
                      onClick={() => handleWorkflowAction({ actionText: 'อนุมัติสั่งซื้อและสร้าง PO', nextStatus: 'APPROVED' })}
                      className="bg-slate-950 hover:bg-slate-900 text-white rounded-xl px-5 py-2.5 font-semibold text-xs shadow-lg shadow-slate-950/20 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>อนุมัติสั่งซื้อ (Approve & ออก PO)</span>
                    </button>
                  </>
                )}

              </div>
            </div>
          </div>
        </div>

      </div>

      {/* RejectPRModal */}
      {showRejectModal && (
        <RejectPRModal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          onConfirm={handleConfirmRevision}
          initialReason={actionNote.trim()}
          pr={selectedPR}
        />
      )}

      {/* POSplitModal */}
      {showSplitModal && (
        <POSplitModal 
          pr={selectedPR}
          pos={relatedPOs}
          onClose={() => setShowSplitModal(false)}
          onSelectPO={onSelectPO}
        />
      )}

      {/* AttachmentViewerModal */}
      {viewingAttachment && (
        <AttachmentViewerModal
          file={viewingAttachment.file}
          url={viewingAttachment.url}
          title={viewingAttachment.title}
          onClose={() => setViewingAttachment(null)}
        />
      )}
    </div>,
    document.body
  );
}
