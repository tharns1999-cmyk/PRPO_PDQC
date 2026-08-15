import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PR_STATUS } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { workflowEngine } from '../../services/workflowEngine';
import { ExternalLink, History, ShieldCheck, CheckCircle, XCircle, Trash2, Send, Edit3, Save, RotateCcw, AlertTriangle, Layers, Clock, CheckCircle2, X } from 'lucide-react';
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
  
  // Approver Item Editing State (Phase 1B)
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
      alert('กรุณาระบุเหตุผลการไม่อนุมัติ / ส่งกลับ ก่อนดำเนินการ');
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

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[60] flex items-center justify-center p-4 print:hidden animate-fade-in">
      <div className="modal-content w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col text-slate-800 animate-zoom-in">
        
        {/* Header (Sticky) */}
        <div className="flex-shrink-0 flex items-start justify-between border-b border-slate-100 p-6 pb-4">
          <div>
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-slate-900 font-mono">{selectedPR.prNo}</h3>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border shadow-sm ${PR_STATUS[selectedPR.status]?.color}`}>
                <span className="w-2 h-2 rounded-full bg-current opacity-75"></span>
                {PR_STATUS[selectedPR.status]?.label}
              </span>
              {apiService.isOverBudget(selectedPR.department, calculatedTotal) && (
                <span className="bg-rose-500 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>เกินงบประมาณ (Over Budget)</span>
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-2">
              ผู้ขอซื้อ: <span className="font-semibold text-slate-700">{selectedPR.requestedBy}</span> ({selectedPR.department}) 
              <span className="mx-2">|</span> วันที่ขอ: {selectedPR.requestedDate}
              <span className="mx-2">|</span> ช่องทาง: <span className="font-semibold text-slate-700">{selectedPR.purchaseChannel === 'ONLINE' ? 'Online (Shopee/Lazada)' : 'ซื้อเอง'}</span>
              <span className="mx-2">|</span> ประเภทใช้งาน: <span className="font-semibold text-slate-700">{selectedPR.source}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" title="ปิด">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
          
          {/* Split PO Banner (Phase 2B) */}
          {relatedPOs.length > 0 && (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    ใบขอซื้อนี้ออกใบสั่งซื้อ (PO) แล้ว {relatedPOs.length} ฉบับ
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {relatedPOs.length > 1
                      ? 'รายการสินค้าถูกแยกตาม Supplier ของแต่ละรายการโดยอัตโนมัติ'
                      : `เลขที่ใบสั่งซื้อ: ${relatedPOs[0]?.poNo} (${relatedPOs[0]?.vendorName})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSplitModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-4 h-4" />
                ดูรายละเอียด PO {relatedPOs.length > 1 ? `(${relatedPOs.length} ใบ)` : ''}
              </button>
            </div>
          )}

          {/* Rejection Notice Banner (if REJECTED_TO_L2 or REJECTED_TO_DRAFT) */}
          {(selectedPR.status === 'REJECTED_TO_L2' || selectedPR.status === 'REJECTED_TO_DRAFT') && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-orange-900 text-sm">
                  {selectedPR.status === 'REJECTED_TO_L2' ? 'เอกสารถูกส่งกลับจาก Level 3 มาให้ Level 2 ตรวจสอบใหม่' : 'เอกสารถูกตีกลับมายังผู้ขอซื้อ (ร่างเอกสาร)'}
                </h4>
                <p className="text-xs text-orange-800 mt-1">
                  กรุณาตรวจสอบประวัติด้านล่าง หรือแก้ไขรายการสินค้า/ข้อมูล และส่งพิจารณาใหม่
                </p>
              </div>
            </div>
          )}

          {/* Documents & Links Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reason */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
              <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase tracking-wider">รายละเอียด / เหตุผลการขอซื้อ:</h4>
              <p className="text-slate-700 font-medium leading-relaxed flex-1 whitespace-pre-wrap">
                {selectedPR.note || selectedPR.remarks || '- ไม่มีระบุ -'}
              </p>
            </div>

            {/* Attachments */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
              <h4 className="font-bold text-sm text-slate-500 mb-3 uppercase tracking-wider">เอกสารอ้างอิง (Attachments):</h4>
              <div className="space-y-2.5 flex-1">
                {selectedPR.attachments && selectedPR.attachments.length > 0 ? (
                  selectedPR.attachments.map((att, attIdx) => (
                    <button
                      key={attIdx}
                      type="button"
                      onClick={() => setViewingAttachment({ file: att, title: att.name, url: att.previewUrl })}
                      className="w-full text-left flex items-center gap-3 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-100 p-2.5 rounded-xl transition-all group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-xs group-hover:scale-105 transition-transform shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-indigo-900 group-hover:text-indigo-700 truncate">{att.name}</p>
                        <p className="text-[11px] text-indigo-600/70">{att.category || 'เอกสารแนบ'} • คลิกเพื่อพรีวิว</p>
                      </div>
                    </button>
                  ))
                ) : selectedPR.specUrl ? (
                  <button
                    type="button"
                    onClick={() => setViewingAttachment({ url: selectedPR.specUrl, title: 'เอกสารอ้างอิง / ลิงก์สินค้า' })}
                    className="w-full text-left flex items-center gap-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 p-3 rounded-lg transition-colors group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-105 transition-transform shrink-0">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-indigo-900 group-hover:text-indigo-700">ดูเอกสารประกอบ / ลิงก์สินค้า</p>
                      <p className="text-xs text-indigo-600/70 truncate max-w-[200px] sm:max-w-xs">{selectedPR.specUrl}</p>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-slate-400 font-medium bg-slate-50 rounded-lg border border-dashed border-slate-200 min-h-[60px]">
                    - ไม่มีไฟล์แนบ -
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table with Approver Edit (Phase 1B) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-sm uppercase tracking-wider text-slate-700">
                รายการสินค้า ({displayedItems.length})
              </h4>
              {canApproverEdit && (
                <div className="flex items-center gap-2">
                  {!isEditingItems ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditItems((selectedPR.items || []).map(it => ({ ...it })));
                        setIsEditingItems(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      แก้ไขรายการก่อนอนุมัติ (Edit Items)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditItems((selectedPR.items || []).map(it => ({ ...it })));
                        setIsEditingItems(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      ยกเลิกการแก้ไข
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Approver Editing Reason Input Bar */}
            {isEditingItems && (
              <div className="bg-amber-50/70 p-3.5 border-b border-amber-200 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    placeholder="ระบุเหตุผลที่ปรับแก้จำนวน/ราคา (เช่น ปรับลดตามงบ หรือ ต่อรองราคาได้)... *"
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={isSavingItems}
                  onClick={handleSaveItemsEdit}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Save className="w-4 h-4" />
                  {isSavingItems ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            )}

            <div className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white shadow-sm text-slate-400 font-medium border-b border-slate-100">
                  <tr>
                    <th className="p-3 pl-4">รหัสสินค้า</th>
                    <th className="p-3">รายการ</th>
                    <th className="p-3 text-center">จำนวน ({isEditingItems ? 'แก้ไขได้' : 'หน่วยซื้อ'})</th>
                    <th className="p-3 text-right">ราคา/หน่วย ({isEditingItems ? 'แก้ไขได้' : 'ประมาณ'})</th>
                    <th className="p-3 text-right pr-4">รวมเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayedItems.map((item, idx) => {
                    const pQty = item.purchaseQty ?? item.qty;
                    const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                    const sUnit = item.stockUnit || item.unit || pUnit;
                    const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
                    const sQty = item.stockQty ?? (pQty * rate);

                    return (
                      <tr key={idx} className={`hover:bg-slate-50/50 ${isEditingItems ? 'bg-amber-50/20' : ''}`}>
                        <td className="p-3 pl-4 font-mono font-medium text-slate-500">{item.code}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-700">{item.name}</div>
                          {rate > 1 && (
                            <div className="text-[10px] text-slate-400">อัตราแปลง: 1 {pUnit} = {rate} {sUnit}</div>
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
                                className="w-20 border border-amber-300 rounded-lg p-1.5 text-center font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500"
                              />
                              <span className="text-xs text-slate-500 font-semibold">{pUnit}</span>
                            </div>
                          ) : (
                            <>
                              <div className="font-bold text-slate-800">
                                {pQty} <span className="text-xs font-normal text-slate-500">{pUnit}</span>
                              </div>
                              {rate > 1 && (
                                <div className="text-[11px] font-semibold text-indigo-600">
                                  (= {sQty.toLocaleString()} {sUnit})
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isEditingItems ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-slate-400">฿</span>
                              <input
                                type="number"
                                min="0"
                                value={item.price}
                                onChange={e => handleItemFieldChange(idx, 'price', e.target.value)}
                                className="w-24 border border-amber-300 rounded-lg p-1.5 text-right font-bold text-xs bg-white focus:ring-2 focus:ring-amber-500"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-600">฿{Number(item.price || 0).toLocaleString()} / {pUnit}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-800 pr-4">
                          ฿{(Number(item.total) || ((Number(item.purchaseQty ?? item.qty) || 1) * (Number(item.price) || 0))).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50">
                    <td colSpan="4" className="p-4 text-right font-bold text-slate-500 uppercase text-xs">มูลค่ารวมทั้งหมด (Total Amount)</td>
                    <td className="p-4 text-right font-black text-indigo-700 text-lg pr-4">฿{calculatedTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* MEMO Section (if exists) */}
          <MEMODetailsSection 
            memo={selectedPR.memo} 
            onViewAttachment={(att) => setViewingAttachment(att)}
          />

          {/* ACTIVITY LOG TIMELINE */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-sm uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              ประวัติการดำเนินงาน (Activity Log)
            </h4>
            <div className="relative pl-6 space-y-5 border-l-2 border-slate-200 ml-2 mt-2">
              {selectedPR.activityLog?.map((log, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                  <div>
                    <div className="flex items-center gap-3 text-sm font-bold text-slate-800">
                      <span>{log.action}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium border border-slate-200">
                        {log.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">โดย: <span className="font-semibold text-slate-700">{log.user}</span> • {log.timestamp}</p>
                    {log.note && (
                      <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        {log.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions (Sticky) */}
        <div className="flex-shrink-0 border-t border-slate-200 p-6 bg-white flex flex-col gap-4">
          
          {/* Status Banners for Observational Roles */}
          {(selectedPR.status === 'SUBMITTED' || selectedPR.status === 'REJECTED_TO_L2') && 
           !currentRole.id?.includes('ADMIN') && (currentRole.level >= 3 || currentRole.canFinalApprove || currentRole.level <= 1) && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
              <span className="font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>เอกสารนี้อยู่ในขั้นตอน <strong className="text-amber-900 font-bold">รอการตรวจทาน Level 1 (Assistant Manager)</strong></span>
              </span>
              <span className="text-[11px] text-amber-600 bg-amber-100/80 px-2 py-0.5 rounded-md font-bold">
                {currentRole.level >= 3 ? 'รอส่งต่อให้ Plant Manager' : 'อยู่ระหว่างรอการตรวจ'}
              </span>
            </div>
          )}

          {selectedPR.status === 'REVIEWED' && 
           !currentRole.id?.includes('ADMIN') && (currentRole.level < 3 && !currentRole.canFinalApprove) && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between">
              <span className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>ผ่านการตรวจทานแล้ว — อยู่ในขั้นตอน <strong className="text-blue-900 font-bold">รออนุมัติสั่งซื้อขั้นสุดท้าย (Plant Manager)</strong></span>
              </span>
              <span className="text-[11px] text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-md font-bold">
                รอ Plant Mgr อนุมัติ
              </span>
            </div>
          )}

          {/* Requester Actions (Draft / Rejected to Draft) */}
          {(selectedPR.status === 'DRAFT' || selectedPR.status === 'REJECTED_TO_DRAFT') && 
           (workflowEngine.canAction(currentRole, selectedPR)) && (
            <div className="flex gap-3 justify-end w-full">
              {isPRCancellable && (
                <button
                  type="button"
                  onClick={handleCancelPR}
                  disabled={isCancelling}
                  className="px-5 py-3 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  {isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิกใบขอซื้อ (Cancel PR)'}
                </button>
              )}
              <button 
                onClick={() => requestSignature('ส่งใบ PR เข้าสู่ระบบ', null, true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Submit (ส่งเข้าสู่กระบวนการ)
              </button>
            </div>
          )}

          {/* Asst. Manager Actions (SUBMITTED or REJECTED_TO_L2) */}
          {(selectedPR.status === 'SUBMITTED' || selectedPR.status === 'REJECTED_TO_L2') && 
           (workflowEngine.canAction(currentRole, selectedPR)) && (
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="ความเห็น / เหตุผล (ระบุเมื่อต้องการ Reject หรือ ยกเลิก)" 
                className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => requestSignature('ตรวจสอบและส่งต่อให้ Plant Manager', 'REVIEWED')}
                  className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Reviewed (ตรวจสอบผ่าน → ส่ง Plant Mgr)
                </button>
                <button 
                  onClick={() => requestSignature('ปฏิเสธและส่งกลับผู้ขอซื้อ', 'REJECTED_TO_DRAFT', false, true)}
                  className="flex-1 bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 hover:border-orange-300 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                  Reject (ส่งกลับผู้ขอซื้อ)
                </button>
                {isPRCancellable && (
                  <button 
                    type="button"
                    onClick={handleCancelPR}
                    disabled={isCancelling}
                    className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5 text-rose-500" />
                    {isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิกใบขอซื้อ (Cancel PR)'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Plant Manager Actions (REVIEWED) */}
          {selectedPR.status === 'REVIEWED' && 
           (workflowEngine.canAction(currentRole, selectedPR)) && (
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="ความเห็นจาก Plant Manager (ระบุเมื่อต้องการ Reject หรือ ยกเลิก)" 
                className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => requestSignature('อนุมัติสั่งซื้อและสร้าง PO', 'APPROVED')}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5" />
                  Approve (อนุมัติสั่งซื้อ & สร้าง PO)
                </button>
                <button 
                  onClick={() => requestSignature('ส่งกลับ Level 2 (Asst Mgr) ตรวจสอบใหม่', 'REJECTED_TO_L2', false, true)}
                  className="flex-1 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 hover:border-amber-400 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  title="ส่งกลับให้ Level 2 ตรวจทานใหม่ (1-Level Rejection)"
                >
                  <XCircle className="w-5 h-5" />
                  Reject (ส่งกลับ Level 2)
                </button>
                {isPRCancellable && (
                  <button 
                    type="button"
                    onClick={handleCancelPR}
                    disabled={isCancelling}
                    className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5 text-rose-500" />
                    {isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิกใบขอซื้อ (Cancel PR)'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Footer Close Button */}
          <div className="flex items-center justify-end pt-2">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
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

      {/* Signature Modal with missing signature block */}
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
