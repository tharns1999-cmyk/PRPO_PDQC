import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, ExternalLink, AlertCircle, Copy, Check, RotateCcw, 
  Store, Sparkles, AlertTriangle, ArrowRight, FileText, CheckCircle2,
  Clock, ShieldAlert, ChevronDown, ChevronUp
} from 'lucide-react';
import { sanitizeExternalUrl, getProductUrl } from '../../utils/urlHelper';
import { apiService } from '../../services/apiService';
import { modalService } from '../../services/modalService';
import CollapsibleActivityTimeline from '../../components/common/CollapsibleActivityTimeline';

// Store Channel Preset Options
const STORE_CHANNELS = [
  { id: 'Shopee', label: 'Shopee', prefix: 'Shopee: ' },
  { id: 'Lazada', label: 'Lazada', prefix: 'Lazada: ' },
  { id: 'OfficialWebsite', label: 'เว็บไซต์ทางการ', prefix: 'เว็บไซต์ทางการ: ' },
  { id: 'ExternalShop', label: 'ร้านค้าภายนอก', prefix: 'ร้านค้าภายนอก: ' }
];

export default function OnlineOrderCard({ 
  po, 
  currentRole, 
  onUpdate, 
  onViewAttachment, 
  onShowDetails 
}) {
  const getVendorStr = (p) => {
    if (!p) return '';
    if (typeof p.vendor === 'object' && p.vendor) return p.vendor.name || p.vendor.companyName || '';
    if (typeof p.vendor === 'string' && p.vendor) return p.vendor;
    if (p.shopName) return p.shopName;
    if (p.vendorName && !p.vendorName.includes('ระบุร้านภายหลัง')) return p.vendorName;
    return '';
  };

  // Helper for backward compatibility & item-level store pre-fill (Directive 1)
  const getFallbackStoreName = (item, p) => {
    if (item?.actualStoreName && !item.actualStoreName.includes('ระบุร้านภายหลัง')) {
      return item.actualStoreName;
    }
    if (item?.storeName && !item.storeName.includes('ระบุร้านภายหลัง')) {
      return item.storeName;
    }
    const poStore = p?.storeName || p?.shopName || p?.vendorName || (typeof p?.vendor === 'string' ? p?.vendor : p?.vendor?.name) || '';
    if (poStore && !poStore.includes('ระบุร้านภายหลัง') && poStore !== 'Shopee / Lazada (ระบุร้านภายหลัง)') {
      return poStore;
    }
    return '';
  };

  const getFallbackPlatform = (item, p) => {
    if (item?.storePlatform) return item.storePlatform;
    if (item?.platform) return item.platform;
    const url = getProductUrl(item) || p?.onlineUrl || '';
    const lower = (url || '').toLowerCase();
    if (lower.includes('lazada')) return 'Lazada';
    if (lower.includes('official')) return 'Official';
    return 'Shopee';
  };

  const initialVendor = getVendorStr(po);
  const [vendorName, setVendorName] = useState(initialVendor);
  const [varianceNote, setVarianceNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [copiedPO, setCopiedPO] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [invalidStoreIndices, setInvalidStoreIndices] = useState(new Set());

  // Editable item state for actual price, actual quantity, and item-level store (Directive 1)
  const [items, setItems] = useState(() => 
    (po.items || []).map((item, idx) => {
      const pQty = item.actualQty ?? item.purchaseQty ?? item.qty ?? 1;
      const uPrice = item.actualPrice ?? item.unitPrice ?? item.estimatedPrice ?? item.price ?? 0;
      const origPrice = item.originalEstimatedPrice ?? item.estimatedPrice ?? uPrice;
      const origQty = item.originalPurchaseQty ?? item.qty ?? pQty;
      return {
        ...item,
        _idx: idx,
        originalEstimatedPrice: origPrice,
        originalPurchaseQty: origQty,
        unitPrice: uPrice,
        purchaseQty: pQty,
        actualStoreName: item.actualStoreName !== undefined ? item.actualStoreName : getFallbackStoreName(item, po),
        storePlatform: item.storePlatform || getFallbackPlatform(item, po),
        orderRefNo: item.orderRefNo || ''
      };
    })
  );

  // Sync state if po.items changes
  useEffect(() => {
    setItems((po.items || []).map((item, idx) => {
      const pQty = item.actualQty ?? item.purchaseQty ?? item.qty ?? 1;
      const uPrice = item.actualPrice ?? item.unitPrice ?? item.estimatedPrice ?? item.price ?? 0;
      const origPrice = item.originalEstimatedPrice ?? item.estimatedPrice ?? uPrice;
      const origQty = item.originalPurchaseQty ?? item.qty ?? pQty;
      return {
        ...item,
        _idx: idx,
        originalEstimatedPrice: origPrice,
        originalPurchaseQty: origQty,
        unitPrice: uPrice,
        purchaseQty: pQty,
        actualStoreName: item.actualStoreName !== undefined ? item.actualStoreName : getFallbackStoreName(item, po),
        storePlatform: item.storePlatform || getFallbackPlatform(item, po),
        orderRefNo: item.orderRefNo || ''
      };
    }));
  }, [po.items, po.vendorName, po.shopName]);

  const handlePriceChange = (index, val) => {
    const num = parseFloat(val);
    setItems(prev => prev.map((it, idx) => idx === index ? { ...it, unitPrice: isNaN(num) || num < 0 ? '' : num } : it));
  };

  const handleQtyChange = (index, val) => {
    const num = parseFloat(val);
    setItems(prev => prev.map((it, idx) => idx === index ? { ...it, purchaseQty: isNaN(num) || num <= 0 ? '' : num } : it));
  };

  const handleItemStoreChange = (index, value) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      return { ...it, actualStoreName: value };
    }));
    if (invalidStoreIndices.has(index)) {
      const trimmed = (value || '').trim();
      if (trimmed && !trimmed.includes('ระบุร้านภายหลัง')) {
        const next = new Set(invalidStoreIndices);
        next.delete(index);
        setInvalidStoreIndices(next);
      }
    }
  };

  const handleItemPlatformChange = (index, platform) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      return { ...it, storePlatform: platform };
    }));
  };

  const handleItemOrderRefChange = (index, refNo) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      return { ...it, orderRefNo: refNo };
    }));
  };

  // Shortcut: Apply store name and platform of the first item to all items in the PO (Directive 1)
  const handleApplyStoreToAll = (sourceIndex = 0) => {
    const source = items[sourceIndex];
    if (!source) return;
    const store = (source.actualStoreName || '').trim();
    const plat = source.storePlatform || 'Shopee';
    if (!store || store.includes('ระบุร้านภายหลัง')) {
      return modalService.warning('กรุณาระบุชื่อร้านค้าจริงที่รายการแรกก่อนใช้งานปุ่มนี้');
    }
    setItems(prev => prev.map(it => ({
      ...it,
      actualStoreName: store,
      storePlatform: plat
    })));
    setInvalidStoreIndices(new Set());
    modalService.success('คัดลอกสำเร็จ', `นำชื่อร้าน "${store}" ไปใช้กับทุกรายการแล้ว`);
  };

  const handleResetItem = (index) => {
    setItems(prev => prev.map((it, idx) => idx === index ? { 
      ...it, 
      unitPrice: it.originalEstimatedPrice, 
      purchaseQty: it.originalPurchaseQty 
    } : it));
  };

  const handleResetAll = () => {
    setItems(prev => prev.map(it => ({ 
      ...it, 
      unitPrice: it.originalEstimatedPrice, 
      purchaseQty: it.originalPurchaseQty 
    })));
    setVarianceNote('');
  };

  // Check if modified
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

  // Unique stores calculation
  const uniqueStores = useMemo(() => {
    return Array.from(new Set(items.map(it => (it.actualStoreName || it.storeName || '').trim()).filter(s => s && !s.includes('ระบุร้านภายหลัง'))));
  }, [items]);

  // Strict Pre-Order Validation Guard & Acknowledge (Directive 2)
  const handleAcknowledgeAndOrder = async () => {
    // 1. Price & Quantity validation
    for (let it of items) {
      if (it.unitPrice === '' || Number(it.unitPrice) < 0) {
        return modalService.warning(`กรุณาระบุราคาต่อหน่วยของ "${it.name}" ให้ถูกต้อง`);
      }
      if (!it.purchaseQty || Number(it.purchaseQty) <= 0) {
        return modalService.warning(`กรุณาระบุจำนวนสั่งซื้อของ "${it.name}" ให้มากกว่า 0`);
      }
    }

    // 2. Strict Pre-Order Validation Guard (Directive 2)
    const invalidSet = new Set();
    items.forEach((it, idx) => {
      const s = (it.actualStoreName || '').trim();
      if (!s || s.includes('ระบุร้านภายหลัง')) {
        invalidSet.add(idx);
      }
    });

    if (invalidSet.size > 0) {
      setInvalidStoreIndices(invalidSet);
      return modalService.warning('กรุณาระบุชื่อร้านค้าจริงของทุกรายการก่อนยืนยันการสั่งซื้อ');
    }
    setInvalidStoreIndices(new Set());

    // 3. Resolve final Vendor Name (Directive 3)
    const finalVendorName = uniqueStores.length === 1
      ? uniqueStores[0]
      : 'แพลตฟอร์ม Shopee / Lazada Marketplace (สั่งซื้อออนไลน์)';

    let confirmMsg = `ยืนยันบันทึกว่าสั่งซื้อสินค้าเรียบร้อยแล้วสำหรับ PO ${po.poNo}`;
    if (uniqueStores.length === 1) {
      confirmMsg += `\nร้านค้า: "${uniqueStores[0]}"`;
    } else {
      confirmMsg += `\nร้านค้า: สั่งซื้อจาก ${uniqueStores.length} ร้านค้า (${uniqueStores.join(', ')})`;
    }
    confirmMsg += `\nยอดสั่งซื้อรวม: ฿${totalEstimatedAmount.toLocaleString()}`;
    if (hasModifications) {
      confirmMsg += `\n(มีการปรับยอดจากราคาประเมินเดิม ฿${originalTotalAmount.toLocaleString()} -> ส่วนต่าง ฿${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString()})`;
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
      const updatedPO = await apiService.acknowledgeOnlineTask(po.id, finalVendorName, currentRole, items, varianceNote.trim());
      
      const payload = {
        ...(updatedPO || po),
        status: 'ORDERED_PENDING_DELIVERY',
        vendor: finalVendorName,
        vendorName: finalVendorName,
        shopName: finalVendorName,
        orderedAt: new Date().toISOString(),
        items: items.map(it => ({
          ...it,
          actualPrice: Number(it.unitPrice),
          actualQty: Number(it.purchaseQty),
          actualStoreName: (it.actualStoreName || '').trim(),
          storePlatform: it.storePlatform || 'Shopee',
          orderRefNo: (it.orderRefNo || '').trim()
        }))
      };

      if (onUpdate) onUpdate(payload);
      await modalService.success('บันทึกการสั่งซื้อเรียบร้อย', `บันทึกการสั่งซื้อสำหรับ PO ${po.poNo} เรียบร้อยแล้ว! ระบบแจ้งเตือนแผนก ${po.department} ให้รอตรวจรับสินค้า`);
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึก', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveClaim = async () => {
    if (claimResolutionType === 'RESEND' && !claimExpectedDate) {
      return modalService.warning('กรุณาระบุวันที่คาดว่าจะได้รับสินค้าใหม่');
    }
    if (!claimNote.trim()) {
      return modalService.warning('กรุณาระบุหมายเหตุ/ความคืบหน้าการติดต่อร้านค้า');
    }

    const confirmMsg = `ยืนยันบันทึกผลการเคลม/ติดต่อร้านค้า สำหรับ PO ${po.poNo} ใช่หรือไม่?`;
    const confirmed = await modalService.confirm({
      title: 'ยืนยันผลการดำเนินการ',
      message: confirmMsg,
      confirmText: 'ยืนยันบันทึก',
      cancelText: 'ยกเลิก'
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await apiService.resolveOnlineClaim(po.id, {
        type: claimResolutionType,
        note: claimNote.trim(),
        expectedDate: claimExpectedDate
      }, currentRole);
      if (onUpdate) onUpdate(res);
      await modalService.success('ดำเนินการเรียบร้อย', 'บันทึกสถานะการเคลมสำเร็จ');
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึก', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasOnlineUrl = po.onlineUrl && po.onlineUrl.trim().length > 0;

  // Render Status Badge
  const renderStatusBadge = () => {
    if (isPending) {
      return (
        <span className="bg-indigo-50 text-indigo-700 border border-indigo-150 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs whitespace-nowrap">
          รอดำเนินการ
        </span>
      );
    }
    if (isPartialReceived) {
      return (
        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs whitespace-nowrap">
          รับของแล้วบางส่วน
        </span>
      );
    }
    if (isClosed) {
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs whitespace-nowrap">
          ตรวจรับครบ
        </span>
      );
    }
    if (isClaim) {
      return (
        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs whitespace-nowrap">
          รอเคลมสินค้า
        </span>
      );
    }
    return (
      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs whitespace-nowrap">
        สั่งซื้อแล้ว (ระหว่างส่ง)
      </span>
    );
  };

  // Department Chip Style
  const deptChipClass = po.department === 'QC' 
    ? 'bg-amber-50 text-amber-700 border border-amber-200/60' 
    : po.department === 'PD'
    ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
    : 'bg-slate-100 text-slate-700 border border-slate-200/60';

  // Latest Activity summary for Micro-footer
  const latestActivityText = useMemo(() => {
    if (Array.isArray(po.activityLog) && po.activityLog.length > 0) {
      const last = po.activityLog[po.activityLog.length - 1];
      const timeStr = last.timestamp || last.time 
        ? new Date(last.timestamp || last.time).toLocaleString('th-TH', { 
            day: 'numeric', 
            month: 'numeric', 
            year: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : '';
      return `${last.action || last.title || 'อัปเดตสถานะ'} โดย ${last.user || last.actor || 'เจ้าหน้าที่'} ${timeStr ? `(${timeStr})` : ''}`;
    }
    if (po.orderedAt) {
      const timeStr = new Date(po.orderedAt).toLocaleString('th-TH', { 
        day: 'numeric', 
        month: 'numeric', 
        year: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
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
    <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl p-4 mb-3 shadow-2xs transition-all font-sans">
      {/* ── 1. Order Header Bar (Top Row) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        {/* Left: PO Mono • Dept Chip • PR Ref • Store Name */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="font-mono font-bold text-slate-900 text-sm tracking-tight">
            {po.poNo}
          </span>
          <button
            type="button"
            onClick={() => handleCopyText(po.poNo, 'po')}
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title="คัดลอกรหัส PO"
          >
            {copiedPO ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          </button>

          <span className="text-slate-300 mx-0.5 font-bold select-none">•</span>

          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${deptChipClass}`}>
            {po.department}
          </span>

          <span className="text-slate-300 mx-0.5 font-bold select-none">•</span>

          <span className="text-xs text-slate-500 font-medium">PR:</span>
          <span className="font-mono text-slate-700 text-xs font-semibold">
            {po.prNo}
          </span>

          {Boolean(vendorDisplay) && (
            <>
              <span className="text-slate-300 mx-0.5 font-bold select-none">•</span>
              <span className="text-xs text-slate-600 font-medium inline-flex items-center gap-1 truncate max-w-[240px]">
                <Store className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{vendorDisplay}</span>
              </span>
            </>
          )}

          {hasModifications && isPending && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded ml-1">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
              <span>ปรับยอด {priceDiff >= 0 ? '+' : ''}฿{priceDiff.toLocaleString()}</span>
            </span>
          )}
        </div>

        {/* Right: Status Badge & Total Amount (Bold font-mono) Side-by-Side */}
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          {renderStatusBadge()}
          <span className="font-mono font-black text-slate-900 text-base sm:text-lg min-w-[70px] text-right">
            ฿{totalEstimatedAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── 2. Streamlined Item List with Line-Item Store Level Inputs (Directive 1) ── */}
      <div className="space-y-2 my-2.5">
        {items.map((item, idx) => {
          const pQty = Number(item.purchaseQty) || 0;
          const price = Number(item.unitPrice) || 0;
          const lineTotal = price * pQty;
          const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
          const rawUrl = getProductUrl(item);

          return (
            <div 
              key={idx} 
              className="flex flex-col py-2.5 px-3 rounded-lg bg-slate-50/60 hover:bg-slate-50 border border-slate-150/60 transition-colors gap-2"
            >
              {/* Row 1: Item Info & Price/Qty Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* Left: SKU, Name, Store Link */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono text-xs font-semibold text-slate-500 shrink-0">
                    {item.code || item.sku || 'ITEM'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 truncate" title={item.name}>
                    {item.name}
                  </span>
                  {rawUrl && (
                    <a 
                      href={sanitizeExternalUrl(rawUrl)} 
                      target="_blank" 
                      rel="noreferrer" 
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-0.5 shrink-0"
                    >
                      <span>↗ ลิงก์สินค้า</span>
                    </a>
                  )}
                  {item.note && (
                    <span className="text-[11px] text-slate-400 truncate hidden md:inline">
                      ({item.note})
                    </span>
                  )}
                </div>

                {/* Right: Quantity × Price, Line Total, Copy Button */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  {isPending ? (
                    // Compact editable inputs for pending orders
                    <div className="flex items-center gap-1.5">
                      <div className="bg-white border border-slate-200 focus-within:border-indigo-500 rounded-md px-1.5 py-0.5 flex items-center shadow-2xs">
                        <input
                          type="number"
                          min="1"
                          value={item.purchaseQty}
                          onChange={e => handleQtyChange(idx, e.target.value)}
                          className="w-9 text-center font-mono font-bold text-slate-900 text-xs outline-none bg-transparent"
                          title="จำนวนที่สั่งได้จริง"
                        />
                        <span className="text-[10px] text-slate-400 ml-0.5">{pUnit}</span>
                      </div>
                      <span className="text-slate-300 text-xs">×</span>
                      <div className="bg-white border border-slate-200 focus-within:border-indigo-500 rounded-md px-1.5 py-0.5 flex items-center shadow-2xs">
                        <span className="text-[10px] text-slate-400 mr-0.5">฿</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unitPrice}
                          onChange={e => handlePriceChange(idx, e.target.value)}
                          className="w-16 text-right font-mono font-bold text-slate-900 text-xs outline-none bg-transparent"
                          placeholder="0.00"
                          title="ราคาซื้อจริงต่อหน่วย"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium font-mono whitespace-nowrap">
                      {pQty.toLocaleString()} {pUnit} × ฿{price.toLocaleString()}
                    </span>
                  )}

                  <span className="text-xs sm:text-sm font-black font-mono text-slate-900 min-w-[70px] text-right whitespace-nowrap">
                    ฿{lineTotal.toLocaleString()}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCopyText(item.name, 'item')}
                    className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 rounded hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                    title="คัดลอกชื่อสินค้า"
                  >
                    {copiedCode === item.name ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> คัดลอกแล้ว
                      </span>
                    ) : (
                      'คัดลอก'
                    )}
                  </button>
                </div>
              </div>

              {/* Row 2: Line-Item Store Level Input & Platform Chips (Directive 1 & 2) */}
              {isPending ? (
                <div className="pt-1.5 mt-0.5 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                    {/* Platform Selector Chips */}
                    <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200/60 shrink-0">
                      {['Shopee', 'Lazada', 'Official'].map(plat => {
                        const isSel = (item.storePlatform || 'Shopee').toLowerCase() === plat.toLowerCase();
                        return (
                          <button
                            key={plat}
                            type="button"
                            onClick={() => handleItemPlatformChange(idx, plat)}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all cursor-pointer ${
                              isSel
                                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {plat}
                          </button>
                        );
                      })}
                    </div>

                    {/* Actual Store Name Input (with Strict Validation highlight) */}
                    <div className="relative flex-1 min-w-[140px] max-w-sm">
                      <input
                        type="text"
                        placeholder="ชื่อร้านค้าจริง (เช่น 3M Official Store)... *"
                        value={item.actualStoreName || ''}
                        onChange={e => handleItemStoreChange(idx, e.target.value)}
                        className={`w-full h-7 pl-6 pr-2 text-xs rounded-md border transition-all font-sans outline-none ${
                          invalidStoreIndices.has(idx)
                            ? 'border-rose-400 ring-1 ring-rose-300 bg-rose-50/70 text-rose-900 placeholder:text-rose-400 font-medium'
                            : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-slate-800'
                        }`}
                      />
                      <Store className={`w-3 h-3 absolute left-2 top-2 ${invalidStoreIndices.has(idx) ? 'text-rose-500' : 'text-slate-400'}`} />
                    </div>

                    {/* Order Ref No (Optional) */}
                    <input
                      type="text"
                      placeholder="เลขอ้างอิงคำสั่งซื้อ (ถ้ามี)"
                      value={item.orderRefNo || ''}
                      onChange={e => handleItemOrderRefChange(idx, e.target.value)}
                      className="w-36 h-7 px-2 text-[11px] rounded-md bg-white border border-slate-200 focus:border-indigo-500 outline-none text-slate-700 font-mono"
                    />
                  </div>

                  {/* Shortcut Button: Apply to all items (Directive 1) */}
                  {idx === 0 && items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleApplyStoreToAll(idx)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 inline-flex items-center gap-1 cursor-pointer transition-colors py-0.5 self-start sm:self-auto"
                      title="ใช้ชื่อร้านค้าและแพลตฟอร์มนี้กับทุกรายการใน PO"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>ใช้ชื่อร้านนี้กับทุกรายการ (Apply to all)</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Ordered / Completed Mode: Compact Store Details Tag */
                <div className="pt-1 mt-0.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-sans">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                      <Store className="w-3 h-3 text-slate-400" />
                      <span>ร้าน: <strong className="font-semibold text-slate-900">{item.actualStoreName || item.storeName || po.vendorName || '-'}</strong></span>
                    </span>
                    {item.storePlatform && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {item.storePlatform}
                      </span>
                    )}
                    {item.orderRefNo && (
                      <span className="text-slate-400 font-mono text-[10px]">
                        (Ref: {item.orderRefNo})
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Variance Note Input (If modified in pending mode) */}
      {isPending && hasModifications && (
        <div className="mb-2.5 p-2.5 bg-amber-50/70 rounded-lg border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-amber-900 font-medium shrink-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>เหตุผลการปรับยอด:</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={varianceNote}
              onChange={e => setVarianceNote(e.target.value)}
              placeholder="เช่น ร้านค้าเหลือ 5 ชิ้น, ได้รับคูปองส่วนลด..."
              className="w-full bg-white border border-amber-300/80 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-amber-400 outline-none text-slate-800"
            />
            <button
              type="button"
              onClick={handleResetAll}
              className="px-2.5 py-1 bg-white hover:bg-amber-100/60 text-slate-700 border border-amber-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              title="คืนค่าเดิมทั้งหมด"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>คืนค่า</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Pending Checkout Dock (Store Selection Summary & Confirm) ── */}
      {isPending && (
        <div className="pt-2.5 mt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Left: Summary of stores */}
          <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
            <Store className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="truncate">
              {(() => {
                const filledStores = Array.from(new Set(items.map(it => (it.actualStoreName || '').trim()).filter(s => s && !s.includes('ระบุร้านภายหลัง'))));
                if (filledStores.length === 0) {
                  return <span className="text-amber-600 font-medium">* กรุณาระบุชื่อร้านค้าจริงของทุกรายการสินค้าด้านบน</span>;
                }
                if (filledStores.length === 1) {
                  return <span>ร้านค้า: <strong className="text-slate-900 font-semibold">{filledStores[0]}</strong> ({items.length} รายการ)</span>;
                }
                return <span>สั่งซื้อจาก <strong className="text-indigo-700 font-bold">{filledStores.length} ร้านค้า</strong> ({filledStores.join(', ')})</span>;
              })()}
            </span>
          </div>

          {/* Right: Confirm Order Button */}
          <button
            type="button"
            onClick={handleAcknowledgeAndOrder}
            disabled={isSubmitting}
            className={`h-9 px-4 rounded-xl text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              isSubmitting
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-sm active:scale-98'
            }`}
          >
            <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการสั่งซื้อ'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 4. Compact Micro-Footer (Single-Row) ── */}
      <div className={`pt-2.5 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
        isPending ? '' : 'border-t border-slate-100'
      }`}>
        {/* Left: Latest Activity Note + Toggle History */}
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

        {/* Right: Ghost Actions */}
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

      {/* Claim Resolution Drawer (If claim status) */}
      {isClaim && (
        <div className="mt-3 p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-rose-800 font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>จัดการเคลมสินค้า / ส่งต่อร้านค้าออนไลน์</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">แนวทางแก้ปัญหา</label>
              <select
                value={claimResolutionType}
                onChange={e => setClaimResolutionType(e.target.value)}
                className="w-full bg-white border border-rose-200 text-xs rounded-lg px-2 py-1 outline-none"
              >
                <option value="RESEND">ร้านค้าส่งของใหม่มาเปลี่ยน (Resend)</option>
                <option value="REFUND">ร้านค้าคืนเงิน (Refund)</option>
              </select>
            </div>
            {claimResolutionType === 'RESEND' && (
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">วันที่คาดว่าจะได้รับ</label>
                <input
                  type="date"
                  value={claimExpectedDate}
                  onChange={e => setClaimExpectedDate(e.target.value)}
                  className="w-full bg-white border border-rose-200 text-xs rounded-lg px-2 py-1 outline-none font-mono"
                />
              </div>
            )}
            <div className={claimResolutionType === 'RESEND' ? 'sm:col-span-1' : 'sm:col-span-2'}>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">บันทึกการติดต่อ</label>
              <input
                type="text"
                value={claimNote}
                onChange={e => setClaimNote(e.target.value)}
                placeholder="เช่น ติดต่อร้านผ่าน Chat Shopee แจ้งส่งใหม่..."
                className="w-full bg-white border border-rose-200 text-xs rounded-lg px-2.5 py-1 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={handleResolveClaim}
              disabled={isSubmitting}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกสถานะเคลม'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Named alias for flexible imports
export const OnlinePurchaseActionCard = OnlineOrderCard;
