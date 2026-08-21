import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PR_STATUS } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { workflowEngine } from '../../services/workflowEngine';
import { modalService } from '../../services/modalService';
import { 
  ExternalLink, History, ShieldCheck, CheckCircle2, XCircle, 
  Trash2, Send, Edit3, Save, RotateCcw, AlertTriangle, Layers, 
  X, Building2, User, Calendar, FileText, ShoppingCart, 
  Check, ChevronRight, MessageSquare, Info, Pencil,
  Paperclip, Globe, Tag, Factory, Building, Package
} from 'lucide-react';
import MEMODetailsSection from './MEMODetailsSection';
import ElectronicSignatureModal from './ElectronicSignatureModal';
import POSplitModal from '../po/POSplitModal';
import AttachmentViewerModal from '../common/AttachmentViewerModal';

export default function PRDetailsModal({ selectedPR: initialPR, currentRole, onClose, onRefresh, onSelectPO, onEditPR }) {
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
      modalService.warning('กรุณาระบุเหตุผลการแก้ไขรายการสินค้า');
      return;
    }
    setIsSavingItems(true);
    try {
      await apiService.editPRItems(selectedPR.id, editItems, currentRole, editReason.trim());
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
      modalService.error('เกิดข้อผิดพลาด', err.message);
    }
  };

  const requestSignature = (actionText, nextStatus, isSubmit = false, isReject = false) => {
    if (isReject && !actionNote.trim()) {
      modalService.warning('กรุณาระบุเหตุผลการปฏิเสธ / ส่งกลับ ในช่องหมายเหตุด้านล่าง');
      return;
    }
    setSigModalConfig({ actionText, nextStatus, isSubmit, isReject });
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

  const relatedPOs = React.useMemo(() => {
    return (storageService.getPOs() || []).filter(po => po.prId === selectedPR.id || po.prNo === selectedPR.prNo);
  }, [selectedPR]);

  const isPRCancellable = workflowEngine.canCancelPR(currentRole, selectedPR);
  const statusInfo = PR_STATUS[selectedPR.status] || { label: selectedPR.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  const isOverBudget = apiService.isOverBudget(selectedPR.department, calculatedTotal);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
        
        {/* ── 1. Fixed Header (Sticky Top / Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900">
              {selectedPR.prNo}
            </span>
            
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${statusInfo.color}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
              {statusInfo.label}
            </span>

            {isOverBudget && (
              <span className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>เกินงบประมาณ (Over Budget)</span>
              </span>
            )}
          </div>

          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer shrink-0" 
            title="ปิดหน้าต่าง (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-slate-50/40">
          
          {/* ── 2. Quick Meta Strip (Compact 1-Line Info Bar) ── */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3 sm:px-4 shadow-2xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-slate-400 block text-[10px]">ผู้ขอซื้อ</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {selectedPR.requestedBy} <span className="text-slate-500 font-medium font-mono">({selectedPR.department})</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-slate-400 block text-[10px]">วันที่ขอซื้อ</span>
                <span className="font-semibold text-slate-800 font-mono truncate block">
                  {selectedPR.requestedDate || selectedPR.createdAt || '-'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <Tag className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-slate-400 block text-[10px]">ช่องทาง</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {selectedPR.purchaseChannel === 'ONLINE' ? 'สั่งซื้อออนไลน์ (Online)' : 'จัดซื้อเอง (Self-buy)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              {selectedPR.source === 'FACTORY' || !selectedPR.source || selectedPR.source === 'PD' ? (
                <Factory className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <Building className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-slate-400 block text-[10px]">การใช้งาน</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {selectedPR.source === 'FACTORY' || !selectedPR.source || selectedPR.source === 'PD' ? 'โรงงาน (Factory)' : (selectedPR.source === 'OFFICE' ? 'สำนักงาน (Office)' : selectedPR.source)}
                </span>
              </div>
            </div>
          </div>

          {/* Linked PO Banner */}
          {relatedPOs.length > 0 && (
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-medium text-indigo-950">
                    ออกใบสั่งซื้อ (PO) เรียบร้อยแล้ว {relatedPOs.length} ฉบับ
                    {relatedPOs.length === 1 && `: ${relatedPOs[0]?.poNo} (${relatedPOs[0]?.vendorName})`}
                  </h4>
                  {relatedPOs.length > 1 && (
                    <p className="text-xs text-indigo-700/80 mt-0.5">
                      รายการสินค้าถูกแยกตาม Supplier ของแต่ละรายการโดยอัตโนมัติ
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSplitModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3.5 py-2 rounded-lg font-medium shadow-xs transition-all cursor-pointer whitespace-nowrap self-end sm:self-center flex items-center gap-1.5"
              >
                <span>ดูรายละเอียด PO {relatedPOs.length > 1 ? `(${relatedPOs.length} ใบ)` : ''}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Rejection Notice Banner */}
          {(selectedPR.status === 'REJECTED_TO_L2' || selectedPR.status === 'REJECTED_TO_DRAFT') && (
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs sm:text-sm shadow-2xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900">
                    {selectedPR.status === 'REJECTED_TO_L2' ? 'เอกสารถูกส่งกลับจาก Level 3 มาให้ Level 2 ตรวจสอบใหม่' : 'เอกสารถูกตีกลับมายังผู้ขอซื้อ (ร่างเอกสาร / ส่งกลับแก้ไข)'}
                  </h4>
                  <p className="text-amber-800/80 mt-0.5 text-xs leading-relaxed">
                    กรุณาตรวจสอบประวัติด้านล่าง หรือกดปุ่มแก้ไขรายการสินค้า/ข้อมูล และส่งพิจารณาใหม่อีกครั้ง
                  </p>
                </div>
              </div>
              {selectedPR.status === 'REJECTED_TO_DRAFT' && onEditPR && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditPR(selectedPR);
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap self-end sm:self-center"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>แก้ไขและส่งใหม่</span>
                </button>
              )}
            </div>
          )}

          {/* ── 3. Primary Section: Items Table (รายการสินค้าที่ขอซื้อ) ── */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-50/90 px-4 py-3.5 sm:px-5 border-b border-slate-200/80 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <span>รายการสินค้าที่ขอซื้อ</span>
                <span className="text-xs font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full font-mono">({displayedItems.length} รายการ)</span>
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
                      <span>แก้ไขจำนวน/ราคาก่อนอนุมัติ</span>
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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="pl-4 py-3 w-10 text-center">#</th>
                    <th className="py-3 px-3">รหัส / รายการสินค้า & สเปก</th>
                    <th className="text-center py-3 px-3 whitespace-nowrap">จำนวน</th>
                    <th className="text-right py-3 px-3 whitespace-nowrap">ราคา/หน่วย (฿)</th>
                    <th className="text-right pr-4 py-3 whitespace-nowrap">รวมเงิน (฿)</th>
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
                        <td className="p-3 pl-4 text-center font-mono font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {item.code && (
                              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold border border-slate-200/60 shrink-0">
                                {item.code}
                              </span>
                            )}
                            <div className="font-semibold text-slate-900 text-xs sm:text-sm leading-snug break-words max-w-sm" title={item.name}>
                              {item.name}
                            </div>
                          </div>
                          
                          {item.onlineUrl && (
                            <a href={item.onlineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/70 px-2 py-0.5 rounded-md transition-colors font-medium">
                              <Globe className="w-3 h-3" />
                              <span>ลิงก์สินค้า</span>
                            </a>
                          )}

                          {isEditingItems ? (
                            <div className="flex items-center gap-1.5 text-xs text-amber-800 font-mono mt-1.5 bg-amber-50 p-1.5 rounded-lg border border-amber-200 w-fit">
                              <span>1</span>
                              <input
                                type="text"
                                value={item.purchaseUnit || ''}
                                onChange={e => handleItemFieldChange(idx, 'purchaseUnit', e.target.value)}
                                placeholder="หน่วยซื้อ"
                                className="w-16 bg-white border border-amber-300 rounded px-1.5 py-0.5 text-center font-bold text-xs"
                              />
                              <span>=</span>
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.conversionRate ?? 1}
                                onChange={e => handleItemFieldChange(idx, 'conversionRate', e.target.value)}
                                placeholder="อัตราแปลง"
                                className="w-14 bg-white border border-amber-300 rounded px-1.5 py-0.5 text-center font-bold text-indigo-700 text-xs"
                              />
                              <span>{sUnit}</span>
                            </div>
                          ) : (
                            rate > 1 && (
                              <div className="text-[11px] text-indigo-600 font-medium mt-0.5">
                                อัตราแปลง: 1 {pUnit} = {rate} {sUnit}
                              </div>
                            )
                          )}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {isEditingItems ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                value={item.purchaseQty ?? item.qty}
                                onChange={e => handleItemFieldChange(idx, 'qty', e.target.value)}
                                className="w-20 border border-amber-300 rounded-lg p-1 text-center font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500 font-mono"
                              />
                              <span className="text-xs text-slate-600 font-semibold">{pUnit}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-900 font-mono text-xs sm:text-sm">{Number(pQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>{' '}
                              <span className="text-slate-500 text-xs font-medium">{pUnit}</span>
                              {rate > 1 && (
                                <div className="text-[11px] text-slate-400 font-mono font-normal mt-0.5">
                                  (= {Number(sQty).toLocaleString()} {sUnit})
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {isEditingItems ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={e => handleItemFieldChange(idx, 'price', e.target.value)}
                                className="w-24 border border-amber-300 rounded-lg p-1 text-right font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500 font-mono"
                              />
                            </div>
                          ) : (
                            <span className="font-mono font-semibold text-slate-800 text-xs sm:text-sm">฿{Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm pr-4 whitespace-nowrap tabular-nums">
                          ฿{(Number(item.total) || ((Number(item.purchaseQty ?? item.qty) || 1) * (Number(item.price) || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Financial Breakdown / Grand Total Footer */}
            {selectedPR.financials ? (
              <div className="bg-slate-50/90 border-t border-slate-200/80 p-4 sm:px-5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>ยอดรวมสินค้า (Subtotal):</span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">฿{Number(selectedPR.financials.subtotal || calculatedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {selectedPR.financials.totalDiscount > 0 && (
                  <div className="flex justify-between items-center text-rose-600">
                    <span>ส่วนลดรวม:</span>
                    <span className="font-mono font-semibold tabular-nums">-฿{Number(selectedPR.financials.totalDiscount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {selectedPR.financials.vatAmount > 0 && (
                  <div className="flex justify-between items-center text-indigo-700">
                    <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                    <span className="font-mono font-semibold tabular-nums">+฿{Number(selectedPR.financials.vatAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {parseFloat(selectedPR.financials.roundingAdj || 0) !== 0 && (
                  <div className="flex justify-between items-center text-amber-700">
                    <span>ปรับเศษทศนิยม:</span>
                    <span className="font-mono font-semibold tabular-nums">{parseFloat(selectedPR.financials.roundingAdj) > 0 ? `+฿${parseFloat(selectedPR.financials.roundingAdj).toFixed(2)}` : `-฿${Math.abs(parseFloat(selectedPR.financials.roundingAdj)).toFixed(2)}`}</span>
                  </div>
                )}
                <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">ยอดรวมสุทธิ (Grand Total):</span>
                    {selectedPR.financials.vatAmount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">รวม VAT แล้ว</span>
                    )}
                  </div>
                  <span className="text-base sm:text-lg font-black font-mono text-indigo-700 tabular-nums">
                    ฿{Number(selectedPR.financials.grandTotal || calculatedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 sm:px-5 py-3 flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-700">ยอดรวมประเมินทั้งสิ้น:</span>
                <span className="text-base sm:text-lg font-black font-mono text-indigo-700 tabular-nums">
                  ฿{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* ── 4. Secondary Section: Context & Supporting Details (Compact 2-Col Grid) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            
            {/* Left Card: Reason */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เหตุผล / วัตถุประสงค์การขอซื้อ</span>
                </span>
                <p className="text-slate-800 text-xs sm:text-sm font-normal leading-relaxed whitespace-pre-wrap mt-2">
                  {selectedPR.note || selectedPR.remarks ? (
                    selectedPR.note || selectedPR.remarks
                  ) : (
                    <span className="text-slate-400 italic">- ไม่มีระบุ -</span>
                  )}
                </p>
              </div>
            </div>

            {/* Right Card: Attachments */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-2 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                <span>เอกสารอ้างอิง & ไฟล์แนบ (Attachments)</span>
              </span>
              <div className="space-y-2 pt-1 flex-1 flex flex-col justify-center">
                {selectedPR.attachments && selectedPR.attachments.length > 0 ? (
                  selectedPR.attachments.map((att, attIdx) => (
                    <button
                      key={attIdx}
                      type="button"
                      onClick={() => setViewingAttachment({ file: att, title: att.name, url: att.previewUrl })}
                      className="w-full text-left flex items-center gap-2.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 p-2.5 rounded-xl transition-all group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-slate-800 group-hover:text-indigo-700 truncate">{att.name}</p>
                        <p className="text-[11px] text-slate-400">{att.category || 'เอกสารแนบ'} • คลิกเพื่อเปิดดู</p>
                      </div>
                    </button>
                  ))
                ) : selectedPR.specUrl ? (
                  <button
                    type="button"
                    onClick={() => setViewingAttachment({ url: selectedPR.specUrl, title: 'เอกสารอ้างอิง / ลิงก์สินค้า' })}
                    className="w-full text-left flex items-center gap-2.5 bg-indigo-50/50 hover:bg-indigo-100/50 border border-indigo-100 p-2.5 rounded-xl transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-indigo-900 group-hover:text-indigo-700">ดูเอกสารประกอบ / ลิงก์สินค้า</p>
                      <p className="text-[11px] text-indigo-600/80 truncate">{selectedPR.specUrl}</p>
                    </div>
                  </button>
                ) : (
                  <div className="text-center py-3 text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-slate-300" />
                    <span>ไม่มีเอกสารแนบ</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* MEMO Section (if exists) */}
          <MEMODetailsSection 
            memo={selectedPR.memo} 
            onViewAttachment={(att) => setViewingAttachment(att)}
          />

          {/* Activity Log Timeline */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              <span>ประวัติการดำเนินงาน (Activity Timeline)</span>
            </span>

            <div className="relative pl-5 space-y-3.5 border-l border-slate-200 ml-2 pt-1">
              {selectedPR.activityLog?.map((log, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow-2xs" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <span>{log.action}</span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                        {log.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">โดย: <span className="font-medium text-slate-600">{log.user}</span> • {log.timestamp}</p>
                    {log.note && (
                      <p className="text-xs text-slate-700 mt-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed font-normal">
                        {log.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── 5. Sticky Action Footer (Non-scrollable) ── */}
        <div className="shrink-0 px-6 py-4 bg-slate-50/80 border-t border-slate-100 space-y-3 sticky bottom-0 z-20">
          
          {/* Action note field (Shown for Approvers/Reviewers when actionable) */}
          {(['SUBMITTED', 'REVIEWED', 'REJECTED_TO_L2'].includes(selectedPR.status)) && 
           (workflowEngine.canAction(currentRole, selectedPR)) && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MessageSquare className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="ระบุความเห็น / หมายเหตุประกอบการอนุมัติ (จำเป็นต้องระบุเมื่อ Reject)..." 
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs"
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Unified Action Button Strip */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Left side: Cancel PR (Ghost Destructive) */}
            <div className="flex items-center gap-2">
              {isPRCancellable && (
                <button 
                  type="button"
                  onClick={handleCancelPR}
                  disabled={isCancelling}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิก PR'}</span>
                </button>
              )}
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2 ml-auto">
              
              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="bg-white border border-slate-300/80 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>

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
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>แก้ไขใบขอซื้อ (Edit PR)</span>
                    </button>
                  )}
                  <button 
                    onClick={() => requestSignature('ส่งใบ PR เข้าสู่ระบบ', null, true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
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
                  <button 
                    onClick={() => requestSignature('ปฏิเสธและส่งกลับผู้ขอซื้อ', 'REJECTED_TO_DRAFT', false, true)}
                    className="px-4 py-2 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Reject (ส่งกลับผู้ขอซื้อ)</span>
                  </button>

                  <button 
                    onClick={() => requestSignature('ตรวจสอบและส่งต่อให้ Plant Manager', 'REVIEWED')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>ตรวจสอบผ่าน (ส่งต่อ Plant Mgr)</span>
                  </button>
                </>
              )}

              {/* Plant Manager Actions (Final Approval) */}
              {selectedPR.status === 'REVIEWED' && 
               (workflowEngine.canAction(currentRole, selectedPR)) && (
                <>
                  <button 
                    onClick={() => requestSignature('ปฏิเสธและส่งกลับผู้ขอซื้อ', 'REJECTED_TO_DRAFT', false, true)}
                    className="px-4 py-2 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    title="ส่งกลับให้ผู้ขอซื้อแก้ไข"
                  >
                    <XCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>ส่งกลับให้แก้ไข (Reject)</span>
                  </button>

                  <button 
                    onClick={() => requestSignature('อนุมัติสั่งซื้อและสร้าง PO', 'APPROVED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
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
