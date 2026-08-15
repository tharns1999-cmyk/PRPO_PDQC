import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PO_STATUS } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { Printer, Download, History, XCircle, CheckCircle, AlertTriangle, ExternalLink, ShoppingCart, Info, X } from 'lucide-react';
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
      finalVendorId = 'ONLINE'; // Optional marker
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

  return createPortal(
    <>
      <div className="hidden print:block">
        <PrintablePO po={selectedPO} />
      </div>
      <div className="fixed inset-0 glass-backdrop z-[60] flex items-center justify-center p-4 print:hidden animate-fade-in">
        <div className="modal-content w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col text-slate-800 animate-zoom-in">
          {/* Header (Sticky) */}
          <div className="flex-shrink-0 flex items-start justify-between border-b border-slate-100 p-6 pb-4">
            <div>
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-slate-900 font-mono">{selectedPO.poNo}</h3>
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border shadow-sm ${PO_STATUS[selectedPO.status]?.color}`}>
                  <span className="w-2 h-2 rounded-full bg-current opacity-75"></span>
                  {PO_STATUS[selectedPO.status]?.label}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                อ้างอิงใบขอซื้อ (PR): <span className="font-semibold text-slate-700">{selectedPO.prNo}</span> | ฝ่าย: {selectedPO.department}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-slate-300"
              >
                <Printer className="w-4 h-4" /> พิมพ์ใบสั่งซื้อ
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors ml-2 cursor-pointer" title="ปิด">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <p className="text-slate-500 text-sm font-semibold mb-1">สั่งซื้อจาก (Vendor)</p>
                {selectedPO.vendorId ? (
                  <>
                    <p className="font-bold text-slate-800 text-lg">{selectedPO.vendorName}</p>
                    <p className="text-sm text-slate-600 mt-0.5">รหัส: {selectedPO.vendorId === 'ONLINE' ? '-' : selectedPO.vendorId}</p>
                  </>
                ) : (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg max-w-sm">
                    <p className="text-amber-800 text-sm font-bold mb-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> รอระบุผู้ขาย (Pending Vendor)</p>
                    <div className="flex flex-col gap-2">
                      {selectedPO.purchaseChannel === 'ONLINE' ? (
                        <input 
                          type="text"
                          value={customVendorName}
                          onChange={e => setCustomVendorName(e.target.value)}
                          placeholder="ระบุชื่อร้านค้าออนไลน์ (เช่น Shopee)"
                          className="w-full text-sm border-slate-300 rounded-lg px-3 py-1.5 focus:ring-amber-500 focus:border-amber-500"
                        />
                      ) : (
                        <select 
                          value={selectedVendorId}
                          onChange={e => setSelectedVendorId(e.target.value)}
                          className="w-full text-sm border-slate-300 rounded-lg px-3 py-1.5 focus:ring-amber-500 focus:border-amber-500"
                        >
                           <option value="">-- เลือกผู้ขาย --</option>
                           {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      )}
                      <button 
                        onClick={handleAssignVendor}
                        disabled={isAssigning || (selectedPO.purchaseChannel === 'ONLINE' ? !customVendorName.trim() : !selectedVendorId)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {isAssigning ? 'กำลังบันทึก...' : 'ยืนยันผู้ขาย'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="md:text-right">
                <p className="text-slate-500 text-sm font-semibold mb-1">ข้อมูลวันที่</p>
                <p className="text-slate-700">วันที่ออกเอกสาร: <span className="font-medium">{selectedPO.issueDate}</span></p>
                <p className="text-slate-700">กำหนดส่ง: <span className="font-medium text-rose-600">{selectedPO.deliveryDate}</span></p>
              </div>
            </div>

            {/* Documents & Links Section (From PR) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-sm text-slate-500 mb-3 uppercase tracking-wider">เอกสารอ้างอิงจาก PR:</h4>
              <div className="space-y-3">
                {selectedPO.specUrl ? (
                  <button
                    type="button"
                    onClick={() => setViewingAttachment({ url: selectedPO.specUrl, title: 'เอกสารอ้างอิง / ลิงก์สินค้า' })}
                    className="flex items-center gap-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 p-3 rounded-lg transition-colors group w-fit cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-105 transition-transform">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-indigo-900 group-hover:text-indigo-700">ดูเอกสารประกอบ / ลิงก์สินค้า</p>
                      <p className="text-xs text-indigo-600/70 truncate max-w-[200px] sm:max-w-xs">{selectedPO.specUrl}</p>
                    </div>
                  </button>
                ) : (
                  <div className="text-sm text-slate-400 font-medium">
                    - ไม่มีไฟล์แนบจากใบขอซื้อ -
                  </div>
                )}
              </div>
            </div>

          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-2">รายการสินค้าที่สั่งซื้อ</h4>
            <div className="border border-slate-200 rounded-lg overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-4.5">รหัสสินค้า</th>
                    <th className="p-4.5">รายการ</th>
                    <th className="p-4.5 text-center">สั่งซื้อ</th>
                    <th className="p-4.5 text-center">รับแล้ว</th>
                    <th className="p-4.5 text-right">ราคา/หน่วย</th>
                    <th className="p-4.5 text-right">รวมเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
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
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-4.5 font-mono font-medium">{item.code}</td>
                        <td className="p-4.5">
                          <div className="font-semibold text-slate-800">{item.name}</div>
                          {rate > 1 && (
                            <div className="text-[10px] text-slate-400">อัตราแปลง: 1 {pUnit} = {rate} {sUnit}</div>
                          )}
                        </td>
                        <td className="p-4.5 text-center">
                          <div className="font-bold text-slate-800">{pQty} {pUnit}</div>
                          {isQtyChanged && (
                            <div className="text-[10px] text-amber-600 font-medium font-mono">ขอมา: {item.originalPurchaseQty} {pUnit}</div>
                          )}
                          {rate > 1 && (
                            <div className="text-[10px] text-indigo-600 font-medium">(= {sQty.toLocaleString()} {sUnit})</div>
                          )}
                        </td>
                        <td className="p-4.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.receivedQty >= pQty ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {item.receivedQty || 0} {pUnit}
                          </span>
                        </td>
                        <td className="p-4.5 text-right text-slate-600">
                          <div>฿{price.toLocaleString()} / {pUnit}</div>
                          {isPriceChanged && (
                            <div className="text-[10px] text-amber-600 font-medium line-through font-mono">เดิม ฿{item.originalEstimatedPrice.toLocaleString()}</div>
                          )}
                        </td>
                        <td className="p-4.5 text-right font-semibold">฿{(item.total || (price * pQty))?.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td colSpan="5" className="p-4.5 text-right font-medium text-slate-600">มูลค่ารวม (Sub Total)</td>
                        <td className="p-4.5 text-right font-bold text-slate-800">฿{selectedPO.subtotal?.toLocaleString()}</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td colSpan="5" className="p-4.5 text-right font-medium text-slate-600">ภาษีมูลค่าเพิ่ม (VAT 7%)</td>
                        <td className="p-4.5 text-right font-bold text-slate-800">฿{selectedPO.vat?.toLocaleString()}</td>
                      </tr>
                      <tr className="bg-blue-50/50">
                        <td colSpan="5" className="p-4 text-right font-bold text-blue-900">ยอดเงินสุทธิ (Grand Total)</td>
                        <td className="p-4 text-right font-black text-blue-700 text-sm">฿{selectedPO.grandTotal?.toLocaleString()}</td>
                      </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-sm uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-600" />
              ประวัติการดำเนินงาน (Activity Log)
            </h4>
            <div className="relative pl-6 space-y-4 border-l-2 border-slate-300">
              {selectedPO.activityLog?.map((log, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white shadow-sm" />
                  <div>
                    <div className="flex items-center gap-4 text-sm font-bold text-slate-800">
                      <span>{log.action}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-normal">
                        {log.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">โดย: <span className="font-medium text-slate-700">{log.user}</span> | {log.timestamp}</p>
                    {log.note && <p className="text-sm text-slate-600 italic bg-white p-1.5 rounded border border-slate-200 mt-1">{log.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

          {/* Footer Actions (Sticky) */}
        <div className="flex-shrink-0 border-t border-slate-200 p-6 pt-4 bg-slate-50/50 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              {isPOCancellable && canCancelPO && (
                <button
                  type="button"
                  onClick={handleCancelPO}
                  disabled={isCancelling}
                  className="px-4 py-2.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4 text-rose-500" />
                  {isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิกใบสั่งซื้อ (Cancel PO)'}
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Only show "สั่งซื้อเรียบร้อย" if PO is ISSUED or IN_PROGRESS_ONLINE */}
              {(selectedPO.status === 'ISSUED' || selectedPO.status === 'IN_PROGRESS_ONLINE') && (currentRole.id === 'ADMIN' || currentRole.canOnlinePurchase || currentRole.roleId === 'ONLINE_PURCHASER') && (
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
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>สั่งซื้อเรียบร้อย</span>
                </button>
              )}

              {/* Online Purchaser guidance */}
              {isOnlinePurchaser && selectedPO.status !== 'CLOSED' && selectedPO.status !== 'CANCELLED' && (
                <div className="text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded-xl border border-purple-200 font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>แผนกต้นทาง ({selectedPO.department}) จะเป็นผู้ตรวจรับสินค้าเข้าคลัง (+IN) และปิด PO</span>
                </div>
              )}

              {/* Only authorized staff (Requester / Asst Manager / Admin) can receive goods and close PO */}
              {!isOnlinePurchaser && (currentRole.id === 'ADMIN' || currentRole.roleId === 'ASST_MANAGER' || (currentRole.canReceiveGoods && (currentRole.canViewAllDepts || currentRole.department === selectedPO.department))) && selectedPO.status !== 'CLOSED' && selectedPO.status !== 'CANCELLED' && (
                <button
                  onClick={handleReceiveAll}
                  disabled={isReceiving}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {isReceiving ? 'กำลังบันทึก...' : 'รับสินค้าทั้งหมดเข้าคลัง (+IN) & ปิด PO'}
                </button>
              )}

              {selectedPO.status === 'CLOSED' && (
                <div className="inline-flex items-center gap-3 bg-emerald-50 text-emerald-700 border border-emerald-200 px-5 py-2.5 rounded-xl shadow-sm">
                  <div className="p-1 bg-emerald-100 rounded-full">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-emerald-800">สินค้ารับเข้าคลังเรียบร้อยแล้ว</span>
                    <span className="text-xs font-medium text-emerald-600">Stock Card ถูกอัปเดตอัตโนมัติ (+IN)</span>
                  </div>
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
