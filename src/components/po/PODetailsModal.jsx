import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PO_STATUS } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { modalService } from '../../services/modalService';
import { useAppContext } from '../../context/AppContext';
import { 
  Printer, Download, History, XCircle, CheckCircle, AlertTriangle, 
  ExternalLink, ShoppingCart, Info, X, Building2, Calendar, FileText, 
  CheckCircle2, Store, Truck, ArrowRight, MapPin, AlertOctagon,
  UploadCloud, Paperclip, Camera, Trash2, Eye, ShieldAlert, Check, Percent, Globe, Package,
  RotateCcw, Coins, ChevronRight
} from 'lucide-react';
import PrintablePO from './PrintablePO';
import AttachmentViewerModal from '../common/AttachmentViewerModal';
import CollapsibleActivityTimeline from '../common/CollapsibleActivityTimeline';
import { generatePoPdf } from '../../utils/generatePoPdf';
import { sanitizeExternalUrl, getProductUrl } from '../../utils/urlHelper';

const getVendorDisplayName = (vendorData) => {
  if (!vendorData) return '';
  if (typeof vendorData === 'string') return vendorData;
  if (typeof vendorData === 'object') {
    return vendorData.name || vendorData.companyName || vendorData.code || '-';
  }
  return String(vendorData);
};

export default function PODetailsModal({ selectedPO, currentRole, onClose, onRefresh }) {
  const context = useAppContext();
  const currentUser = context?.currentUser;
  const rawRole = typeof currentUser?.role === 'object' 
    ? (currentUser?.role?.id || currentUser?.role?.name || '') 
    : (currentUser?.role || currentRole?.roleId || currentRole?.id || '');
  const role = String(rawRole).toLowerCase();

  const isOperational = ['requester', 'asst_mgr', 'supervisor'].some(r => role.includes(r));
  const isPlantManager = role.includes('plant_mgr') || role.includes('plant manager');
  const isPurchaser = role.includes('purchaser');

  const rawVendorName = selectedPO.vendorName && selectedPO.vendorName !== 'Shopee / Lazada (ระบุร้านภายหลัง)' ? selectedPO.vendorName : '';
  const displayVendor = getVendorDisplayName(selectedPO.vendor || selectedPO.shopName || rawVendorName);
  const hasAssignedVendor = Boolean((selectedPO.vendorId && selectedPO.vendorId !== 'ONLINE') || (displayVendor && displayVendor.trim().length > 0) || (selectedPO.vendorId === 'ONLINE' && displayVendor));

  const [isReceiving, setIsReceiving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Unified Action State: 'NONE' = view mode, 'RECEIVE' = goods receiving, 'CLAIM' = report claim
  const [activeAction, setActiveAction] = useState('NONE');
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
    // 1. Immediate Double-Click Guard
    if (isSubmitting || isReceiving) return;
    setIsSubmitting(true);

    const receivingItems = selectedPO.items.map(item => ({
      productId: item.productId,
      receivedThisTime: Number(receivingQtys[item.productId]) || 0
    }));

    const hasProblematic = Object.values(problematicItems).some(p => p.isProblematic);
    const totalReceiving = receivingItems.reduce((s, r) => s + r.receivedThisTime, 0);

    // If no normal items received and no claims filed, reject
    if (totalReceiving <= 0 && !hasProblematic) {
      setIsSubmitting(false);
      return modalService.warning('กรุณาระบุจำนวนที่รับ หรือทำเครื่องหมายรายการที่มีปัญหา');
    }

    // 2. Validate Defect Details & Quantity Boundaries (receivedQty + incomingQty <= orderedQty)
    for (const item of selectedPO.items) {
      const prob = problematicItems[item.productId];
      if (prob?.isProblematic) {
        const cQty = Number(prob.claimedQty) || 0;
        if (cQty <= 0) {
          setIsSubmitting(false);
          return modalService.warning('กรุณาระบุจำนวนที่มีปัญหา/เคลม', `สำหรับรายการ "${item.name}"`);
        }
        if (!prob.description?.trim() && !prob.defectReason?.trim()) {
          setIsSubmitting(false);
          return modalService.warning('กรุณาระบุรายละเอียดปัญหาของสินค้า', `สำหรับรายการ "${item.name}" ที่ทำเครื่องหมายว่าสินค้ามีปัญหา`);
        }
      }

      const ordered = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
      const alreadyReceived = Number(item.receivedQty) || 0;
      const incoming = Number(receivingQtys[item.productId]) || 0;

      if (incoming < 0) {
        setIsSubmitting(false);
        return modalService.warning('จำนวนรับไม่ถูกต้อง', `จำนวนรับสำหรับรายการ "${item.name}" ต้องไม่ติดลบ`);
      }

      if (alreadyReceived + incoming > ordered) {
        setIsSubmitting(false);
        return modalService.warning(
          'จำนวนรับเกินยอดสั่งซื้อ (Quantity Boundary Exceeded)',
          `รายการ "${item.name}" สั่งซื้อ ${ordered} ${item.purchaseUnit || item.unit || 'ชิ้น'} รับไปแล้ว ${alreadyReceived} จะรับเพิ่ม ${incoming} (ยอดรวม ${alreadyReceived + incoming} เกินกว่าจำนวนที่สั่งซื้อใน PO)`
        );
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
    if (!confirmed) {
      setIsSubmitting(false);
      return;
    }

    setIsReceiving(true);
    // 3. Unique GR Identifier Generation
    const grNumber = `GR-${selectedPO.poNo || selectedPO.id}-${Date.now()}`;

    try {
      const receiveAction = context?.receivePOItems || context?.receiveGoods || apiService.receiveGoods;
      await receiveAction(
        selectedPO.id, 
        receivingItems, 
        receiveNote.trim(),
        {
          grNumber,
          grId: grNumber,
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
        // Cascading Completion on 100% Goods Receipt
        if (allRemaining) {
          if (context?.updatePO) {
            context.updatePO(selectedPO.id, { status: 'completed', fullyReceivedAt: new Date().toISOString() });
          }
          const prTarget = selectedPO.prNumber || selectedPO.prNo || selectedPO.prId;
          if (prTarget && context?.updatePR) {
            context.updatePR(prTarget, { status: 'completed' });
          }
        }
        await modalService.success(
          'ตรวจรับสินค้าสำเร็จ',
          `บันทึกการตรวจรับเข้าสต็อกสำหรับ PO ${selectedPO.poNo} เรียบร้อยแล้ว (เลขที่อ้างอิง: ${grNumber})`
        );
      }
      onRefresh();
      onClose();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการตรวจรับ', err.message);
    } finally {
      setIsSubmitting(false);
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
      selectedPO.vendor = finalVendorName;
      selectedPO.vendorName = finalVendorName;
      selectedPO.shopName = finalVendorName;
      selectedPO.vendorId = finalVendorId;
      if (context?.updatePO) {
        context.updatePO(selectedPO.id, {
          vendor: finalVendorName,
          vendorName: finalVendorName,
          shopName: finalVendorName,
          vendorId: finalVendorId
        });
      }
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

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const handlePrint = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await generatePoPdf(selectedPO);
    } catch (err) {
      console.error('Failed to generate PO PDF:', err);
      modalService.error('สร้าง PDF ไม่สำเร็จ', err?.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดเอกสาร PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };
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

  // Lifecycle State Guard: ตรวจสอบว่าผ่านขั้นตอนสั่งซื้อไปแล้วหรือยัง (ต้องเริ่มจัดส่งหรือตรวจรับแล้วเท่านั้น)
  const po = selectedPO;
  const eligibleClaimStatuses = ['in_delivery', 'delivery', 'delivered', 'received', 'partial', 'partially_received', 'completed'];
  const isDeliveredOrBeyond = eligibleClaimStatuses.some(st => String(po?.status).toLowerCase().includes(st));

  // อนุญาตเฉพาะ Operational Role และสถานะต้องถึงขั้นส่งของ/รับของแล้วเท่านั้น
  const canReportClaim = isOperational && isDeliveredOrBeyond && canFileClaim;

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

  // ─── PO Lifecycle Steps ───
  const lifecycleSteps = [
    { key: 'ISSUED',                    label: 'ออก PO' },
    { key: 'ORDERED_PENDING_DELIVERY',  label: 'สั่งซื้อแล้ว' },
    { key: 'IN_DELIVERY',               label: 'กำลังส่ง' },
    { key: 'PARTIAL',                   label: 'รับบางส่วน' },
    { key: 'RECEIVED',                  label: 'รับครบ' },
    { key: 'CLOSED',                    label: 'ปิด PO' },
  ];
  const specialStatuses = ['CANCELLED', 'CLAIM_REPORTED', 'CLAIM_IN_PROGRESS'];
  const isSpecial = specialStatuses.includes(selectedPO.status);
  const currentStepIndex = isSpecial ? -1 : lifecycleSteps.findIndex(s => s.key === selectedPO.status);

  return createPortal(
    <>
      <div className="hidden print:block font-sarabun">
        <PrintablePO po={selectedPO} />
      </div>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
        <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
          {/* ── ZONE 1: Modern High-End Header & Segmented Ribbon (Linear / Raycast Style) ── */}
          <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-20">
            {/* Top Action Bar: PO ID & Subtitle on Left, Controls on Right */}
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-black font-mono tracking-tight text-slate-900">
                    {selectedPO.poNo || selectedPO.id}
                  </h2>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    selectedPO.status === 'CLOSED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                      : `${statusInfo.color} shadow-2xs`
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedPO.status === 'CLOSED' ? 'bg-emerald-500' : 'bg-current opacity-80'
                    } animate-pulse`}></span>
                    {statusInfo.label}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>อ้างอิง {selectedPO.prNo || '-'}</span>
                  <span className="text-slate-300">•</span>
                  <span>ฝ่าย {selectedPO.department}</span>
                  <span className="text-slate-300">•</span>
                  {selectedPO.purchaseChannel === 'ONLINE' ? (
                    <span className="text-purple-600 font-semibold">จัดซื้อออนไลน์</span>
                  ) : (
                    <span className="text-slate-600 font-semibold">จัดซื้อทั่วไป</span>
                  )}
                  {selectedPO.issueDate && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono text-slate-400">{selectedPO.issueDate}</span>
                    </>
                  )}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  type="button"
                  onClick={handlePrint} 
                  disabled={isGeneratingPdf}
                  className="h-8 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="พิมพ์ PO / ดาวน์โหลด PDF"
                >
                  {isGeneratingPdf ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                      <span className="hidden sm:inline text-indigo-600">กำลังสร้าง PDF...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden sm:inline">พิมพ์ PO</span>
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={onClose} 
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modern Segmented Progress Ribbon */}
            {!isSpecial && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 mt-4 overflow-x-auto scrollbar-none">
                <div className="flex items-center justify-between gap-1 min-w-[500px] sm:min-w-0">
                  {lifecycleSteps.map((step, i) => {
                    const isAllCompleted = selectedPO.status === 'CLOSED';
                    const isDone = isAllCompleted || (currentStepIndex >= 0 && i < currentStepIndex);
                    const isCurrent = !isAllCompleted && (i === currentStepIndex);
                    const isLast = i === lifecycleSteps.length - 1;

                    return (
                      <React.Fragment key={step.key}>
                        <div 
                          className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl transition-all flex-1 min-w-0 ${
                            isCurrent 
                              ? 'bg-white shadow-2xs border border-indigo-200/90' 
                              : isDone 
                                ? 'bg-emerald-50/70 border border-emerald-100/80' 
                                : 'bg-slate-100/60 border border-transparent'
                          }`}
                        >
                          {isDone ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                              <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-slate-200/80 flex items-center justify-center shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            </div>
                          )}
                          <span className={`text-[11px] font-semibold truncate ${
                            isCurrent 
                              ? 'text-indigo-700 font-bold' 
                              : isDone 
                                ? 'text-slate-700' 
                                : 'text-slate-400'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        {!isLast && (
                          <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${
                            isDone ? 'text-emerald-400' : 'text-slate-300'
                          }`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Status Banner */}
            {isSpecial && (
              <div className={`mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                selectedPO.status === 'CANCELLED'
                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>
                  {selectedPO.status === 'CANCELLED' ? 'ใบสั่งซื้อนี้ถูกยกเลิกแล้ว' :
                   selectedPO.status === 'CLAIM_REPORTED' ? '🚨 มีการแจ้งปัญหาสินค้า — รอดำเนินการแก้ไข' :
                   '🔧 อยู่ระหว่างดำเนินการแก้ไขปัญหาสินค้า'}
                </span>
              </div>
            )}
          </div>

          {/* ════ ZONE 2 — SCROLLABLE BODY ════ */}
          <div className="flex-1 overflow-y-auto bg-slate-50/40" style={{ scrollbarWidth: 'thin' }}>
            <div className="p-4 sm:p-5 space-y-4">

              {/* Vendor + Delivery 2-col grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    <Store className="w-3.5 h-3.5 text-indigo-500" />
                    ผู้ขาย / Vendor
                  </div>
                  {hasAssignedVendor ? (
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-2">
                        <span>🏪</span>
                        <span>{displayVendor || getVendorDisplayName(selectedPO.vendorName) || selectedPO.vendorId}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {selectedPO.purchaseChannel === 'ONLINE' ? 'สั่งซื้อออนไลน์' : (selectedPO.vendorId || 'ผู้ขาย')}
                      </p>
                    </div>
                  ) : (isPurchaser || role === 'admin') ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />รอระบุผู้ขาย
                      </p>
                      <div className="flex gap-2">
                        {selectedPO.purchaseChannel === 'ONLINE' ? (
                          <input type="text" value={customVendorName} onChange={e => setCustomVendorName(e.target.value)}
                            placeholder="ชื่อร้านค้าออนไลน์ (Shopee / Lazada...)"
                            className="flex-1 text-xs bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-400/30 outline-none" />
                        ) : (
                          <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)}
                            className="flex-1 text-xs bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-400/30 outline-none">
                            <option value="">-- เลือกผู้ขาย --</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        )}
                        <button onClick={handleAssignVendor}
                          disabled={isAssigning || (selectedPO.purchaseChannel === 'ONLINE' ? !customVendorName.trim() : !selectedVendorId)}
                          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                          {isAssigning ? 'บันทึก...' : 'บันทึก'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg font-medium">รอฝ่ายจัดซื้อระบุร้านค้า</p>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" />
                    การจัดส่ง & อ้างอิง
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>วันที่ออก PO</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedPO.issueDate}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>ช่องทางการซื้อ</span>
                      <span className="font-semibold text-slate-800">{selectedPO.purchaseChannel === 'ONLINE' ? 'ออนไลน์' : 'จัดซื้อตรง'}</span>
                    </div>
                    {selectedPO.specUrl && (
                      <button type="button"
                        onClick={() => setViewingAttachment({ url: selectedPO.specUrl, title: 'เอกสารอ้างอิง / ลิงก์สินค้า' })}
                        className="w-full flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-100 p-2 rounded-lg transition-colors cursor-pointer text-left mt-1">
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-indigo-800">ดูเอกสารอ้างอิง PR</p>
                          <p className="text-[10px] text-indigo-400 truncate">{selectedPO.specUrl}</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Claim Banner */}
              {isClaimStatus && selectedPO.claimData && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-rose-100 rounded-lg shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-rose-900">
                          🚨 พบสินค้ามีปัญหา: {selectedPO.claimData.reason}
                          {selectedPO.claimRound > 0 && (
                            <span className="ml-2 text-[10px] font-bold bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full font-mono">รอบที่ {selectedPO.claimRound}</span>
                          )}
                        </p>
                        <p className="text-xs text-rose-700 mt-0.5">{selectedPO.claimData.description}</p>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-rose-400 shrink-0">
                      <span>{selectedPO.claimData.reportedBy || '-'}</span>
                      <span className="block font-mono mt-0.5">{selectedPO.claimData.reportedAt || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Self-buy Claim Resolution Panel */}
              {isClaimStatus && selectedPO.purchaseChannel === 'SELF' && showSelfClaimResolution && (
                <div className="bg-white border-2 border-rose-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-rose-100 rounded-lg"><ShieldAlert className="w-4 h-4 text-rose-600" /></div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">🔧 จัดการเคสสินค้ามีปัญหา</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">เลือกแนวทางแก้ไขและระบุรายละเอียด</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowSelfClaimResolution(false)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {canResolveSelfClaim ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { value: 'RESEND', icon: '🔄', label: 'จัดซื้อใหม่ / ส่งทดแทน', desc: 'รอสินค้าชิ้นใหม่ → PO กลับสู่สถานะ "รอตรวจรับ"' },
                          { value: 'CLOSE_WITH_REFUND', icon: '💰', label: 'ได้รับเงินคืน / ปิดงาน', desc: 'ร้านค้าโอนเงินคืน → ปิด PO (CLOSED)' },
                          { value: 'CLOSE_NO_ACTION', icon: '❌', label: 'ยอมรับสภาพ / ปิดงาน', desc: 'ไม่เคลม หรือยอมรับของ → ปิด PO (CLOSED)' },
                        ].map(opt => (
                          <label key={opt.value} className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            selfClaimResolutionType === opt.value ? 'bg-rose-50 border-rose-400' : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}>
                            <div className="flex items-start gap-2">
                              <input type="radio" name="selfClaimRes" value={opt.value}
                                checked={selfClaimResolutionType === opt.value}
                                onChange={() => setSelfClaimResolutionType(opt.value)}
                                className="w-3.5 h-3.5 mt-0.5 cursor-pointer text-rose-600" />
                              <div>
                                <p className="text-xs font-bold text-slate-800">{opt.icon} {opt.label}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{opt.desc}</p>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      {selfClaimResolutionType === 'RESEND' && (
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">วันที่คาดว่าจะได้รับสินค้าใหม่ <span className="text-rose-500">*</span></label>
                          <input type="date" value={selfClaimExpectedDate} onChange={e => setSelfClaimExpectedDate(e.target.value)}
                            className="w-full sm:w-56 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:bg-white outline-none focus:ring-2 focus:ring-rose-400/20 focus:border-rose-400" />
                        </div>
                      )}
                      {selfClaimResolutionType === 'CLOSE_WITH_REFUND' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                          <label className="text-xs font-semibold text-emerald-900 block">💰 ยอดเงินที่ได้รับคืน <span className="text-rose-500">*</span></label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">฿</span>
                            <input type="number" min="0.01" step="0.01" value={selfClaimRefundAmount}
                              onChange={e => setSelfClaimRefundAmount(e.target.value)}
                              placeholder={`0.00 (รวม PO: ฿${(selectedPO.grandTotal || 0).toLocaleString()})`}
                              className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-500" />
                          </div>
                          <p className="text-[10px] text-emerald-700 font-medium">ยอดนี้จะถูกคืนกลับเข้างบประมาณฝ่าย {selectedPO.department} อัตโนมัติ</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">บันทึกผลการประสานงาน <span className="text-rose-500">*</span></label>
                        <textarea value={selfClaimNote} onChange={e => setSelfClaimNote(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-rose-400/20 focus:border-rose-400 h-20 resize-none"
                          placeholder="ระบุผลการติดต่อร้านค้า ข้อตกลง หรือเหตุผลที่ตัดสินใจ..." />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">อยู่ระหว่างผู้จัดซื้อดำเนินการแก้ไข</p>
                        <p className="text-[11px] text-amber-700 mt-0.5">PO นี้อยู่ในสถานะ CLAIM — รอผู้จัดซื้อต้นทางประสานงานแก้ไขปัญหา</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Items Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    รายการสินค้าที่สั่งซื้อ
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded-full">{selectedPO.items?.length || 0} รายการ</span>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="pl-4 pr-3 py-2.5 whitespace-nowrap">รหัส</th>
                        <th className="px-3 py-2.5">ชื่อสินค้า</th>
                        <th className="text-center px-3 py-2.5 whitespace-nowrap">จำนวนสั่ง</th>
                        <th className="text-center px-3 py-2.5 whitespace-nowrap">รับแล้ว</th>
                        <th className="text-right px-3 py-2.5 whitespace-nowrap">ราคา/หน่วย</th>
                        <th className="text-right pl-3 pr-4 py-2.5 whitespace-nowrap">รวม (฿)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPO.items.map((item, idx) => {
                        const pQty = item.purchaseQty ?? item.qty;
                        const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                        const price = item.unitPrice || item.estimatedPrice || item.price || 0;
                        const isFullyReceived = Number(item.receivedQty || 0) >= Number(pQty);
                        return (
                          <tr key={idx} className={`hover:bg-slate-50/60 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/20' : ''}`}>
                            <td className="pl-4 pr-3 py-3 whitespace-nowrap">
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{item.code || '-'}</span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-800 leading-snug break-words max-w-xs">{item.name}</div>
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
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/60 transition-all shadow-2xs group"
                                    >
                                      <span>ดูร้านค้าออนไลน์</span>
                                      <ExternalLink className="w-3 h-3 text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </a>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span className="font-bold font-mono text-slate-800">{Number(pQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>{' '}
                              <span className="text-slate-400">{pUnit}</span>
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[11px] ${isFullyReceived ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-600'}`}>
                                {Number(item.receivedQty || 0).toLocaleString()} {pUnit}
                              </span>
                              {isFullyReceived && <Check className="w-3 h-3 text-emerald-500 inline ml-1" />}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap font-mono font-semibold text-slate-700">฿{Number(price).toLocaleString()}</td>
                            <td className="pl-3 pr-4 py-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">฿{(item.total || (price * pQty))?.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Grand Total bar */}
                <div className="border-t border-slate-200 bg-slate-800 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">ยอดสุทธิ (Grand Total)</span>
                  <span className="text-base font-bold font-mono text-white tracking-tight">
                    ฿{((selectedPO.financials?.grandTotal ?? selectedPO.grandTotal) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Short Close Banner */}
              {selectedPO.closedEarly && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-xs text-amber-900">ปิด PO ก่อนรับของครบ (Short-Closed)</h4>
                    <p className="text-xs text-amber-700 mt-0.5"><strong>เหตุผล:</strong> {selectedPO.shortCloseReason || 'ไม่ระบุ'}</p>
                  </div>
                </div>
              )}

              {/* NG Items */}
              {selectedPO.ngItems && selectedPO.ngItems.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-rose-800">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    บันทึกสินค้าชำรุด (Defective Items)
                  </div>
                  <div className="divide-y divide-rose-200/50">
                    {selectedPO.ngItems.map((ng, i) => (
                      <div key={i} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
                        <div className="font-medium text-rose-900">
                          <span className="font-semibold font-mono">[{ng.code || ng.productId}]</span> {ng.name}
                          <span className="text-rose-600 ml-2 font-mono">{ng.qty} {ng.unit}</span>
                        </div>
                        <div className="text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200/70 text-[11px]">
                          <span className="text-rose-700 font-semibold">อาการ:</span> {ng.defectReason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GR Attachments */}
              {selectedPO.grAttachments && selectedPO.grAttachments.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                    <Camera className="w-4 h-4 text-indigo-500" />
                    ภาพถ่ายและเอกสารการตรวจรับ
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {selectedPO.grAttachments.map((att, i) => (
                      <button key={i} type="button"
                        onClick={() => setViewingAttachment({ url: att.previewUrl || att.dataUrl, title: att.name })}
                        className="group bg-slate-50 border border-slate-200 rounded-xl p-1.5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer flex flex-col items-center">
                        {att.type === 'application/pdf' ? (
                          <div className="w-full h-16 bg-rose-50 rounded-lg flex flex-col items-center justify-center text-rose-500">
                            <FileText className="w-5 h-5" /><span className="text-[9px] font-bold mt-0.5">PDF</span>
                          </div>
                        ) : (
                          <img src={att.previewUrl || att.dataUrl} alt={att.name} className="w-full h-16 object-cover rounded-lg group-hover:scale-105 transition-transform" />
                        )}
                        <p className="text-[10px] font-medium text-slate-600 truncate w-full mt-1 text-center">{att.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── RECEIVE mode panel ── */}
              {activeAction === 'RECEIVE' && isOperational && canReceiveGoods && isReceivable && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl overflow-hidden">
                  <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-bold">บันทึกตรวจรับสินค้าเข้าคลัง (+IN)</span>
                    </div>
                    <button type="button" onClick={handleFillAll}
                      className="text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg transition-all cursor-pointer">
                      รับทั้งหมด
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedPO.items.map((item, idx) => {
                      const ordered = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
                      const received = Number(item.receivedQty) || 0;
                      const remaining = Math.max(0, ordered - received);
                      const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                      const isDefective = problematicItems[item.productId]?.isProblematic;
                      const thisQty = receivingQtys[item.productId] ?? 0;
                      return (
                        <div key={idx} className={`rounded-xl border p-3.5 transition-all ${isDefective ? 'bg-rose-50/60 border-rose-300' : 'bg-white border-emerald-200/80'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{item.name} <span className="font-mono text-[10px] text-slate-400">({item.code})</span></p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                สั่ง <span className="font-mono font-semibold text-slate-700">{ordered}</span> /
                                รับแล้ว <span className="font-mono font-semibold text-emerald-700">{received}</span> /
                                คงเหลือ <span className="font-mono font-semibold text-amber-700">{remaining}</span> {pUnit}
                              </p>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                              <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-xs font-semibold ${isDefective ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                                <input type="checkbox" checked={Boolean(isDefective)}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setProblematicItems(prev => ({ ...prev, [item.productId]: { isProblematic: checked, claimedQty: checked ? (prev[item.productId]?.claimedQty || remaining || 1) : 0, reason: prev[item.productId]?.reason || 'DAMAGED', description: prev[item.productId]?.description || '', photo: prev[item.productId]?.photo || null } }));
                                  }}
                                  className="w-3.5 h-3.5 rounded text-rose-600 cursor-pointer" />
                                <AlertTriangle className={`w-3 h-3 ${isDefective ? 'text-white' : 'text-rose-500'}`} />
                                <span>มีปัญหา</span>
                              </label>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-500">รับ:</span>
                                <input type="number" min="0" max={remaining} step="any" value={thisQty}
                                  onChange={e => setReceivingQtys(prev => ({ ...prev, [item.productId]: Number(e.target.value) }))}
                                  disabled={remaining <= 0}
                                  className="w-20 text-center text-xs font-mono font-bold bg-white border border-emerald-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400" />
                                <span className="text-xs text-slate-500">{pUnit}</span>
                              </div>
                            </div>
                          </div>
                          {isDefective && (
                            <div className="mt-3 p-3.5 bg-white/90 border border-rose-200 rounded-xl space-y-2.5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-700 block mb-1">จำนวนที่มีปัญหา <span className="text-rose-500">*</span></label>
                                  <input type="number" min="1" max={ordered} step="any"
                                    value={problematicItems[item.productId]?.claimedQty ?? (remaining || 1)}
                                    onChange={e => setProblematicItems(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], claimedQty: Math.max(1, Number(e.target.value)) } }))}
                                    className="w-full text-xs font-mono font-bold bg-white border border-rose-300 rounded-lg px-3 py-2 text-rose-950 outline-none focus:ring-2 focus:ring-rose-400/20" />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-700 block mb-1">สาเหตุ <span className="text-rose-500">*</span></label>
                                  <select value={problematicItems[item.productId]?.reason || 'DAMAGED'}
                                    onChange={e => setProblematicItems(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], reason: e.target.value } }))}
                                    className="w-full text-xs bg-white border border-rose-300 rounded-lg px-3 py-2 font-medium outline-none cursor-pointer">
                                    <option value="DAMAGED">💥 ชำรุด / เสียหาย</option>
                                    <option value="SHORT_SHIPMENT">📦 ได้รับไม่ครบ</option>
                                    <option value="WRONG_SPEC">⚠️ ไม่ตรงสเปก / ผิดรุ่น</option>
                                    <option value="OTHER">📝 อื่นๆ</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">รายละเอียดปัญหา <span className="text-rose-500">*</span></label>
                                <textarea
                                  value={problematicItems[item.productId]?.description || ''}
                                  onChange={e => setProblematicItems(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], description: e.target.value, defectReason: e.target.value } }))}
                                  placeholder="อธิบายอาการ เช่น ชำรุด 2 ชิ้น, บรรจุภัณฑ์ฉีก..."
                                  className="w-full text-xs bg-white border border-rose-300 rounded-lg px-3 py-2 font-medium outline-none h-14 resize-none focus:ring-2 focus:ring-rose-400/20" />
                              </div>
                              <label className="px-3 py-1.5 bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 w-fit transition-all">
                                <Camera className="w-3.5 h-3.5" />
                                {problematicItems[item.productId]?.photo ? 'เปลี่ยนรูป' : '+ แนบรูปหลักฐาน'}
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                      const compressed = await compressImageFile(e.target.files[0]);
                                      setProblematicItems(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], photo: compressed } }));
                                    }
                                  }} />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* GR Attachments upload */}
                    <div className="bg-white rounded-xl border border-emerald-200 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <UploadCloud className="w-3.5 h-3.5 text-indigo-500" /> แนบรูปถ่าย / ใบส่งของ
                        </span>
                        <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all">
                          <UploadCloud className="w-3 h-3" />
                          {isUploading ? 'ประมวลผล...' : '+ เพิ่มไฟล์'}
                          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple onChange={handleFileUpload} disabled={isUploading} className="hidden" />
                        </label>
                      </div>
                      {grAttachments.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {grAttachments.map((file, idx) => (
                            <div key={idx} className="relative group bg-slate-50 border border-slate-200 rounded-lg p-1 overflow-hidden">
                              {file.type === 'application/pdf' ? (
                                <div className="h-12 bg-rose-50 rounded flex flex-col items-center justify-center text-rose-500">
                                  <FileText className="w-4 h-4" /><span className="text-[8px] font-bold mt-0.5">PDF</span>
                                </div>
                              ) : (
                                <img src={file.previewUrl || file.dataUrl} alt={file.name} className="h-12 w-full object-cover rounded" />
                              )}
                              <p className="text-[9px] text-slate-500 truncate mt-0.5 text-center">{file.name}</p>
                              <button type="button" onClick={() => handleRemoveAttachment(idx)}
                                className="absolute top-0.5 right-0.5 p-0.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="text" value={receiveNote} onChange={e => setReceiveNote(e.target.value)}
                      placeholder="หมายเหตุการรับของ (เช่น สภาพสมบูรณ์, ตรวจนับตาม Packing List ครบถ้วน)"
                      className="w-full text-xs bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-500" />
                    <button type="button" onClick={handleShortClosePO}
                      disabled={isShortClosing || isReceiving || isSubmitting}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                      <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
                      {isShortClosing ? 'กำลังปิด PO...' : 'ปิด PO (กรณีได้ของไม่ครบ)'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── CLAIM mode panel ── */}
              {activeAction === 'CLAIM' && canReportClaim && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl overflow-hidden">
                  <div className="bg-rose-600 px-4 py-3 flex items-center gap-2 text-white">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-bold">แจ้งเคลม / รายงานปัญหาสินค้า{selectedPO.purchaseChannel === 'ONLINE' ? ' (ออนไลน์)' : ' (จัดซื้อทั่วไป)'}</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">หัวข้อปัญหา <span className="text-rose-500">*</span></label>
                      <select value={claimReason} onChange={e => setClaimReason(e.target.value)}
                        className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500">
                        <option value="สินค้าชำรุด/เสียหาย">💥 สินค้าชำรุด / เสียหาย</option>
                        <option value="สินค้าไม่ตรงสเปก/ผิดรุ่น">⚠️ สินค้าไม่ตรงสเปก / ผิดรุ่น</option>
                        <option value="ได้รับสินค้าไม่ครบ">📦 ได้รับสินค้าไม่ครบ</option>
                        <option value="อื่นๆ (ระบุในรายละเอียด)">📝 อื่นๆ (ระบุในรายละเอียด)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">รายละเอียดปัญหา <span className="text-rose-500">*</span></label>
                      <textarea value={claimDescription} onChange={e => setClaimDescription(e.target.value)}
                        className="w-full bg-white border border-rose-300 rounded-xl px-3.5 py-2.5 text-xs outline-none h-24 resize-none font-medium focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500"
                        placeholder="อธิบายปัญหาที่พบ เช่น สินค้าบุบ แตก หรือไม่ตรงสเปก..." />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">รูปภาพหลักฐาน</label>
                      <input type="file" accept="image/*" ref={claimFileInputRef}
                        onChange={async (e) => { if (e.target.files?.[0]) { const c = await compressImageFile(e.target.files[0]); setClaimPhoto(c); } }}
                        className="hidden" />
                      <div className="flex gap-3 items-center">
                        <button type="button" onClick={() => claimFileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all">
                          <Camera className="w-3.5 h-3.5" />
                          {claimPhoto ? 'เปลี่ยนรูปภาพ' : '+ อัปโหลดรูปภาพ'}
                        </button>
                        {claimPhoto && (
                          <div className="relative group rounded-lg overflow-hidden border border-rose-300 w-12 h-12">
                            <img src={claimPhoto.previewUrl} alt="Claim photo" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => setClaimPhoto(null)}
                              className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-rose-200">
                      <button type="button" onClick={() => setActiveAction('NONE')}
                        className="px-4 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                        ยกเลิก / กลับ
                      </button>
                      <button type="button" disabled={isSubmittingClaim || !claimDescription.trim()}
                        onClick={async () => {
                          setIsSubmittingClaim(true);
                          try {
                            await apiService.fileOnlineClaim(selectedPO.id, { reason: claimReason, description: claimDescription, photo: claimPhoto }, currentRole);
                            await modalService.success('ส่งเรื่องเคลมสำเร็จ', 'ระบบได้แจ้งเตือนไปยังผู้สั่งซื้อแล้ว');
                            onRefresh(); onClose();
                          } catch (err) { modalService.error('เกิดข้อผิดพลาด', err.message); }
                          finally { setIsSubmittingClaim(false); }
                        }}
                        className="px-5 py-2 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all">
                        <AlertOctagon className="w-3.5 h-3.5" />
                        {isSubmittingClaim ? 'กำลังส่ง...' : '⚠️ ส่งเรื่องแจ้งเคลมไปยังจัดซื้อ'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Log (Collapsible & Compact) */}
              {selectedPO.activityLog && selectedPO.activityLog.length > 0 && (
                <CollapsibleActivityTimeline
                  events={selectedPO.activityLog}
                  title="ประวัติการดำเนินงาน (Activity Timeline)"
                  defaultExpanded={selectedPO.activityLog.length < 2}
                />
              )}

            </div>
          </div>

          {/* ════ ZONE 3 — STICKY FOOTER ACTION DOCK ════ */}
          <div className="shrink-0 bg-white border-t border-slate-100 z-20">
            <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between flex-wrap gap-2.5">
              {/* Left: Close button */}
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose}
                  className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                  ปิดหน้าต่าง
                </button>
                {!isPlantManager && isPOCancellable && canCancelPO && (
                  <button type="button" onClick={handleCancelPO} disabled={isCancelling}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
                    <XCircle className="w-3.5 h-3.5" />{isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิก PO'}
                  </button>
                )}
              </div>

              {/* Right: Active Action Buttons */}
              <div className="flex items-center gap-2 ml-auto flex-wrap">

                {/* SELF Claim Resolution toolbar */}
                {isOperational && isClaimStatus && selectedPO.purchaseChannel === 'SELF' && showSelfClaimResolution && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowSelfClaimResolution(false)}
                      className="px-4 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer">ยกเลิก</button>
                    <button type="button" disabled={isResolvingSelfClaim || !selfClaimNote.trim()} onClick={handleResolveSelfClaim}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all">
                      <Check className="w-4 h-4" />{isResolvingSelfClaim ? 'กำลังบันทึก...' : 'ยืนยันการจัดการเคส'}
                    </button>
                  </div>
                )}

                {/* RECEIVE mode footer buttons */}
                {activeAction === 'RECEIVE' && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setActiveAction('NONE')}
                      className="px-4 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer">ยกเลิก / กลับ</button>
                    {Object.values(problematicItems).some(p => p.isProblematic) ? (
                      <button type="button" onClick={handleSubmitReceiving}
                        disabled={isReceiving || isSubmitting || isShortClosing}
                        className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all ring-2 ring-rose-200">
                        <AlertTriangle className="w-4 h-4" />{isReceiving || isSubmitting ? 'กำลังบันทึก...' : '🚨 ยืนยันรับพร้อมแจ้งเคลม'}
                      </button>
                    ) : (
                      <button type="button" onClick={handleSubmitReceiving}
                        disabled={isReceiving || isSubmitting || isShortClosing}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all">
                        <CheckCircle2 className="w-4 h-4" />{isReceiving || isSubmitting ? 'กำลังบันทึก...' : '✓ ยืนยันตรวจรับเข้าคลัง (+IN)'}
                      </button>
                    )}
                  </div>
                )}

                {/* CLAIM mode footer buttons */}
                {activeAction === 'CLAIM' && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setActiveAction('NONE')}
                      className="px-4 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer">ยกเลิก / กลับ</button>
                    <button type="button" disabled={isSubmittingClaim || !claimDescription.trim()}
                      onClick={async () => {
                        setIsSubmittingClaim(true);
                        try {
                          await apiService.fileOnlineClaim(selectedPO.id, { reason: claimReason, description: claimDescription, photo: claimPhoto }, currentRole);
                          await modalService.success('ส่งเรื่องเคลมสำเร็จ', 'ระบบได้แจ้งเตือนไปยังผู้สั่งซื้อแล้ว');
                          onRefresh(); onClose();
                        } catch (err) { modalService.error('เกิดข้อผิดพลาด', err.message); }
                        finally { setIsSubmittingClaim(false); }
                      }}
                      className="px-5 py-2 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all">
                      <AlertOctagon className="w-4 h-4" />{isSubmittingClaim ? 'กำลังส่ง...' : '⚠️ ส่งเรื่องแจ้งเคลม'}
                    </button>
                  </div>
                )}

                {/* NONE mode buttons */}
                {activeAction === 'NONE' && !showSelfClaimResolution && (
                  <>
                    {isOperational && isClaimStatus && selectedPO.purchaseChannel === 'SELF' && canResolveSelfClaim && (
                      <button onClick={() => setShowSelfClaimResolution(p => !p)}
                        className="px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all bg-rose-600 text-white hover:bg-rose-700">
                        <ShieldAlert className="w-3.5 h-3.5" />จัดการเคสปัญหา
                      </button>
                    )}
                    {!isPlantManager && (selectedPO.status === 'ISSUED' || selectedPO.status === 'IN_PROGRESS_ONLINE') &&
                      (isPurchaser || role === 'admin' || currentRole?.id === 'ADMIN' || currentRole?.canOnlinePurchase) && (
                      <button
                        onClick={async () => {
                          const targetStatus = selectedPO.purchaseChannel === 'ONLINE' ? 'ORDERED_PENDING_DELIVERY' : 'IN_DELIVERY';
                          const confirmed = await modalService.confirm({ title: 'ยืนยันการสั่งซื้อสินค้า', message: `ยืนยันสั่งซื้อ PO ${selectedPO.poNo}?`, confirmText: 'ยืนยันสั่งซื้อแล้ว', cancelText: 'ยกเลิก' });
                          if (confirmed) {
                            try {
                              const updated = await apiService.updatePOStatus(selectedPO.id, targetStatus, currentRole);
                              const updatedPayload = updated || { ...selectedPO, status: targetStatus };
                              if (context?.updatePO) context.updatePO(selectedPO.id, updatedPayload);
                              if (onRefresh) onRefresh(updatedPayload);
                              await modalService.success('บันทึกสั่งซื้อแล้ว', `PO ${selectedPO.poNo} เปลี่ยนสถานะเป็นกำลังจัดส่ง`);
                              onClose();
                            } catch (err) { modalService.error('เกิดข้อผิดพลาด', err.message); }
                          }
                        }}
                        disabled={!hasAssignedVendor}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all">
                        <ShoppingCart className="w-3.5 h-3.5" />บันทึกสั่งซื้อแล้ว
                      </button>
                    )}
                    {isOperational && canReceiveGoods && isReceivable && canReportClaim && (
                      <button onClick={() => setActiveAction('CLAIM')}
                        className="px-4 py-2 bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all">
                        <AlertTriangle className="w-3.5 h-3.5" />⚠️ แจ้งปัญหา / เคลม
                      </button>
                    )}
                    {isOperational && canReceiveGoods && isReceivable && (
                      <button onClick={() => setActiveAction('RECEIVE')}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-sm shadow-emerald-200">
                        <Download className="w-3.5 h-3.5" />📦 บันทึกตรวจรับสินค้า (+IN)
                      </button>
                    )}
                    {selectedPO.status === 'CLOSED' && (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />รับเข้าคลังครบแล้ว (+IN)
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
