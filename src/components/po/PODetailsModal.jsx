import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PO_STATUS } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { modalService } from '../../services/modalService';
import { 
  Printer, Download, History, XCircle, CheckCircle, AlertTriangle, 
  ExternalLink, ShoppingCart, Info, X, Building2, Calendar, FileText, 
  CheckCircle2, Store, Truck, ArrowRight, MapPin, AlertOctagon,
  UploadCloud, Paperclip, Camera, Trash2, Eye, ShieldAlert, Check, Percent, Globe, Package,
  RotateCcw, Coins, ChevronRight
} from 'lucide-react';
import PrintablePO from './PrintablePO';
import AttachmentViewerModal from '../common/AttachmentViewerModal';

export default function PODetailsModal({ selectedPO, currentRole, onClose, onRefresh }) {
  const [isReceiving, setIsReceiving] = useState(false);
  const [showReceivingPanel, setShowReceivingPanel] = useState(false);
  const [receivingQtys, setReceivingQtys] = useState({});
  const [problematicItems, setProblematicItems] = useState({});
  const [grAttachments, setGrAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [receiveNote, setReceiveNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [customVendorName, setCustomVendorName] = useState('');
  const [vendors, setVendors] = useState([]);
  const [viewingAttachment, setViewingAttachment] = useState(null);
  const [isShortClosing, setIsShortClosing] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimReason, setClaimReason] = useState('สินค้าชำรุด/เสียหาย');
  const [claimDescription, setClaimDescription] = useState('');
  const [claimPhoto, setClaimPhoto] = useState(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const claimFileInputRef = useRef(null);
  // Self-buy Claim Resolution state
  const [showSelfClaimResolution, setShowSelfClaimResolution] = useState(() => ['CLAIM_REPORTED', 'CLAIM_IN_PROGRESS'].includes(selectedPO?.status) && selectedPO?.purchaseChannel === 'SELF');
  const [selfClaimResolutionType, setSelfClaimResolutionType] = useState('RESEND');
  const [selfClaimNote, setSelfClaimNote] = useState('');
  const [selfClaimExpectedDate, setSelfClaimExpectedDate] = useState('');
  const [selfClaimRefundAmount, setSelfClaimRefundAmount] = useState('');
  const [isResolvingSelfClaim, setIsResolvingSelfClaim] = useState(false);
  const fileInputRef = useRef(null);

  // Pre-fill receiving qtys, locations, and problematic items state
  const initReceivingQtys = (fillAll = false) => {
    const qtys = {};
    const problems = {};
    selectedPO.items.forEach(item => {
      const ordered = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
      const received = Number(item.receivedQty) || 0;
      const remaining = Math.max(0, ordered - received);
      qtys[item.productId] = fillAll ? remaining : remaining;
      problems[item.productId] = {
        isProblematic: false,
        claimedQty: remaining || 1,
        reason: 'DAMAGED',
        description: '',
        photo: null
      };
    });
    setReceivingQtys(qtys);
    setProblematicItems(problems);
  };

  useEffect(() => {
    setVendors(storageService.getVendors());
    if (selectedPO?.items) {
      initReceivingQtys(true);
    }
  }, [selectedPO]);

  const handleToggleReceiving = () => {
    setShowReceivingPanel(p => !p);
  };

  const handleFillAll = () => initReceivingQtys(true);

  // Compress image file via HTML Canvas
  const compressImageFile = (file) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 1400;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve({
            name: file.name,
            size: Math.round(dataUrl.length * (3/4)),
            type: 'image/jpeg',
            previewUrl: dataUrl,
            dataUrl: dataUrl,
            uploadedAt: new Date().toLocaleString('th-TH')
          });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process and validate attachments (PDF max 2MB, Images compressed)
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);

    try {
      const processed = [];
      for (const file of files) {
        if (file.type === 'application/pdf') {
          if (file.size > 2 * 1024 * 1024) {
            modalService.warning('ขนาดไฟล์ PDF เกินกำหนด', `ไฟล์ "${file.name}" มีขนาดเกิน 2MB กรุณาลดขนาดไฟล์ก่อนแนบ`);
            continue;
          }
          const reader = new FileReader();
          const p = await new Promise((res) => {
            reader.onload = (re) => res({
              name: file.name,
              size: file.size,
              type: 'application/pdf',
              previewUrl: re.target.result,
              dataUrl: re.target.result,
              uploadedAt: new Date().toLocaleString('th-TH')
            });
            reader.readAsDataURL(file);
          });
          processed.push(p);
        } else if (file.type.startsWith('image/')) {
          const compressed = await compressImageFile(file);
          processed.push(compressed);
        } else {
          modalService.warning('รูปแบบไฟล์ไม่รองรับ', `ไฟล์ "${file.name}" ไม่ใช่รูปภาพหรือ PDF`);
        }
      }

      setGrAttachments(prev => [...prev, ...processed]);
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการอัปโหลดไฟล์', err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index) => {
    setGrAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReceiving = async () => {
    const receivingItems = selectedPO.items.map(item => ({
      productId: item.productId,
      receivedThisTime: Number(receivingQtys[item.productId]) || 0
    }));

    const hasProblematic = Object.values(problematicItems).some(p => p.isProblematic);
    const totalReceiving = receivingItems.reduce((s, r) => s + r.receivedThisTime, 0);

    // If no normal items received and no claims filed, reject
    if (totalReceiving <= 0 && !hasProblematic) {
      return modalService.warning('กรุณาระบุจำนวนที่รับ หรือทำเครื่องหมายรายการที่มีปัญหา');
    }

    // Validate defect descriptions and claimed quantities for problematic items
    for (const item of selectedPO.items) {
      const prob = problematicItems[item.productId];
      if (prob?.isProblematic) {
        const cQty = Number(prob.claimedQty) || 0;
        if (cQty <= 0) {
          return modalService.warning('กรุณาระบุจำนวนที่มีปัญหา/เคลม', `สำหรับรายการ "${item.name}"`);
        }
        if (!prob.description?.trim() && !prob.defectReason?.trim()) {
          return modalService.warning('กรุณาระบุรายละเอียดปัญหาของสินค้า', `สำหรับรายการ "${item.name}" ที่ทำเครื่องหมายว่าสินค้ามีปัญหา`);
        }
      }
    }

    const allRemaining = selectedPO.items.every(item => {
      const ordered = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
      const received = Number(item.receivedQty) || 0;
      const remaining = ordered - received;
      const thisReceive = Number(receivingQtys[item.productId]) || 0;
      return thisReceive >= remaining;
    });

    const confirmTitle = hasProblematic ? 'ยืนยันการตรวจรับพร้อมแจ้งเคลมสินค้า' : 'ยืนยันการตรวจรับสินค้า';
    const confirmMsg = hasProblematic
      ? `รายการที่ไม่มีปัญหาจะถูกบันทึกรับเข้าสต็อกปกติ ส่วนรายการที่ระบุ "มีปัญหา/เคลม" จะถูกส่งเข้าขั้นตอนการเคลม (สถานะ PO จะเปลี่ยนเป็น "CLAIM_REPORTED" เพื่อรอการแก้ไข)\n\nยืนยันบันทึกการตรวจรับและแจ้งเคลมใช่หรือไม่?`
      : allRemaining
        ? `ยืนยันตรวจรับสินค้าครบทุกรายการ และปิด PO ${selectedPO.poNo} หรือไม่?`
        : `ยืนยันตรวจรับสินค้าบางส่วนสำหรับ PO ${selectedPO.poNo} หรือไม่? (สถานะจะเป็น PARTIAL และยังมียอดค้างส่ง)`;

    const confirmed = await modalService.confirm({
      title: confirmTitle,
      message: confirmMsg,
      type: hasProblematic ? 'danger' : (allRemaining ? 'success' : 'warning'),
      confirmText: hasProblematic ? 'บันทึกรับของ & ส่งเรื่องเคลม' : (allRemaining ? 'ตรวจรับครบและปิด PO' : 'บันทึกการรับของ'),
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;

    setIsReceiving(true);
    try {
      await apiService.receiveGoods(
        selectedPO.id, 
        receivingItems, 
        currentRole, 
        receiveNote.trim(),
        {
          problematicItems,
          grAttachments
        }
      );
      if (hasProblematic) {
        await modalService.success(
          'บันทึกตรวจรับและส่งเรื่องเคลมแล้ว',
          `บันทึกรับของเข้าสต็อกบางส่วน และส่งเคสสินค้ามีปัญหาสำหรับ PO ${selectedPO.poNo} เรียบร้อยแล้ว (สถานะ: CLAIM_REPORTED)`
        );
      } else {
        await modalService.success(
          'ตรวจรับสินค้าสำเร็จ',
          `บันทึกการตรวจรับเข้าสต็อกสำหรับ PO ${selectedPO.poNo} เรียบร้อยแล้ว`
        );
      }
      onRefresh();
      onClose();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการตรวจรับ', err.message);
    } finally {
      setIsReceiving(false);
    }
  };

  const handleShortClosePO = async () => {
    const reason = await modalService.prompt({
      title: 'ปิดใบสั่งซื้อก่อนได้รับของครบ (Short-Close PO)',
      message: `ระบุเหตุผลในการปิด PO ${selectedPO.poNo} ที่ได้ของไม่ครบ (เช่น ร้านค้าเลิกผลิต/ไม่ส่งของที่เหลือแล้ว):`,
      placeholder: 'ระบุเหตุผลจำเป็นในการปิด PO ก่อนกำหนด...',
      required: true,
      confirmText: 'ยืนยันปิด PO ทันที',
      cancelText: 'ยกเลิก',
      type: 'warning'
    });
    if (!reason || !reason.trim()) return;

    setIsShortClosing(true);
    try {
      await apiService.shortClosePO(selectedPO.id, reason.trim(), currentRole);
      await modalService.success('ปิด PO เรียบร้อย', `ปิดใบสั่งซื้อ ${selectedPO.poNo} พร้อมบันทึกประวัติเรียบร้อยแล้ว`);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการปิด PO', err.message);
    } finally {
      setIsShortClosing(false);
    }
  };

  const handleAssignVendor = async () => {
    let finalVendorId = null;
    let finalVendorName = '';

    if (selectedPO.purchaseChannel === 'ONLINE') {
      if (!customVendorName.trim()) return modalService.warning('กรุณาระบุชื่อร้านค้าออนไลน์');
      finalVendorName = customVendorName.trim();
      finalVendorId = 'ONLINE';
    } else {
      if (!selectedVendorId) return modalService.warning('กรุณาเลือกผู้ขาย');
      finalVendorId = selectedVendorId;
      finalVendorName = vendors.find(v => v.id === selectedVendorId)?.name;
    }

    setIsAssigning(true);
    try {
      await apiService.assignVendorToPO(selectedPO.id, finalVendorId, finalVendorName, currentRole);
      await modalService.success('ระบุผู้ขายสำเร็จ', `กำหนดผู้จัดจำหน่ายสำหรับ PO ${selectedPO.poNo} เรียบร้อย`);
      onRefresh();
      onClose();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCancelPO = async () => {
    const reason = await modalService.prompt({
      title: 'ยกเลิกใบสั่งซื้อ (PO)',
      message: `กรุณาระบุเหตุผลในการยกเลิกใบสั่งซื้อเลขที่ ${selectedPO.poNo}:`,
      placeholder: 'ระบุเหตุผลในการยกเลิก...',
      required: true,
      confirmText: 'ยืนยันยกเลิก PO',
      cancelText: 'ปิด',
      type: 'danger'
    });
    if (!reason || !reason.trim()) return;

    setIsCancelling(true);
    try {
      await apiService.cancelPO(selectedPO.id, currentRole, reason.trim());
      await modalService.success('ยกเลิกสำเร็จ', `ยกเลิกใบสั่งซื้อ ${selectedPO.poNo} เรียบร้อยแล้ว`);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการยกเลิก', err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePrint = () => window.print();
  const [isCancelling, setIsCancelling] = useState(false);

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

  // Requester / Supervisor can receive goods (level 1, same dept, or admin)
  const canReceiveGoods = !isOnlinePurchaser && (
    currentRole?.id === 'ADMIN' ||
    currentRole?.roleId === 'ADMIN' ||
    (Number(currentRole?.level) === 1 && (currentRole?.department === 'ALL' || currentRole?.department === selectedPO.department))
  );
  const isReceivable = ['ISSUED', 'ORDERED_PENDING_DELIVERY', 'PARTIAL', 'IN_DELIVERY'].includes(selectedPO.status);

  // ─── Claim Permission Guard ───
  // Whether the current user can file a claim (report problem) on this PO
  const isClaimStatus = ['CLAIM_REPORTED', 'CLAIM_IN_PROGRESS'].includes(selectedPO.status);
  const canFileClaim = !isOnlinePurchaser &&
    !['CLOSED', 'CANCELLED'].includes(selectedPO.status) &&
    !isClaimStatus &&
    (currentRole?.canReceiveGoods || currentRole?.id === 'ADMIN' || currentRole?.roleId === 'ADMIN' ||
     currentRole?.department === selectedPO.department || currentRole?.canViewAllDepts);

  // Whether the current user can resolve a Self-buy Claim on this PO
  const canResolveSelfClaim = isClaimStatus &&
    selectedPO.purchaseChannel === 'SELF' &&
    (
      currentRole?.id === 'ADMIN' ||
      currentRole?.roleId === 'ADMIN' ||
      currentRole?.id === selectedPO.requesterId ||
      currentRole?.roleId === selectedPO.requesterId ||
      (currentRole?.canReceiveGoods && currentRole?.department === selectedPO.department) ||
      (currentRole?.canReview && (currentRole?.department === selectedPO.department || currentRole?.canViewAllDepts))
    );

  const handleResolveSelfClaim = async () => {
    if (selfClaimResolutionType === 'RESEND' && !selfClaimExpectedDate) {
      return modalService.warning('กรุณาระบุวันที่คาดว่าจะได้รับสินค้าใหม่');
    }
    // CLOSE_WITH_REFUND: validate refundAmount
    if (selfClaimResolutionType === 'CLOSE_WITH_REFUND') {
      const amt = Number(selfClaimRefundAmount);
      if (!selfClaimRefundAmount || isNaN(amt) || amt <= 0) {
        return modalService.warning('กรุณาระบุยอดเงินที่ได้รับคืน', 'ยอดเงินต้องมากกว่า 0 บาท');
      }
      const maxRefund = Number(selectedPO.grandTotal) || 0;
      if (maxRefund > 0 && amt > maxRefund) {
        return modalService.warning(
          'ยอดเงินคืนเกินยอดรวม PO',
          `ยอดเงินที่กรอก (฿${amt.toLocaleString()}) สูงกว่ายอดรวมใบสั่งซื้อ (฿${maxRefund.toLocaleString()}) กรุณาตรวจสอบอีกครั้ง`
        );
      }
    }
    if (!selfClaimNote.trim()) {
      return modalService.warning('กรุณาระบุหมายเหตุ/วิธีการดำเนินการ');
    }
    const refundDisplay = selfClaimResolutionType === 'CLOSE_WITH_REFUND'
      ? `\n\n💰 ยอดเงินคืน: ฿${Number(selfClaimRefundAmount).toLocaleString()} (จะถูกคืนงบประมาณให้ฝ่าย ${selectedPO.department} อัตโนมัติ)`
      : '';
    const confirmed = await modalService.confirm({
      title: 'ยืนยันผลการดำเนินการเคลม',
      message: `ยืนยันบันทึกผลการแก้ไขปัญหาสินค้า สำหรับ PO ${selectedPO.poNo} ใช่หรือไม่?${refundDisplay}`,
      confirmText: 'ยืนยันบันทึก',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;
    setIsResolvingSelfClaim(true);
    try {
      await apiService.resolveClaim(selectedPO.id, {
        type: selfClaimResolutionType,
        note: selfClaimNote.trim(),
        expectedDate: selfClaimExpectedDate,
        refundAmount: selfClaimResolutionType === 'CLOSE_WITH_REFUND'
          ? Math.round(Number(selfClaimRefundAmount) * 100) / 100
          : 0
      }, currentRole);
      await modalService.success('ดำเนินการเรียบร้อย', 'บันทึกการแก้ไขปัญหาสินค้าสำเร็จ');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
    } finally {
      setIsResolvingSelfClaim(false);
    }
  };

  const statusInfo = PO_STATUS[selectedPO.status] || { label: selectedPO.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };

  return createPortal(
    <>
      <div className="hidden print:block">
        <PrintablePO po={selectedPO} />
      </div>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
        <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
          
          {/* ── 1. Fixed Header (Sticky Top / Non-scrollable) ── */}
          <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex flex-col gap-3 sticky top-0 z-20">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-800">
                    {selectedPO.poNo}
                  </span>
                  
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${statusInfo.color}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                    {statusInfo.label}
                  </span>
                </div>

                {/* 4-Column Metadata Grid */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">อ้างอิงใบขอซื้อ (PR)</p>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 font-mono mt-0.5 truncate">
                      {selectedPO.prNo}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">แผนกต้นทาง</p>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5 truncate">
                      ฝ่าย {selectedPO.department}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">วันที่ออก PO</p>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 font-mono mt-0.5">
                      {selectedPO.issueDate}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">ช่องทางการซื้อ</p>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5 truncate">
                      {selectedPO.purchaseChannel === 'ONLINE' ? 'สั่งซื้อออนไลน์ (Online)' : 'จัดซื้อทั่วไป (Direct)'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
                  title="พิมพ์ใบสั่งซื้อ"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">พิมพ์ PO</span>
                </button>
                <button 
                  onClick={onClose} 
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer shrink-0" 
                  title="ปิดหน้าต่าง (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Content (Scrollable) ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-slate-50/50">
            
            {/* Vendor & Delivery Equal 2-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              
              {/* Vendor Info Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ผู้ขาย / ผู้จัดจำหน่าย (Vendor)</span>
                  </span>
                  
                  {selectedPO.vendorId ? (
                    <div className="pt-2">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">{selectedPO.vendorName}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        รหัสผู้ขาย: {selectedPO.vendorId === 'ONLINE' ? 'สั่งซื้อออนไลน์' : selectedPO.vendorId}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 mt-2 bg-amber-50/90 border border-amber-200/90 rounded-xl space-y-2.5 shadow-2xs">
                      <p className="text-amber-900 text-xs font-semibold flex items-center gap-1.5">
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
                            className="w-full text-xs bg-white border border-amber-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none"
                          />
                        ) : (
                          <select 
                            value={selectedVendorId}
                            onChange={e => setSelectedVendorId(e.target.value)}
                            className="w-full text-xs bg-white border border-amber-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none"
                          >
                            <option value="">-- เลือกผู้ขายจาก Master Data --</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        )}
                        <button 
                          onClick={handleAssignVendor}
                          disabled={isAssigning || (selectedPO.purchaseChannel === 'ONLINE' ? !customVendorName.trim() : !selectedVendorId)}
                          className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap"
                        >
                          {isAssigning ? 'บันทึก...' : 'บันทึกผู้ขาย'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery & PR Reference Info Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ข้อมูลการจัดส่ง & เอกสารอ้างอิง</span>
                  </span>
                  
                  <div className="space-y-2 text-xs pt-2">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>วันที่เปิดใบสั่งซื้อ (Issue Date):</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedPO.issueDate}</span>
                    </div>

                    {selectedPO.specUrl && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setViewingAttachment({ url: selectedPO.specUrl, title: 'เอกสารอ้างอิง / ลิงก์สินค้า' })}
                          className="w-full text-left flex items-center gap-2 bg-indigo-50/50 hover:bg-indigo-100/50 border border-indigo-100 p-2.5 rounded-lg transition-colors group cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                            <ExternalLink className="w-3 h-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs text-indigo-900 group-hover:text-indigo-700">ดูเอกสารอ้างอิงจาก PR</p>
                            <p className="text-[11px] text-indigo-600/80 truncate">{selectedPO.specUrl}</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* ── Active Claim Banner (Compact Alert) ── */}
            {isClaimStatus && selectedPO.claimData && (
              <div className="bg-rose-50/70 border border-rose-200/90 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-2.5 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-rose-950">
                          🚨 พบสินค้ามีปัญหา: {selectedPO.claimData.reason}
                        </span>
                        {selectedPO.claimRound > 0 && (
                          <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full font-mono">
                            รอบที่ {selectedPO.claimRound}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rose-800 mt-0.5 font-medium leading-relaxed">{selectedPO.claimData.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-[10px] text-rose-500">
                    <span>แจ้งโดย: {selectedPO.claimData.reportedBy || '-'}</span>
                    <span className="block font-mono text-rose-400 mt-0.5">{selectedPO.claimData.reportedAt || '-'}</span>
                  </div>
                </div>

                {/* Item-level Claim Breakdown Table if available */}
                {Array.isArray(selectedPO.claimData.claimDetails?.items || selectedPO.claimDetails?.items) && (selectedPO.claimData.claimDetails?.items || selectedPO.claimDetails?.items).length > 0 && (
                  <div className="bg-white/95 border border-rose-200/80 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-rose-600" />
                      <span>รายการสินค้าที่มีปัญหา ({(selectedPO.claimData.claimDetails?.items || selectedPO.claimDetails?.items).length} รายการ):</span>
                    </p>
                    <div className="space-y-1 divide-y divide-rose-100 text-xs">
                      {(selectedPO.claimData.claimDetails?.items || selectedPO.claimDetails?.items).map((it, cIdx) => (
                        <div key={cIdx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-slate-700">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold text-slate-900 truncate">• {it.name}</span>
                            <span className="text-[11px] text-rose-600 font-medium shrink-0">({it.reasonLabel || it.reason})</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-mono font-bold text-xs">
                              {it.claimedQty} {it.purchaseUnit || 'ชิ้น'}
                            </span>
                            {it.photo && (
                              <img
                                src={it.photo.previewUrl || it.photo.dataUrl}
                                alt="Defect"
                                className="w-7 h-7 rounded object-cover border border-rose-200 cursor-pointer"
                                onClick={() => setViewingAttachment(it.photo)}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Self-buy Claim Resolution Panel (Inside Scrollable Body!) ── */}
            {isClaimStatus && selectedPO.purchaseChannel === 'SELF' && showSelfClaimResolution && (
              <div className="bg-white border-2 border-rose-300 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4 animate-fade-in">
                {canResolveSelfClaim ? (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg shrink-0">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900">🔧 จัดการเคสสินค้ามีปัญหา (Self-buy Claim Resolution)</h3>
                          <p className="text-[11px] text-slate-500 font-normal">เลือกแนวทางแก้ไขปัญหาและระบุรายละเอียดเพื่อดำเนินการต่อ</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSelfClaimResolution(false)}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="ซ่อนแผง"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 3 Modern Sleek Radio Cards */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-2">
                        เลือกแนวทางการดำเนินการ <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Option 1: RESEND */}
                        <label className={`flex flex-col justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selfClaimResolutionType === 'RESEND'
                            ? 'bg-rose-50/70 border-rose-500 shadow-2xs text-rose-950 ring-1 ring-rose-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}>
                          <div className="flex items-start gap-2.5">
                            <input
                              type="radio"
                              name="selfClaimRes"
                              value="RESEND"
                              checked={selfClaimResolutionType === 'RESEND'}
                              onChange={() => setSelfClaimResolutionType('RESEND')}
                              className="text-rose-600 focus:ring-rose-500 w-4 h-4 mt-0.5 cursor-pointer"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-800">🔄 จัดซื้อใหม่ / ส่งทดแทน</p>
                              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                รอสินค้าชิ้นใหม่จากร้านค้า ➔ PO จะกลับไปสถานะ <strong>"รอตรวจรับ"</strong>
                              </p>
                            </div>
                          </div>
                        </label>

                        {/* Option 2: CLOSE_WITH_REFUND */}
                        <label className={`flex flex-col justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selfClaimResolutionType === 'CLOSE_WITH_REFUND'
                            ? 'bg-rose-50/70 border-rose-500 shadow-2xs text-rose-950 ring-1 ring-rose-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}>
                          <div className="flex items-start gap-2.5">
                            <input
                              type="radio"
                              name="selfClaimRes"
                              value="CLOSE_WITH_REFUND"
                              checked={selfClaimResolutionType === 'CLOSE_WITH_REFUND'}
                              onChange={() => setSelfClaimResolutionType('CLOSE_WITH_REFUND')}
                              className="text-rose-600 focus:ring-rose-500 w-4 h-4 mt-0.5 cursor-pointer"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-800">💰 ได้รับเงินคืน / ปิดงาน</p>
                              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                ร้านค้าโอนเงินคืนเรียบร้อย ➔ ปิดใบสั่งซื้อนี้ <strong>(CLOSED)</strong>
                              </p>
                            </div>
                          </div>
                        </label>

                        {/* Option 3: CLOSE_NO_ACTION */}
                        <label className={`flex flex-col justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selfClaimResolutionType === 'CLOSE_NO_ACTION'
                            ? 'bg-rose-50/70 border-rose-500 shadow-2xs text-rose-950 ring-1 ring-rose-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}>
                          <div className="flex items-start gap-2.5">
                            <input
                              type="radio"
                              name="selfClaimRes"
                              value="CLOSE_NO_ACTION"
                              checked={selfClaimResolutionType === 'CLOSE_NO_ACTION'}
                              onChange={() => setSelfClaimResolutionType('CLOSE_NO_ACTION')}
                              className="text-rose-600 focus:ring-rose-500 w-4 h-4 mt-0.5 cursor-pointer"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-800">❌ ยอมรับสภาพ / ปิดงาน</p>
                              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                ไม่สามารถเคลมได้ หรือยอมรับของ ➔ ปิดใบสั่งซื้อ <strong>(CLOSED)</strong>
                              </p>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Dynamic Contextual Inputs */}
                    <div className="space-y-3 pt-1">
                      {selfClaimResolutionType === 'RESEND' && (
                        <div className="animate-fade-in">
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            วันที่คาดว่าจะได้รับสินค้าใหม่ <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={selfClaimExpectedDate}
                            onChange={e => setSelfClaimExpectedDate(e.target.value)}
                            className="w-full sm:w-64 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                          />
                        </div>
                      )}

                      {selfClaimResolutionType === 'CLOSE_WITH_REFUND' && (
                        <div className="animate-fade-in bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
                          <div>
                            <label className="text-xs font-semibold text-emerald-900 block mb-1">
                              💰 ยอดเงินที่ได้รับคืนจากร้านค้า <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700 select-none">฿</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                max={selectedPO.grandTotal || undefined}
                                value={selfClaimRefundAmount}
                                onChange={e => setSelfClaimRefundAmount(e.target.value)}
                                placeholder={`0.00 (ยอดรวม PO: ฿${(selectedPO.grandTotal || 0).toLocaleString()})`}
                                className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                              />
                            </div>
                            <p className="text-[11px] text-emerald-700 mt-1.5 flex items-center gap-1.5 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                              จำนวนเงินนี้จะถูกคืนกลับเข้างบประมาณของฝ่าย {selectedPO.department} อัตโนมัติ
                            </p>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          วิธีดำเนินการ / บันทึกผลการประสานงาน <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={selfClaimNote}
                          onChange={e => setSelfClaimNote(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-20 resize-none"
                          placeholder="ระบุผลการติดต่อร้านค้า ข้อตกลง หรือเหตุผลที่ตัดสินใจ..."
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">อยู่ระหว่างผู้จัดซื้อ (Requester) ดำเนินการแก้ไข</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">ใบสั่งซื้อนี้อยู่ในสถานะ CLAIM — ผู้จัดซื้อต้นทางกำลังดำเนินการติดต่อหรือแก้ไขปัญหาอยู่</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Claim Form (Inside Scrollable Body!) ── */}
            {showClaimForm && canFileClaim && (
              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 sm:p-5 space-y-3.5 animate-fade-in shadow-2xs">
                <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>แจ้งเคลม / รายงานปัญหาสินค้า{selectedPO.purchaseChannel === 'ONLINE' ? ' (ออนไลน์)' : ' (จัดซื้อทั่วไป)'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowClaimForm(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-rose-100/50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">หัวข้อปัญหา <span className="text-rose-500">*</span></label>
                    <select 
                      value={claimReason} 
                      onChange={e => setClaimReason(e.target.value)} 
                      className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none cursor-pointer font-medium"
                    >
                      <option value="สินค้าชำรุด/เสียหาย">สินค้าชำรุด/เสียหาย</option>
                      <option value="สินค้าไม่ตรงสเปก/ผิดรุ่น">สินค้าไม่ตรงสเปก/ผิดรุ่น</option>
                      <option value="ได้รับสินค้าไม่ครบ">ได้รับสินค้าไม่ครบ</option>
                      <option value="อื่นๆ (ระบุในรายละเอียด)">อื่นๆ (ระบุในรายละเอียด)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">รายละเอียดปัญหา <span className="text-rose-500">*</span></label>
                    <textarea 
                      value={claimDescription} 
                      onChange={e => setClaimDescription(e.target.value)} 
                      className="w-full bg-white border border-rose-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none h-20 resize-none font-medium"
                      placeholder="อธิบายปัญหาที่พบ..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">รูปภาพประกอบ</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={claimFileInputRef} 
                      onChange={async (e) => {
                        if (e.target.files?.[0]) {
                          const compressed = await compressImageFile(e.target.files[0]);
                          setClaimPhoto(compressed);
                        }
                      }} 
                      className="hidden"
                    />
                    <div className="flex gap-3 items-center">
                      <button 
                        type="button" 
                        onClick={() => claimFileInputRef.current?.click()} 
                        className="px-3 py-1.5 bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-rose-600" />
                        <span>{claimPhoto ? 'เปลี่ยนรูปภาพ' : '+ อัปโหลดรูปภาพ'}</span>
                      </button>
                      {claimPhoto && (
                        <div className="relative group rounded-lg overflow-hidden border border-rose-200 shadow-2xs w-12 h-12 bg-slate-50">
                          <img src={claimPhoto.previewUrl} alt="Claim photo" className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => setClaimPhoto(null)} 
                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Items Table Card */}
            <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-50/80 px-4 py-3 sm:px-5 border-b border-slate-200/80 flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>รายการสินค้าที่สั่งซื้อ</span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">({selectedPO.items?.length || 0} รายการ)</span>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="pl-4 py-2.5 w-1 whitespace-nowrap">รหัสสินค้า</th>
                      <th className="py-2.5 px-3">ชื่อสินค้า</th>
                      <th className="text-center py-2.5 px-3 whitespace-nowrap">จำนวนสั่งซื้อ</th>
                      <th className="text-center py-2.5 px-3 whitespace-nowrap">รับแล้ว</th>
                      <th className="text-right py-2.5 px-3 whitespace-nowrap">ราคา/หน่วย (฿)</th>
                      <th className="text-right pr-4 py-2.5 whitespace-nowrap">รวมเงิน (฿)</th>
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
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 pl-4 whitespace-nowrap">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                              {item.code || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800 text-xs sm:text-sm leading-snug break-words max-w-sm" title={item.name}>{item.name}</div>
                            {item.onlineUrl && (
                              <a href={item.onlineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/70 px-2 py-0.5 rounded-md transition-colors font-medium">
                                <Globe className="w-3 h-3" />
                                <span>ลิงก์สินค้า</span>
                              </a>
                            )}
                            {rate > 1 && (
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">1 {pUnit} = {rate} {sUnit}</div>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div>
                              <span className="font-bold text-slate-800 font-mono text-xs sm:text-sm">{Number(pQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>{' '}
                              <span className="text-slate-500 text-xs font-medium">{pUnit}</span>
                              {isQtyChanged && (
                                <div className="text-[11px] text-amber-600 font-mono mt-0.5">ขอมา: {item.originalPurchaseQty} {pUnit}</div>
                              )}
                              {rate > 1 && (
                                <div className="text-[11px] text-slate-400 font-mono font-normal mt-0.5">(= {Number(sQty).toLocaleString()} {sUnit})</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold font-mono ${item.receivedQty >= pQty ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-600'}`}>
                              {Number(item.receivedQty || 0).toLocaleString()} {pUnit}
                            </span>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="font-mono font-semibold text-slate-700 text-xs sm:text-sm">฿{Number(price).toLocaleString()}</div>
                            {isPriceChanged && (
                              <div className="text-[11px] text-amber-600 font-mono line-through mt-0.5">เดิม ฿{Number(item.originalEstimatedPrice).toLocaleString()}</div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800 text-xs sm:text-sm pr-4 whitespace-nowrap">
                            ฿{(item.total || (price * pQty))?.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Breakdown & Grand Total Bar */}
              {(() => {
                const fin = selectedPO.financials;
                const hasDiscounts = (fin && fin.totalDiscount > 0) || (selectedPO.totalDiscount > 0);
                const hasVat = (fin && fin.vatAmount > 0) || (selectedPO.vat > 0);
                const hasRounding = fin && parseFloat(fin.roundingAdj) !== 0;

                return (
                  <div className="border-t border-slate-200/80 bg-slate-50/50 divide-y divide-slate-100">
                    <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-slate-600">
                      <span>มูลค่ารวมสินค้า (Sub Total):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ฿{(fin?.subtotal ?? selectedPO.subtotal ?? selectedPO.grandTotal)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {hasDiscounts && (
                      <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-rose-600">
                        <span>หัก ส่วนลดรวม (Total Discount):</span>
                        <span className="font-mono font-semibold">
                          -฿{(fin?.totalDiscount ?? selectedPO.totalDiscount)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {hasVat && (
                      <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-indigo-700">
                        <span>
                          ภาษีมูลค่าเพิ่ม (VAT 7%):
                          {fin?.vatMode === 'BEFORE_DISCOUNT' && (
                            <span className="text-[11px] text-slate-400 font-normal ml-1">(คิดก่อนหักส่วนลดท้ายบิล)</span>
                          )}
                        </span>
                        <span className="font-mono font-semibold">
                          +฿{(fin?.vatAmount ?? selectedPO.vat)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {hasRounding && (
                      <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-amber-700">
                        <span>ปรับเศษทศนิยม (Rounding Adjustment):</span>
                        <span className="font-mono font-semibold">
                          {parseFloat(fin.roundingAdj) > 0 ? `+฿${parseFloat(fin.roundingAdj).toFixed(2)}` : `-฿${Math.abs(parseFloat(fin.roundingAdj)).toFixed(2)}`}
                        </span>
                      </div>
                    )}

                    <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 sm:px-5 py-3 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-semibold text-slate-700">ยอดเงินสุทธิ (Grand Total):</span>
                      <span className="text-base sm:text-lg font-bold font-mono text-slate-900 tracking-tight">
                        ฿{(fin?.grandTotal ?? selectedPO.grandTotal)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Early Close Notice Banner */}
            {selectedPO.closedEarly && (
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3.5 flex items-start gap-2.5 shadow-2xs animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs sm:text-sm text-amber-900">ใบสั่งซื้อนี้ถูกปิดก่อนได้รับสินค้าครบ (Short-Closed PO)</h4>
                  <p className="text-xs text-amber-800/80">
                    <strong>เหตุผล:</strong> {selectedPO.shortCloseReason || 'ไม่ระบุเหตุผล'}
                  </p>
                </div>
              </div>
            )}

            {/* Historical Defective (NG) Items Notice */}
            {selectedPO.ngItems && selectedPO.ngItems.length > 0 && (
              <div className="bg-rose-50/80 border border-rose-200/90 rounded-xl p-4 space-y-2.5 shadow-2xs animate-fade-in">
                <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs sm:text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>บันทึกรายการสินค้ามีปัญหา / ชำรุด (Defective Items)</span>
                </div>
                <div className="divide-y divide-rose-200/60">
                  {selectedPO.ngItems.map((ng, i) => (
                    <div key={i} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                      <div className="font-medium text-rose-900">
                        <span className="font-semibold font-mono">[{ng.code || ng.productId}]</span> {ng.name}
                        <span className="text-rose-600 ml-2 font-semibold font-mono">จำนวน: {ng.qty} {ng.unit}</span>
                      </div>
                      <div className="text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200/80">
                        <span className="text-rose-700 font-semibold">อาการ:</span> {ng.defectReason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historical Goods Receipt Attachments */}
            {selectedPO.grAttachments && selectedPO.grAttachments.length > 0 && (
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs sm:text-sm">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <span>ภาพถ่ายและเอกสารจากการตรวจรับสินค้า (Receiving Attachments)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                  {selectedPO.grAttachments.map((att, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setViewingAttachment({ url: att.previewUrl || att.dataUrl, title: att.name })}
                      className="group relative bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-left hover:border-indigo-400 hover:shadow-2xs transition-all cursor-pointer overflow-hidden flex flex-col items-center"
                    >
                      {att.type === 'application/pdf' ? (
                        <div className="w-full h-20 bg-rose-50 rounded-lg flex flex-col items-center justify-center text-rose-600">
                          <FileText className="w-6 h-6" />
                          <span className="text-[10px] font-bold mt-1">PDF DOC</span>
                        </div>
                      ) : (
                        <img 
                          src={att.previewUrl || att.dataUrl} 
                          alt={att.name} 
                          className="w-full h-20 object-cover rounded-lg group-hover:scale-105 transition-transform" 
                        />
                      )}
                      <p className="text-[11px] font-medium text-slate-700 truncate w-full mt-1.5 text-center">{att.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Goods Receiving Panel */}
            {canReceiveGoods && isReceivable && showReceivingPanel && (
              <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-4 space-y-4 shadow-2xs animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200/70">
                  <span className="text-xs sm:text-sm font-semibold text-emerald-950 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>ตรวจรับสินค้าเข้าคลัง (Goods Receiving & Inspection)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFillAll}
                      className="text-xs font-semibold px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-2xs"
                    >
                      รับทั้งหมด (Fill All)
                    </button>
                  </div>
                </div>

                {/* Receiving Line Items */}
                <div className="space-y-3">
                  {selectedPO.items.map((item, idx) => {
                    const ordered = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
                    const received = Number(item.receivedQty) || 0;
                    const remaining = Math.max(0, ordered - received);
                    const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                    const isDefective = problematicItems[item.productId]?.isProblematic;
                    const thisQty = receivingQtys[item.productId] ?? 0;

                    return (
                      <div 
                        key={idx} 
                        className={`rounded-xl p-3.5 border transition-all shadow-2xs space-y-3 ${
                          isDefective 
                            ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-200' 
                            : 'bg-white border-emerald-200/80'
                        }`}
                      >
                        {/* Row Header & Quantity Inputs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                              <span className="font-mono text-[11px] text-slate-400">({item.code})</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              สั่ง: <span className="font-mono font-semibold text-slate-700">{ordered}</span> / 
                              รับแล้ว: <span className="font-mono font-semibold text-emerald-700">{received}</span> / 
                              คงเหลือ: <span className="font-mono font-semibold text-amber-700">{remaining}</span> {pUnit}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 flex-wrap">
                            {/* Problematic Checkbox */}
                            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                              isDefective 
                                ? 'bg-rose-600 border-rose-600 text-white font-semibold shadow-xs' 
                                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium'
                            }`}>
                              <input
                                type="checkbox"
                                checked={Boolean(isDefective)}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  setProblematicItems(prev => ({
                                    ...prev,
                                    [item.productId]: {
                                      isProblematic: checked,
                                      claimedQty: checked ? (prev[item.productId]?.claimedQty || remaining || 1) : 0,
                                      reason: prev[item.productId]?.reason || 'DAMAGED',
                                      description: prev[item.productId]?.description || '',
                                      photo: prev[item.productId]?.photo || null
                                    }
                                  }));
                                }}
                                className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                              />
                              <span className="text-xs flex items-center gap-1">
                                <AlertTriangle className={`w-3.5 h-3.5 ${isDefective ? 'text-white' : 'text-rose-600'}`} />
                                <span>มีปัญหา/เคลม</span>
                              </span>
                            </label>

                            {/* Normal Good Receipt Qty Input */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-slate-600">
                                รับปกติ:
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={remaining}
                                step="any"
                                value={thisQty}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setReceivingQtys(prev => ({ ...prev, [item.productId]: val }));
                                }}
                                disabled={remaining <= 0}
                                className="w-20 text-center text-xs font-mono font-semibold bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                              />
                              <span className="text-xs font-medium text-slate-500 min-w-[28px]">{pUnit}</span>
                            </div>
                          </div>
                        </div>

                        {/* ── Expandable Item Claim Accordion / Sub-card ── */}
                        {isDefective && (
                          <div className="p-4 bg-white/95 border border-rose-200 rounded-xl space-y-3 animate-fade-in shadow-2xs">
                            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                                <AlertOctagon className="w-4 h-4 text-rose-600" />
                                <span>ระบุรายละเอียดสินค้าที่มีปัญหา / เคลม</span>
                              </span>
                              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                * สินค้าส่วนนี้จะไม่ถูกบวกเข้าสต็อก และจะถูกส่งเรื่องเคลม
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Claimed Qty */}
                              <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">
                                  จำนวนที่มีปัญหา / ขาดส่ง <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="1"
                                    max={ordered}
                                    step="any"
                                    value={problematicItems[item.productId]?.claimedQty ?? (remaining || 1)}
                                    onChange={e => {
                                      const val = Math.max(1, Number(e.target.value));
                                      setProblematicItems(prev => ({
                                        ...prev,
                                        [item.productId]: {
                                          ...prev[item.productId],
                                          claimedQty: val
                                        }
                                      }));
                                    }}
                                    className="w-full text-xs font-mono font-bold bg-white border border-rose-300 rounded-lg px-3 py-2 text-rose-950 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                                  />
                                  <span className="text-xs font-semibold text-slate-600 shrink-0">{pUnit}</span>
                                </div>
                              </div>

                              {/* Defect Reason Dropdown */}
                              <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">
                                  สาเหตุปัญหา <span className="text-rose-500">*</span>
                                </label>
                                <select
                                  value={problematicItems[item.productId]?.reason || 'DAMAGED'}
                                  onChange={e => {
                                    const r = e.target.value;
                                    setProblematicItems(prev => ({
                                      ...prev,
                                      [item.productId]: {
                                        ...prev[item.productId],
                                        reason: r
                                      }
                                    }));
                                  }}
                                  className="w-full text-xs bg-white border border-rose-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none cursor-pointer"
                                >
                                  <option value="DAMAGED">💥 สินค้าชำรุด / เสียหาย / แตกหัก</option>
                                  <option value="SHORT_SHIPMENT">📦 ได้รับสินค้าไม่ครบ (ขาดส่ง)</option>
                                  <option value="WRONG_SPEC">⚠️ สินค้าไม่ตรงสเปก / ส่งผิดรุ่น</option>
                                  <option value="OTHER">📝 อื่นๆ (ระบุในรายละเอียด)</option>
                                </select>
                              </div>
                            </div>

                            {/* Description Textarea */}
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                รายละเอียดปัญหาเพิ่มเติม <span className="text-rose-500">*</span>
                              </label>
                              <textarea
                                value={problematicItems[item.productId]?.description || ''}
                                onChange={e => {
                                  const desc = e.target.value;
                                  setProblematicItems(prev => ({
                                    ...prev,
                                    [item.productId]: {
                                      ...prev[item.productId],
                                      description: desc,
                                      defectReason: desc
                                    }
                                  }));
                                }}
                                placeholder="อธิบายอาการ เช่น ชำรุด 2 ชิ้นระหว่างขนส่ง, ร้านค้าส่งของมาขาด 5 ชิ้น, หรือบรรจุภัณฑ์ฉีกขาด..."
                                className="w-full text-xs bg-white border border-rose-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none h-16 resize-none"
                              />
                            </div>

                            {/* Item Photo Upload */}
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                รูปถ่ายหลักฐานเฉพาะรายการนี้
                              </label>
                              <div className="flex items-center gap-3">
                                <label className="px-3 py-1.5 bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer">
                                  <Camera className="w-3.5 h-3.5 text-rose-600" />
                                  <span>{problematicItems[item.productId]?.photo ? 'เปลี่ยนรูปถ่าย' : '+ แนบรูปถ่ายสินค้ามีปัญหา'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      if (e.target.files?.[0]) {
                                        const compressed = await compressImageFile(e.target.files[0]);
                                        setProblematicItems(prev => ({
                                          ...prev,
                                          [item.productId]: {
                                            ...prev[item.productId],
                                            photo: compressed
                                          }
                                        }));
                                      }
                                    }}
                                  />
                                </label>
                                {problematicItems[item.productId]?.photo && (
                                  <div className="relative group rounded-lg overflow-hidden border border-rose-300 shadow-2xs w-14 h-14 bg-slate-100">
                                    <img src={problematicItems[item.productId].photo.previewUrl} alt="Defect" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => setProblematicItems(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], photo: null } }))}
                                      className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                      title="ลบรูป"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

                {/* Attachments Upload Section */}
                <div className="bg-white rounded-xl p-3.5 border border-emerald-200/80 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-indigo-600" />
                        <span>แนบรูปถ่ายสินค้า หรือเอกสารใบส่งของ (Proof of Delivery)</span>
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        รูปภาพจะถูกบีบอัดอัตโนมัติ • ไฟล์ PDF จำกัดขนาดไม่เกิน 2MB
                      </p>
                    </div>

                    <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{isUploading ? 'กำลังประมวลผล...' : '+ เพิ่มไฟล์/ถ่ายภาพ'}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Thumbnail Previews */}
                  {grAttachments.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
                      {grAttachments.map((file, idx) => (
                        <div key={idx} className="relative group bg-slate-50 border border-slate-200 rounded-lg p-1.5 overflow-hidden">
                          {file.type === 'application/pdf' ? (
                            <div className="h-16 bg-rose-50 rounded-lg flex flex-col items-center justify-center text-rose-600">
                              <FileText className="w-5 h-5" />
                              <span className="text-[9px] font-bold mt-0.5">PDF</span>
                            </div>
                          ) : (
                            <img src={file.previewUrl || file.dataUrl} alt={file.name} className="h-16 w-full object-cover rounded-lg" />
                          )}
                          <p className="text-[10px] font-medium text-slate-600 truncate mt-1 text-center">{file.name}</p>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-80 hover:opacity-100 shadow-xs cursor-pointer"
                            title="ลบไฟล์"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Actions: Note + Dynamic Submit + Short-Close PO Button */}
                <div className="space-y-2.5 pt-1">
                  <input
                    type="text"
                    value={receiveNote}
                    onChange={e => setReceiveNote(e.target.value)}
                    placeholder="หมายเหตุการรับของ (เพิ่มเติม เช่น สภาพสมบูรณ์, ตรวจนับตาม Packing List ครบถ้วน)"
                    className="w-full text-xs bg-white border border-emerald-300 rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  />

                  {/* Action Buttons Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                    {/* Short Close PO Button */}
                    <button
                      type="button"
                      onClick={handleShortClosePO}
                      disabled={isShortClosing || isReceiving}
                      className="w-full sm:w-auto px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="ปิด PO ทันทีแม้ได้ของไม่ครบ เช่น ร้านค้าแจ้งของหมด"
                    >
                      <AlertOctagon className="w-3.5 h-3.5 text-amber-700" />
                      <span>{isShortClosing ? 'กำลังปิด PO...' : 'ปิด PO (กรณีได้ของไม่ครบ)'}</span>
                    </button>

                    {/* Dynamic Submit Button */}
                    {Object.values(problematicItems).some(p => p.isProblematic) ? (
                      <button
                        type="button"
                        onClick={handleSubmitReceiving}
                        disabled={isReceiving || isShortClosing}
                        className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ring-2 ring-rose-200"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>{isReceiving ? 'กำลังบันทึก...' : '🚨 ยืนยันตรวจรับพร้อมแจ้งเคลมสินค้า (Receive & File Claim)'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitReceiving}
                        disabled={isReceiving || isShortClosing}
                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isReceiving ? 'กำลังบันทึก...' : (
                            selectedPO.items.every(item => {
                              const ord = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
                              const rec = Number(item.receivedQty) || 0;
                              const rem = ord - rec;
                              const th = Number(receivingQtys[item.productId]) || 0;
                              return th >= rem;
                            }) 
                              ? '✅ ยืนยันตรวจรับสินค้าครบถ้วน (Receive All & Close)' 
                              : '📦 ยืนยันตรวจรับสินค้าบางส่วน (Receive Partial)'
                          )}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Claim History Timeline */}
            {selectedPO.claimHistory && selectedPO.claimHistory.length > 0 && (
              <div className="bg-rose-50/50 border border-rose-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5 mb-4">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  <span>ประวัติการเคลมสินค้า (Claim History)</span>
                </span>
                
                <div className="space-y-4">
                  {selectedPO.claimHistory.map((claim, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 sm:p-4 border border-rose-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-rose-100 text-rose-800 px-3 py-1 text-[10px] font-bold rounded-bl-lg">
                        รอบที่ {claim.round}
                      </div>
                      
                      <div className="space-y-3 mt-2">
                        {/* Report Data */}
                        <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800">แจ้งปัญหา: {claim.reportData?.reason}</p>
                            <p className="text-xs text-slate-600 mt-1">{claim.reportData?.description}</p>
                            
                            {/* Item-level Claim Breakdown Table if available */}
                            {Array.isArray(claim.reportData?.claimDetails?.items) && claim.reportData.claimDetails.items.length > 0 && (
                              <div className="mt-2.5 border border-rose-100 bg-rose-50/40 rounded-lg p-2.5 space-y-1.5">
                                <p className="text-[11px] font-bold text-rose-900">รายการสินค้าที่มีปัญหา:</p>
                                <div className="space-y-1 text-xs">
                                  {claim.reportData.claimDetails.items.map((it, itIdx) => (
                                    <div key={itIdx} className="flex items-center justify-between text-[11px] text-slate-700 bg-white/80 p-1.5 rounded border border-rose-100/80">
                                      <span>• {it.name} <span className="font-semibold text-rose-700">({it.claimedQty} {it.purchaseUnit || 'ชิ้น'})</span></span>
                                      <span className="text-slate-500 font-medium">{it.reasonLabel || it.reason}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resolution Data */}
                        <div className="flex gap-3 items-start">
                          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              ผลการดำเนินการ:{' '}
                              {claim.resolution?.type === 'RESEND' ? 'รอรับสินค้าใหม่/เพิ่มเติม' :
                               claim.resolution?.type === 'CLOSE_WITH_REFUND' ? 'รับเงินคืน / ปิดงาน' :
                               'ยอมรับสภาพ / ปิดงาน'}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              หมายเหตุ: {claim.resolution?.note}
                            </p>
                            {claim.resolution?.expectedDate && (
                              <p className="text-xs text-slate-600 mt-1 font-medium">
                                คาดว่าจะได้รับของ: {claim.resolution?.expectedDate}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-2">
                              ดำเนินการโดย: {claim.resolvedBy} • {claim.resolvedAt}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Log Timeline */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>ประวัติการดำเนินงาน (Activity Timeline)</span>
              </span>

              <div className="relative pl-5 space-y-3.5 border-l border-slate-200 ml-2 pt-1">
                {selectedPO.activityLog?.map((log, idx) => (
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

          {/* ── 3. Sticky Action Footer (Non-scrollable) ── */}
          <div className="shrink-0 px-6 py-4 bg-slate-50/80 border-t border-slate-100 space-y-2.5 sticky bottom-0 z-20">
            
            {/* Online Purchaser Guidance Banner */}
            {isOnlinePurchaser && selectedPO.status !== 'CLOSED' && selectedPO.status !== 'CANCELLED' && (
              <div className="text-xs text-purple-800 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200/80 font-medium flex items-center gap-2">
                <Info className="w-4 h-4 text-purple-600 shrink-0" />
                <span>แผนกต้นทาง ({selectedPO.department}) จะเป็นผู้ตรวจรับสินค้าเข้าคลัง (+IN) และปิด PO</span>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              
              {/* Left Side: Close Modal + Cancel PO */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-white border border-slate-300/90 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>

                {isPOCancellable && canCancelPO && (
                  <button 
                    type="button"
                    onClick={handleCancelPO}
                    disabled={isCancelling}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิก PO'}</span>
                  </button>
                )}
              </div>

              {/* Right Side: Action Decisions */}
              <div className="flex items-center gap-2 ml-auto">
                {/* Self-buy Claim Resolution Active Toolbar */}
                {isClaimStatus && selectedPO.purchaseChannel === 'SELF' && showSelfClaimResolution ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSelfClaimResolution(false)}
                      className="px-4 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                    >
                      ยกเลิก / ซ่อนแผง
                    </button>
                    <button
                      type="button"
                      disabled={isResolvingSelfClaim || !selfClaimNote.trim()}
                      onClick={handleResolveSelfClaim}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer ring-2 ring-rose-200"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isResolvingSelfClaim ? 'กำลังบันทึก...' : 'ยืนยันการจัดการเคส'}</span>
                    </button>
                  </div>
                ) : showClaimForm ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowClaimForm(false)}
                      className="px-4 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingClaim || !claimDescription.trim()}
                      onClick={async () => {
                        setIsSubmittingClaim(true);
                        try {
                          const claimData = { reason: claimReason, description: claimDescription, photo: claimPhoto };
                          await apiService.fileOnlineClaim(selectedPO.id, claimData, currentRole);
                          await modalService.success('ส่งเรื่องเคลมสำเร็จ', 'ระบบได้แจ้งเตือนไปยังผู้สั่งซื้อออนไลน์แล้ว');
                          onRefresh();
                          onClose();
                        } catch (err) {
                          modalService.error('เกิดข้อผิดพลาด', err.message);
                        } finally {
                          setIsSubmittingClaim(false);
                        }
                      }}
                      className="px-5 py-2 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer ring-2 ring-rose-200"
                    >
                      <AlertOctagon className="w-4 h-4" />
                      <span>{isSubmittingClaim ? 'กำลังบันทึก...' : 'ยืนยันแจ้งปัญหา'}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Claim / Problem button: ONLINE or SELF (when not in CLAIM status) */}
                    {canFileClaim && (
                      <button
                        onClick={() => setShowClaimForm(p => !p)}
                        className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          showClaimForm ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{showClaimForm ? 'ซ่อนฟอร์มเคลม' : (
                          selectedPO.purchaseChannel === 'ONLINE' ? 'แจ้งเคลม / ปัญหาสินค้า' : 'แจ้งปัญหาสินค้า'
                        )}</span>
                      </button>
                    )}

                    {/* Self-buy Claim Resolution button (only for CLAIM status + authorized user) */}
                    {isClaimStatus && selectedPO.purchaseChannel === 'SELF' && canResolveSelfClaim && (
                      <button
                        onClick={() => setShowSelfClaimResolution(p => !p)}
                        className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          showSelfClaimResolution ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{showSelfClaimResolution ? 'ซ่อนแผง' : 'จัดการเคสปัญหา'}</span>
                      </button>
                    )}

                    {/* Online Purchaser: Mark as ordered */}
                    {(selectedPO.status === 'ISSUED' || selectedPO.status === 'IN_PROGRESS_ONLINE') &&
                     (currentRole.id === 'ADMIN' || currentRole.canOnlinePurchase || currentRole.roleId === 'ONLINE_PURCHASER') && (
                      <button
                        onClick={async () => {
                          const targetStatus = selectedPO.purchaseChannel === 'ONLINE' ? 'ORDERED_PENDING_DELIVERY' : 'IN_DELIVERY';
                          const confirmed = await modalService.confirm({
                            title: 'ยืนยันการสั่งซื้อสินค้า',
                            message: `ยืนยันบันทึกว่าสั่งซื้อสินค้าเรียบร้อยแล้วสำหรับ PO ${selectedPO.poNo} หรือไม่?`,
                            confirmText: 'ยืนยันสั่งซื้อแล้ว',
                            cancelText: 'ยกเลิก'
                          });
                          if (confirmed) {
                            try {
                              await apiService.updatePOStatus(selectedPO.id, targetStatus, currentRole);
                              await modalService.success('บันทึกสั่งซื้อแล้ว', `บันทึกสถานะ PO ${selectedPO.poNo} เป็นกำลังจัดส่งเรียบร้อย`);
                              onRefresh();
                              onClose();
                            } catch (err) { modalService.error('เกิดข้อผิดพลาด', err.message); }
                          }
                        }}
                        disabled={!selectedPO.vendorId}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>บันทึกสั่งซื้อแล้ว</span>
                      </button>
                    )}

                    {/* Requester: Toggle goods receiving panel */}
                    {canReceiveGoods && isReceivable && (
                      <button
                        onClick={handleToggleReceiving}
                        className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          showReceivingPanel
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{showReceivingPanel ? 'ซ่อนฟอร์มรับสินค้า' : 'รับสินค้าเข้าคลัง (+IN)'}</span>
                      </button>
                    )}

                    {selectedPO.status === 'CLOSED' && (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>รับเข้าคลังครบแล้ว (+IN)</span>
                      </div>
                    )}
                  </>
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
