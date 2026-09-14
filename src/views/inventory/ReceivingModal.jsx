import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, Download, AlertTriangle, CheckCircle2, 
  X, UploadCloud, Trash2, Camera, FileText, ArrowLeft,
  Check, Truck, AlertOctagon
} from 'lucide-react';
import { recordGoodsReceipt as recordGoodsReceiptFn } from '../../context/ProcurementContext';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { authService } from '../../services/authService';
import { modalService } from '../../services/modalService';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { generateGRNNumber } from '../../services/warehouseService';
import { formatLocalTimestamp } from '../../services/inventoryService';
import { getValidConversionRate, toStockQuantity, toStockUnitCost } from '../../utils/uomEngine.js';

/**
 * Helper to resiliently resolve refund quantity and amount
 * Supports Dual-Layer Refund Recognition:
 * Layer 1: Item-level fields (item.refundedQty, item.claimResolution === 'REFUND')
 * Layer 2: Store-level claim records (po.storeClaims) as fallback for disputed items
 */
export const resolveRefundedQtyAndAmount = (item, po) => {
  const ordered = Number(item?.orderedQty ?? item?.quantity ?? item?.actualQty ?? item?.purchaseQty ?? item?.qty) || 0;
  const accumulated = Number(item?.accumulatedReceived ?? item?.goodQty ?? item?.receivedQty ?? 0);

  const itemStoreName = (item?.actualStoreName || item?.storeName || '').trim();
  const itemPlatform = (item?.storePlatform || item?.platform || 'Shopee').trim();
  const derivedStoreKey = item?.storeKey || (itemStoreName ? `${itemPlatform}_${itemStoreName.toLowerCase()}` : '');

  const storeClaim = 
    (item?.storeKey && po?.storeClaims?.[item.storeKey]) ||
    (derivedStoreKey && po?.storeClaims?.[derivedStoreKey]) ||
    (itemStoreName && (po?.storeClaims?.[itemStoreName] || po?.storeClaims?.[itemStoreName.toLowerCase()])) ||
    (po?.storeClaims && Object.entries(po.storeClaims).find(([k]) => {
      if (!k || !itemStoreName) return false;
      const normK = String(k).toLowerCase().replace(/['"`]/g, '');
      const normS = itemStoreName.toLowerCase().replace(/['"`]/g, '');
      return normK === normS || normK.includes(normS) || normS.includes(normK);
    })?.[1]);

  const isStoreRefunded = Boolean(
    storeClaim && (storeClaim.isResolved || storeClaim.status === 'RESOLVED' || storeClaim.status === 'COMPLETED') &&
    (storeClaim.type === 'REFUND' || storeClaim.actionType === 'REFUND' || storeClaim.resolutionType === 'REFUND' || storeClaim.type === 'CANCEL' || String(storeClaim.note || '').includes('คืนเงิน'))
  );

  let refunded = Number(item?.refundedQty || 0);
  if (refunded === 0 && (item?.claimResolution === 'REFUND' || isStoreRefunded)) {
    refunded = Number(item?.damagedQty || item?.shortageQty || Math.max(0, ordered - accumulated));
  }

  const remainingToReceive = Math.max(0, ordered - accumulated - refunded);

  const itemUnitPrice = Number(item?.actualPrice ?? item?.actUnitPrice ?? item?.unitPrice ?? item?.price ?? 0);
  let refundAmt = Number(item?.refundAmount || 0);
  if (refundAmt === 0 && refunded > 0) {
    refundAmt = Number(storeClaim?.refundAmount || (refunded * itemUnitPrice) || 0);
  }

  const isReplacement = Boolean(
    !isStoreRefunded && (
      item?.claimResolution === 'REPLACEMENT' || 
      Number(item?.replacementPendingQty) > 0 || 
      storeClaim?.type === 'REPLACEMENT' || 
      storeClaim?.actionType === 'REPLACEMENT' ||
      po?.claimStatus === 'REPLACEMENT_PENDING' ||
      po?.claimResolution?.type === 'REPLACEMENT'
    )
  );

  const isSplitShipment = Boolean(
    !isReplacement && !isStoreRefunded && (
      item?.shortageAction === 'WAIT_NEXT_ROUND' || 
      item?.disputeAction === 'WAIT_NEXT_ROUND' || 
      item?.shortageReason === 'SPLIT_SHIPMENT' || 
      item?.action === 'WAIT_NEXT_ROUND' ||
      po?.status === 'WAITING_DELIVERY_ROUND_2'
    )
  );

  return {
    ordered,
    accumulated,
    refunded,
    refundAmount: refundAmt,
    remainingToReceive,
    isStoreRefunded,
    isReplacement,
    isSplitShipment,
    storeClaim
  };
};

/**
 * Helper to check if an order's items are 100% accounted for
 * (receivedQty + refundedQty >= orderedQty for all items, or remainingToReceive is 0)
 */
export const checkIsFullyAccounted = (items = []) => {
  if (!items || items.length === 0) return false;
  return items.every(it => {
    const ordered = Number(it.ordered ?? it.orderedQty ?? it.quantity ?? it.actualQty ?? it.purchaseQty ?? it.qty ?? 0);
    const prevReceived = Number(it.accumulated ?? it.alreadyReceived ?? it.receivedQty ?? it.goodQty ?? 0);
    const refunded = Number(it.refunded ?? it.refundedQty ?? 0);
    const remaining = Math.max(0, ordered - prevReceived - refunded);
    return (prevReceived + refunded >= ordered) || (ordered > 0 && remaining === 0);
  });
};

/**
 * Helper to generate a collision-safe unique line identifier for PO items
 * Prevents State Overwrite when a PO contains multiple line items with the same product
 */
export const getLineKey = (item, index = 0) => {
  if (!item) return `item_p_${index}`;
  if (item.lineId) return String(item.lineId);
  if (item.id && item.id !== item.productId && item.id !== item.code && item.id !== item.sku) {
    return String(item.id);
  }
  return `item_${item.productId || item.code || 'p'}_${index}`;
};

/**
 * ReceivingModal (GoodsReceiptModal)
 * Enterprise-grade partial receiving modal with automatic shortage calculation,
 * stock acceptance filtering, and automatic dispute task routing to Online Hub.
 */
export default function ReceivingModal({ 
  po, 
  selectedPO,
  isOpen = true, 
  onClose, 
  onSuccess,
  onBack,
  onBackToPO,
  _currentRole,
  currentRole,
  currentUser: propCurrentUser,
  user: propUser
}) {
  const targetPO = po || selectedPO;
  const auth = useAuth();
  const appContext = useAppContext();

  // ดึงข้อมูลผู้ใช้งานปัจจุบันอย่างปลอดภัย (Safe User Resolution)
  const sessionUser = (typeof authService?.getCurrentUser === 'function' ? authService.getCurrentUser() : null) ||
                      (typeof authService?.getCurrentSession === 'function' ? authService.getCurrentSession() : null) || {};
  const activeUser = propCurrentUser || propUser || currentRole || _currentRole || auth?.currentUser || appContext?.currentUser || sessionUser || {};
  const actorName = activeUser?.name || activeUser?.employeeName || activeUser?.username || (typeof activeUser === 'string' ? activeUser : 'ผู้ตรวจรับพัสดุ');
  const actorRole = activeUser?.canonicalRole || activeUser?.roleId || activeUser?.role || activeUser?.title || 'REQUESTER';

  if (!isOpen || !targetPO) return null;

  const handleBackToPO = onBack || onBackToPO;

  const fileInputRef = useRef(null);

  // Initialize line-item state
  const [itemsState, setItemsState] = useState(() => {
    const initial = {};
    (targetPO.items || []).forEach((item, idx) => {
      const lineKey = getLineKey(item, idx);
      const { remainingToReceive } = resolveRefundedQtyAndAmount(item, targetPO);

      initial[lineKey] = {
        acceptedQty: remainingToReceive === 0 ? 0 : (item.initialAcceptedQty !== undefined ? item.initialAcceptedQty : (item.inspectQty !== undefined ? item.inspectQty : remainingToReceive)),
        damagedQty: 0,
        shortageAction: item.shortageAction || 'CLAIM_SHORTAGE', // Default: CLAIM_SHORTAGE เพื่อป้องกันการเสียสิทธิ์เคลม
        shortageReason: item.shortageReason || (item.shortageAction === 'WAIT_NEXT_ROUND' ? 'SPLIT_SHIPMENT' : 'VENDOR_SHORTAGE'),
        defectNote: '',
        isDamagedExpanded: false
      };
    });
    return initial;
  });

  // Re-sync line-item state if targetPO changes
  useEffect(() => {
    if (!targetPO?.items) return;
    const initial = {};
    targetPO.items.forEach((item, idx) => {
      const lineKey = getLineKey(item, idx);
      const { remainingToReceive } = resolveRefundedQtyAndAmount(item, targetPO);

      initial[lineKey] = {
        acceptedQty: remainingToReceive === 0 ? 0 : (item.initialAcceptedQty !== undefined ? item.initialAcceptedQty : (item.inspectQty !== undefined ? item.inspectQty : remainingToReceive)),
        damagedQty: 0,
        shortageAction: item.shortageAction || 'CLAIM_SHORTAGE',
        shortageReason: item.shortageReason || (item.shortageAction === 'WAIT_NEXT_ROUND' ? 'SPLIT_SHIPMENT' : 'VENDOR_SHORTAGE'),
        defectNote: '',
        isDamagedExpanded: false
      };
    });
    setItemsState(initial);
  }, [targetPO?.id, targetPO?.poNo]);

  const [grnNote, setGrnNote] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Computed line items with auto-calculated shortage and remaining quantity
  const computedItems = useMemo(() => {
    return (targetPO.items || []).map((item, idx) => {
      const lineKey = getLineKey(item, idx);
      const key = lineKey;
      const state = itemsState[lineKey] || {
        acceptedQty: 0,
        damagedQty: 0,
        shortageReason: 'VENDOR_SHORTAGE',
        defectNote: '',
        isDamagedExpanded: false
      };

      const {
        ordered,
        accumulated,
        refunded,
        refundAmount,
        remainingToReceive,
        isStoreRefunded,
        isReplacement,
        isSplitShipment,
        storeClaim
      } = resolveRefundedQtyAndAmount(item, targetPO);

      const isRowLocked = remainingToReceive === 0;

      const rawAccepted = state.acceptedQty === '' ? '' : state.acceptedQty;
      const parsedAccepted = rawAccepted === '' ? 0 : Number(rawAccepted);
      const safeAccepted = isNaN(parsedAccepted) ? 0 : Math.max(0, parsedAccepted);
      const acceptedQty = isRowLocked ? 0 : Math.min(remainingToReceive, safeAccepted);

      const rawDamaged = state.damagedQty === '' ? '' : state.damagedQty;
      const parsedDamaged = rawDamaged === '' ? 0 : Number(rawDamaged);
      const safeDamaged = isNaN(parsedDamaged) ? 0 : Math.max(0, parsedDamaged);
      const damagedQty = isRowLocked ? 0 : Math.min(Math.max(0, remainingToReceive - acceptedQty), safeDamaged);

      // Remaining quantity and shortage calculations
      const shortageQty = isRowLocked ? 0 : Math.max(0, remainingToReceive - (acceptedQty + damagedQty));
      const hasShortage = !isRowLocked && (shortageQty > 0 || (acceptedQty < remainingToReceive && (acceptedQty + damagedQty < remainingToReceive)));
      const hasDamage = !isRowLocked && (safeDamaged > 0 || Number(state.damagedQty) > 0);

      const uom = storageService?.getUomConversion ? storageService.getUomConversion(item.code || item.productId || item.id) : null;
      const conversionRatio = getValidConversionRate(item.conversionRatio || item.conversionRate || uom?.conversionRatio || 1);

      const pUnit = item.purchaseUom || item.purchaseUnit || item.pUnit || uom?.purchaseUom || item.unit || 'ชิ้น';
      const sUnit = item.baseUom || item.stockUnit || item.sUnit || uom?.baseUom || (conversionRatio > 1 ? 'หน่วย' : pUnit);

      const shortageAction = state.shortageAction || (state.shortageReason === 'SPLIT_SHIPMENT' ? 'WAIT_NEXT_ROUND' : 'CLAIM_SHORTAGE');
      const shortageReason = state.shortageReason || (shortageAction === 'WAIT_NEXT_ROUND' ? 'SPLIT_SHIPMENT' : 'VENDOR_SHORTAGE');

      const refundAmountFormatted = refundAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      return {
        ...item,
        key: lineKey,
        lineKey,
        lineIndex: idx,
        ordered,
        orderedQty: ordered,
        accumulated,
        alreadyReceived: accumulated,
        refunded,
        refundAmount,
        refundAmountFormatted,
        remainingToReceive,
        remainingReceivable: remainingToReceive,
        isRowLocked,
        isStoreRefunded,
        isReplacement,
        isSplitShipment,
        storeClaim,
        acceptedQty,
        damagedQty,
        shortageQty,
        hasShortage,
        hasDamage,
        rawAcceptedInput: isRowLocked ? 0 : (rawAccepted !== undefined ? rawAccepted : remainingToReceive),
        rawDamagedInput: isRowLocked ? 0 : (rawDamaged !== undefined ? rawDamaged : 0),
        shortageAction,
        shortageReason,
        defectNote: isRowLocked ? '' : (state.defectNote || ''),
        isDamagedExpanded: !isRowLocked && Boolean(state.isDamagedExpanded || hasDamage),
        conversionRatio,
        conversionRate: conversionRatio,
        purchaseUom: pUnit,
        purchaseUnit: pUnit,
        baseUom: sUnit,
        stockUnit: sUnit,
        pUnit,
        sUnit
      };
    });
  }, [targetPO.items, targetPO.storeClaims, itemsState]);

  // Overall delivery summary
  const summary = useMemo(() => {
    let totalAccepted = 0;
    let totalDamaged = 0;
    let totalShortage = 0;
    let hasVendorShortage = false;
    let hasSplitShipment = false;

    computedItems.forEach(item => {
      totalAccepted += item.acceptedQty;
      totalDamaged += item.damagedQty;
      totalShortage += item.shortageQty;
      if (item.hasShortage) {
        if (item.shortageAction === 'CLAIM_SHORTAGE' || item.shortageReason === 'VENDOR_SHORTAGE') hasVendorShortage = true;
        if (item.shortageAction === 'WAIT_NEXT_ROUND' || item.shortageReason === 'SPLIT_SHIPMENT') hasSplitShipment = true;
      }
    });

    const isFullyAccepted = totalShortage === 0 && totalDamaged === 0;
    const isClaimRequired = totalDamaged > 0 || hasVendorShortage;

    return {
      totalAccepted,
      totalDamaged,
      totalShortage,
      hasVendorShortage,
      hasSplitShipment,
      isFullyAccepted,
      isClaimRequired
    };
  }, [computedItems]);

  // ── Intelligent GRN Resolution: Calculate whether all items are completely resolved ──
  const isFullyAccounted = useMemo(() => {
    if (!computedItems || computedItems.length === 0) return false;
    return checkIsFullyAccounted(computedItems);
  }, [computedItems]);

  const totalAcceptedQty = summary.totalAccepted;

  // Handler: Update item accepted quantity
  const handleAcceptedQtyChange = (key, value) => {
    const item = computedItems.find(it => it.key === key);
    if (item && item.isRowLocked) return; // Row locked: 100% read-only
    setItemsState(prev => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          acceptedQty: value
        }
      };
    });
  };

  // Handler: Update item damaged quantity
  const handleDamagedQtyChange = (key, value) => {
    const item = computedItems.find(it => it.key === key);
    if (item && item.isRowLocked) return; // Row locked: 100% read-only
    setItemsState(prev => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          damagedQty: value
        }
      };
    });
  };

  // Handler: Update shortage action (Directive 1)
  const handleShortageActionChange = (key, action) => {
    const item = computedItems.find(it => it.key === key);
    if (item && item.isRowLocked) return;
    setItemsState(prev => {
      const current = prev[key] || {};
      const reason = action === 'WAIT_NEXT_ROUND' ? 'SPLIT_SHIPMENT' : 'VENDOR_SHORTAGE';
      return {
        ...prev,
        [key]: {
          ...current,
          shortageAction: action,
          shortageReason: reason
        }
      };
    });
  };


  // Handler: Update defect note
  const handleDefectNoteChange = (key, note) => {
    const item = computedItems.find(it => it.key === key);
    if (item && item.isRowLocked) return;
    setItemsState(prev => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          defectNote: note
        }
      };
    });
  };

  // Handler: Fill all remaining as accepted
  const handleFillAllRemaining = () => {
    setItemsState(prev => {
      const next = { ...prev };
      computedItems.forEach(item => {
        next[item.key] = {
          ...next[item.key],
          acceptedQty: item.isRowLocked ? 0 : item.remainingToReceive,
          damagedQty: 0
        };
      });
      return next;
    });
  };

  const handleFillAllComplete = handleFillAllRemaining;

  // Handle Image compression & attachment
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);

    try {
      const processed = [];
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          const base64 = await new Promise((res, rej) => {
            reader.onload = (re) => res(re.target.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });
          processed.push({
            name: file.name,
            size: file.size,
            type: file.type,
            previewUrl: base64,
            dataUrl: base64,
            uploadedAt: new Date().toLocaleString('th-TH')
          });
        } else if (file.type === 'application/pdf') {
          const reader = new FileReader();
          const base64 = await new Promise((res, rej) => {
            reader.onload = (re) => res(re.target.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });
          processed.push({
            name: file.name,
            size: file.size,
            type: file.type,
            previewUrl: base64,
            dataUrl: base64,
            uploadedAt: new Date().toLocaleString('th-TH')
          });
        }
      }
      setAttachments(prev => [...prev, ...processed]);
    } catch (err) {
      modalService.error('อัปโหลดไฟล์ล้มเหลว', err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Main Confirm Receiving Handler
  const handleConfirmReceiving = async () => {
    if (isSubmitting) return;

    // Validate boundaries & enforce allowedReceiveQty
    for (const it of computedItems) {
      const allowed = Math.max(0, it.ordered - it.accumulated - it.refunded);
      if (allowed === 0) {
        it.acceptedQty = 0;
        it.damagedQty = 0;
      } else {
        if (it.acceptedQty > allowed) {
          return modalService.warning(
            'จำนวนตรวจรับเกินกำหนด',
            `รายการ "${it.name}" มียอดตรวจรับเกินจำนวนที่รอตรวจรับ (${allowed} ${it.pUnit})`
          );
        }
        if (it.acceptedQty + it.damagedQty > allowed) {
          return modalService.warning(
            'จำนวนตรวจรับเกินกำหนด',
            `รายการ "${it.name}" มียอดรับสมบูรณ์ + ยอดชำรุด เกินจำนวนที่รอตรวจรับ (${allowed} ${it.pUnit})`
          );
        }
      }
    }

    if (!isFullyAccounted && summary.totalAccepted === 0 && summary.totalDamaged === 0 && summary.totalShortage === 0) {
      return modalService.warning('กรุณาระบุจำนวนสินค้าที่ตรวจรับ');
    }

    // Confirmation dialog
    let confirmTitle = 'ยืนยันการตรวจรับสินค้า';
    let confirmDesc = `ยืนยันบันทึกตรวจรับสินค้าเข้าคลังสำหรับ PO ${targetPO.poNo || targetPO.id} หรือไม่?`;
    let confirmType = 'success';

    if (isFullyAccounted) {
      confirmTitle = 'ยืนยันปิดงานใบสั่งซื้อ';
      confirmDesc = `สินค้าทุกรายการในใบสั่งซื้อ ${targetPO.poNo || targetPO.id} ได้รับการตรวจรับหรือชดเชยครบถ้วนแล้ว ยืนยันปิดงานใบสั่งซื้อ (Finalize PO) หรือไม่?`;
      confirmType = 'success';
    } else if (summary.isClaimRequired) {
      confirmTitle = 'ยืนยันตรวจรับสินค้า & ส่งเรื่องเคลม';
      confirmDesc = 'ตรวจพบสินค้าขาดส่งหรือชำรุดเสียหาย ระบบจะบันทึกรับเฉพาะสินค้าที่สมบูรณ์เข้าคลัง และส่งเรื่องเคลมไปยังฝ่ายจัดซื้อทันที';
      confirmType = 'warning';
    } else if (summary.hasSplitShipment) {
      confirmTitle = 'ยืนยันตรวจรับพัสดุ (รอส่งรอบถัดไป)';
      confirmDesc = 'บันทึกรับพัสดุรอบนี้เรียบร้อย สถานะเอกสารจะเปลี่ยนเป็น "รอพัสดุส่งรอบถัดไป" เพื่อรอรับสินค้าที่เหลือ';
      confirmType = 'info';
    }

    const confirmed = await modalService.confirm({
      title: confirmTitle,
      message: confirmDesc,
      type: confirmType,
      confirmText: isFullyAccounted
        ? 'ยืนยันปิดงานใบสั่งซื้อ (Finalize PO)'
        : (summary.isClaimRequired ? 'ยืนยันตรวจรับ & ส่งเรื่องเคลม' : (summary.hasSplitShipment ? 'ยืนยันรับพัสดุรอบนี้' : 'ยืนยันรับเข้าคลังสมบูรณ์')),
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      // ดึงข้อมูลผู้ใช้งานปัจจุบันอย่างปลอดภัย
      const currentUser = activeUser;
      const nextRound = (targetPO.grnHistory?.length || 0) + 1;
      const grnNumber = generateGRNNumber(targetPO.poNo || targetPO.id, nextRound);
      const timestamp = new Date().toLocaleString('th-TH');

      // Status determination
      let statusOverride = 'PARTIAL';
      if (isFullyAccounted) {
        statusOverride = 'COMPLETED';
      } else if (summary.isClaimRequired) {
        statusOverride = 'PARTIALLY_RECEIVED_IN_CLAIM';
      } else if (summary.hasSplitShipment) {
        statusOverride = 'WAITING_DELIVERY_ROUND_2';
      } else if (summary.isFullyAccepted) {
        statusOverride = 'CLOSED';
      }

      // 1. Prepare Receiver Metadata (Directive 1)
      const receiverName = (currentUser?.name && currentUser.name !== 'Admin System') 
        ? currentUser.name 
        : (currentUser?.employeeName || 'คุณวิชัย สุขใจ');
      const receiverSignature = currentUser?.signatureUrl || 
        currentUser?.signature || 
        storageService.getSignatureByRole?.(currentUser?.roleId || currentUser?.id)?.signatureUrl || 
        storageService.getSignatures?.()?.[currentUser?.roleId || 'REQUESTER_PD']?.signatureUrl || 
        '/signatures/receiver-default.png';
      const receivedAtIso = new Date().toISOString();

      const receivingMetadata = {
        receiverName: currentUser?.name || 'คุณวิชัย สุขใจ',
        receiverSignature: currentUser?.signatureUrl || currentUser?.signature || receiverSignature || '/signatures/receiver-default.png',
        receivedAt: receivedAtIso // เช่น 2026-09-12T10:15:00.000Z
      };
      if (currentUser?.name && currentUser.name !== 'Admin System') {
        receivingMetadata.receiverName = currentUser.name;
      } else if (currentUser?.employeeName) {
        receivingMetadata.receiverName = currentUser.employeeName;
      }
      const receivingInfo = receivingMetadata;

      // 2. Prepare Dispute Items for Online Hub
      const disputeItems = computedItems
        .filter(it => (it.shortageQty > 0 && (it.shortageAction === 'CLAIM_SHORTAGE' || it.shortageReason === 'VENDOR_SHORTAGE')) || it.damagedQty > 0)
        .map(it => {
          const isShortage = it.shortageQty > 0 && (it.shortageAction === 'CLAIM_SHORTAGE' || it.shortageReason === 'VENDOR_SHORTAGE');
          return {
            productId: it.productId,
            code: it.code,
            name: it.name,
            orderedQty: it.orderedQty,
            acceptedQty: it.acceptedQty,
            damagedQty: it.damagedQty,
            shortageQty: it.shortageQty,
            shortageAction: it.shortageAction || 'CLAIM_SHORTAGE',
            reason: isShortage ? 'SHORT_SHIPMENT' : 'DAMAGED',
            reasonLabel: isShortage ? 'ร้านส่งของไม่ครบตามกล่อง (ขาดส่ง)' : 'สินค้าชำรุด / แตกหักเสียหาย',
            description: isShortage ? `ยอดขาดส่ง ${it.shortageQty} ${it.pUnit}` : it.defectNote || 'สินค้ามีปัญหาจากการตรวจรับ',
            unit: it.pUnit
          };
        });

      // 3. Prepare GRN Payload
      const grnPayload = {
        grnNumber,
        round: nextRound,
        receivedDate: timestamp,
        receivedBy: currentUser?.name ? `${currentUser.name} (${currentUser.title || actorRole || ''})` : receiverName,
        receiverSignature,
        receivingInfo,
        actorName,
        actorRole,
        user: {
          id: currentUser?.id || 'USR-RECEIVER',
          name: actorName,
          title: actorRole,
          role: actorRole,
          canonicalRole: actorRole
        },
        currentUser: {
          id: currentUser?.id || 'USR-RECEIVER',
          name: actorName,
          title: actorRole,
          role: actorRole,
          canonicalRole: actorRole
        },
        note: grnNote.trim(),
        attachments,
        statusOverride,
        waitingRound2: summary.hasSplitShipment,
        receivingItems: computedItems.map(it => {
          const sAction = it.shortageAction || (it.shortageReason === 'SPLIT_SHIPMENT' ? 'WAIT_NEXT_ROUND' : 'CLAIM_SHORTAGE');
          const isWait = sAction === 'WAIT_NEXT_ROUND';
          return {
            productId: it.productId,
            code: it.code,
            name: it.name,
            receivedThisTime: it.acceptedQty,
            goodQty: it.acceptedQty,
            damagedQty: it.damagedQty,
            shortageQty: it.shortageQty,
            shortageAction: sAction,
            shortageReason: isWait ? 'SPLIT_SHIPMENT' : 'VENDOR_SHORTAGE',
            disputeAction: isWait ? 'WAIT_NEXT_ROUND' : ((it.damagedQty > 0 || (it.shortageQty > 0 && sAction === 'CLAIM_SHORTAGE')) ? 'CLAIM' : 'NONE'),
            defectReason: it.defectNote,
            condition: it.damagedQty > 0 ? 'DAMAGED' : it.shortageQty > 0 ? 'SHORTAGE' : 'GOOD'
          };
        })
      };

      // 4. Call recordGoodsReceipt from Procurement Context
      const grResult = appContext?.recordGoodsReceipt
        ? await appContext.recordGoodsReceipt(targetPO.id, grnPayload)
        : await recordGoodsReceiptFn(targetPO.id, grnPayload);

      // 5. Call receiveToStock / submitGRN and emit enterprise stockMovements with Dual-UOM (Strictly good goods only)
      const stockItemsToReceive = computedItems
        .filter(it => Number(it.acceptedQty || 0) > 0 && !it.isRowLocked)
        .map(it => {
          const uom = storageService?.getUomConversion ? storageService.getUomConversion(it.code || it.productId || it.id) : null;
          const ratio = getValidConversionRate(it.conversionRatio || it.conversionRate || uom?.conversionRatio || 1);

          const purchaseUnit = it.purchaseUom || it.purchaseUnit || it.pUnit || uom?.purchaseUom || 'ชิ้น';
          const stockUnit = it.baseUom || it.stockUnit || it.sUnit || uom?.baseUom || purchaseUnit;
          const purchasePrice = Number(it.actUnitPrice ?? it.actualPrice ?? it.price ?? uom?.purchaseUnitPrice ?? 0);
          const baseUnitCost = typeof toStockUnitCost === 'function'
            ? toStockUnitCost(purchasePrice, ratio)
            : purchasePrice / (Number(ratio) > 0 ? Number(ratio) : 1);
          const baseStockQty = typeof toStockQuantity === 'function'
            ? toStockQuantity(it.acceptedQty, ratio)
            : Number(it.acceptedQty || 0) * (Number(ratio) > 0 ? Number(ratio) : 1);
          const totalVal = baseStockQty * baseUnitCost;

          return {
            productId: it.productId || it.id,
            id: it.id || it.productId,
            code: it.code,
            itemCode: it.code || it.productId,
            name: it.name,
            qty: baseStockQty,
            quantity: baseStockQty,
            receivedQty: Number(it.acceptedQty),
            purchaseQty: Number(it.acceptedQty),
            goodQty: Number(it.acceptedQty),
            damagedQty: 0, // only intact good goods
            conversionRate: ratio,
            conversionRatio: ratio,
            purchaseUnit,
            purchaseUom: purchaseUnit,
            stockUnit,
            baseUom: stockUnit,
            docNo: targetPO.poNo || targetPO.id,
            poNo: targetPO.poNo || targetPO.id,
            poNumber: targetPO.poNo || targetPO.id,
            unitPrice: baseUnitCost,
            baseUnitCost,
            actualPrice: purchasePrice,
            purchaseUnitPrice: purchasePrice,
            totalValue: totalVal,
            totalPrice: totalVal,
            grNumber: grnNumber,
            grnNumber
          };
        });

      if (stockItemsToReceive.length > 0) {
        // Single SSOT Pipeline: logStockMovements is the canonical Dual-UOM stock intake path.
        // It updates stockBalance, enforces deduplication by (documentNo + productCode),
        // and persists atomically to storage and backend.
        const allProducts = storageService.getProducts() || [];
        const vendorName = targetPO.vendorName || targetPO.vendor?.name || 'ผู้จำหน่าย';
        const movementsToEmit = stockItemsToReceive.map(it => {
          const matchedProd = allProducts.find(p => p.id === it.productId || p.code === it.code);
          const curBal = Number(matchedProd?.stockBalance || 0);
          const newBal = curBal + it.quantity;

          return {
            id: `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: formatLocalTimestamp(), // เวลาไทย UTC+7
            date: formatLocalTimestamp(),
            productId: String(it.productId || '').trim(),
            productCode: String(it.code || it.productId || '').trim(),
            sku: String(it.code || it.productId || '').trim(),
            itemCode: String(it.code || it.productId || '').trim(),
            productName: it.name,
            name: it.name,
            type: 'IN', // รับเข้า (+IN)
            docType: 'GRN',
            docNo: grnNumber, // เช่น GRN-PO-PD-2026-003-01
            documentNo: grnNumber,
            grnNo: grnNumber,
            grnNumber: grnNumber,
            poNo: targetPO.poNo || targetPO.id, // เช่น PO-PD-2026-003
            poNumber: targetPO.poNo || targetPO.id,
            refPo: targetPO.poNo || targetPO.id,
            prNo: targetPO.prNo || targetPO.prNumber || '',
            quantity: it.quantity, // จำนวนในหน่วยสต็อก (เช่น +20 ชิ้น)
            qty: it.quantity,
            receivedQty: it.receivedQty, // จำนวนหน่วยจัดซื้อ (เช่น 10 คู่)
            unit: it.stockUnit || it.baseUom || 'ชิ้น',
            stockUnit: it.stockUnit || it.baseUom || 'ชิ้น',
            baseUom: it.baseUom || 'ชิ้น',
            purchaseUnit: it.purchaseUnit || it.purchaseUom || 'คู่',
            purchaseUom: it.purchaseUom || 'คู่',
            conversionRatio: it.conversionRatio,
            conversionRate: it.conversionRatio,
            balanceAfter: Number(newBal), // ยอดหลังรับ (เช่น 36)
            balance: Number(newBal),
            unitPrice: Number(it.unitPrice), // ต้นทุนต่อหน่วยสต็อก (เช่น ฿50.00 / ชิ้น)
            baseUnitCost: Number(it.unitPrice),
            purchaseUnitPrice: it.purchaseUnitPrice,
            totalAmount: Number(it.totalValue), // มูลค่าเงินตาม PO จริง (เช่น 1,000.00 ฿)
            totalPrice: Number(it.totalValue),
            totalValue: Number(it.totalValue),
            actorName,
            user: actorName,
            actorRole,
            department: targetPO.department || matchedProd?.department || 'PD',
            location: matchedProd?.storageLocationName || it.locationName || 'ออฟฟิศ PD',
            locationName: matchedProd?.storageLocationName || it.locationName || 'ออฟฟิศ PD',
            notes: `ตรวจรับสินค้าตามใบสั่งซื้อ ${targetPO.poNo || targetPO.id} (${vendorName})`,
            note: `ตรวจรับสินค้าตามใบสั่งซื้อ ${targetPO.poNo || targetPO.id} (${vendorName})`,
            createdAt: new Date().toISOString()
          };
        });

        storageService.logStockMovements(movementsToEmit);

        if (appContext?.setStockLogs) {
          appContext.setStockLogs(prev => [...movementsToEmit, ...(prev || [])]);
        }
      }

      // 6. Calculate updatedPoItems reflecting this inspection round with dynamic remaining quantity & refund settlement
      const updatedPoItems = (targetPO.items || []).map((poItem, poIdx) => {
        const lineKey = getLineKey(poItem, poIdx);
        const inspected = computedItems.find(row => row.key === lineKey) ||
          computedItems[poIdx] ||
          computedItems.find(row => 
            (row.id && (row.id === poItem.id || row.productId === poItem.id)) || 
            (row.productId && (row.productId === poItem.productId || row.productId === poItem.id)) ||
            (row.code && String(row.code).trim().toUpperCase() === String(poItem.code || poItem.sku).trim().toUpperCase()) ||
            (row.key !== undefined && (row.key === poItem.productId || row.key === poIdx))
          );
        
        if (!inspected) return poItem;

        const ordered = Number(poItem.orderedQty ?? poItem.actualQty ?? poItem.quantity ?? poItem.purchaseQty ?? poItem.qty ?? 0);
        const prevReceived = Number(poItem.accumulatedReceived ?? poItem.receivedQty ?? 0);
        const prevDamaged = Number(poItem.damagedQty ?? 0);
        
        const refundInfo = resolveRefundedQtyAndAmount(poItem, targetPO);
        const refunded = Number(inspected.refunded ?? refundInfo.refundedQty ?? poItem.refundedQty ?? 0);
        const refundAmount = Number(inspected.refundAmount ?? refundInfo.refundAmount ?? poItem.refundAmount ?? 0);
        const isItemRefunded = refunded > 0 || poItem.claimResolution === 'REFUND' || refundInfo.isRefunded;

        const allowedReceiveQty = Math.max(0, ordered - prevReceived - refunded);

        const receivedThisRound = allowedReceiveQty === 0 ? 0 : Math.max(0, Math.min(Number(inspected.acceptedQty || 0), allowedReceiveQty));
        const damagedThisRound = allowedReceiveQty === 0 ? 0 : Math.max(0, Math.min(Number(inspected.damagedQty || 0), allowedReceiveQty - receivedThisRound));

        const totalReceived = prevReceived + receivedThisRound;
        const totalDamaged = prevDamaged + damagedThisRound;
        const shortage = Math.max(0, ordered - totalReceived - refunded - totalDamaged);

        const sAction = inspected.shortageAction || (inspected.shortageReason === 'SPLIT_SHIPMENT' ? 'WAIT_NEXT_ROUND' : (shortage > 0 ? 'CLAIM_SHORTAGE' : ''));
        const isWait = sAction === 'WAIT_NEXT_ROUND';
        const hasItemDispute = (damagedThisRound > 0) || (shortage > 0 && sAction === 'CLAIM_SHORTAGE');
        const disputeAction = isWait ? 'WAIT_NEXT_ROUND' : (hasItemDispute ? 'CLAIM' : 'NONE');

        return {
          ...poItem,
          orderedQty: ordered,
          receivedQty: totalReceived,
          goodQty: totalReceived,
          acceptedQty: totalReceived,
          accumulatedReceived: totalReceived,
          damagedQty: totalDamaged,
          shortageQty: shortage,
          refundedQty: refunded,
          refundAmount: refundAmount || poItem.refundAmount,
          isSettled: isItemRefunded ? true : poItem.isSettled,
          claimResolution: isItemRefunded ? 'REFUND' : poItem.claimResolution,
          replacementPendingQty: poItem.replacementPendingQty,
          shortageAction: sAction,
          shortageReason: isWait ? 'SPLIT_SHIPMENT' : (sAction === 'CLAIM_SHORTAGE' ? 'VENDOR_SHORTAGE' : (poItem.shortageReason || '')),
          isDamaged: totalDamaged > 0,
          defectReason: inspected.defectNote || poItem.defectReason || '',
          disputeAction: disputeAction,
          hasDispute: hasItemDispute
        };
      });

      let finalTargetPO = {
        ...(grResult?.po || targetPO),
        items: updatedPoItems
      };

      const isCompleteReceipt = isFullyAccounted || summary.isFullyAccepted || statusOverride === 'CLOSED' || statusOverride === 'COMPLETED' || finalTargetPO.status === 'COMPLETED';

      if (isCompleteReceipt) {
        finalTargetPO = {
          ...finalTargetPO,
          status: 'COMPLETED',
          workflowStatus: 'COMPLETED',
          isCompleted: true,
          isClosed: true,
          claimStatus: (finalTargetPO.claimStatus === 'RESOLVED' || isFullyAccounted) ? 'RESOLVED' : (finalTargetPO.claimStatus || 'RESOLVED'),
          hasDispute: false,
          isInClaim: false,
          completedAt: finalTargetPO.completedAt || new Date().toISOString(),
          receivingInfo: receivingMetadata,
          receivedBy: receivingMetadata.receiverName,
          receiverName: receivingMetadata.receiverName,
          receiverSignature: receivingMetadata.receiverSignature,
          receivedAt: receivingMetadata.receivedAt
        };
      }

      // 7. If Dispute exists, register claim onto PO so it appears in Online Hub Claim Tab
      if (disputeItems.length > 0) {
        const claimDesc = disputeItems.map(d => `${d.name}: ${d.description}`).join('; ');
        const claimData = {
          reason: disputeItems[0].reasonLabel,
          description: claimDesc,
          channel: targetPO.purchaseChannel || 'ONLINE',
          reportedBy: actorName || currentUser?.name || 'Warehouse Inspector',
          reportedAt: timestamp,
          disputeItems,
          items: disputeItems
        };

        finalTargetPO = {
          ...finalTargetPO,
          status: 'PARTIALLY_RECEIVED_IN_CLAIM',
          claimStatus: 'PENDING_CLAIM',
          claimReason: disputeItems[0].reasonLabel,
          claimDescription: claimDesc,
          claimData,
          claimDetails: claimData
        };

        try {
          await apiService.fileClaim(targetPO.id, claimData, currentUser);
        } catch {
          // Backend offline fallback
        }
      } else if (summary.hasSplitShipment && !isCompleteReceipt) {
        finalTargetPO = {
          ...finalTargetPO,
          status: 'WAITING_DELIVERY_ROUND_2'
        };
      }

      // 8. Atomic Persistence to StorageService, Contexts & API
      if (isFullyAccounted) {
        storageService.finalizePO?.(targetPO.id, finalTargetPO);
      }
      const allPos = storageService.getPOs() || [];
      const pIdx = allPos.findIndex(p => p.id === targetPO.id || p.poNo === targetPO.id || p.poNumber === targetPO.id);
      if (pIdx !== -1) {
        allPos[pIdx] = { ...allPos[pIdx], ...finalTargetPO };
        storageService.savePOs(allPos);
      }

      if (appContext?.updatePO) {
        appContext.updatePO(targetPO.id, finalTargetPO);
      }

      try {
        await apiService.updatePO(targetPO.id, finalTargetPO);
      } catch {
        // Backend offline fallback
      }

      // Refresh app data
      if (appContext?.loadAllData) {
        await appContext.loadAllData();
      }

      modalService.success(
        isFullyAccounted ? 'ปิดงานใบสั่งซื้อสำเร็จ' : (summary.isClaimRequired ? 'บันทึกตรวจรับ & ส่งเรื่องเคลมเรียบร้อย' : 'บันทึกตรวจรับสินค้าสำเร็จ'),
        isFullyAccounted
          ? `ใบสั่งซื้อ ${targetPO.poNo || targetPO.id} ตรวจรับและเคลมชดเชยครบถ้วนแล้ว ปิดงานใบสั่งซื้อเรียบร้อย`
          : (summary.isClaimRequired
              ? `บันทึกรับของเข้าคลัง ${summary.totalAccepted} ชิ้น และส่งต่อเรื่องเคลมไปยังฝ่ายจัดซื้อเรียบร้อยแล้ว`
              : `บันทึกรับสินค้าเข้าคลังเรียบร้อย (เลขที่ GRN: ${grnNumber})`)
      );

      if (onSuccess) onSuccess({ po: finalTargetPO, grn: grResult?.grn });
      if (onClose) onClose();

    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการตรวจรับสินค้า', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* ── 1. MODAL HEADER ── */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {handleBackToPO && (
              <button
                type="button"
                onClick={handleBackToPO}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white mr-1 sm:mr-3 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0 border border-slate-700/80 shadow-2xs"
                title="กลับไปที่หน้าต่างใบสั่งซื้อ (PO)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>กลับไปใบ PO</span>
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Download className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  ตรวจรับพัสดุเข้าคลัง (Goods Receipt / GRN)
                </h3>
                <span className="font-mono text-xs sm:text-sm bg-slate-800 text-emerald-400 px-2.5 py-0.5 rounded font-semibold border border-slate-700 shrink-0">
                  {targetPO.poNo || targetPO.id}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 truncate">
                ผู้ขาย: <span className="text-slate-200 font-semibold">{targetPO.vendorName || targetPO.vendor || '-'}</span> • แผนก: <span className="text-slate-200 font-semibold">{targetPO.department}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleFillAllComplete}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200/80 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              title="กรอกจำนวนตรวจรับเต็มจำนวนที่ค้างรับทั้งหมด"
            >
              <span>⚡ กรอกรับครบทุกรายการ</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. SCROLLABLE BODY (Zero Banner / Clean Workspace) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50" style={{ scrollbarWidth: 'thin' }}>
          
          {/* Informational notice when all items are fully accounted for via receipts and claims */}
          {isFullyAccounted && (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-800">สินค้าทุกรายการได้รับการตรวจรับหรือเคลมชดเชยครบถ้วนแล้ว (100% Accounted)</div>
                <div className="text-emerald-700 text-[11px] mt-0.5">
                  รายการสินค้าในใบสั่งซื้อนี้รับเข้าคลังครบถ้วนหรือได้รับการชดเชยเงินคืนแล้ว สามารถกดปุ่ม &quot;ยืนยันปิดงานใบสั่งซื้อ (Finalize PO)&quot; ด้านล่างเพื่อบันทึกปิดงานสมบูรณ์
                </div>
              </div>
            </div>
          )}

          {/* ── Line-Items Clean Compact Table ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-500" />
                <span>รายการสินค้าที่ตรวจรับ ({computedItems.length} รายการ)</span>
              </span>
              <span className="text-xs text-slate-500 font-mono">
                รอบตรวจรับที่ <strong className="font-bold text-slate-800">{(targetPO.grnHistory?.length || 0) + 1}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th style={{ width: '32%' }} className="w-[32%] py-2.5 px-4 text-left">สินค้า</th>
                    <th style={{ width: '8%' }} className="w-[8%] py-2.5 px-3 text-center">สั่งมา</th>
                    <th style={{ width: '8%' }} className="w-[8%] py-2.5 px-3 text-center">รับแล้ว</th>
                    <th style={{ width: '16%' }} className="w-[16%] py-2.5 px-3 text-center">ตรวจรับรอบนี้</th>
                    <th style={{ width: '12%' }} className="w-[12%] py-2.5 px-3 text-center">ชำรุด/NG</th>
                    <th style={{ width: '24%' }} className="w-[24%] py-2.5 px-4 text-left">สถานะ / การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {computedItems.map((item, idx) => {
                    // Mathematical calculation of remaining pending quantity for next delivery round:
                    // [Total Ordered Qty] - [Already Received in prior rounds] - [Refunded] - [Current user accepted input in this round]
                    const ordered = Number(item.orderedQty ?? item.quantity ?? item.ordered ?? 0);
                    const alreadyReceived = Number(item.alreadyReceived ?? item.accumulated ?? item.receivedQty ?? 0);
                    const refunded = Number(item.refunded ?? item.refundedQty ?? 0);
                    const rawAccepted = item.rawAcceptedInput !== undefined ? item.rawAcceptedInput : item.acceptedQty;
                    const parsedAccepted = rawAccepted === '' ? 0 : Number(rawAccepted);
                    const currentAcceptedInput = isNaN(parsedAccepted) ? 0 : Math.max(0, parsedAccepted);
                    const pendingNextRound = Math.max(0, ordered - alreadyReceived - refunded - (item.isRowLocked ? 0 : currentAcceptedInput));

                    return (
                      <tr 
                        key={item.key} 
                        className={`transition-colors border-b border-slate-100 ${
                          item.isRowLocked && item.refunded > 0 
                            ? 'opacity-80 bg-slate-50/50' 
                            : (item.isRowLocked ? 'bg-slate-50/40' : 'hover:bg-slate-50/80')
                        }`}
                      >
                        {/* 1. สินค้า (32%) */}
                        <td style={{ width: '32%' }} className="w-[32%] py-3.5 px-4 align-middle">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                                {item.code || `ITEM-${idx + 1}`}
                              </span>
                              <span className="text-sm font-bold text-slate-800 leading-snug" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-2 flex-wrap">
                              <span>หน่วย: <strong className="text-slate-700">{item.pUnit}</strong></span>
                              {item.conversionRatio > 1 && (
                                <span className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-sans">
                                  (1 {item.pUnit} = {item.conversionRatio.toLocaleString()} {item.sUnit})
                                </span>
                              )}
                              {item.originalPurchaseQty && Number(item.originalPurchaseQty) !== Number(item.orderedQty) && (
                                <span className="text-[11px] text-indigo-700 font-sans">
                                  (ปรับจาก PR: {item.originalPurchaseQty})
                                </span>
                              )}
                            </div>

                            {/* Compact Defect Note Input (if damaged > 0) */}
                            {item.hasDamage && (
                              <div className="mt-2 pt-0.5">
                                <input
                                  type="text"
                                  placeholder="ระบุอาการชำรุด เช่น แตกหัก, ผิดสเปก..."
                                  value={item.defectNote}
                                  onChange={(e) => handleDefectNoteChange(item.key, e.target.value)}
                                  className="w-full h-8 px-2.5 text-xs bg-rose-50/70 border border-rose-200 rounded-md text-rose-900 placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 2. สั่งมา (8%) */}
                        <td style={{ width: '8%' }} className="w-[8%] py-3.5 px-3 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-mono font-bold text-slate-800 text-sm h-8 flex items-center justify-center">
                              {item.orderedQty}
                            </span>
                            <span className="text-[11px] text-slate-400 h-5 flex items-center justify-center font-mono">
                              {item.pUnit}
                            </span>
                          </div>
                        </td>

                        {/* 3. รับแล้ว (8%) */}
                        <td style={{ width: '8%' }} className="w-[8%] py-3.5 px-3 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-mono text-sm font-bold h-8 flex items-center justify-center">
                              {item.alreadyReceived > 0 ? (
                                <span className="text-emerald-700 font-bold">{item.alreadyReceived}</span>
                              ) : (
                                <span className="text-slate-400 font-medium">-</span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 h-5 flex items-center justify-center font-mono">
                              {item.alreadyReceived > 0 ? item.pUnit : ''}
                            </span>
                          </div>
                        </td>

                        {/* 4. ตรวจรับรอบนี้ (16%) */}
                        <td style={{ width: '16%' }} className="w-[16%] py-3.5 px-3 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            <div className="h-8 flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                max={item.remainingReceivable}
                                value={item.isRowLocked ? 0 : item.rawAcceptedInput}
                                disabled={item.isRowLocked}
                                onChange={(e) => handleAcceptedQtyChange(item.key, e.target.value)}
                                className={`w-16 h-8 text-sm font-mono font-bold text-center rounded-lg outline-none shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
                                  item.isRowLocked
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200 select-none'
                                    : 'bg-white border border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30 text-slate-900'
                                }`}
                                title={item.isRowLocked ? 'ปิดรับแล้ว' : 'จำนวนสินค้าสมบูรณ์ที่รับรอบนี้'}
                              />
                            </div>
                            <div className="h-5 min-h-[20px] flex items-center justify-center mt-1">
                              {!item.isRowLocked ? (
                                item.isReplacement && item.remainingToReceive > 0 ? (
                                  <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                                    📦 รอรับของทดแทน {item.remainingToReceive} {item.pUnit}
                                  </span>
                                ) : item.isSplitShipment && item.remainingToReceive > 0 ? (
                                  <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                                    ⏳ รอรับรอบถัดไป {item.remainingToReceive} {item.pUnit}
                                  </span>
                                ) : pendingNextRound > 0 ? (
                                  <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                                    ⏳ รอรับรอบถัดไป {pendingNextRound} {item.pUnit}
                                  </span>
                                ) : null
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* 5. ชำรุด/NG (12%) */}
                        <td style={{ width: '12%' }} className="w-[12%] py-3.5 px-3 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            <div className="h-8 flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                max={item.remainingReceivable}
                                value={item.isRowLocked ? 0 : item.rawDamagedInput}
                                disabled={item.isRowLocked}
                                onChange={(e) => handleDamagedQtyChange(item.key, e.target.value)}
                                className={`w-16 h-8 text-sm font-mono font-bold text-center rounded-lg outline-none shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
                                  item.isRowLocked
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200 select-none'
                                    : item.hasDamage
                                      ? 'border-2 border-rose-400 text-rose-700 ring-2 ring-rose-200 bg-white'
                                      : 'border border-slate-300 text-slate-700 focus:border-slate-400 bg-white'
                                }`}
                                title={item.isRowLocked ? 'ปิดรับแล้ว' : 'จำนวนสินค้าชำรุดเสียหาย'}
                              />
                            </div>
                            <div className="h-5 min-h-[20px] flex items-center justify-center mt-1">
                              {!item.isRowLocked && item.hasDamage ? (
                                <span className="text-xs text-rose-600 font-medium whitespace-nowrap">
                                  ชำรุด {item.damagedQty} {item.pUnit}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* 6. สถานะ / การจัดการ (24%) */}
                        <td style={{ width: '24%' }} className="w-[24%] py-3.5 px-4 align-middle">
                          {item.isRowLocked ? (
                            item.refunded > 0 ? (
                              <span className="inline-flex items-center justify-center w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                                💰 ได้รับเงินคืนแล้ว ฿{item.refundAmountFormatted} (ปิดรับ)
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                <Check className="w-4 h-4 text-emerald-600 shrink-0 mr-1" />
                                ✓ ตรวจรับครบแล้วในรอบก่อน
                              </span>
                            )
                          ) : item.hasShortage ? (
                            <div className="flex flex-col gap-1.5 w-full">
                              <div className="flex items-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                                  ขาด {item.shortageQty} {item.pUnit}
                                </span>
                              </div>
                              <select
                                value={item.shortageAction || (item.shortageReason === 'SPLIT_SHIPMENT' ? 'WAIT_NEXT_ROUND' : 'CLAIM_SHORTAGE')}
                                onChange={(e) => handleShortageActionChange(item.key, e.target.value)}
                                className="w-full h-8 px-2.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 focus:outline-none cursor-pointer shadow-xs transition-all"
                              >
                                <option value="CLAIM_SHORTAGE">🚨 ของขาด - ส่งเรื่องจัดซื้อเคลม/ขอเงินคืน</option>
                                <option value="WAIT_NEXT_ROUND">📦 ร้านแจ้งแยกส่ง - รอส่งมอบรอบถัดไป</option>
                              </select>
                            </div>
                          ) : item.hasDamage ? (
                            <div className="h-8 px-2.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5 w-full justify-center">
                              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>ชำรุด {item.damagedQty} {item.pUnit} (ส่งเรื่องเคลม)</span>
                            </div>
                          ) : (
                            <div className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5 w-full justify-center">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>ครบสมบูรณ์</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 3. Compact Note & Photos Grid (Symmetrical Equal-Height Columns) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Note */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2 shadow-2xs flex flex-col h-full">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>หมายเหตุการตรวจรับ</span>
              </label>
              <textarea
                value={grnNote}
                onChange={(e) => setGrnNote(e.target.value)}
                placeholder="บันทึกข้อความเพิ่มเติม เช่น พัสดุอยู่ในสภาพเรียบร้อย..."
                className="w-full flex-1 min-h-[88px] p-2.5 text-xs sm:text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-lg outline-none resize-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Attachments */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2 shadow-2xs flex flex-col justify-between h-full">
              <div className="flex items-center justify-between shrink-0">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-slate-500" />
                  <span>ภาพถ่ายพัสดุ / ใบปะหน้ากล่อง</span>
                </label>
                <label className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md text-xs sm:text-sm font-medium cursor-pointer flex items-center gap-1.5 transition-all">
                  <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isUploading ? 'กำลังแนบ...' : '+ เพิ่มไฟล์'}</span>
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

              {attachments.length === 0 ? (
                <div className="flex-1 min-h-[88px] border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs sm:text-sm gap-2 bg-slate-50/50">
                  <Camera className="w-4 h-4 text-slate-300" />
                  <span>ยังไม่มีรูปถ่ายหรือเอกสารแนบ</span>
                </div>
              ) : (
                <div className="flex-1 min-h-[88px] grid grid-cols-4 gap-2 overflow-y-auto pr-1">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative group bg-slate-50 border border-slate-200 rounded-md p-1 overflow-hidden h-20 flex flex-col items-center justify-center">
                      {att.type === 'application/pdf' ? (
                        <div className="w-full h-12 bg-rose-50 rounded flex flex-col items-center justify-center text-rose-500">
                          <FileText className="w-4 h-4" />
                          <span className="text-[9px] font-bold">PDF</span>
                        </div>
                      ) : (
                        <img src={att.previewUrl || att.dataUrl} alt={att.name} className="h-12 w-full object-cover rounded" />
                      )}
                      <p className="text-[9px] text-slate-500 truncate w-full text-center mt-0.5 font-mono">{att.name}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(i)}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="ลบไฟล์"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Summary Status Banner ── */}
          {summary.isFullyAccepted ? (
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-800 text-xs font-medium mb-4">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>ตรวจรับครบถ้วนสมบูรณ์ — บันทึกรับเข้าสต็อกและปิดเอกสาร PO</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto font-mono">
                <span className="text-emerald-700">รับเข้าสต็อก:</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-xs">
                  {totalAcceptedQty} รายการ
                </span>
              </div>
            </div>
          ) : summary.isClaimRequired ? (
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-800 text-xs font-medium mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>พบสินค้าขาดส่งหรือชำรุด — บันทึกเฉพาะยอดสมบูรณ์เข้าคลัง และส่งเรื่องเคลมไปยังฝ่ายจัดซื้อ</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto font-mono text-xs">
                <span className="text-slate-700">รับเข้าสต็อก:</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-xs">
                  {totalAcceptedQty} รายการ
                </span>
                {summary.totalDamaged > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-xs">
                    ชำรุด: {summary.totalDamaged}
                  </span>
                )}
                {summary.totalShortage > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-xs">
                    ยอดค้าง: {summary.totalShortage}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/80 text-indigo-800 text-xs font-medium mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>พัสดุทยอยส่ง — บันทึกรับรอบที่ {(targetPO.grnHistory?.length || 0) + 1} และรอพัสดุส่งรอบถัดไป</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto font-mono">
                <span className="text-indigo-700">รับเข้าสต็อก:</span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-bold text-xs">
                  {totalAcceptedQty} รายการ
                </span>
              </div>
            </div>
          )}

        </div>

        {/* ── 4. MODAL FOOTER (Dynamic Action Button & Color Psychology) ── */}
        <div className="px-5 py-3.5 bg-slate-100/90 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-600 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            ยกเลิกและย้อนกลับ
          </button>

          {isSubmitting ? (
            <button
              type="button"
              disabled
              className="h-9 px-5 rounded-lg text-slate-500 text-xs sm:text-sm font-bold bg-slate-200 cursor-not-allowed flex items-center gap-2"
            >
              <span>กำลังบันทึกตรวจรับ...</span>
            </button>
          ) : isFullyAccounted ? (
            /* กรณีสินค้าทุกรายการตรวจรับหรือเคลมชดเชยครบถ้วนแล้ว (Finalize PO): ปุ่มสีเขียว Emerald */
            <button
              type="button"
              onClick={handleConfirmReceiving}
              disabled={isSubmitting || isUploading}
              className="h-9 px-5 rounded-lg text-white text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-98 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>✓ ยืนยันปิดงานใบสั่งซื้อ (Finalize PO)</span>
            </button>
          ) : summary.isFullyAccepted ? (
            /* กรณีรับครบ 100%: ปุ่มสีเขียว Emerald */
            <button
              type="button"
              onClick={handleConfirmReceiving}
              disabled={isSubmitting || isUploading}
              className="h-9 px-5 rounded-lg text-white text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-98 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>✓ ยืนยันรับเข้าคลังสมบูรณ์</span>
            </button>
          ) : summary.isClaimRequired ? (
            /* กรณีมีสินค้าชำรุด หรือขาดส่งแจ้งเคลม: ปุ่มสีส้ม Amber */
            <button
              type="button"
              onClick={handleConfirmReceiving}
              disabled={isSubmitting || isUploading}
              className="h-9 px-5 rounded-lg text-white text-xs sm:text-sm font-bold bg-amber-600 hover:bg-amber-700 active:scale-98 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>⚠️ บันทึกรับเข้าคลัง &amp; ส่งเรื่องเคลม</span>
            </button>
          ) : (
            /* กรณีรับบางส่วนแต่เป็นการทยอยส่ง (Split Delivery): ปุ่มสีน้ำเงิน Indigo */
            <button
              type="button"
              onClick={handleConfirmReceiving}
              disabled={isSubmitting || isUploading}
              className="h-9 px-5 rounded-lg text-white text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>📦 ยืนยันรับพัสดุ (รอบที่ {(targetPO.grnHistory?.length || 0) + 1})</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}
