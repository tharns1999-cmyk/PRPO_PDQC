import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PR_STATUS } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { workflowEngine } from '../../services/workflowEngine';
import { 
  ExternalLink, History, ShieldCheck, CheckCircle2, XCircle, 
  Trash2, Send, Edit3, Save, RotateCcw, AlertTriangle, Layers, 
  Clock, X, Building2, User, Calendar, FileText, ShoppingCart, 
  DollarSign, Check, ChevronRight, MessageSquare, Info
} from 'lucide-react';
import MEMODetailsSection from './MEMODetailsSection';
import ElectronicSignatureModal from './ElectronicSignatureModal';
import POSplitModal from '../po/POSplitModal';
import AttachmentViewerModal from '../common/AttachmentViewerModal';

export default function PRDetailsModal({ selectedPR: initialPR, currentRole, onClose, onRefresh, onSelectPO }) {
  const selectedPR = (storageService.getPRs() || []).find(p => p.id === initialPR?.id || p.prNo === initialPR?.prNo) || initialPR;
  const [actionNote, setActionNote] = useState('');
  const [sigModalConfig, setSigModalConfig] = useState(null); // { actionText, nextStatus, isSubmit, isReject }
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState(null);
  
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
      alert('กรุณาระบุเหตุผลการแก้ไขรายการสินค้า');
      return;
    }
    setIsSavingItems(true);
    try {
      await apiService.editPRItems(selectedPR.id, editItems, currentRole, editReason.trim());
      setIsEditingItems(false);
      setEditReason('');
      onRefresh();
      alert('บันทึกการแก้ไขรายการสินค้าเรียบร้อย');
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSavingItems(false);
    }
  };

  const executeAction = async () => {
    if (!sigModalConfig) return;
    try {
      if (sigModalConfig.isReject) {
        await apiService.rejectPR(selectedPR.id, currentRole, actionNote);
      } else if (sigModalConfig.isSubmit) {
        await apiService.submitPR(selectedPR.id, currentRole);
      } else {
        await apiService.updatePRStatus(selectedPR.id, sigModalConfig.nextStatus, currentRole, actionNote);
      }
      setActionNote('');
      setSigModalConfig(null);
      onClose();
      onRefresh();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const requestSignature = (actionText, nextStatus, isSubmit = false, isReject = false) => {
    if (isReject && !actionNote.trim()) {
      alert('กรุณาระบุเหตุผลการปฏิเสธ / ส่งกลับ ในช่องหมายเหตุด้านล่าง');
      return;
    }
    setSigModalConfig({ actionText, nextStatus, isSubmit, isReject });
  };

  const handleCancelPR = async () => {
    const reason = prompt('กรุณาระบุเหตุผลในการยกเลิกใบขอซื้อ (PR):');
    if (!reason || !reason.trim()) return;

    setIsCancelling(true);
    try {
      await apiService.cancelPR(selectedPR.id, currentRole, reason.trim());
      alert('ยกเลิกใบขอซื้อเรียบร้อยแล้ว');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const displayedItems = isEditingItems ? editItems : (selectedPR.items || []);
  const calculatedTotal = displayedItems.reduce((sum, it) => sum + (Number(it.total) || ((Number(it.purchaseQty ?? it.qty) || 1) * (Number(it.price) || 0))), 0);

  const relatedPOs = React.useMemo(() => {
    return (storageService.getPOs() || []).filter(po => po.prId === selectedPR.id || po.prNo === selectedPR.prNo);
  }, [selectedPR]);

  const isPRCancellable = workflowEngine.canCancelPR(currentRole, selectedPR);
  const statusInfo = PR_STATUS[selectedPR.status] || { label: selectedPR.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  const isOverBudget = apiService.isOverBudget(selectedPR.department, calculatedTotal);

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[60] flex items-center justify-center p-3 sm:p-4 print:hidden animate-fade-in">
      <div className="modal-content w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col text-slate-800 animate-zoom-in">
        
        {/* ── Header (Clean Executive Ribbon) ── */}
        <div className="flex-shrink-0 border-b border-slate-100 p-5 sm:p-6 bg-slate-50/50">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900">
                  {selectedPR.prNo}
                </span>
                
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${statusInfo.color}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 animate-pulse"></span>
                  {statusInfo.label}
                </span>

                {isOverBudget && (
                  <span className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>เกินงบประมาณ (Over Budget)</span>
                  </span>
                )}
              </div>

              {/* Meta Grid Strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium pt-0.5">
                <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>ผู้ขอซื้อ: <strong>{selectedPR.requestedBy}</strong> ({selectedPR.department})</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>วันที่ขอ: <strong className="text-slate-700 font-mono">{selectedPR.requestedDate}</strong></span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  {selectedPR.purchaseChannel === 'ONLINE' ? (
                    <ShoppingCart className="w-3.5 h-3.5 text-purple-600" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>ช่องทาง: <strong className="text-slate-700">{selectedPR.purchaseChannel === 'ONLINE' ? 'สั่งซื้อออนไลน์ (Shopee/Lazada)' : 'ซื้อเอง (จัดซื้อภายใน)'}</strong></span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">ประเภท: <strong className="text-slate-700">{selectedPR.source || 'OFFICE'}</strong></span>
              </div>
            </div>

            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-700 p-2 rounded-2xl hover:bg-white hover:shadow-xs transition-all cursor-pointer shrink-0" 
              title="ปิดหน้าต่าง (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Content Body (Scrollable) ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar bg-slate-50/30">
          
          {/* Split PO Banner */}
          {relatedPOs.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50/60 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                    ออกใบสั่งซื้อ (PO) เรียบร้อยแล้ว {relatedPOs.length} ฉบับ
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {relatedPOs.length > 1
                      ? 'รายการสินค้าถูกแยกตาม Supplier ของแต่ละรายการโดยอัตโนมัติ'
                      : `เลขที่ใบสั่งซื้อ: ${relatedPOs[0]?.poNo} (${relatedPOs[0]?.vendorName})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSplitModal(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap self-end sm:self-center"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>ดูรายละเอียด PO {relatedPOs.length > 1 ? `(${relatedPOs.length} ใบ)` : ''}</span>
              </button>
            </div>
          )}

          {/* Rejection Notice Banner */}
          {(selectedPR.status === 'REJECTED_TO_L2' || selectedPR.status === 'REJECTED_TO_DRAFT') && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs">
                  {selectedPR.status === 'REJECTED_TO_L2' ? 'เอกสารถูกส่งกลับจาก Level 3 มาให้ Level 2 ตรวจสอบใหม่' : 'เอกสารถูกตีกลับมายังผู้ขอซื้อ (ร่างเอกสาร)'}
                </h4>
                <p className="text-amber-800/90 mt-0.5">
                  กรุณาตรวจสอบประวัติด้านล่าง หรือแก้ไขรายการสินค้า/ข้อมูล และส่งพิจารณาใหม่อีกครั้ง
                </p>
              </div>
            </div>
          )}

          {/* Reason & Attachments Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Reason (7 cols) */}
            <div className="md:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>เหตุผล / วัตถุประสงค์การขอซื้อ</span>
              </span>
              <p className="text-slate-800 text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap pl-1">
                {selectedPR.note || selectedPR.remarks || '- ไม่มีระบุ -'}
              </p>
            </div>

            {/* Attachments (5 cols) */}
            <div className="md:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                <span>เอกสารอ้างอิง (Attachments)</span>
              </span>
              <div className="space-y-2 pt-1 flex-1 flex flex-col justify-center">
                {selectedPR.attachments && selectedPR.attachments.length > 0 ? (
                  selectedPR.attachments.map((att, attIdx) => (
                    <button
                      key={attIdx}
                      type="button"
                      onClick={() => setViewingAttachment({ file: att, title: att.name, url: att.previewUrl })}
                      className="w-full text-left flex items-center gap-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 p-2.5 rounded-xl transition-all group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-800 group-hover:text-indigo-700 truncate">{att.name}</p>
                        <p className="text-[10px] text-slate-400">{att.category || 'เอกสารแนบ'} • คลิกเพื่อเปิดดู</p>
                      </div>
                    </button>
                  ))
                ) : selectedPR.specUrl ? (
                  <button
                    type="button"
                    onClick={() => setViewingAttachment({ url: selectedPR.specUrl, title: 'เอกสารอ้างอิง / ลิงก์สินค้า' })}
                    className="w-full text-left flex items-center gap-2.5 bg-indigo-50/60 hover:bg-indigo-100/60 border border-indigo-100 p-2.5 rounded-xl transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-indigo-900 group-hover:text-indigo-700">ดูเอกสารประกอบ / ลิงก์สินค้า</p>
                      <p className="text-[10px] text-indigo-600/70 truncate max-w-[220px]">{selectedPR.specUrl}</p>
                    </div>
                  </button>
                ) : (
                  <div className="text-center py-3 text-xs text-slate-400 font-medium bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                    - ไม่มีไฟล์แนบ -
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Items Table Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50/70 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>รายการสินค้า</span>
                <span className="text-xs font-semibold text-slate-500">({displayedItems.length} รายการ)</span>
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไขจำนวน/ราคาก่อนอนุมัติ</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditItems((selectedPR.items || []).map(it => ({ ...it })));
                        setIsEditingItems(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all cursor-pointer"
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
              <div className="bg-amber-50/80 p-3.5 border-b border-amber-200 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    placeholder="ระบุเหตุผลที่ปรับแก้จำนวน/ราคา (เช่น ปรับลดตามงบ หรือ ต่อรองราคาได้)... *"
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={isSavingItems}
                  onClick={handleSaveItemsEdit}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingItems ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/60 text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-3 pl-4">รหัสสินค้า</th>
                    <th className="p-3">ชื่อสินค้า / สเปก</th>
                    <th className="p-3 text-center">จำนวนขอซื้อ</th>
                    <th className="p-3 text-right">ราคา/หน่วย (฿)</th>
                    <th className="p-3 text-right pr-4">รวมเงิน (฿)</th>
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
                      <tr key={idx} className={`hover:bg-slate-50/60 transition-colors ${isEditingItems ? 'bg-amber-50/20' : ''}`}>
                        <td className="p-3 pl-4 font-mono font-bold text-slate-500 text-[11px]">{item.code || '-'}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800 text-xs">{item.name}</div>
                          {isEditingItems ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-800 font-mono mt-1 bg-amber-50 p-1 rounded border border-amber-200 w-fit">
                              <span>1</span>
                              <input
                                type="text"
                                value={item.purchaseUnit || ''}
                                onChange={e => handleItemFieldChange(idx, 'purchaseUnit', e.target.value)}
                                placeholder="หน่วยซื้อ"
                                className="w-16 bg-white border border-amber-300 rounded px-1 py-0.5 text-center font-bold"
                              />
                              <span>=</span>
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.conversionRate ?? 1}
                                onChange={e => handleItemFieldChange(idx, 'conversionRate', e.target.value)}
                                placeholder="อัตราแปลง"
                                className="w-12 bg-white border border-amber-300 rounded px-1 py-0.5 text-center font-bold text-indigo-700"
                              />
                              <span>{sUnit}</span>
                            </div>
                          ) : (
                            rate > 1 && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">1 {pUnit} = {rate} {sUnit}</div>
                            )
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isEditingItems ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                value={item.purchaseQty ?? item.qty}
                                onChange={e => handleItemFieldChange(idx, 'qty', e.target.value)}
                                className="w-16 border border-amber-300 rounded-lg p-1 text-center font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500 font-mono"
                              />
                              <span className="text-[11px] text-slate-500 font-semibold">{pUnit}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-800 font-mono">{Number(pQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>{' '}
                              <span className="text-slate-500">{pUnit}</span>
                              {rate > 1 && (
                                <div className="text-[10px] text-indigo-600 font-mono font-medium">
                                  (= {Number(sQty).toLocaleString()} {sUnit})
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isEditingItems ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={e => handleItemFieldChange(idx, 'price', e.target.value)}
                                className="w-20 border border-amber-300 rounded-lg p-1 text-right font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500 font-mono"
                              />
                            </div>
                          ) : (
                            <span className="font-mono text-slate-700">฿{Number(item.price || 0).toLocaleString()}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 pr-4">
                          ฿{(Number(item.total) || ((Number(item.purchaseQty ?? item.qty) || 1) * (Number(item.price) || 0))).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 border-t border-slate-200">
                    <td colSpan="4" className="p-3 text-right font-bold text-slate-500 text-xs">ยอดรวมประเมินทั้งสิ้น:</td>
                    <td className="p-3 text-right font-black font-mono text-indigo-700 text-base pr-4">
                      ฿{calculatedTotal.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* MEMO Section (if exists) */}
          <MEMODetailsSection 
            memo={selectedPR.memo} 
            onViewAttachment={(att) => setViewingAttachment(att)}
          />

          {/* Activity Log Timeline */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>ประวัติการดำเนินงาน (Activity Timeline)</span>
            </span>

            <div className="relative pl-5 space-y-3 border-l-2 border-slate-100 ml-2 pt-1">
              {selectedPR.activityLog?.map((log, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow-2xs" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <span>{log.action}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                        {log.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">โดย: <span className="font-semibold text-slate-600">{log.user}</span> • {log.timestamp}</p>
                    {log.note && (
                      <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-2 rounded-xl border border-slate-100 leading-relaxed font-medium">
                        {log.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Footer Actions (Compact, Unified Action Toolbar) ── */}
        <div className="flex-shrink-0 border-t border-slate-200/90 p-4 sm:px-6 bg-white space-y-3">
          
          {/* Action note field (Only shown for Approvers/Reviewers when actionable) */}
          {(['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(selectedPR.status)) && 
           (workflowEngine.canAction(currentRole, selectedPR)) && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MessageSquare className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="ระบุความเห็น / หมายเหตุประกอบการอนุมัติ (จำเป็นต้องระบุเมื่อ Reject)..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Unified Action Button Strip */}
          <div className="flex items-center justify-between flex-wrap gap-2.5">
            
            {/* Left side: Cancel PR / Secondary Actions */}
            <div className="flex items-center gap-2">
              {isPRCancellable && (
                <button 
                  type="button"
                  onClick={handleCancelPR}
                  disabled={isCancelling}
                  className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิก PR'}</span>
                </button>
              )}
            </div>

            {/* Right side: Primary & Rejection Decision Actions */}
            <div className="flex items-center gap-2 ml-auto">
              
              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>

              {/* Requester Actions (Draft / Rejected to Draft) */}
              {(selectedPR.status === 'DRAFT' || selectedPR.status === 'REJECTED_TO_DRAFT') && 
               (workflowEngine.canAction(currentRole, selectedPR)) && (
                <button 
                  onClick={() => requestSignature('ส่งใบ PR เข้าสู่ระบบ', null, true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่งใบขอซื้อ (Submit PR)</span>
                </button>
              )}

              {/* Asst. Manager Actions (Level 1 Review) */}
              {(selectedPR.status === 'SUBMITTED' || selectedPR.status === 'REJECTED_TO_L2') && 
               (workflowEngine.canAction(currentRole, selectedPR)) && (
                <>
                  <button 
                    onClick={() => requestSignature('ปฏิเสธและส่งกลับผู้ขอซื้อ', 'REJECTED_TO_DRAFT', false, true)}
                    className="px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Reject (ส่งกลับผู้ขอซื้อ)</span>
                  </button>

                  <button 
                    onClick={() => requestSignature('ตรวจสอบและส่งต่อให้ Plant Manager', 'REVIEWED')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ตรวจสอบผ่าน (ส่งต่อ Plant Mgr)</span>
                  </button>
                </>
              )}

              {/* Plant Manager Actions (Final Approval) */}
              {selectedPR.status === 'REVIEWED' && 
               (workflowEngine.canAction(currentRole, selectedPR)) && (
                <>
                  <button 
                    onClick={() => requestSignature('ส่งกลับ Level 2 (Asst Mgr) ตรวจสอบใหม่', 'REJECTED_TO_L2', false, true)}
                    className="px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    title="ส่งกลับให้ Level 2 ตรวจทานใหม่"
                  >
                    <XCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>ส่งกลับให้แก้ไข (Reject)</span>
                  </button>

                  <button 
                    onClick={() => requestSignature('อนุมัติสั่งซื้อและสร้าง PO', 'APPROVED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>อนุมัติสั่งซื้อ (Approve & ออก PO)</span>
                  </button>
                </>
              )}

            </div>
          </div>

        </div>

      </div>

      {/* POSplitModal */}
      {showSplitModal && (
        <POSplitModal 
          pr={selectedPR}
          pos={relatedPOs}
          onClose={() => setShowSplitModal(false)}
          onSelectPO={onSelectPO}
        />
      )}

      {/* Signature Modal */}
      <ElectronicSignatureModal 
        isOpen={!!sigModalConfig}
        user={currentRole}
        actionText={sigModalConfig?.actionText}
        onConfirm={executeAction}
        onCancel={() => setSigModalConfig(null)}
      />

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
