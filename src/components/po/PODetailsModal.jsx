import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PO_STATUS } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { 
  Printer, Download, History, XCircle, CheckCircle, AlertTriangle, 
  ExternalLink, ShoppingCart, Info, X, Building2, Calendar, FileText, 
  CheckCircle2, Store, Truck, ArrowRight
} from 'lucide-react';
import PrintablePO from './PrintablePO';
import AttachmentViewerModal from '../common/AttachmentViewerModal';

export default function PODetailsModal({ selectedPO, currentRole, onClose, onRefresh }) {
  const [isReceiving, setIsReceiving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [customVendorName, setCustomVendorName] = useState('');
  const [vendors, setVendors] = useState([]);
  const [viewingAttachment, setViewingAttachment] = useState(null);

  useEffect(() => {
    setVendors(storageService.getVendors());
  }, []);

  const handleAssignVendor = async () => {
    let finalVendorId = null;
    let finalVendorName = '';

    if (selectedPO.purchaseChannel === 'ONLINE') {
      if (!customVendorName.trim()) return alert('กรุณาระบุชื่อร้านค้าออนไลน์');
      finalVendorName = customVendorName.trim();
      finalVendorId = 'ONLINE';
    } else {
      if (!selectedVendorId) return alert('กรุณาเลือกผู้ขาย');
      finalVendorId = selectedVendorId;
      finalVendorName = vendors.find(v => v.id === selectedVendorId)?.name;
    }

    setIsAssigning(true);
    try {
      await apiService.assignVendorToPO(selectedPO.id, finalVendorId, finalVendorName, currentRole);
      onRefresh();
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReceiveAll = async () => {
    if (!window.confirm(`ยืนยันการรับสินค้าตามใบสั่งซื้อ ${selectedPO.poNo} เต็มจำนวนทั้งหมดเข้าคลัง?`)) return;

    setIsReceiving(true);
    try {
      await apiService.receiveAllGoods(selectedPO.id, currentRole, 'รับสินค้าเข้าคลังเต็มจำนวนจากการกดรับ (Auto Stock-In)');
      onRefresh();
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsReceiving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelPO = async () => {
    const reason = prompt('กรุณาระบุเหตุผลในการยกเลิกใบสั่งซื้อ (PO):');
    if (!reason || !reason.trim()) return;

    setIsCancelling(true);
    try {
      await apiService.cancelPO(selectedPO.id, currentRole, reason.trim());
      alert('ยกเลิกใบสั่งซื้อเรียบร้อยแล้ว');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const isOnlinePurchaser = currentRole?.roleId === 'ONLINE_PURCHASER' || currentRole?.id === 'ONLINE_PURCHASER';
  const isPOCancellable = !['CLOSED', 'RECEIVED', 'CANCELLED'].includes(selectedPO.status);
  const canCancelPO = !isOnlinePurchaser && (
    currentRole?.id === 'ADMIN' || 
    currentRole?.roleId === 'ADMIN' || 
    (currentRole?.level && currentRole?.level >= 2) || 
    currentRole?.canFinalApprove || 
    currentRole?.canReview || 
    (currentRole?.canReceiveGoods && (currentRole?.canViewAllDepts || currentRole?.department === selectedPO.department))
  );

  const statusInfo = PO_STATUS[selectedPO.status] || { label: selectedPO.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };

  return createPortal(
    <>
      <div className="hidden print:block">
        <PrintablePO po={selectedPO} />
      </div>
      <div className="fixed inset-0 glass-backdrop z-[60] flex items-center justify-center p-3 sm:p-4 print:hidden animate-fade-in">
        <div className="modal-content w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col text-slate-800 animate-zoom-in">
          
          {/* ── Header (Clean Executive Ribbon) ── */}
          <div className="flex-shrink-0 border-b border-slate-100 p-5 sm:p-6 bg-slate-50/50">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900">
                    {selectedPO.poNo}
                  </span>
                  
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${statusInfo.color}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 animate-pulse"></span>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Meta Grid Strip */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium pt-0.5">
                  <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>อ้างอิงใบขอซื้อ (PR): <strong className="font-mono text-indigo-700">{selectedPO.prNo}</strong></span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>แผนกต้นทาง: <strong className="text-slate-700">{selectedPO.department}</strong></span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>วันที่ออก PO: <strong className="text-slate-700 font-mono">{selectedPO.issueDate}</strong></span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-2xs cursor-pointer"
                  title="พิมพ์ใบสั่งซื้อ"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">พิมพ์ PO</span>
                </button>
                <button 
                  onClick={onClose} 
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-2xl hover:bg-white hover:shadow-xs transition-all cursor-pointer" 
                  title="ปิดหน้าต่าง (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Content (Scrollable) ── */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar bg-slate-50/30">
            
            {/* Vendor & Dates Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Vendor Info (7 cols) */}
              <div className="md:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ผู้ขาย / ผู้จัดจำหน่าย (Vendor)</span>
                </span>
                
                {selectedPO.vendorId ? (
                  <div className="pt-0.5">
                    <p className="font-bold text-slate-900 text-sm sm:text-base">{selectedPO.vendorName}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      รหัสผู้ขาย: {selectedPO.vendorId === 'ONLINE' ? 'สั่งซื้อออนไลน์' : selectedPO.vendorId}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5">
                    <p className="text-amber-900 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>รอระบุผู้ขาย (Pending Vendor Assignment)</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      {selectedPO.purchaseChannel === 'ONLINE' ? (
                        <input 
                          type="text"
                          value={customVendorName}
                          onChange={e => setCustomVendorName(e.target.value)}
                          placeholder="ระบุชื่อร้านค้าออนไลน์ (เช่น Shopee / Lazada)"
                          className="w-full text-xs bg-white border border-amber-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      ) : (
                        <select 
                          value={selectedVendorId}
                          onChange={e => setSelectedVendorId(e.target.value)}
                          className="w-full text-xs bg-white border border-amber-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                          <option value="">-- เลือกผู้ขายจาก Master Data --</option>
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      )}
                      <button 
                        onClick={handleAssignVendor}
                        disabled={isAssigning || (selectedPO.purchaseChannel === 'ONLINE' ? !customVendorName.trim() : !selectedVendorId)}
                        className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                      >
                        {isAssigning ? 'บันทึก...' : 'บันทึกผู้ขาย'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Info (5 cols) */}
              <div className="md:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>กำหนดการส่งสินค้า (Delivery Timeline)</span>
                </span>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>วันที่เปิด PO:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedPO.issueDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>กำหนดส่งมอบ (ภายใน):</span>
                    <span className="font-mono font-bold text-rose-600">{selectedPO.deliveryDate || 'ตามระบุ'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Attachments from PR */}
            {selectedPO.specUrl && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewingAttachment({ url: selectedPO.specUrl, title: 'เอกสารอ้างอิง / ลิงก์สินค้า' })}
                  className="flex items-center gap-2.5 bg-indigo-50/60 hover:bg-indigo-100/60 border border-indigo-100 p-2.5 rounded-xl transition-colors group cursor-pointer w-full text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-indigo-900 group-hover:text-indigo-700">ดูเอกสารประกอบ / ลิงก์สินค้าอ้างอิงจาก PR</p>
                    <p className="text-[10px] text-indigo-600/70 truncate">{selectedPO.specUrl}</p>
                  </div>
                </button>
              </div>
            )}

            {/* Items Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
              <div className="bg-slate-50/70 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <span>รายการสินค้าที่สั่งซื้อ</span>
                  <span className="text-xs font-semibold text-slate-500">({selectedPO.items?.length || 0} รายการ)</span>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/60 text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-3 pl-4">รหัสสินค้า</th>
                      <th className="p-3">ชื่อสินค้า</th>
                      <th className="p-3 text-center">จำนวนสั่งซื้อ</th>
                      <th className="p-3 text-center">รับแล้ว</th>
                      <th className="p-3 text-right">ราคา/หน่วย (฿)</th>
                      <th className="p-3 text-right pr-4">รวมเงิน (฿)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPO.items.map((item, idx) => {
                      const pQty = item.purchaseQty ?? item.qty;
                      const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                      const sUnit = item.stockUnit || item.unit || pUnit;
                      const rate = Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1;
                      const sQty = item.stockQty ?? (pQty * rate);
                      const price = item.unitPrice || item.estimatedPrice || item.price || 0;
                      const isPriceChanged = item.originalEstimatedPrice && Number(item.originalEstimatedPrice) !== Number(price);
                      const isQtyChanged = item.originalPurchaseQty && Number(item.originalPurchaseQty) !== Number(pQty);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 pl-4 font-mono font-bold text-slate-500 text-[11px]">{item.code || '-'}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800 text-xs">{item.name}</div>
                            {rate > 1 && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">1 {pUnit} = {rate} {sUnit}</div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div>
                              <span className="font-bold text-slate-800 font-mono">{Number(pQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>{' '}
                              <span className="text-slate-500">{pUnit}</span>
                              {isQtyChanged && (
                                <div className="text-[10px] text-amber-600 font-mono">ขอมา: {item.originalPurchaseQty} {pUnit}</div>
                              )}
                              {rate > 1 && (
                                <div className="text-[10px] text-indigo-600 font-mono font-medium">(= {Number(sQty).toLocaleString()} {sUnit})</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${item.receivedQty >= pQty ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {Number(item.receivedQty || 0).toLocaleString()} {pUnit}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="font-mono text-slate-700">฿{Number(price).toLocaleString()}</div>
                            {isPriceChanged && (
                              <div className="text-[10px] text-amber-600 font-mono line-through">เดิม ฿{Number(item.originalEstimatedPrice).toLocaleString()}</div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 pr-4">
                            ฿{(item.total || (price * pQty))?.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/60 border-t border-slate-200">
                      <td colSpan="5" className="p-2.5 text-right font-medium text-slate-500 text-xs">มูลค่ารวม (Sub Total):</td>
                      <td className="p-2.5 text-right font-bold font-mono text-slate-800 pr-4">฿{selectedPO.subtotal?.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50/60">
                      <td colSpan="5" className="p-2.5 text-right font-medium text-slate-500 text-xs">ภาษีมูลค่าเพิ่ม (VAT 7%):</td>
                      <td className="p-2.5 text-right font-bold font-mono text-slate-800 pr-4">฿{selectedPO.vat?.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-indigo-50/60 border-t border-indigo-100">
                      <td colSpan="5" className="p-3 text-right font-bold text-indigo-900 text-xs">ยอดเงินสุทธิ (Grand Total):</td>
                      <td className="p-3 text-right font-black font-mono text-indigo-700 text-base pr-4">฿{selectedPO.grandTotal?.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Activity Log Timeline */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>ประวัติการดำเนินงาน (Activity Timeline)</span>
              </span>

              <div className="relative pl-5 space-y-3 border-l-2 border-slate-100 ml-2 pt-1">
                {selectedPO.activityLog?.map((log, idx) => (
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
          <div className="flex-shrink-0 border-t border-slate-200/90 p-4 sm:px-6 bg-white space-y-2.5">
            
            {/* Online Purchaser Guidance Banner */}
            {isOnlinePurchaser && selectedPO.status !== 'CLOSED' && selectedPO.status !== 'CANCELLED' && (
              <div className="text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded-xl border border-purple-200 font-medium flex items-center gap-1.5">
                <Info className="w-4 h-4 text-purple-600 shrink-0" />
                <span>แผนกต้นทาง ({selectedPO.department}) จะเป็นผู้ตรวจรับสินค้าเข้าคลัง (+IN) และปิด PO</span>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2.5">
              
              {/* Left side: Cancel PO */}
              <div className="flex items-center gap-2">
                {isPOCancellable && canCancelPO && (
                  <button 
                    type="button"
                    onClick={handleCancelPO}
                    disabled={isCancelling}
                    className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิก PO'}</span>
                  </button>
                )}
              </div>

              {/* Right side: Action decisions */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>

                {/* Only show "สั่งซื้อเรียบร้อย" if PO is ISSUED or IN_PROGRESS_ONLINE */}
                {(selectedPO.status === 'ISSUED' || selectedPO.status === 'IN_PROGRESS_ONLINE') && 
                 (currentRole.id === 'ADMIN' || currentRole.canOnlinePurchase || currentRole.roleId === 'ONLINE_PURCHASER') && (
                  <button
                    onClick={async () => {
                      const targetStatus = selectedPO.purchaseChannel === 'ONLINE' ? 'ORDERED_PENDING_DELIVERY' : 'IN_DELIVERY';
                      if (window.confirm(`ยืนยันบันทึกว่าสั่งซื้อสินค้าเรียบร้อยแล้วสำหรับ PO ${selectedPO.poNo} ใช่หรือไม่?`)) {
                        try {
                          await apiService.updatePOStatus(selectedPO.id, targetStatus, currentRole);
                          onRefresh();
                          onClose();
                        } catch (err) {
                          alert('Error: ' + err.message);
                        }
                      }
                    }}
                    disabled={!selectedPO.vendorId}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>บันทึกสั่งซื้อแล้ว</span>
                  </button>
                )}

                {/* Authorized staff receive goods & close PO */}
                {!isOnlinePurchaser && (currentRole.id === 'ADMIN' || currentRole.roleId === 'ASST_MANAGER' || (currentRole.canReceiveGoods && (currentRole.canViewAllDepts || currentRole.department === selectedPO.department))) && selectedPO.status !== 'CLOSED' && selectedPO.status !== 'CANCELLED' && (
                  <button
                    onClick={handleReceiveAll}
                    disabled={isReceiving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isReceiving ? 'กำลังบันทึก...' : 'รับเข้าคลัง & ปิด PO'}</span>
                  </button>
                )}

                {selectedPO.status === 'CLOSED' && (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>รับเข้าคลังครบแล้ว (+IN)</span>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* AttachmentViewerModal */}
      {viewingAttachment && (
        <AttachmentViewerModal
          file={viewingAttachment.file}
          url={viewingAttachment.url}
          title={viewingAttachment.title}
          onClose={() => setViewingAttachment(null)}
        />
      )}
    </>,
    document.body
  );
}
