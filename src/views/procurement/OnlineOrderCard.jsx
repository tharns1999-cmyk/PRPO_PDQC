import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, ExternalLink, AlertCircle, Copy, Check, RotateCcw, 
  Store, Sparkles, AlertTriangle, ArrowRight, FileText, CheckCircle2,
  Clock, ShieldAlert, ChevronDown, ChevronUp, Paperclip, Eye, Download,
  Image as ImageIcon, X
} from 'lucide-react';
import { sanitizeExternalUrl, getProductUrl } from '../../utils/urlHelper';
import { apiService } from '../../services/apiService';
import { modalService } from '../../services/modalService';
import { useAppContext } from '../../context/AppContext';
import { rollbackBudget as standaloneRollbackBudget, deductBudget as standaloneDeductBudget } from '../../context/BudgetContext';
import CollapsibleActivityTimeline from '../../components/common/CollapsibleActivityTimeline';
import { isOrderPending, isOrderInClaim, isOrderClosed } from '../../context/OnlineOrderContext';
import ImageLightboxModal from '../../components/common/ImageLightboxModal';
import { getFallbackAttachmentsForCode } from '../../services/workflowEngine';
import AttachmentViewerModal from '../../components/common/AttachmentViewerModal';

export default function OnlineOrderCard({ 
  po, 
  activeTab,
  currentRole, 
  onUpdate, 
  onViewAttachment, 
  onShowDetails 
}) {
  const getVendorStr = (p) => {
    if (!p) return '';
    if (typeof p.vendor === 'object' && p.vendor) return p.vendor.name || p.vendor.companyName || '';
    if (typeof p.vendor === 'string' && p.vendor && !p.vendor.includes('ระบุร้านภายหลัง')) return p.vendor;
    if (p.shopName && !p.shopName.includes('ระบุร้านภายหลัง')) return p.shopName;
    if (p.vendorName && !p.vendorName.includes('ระบุร้านภายหลัง')) return p.vendorName;
    return '';
  };

  const initialVendor = getVendorStr(po);
  const [vendorName, setVendorName] = useState(initialVendor);
  const [varianceNote, setVarianceNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [copiedPO, setCopiedPO] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [invalidStoreIndices, setInvalidStoreIndices] = useState(new Set());
  const [prDocsModalOpen, setPrDocsModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    initialIndex: 0,
    title: ''
  });

  const openLightbox = (images, initialIndex = 0, title = '') => {
    setLightboxState({
      isOpen: true,
      images,
      initialIndex,
      title
    });
  };

  const closeLightbox = () => {
    setLightboxState(prev => ({ ...prev, isOpen: false }));
  };

  const getItemAttachments = (item) => {
    if (!item) return [];
    const cleanCode = String(item.code || item.sku || '').trim().toUpperCase();

    // ✅ ตรวจสอบรูปภาพจริงของผู้ใช้ก่อนเสมอ (User Upload First)
    const userAttachments = (Array.isArray(item.attachments) && item.attachments.length > 0)
      ? item.attachments
      : ((Array.isArray(item.images) && item.images.length > 0) ? item.images : null);

    // ดึง fallback เฉพาะเมื่อผู้ใช้ไม่ได้แนบรูปมาจริง ๆ เท่านั้น
    const rawList = userAttachments || getFallbackAttachmentsForCode(cleanCode) || [];

    return (Array.isArray(rawList) ? rawList : [rawList]).map((img, idx) => {
      if (typeof img === 'string') {
        return { url: img, previewUrl: img, name: item.name || `รูปที่ ${idx + 1}` };
      }
      const imgUrl = img?.previewUrl || img?.url || img?.dataUrl || '';
      return {
        url: imgUrl,
        previewUrl: imgUrl,
        name: img?.name || item.name || `รูปที่ ${idx + 1}`,
        type: img?.type || 'image/jpeg'
      };
    }).filter(img => Boolean(img.url));
  };

  // Derive all PR documents (Quotation, general attachments, prAttachments)
  const prDocs = useMemo(() => {
    if (!po) return [];
    const list = [
      ...(po.prAttachments || []),
      ...(po.attachments || []),
      ...(po.quotationFiles || []),
      ...(po.generalAttachments || [])
    ];
    const seen = new Set();
    return list.filter(item => {
      const key = item.url || item.previewUrl || item.name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((item, idx) => {
      const isPdf = item.type === 'application/pdf' || (typeof (item.url || item.name) === 'string' && (item.url || item.name).toLowerCase().endsWith('.pdf')) || item.category === 'QUOTATION';
      return {
        id: item.id || idx,
        name: item.name || (isPdf ? `ใบเสนอราคา (${idx + 1})` : `เอกสารแนบ (${idx + 1})`),
        url: item.previewUrl || item.url || item.dataUrl || '',
        type: item.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        category: item.category || (isPdf ? 'QUOTATION' : 'GENERAL'),
        size: item.size
      };
    });
  }, [po]);

  const { currentUser, refundBudget, rollbackBudget, deductBudget } = useAppContext();

  // ── Status Mapping & Strict Mode Flags (Directive 1) ──
  const statusStr = String(po?.status || '').toLowerCase();
  
  // Mode 1: Pending Order Placement (Strict Mode 1)
  const isPending = activeTab === 'PENDING' || (
    activeTab !== 'CLAIM' && activeTab !== 'ORDERED' && activeTab !== 'CLOSED' && isOrderPending(po?.status)
  );

  // Mode 2: Claim Mode (Strictly only when GRN reported issues and not pending or closed)
  const isClaimOrder = !isPending && (
    activeTab === 'CLAIM' || (
      (po?.status === 'IN_CLAIM' || po?.status === 'PARTIALLY_RECEIVED_IN_CLAIM' || isOrderInClaim(po?.status)) &&
      !isOrderClosed(po?.status)
    )
  );

  const isClosed = !isPending && (activeTab === 'CLOSED' || isOrderClosed(po?.status));
  const isPartialReceived = !isPending && ['partial', 'partially_received', 'partial_received', 'รับของแล้วบางส่วน'].includes(statusStr);
  const isOrdered = !isPending && (activeTab === 'ORDERED' || ['ordered', 'ordered_pending_delivery', 'in_delivery', 'waiting_delivery', 'waiting_delivery_round_2'].includes(statusStr) || statusStr.startsWith('waiting_delivery'));

  // Format date-time helper (DD/MM/YYYY HH:mm format)
  const formatDateTime = (val) => {
    if (!val || val === '-') return '';
    const str = String(val).trim();
    const pad = (n) => String(n).padStart(2, '0');
    const matchDmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*(\d{1,2}):(\d{2})/);
    if (matchDmy) {
      let p1 = parseInt(matchDmy[1], 10);
      let p2 = parseInt(matchDmy[2], 10);
      let yr = parseInt(matchDmy[3], 10);
      const hh = pad(matchDmy[4]);
      const mm = matchDmy[5];

      if (yr === 12 || yr === 26 || yr === 69) yr = 2026;
      else if (yr < 100) yr = 2000 + yr;
      else if (yr > 2400) yr -= 543;

      let day = p1;
      let month = p2;
      if (p1 <= 12 && p2 > 12) {
        day = p2;
        month = p1;
      }
      return `${pad(day)}/${pad(month)}/${yr} ${hh}:${mm}`;
    }
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return str;
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      let year = d.getFullYear();
      if (year > 2400) year -= 543;
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return str;
    }
  };

  // ── State for Items ──
  const [itemData, setItemData] = useState(() => 
    (po.items || []).map((item, idx) => ({
      ...item,
      id: item.id || item.sku || `item-${idx}`,
      code: item.code || item.sku || '',
      name: item.name || '',
      note: item.note || '',
      unit: item.unit || item.purchaseUnit || 'ชิ้น',
      purchaseUnit: item.purchaseUnit || item.unit || 'ชิ้น',
      attachments: (Array.isArray(item.attachments) && item.attachments.length > 0)
        ? item.attachments
        : (Array.isArray(item.images) ? item.images : []),
      images: (Array.isArray(item.images) && item.images.length > 0)
        ? item.images
        : (Array.isArray(item.attachments) ? item.attachments : []),
      actualStoreName: (item.actualStoreName && !item.actualStoreName.includes('ระบุร้านภายหลัง')) 
        ? item.actualStoreName 
        : (item.storeName && !item.storeName.includes('ระบุร้านภายหลัง')) 
        ? item.storeName 
        : '',
      storePlatform: item.storePlatform || item.platform || 'Shopee',
      actualPrice: item.actualPrice ?? item.unitPrice ?? item.estimatedPrice ?? item.price ?? 0,
      actualQty: item.actualQty ?? item.purchaseQty ?? item.qty ?? 1,
      unitPrice: item.actualPrice ?? item.unitPrice ?? item.estimatedPrice ?? item.price ?? 0,
      purchaseQty: item.actualQty ?? item.purchaseQty ?? item.qty ?? 1,
      originalEstimatedPrice: Number(item.originalEstimatedPrice ?? item.estimatedPrice ?? item.unitPrice ?? item.price) || 0,
      originalPurchaseQty: Number(item.originalPurchaseQty ?? item.qty ?? item.purchaseQty) || 1,
      orderRefNo: item.orderRefNo || ''
    }))
  );

  // Sync itemData when po.items or po.id updates
  useEffect(() => {
    setItemData(
      (po.items || []).map((item, idx) => ({
        ...item,
        id: item.id || item.sku || `item-${idx}`,
        code: item.code || item.sku || '',
        name: item.name || '',
        note: item.note || '',
        unit: item.unit || item.purchaseUnit || 'ชิ้น',
        purchaseUnit: item.purchaseUnit || item.unit || 'ชิ้น',
        attachments: (Array.isArray(item.attachments) && item.attachments.length > 0)
          ? item.attachments
          : (Array.isArray(item.images) ? item.images : []),
        images: (Array.isArray(item.images) && item.images.length > 0)
          ? item.images
          : (Array.isArray(item.attachments) ? item.attachments : []),
        actualStoreName: (item.actualStoreName && !item.actualStoreName.includes('ระบุร้านภายหลัง')) 
          ? item.actualStoreName 
          : (item.storeName && !item.storeName.includes('ระบุร้านภายหลัง')) 
          ? item.storeName 
          : '',
        storePlatform: item.storePlatform || item.platform || 'Shopee',
        actualPrice: item.actualPrice ?? item.unitPrice ?? item.estimatedPrice ?? item.price ?? 0,
        actualQty: item.actualQty ?? item.purchaseQty ?? item.qty ?? 1,
        unitPrice: item.actualPrice ?? item.unitPrice ?? item.estimatedPrice ?? item.price ?? 0,
        purchaseQty: item.actualQty ?? item.purchaseQty ?? item.qty ?? 1,
        originalEstimatedPrice: Number(item.originalEstimatedPrice ?? item.estimatedPrice ?? item.unitPrice ?? item.price) || 0,
        originalPurchaseQty: Number(item.originalPurchaseQty ?? item.qty ?? item.purchaseQty) || 1,
        orderRefNo: item.orderRefNo || ''
      }))
    );
  }, [po.id, po.items]);

  // ── Store-Level Inputs State (Directive 1: Unify Store-Level Inputs) ──
  const [storeInfo, setStoreInfo] = useState(() => {
    const initial = {};
    (po?.items || []).forEach((item, idx) => {
      const plat = item.storePlatform || item.platform || 'Shopee';
      const initialStore = (item.actualStoreName && !item.actualStoreName.includes('ระบุร้านภายหลัง'))
        ? item.actualStoreName
        : (item.storeName && !item.storeName.includes('ระบุร้านภายหลัง'))
        ? item.storeName
        : '';
      const key = `${plat}_${initialStore || 'group_' + plat}`;
      if (!initial[key]) {
        initial[key] = {
          storeName: initialStore,
          orderId: item.orderRefNo || ''
        };
      }
    });
    return initial;
  });

  // Sync storeInfo on PO changes
  useEffect(() => {
    const initial = {};
    (po?.items || []).forEach((item, idx) => {
      const plat = item.storePlatform || item.platform || 'Shopee';
      const initialStore = (item.actualStoreName && !item.actualStoreName.includes('ระบุร้านภายหลัง'))
        ? item.actualStoreName
        : (item.storeName && !item.storeName.includes('ระบุร้านภายหลัง'))
        ? item.storeName
        : '';
      const key = `${plat}_${initialStore || 'group_' + plat}`;
      if (!initial[key]) {
        initial[key] = {
          storeName: initialStore,
          orderId: item.orderRefNo || ''
        };
      }
    });
    setStoreInfo(initial);
  }, [po?.id]);

  const items = itemData;

  const handleItemChange = (index, field, value) => {
    setItemData(prev => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };
      if (field === 'actualPrice') target.unitPrice = value;
      if (field === 'actualQty') target.purchaseQty = value;
      if (field === 'unitPrice') target.actualPrice = value;
      if (field === 'purchaseQty') target.actualQty = value;
      next[index] = target;
      return next;
    });
    if (field === 'actualStoreName' && invalidStoreIndices.has(index)) {
      const trimmed = (value || '').trim();
      if (trimmed && !trimmed.includes('ระบุร้านภายหลัง')) {
        const nextSet = new Set(invalidStoreIndices);
        nextSet.delete(index);
        setInvalidStoreIndices(nextSet);
      }
    }
  };

  const handlePriceChange = (index, val) => {
    const num = parseFloat(val);
    handleItemChange(index, 'actualPrice', isNaN(num) || num < 0 ? '' : num);
  };

  const handleQtyChange = (index, val) => {
    const num = parseFloat(val);
    handleItemChange(index, 'actualQty', isNaN(num) || num <= 0 ? '' : num);
  };

  const handleItemStoreChange = (index, value) => {
    handleItemChange(index, 'actualStoreName', value);
  };

  const handleItemPlatformChange = (index, platform) => {
    handleItemChange(index, 'storePlatform', platform);
  };

  const handleItemOrderRefChange = (index, refNo) => {
    handleItemChange(index, 'orderRefNo', refNo);
  };

  // ── Unified Store Header Updater (Directive 1) ──
  const handleUpdateStoreHeader = (storeKey, field, value) => {
    setStoreInfo(prev => ({
      ...prev,
      [storeKey]: {
        ...(prev[storeKey] || {}),
        [field]: value
      }
    }));

    // Synchronize to itemData for all items belonging to this store section
    const targetGroup = storesGroup.find(g => g.storeKey === storeKey);
    if (targetGroup && targetGroup.itemIndices) {
      setItemData(prev => {
        const next = [...prev];
        targetGroup.itemIndices.forEach(idx => {
          if (next[idx]) {
            if (field === 'storeName') {
              next[idx] = { ...next[idx], actualStoreName: value };
            } else if (field === 'orderId') {
              next[idx] = { ...next[idx], orderRefNo: value };
            }
          }
        });
        return next;
      });
    }

    if (field === 'storeName') {
      const trimmed = (value || '').trim();
      if (trimmed && !trimmed.includes('ระบุร้านภายหลัง')) {
        if (targetGroup && targetGroup.itemIndices) {
          setInvalidStoreIndices(prev => {
            const next = new Set(prev);
            targetGroup.itemIndices.forEach(idx => next.delete(idx));
            return next;
          });
        }
      }
    }
  };

  // Check if modified from original estimate
  const hasModifications = useMemo(() => {
    return items.some(it => 
      Number(it.unitPrice) !== Number(it.originalEstimatedPrice) ||
      Number(it.purchaseQty) !== Number(it.originalPurchaseQty)
    );
  }, [items]);

  // Real-time totals
  const totalEstimatedAmount = useMemo(() => {
    return items.reduce((sum, it) => sum + ((Number(it.purchaseQty) || 0) * (Number(it.unitPrice) || 0)), 0);
  }, [items]);

  const originalTotalAmount = useMemo(() => {
    return items.reduce((sum, it) => sum + ((Number(it.originalPurchaseQty) || 0) * (Number(it.originalEstimatedPrice) || 0)), 0);
  }, [items]);

  const priceDiff = totalEstimatedAmount - originalTotalAmount;

  const handleCopyText = (text, type = 'item') => {
    navigator.clipboard.writeText(text);
    if (type === 'po') {
      setCopiedPO(true);
      setTimeout(() => setCopiedPO(false), 2000);
    } else {
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(''), 2000);
    }
  };

  // ── Group Items by Store (Directive 1, 2, 3 & 4) ──
  const storesGroup = useMemo(() => {
    const groups = {};
    const sourceList = isPending ? itemData : (po?.items || []);

    sourceList.forEach((item, itemIdx) => {
      const plat = item.storePlatform || item.platform || 'Shopee';
      
      let key;
      let sName;
      let hasRealStore;

      if (isPending) {
        // In pending mode, use a stable key based on platform + initial PR store to prevent focus jumping
        const initialStore = (po?.items?.[itemIdx]?.actualStoreName && !po?.items?.[itemIdx]?.actualStoreName.includes('ระบุร้านภายหลัง'))
          ? po.items[itemIdx].actualStoreName
          : (po?.items?.[itemIdx]?.storeName && !po?.items?.[itemIdx]?.storeName.includes('ระบุร้านภายหลัง'))
          ? po.items[itemIdx].storeName
          : '';
        key = `${plat}_${initialStore || 'group_' + plat}`;
        const currentStoreName = storeInfo[key]?.storeName !== undefined
          ? storeInfo[key].storeName
          : (item.actualStoreName || initialStore || '');
        hasRealStore = Boolean(currentStoreName && !currentStoreName.includes('ระบุร้านภายหลัง'));
        sName = hasRealStore ? currentStoreName : '[ระบุร้านค้าตอนกดสั่งซื้อ]';
      } else {
        const rawStoreName = (item.actualStoreName || item.storeName || po?.vendorName || '').trim();
        hasRealStore = Boolean(rawStoreName && !rawStoreName.includes('ระบุร้านภายหลัง'));
        sName = hasRealStore ? rawStoreName : 'ตลาดออนไลน์ (Shopee/Lazada)';
        key = `${plat}_${sName}`;
      }
      
      if (!groups[key]) {
        groups[key] = {
          storeKey: key,
          platform: plat,
          storeName: sName,
          hasRealStore,
          items: [],
          itemIndices: [],
          totalAmount: 0,
          hasDispute: false,
          status: isPending ? 'PENDING' : 'COMPLETED',
          issueItems: [],
          defaultRefund: 0
        };
      }
      
      groups[key].items.push(item);
      groups[key].itemIndices.push(itemIdx);
      const price = Number(item.unitPrice ?? item.actualPrice ?? item.price ?? 0);
      const qty = Number(item.purchaseQty ?? item.actualQty ?? item.qty ?? 0);
      groups[key].totalAmount += (qty * price);
      
      // Directive 2: Fix False Dispute Bug
      // ห้าม Flag เป็น Dispute ถ้าออเดอร์ยังไม่ได้สั่งซื้อหรือยังไม่ผ่านการตรวจรับ
      const isDisputed = Boolean(
        isClaimOrder &&
        (po?.status === 'IN_CLAIM' || po?.status === 'PARTIALLY_RECEIVED_IN_CLAIM' || activeTab === 'CLAIM') &&
        (Number(item.shortageQty) > 0 || Number(item.damagedQty) > 0 || item.claimStatus === 'PENDING')
      );
      
      if (isDisputed) {
        const short = Number(item.shortageQty || 0);
        const dmg = Number(item.damagedQty || 0);
        groups[key].hasDispute = true;
        groups[key].status = 'IN_CLAIM';
        groups[key].issueItems.push(item);
        groups[key].defaultRefund += (short + dmg) * price;
      }
    });
    
    // Merge existing store claim states only if PO is genuinely in claim mode
    if (isClaimOrder) {
      const storeClaims = po?.storeClaims || {};
      Object.keys(groups).forEach(key => {
        if (storeClaims[key]) {
          groups[key].status = storeClaims[key].status || 'RESOLVED';
          groups[key].claimData = storeClaims[key];
        }
      });
    }

    return Object.values(groups);
  }, [isPending, itemData, po?.items, po?.storeClaims, po?.vendorName, isClaimOrder, po?.status, activeTab, storeInfo]);

  // Disputed stores count (strictly 0 if not in claim mode)
  const disputedStoresCount = isClaimOrder ? storesGroup.filter(g => g.hasDispute && g.status !== 'RESOLVED').length : 0;
  const isAllResolved = isClaimOrder && storesGroup.length > 0 && storesGroup.every(g => !g.hasDispute || g.status === 'RESOLVED');

  // Multi-Store Claim State Map
  const [storeClaimStates, setStoreClaimStates] = useState({});

  useEffect(() => {
    if (!isClaimOrder) {
      setStoreClaimStates({});
      return;
    }
    const initialStates = {};
    storesGroup.forEach(g => {
      if (g.hasDispute) {
        initialStates[g.storeKey] = {
          showResolutionForm: g.status !== 'RESOLVED',
          claimResolutionType: g.claimData?.type || 'REFUND',
          claimExpectedDate: g.claimData?.expectedDate || '',
          claimNote: g.claimData?.note || '',
          refundAmount: g.claimData?.refundAmount !== undefined ? g.claimData.refundAmount : (Math.round(g.defaultRefund * 100) / 100),
          newTrackingNo: g.claimData?.replacementTrackingNo || g.claimData?.newTrackingNo || ''
        };
      }
    });
    setStoreClaimStates(initialStates);
  }, [storesGroup, po?.storeClaims, isClaimOrder]);

  // Unique stores calculation
  const uniqueStores = useMemo(() => {
    if (isPending) {
      return storesGroup
        .map(g => (storeInfo[g.storeKey]?.storeName || '').trim())
        .filter(s => s && !s.includes('ระบุร้านภายหลัง'));
    }
    return Array.from(new Set(items.map(it => (it.actualStoreName || it.storeName || '').trim()).filter(s => s && !s.includes('ระบุร้านภายหลัง'))));
  }, [isPending, storesGroup, storeInfo, items]);

  // Store validation status for unlocking confirm button (Directive 2: No Order ID required)
  const isAllStoresFilled = useMemo(() => {
    if (!storesGroup || storesGroup.length === 0) return false;
    return storesGroup.every(group => {
      const sName = (storeInfo[group.storeKey]?.storeName || group.storeName || '').trim();
      const hasValidStore = Boolean(sName && !sName.includes('ระบุร้านภายหลัง'));
      return hasValidStore;
    });
  }, [storesGroup, storeInfo]);

  const hasInvalidPrice = useMemo(() => {
    return items.some(it => it.unitPrice === '' || isNaN(Number(it.unitPrice)) || Number(it.unitPrice) < 0);
  }, [items]);

  const hasInvalidQty = useMemo(() => {
    return items.some(it => {
      const q = Number(it.purchaseQty ?? it.actualQty);
      return it.purchaseQty === '' || isNaN(q) || q < 1 || !Number.isInteger(q);
    });
  }, [items]);

  const isConfirmReady = isAllStoresFilled && !hasInvalidPrice && !hasInvalidQty && !isSubmitting;

  // Platform Branded Badge Helper (Directive 4)
  const getPlatformBadge = (platform = 'Shopee') => {
    const p = String(platform || '').toLowerCase();
    if (p === 'shopee') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-md bg-[#FFF2EE] text-[#EE4D2D] border border-[#FCD8CF] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EE4D2D]"></span>
          🛒 Shopee
        </span>
      );
    }
    if (p === 'lazada') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-md bg-[#EEF2FF] text-[#0F146D] border border-[#CAD5FF] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0F146D]"></span>
          🛍️ Lazada
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
        🌐 {platform || 'Official'}
      </span>
    );
  };

  // ── Action: Confirm Order Placement (Mode 1: บันทึกการสั่งซื้อ) ──
  const handleAcknowledgeAndOrder = async () => {
    // 1. Price & Quantity validation (Directive 2)
    for (let it of items) {
      const q = Number(it.purchaseQty ?? it.actualQty);
      if (it.purchaseQty === '' || isNaN(q) || q < 1 || !Number.isInteger(q)) {
        return modalService.warning(`กรุณาระบุจำนวนสั่งซื้อของ "${it.name}" ให้เป็นจำนวนเต็มบวก (อย่างน้อย 1)`);
      }
      const p = Number(it.unitPrice ?? it.actualPrice);
      if (it.unitPrice === '' || isNaN(p) || p < 0) {
        return modalService.warning(`กรุณาระบุราคาต่อหน่วยของ "${it.name}" ให้ถูกต้อง`);
      }
    }

    // 2. Strict Pre-Order Validation Guard for Store Name (Directive 2)
    for (let g of storesGroup) {
      const sName = (storeInfo[g.storeKey]?.storeName || '').trim();
      if (!sName || sName.includes('ระบุร้านภายหลัง')) {
        return modalService.warning(`กรุณาระบุชื่อร้านค้าจริงบนแพลตฟอร์ม ${g.platform} ให้ครบถ้วน`);
      }
    }

    // 3. Over-Budget Guard Dialog (Directive 2)
    if (priceDiff > 0) {
      const overBudgetConfirmed = await modalService.confirm({
        title: '⚠️ ยืนยันการสั่งซื้อเกินงบประมาณ (Over-Budget Confirmation)',
        message: `ยอดสั่งซื้อจริงรวม (฿${totalEstimatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) สูงกว่างบประเมิน PR เดิม (฿${originalTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})\n\nส่วนต่างที่เกินงบประมาณ: +฿${priceDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nระบบจะทำการหักงบประมาณคงเหลือของแผนก ${po.department || ''} เพิ่มเติมตามยอดจริง\n\nต้องการยืนยันสั่งซื้อด้วยยอดนี้ใช่หรือไม่?`,
        confirmText: 'ยืนยันสั่งซื้อเกินงบ',
        cancelText: 'กลับไปแก้ไข'
      });
      if (!overBudgetConfirmed) return;
    }

    // 4. Resolve final Vendor Name
    const uniquePlatforms = Array.from(new Set(storesGroup.map(g => g.platform).filter(Boolean)));
    const isMultiStoreOrPlatform = uniqueStores.length > 1 || uniquePlatforms.length > 1;
    const finalVendorName = (!isMultiStoreOrPlatform && uniqueStores.length === 1)
      ? uniqueStores[0]
      : (uniqueStores.length > 1 ? `สั่งซื้อออนไลน์ ${uniqueStores.length} ร้านค้า (${uniqueStores.join(', ')})` : 'ตลาดออนไลน์ Shopee / Lazada');

    let confirmMsg = `ยืนยันบันทึกว่าสั่งซื้อสินค้าเรียบร้อยแล้วสำหรับ PO ${po.poNo || po.id}`;
    if (!isMultiStoreOrPlatform && uniqueStores.length === 1) {
      confirmMsg += `\nร้านค้า: "${uniqueStores[0]}"`;
    } else if (uniqueStores.length > 1) {
      confirmMsg += `\nร้านค้า: สั่งซื้อจาก ${uniqueStores.length} ร้านค้า (${uniqueStores.join(', ')})`;
    }
    confirmMsg += `\nยอดสั่งซื้อรวม: ฿${totalEstimatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (hasModifications) {
      if (priceDiff < 0) {
        confirmMsg += `\n\n🎉 ประหยัดงบได้ ฿${Math.abs(priceDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (ระบบจะคืนเงินส่วนต่างเข้า Remaining Budget ของแผนก ${po.department || ''})`;
      } else if (priceDiff > 0) {
        confirmMsg += `\n\n⚠️ เกินงบ ฿${priceDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (ระบบจะหักงบประมาณคงเหลือของแผนก ${po.department || ''} เพิ่มเติม)`;
      }
    }
    confirmMsg += `\n\nต้องการบันทึกและส่งต่องานใช่หรือไม่?`;

    const confirmed = await modalService.confirm({
      title: 'ยืนยันการสั่งซื้อสินค้าออนไลน์',
      message: confirmMsg,
      confirmText: 'ยืนยันสั่งซื้อแล้ว',
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const finalItems = (po.items || []).map((originalItem, idx) => {
        const rowState = itemData[idx] || {};
        const finalQty = Number(rowState.actualQty ?? rowState.purchaseQty ?? originalItem.actualQty ?? originalItem.qty ?? 1);
        const finalPrice = Number(rowState.actualPrice ?? rowState.unitPrice ?? originalItem.actualPrice ?? originalItem.price ?? 0);
        const lineTotal = finalQty * finalPrice;
        
        const origPrice = Number(originalItem.originalEstimatedPrice ?? originalItem.estimatedPrice ?? originalItem.price ?? 0);
        const origQty = Number(originalItem.originalPurchaseQty ?? originalItem.qty ?? originalItem.purchaseQty ?? 1);
        const rate = Number(originalItem.conversionRate) > 0 ? Number(originalItem.conversionRate) : 1;
        const newStockQty = finalQty * rate;

        // Find which group this item belongs to
        const group = storesGroup.find(g => g.itemIndices && g.itemIndices.includes(idx));
        const sInfo = group ? storeInfo[group.storeKey] : null;

        const resolvedStoreName = (sInfo?.storeName || rowState.actualStoreName || originalItem.actualStoreName || '').trim();
        const resolvedOrderRef = (sInfo?.orderId || rowState.orderRefNo || originalItem.orderRefNo || '').trim();

        return {
          ...originalItem,
          originalEstimatedPrice: origPrice,
          originalPurchaseQty: origQty,
          actualQty: finalQty,
          purchaseQty: finalQty,
          orderedQty: finalQty,
          qty: finalQty,
          stockQty: newStockQty,
          actualPrice: finalPrice,
          unitPrice: finalPrice,
          price: finalPrice,
          estimatedPrice: finalPrice,
          actUnitPrice: finalPrice,
          actualStoreName: resolvedStoreName,
          storePlatform: group?.platform || rowState.storePlatform || originalItem.storePlatform || 'Shopee',
          orderRefNo: resolvedOrderRef,
          lineTotal: lineTotal,
          total: lineTotal,
          claimStatus: null,
          shortageQty: 0,
          damagedQty: 0
        };
      });

      const grandTotal = finalItems.reduce((sum, itm) => sum + (Number(itm.lineTotal) || 0), 0);

      const updatedPO = await apiService.acknowledgeOnlineTask(
        po.id, 
        finalVendorName, 
        currentRole, 
        finalItems, 
        varianceNote.trim()
      );

      // Reconcile department budget in real-time
      if (priceDiff < 0) {
        const doRollback = rollbackBudget || standaloneRollbackBudget;
        if (doRollback) {
          try {
            await doRollback(
              po.department,
              Math.abs(priceDiff),
              `คืนงบประมาณส่วนต่างจากการสั่งซื้อออนไลน์ได้ราคา/จำนวนถูกลง (PO: ${po.poNo || po.id})`,
              {
                refDocNo: po.poNo || po.id,
                actor: currentUser?.name || currentRole?.name || 'Online Purchaser'
              }
            );
          } catch (bErr) {
            console.warn('[OnlineOrderCard] Rollback budget warning:', bErr);
          }
        }
      } else if (priceDiff > 0) {
        const doDeduct = deductBudget || standaloneDeductBudget;
        if (doDeduct) {
          try {
            await doDeduct(
              po.department,
              priceDiff,
              `หักงบประมาณเพิ่มเติมเนื่องจากยอดสั่งซื้อจริงเกินงบ PR (PO: ${po.poNo || po.id})`,
              {
                refDocNo: po.poNo || po.id,
                actor: currentUser?.name || currentRole?.name || 'Online Purchaser'
              }
            );
          } catch (bErr) {
            console.warn('[OnlineOrderCard] Deduct budget warning:', bErr);
          }
        }
      }
      
      const payload = {
        ...(updatedPO || po),
        status: 'ORDERED_PENDING_DELIVERY',
        vendor: finalVendorName,
        vendorName: finalVendorName,
        shopName: finalVendorName,
        orderedAt: new Date().toISOString(),
        orderedBy: currentUser?.name || currentRole?.name || 'Online Purchaser',
        items: finalItems,
        totalAmount: grandTotal,
        grandTotal: grandTotal,
        subtotal: grandTotal
      };

      if (onUpdate) onUpdate(payload);
      await modalService.success(
        'บันทึกการสั่งซื้อเรียบร้อย', 
        `บันทึกการสั่งซื้อสำหรับ PO ${po.poNo || po.id} เรียบร้อยแล้ว! ระบบย้ายเอกสารไปที่แท็บ "สั่งซื้อแล้ว" และแจ้งเตือนฝ่ายตรวจรับสินค้า`
      );
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึก', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Action: Resolve Store Claim (Mode 2: จัดการเคลมเฉพาะร้านค้า) ──
  // ── Action: Resolve Store Claim (Mode 2: จัดการเคลมเฉพาะร้านค้า - Directive 4) ──
  const handleResolveStoreClaim = async (storeKey) => {
    const claimState = storeClaimStates[storeKey];
    if (!claimState) return;

    const { claimResolutionType, claimExpectedDate, claimNote, refundAmount, newTrackingNo } = claimState;

    if (!claimResolutionType) return;

    if (claimResolutionType === 'RESEND' || claimResolutionType === 'REPLACEMENT') {
      if (!newTrackingNo?.trim()) {
        return modalService.warning('กรุณาระบุเลขพัสดุจัดส่งรอบใหม่ (New Tracking No.)');
      }
    } else if (claimResolutionType === 'REFUND' || claimResolutionType === 'CANCEL') {
      if (refundAmount === '' || isNaN(Number(refundAmount)) || Number(refundAmount) < 0) {
        return modalService.warning('กรุณาระบุยอดเงินที่ได้รับคืนจริงให้ถูกต้อง');
      }
    }

    if (!claimNote?.trim()) {
      return modalService.warning('กรุณาระบุหมายเหตุ/ความคืบหน้าการติดต่อร้านค้า');
    }

    const resolvedRefundNum = (claimResolutionType === 'REFUND' || claimResolutionType === 'CANCEL') ? Number(refundAmount) : 0;
    const storeObj = storesGroup.find(g => g.storeKey === storeKey);
    const storeName = storeObj ? storeObj.storeName : '';
    
    const confirmMsg = (claimResolutionType === 'REFUND' || claimResolutionType === 'CANCEL')
      ? `ยืนยันบันทึกผลการเคลมเป็นคืนเงิน ฿${resolvedRefundNum.toLocaleString()} จากร้าน "${storeName}" คืนงบประมาณให้ฝ่าย ${po?.department || ''} และปิดงานของร้านนี้ ใช่หรือไม่?`
      : `ยืนยันบันทึกผลการเคลมเป็นส่งของใหม่จากร้าน "${storeName}" (เลขพัสดุ: ${newTrackingNo.trim()}) ใช่หรือไม่?`;

    const confirmed = await modalService.confirm({
      title: 'ยืนยันผลการดำเนินการเคลม',
      message: confirmMsg,
      confirmText: 'ยืนยันบันทึก',
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const claimUpdateData = {
        status: 'RESOLVED',
        type: claimResolutionType,
        refundAmount: resolvedRefundNum,
        replacementTrackingNo: (newTrackingNo || '').trim(),
        note: (claimNote || '').trim(),
        expectedDate: claimExpectedDate || '',
        resolvedAt: new Date().toISOString(),
        resolvedBy: currentUser?.name || currentRole?.name || 'Online Purchaser'
      };

      const currentStoreClaims = po.storeClaims || {};
      const nextStoreClaims = {
        ...currentStoreClaims,
        [storeKey]: claimUpdateData
      };

      const allOtherDisputesResolved = storesGroup.every(g => 
        !g.hasDispute || g.storeKey === storeKey || g.status === 'RESOLVED' || currentStoreClaims[g.storeKey]?.status === 'RESOLVED'
      );
      
      // Directive 4: เมื่อผู้ใช้กดยืนยันบันทึกผลเจรจาครบทุกร้านใน PO: ปรับสถานะ PO ให้เป็น RESOLVED ➔ COMPLETED
      let nextOrderStatus = po.status;
      if (allOtherDisputesResolved) {
        nextOrderStatus = 'COMPLETED';
      }

      // Automated Budget Rollback (Directive 4)
      if ((claimResolutionType === 'REFUND' || claimResolutionType === 'CANCEL') && resolvedRefundNum > 0) {
        const rollbackReason = `จัดซื้อเจรจาเคลมสำเร็จ ได้รับเงินคืน ฿${resolvedRefundNum.toLocaleString()} เข้าแผนก (ร้าน: ${storeName}, PO: ${po?.poNo || po?.id})`;
        const doRollback = rollbackBudget || standaloneRollbackBudget;
        if (typeof doRollback === 'function') {
          await doRollback(
            po.department, 
            resolvedRefundNum, 
            rollbackReason, 
            { docNo: po?.poNo || po?.id, refDocNo: po?.poNo || po?.id, user: currentUser, actor: currentUser?.name || 'Online Purchaser' }
          );
        } else if (typeof refundBudget === 'function') {
          await refundBudget(po.department, resolvedRefundNum);
        }
      }

      const res = await apiService.resolveOnlineClaim(po?.id, {
        type: claimResolutionType || 'REFUND',
        refundAmount: resolvedRefundNum,
        note: `[ร้าน ${storeName}]: ${(claimNote || '').trim()}`,
        expectedDate: claimExpectedDate || '',
        newTrackingNo: (newTrackingNo || '').trim(),
        storeKey: storeKey,
        allStoresResolved: allOtherDisputesResolved
      }, currentRole || currentUser);

      // Directive 4: บันทึก Activity Timeline: "จัดซื้อเจรจาเคลมสำเร็จ ได้รับเงินคืน ฿{amount} เข้าแผนก"
      const timelineTitle = (claimResolutionType === 'REFUND' || claimResolutionType === 'CANCEL')
        ? `จัดซื้อเจรจาเคลมสำเร็จ ได้รับเงินคืน ฿${resolvedRefundNum.toLocaleString()} เข้าแผนก`
        : `จัดซื้อเจรจาเคลมสำเร็จ ร้าน "${storeName}" ส่งสินค้าใหม่ทดแทน (เลขพัสดุ: ${(newTrackingNo || '').trim() || '-'})`;

      const updatedOrder = {
        ...(res || po),
        status: nextOrderStatus,
        claimStatus: allOtherDisputesResolved ? 'RESOLVED' : (po.claimStatus || 'IN_CLAIM'),
        storeClaims: nextStoreClaims,
        timeline: [
          ...(po.timeline || po.activityLog || []),
          {
            action: 'CLAIM_SETTLED',
            title: timelineTitle,
            actor: currentUser?.name || currentRole?.name || 'Online Purchaser',
            timestamp: new Date().toISOString(),
            note: (claimNote || '').trim()
          }
        ],
        activityLog: [
          ...(po.activityLog || []),
          {
            action: 'CLAIM_SETTLED',
            title: timelineTitle,
            user: currentUser?.name || currentRole?.name || 'Online Purchaser',
            timestamp: new Date().toLocaleString('th-TH'),
            note: `${timelineTitle} | ${(claimNote || '').trim()}`
          }
        ]
      };

      if (onUpdate) await onUpdate(updatedOrder);

      setStoreClaimStates(prev => ({
        ...prev,
        [storeKey]: { ...prev[storeKey], showResolutionForm: false }
      }));

      await modalService.success(
        'บันทึกผลเจรจาสำเร็จ',
        allOtherDisputesResolved
          ? `เจรจาเคลมครบทุกร้านแล้ว! PO ${po.poNo || po.id} ปิดงานสำเร็จและย้ายไปแท็บ "ปิดงานสำเร็จ"`
          : `บันทึกผลการเจรจาสำหรับร้าน "${storeName}" เรียบร้อยแล้ว`
      );
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึก', err?.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasOnlineUrl = po.onlineUrl && po.onlineUrl.trim().length > 0;

  // ── Render Status Badge (Directive 1: Strict Separation & Directive 4: Clock Icon) ──
  const renderStatusBadge = (status = po?.status) => {
    // Mode 1: Pending Order (รอดำเนินการสั่งซื้อ)
    if (isPending) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          <span>รอดำเนินการสั่งซื้อ</span>
        </span>
      );
    }

    // Mode 2: Claim Mode (รอเคลมสินค้า) - Directive 1: Strict Red Badge in Claim Tab
    if (activeTab === 'CLAIM' || (isClaimOrder && disputedStoresCount > 0)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          <span>🔴 รอเคลม ({disputedStoresCount || 1} ร้านค้า)</span>
        </span>
      );
    }

    if (isPartialReceived) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          รับของแล้วบางส่วน
        </span>
      );
    }

    if (isClosed) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          ปิดงานสำเร็จ
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
        สั่งซื้อแล้ว (ระหว่างส่ง)
      </span>
    );
  };

  // Latest Activity summary for Micro-footer
  const latestActivityText = useMemo(() => {
    if (Array.isArray(po.activityLog) && po.activityLog.length > 0) {
      const last = po.activityLog[po.activityLog.length - 1];
      const timeStr = formatDateTime(last.timestamp || last.time);
      return `${last.action || last.title || 'อัปเดตสถานะ'} โดย ${last.user || last.actor || 'เจ้าหน้าที่'} ${timeStr ? `(${timeStr})` : ''}`;
    }
    if (po.orderedAt) {
      const timeStr = formatDateTime(po.orderedAt);
      return `รับทราบและสั่งซื้อแล้ว โดย ${po.orderedBy || 'ผู้จัดซื้อ'} (${timeStr})`;
    }
    return `ส่งมาจาก ${po.department || 'แผนก'} รอจัดซื้อออนไลน์`;
  }, [po.activityLog, po.orderedAt, po.orderedBy, po.department]);

  const vendorDisplay = useMemo(() => {
    if (uniqueStores.length === 1) return uniqueStores[0];
    if (uniqueStores.length > 1) return `${uniqueStores.length} ร้านค้า (Marketplace)`;
    return getVendorStr(po);
  }, [uniqueStores, po]);

  return (
    <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all mb-4 font-sans">
      {/* ── 1. Order Header Bar ── */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 flex-wrap sm:flex-nowrap">
        {/* Left: Meta Info */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="font-mono font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <span>{po.poNo || po.id}</span>
            <button
              type="button"
              onClick={() => handleCopyText(po.poNo || po.id, 'po')}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="คัดลอกรหัส PO"
            >
              {copiedPO ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <span className="text-slate-200 select-none">•</span>

          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
            {po.department}
          </span>

          {po.prNo && (
            <>
              <span className="text-slate-200 select-none">•</span>
              <span 
                onClick={() => onShowDetails && onShowDetails(po)}
                className="text-xs font-mono text-slate-500 hover:text-indigo-600 cursor-pointer transition-colors"
                title="คลิกเพื่อดูรายละเอียด PR"
              >
                PR: {po.prNo}
              </span>
              {prDocs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPrDocsModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer shadow-2xs shrink-0"
                  title="ดูเอกสารแนบทั้งหมดของ PR นี้"
                >
                  <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>เอกสาร PR ({prDocs.length})</span>
                </button>
              )}
            </>
          )}

          {Boolean(vendorDisplay) && (
            <>
              <span className="text-slate-200 select-none">•</span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 truncate max-w-[220px]">
                <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{vendorDisplay}</span>
              </span>
            </>
          )}

          {hasModifications && isPending && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md ml-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>ปรับยอด {priceDiff >= 0 ? '+' : ''}฿{priceDiff.toLocaleString()}</span>
            </span>
          )}
        </div>

        {/* Right: Status & Amount */}
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          {renderStatusBadge(po.status)}
          <span className="text-base font-mono font-black text-slate-900 ml-2 min-w-[70px] text-right">
            ฿{totalEstimatedAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── 2. Item Rows & Marketplace Tags Grouped by Store (Directive 1, 3 & 4) ── */}
      <div className="space-y-4 my-3">
        {storesGroup.map((group) => {
          const storeClaimState = storeClaimStates[group.storeKey] || {};
          const isStoreClaimActive = isClaimOrder && group.hasDispute && (storeClaimState.showResolutionForm ?? true) && group.status !== 'RESOLVED' && !isClosed;
          
          return (
            <div key={group.storeKey} className="bg-slate-50/50 rounded-2xl border border-slate-200/60 overflow-hidden shadow-2xs">
              {/* Store Header Bar (Inline High-Density Compact Header) */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200/80 rounded-t-xl gap-2">
                {/* ฝั่งซ้าย: Badge แพลตฟอร์ม + ช่องพิมพ์ชื่อร้านค้าแบบ Inline หรือ Read-only Status */}
                <div className="flex items-center gap-2 flex-1 max-w-md min-w-0">
                  {getPlatformBadge(group.platform)}

                  {isPending ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">ร้าน:</span>
                      <input
                        type="text"
                        placeholder="ระบุชื่อร้านค้าจริง..."
                        value={storeInfo[group.storeKey]?.storeName || ''}
                        onChange={(e) => handleUpdateStoreHeader(group.storeKey, 'storeName', e.target.value)}
                        className="h-7 px-2 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-full placeholder:text-slate-400"
                      />
                    </div>
                  ) : group.hasRealStore ? (
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5 truncate">
                      <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {group.storeName}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      [ระบุร้านค้าตอนกดสั่งซื้อ]
                    </span>
                  )}

                  {/* Claim Status Pill - STRICTLY ONLY IN CLAIM MODE */}
                  {isClaimOrder && group.status === 'RESOLVED' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> เคลมเสร็จสิ้น
                    </span>
                  )}
                  {isClaimOrder && group.hasDispute && group.status !== 'RESOLVED' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 shrink-0 animate-pulse">
                      มีปัญหารอเคลม
                    </span>
                  )}
                </div>

                {/* ฝั่งขวา: ยอดรวมร้านค้า */}
                <div className="text-xs font-semibold text-slate-600 font-mono shrink-0">
                  ยอดร้านนี้: <span className="font-bold text-slate-900">฿{group.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* ── Store Items List: High-Density Compact Data Rows (Mode 1) or Read-Only Rows (Mode 2/3) ── */}
              {isPending ? (
                <div className="divide-y divide-slate-100">
                  {group.items.map((item, localIdx) => {
                    const actualIdx = isPending ? group.itemIndices[localIdx] : items.findIndex(it => it.id === item.id);
                    const resolvedIdx = actualIdx >= 0 ? actualIdx : localIdx;
                    const currentItem = isPending ? (itemData[resolvedIdx] || item) : item;
                    const currentItemWithMedia = {
                      ...item,
                      ...currentItem,
                      attachments: (Array.isArray(currentItem?.attachments) && currentItem.attachments.length > 0)
                        ? currentItem.attachments
                        : (Array.isArray(item?.attachments) && item.attachments.length > 0 ? item.attachments : (currentItem?.images || item?.images || [])),
                      images: (Array.isArray(currentItem?.images) && currentItem.images.length > 0)
                        ? currentItem.images
                        : (Array.isArray(item?.images) && item.images.length > 0 ? item.images : (currentItem?.attachments || item?.attachments || []))
                    };
                    const itemImages = getItemAttachments(currentItemWithMedia);

                    const pQty = currentItem.purchaseQty !== '' ? Number(currentItem.purchaseQty ?? currentItem.actualQty ?? currentItem.qty) : '';
                    const price = currentItem.unitPrice !== '' ? Number(currentItem.unitPrice ?? currentItem.actualPrice ?? currentItem.price) : '';
                    const lineTotal = (Number(pQty) || 0) * (Number(price) || 0);
                    const pUnit = currentItem.purchaseUnit || currentItem.unit || 'ชิ้น';
                    const rawUrl = getProductUrl(currentItem);
                    const origPrice = Number(currentItem.originalEstimatedPrice ?? currentItem.estimatedPrice ?? currentItem.price ?? 0);
                    const origQty = Number(currentItem.originalPurchaseQty ?? currentItem.qty ?? currentItem.purchaseQty ?? 1);

                    return (
                      <div
                        key={currentItem.id || resolvedIdx}
                        className="flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 gap-2 sm:gap-3 flex-wrap sm:flex-nowrap"
                      >
                        {/* 1. ข้อมูลสินค้า [ รูปตัวอย่างย่อ + รหัส SKU + ชื่อสินค้า ] */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {/* Item Thumbnail Stack (Phase 3 Directive 1: w-7 h-7, stacked -space-x-1, max 2 + badge, hover scale) */}
                          {itemImages.length > 0 && (
                            <div 
                              className="flex items-center -space-x-1 shrink-0 group/stack"
                              title={`คลิกเพื่อดูรูปภาพขยาย (${itemImages.length} รูป)`}
                            >
                              {itemImages.slice(0, 2).map((img, imgIdx) => (
                                <button
                                  key={imgIdx}
                                  type="button"
                                  onClick={() => openLightbox(itemImages, imgIdx, currentItem.name)}
                                  className="relative w-7 h-7 rounded-md border border-white shadow-2xs overflow-hidden bg-slate-100 transition-transform duration-150 hover:scale-110 hover:z-10 cursor-pointer shrink-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  <img
                                    src={img.url}
                                    alt={img.name || `thumb-${imgIdx}`}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              ))}
                              {itemImages.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => openLightbox(itemImages, 2, currentItem.name)}
                                  className="w-7 h-7 rounded-md bg-slate-800/90 hover:bg-indigo-600 text-white text-[10px] font-mono font-bold flex items-center justify-center border border-white shadow-2xs shrink-0 cursor-pointer transition-transform duration-150 hover:scale-110 hover:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  +{itemImages.length - 2}
                                </button>
                              )}
                            </div>
                          )}

                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold shrink-0">
                            {currentItem.code || currentItem.sku || 'ITEM'}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate" title={currentItem.name}>
                            {currentItem.name}
                          </span>
                          {rawUrl && (
                            <a
                              href={sanitizeExternalUrl(rawUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:text-indigo-700 text-xs shrink-0 inline-flex items-center"
                              title="เปิดลิงก์สินค้าจริง"
                            >
                              ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyText(currentItem.name, 'item')}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer shrink-0"
                            title="คัดลอกชื่อสินค้า"
                          >
                            {copiedCode === currentItem.name ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          {(currentItem.specDetails || currentItem.note) && (
                            <span className="text-[11px] text-slate-400 italic truncate hidden 2xl:inline max-w-xs">
                              • {currentItem.specDetails || currentItem.note}
                            </span>
                          )}
                        </div>

                        {/* 2. Natural Math Flow: [ เดิม: X ➔ ช่องกรอก Qty ] × [ เดิม: ฿Y ➔ ช่องกรอก Price ] = [ ยอดรวมสุทธิ ] */}
                        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                          {/* Qty Zone: [ เดิม: X ➔ ช่องกรอก Qty ] */}
                          <div className="flex items-center gap-1">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block leading-tight">PR เดิม</span>
                              <span className="text-xs font-mono text-slate-400 line-through">
                                {origQty}
                              </span>
                            </div>

                            <span className="text-slate-300 select-none text-xs">➔</span>

                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={currentItem.purchaseQty === '' ? '' : currentItem.purchaseQty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    handleItemChange(resolvedIdx, 'actualQty', '');
                                  } else {
                                    const n = parseInt(val, 10);
                                    handleItemChange(resolvedIdx, 'actualQty', isNaN(n) ? '' : n);
                                  }
                                }}
                                placeholder="1"
                                className="w-14 h-7 px-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-800 text-center focus:bg-white focus:border-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title={`จำนวนสั่งซื้อจริง (${pUnit})`}
                              />
                              <span className="text-[11px] text-slate-500 font-medium shrink-0">{pUnit}</span>
                            </div>
                          </div>

                          {/* Math operator: × */}
                          <span className="text-slate-400 font-bold text-xs select-none">×</span>

                          {/* Price Zone: [ เดิม: ฿Y ➔ ช่องกรอก Price ] */}
                          <div className="flex items-center gap-1">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block leading-tight">ราคา PR</span>
                              <span className="text-xs font-mono text-slate-400 line-through">
                                ฿{origPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>

                            <span className="text-slate-300 select-none text-xs">➔</span>

                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-slate-500">฿</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={currentItem.unitPrice === '' ? '' : currentItem.unitPrice}
                                onChange={(e) => handlePriceChange(resolvedIdx, e.target.value)}
                                placeholder="0.00"
                                className="w-20 h-7 px-2 bg-slate-50 border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-800 text-right focus:bg-white focus:border-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="ราคาซื้อจริงต่อหน่วยจากหน้าเว็บ"
                              />
                            </div>
                          </div>

                          {/* Math operator: = */}
                          <span className="text-slate-400 font-bold text-xs select-none">=</span>

                          {/* 3. Line Total */}
                          <div className="w-20 sm:w-24 text-right">
                            <span className="text-[10px] text-slate-400 block leading-tight">รวมเงิน</span>
                            <span className="text-xs font-mono font-bold text-slate-900">
                              ฿{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 space-y-2.5">
                  {group.items.map((item, localIdx) => {
                    const actualIdx = isPending ? group.itemIndices[localIdx] : items.findIndex(it => it.id === item.id);
                    const resolvedIdx = actualIdx >= 0 ? actualIdx : localIdx;
                    const currentItem = isPending ? (itemData[resolvedIdx] || item) : item;
                    const currentItemWithMedia = {
                      ...item,
                      ...currentItem,
                      attachments: (Array.isArray(currentItem?.attachments) && currentItem.attachments.length > 0)
                        ? currentItem.attachments
                        : (Array.isArray(item?.attachments) && item.attachments.length > 0 ? item.attachments : (currentItem?.images || item?.images || [])),
                      images: (Array.isArray(currentItem?.images) && currentItem.images.length > 0)
                        ? currentItem.images
                        : (Array.isArray(item?.images) && item.images.length > 0 ? item.images : (currentItem?.attachments || item?.attachments || []))
                    };
                    const itemImages = getItemAttachments(currentItemWithMedia);

                    const pQty = Number(currentItem.purchaseQty ?? currentItem.actualQty ?? currentItem.qty) || 1;
                    const price = Number(currentItem.unitPrice ?? currentItem.actualPrice ?? currentItem.price) || 0;
                    const lineTotal = price * pQty;
                    const pUnit = currentItem.purchaseUnit || currentItem.unit || 'ชิ้น';
                    const rawUrl = getProductUrl(currentItem);
                    
                    return (
                      <div key={currentItem.id || resolvedIdx} className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4 border border-slate-100 shadow-xs">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Item Thumbnail Stack (Phase 3 Directive 1: w-7 h-7, stacked -space-x-1, max 2 + badge, hover scale) */}
                            {itemImages.length > 0 && (
                              <div 
                                className="flex items-center -space-x-1 shrink-0 group/stack"
                                title={`คลิกเพื่อดูรูปภาพขยาย (${itemImages.length} รูป)`}
                              >
                                {itemImages.slice(0, 2).map((img, imgIdx) => (
                                  <button
                                    key={imgIdx}
                                    type="button"
                                    onClick={() => openLightbox(itemImages, imgIdx, currentItem.name)}
                                    className="relative w-7 h-7 rounded-md border border-white shadow-2xs overflow-hidden bg-slate-100 transition-transform duration-150 hover:scale-110 hover:z-10 cursor-pointer shrink-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.name || `thumb-${imgIdx}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                                {itemImages.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => openLightbox(itemImages, 2, currentItem.name)}
                                    className="w-7 h-7 rounded-md bg-slate-800/90 hover:bg-indigo-600 text-white text-[10px] font-mono font-bold flex items-center justify-center border border-white shadow-2xs shrink-0 cursor-pointer transition-transform duration-150 hover:scale-110 hover:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    +{itemImages.length - 2}
                                  </button>
                                )}
                              </div>
                            )}
                            <span className="font-semibold text-slate-800 text-sm truncate" title={currentItem.name}>{currentItem.name}</span>
                            {rawUrl && (
                              <a href={sanitizeExternalUrl(rawUrl)} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-0.5 shrink-0">
                                <ExternalLink className="w-3 h-3" /> ลิงก์สินค้า
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono flex-wrap">
                            <span className="font-bold text-slate-600">{currentItem.sku || currentItem.code || 'ITEM'}</span>
                            {(currentItem.specDetails || currentItem.note) && <span className="italic font-sans text-slate-500">• {currentItem.specDetails || currentItem.note}</span>}
                            {currentItem.actualStoreName && <span className="text-slate-600 font-sans">• ร้าน: {currentItem.actualStoreName}</span>}
                            {currentItem.orderRefNo && <span className="text-[11px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">(Ref: {currentItem.orderRefNo})</span>}
                            {/* If in claim mode, show dispute quantities */}
                            {isClaimOrder && (Number(currentItem.shortageQty) > 0 || Number(currentItem.damagedQty) > 0) && (
                              <div className="flex items-center gap-1 shrink-0 font-sans">
                                {Number(currentItem.shortageQty) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">ขาด: {currentItem.shortageQty}</span>}
                                {Number(currentItem.damagedQty) > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">ชำรุด: {currentItem.damagedQty}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="text-xs text-slate-500 font-mono">{pQty.toLocaleString()} {pUnit} × ฿{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="text-sm font-bold font-mono text-slate-900">฿{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          <button onClick={() => handleCopyText(currentItem.name, 'item')} className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-lg cursor-pointer" title="คัดลอกชื่อสินค้า">
                            {copiedCode === currentItem.name ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5"/>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isClaimOrder && group.hasDispute && !isStoreClaimActive && group.status !== 'RESOLVED' && !isClosed && (
                <div className="p-3 bg-white border-t border-slate-100 flex justify-end">
                  <button 
                    type="button"
                    onClick={() => setStoreClaimStates(prev => ({ ...prev, [group.storeKey]: { ...prev[group.storeKey], showResolutionForm: true } }))} 
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 cursor-pointer transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> จัดการผลการเคลมเฉพาะร้านค้านี้
                  </button>
                </div>
              )}
              
              {isStoreClaimActive && (() => {
                const currentResolutionType = storeClaimState.claimResolutionType || group.claimData?.type || 'REFUND';
                const currentRefundAmount = storeClaimState.refundAmount !== undefined 
                  ? storeClaimState.refundAmount 
                  : (group.claimData?.refundAmount !== undefined ? group.claimData.refundAmount : (Math.round(group.defaultRefund * 100) / 100));
                const currentTrackingNo = storeClaimState.newTrackingNo !== undefined 
                  ? storeClaimState.newTrackingNo 
                  : (group.claimData?.replacementTrackingNo || group.claimData?.newTrackingNo || '');
                const currentClaimNote = storeClaimState.claimNote !== undefined 
                  ? storeClaimState.claimNote 
                  : (group.claimData?.note || '');

                return (
                  <div className="p-3 sm:p-4 bg-white border-t border-slate-200/90 space-y-2.5">
                    {/* Clean Bordered Settlement Card: Compact Issue Alert Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs shadow-2xs">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-bold text-amber-900 flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>⚠️ คลังแจ้งปัญหา:</span>
                        </span>
                        {group.issueItems.map((item, idx) => {
                          const short = Number(item.shortageQty || 0);
                          const dmg = Number(item.damagedQty || 0);
                          const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                          const price = Number(item.unitPrice ?? item.actualPrice ?? item.price ?? 0);
                          const itemLossAmount = (short + dmg) * price;
                          return (
                            <span key={idx} className="inline-flex items-center gap-1 font-medium">
                              <span className="font-bold text-slate-800">{item.name}</span>
                              {short > 0 && <span className="text-rose-700 font-semibold">ขาด {short} {pUnit}</span>}
                              {dmg > 0 && <span className="text-amber-800 font-semibold">{short > 0 ? ',' : ''} ชำรุด {dmg} {pUnit}</span>}
                              <span className="text-slate-500 font-mono">(มูลค่า ฿{itemLossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                              {idx < group.issueItems.length - 1 && <span className="text-amber-400 font-bold">•</span>}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-bold text-amber-950 bg-amber-200/60 px-2 py-0.5 rounded-md">
                          มูลค่าเคลม: ฿{group.defaultRefund.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStoreClaimStates(prev => ({
                            ...prev,
                            [group.storeKey]: { ...prev[group.storeKey], showResolutionForm: false }
                          }))}
                          className="text-xs text-slate-400 hover:text-slate-700 px-1 py-0.5 cursor-pointer"
                          title="ย่อฟอร์ม"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Eye-Level Single Row / Grid Settlement Bar */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 bg-slate-50/90 p-2 sm:p-2.5 rounded-xl border border-slate-200">
                      {/* Column 1: Dropdown แนวทางแก้ไข */}
                      <div className="w-full lg:w-56 shrink-0">
                        <select
                          value={currentResolutionType}
                          onChange={e => {
                            const val = e.target.value;
                            setStoreClaimStates(prev => ({
                              ...prev,
                              [group.storeKey]: {
                                ...prev[group.storeKey],
                                claimResolutionType: val,
                                refundAmount: val === 'REFUND'
                                  ? (prev[group.storeKey]?.refundAmount !== undefined ? prev[group.storeKey]?.refundAmount : group.defaultRefund)
                                  : (val === 'CANCEL' ? group.totalAmount : 0)
                              }
                            }));
                          }}
                          className="w-full h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:border-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer text-slate-800 shadow-2xs"
                        >
                          <option value="REFUND">💰 คืนเงิน (Refund)</option>
                          <option value="REPLACEMENT">📦 ร้านส่งของใหม่มาเปลี่ยน (Replacement)</option>
                          <option value="CANCEL">❌ ยกเลิกรายการ</option>
                        </select>
                      </div>

                      {/* Column 2: ช่องกรอกยอดเงินคืนจริง (w-32) พร้อมปุ่มเล็ก คืนเต็มจำนวน */}
                      {currentResolutionType === 'REPLACEMENT' ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="text"
                            value={currentTrackingNo}
                            onChange={e => setStoreClaimStates(prev => ({
                              ...prev,
                              [group.storeKey]: { ...prev[group.storeKey], newTrackingNo: e.target.value }
                            }))}
                            placeholder="เลขพัสดุใหม่ (Tracking No.)"
                            className="w-full sm:w-44 h-9 px-2.5 text-xs font-mono font-bold rounded-lg border border-sky-300 bg-white text-slate-900 focus:border-sky-500 uppercase shadow-2xs"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">฿</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentRefundAmount ?? ''}
                              onChange={e => setStoreClaimStates(prev => ({
                                ...prev,
                                [group.storeKey]: { ...prev[group.storeKey], refundAmount: e.target.value }
                              }))}
                              placeholder="0.00"
                              className="w-28 sm:w-32 h-9 pl-6 pr-2 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-right shadow-2xs"
                              title="ยอดเงินคืนจริง"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setStoreClaimStates(prev => ({
                              ...prev,
                              [group.storeKey]: {
                                ...prev[group.storeKey],
                                refundAmount: currentResolutionType === 'CANCEL' ? group.totalAmount : group.defaultRefund
                              }
                            }))}
                            className="h-9 px-2 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                            title="คลิกเพื่อกรอกยอดคืนเต็มจำนวน"
                          >
                            คืนเต็มจำนวน
                          </button>
                        </div>
                      )}

                      {/* Column 3: ช่องข้อความบันทึกความคืบหน้าสั้น ๆ */}
                      <div className="flex-1 min-w-[140px]">
                        <input
                          type="text"
                          value={currentClaimNote}
                          onChange={e => setStoreClaimStates(prev => ({
                            ...prev,
                            [group.storeKey]: { ...prev[group.storeKey], claimNote: e.target.value }
                          }))}
                          placeholder="บันทึกความคืบหน้าสั้น ๆ เช่น แชทร้านค้าโอนเงินคืนแล้ว..."
                          className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 shadow-2xs"
                        />
                      </div>

                      {/* Column 4: ปุ่มบันทึก [ ✓ บันทึกผลเจรจา ] สไตล์ Indigo/Emerald (เลิกใช้ปุ่มสีแดง) */}
                      <div className="flex items-center gap-1.5 shrink-0 justify-end">
                        <button
                          type="button"
                          onClick={() => setStoreClaimStates(prev => ({
                            ...prev,
                            [group.storeKey]: { ...prev[group.storeKey], showResolutionForm: false }
                          }))}
                          className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveStoreClaim(group.storeKey)}
                          disabled={isSubmitting}
                          className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>✓ บันทึกผลเจรจา</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* ── 3. Smart Financial Summary Footer for Pending Orders (Mode 1: Directive 3) ── */}
      {isPending && (
        <div className="mt-3 border-t border-slate-200/80 bg-slate-50/80 -mx-5 -mb-5 px-4 py-2.5 rounded-b-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left: 3 Financial Metrics */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="text-slate-500">งบประเมิน PR:</span>
              <span className="font-mono font-bold text-slate-700">
                ฿{originalTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <span className="text-slate-300 select-none hidden sm:inline">•</span>

            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <span className="text-slate-600">ยอดสั่งซื้อจริง:</span>
              <span className="font-mono font-bold text-slate-950 text-xs sm:text-sm">
                ฿{totalEstimatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <span className="text-slate-300 select-none hidden sm:inline">•</span>

            {/* ส่วนต่างงบประมาณ Badge */}
            <div>
              {priceDiff < 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
                  🎉 ประหยัดงบได้ ฿{Math.abs(priceDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              ) : priceDiff > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold shadow-2xs">
                  ⚠️ เกินงบ ฿{priceDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium">
                  ✓ ตรงตามงบประเมิน
                </span>
              )}
            </div>
          </div>

          {/* Right: Main Confirm Button (Unlocked when store name is filled for all stores) */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
            {!isAllStoresFilled && (
              <span className="text-[11px] text-amber-600 font-medium text-right">
                * ระบุชื่อร้านค้าจริงให้ครบ
              </span>
            )}
            {hasInvalidQty && (
              <span className="text-[11px] text-rose-600 font-medium text-right">
                * ระบุจำนวนให้เป็นจำนวนเต็มบวก
              </span>
            )}
            <button
              type="button"
              onClick={handleAcknowledgeAndOrder}
              disabled={!isConfirmReady}
              className={`h-8 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                !isConfirmReady
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/60 shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow active:scale-[0.98] cursor-pointer'
              }`}
              title={
                !isAllStoresFilled
                  ? 'กรุณาระบุชื่อร้านค้าจริงให้ครบทุกร้านก่อนยืนยัน'
                  : hasInvalidQty
                  ? 'กรุณาระบุจำนวนสินค้าให้เป็นจำนวนเต็มบวก (อย่างน้อย 1)'
                  : hasInvalidPrice
                  ? 'กรุณาระบุราคาซื้อจริงให้ถูกต้อง'
                  : 'ยืนยันบันทึกการสั่งซื้อสินค้าออนไลน์'
              }
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'กำลังบันทึก...'
                  : `✓ ยืนยันการสั่งซื้อแล้ว (${items.length} รายการ)`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Compact Micro-Footer ── */}
      <div className={`pt-2.5 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
        isPending ? '' : 'border-t border-slate-100'
      }`}>
        <div className="flex items-center gap-2 text-slate-400 min-w-0">
          <span className="truncate text-[11px]">
            🕒 ล่าสุด: {latestActivityText}
          </span>
          {Array.isArray(po.activityLog) && po.activityLog.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="text-indigo-600 hover:text-indigo-700 font-semibold text-[11px] inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
            >
              <span>{isHistoryExpanded ? 'ย่อประวัติ' : 'ดูประวัติ'}</span>
              {isHistoryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {hasOnlineUrl && (
            <a
              href={sanitizeExternalUrl(po.onlineUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 font-semibold text-xs inline-flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              <span>ลิงก์คำขอซื้อ</span>
            </a>
          )}

          {po.specUrl && onViewAttachment && (
            <button
              type="button"
              onClick={() => onViewAttachment({ name: 'เอกสาร/สเปกสินค้า', url: po.specUrl, type: 'link' })}
              className="text-slate-500 hover:text-slate-800 text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3 h-3" />
              <span>สเปก</span>
            </button>
          )}

          {onShowDetails && (
            <button
              type="button"
              onClick={() => onShowDetails(po)}
              className="text-slate-600 hover:text-indigo-600 font-semibold text-xs inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>เปิดดู PO ฉบับเต็ม</span>
              <span className="font-sans">↗</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Timeline (If toggled) */}
      {isHistoryExpanded && po.activityLog && po.activityLog.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <CollapsibleActivityTimeline
            events={po.activityLog}
            title="ประวัติการดำเนินงานคำสั่งซื้อ"
            defaultExpanded={true}
          />
        </div>
      )}

      {/* PR Attachments Modal (Phase 3 Directive 2) */}
      {prDocsModalOpen && (
        <div 
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setPrDocsModalOpen(false)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Paperclip className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    เอกสารแนบ PR: {po.prNo || po.prNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    มีเอกสารและไฟล์แนบทั้งหมด {prDocs.length} รายการ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrDocsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document list */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2.5 divide-y divide-slate-100">
              {prDocs.map((doc, dIdx) => {
                const isPdf = doc.type === 'application/pdf' || doc.category === 'QUOTATION' || String(doc.name || doc.url).toLowerCase().endsWith('.pdf');
                const isImage = !isPdf && (doc.type?.startsWith('image/') || doc.category === 'IMAGE' || doc.category === 'GENERAL' || String(doc.name || doc.url).match(/\.(jpeg|jpg|png|gif|webp|svg)($|\?)/i));
                
                return (
                  <div key={dIdx} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isPdf ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                      }`}>
                        {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={doc.name}>
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className={`px-1.5 py-0.2 rounded font-medium ${
                            doc.category === 'QUOTATION' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {doc.category === 'QUOTATION' ? 'ใบเสนอราคา' : 'เอกสารประกอบรวม'}
                          </span>
                          {doc.size ? <span>• {(doc.size / 1024).toFixed(1)} KB</span> : null}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (isImage) {
                            openLightbox([doc], 0, doc.name);
                          } else if (onViewAttachment) {
                            onViewAttachment(doc);
                          } else {
                            setViewingDoc(doc);
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>เปิดดู</span>
                      </button>

                      {doc.url && (
                        <a
                          href={doc.url}
                          download={doc.name || 'document'}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="ดาวน์โหลดไฟล์"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPrDocsModalOpen(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Doc in AttachmentViewerModal if non-image */}
      {viewingDoc && (
        <AttachmentViewerModal
          file={viewingDoc}
          url={viewingDoc.url}
          title={viewingDoc.name}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* Lightbox Modal (Phase 3 Directive 3) */}
      <ImageLightboxModal
        isOpen={lightboxState.isOpen}
        images={lightboxState.images}
        initialIndex={lightboxState.initialIndex}
        title={lightboxState.title}
        onClose={closeLightbox}
      />
    </div>
  );
}

// Named alias for flexible imports
export const OnlinePurchaseActionCard = OnlineOrderCard;
