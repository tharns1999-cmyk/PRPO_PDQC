import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, Download, AlertTriangle, AlertCircle, CheckCircle2, 
  X, UploadCloud, Trash2, Camera, FileText, ArrowRight, ArrowLeft,
  ShieldAlert, Store, Clock, Check, Truck, AlertOctagon
} from 'lucide-react';
import { useProcurementContext, recordGoodsReceipt as recordGoodsReceiptFn } from '../../context/ProcurementContext';
import { useInventoryContext } from '../../context/InventoryContext';
import { useAppContext } from '../../context/AppContext';
import { modalService } from '../../services/modalService';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';
import { warehouseService, generateGRNNumber } from '../../services/warehouseService';

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
  currentRole 
}) {
  const targetPO = po || selectedPO;
  if (!isOpen || !targetPO) return null;

  const handleBackToPO = onBack || onBackToPO;

  let procurement = null;
  let inventory = null;
  let appContext = null;
  try { procurement = useProcurementContext(); } catch {}
  try { inventory = useInventoryContext(); } catch {}
  try { appContext = useAppContext(); } catch {}
  const currentUser = appContext?.currentUser || currentRole;

  const fileInputRef = useRef(null);

  // Initialize line-item state
  const [itemsState, setItemsState] = useState(() => {
    const initial = {};
    (targetPO.items || []).forEach((item, idx) => {
      const { remainingToReceive } = resolveRefundedQtyAndAmount(item, targetPO);

      initial[item.productId || idx] = {
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

  const [grnNote, setGrnNote] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Computed line items with auto-calculated shortage and remaining quantity
  const computedItems = useMemo(() => {
    return (targetPO.items || []).map((item, idx) => {
      const key = item.productId || idx;
      const state = itemsState[key] || {
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

      const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
      const sUnit = item.stockUnit || item.unit || pUnit;

      const shortageAction = state.shortageAction || (state.shortageReason === 'SPLIT_SHIPMENT' ? 'WAIT_NEXT_ROUND' : 'CLAIM_SHORTAGE');
      const shortageReason = state.shortageReason || (shortageAction === 'WAIT_NEXT_ROUND' ? 'SPLIT_SHIPMENT' : 'VENDOR_SHORTAGE');

      const refundAmountFormatted = refundAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      return {
        ...item,
        key,
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

  // Handler: Update shortage reason
  const handleShortageReasonChange = (key, reason) => {
    const action = (reason === 'SPLIT_SHIPMENT' || reason === 'WAIT_NEXT_ROUND') ? 'WAIT_NEXT_ROUND' : 'CLAIM_SHORTAGE';
    handleShortageActionChange(key, action);
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

    if (summary.totalAccepted === 0 && summary.totalDamaged === 0 && summary.totalShortage === 0) {
      return modalService.warning('กรุณาระบุจำนวนสินค้าที่ตรวจรับ');
    }

    // Confirmation dialog
    let confirmTitle = 'ยืนยันการตรวจรับสินค้า';
    let confirmDesc = `ยืนยันบันทึกตรวจรับสินค้าเข้าคลังสำหรับ PO ${targetPO.poNo || targetPO.id} หรือไม่?`;
    let confirmType = 'success';

    if (summary.isClaimRequired) {
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
      confirmText: summary.isClaimRequired ? 'ยืนยันตรวจรับ & ส่งเรื่องเคลม' : (summary.hasSplitShipment ? 'ยืนยันรับพัสดุรอบนี้' : 'ยืนยันรับเข้าคลังสมบูรณ์'),
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const nextRound = (targetPO.grnHistory?.length || 0) + 1;
      const grnNumber = generateGRNNumber(targetPO.poNo || targetPO.id, nextRound);
      const timestamp = new Date().toLocaleString('th-TH');

      // Status determination
      let statusOverride = 'PARTIAL';
      if (summary.isClaimRequired) {
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
        receivedBy: currentUser?.name ? `${currentUser.name} (${currentUser.title || ''})` : receiverName,
        receiverSignature,
        receivingInfo,
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
      const grResult = procurement?.recordGoodsReceipt
        ? await procurement.recordGoodsReceipt(targetPO.id, grnPayload)
        : appContext?.recordGoodsReceipt
          ? await appContext.recordGoodsReceipt(targetPO.id, grnPayload)
          : await recordGoodsReceiptFn(targetPO.id, grnPayload);

      // 5. Call receiveToStock from Inventory Context or warehouseService (STRICTLY complete good items only)
      const stockItemsToReceive = computedItems
        .filter(it => it.acceptedQty > 0 && !it.isRowLocked)
        .map(it => ({
          productId: it.productId,
          code: it.code,
          name: it.name,
          qty: it.acceptedQty,
          receivedQty: it.acceptedQty,
          damagedQty: 0, // only intact good goods
          conversionRate: it.conversionRate || 1,
          purchaseUnit: it.purchaseUnit || it.pUnit,
          stockUnit: it.stockUnit || it.sUnit,
          docNo: targetPO.poNo || targetPO.id,
          poNo: targetPO.poNo || targetPO.id,
          poNumber: targetPO.poNo || targetPO.id,
          unitPrice: Number(it.actUnitPrice ?? it.actualPrice ?? it.price) || 0,
          actualPrice: Number(it.actUnitPrice ?? it.actualPrice ?? it.price) || 0,
          grNumber: grnNumber,
          grnNumber
        }));

      if (stockItemsToReceive.length > 0) {
        const receiveOptions = {
          docNo: targetPO.poNo || targetPO.id,
          poNo: targetPO.poNo || targetPO.id,
          poNumber: targetPO.poNo || targetPO.id,
          grNumber: grnNumber,
          grnNumber,
          user: currentUser,
          note: `รับเข้าคลังรอบ ${nextRound} (GRN: ${grnNumber}) เฉพาะยอดสมบูรณ์`
        };

        if (inventory?.receiveToStock) {
          await inventory.receiveToStock(stockItemsToReceive, receiveOptions);
        } else if (appContext?.receiveToStock) {
          await appContext.receiveToStock(stockItemsToReceive, receiveOptions);
        } else {
          await warehouseService.submitGRN(targetPO.id, {
            grnNumber,
            round: nextRound,
            receivedDate: timestamp,
            receivedBy: currentUser,
            receivingItems: stockItemsToReceive,
            note: grnNote.trim()
          }, { user: currentUser });
        }
      }

      // 6. Calculate updatedPoItems reflecting this inspection round with dynamic remaining quantity & refund settlement
      const updatedPoItems = (targetPO.items || []).map((poItem, poIdx) => {
        const inspected = computedItems.find(row => 
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

      const isCompleteReceipt = summary.isFullyAccepted || statusOverride === 'CLOSED' || statusOverride === 'COMPLETED' || finalTargetPO.status === 'COMPLETED';

      if (isCompleteReceipt) {
        finalTargetPO = {
          ...finalTargetPO,
          status: 'COMPLETED',
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
          reportedBy: currentUser?.name || 'Warehouse Inspector',
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
      const allPos = storageService.getPOs() || [];
      const pIdx = allPos.findIndex(p => p.id === targetPO.id || p.poNo === targetPO.id || p.poNumber === targetPO.id);
      if (pIdx !== -1) {
        allPos[pIdx] = { ...allPos[pIdx], ...finalTargetPO };
        storageService.savePOs(allPos);
      }

      if (procurement?.updatePO) {
        procurement.updatePO(targetPO.id, finalTargetPO);
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
        summary.isClaimRequired ? 'บันทึกตรวจรับ & ส่งเรื่องเคลมเรียบร้อย' : 'บันทึกตรวจรับสินค้าสำเร็จ',
        summary.isClaimRequired
          ? `บันทึกรับของเข้าคลัง ${summary.totalAccepted} ชิ้น และส่งต่อเรื่องเคลมไปยังฝ่ายจัดซื้อเรียบร้อยแล้ว`
          : `บันทึกรับสินค้าเข้าคลังเรียบร้อย (เลขที่ GRN: ${grnNumber})`
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
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4 text-left">สินค้า</th>
                    <th className="py-2.5 px-3 text-center w-20">สั่งมา</th>
                    <th className="py-2.5 px-3 text-center w-20">รับแล้ว</th>
                    <th className="py-2.5 px-3 text-center w-28">ตรวจรับรอบนี้</th>
                    <th className="py-2.5 px-3 text-center w-24">ชำรุด/NG</th>
                    <th className="py-2.5 px-4 text-left w-60">สถานะ / การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {computedItems.map((item, idx) => (
                    <tr 
                      key={item.key} 
                      className={`transition-colors border-b border-slate-100 ${
                        item.isRowLocked && item.refunded > 0 
                          ? 'opacity-80 bg-slate-50/50' 
                          : (item.isRowLocked ? 'bg-slate-50/40' : 'hover:bg-slate-50/80')
                      }`}
                    >
                      {/* 1. สินค้า */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                              {item.code || `ITEM-${idx + 1}`}
                            </span>
                            <span className="text-sm font-bold text-slate-800 leading-snug" title={item.name}>
                              {item.name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                            <span>หน่วย: {item.pUnit}</span>
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

                      {/* 2. สั่งมา */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <span className="font-mono font-semibold text-slate-700 text-sm">{item.orderedQty}</span>
                      </td>

                      {/* 3. รับแล้ว */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <span className="font-mono text-sm text-slate-700 font-semibold">
                          {item.alreadyReceived > 0 ? (
                            <span className="text-emerald-700 font-bold">{item.alreadyReceived}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </span>
                      </td>

                      {/* 4. ตรวจรับรอบนี้ */}
                      <td className="py-3.5 px-3 text-center align-middle">
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
                        {item.remainingToReceive > 0 && (
                          <div className="mt-1 whitespace-nowrap">
                            {item.isReplacement ? (
                              <span className="text-xs text-amber-600 font-medium">📦 รอรับของทดแทน {item.remainingToReceive} {item.pUnit}</span>
                            ) : item.isSplitShipment ? (
                              <span className="text-xs text-amber-600 font-medium">⏳ รอรับรอบถัดไป {item.remainingToReceive} {item.pUnit}</span>
                            ) : (
                              <span className="text-xs text-amber-600 font-medium">⏳ รอรับรอบถัดไป {item.remainingToReceive} {item.pUnit}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. ชำรุด/NG */}
                      <td className="py-3.5 px-3 text-center align-middle">
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
                      </td>

                      {/* 6. สถานะ / การจัดการ */}
                      <td className="py-3.5 px-4 align-middle">
                        {item.isRowLocked ? (
                          item.refunded > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                              💰 ได้รับเงินคืนแล้ว ฿{item.refundAmountFormatted} (ปิดรับ)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0 mr-1" />
                              ✓ ตรวจรับครบแล้วในรอบก่อน
                            </span>
                          )
                        ) : item.hasShortage ? (
                          <div className="space-y-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                              ขาด {item.shortageQty} {item.pUnit}
                            </span>
                            <select
                              value={item.shortageAction || (item.shortageReason === 'SPLIT_SHIPMENT' ? 'WAIT_NEXT_ROUND' : 'CLAIM_SHORTAGE')}
                              onChange={(e) => handleShortageActionChange(item.key, e.target.value)}
                              className="w-full h-8 px-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 focus:outline-none cursor-pointer shadow-xs"
                            >
                              <option value="CLAIM_SHORTAGE">🚨 ของขาด - ส่งเรื่องจัดซื้อเคลม/ขอเงินคืน</option>
                              <option value="WAIT_NEXT_ROUND">📦 ร้านแจ้งแยกส่ง - รอส่งมอบรอบถัดไป</option>
                            </select>
                          </div>
                        ) : item.hasDamage ? (
                          <div className="h-8 px-2.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5">
                            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>ชำรุด {item.damagedQty} {item.pUnit} (ส่งเรื่องเคลม)</span>
                          </div>
                        ) : (
                          <div className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>ครบสมบูรณ์</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 3. Compact Note & Photos Grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Note */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2 shadow-2xs">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>หมายเหตุการตรวจรับ</span>
              </label>
              <textarea
                value={grnNote}
                onChange={(e) => setGrnNote(e.target.value)}
                placeholder="บันทึกข้อความเพิ่มเติม เช่น พัสดุอยู่ในสภาพเรียบร้อย..."
                className="w-full h-20 p-2.5 text-xs sm:text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-lg outline-none resize-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Attachments */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
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
                <div className="h-20 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs sm:text-sm gap-2 bg-slate-50/50">
                  <Camera className="w-4 h-4 text-slate-300" />
                  <span>ยังไม่มีรูปถ่ายหรือเอกสารแนบ</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 h-20 overflow-y-auto pr-1">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative group bg-slate-50 border border-slate-200 rounded-md p-1 overflow-hidden h-18 flex flex-col items-center justify-center">
                      {att.type === 'application/pdf' ? (
                        <div className="w-full h-11 bg-rose-50 rounded flex flex-col items-center justify-center text-rose-500">
                          <FileText className="w-4 h-4" />
                          <span className="text-[9px] font-bold">PDF</span>
                        </div>
                      ) : (
                        <img src={att.previewUrl || att.dataUrl} alt={att.name} className="h-11 w-full object-cover rounded" />
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
