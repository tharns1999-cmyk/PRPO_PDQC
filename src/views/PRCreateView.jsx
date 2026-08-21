import React, { useState, useMemo, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { 
  FileText, ArrowLeft, Info, AlertTriangle, FileSignature, 
  Plus, Trash2, Building2, Calendar, ShoppingBag, Globe, 
  Sparkles, CheckCircle2, ShoppingCart, SlidersHorizontal, Repeat, ArrowRight, Factory, Building, Receipt, Package, HelpCircle, Layers, Paperclip
} from 'lucide-react';
import { PR_SOURCE, PURCHASE_CHANNEL, MEMO_THRESHOLD, DEPARTMENTS } from '../config/constants';
import FileUploader from '../components/common/FileUploader';
import SearchableSelect from '../components/common/SearchableSelect';
import { modalService } from '../services/modalService';

export default function PRCreateView({ 
  products = [], 
  currentRole, 
  onNavigate, 
  onRefresh, 
  preselectedProduct, 
  clearPreselectedProduct,
  editingPR,
  clearEditingPR
}) {
  // Determine effective department (locked for PD/QC users, selectable for ALL)
  const initialDept = editingPR 
    ? editingPR.department 
    : (currentRole.department === 'ALL' 
        ? (preselectedProduct?.category || 'PD') 
        : currentRole.department);

  const [department, setDepartment] = useState(initialDept);
  const [source, setSource] = useState(editingPR?.source || 'FACTORY');
  const [purchaseChannel, setPurchaseChannel] = useState(editingPR?.purchaseChannel || 'SELF');
  
  // File attachments
  const [onlineLink, setOnlineLink] = useState(editingPR?.specUrl || '');
  const [quotationFiles, setQuotationFiles] = useState(() => {
    return (editingPR?.attachments || []).filter(a => a.category === 'QUOTATION' || a.type === 'application/pdf');
  });
  const [imageFiles, setImageFiles] = useState(() => {
    return (editingPR?.attachments || []).filter(a => a.category === 'IMAGE' || a.type?.startsWith('image/'));
  });
  
  const [note, setNote] = useState(editingPR?.note || '');

  // Financial State for SELF Purchase Channel
  const [combinedDiscountType, setCombinedDiscountType] = useState(editingPR?.financials?.combinedDiscountType || 'percent'); // 'percent' | 'fixed'
  const [combinedDiscountValue, setCombinedDiscountValue] = useState(editingPR?.financials?.combinedDiscountValue ?? 0);
  const [vatMode, setVatMode] = useState(editingPR?.financials?.vatMode || 'AFTER_DISCOUNT'); // 'AFTER_DISCOUNT' | 'BEFORE_DISCOUNT'
  const [roundingAdj, setRoundingAdj] = useState(editingPR?.financials?.roundingAdj ?? 0);
  const [shippingCost, setShippingCost] = useState(editingPR?.financials?.shippingCost ?? 0);

  // Find return/reject reason if this PR was returned
  const returnReason = useMemo(() => {
    if (!editingPR || !editingPR.activityLog) return null;
    const lastReject = [...editingPR.activityLog].reverse().find(l => 
      l.action?.includes('ส่งกลับ') || l.action?.includes('Reject') || l.action?.includes('ปฏิเสธ')
    );
    return lastReject?.note || null;
  }, [editingPR]);

  // Filter products by the active department
  const availableProducts = useMemo(() => {
    return products
      .filter(p => (p.category || p.department) === department)
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [products, department]);

  // Transform available products into searchable options
  const productOptions = useMemo(() => {
    return availableProducts.map(p => {
      const pUnit = p.purchaseUnit || p.unit || 'ชิ้น';
      const sUnit = p.stockUnit || p.unit || 'ชิ้น';
      const rate = Number(p.conversionRate) > 0 ? Number(p.conversionRate) : 1;
      const pCat = p.category || p.department || 'PD';
      return {
        value: p.id,
        label: p.name,
        code: p.code,
        subLabel: `฿${Number(p.price || 0).toLocaleString()} / ${pUnit} • คงเหลือ: ${Number(p.stockBalance || 0).toLocaleString()} ${sUnit} • ROP: ${Number(p.reorderPoint || 0).toLocaleString()} ${sUnit}`,
        badge: pCat === 'PD' ? 'ฝ่ายผลิต' : 'ฝ่าย QC',
        keywords: `${p.code} ${p.name} ${pUnit} ${sUnit} ${pCat}`
      };
    });
  }, [availableProducts]);

  // Initial PR Items state
  const [prItems, setPrItems] = useState(() => {
    if (editingPR && editingPR.items && editingPR.items.length > 0) {
      return editingPR.items.map(it => ({
        productId: it.productId || it.code,
        qty: Number(it.purchaseQty ?? it.qty) || 1,
        price: parseFloat(it.price) || 0,
        discountPercent: parseFloat(it.discountPercent) || 0,
        discountAmount: parseFloat(it.discountAmount) || 0,
        onlineUrl: it.onlineUrl || '',
        source: it.source === 'OFFICE' ? 'OFFICE' : 'FACTORY',
        isCustom: Boolean(it.isCustom),
        customName: it.name,
        customCode: it.code,
        customUnit: it.purchaseUnit || it.unit || 'ชิ้น',
        overrideUnit: Boolean(it.isUnitOverridden),
        customPurchaseUnit: it.purchaseUnit,
        customStockUnit: it.stockUnit,
        customRate: it.conversionRate
      }));
    }
    if (preselectedProduct && preselectedProduct.category === initialDept) {
      return [{ 
        productId: preselectedProduct.id, 
        qty: Math.max(1, (preselectedProduct.reorderPoint || 5) * 2), 
        price: parseFloat(preselectedProduct.price) || 0,
        discountPercent: 0,
        discountAmount: 0,
        onlineUrl: '',
        source: 'FACTORY'
      }];
    }
    const initialList = products.filter(p => p.category === initialDept);
    return [{ 
      productId: initialList[0]?.id || '', 
      qty: 1, 
      price: parseFloat(initialList[0]?.price) || 0,
      discountPercent: 0,
      discountAmount: 0,
      onlineUrl: '',
      source: 'FACTORY'
    }];
  });

  // When department changes, sync prItems so all items belong to new department (only for non-editing mode)
  useEffect(() => {
    if (!editingPR && availableProducts.length > 0) {
      setPrItems(prevItems => {
        const needsReset = prevItems.some(item => !item.isCustom && !availableProducts.some(p => p.id === item.productId));
        if (needsReset) {
          return [{
            productId: availableProducts[0].id,
            qty: 1,
            price: parseFloat(availableProducts[0].price) || 0,
            discountPercent: 0,
            discountAmount: 0,
            onlineUrl: '',
            source: 'FACTORY'
          }];
        }
        return prevItems;
      });
    }
  }, [department, availableProducts, editingPR]);

  // Memo Fields
  const [memoData, setMemoData] = useState(() => {
    if (editingPR?.memo) {
      return {
        subject: editingPR.memo.subject || '',
        purpose: editingPR.memo.purpose || '',
        background: editingPR.memo.background || '',
        paymentTerm: editingPR.memo.paymentTerm || 'เครดิต 30 วัน',
        classification: editingPR.memo.classification || 'EXPENSE',
        remarkAttachedFile: editingPR.memo.remarkAttachedFile || ''
      };
    }
    return {
      subject: '',
      purpose: '',
      background: '',
      paymentTerm: 'เครดิต 30 วัน',
      classification: 'EXPENSE',
      remarkAttachedFile: ''
    };
  });

  // ── Financial Calculations ──
  const isOnline = purchaseChannel === 'ONLINE';

  const subtotal = useMemo(() => {
    return prItems.reduce((sum, item) => sum + ((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)), 0);
  }, [prItems]);

  const itemDiscountTotal = useMemo(() => {
    return prItems.reduce((sum, item) => sum + (parseFloat(item.discountAmount) || 0), 0);
  }, [prItems]);

  const netAfterItemDiscount = useMemo(() => {
    return Math.max(0, subtotal - itemDiscountTotal);
  }, [subtotal, itemDiscountTotal]);

  const combinedDiscountAmount = useMemo(() => {
    const val = parseFloat(combinedDiscountValue) || 0;
    if (combinedDiscountType === 'percent') {
      return parseFloat((netAfterItemDiscount * (val / 100)).toFixed(2));
    }
    return val;
  }, [netAfterItemDiscount, combinedDiscountType, combinedDiscountValue]);

  const totalDiscount = useMemo(() => {
    return itemDiscountTotal + combinedDiscountAmount;
  }, [itemDiscountTotal, combinedDiscountAmount]);

  const netAfterAllDiscount = useMemo(() => {
    return Math.max(0, subtotal - totalDiscount);
  }, [subtotal, totalDiscount]);

  const vatAmount = useMemo(() => {
    if (purchaseChannel !== 'SELF') return 0;
    const vatBase = vatMode === 'BEFORE_DISCOUNT' ? subtotal : netAfterAllDiscount;
    return parseFloat((vatBase * 0.07).toFixed(2));
  }, [purchaseChannel, vatMode, subtotal, netAfterAllDiscount]);

  const grandTotal = useMemo(() => {
    if (purchaseChannel !== 'SELF') {
      return subtotal;
    }
    const safeRounding = parseFloat(roundingAdj) || 0;
    const safeShipping = parseFloat(shippingCost) || 0;
    if (vatMode === 'BEFORE_DISCOUNT') {
      return parseFloat((subtotal + vatAmount - totalDiscount + safeRounding + safeShipping).toFixed(2));
    } else {
      return parseFloat((netAfterAllDiscount + vatAmount + safeRounding + safeShipping).toFixed(2));
    }
  }, [purchaseChannel, subtotal, totalDiscount, netAfterAllDiscount, vatMode, vatAmount, roundingAdj, shippingCost]);

  const totalAmount = grandTotal;
  const requiresMemo = totalAmount >= MEMO_THRESHOLD;

  const handleAddItemRow = () => {
    const defaultProd = availableProducts[0];
    setPrItems(prev => [
      ...prev, 
      { 
        productId: defaultProd?.id || '', 
        qty: 1, 
        price: parseFloat(defaultProd?.price) || 0, 
        discountPercent: 0, 
        discountAmount: 0, 
        source: 'FACTORY',
        isCustom: false 
      }
    ]);
  };

  const handleRemoveItemRow = (index) => {
    if (prItems.length <= 1) return;
    setPrItems(prItems.filter((_, i) => i !== index));
  };

  const handleToggleCustomItem = (index) => {
    const updated = [...prItems];
    const current = updated[index];
    const isNowCustom = !current.isCustom;
    
    if (isNowCustom) {
      const tempId = `TEMP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      updated[index] = {
        ...current,
        isCustom: true,
        customCode: tempId,
        customName: '',
        customUnit: 'ชิ้น',
        productId: tempId,
        price: parseFloat(current.price) || 0,
        qty: parseFloat(current.qty) || 1,
        discountPercent: 0,
        discountAmount: 0,
        onlineUrl: current.onlineUrl || '',
        source: current.source || 'FACTORY'
      };
    } else {
      const defaultProd = availableProducts[0];
      updated[index] = {
        ...current,
        isCustom: false,
        customCode: '',
        customName: '',
        customUnit: '',
        productId: defaultProd?.id || '',
        price: parseFloat(defaultProd?.price) || 0,
        qty: parseFloat(current.qty) || 1,
        discountPercent: 0,
        discountAmount: 0,
        onlineUrl: current.onlineUrl || '',
        source: current.source || 'FACTORY'
      };
    }
    setPrItems(updated);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...prItems];
    updated[index][field] = value;
    
    // Auto-update price when product changes
    if (field === 'productId') {
      const prod = availableProducts.find(p => p.id === value);
      if (prod) {
        updated[index].price = parseFloat(prod.price) || 0;
      }
    }

    // Sync discounts
    if (field === 'discountPercent') {
      const p = parseFloat(value) || 0;
      const itemQty = parseFloat(updated[index].qty) || 1;
      const itemPrice = parseFloat(updated[index].price) || 0;
      updated[index].discountAmount = p > 0 ? parseFloat(((itemQty * itemPrice) * (p / 100)).toFixed(2)) : 0;
    } else if (field === 'discountAmount') {
      const amt = parseFloat(value) || 0;
      const itemQty = parseFloat(updated[index].qty) || 1;
      const itemPrice = parseFloat(updated[index].price) || 0;
      const rowBase = itemQty * itemPrice;
      updated[index].discountPercent = (rowBase > 0 && amt > 0) ? parseFloat(((amt / rowBase) * 100).toFixed(2)) : 0;
    } else if (field === 'price' || field === 'qty') {
      const p = parseFloat(updated[index].discountPercent) || 0;
      const itemQty = parseFloat(field === 'qty' ? value : updated[index].qty) || 0;
      const itemPrice = parseFloat(field === 'price' ? value : updated[index].price) || 0;
      if (p > 0) {
        updated[index].discountAmount = parseFloat(((itemQty * itemPrice) * (p / 100)).toFixed(2));
      }
    }
    
    setPrItems(updated);
  };

  const handleCreateSubmit = async (e, isDraft) => {
    e.preventDefault();

    // Validations
    if (!isDraft) {
      if (prItems.some(item => {
        if (item.isCustom) {
          return !item.customName?.trim() || Number(item.qty) <= 0;
        }
        return !item.productId || Number(item.qty) <= 0;
      })) {
        return modalService.warning('กรุณาระบุข้อมูลรายการสินค้าและจำนวนที่ถูกต้อง');
      }

      if (isOnline && !requiresMemo) {
        const hasLink = !!onlineLink.trim() || prItems.some(item => !!(item.onlineUrl || '').trim());
        if (!hasLink) {
          return modalService.warning('กรุณาระบุ Online Link (Shopee/Lazada) สำหรับการสั่งซื้อออนไลน์อย่างน้อย 1 รายการ หรือในส่วนรายละเอียดเอกสาร');
        }
      }
      
      if (requiresMemo) {
        if (quotationFiles.length === 0) return modalService.warning('กรุณาแนบไฟล์ Quotation เนื่องจากยอดรวมเกิน 20,000 บาท');
        if (imageFiles.length === 0) return modalService.warning('กรุณาแนบรูปภาพสินค้า เนื่องจากยอดรวมเกิน 20,000 บาท');
        
        if (!memoData.subject.trim() || !memoData.purpose.trim() || !memoData.background.trim()) {
          return modalService.warning('กรุณากรอกข้อมูล MEMO ให้ครบถ้วน');
        }
      }
    }

    try {
      const itemsFormatted = prItems.map(item => {
        const itemSource = item.source === 'OFFICE' ? 'OFFICE' : 'FACTORY';
        const discP = parseFloat(item.discountPercent) || 0;
        const discA = parseFloat(item.discountAmount) || 0;

        if (item.isCustom) {
          const pQty = Number(item.qty) || 1;
          const price = parseFloat(item.price) || 0;
          const unit = item.customUnit?.trim() || 'ชิ้น';
          const code = item.customCode || `TEMP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          const rowTotal = Math.max(0, (price * pQty) - discA);
          return {
            productId: item.productId || code,
            code: code,
            name: item.customName?.trim() || 'สินค้านอกแคตตาล็อก',
            purchaseUnit: unit,
            stockUnit: unit,
            unit: unit,
            conversionRate: 1,
            purchaseQty: pQty,
            stockQty: pQty,
            qty: pQty,
            price: price,
            discountPercent: discP,
            discountAmount: discA,
            onlineUrl: item.onlineUrl,
            total: rowTotal,
            source: itemSource,
            isCustom: true
          };
        }

        const prod = availableProducts.find(p => p.id === item.productId) || products.find(p => p.id === item.productId);
        const pQty = Number(item.qty) || 1;
        const rate = (item.overrideUnit && Number(item.customRate) > 0)
          ? Number(item.customRate)
          : (Number(prod?.conversionRate) > 0 ? Number(prod?.conversionRate) : 1);
        const sQty = pQty * rate;
        const pUnit = (item.overrideUnit && item.customPurchaseUnit?.trim())
          ? item.customPurchaseUnit.trim()
          : (prod?.purchaseUnit || prod?.unit || 'ชิ้น');
        const sUnit = (item.overrideUnit && item.customStockUnit?.trim())
          ? item.customStockUnit.trim()
          : (prod?.stockUnit || prod?.unit || 'ชิ้น');
        const price = parseFloat(item.price) || 0;
        const rowTotal = Math.max(0, (price * pQty) - discA);
        return {
          productId: prod?.id || item.productId,
          code: prod?.code || 'N/A',
          name: prod?.name || 'N/A',
          purchaseUnit: pUnit,
          stockUnit: sUnit,
          conversionRate: rate,
          purchaseQty: pQty,
          stockQty: sQty,
          qty: pQty,
          unit: pUnit,
          price: price,
          discountPercent: discP,
          discountAmount: discA,
          onlineUrl: item.onlineUrl,
          total: rowTotal,
          source: itemSource,
          isCustom: false,
          isUnitOverridden: Boolean(item.overrideUnit && Number(item.customRate) > 0)
        };
      });

      // Construct Memo if required
      let finalMemo = null;
      if (requiresMemo) {
        finalMemo = {
          applicantDept: department,
          applicantName1: editingPR?.requestedBy || currentRole.name,
          applicantName2: '-',
          date: new Date().toISOString().split('T')[0],
          approverManager: '-',
          approverConsultant: '-',
          approverGM: 'คุณประเสริฐ',
          approverCFO: '-',
          approverBoD: '-',
          subject: memoData.subject,
          purpose: memoData.purpose,
          background: memoData.background,
          estimatedCost: totalAmount,
          paymentTerm: memoData.paymentTerm,
          classification: memoData.classification,
          remarkAttachedFile: memoData.remarkAttachedFile || 'มีเอกสารแนบ',
          conclusion: 'APPROVED',
          conclusionReason: ''
        };
      }

      const financialsPayload = purchaseChannel === 'SELF' ? {
        subtotal,
        itemDiscountTotal,
        combinedDiscountType,
        combinedDiscountValue: parseFloat(combinedDiscountValue) || 0,
        combinedDiscountAmount,
        totalDiscount,
        vatMode,
        vatAmount,
        roundingAdj: parseFloat(roundingAdj) || 0,
        shippingCost: parseFloat(shippingCost) || 0,
        grandTotal
      } : {
        subtotal,
        itemDiscountTotal: 0,
        combinedDiscountType: 'fixed',
        combinedDiscountValue: 0,
        combinedDiscountAmount: 0,
        totalDiscount: 0,
        vatMode: 'NONE',
        vatAmount: 0,
        roundingAdj: 0,
        shippingCost: 0,
        grandTotal: subtotal
      };

      const prPayload = {
        department,
        purchaseChannel,
        specUrl: quotationFiles[0] ? quotationFiles[0].name : '',
        attachments: [
          ...quotationFiles.map(f => ({ name: f.name, size: f.size, type: f.type || 'application/pdf', previewUrl: f.previewUrl, category: 'QUOTATION' })),
          ...imageFiles.map(f => ({ name: f.name, size: f.size, type: f.type || 'image/jpeg', previewUrl: f.previewUrl, category: 'IMAGE' }))
        ],
        note,
        items: itemsFormatted,
        financials: financialsPayload,
        totalAmount: grandTotal,
        memo: finalMemo
      };

      if (editingPR) {
        await apiService.updatePR(editingPR.id, prPayload, currentRole, isDraft);
        if (clearEditingPR) clearEditingPR();
        modalService.success(isDraft ? 'บันทึกแบบร่างเรียบร้อย' : 'แก้ไขและยื่นส่งใบขอซื้อ (PR) สำเร็จ');
      } else {
        await apiService.createPR(prPayload, currentRole, isDraft);
        if (clearPreselectedProduct) clearPreselectedProduct();
        modalService.success(isDraft ? 'บันทึกแบบร่างสำเร็จ' : 'สร้างและยื่นส่งใบขอซื้อ (PR) สำเร็จ');
      }

      onRefresh();
      onNavigate('pr-list');
    } catch (err) {
      modalService.error(editingPR ? 'เกิดข้อผิดพลาดในการแก้ไข PR' : 'เกิดข้อผิดพลาดในการสร้าง PR', err.message);
    }
  };

  const handleCancelAndBack = () => {
    if (clearPreselectedProduct) clearPreselectedProduct();
    if (clearEditingPR) clearEditingPR();
    onNavigate('pr-list');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
      
      {/* ── Top Header & Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button 
            type="button"
            onClick={handleCancelAndBack}
            className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200/80 rounded-full transition-all shadow-sm hover:shadow cursor-pointer shrink-0"
            title="ย้อนกลับไปรายการ PR"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {editingPR ? `แก้ไขใบขอซื้อ (Edit PR: ${editingPR.prNo})` : 'สร้างใบขอซื้อใหม่ (New PR)'}
              </h2>
              {editingPR?.status && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  {editingPR.status}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
              {editingPR ? (
                <>แก้ไขข้อมูลรายการสินค้าและเอกสารแนบเพื่อยื่นส่งใหม่อีกครั้ง</>
              ) : (
                <>กรอกรายละเอียดคำขอซื้อวัตถุดิบและอุปกรณ์สำหรับฝ่าย <span className="font-semibold text-slate-800 font-mono">[{department}]</span></>
              )}
            </p>
          </div>
        </div>

        {/* Scope Pill Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm w-fit self-start sm:self-auto">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">สังกัดฝ่าย:</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
            department === 'PD' ? 'bg-blue-50 text-blue-700 border border-blue-200/80' : 'bg-amber-50 text-amber-700 border border-amber-200/80'
          }`}>
            {department === 'PD' ? 'ฝ่ายผลิต (PD)' : 'ฝ่าย QC'}
          </span>
        </div>
      </div>

      {/* ── Return Reason Notice Banner (if editing returned PR) ── */}
      {returnReason && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm flex items-start gap-3.5 animate-fade-in">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="space-y-1 min-w-0">
            <h4 className="font-bold text-amber-900 text-sm sm:text-base">
              ใบขอซื้อนี้ถูกส่งกลับให้แก้ไข (Returned for Correction)
            </h4>
            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed font-medium">
              {returnReason}
            </p>
          </div>
        </div>
      )}

      {/* ── Main Form Formcard ── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
        <form className="divide-y divide-slate-100">
          
          {/* ─────────────────────────────────────────────────────────────
             SECTION 1: ข้อมูลเบื้องต้น (General Information)
             ───────────────────────────────────────────────────────────── */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-mono font-bold text-xs border border-indigo-100">
                  1
                </span>
                <span>ข้อมูลเบื้องต้นและช่องทางจัดซื้อ (General Info)</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Department Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  ฝ่ายผู้ขอซื้อ (Department) <span className="text-rose-500">*</span>
                </label>
                {currentRole.department !== 'ALL' ? (
                  <div className={`w-full border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 transition-all ${
                    department === 'PD' ? 'bg-blue-50/60 border-blue-200 text-blue-800' : 'bg-amber-50/60 border-amber-200 text-amber-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 shrink-0 text-slate-500" />
                      <span>{department === 'PD' ? 'ฝ่ายผลิต (PD - Production)' : 'ฝ่ายควบคุมคุณภาพ (QC - Lab)'}</span>
                    </div>
                    <span className="text-[11px] font-normal text-slate-400">(ตามสิทธิ์ของคุณ)</span>
                  </div>
                ) : (
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="PD">ฝ่ายผลิต (PD - Production)</option>
                    <option value="QC">ฝ่ายควบคุมคุณภาพ (QC - Quality Control)</option>
                  </select>
                )}
                <p className="text-[11px] text-slate-400">
                  * แคตตาล็อกสินค้าจะแสดงเฉพาะสินค้าของแผนกนี้
                </p>
              </div>

              {/* Purchase Channel Selection (Self-buy vs Online) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  ช่องทางจัดซื้อ (Purchase Channel) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(PURCHASE_CHANNEL).map(ch => {
                    const isChecked = purchaseChannel === ch.id;
                    return (
                      <label 
                        key={ch.id} 
                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all duration-200 select-none ${
                          isChecked 
                            ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/10 text-indigo-950 font-semibold shadow-xs' 
                            : 'bg-white border-slate-200/80 hover:bg-slate-50/80 hover:border-slate-300 text-slate-700 font-medium'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="purchaseChannel" 
                          value={ch.id} 
                          checked={isChecked} 
                          onChange={() => setPurchaseChannel(ch.id)} 
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                        />
                        <div className="flex items-center gap-2 min-w-0">
                          {ch.id === 'ONLINE' ? (
                            <ShoppingCart className={`w-4 h-4 shrink-0 ${isChecked ? 'text-purple-600' : 'text-slate-400'}`} />
                          ) : (
                            <Building2 className={`w-4 h-4 shrink-0 ${isChecked ? 'text-indigo-600' : 'text-slate-400'}`} />
                          )}
                          <span className="text-xs sm:text-sm truncate">{ch.label}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
             SECTION 2: รายการสินค้าที่ขอซื้อ (Items Selection)
             ───────────────────────────────────────────────────────────── */}
          <div className="p-6 sm:p-8 space-y-5 bg-slate-50/40">
            
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              <div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-mono font-bold text-xs border border-indigo-100">
                    2
                  </span>
                  <span>รายการสินค้าที่ขอซื้อ (Items Selection)</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-normal">
                  เลือกสินค้าเฉพาะแผนก <span className="font-semibold text-slate-800 font-mono">[{department}]</span> (มีทั้งหมด {availableProducts.length} รายการ) • ระบุจำนวนและปลายทาง
                </p>
              </div>

              {/* Status Badge in Top Right */}
              <div className="self-start sm:self-auto flex items-center gap-2">
                <span className="bg-white text-slate-700 text-xs px-3.5 py-1.5 rounded-full font-semibold border border-slate-200/80 shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <span>รวม</span>
                  <strong className="font-bold font-mono text-slate-900">{prItems.length}</strong>
                  <span>รายการ</span>
                </span>
              </div>
            </div>

            {/* Item Rows Container */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              
              {/* Desktop Column Header */}
              <div className={`hidden md:grid gap-3 px-5 py-3 bg-slate-50/90 text-xs font-semibold text-slate-500 uppercase tracking-wider items-center border-b border-slate-200/80 ${
                purchaseChannel === 'SELF' 
                  ? 'grid-cols-[36px_minmax(220px,1fr)_130px_150px_160px_130px_36px]' 
                  : 'grid-cols-[36px_minmax(220px,1fr)_140px_160px_140px_36px]'
              }`}>
                <div className="text-center">#</div>
                <div>รายการสินค้า / สเปก & ปลายทาง</div>
                <div className="text-right">ราคา/หน่วย (฿)</div>
                <div className="text-center">จำนวน & หน่วย</div>
                {purchaseChannel === 'SELF' && (
                  <div className="text-center">ส่วนลด (฿ / %)</div>
                )}
                <div className="text-right">รวมเงิน (฿)</div>
                <div className="text-center"></div>
              </div>

              {/* Rows List */}
              <div className="divide-y divide-slate-100">
                {prItems.map((item, idx) => {
                  const selProd = !item.isCustom ? (availableProducts.find(p => p.id === item.productId) || products.find(p => p.id === item.productId)) : null;
                  const itemGross = (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0);
                  const itemRowNet = Math.max(0, itemGross - (parseFloat(item.discountAmount) || 0));

                  return (
                    <div 
                      key={idx} 
                      className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors space-y-3"
                    >
                      {/* Primary Input Grid */}
                      <div className={`grid grid-cols-1 gap-3 items-center ${
                        purchaseChannel === 'SELF' 
                          ? 'md:grid-cols-[36px_minmax(220px,1fr)_130px_150px_160px_130px_36px]' 
                          : 'md:grid-cols-[36px_minmax(220px,1fr)_140px_160px_140px_36px]'
                      }`}>
                        
                        {/* Col 1: # Index */}
                        <div className="flex items-center justify-center">
                          <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 text-slate-600 font-mono font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                        </div>

                        {/* Col 2: Product Search / Custom Input */}
                        <div className="min-w-0">
                          {item.isCustom ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg border border-purple-200 shrink-0 font-mono">
                                {item.customCode || 'NON-CAT'}
                              </span>
                              <input
                                type="text"
                                value={item.customName || ''}
                                onChange={e => handleItemChange(idx, 'customName', e.target.value)}
                                placeholder="พิมพ์ชื่อสินค้า/สเปกที่ต้องการขอซื้อ (Non-Catalog)..."
                                className="w-full h-[40px] bg-white border border-slate-300 rounded-xl px-3.5 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all"
                                required
                              />
                            </div>
                          ) : (
                            <SearchableSelect
                              options={productOptions}
                              value={item.productId}
                              onChange={val => handleItemChange(idx, 'productId', val)}
                              placeholder="-- ค้นหาหรือเลือกสินค้า --"
                              searchPlaceholder={`ค้นหารหัส ชื่อสินค้า ในแผนก ${department}...`}
                              emptyMessage={`ไม่พบสินค้าของแผนก ${department}`}
                              required
                            />
                          )}
                        </div>

                        {/* Col 3: Unit Price */}
                        <div>
                          <div className="md:hidden text-xs font-semibold text-slate-500 mb-1">ราคาต่อหน่วย (฿)</div>
                          <div className="relative flex items-center rounded-xl bg-white border border-slate-300 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                            <span className="pl-3 pr-1 text-slate-400 text-xs font-bold font-mono pointer-events-none">฿</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={e => handleItemChange(idx, 'price', e.target.value)}
                              className="w-full h-[40px] pr-3 text-right font-mono font-bold text-xs sm:text-sm text-slate-900 outline-none bg-transparent tabular-nums"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Col 4: Quantity + Unit */}
                        <div>
                          <div className="md:hidden text-xs font-semibold text-slate-500 mb-1">จำนวนที่ขอซื้อ</div>
                          <div className="flex items-center rounded-xl bg-white border border-slate-300 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all overflow-hidden">
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              value={item.qty}
                              onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                              required
                              placeholder="1"
                              className="w-16 flex-1 h-[40px] px-3 text-center font-mono font-bold text-indigo-700 text-xs sm:text-sm outline-none bg-transparent tabular-nums"
                            />
                            {item.isCustom ? (
                              <input
                                type="text"
                                value={item.customUnit || 'ชิ้น'}
                                onChange={e => handleItemChange(idx, 'customUnit', e.target.value)}
                                placeholder="หน่วย"
                                className="h-[40px] w-16 px-2 bg-slate-50 border-l border-slate-200 text-xs font-semibold text-slate-700 text-center outline-none focus:bg-white shrink-0 transition-colors"
                              />
                            ) : (
                              <span 
                                className="h-[40px] px-3 flex items-center justify-center bg-slate-50 border-l border-slate-200 text-xs font-semibold text-slate-600 truncate max-w-[90px] shrink-0"
                                title={selProd?.purchaseUnit || selProd?.unit || 'หน่วย'}
                              >
                                {selProd?.purchaseUnit || selProd?.unit || 'หน่วย'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Col 5: Discount (for SELF channel) */}
                        {purchaseChannel === 'SELF' && (
                          <div>
                            <div className="md:hidden text-xs font-semibold text-slate-500 mb-1 text-right">ส่วนลด (฿ / %)</div>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 relative flex items-center rounded-xl bg-white border border-slate-300 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all min-w-[75px]">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.discountAmount || ''}
                                  onChange={e => handleItemChange(idx, 'discountAmount', e.target.value)}
                                  placeholder="0"
                                  className="w-full h-[40px] pl-2 pr-5 text-right font-mono text-xs font-bold text-rose-600 outline-none bg-transparent tabular-nums"
                                />
                                <span className="absolute right-2 text-slate-400 text-xs font-bold font-mono pointer-events-none">฿</span>
                              </div>
                              <div className="w-16 relative flex items-center rounded-xl bg-white border border-slate-300 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={item.discountPercent || ''}
                                  onChange={e => handleItemChange(idx, 'discountPercent', e.target.value)}
                                  placeholder="0"
                                  className="w-full h-[40px] pl-2 pr-4 text-center font-mono text-xs font-semibold text-slate-600 outline-none bg-transparent tabular-nums"
                                />
                                <span className="absolute right-1.5 text-slate-400 text-[10px] font-bold font-mono pointer-events-none">%</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Col 6: Line Total */}
                        <div>
                          <div className="md:hidden text-xs font-semibold text-slate-500 mb-1 text-right">รวมเงิน (Line Total)</div>
                          <div className="h-[40px] flex items-center justify-end px-3 bg-slate-50/90 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 text-xs sm:text-sm tabular-nums shadow-2xs">
                            ฿{itemRowNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        {/* Col 7: Delete Action */}
                        <div className="flex items-center justify-center h-[40px]">
                          {prItems.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all cursor-pointer"
                              title="ลบรายการนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="w-8"></span>
                          )}
                        </div>

                      </div>

                      {/* Sub-line: Destination Toggle & Metadata Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2.5 border-t border-slate-100 md:pl-11">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-slate-600">
                          
                          {/* Segmented Destination Toggle: Factory vs Office */}
                          <div className="inline-flex items-center p-0.5 rounded-full bg-slate-100 border border-slate-200/60 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleItemChange(idx, 'source', 'FACTORY')}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                item.source === 'FACTORY' || !item.source
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <Factory className="w-3.5 h-3.5 text-indigo-600" />
                              <span>โรงงาน</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleItemChange(idx, 'source', 'OFFICE')}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                item.source === 'OFFICE'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <Building className="w-3.5 h-3.5 text-indigo-600" />
                              <span>ออฟฟิศ</span>
                            </button>
                          </div>

                          {selProd ? (
                            <>
                              {/* Stock Balance Badge */}
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200/60 text-xs">
                                <span className="text-slate-400">คงเหลือ:</span>
                                <span className="font-bold font-mono text-slate-900 tabular-nums">{selProd.stockBalance || 0} {selProd.stockUnit || selProd.unit}</span>
                              </div>

                              {/* ROP Badge */}
                              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium border text-xs ${
                                (selProd.stockBalance <= selProd.reorderPoint)
                                  ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                                  : 'bg-slate-50 text-slate-600 border-slate-200/60'
                              }`}>
                                <span className="text-slate-400">ROP:</span>
                                <span className={`font-bold font-mono tabular-nums ${(selProd.stockBalance <= selProd.reorderPoint) ? 'text-amber-700' : 'text-slate-700'}`}>
                                  {selProd.reorderPoint} {selProd.stockUnit || selProd.unit}
                                </span>
                              </div>

                              {/* Effective Unit Conversion Calculation */}
                              {(() => {
                                const effectiveRate = (item.overrideUnit && Number(item.customRate) > 0)
                                  ? Number(item.customRate)
                                  : (Number(selProd.conversionRate) > 0 ? Number(selProd.conversionRate) : 1);
                                const effectiveStockUnit = (item.overrideUnit && item.customStockUnit?.trim())
                                  ? item.customStockUnit.trim()
                                  : (selProd.stockUnit || selProd.unit || 'ชิ้น');

                                if (effectiveRate > 1 || item.overrideUnit) {
                                  return (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-xs font-semibold">
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>
                                        เข้าคลัง: {(Number(item.qty || 0) * effectiveRate).toLocaleString()} {effectiveStockUnit}
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          ) : item.isCustom ? (
                            <span className="text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 text-xs">
                              <Sparkles className="w-3.5 h-3.5" />
                              สินค้านอกแคตตาล็อก
                            </span>
                          ) : null}
                        </div>

                        {/* Quick Action Toggles */}
                        <div className="flex items-center gap-2">
                          {selProd && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = !item.overrideUnit;
                                handleItemChange(idx, 'overrideUnit', next);
                                if (next && !item.customRate) {
                                  handleItemChange(idx, 'customRate', selProd.conversionRate || 1);
                                  handleItemChange(idx, 'customPurchaseUnit', selProd.purchaseUnit || selProd.unit);
                                  handleItemChange(idx, 'customStockUnit', selProd.stockUnit || selProd.unit);
                                }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all text-xs font-semibold cursor-pointer ${
                                item.overrideUnit
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                              }`}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span>{item.overrideUnit ? 'สเปคเฉพาะใบนี้ (เปิด)' : '⚙️ สเปคเฉพาะใบนี้'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleCustomItem(idx)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors text-xs font-semibold cursor-pointer"
                          >
                            {item.isCustom ? '← เลือกสินค้าจากระบบ' : '+ เพิ่มสินค้านอกแคตตาล็อก'}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Unit Mapping Override Panel */}
                      {selProd && item.overrideUnit && (
                        <div className="mt-2.5 md:ml-11 p-4 bg-slate-50/90 border border-slate-200 rounded-2xl animate-fade-in flex flex-col sm:flex-row sm:items-end gap-3 shadow-2xs">
                          <div className="flex-1">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">หน่วยขอซื้อ</label>
                            <input
                              type="text"
                              value={item.customPurchaseUnit || selProd.purchaseUnit || selProd.unit || ''}
                              onChange={e => handleItemChange(idx, 'customPurchaseUnit', e.target.value)}
                              placeholder="เช่น ถัง (50L)"
                              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                          </div>
                          
                          <div className="flex flex-col items-center justify-end pb-2 hidden sm:flex text-slate-400">
                            <span className="text-xs font-bold mb-1">=</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>

                          <div className="flex-1">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">อัตราแปลงเป็นสต็อก</label>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.customRate ?? selProd.conversionRate ?? 1}
                              onChange={e => handleItemChange(idx, 'customRate', e.target.value)}
                              placeholder="เช่น 50"
                              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-indigo-700 text-center outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all tabular-nums"
                            />
                          </div>

                          <div className="flex flex-col items-center justify-end pb-2 hidden sm:flex text-slate-400">
                            <span className="text-xs font-bold mb-1">×</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>

                          <div className="flex-1">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">หน่วยเข้าคลัง</label>
                            <input
                              type="text"
                              value={item.customStockUnit || selProd.stockUnit || selProd.unit || ''}
                              onChange={e => handleItemChange(idx, 'customStockUnit', e.target.value)}
                              placeholder="เช่น ลิตร"
                              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {/* Online Link Input (If Online Channel) */}
                      {purchaseChannel === 'ONLINE' && (
                        <div className="mt-2.5 md:ml-11 p-3 bg-purple-50/50 border border-purple-200 rounded-xl animate-fade-in flex items-center gap-2.5 shadow-2xs">
                          <Globe className="w-4 h-4 text-purple-600 shrink-0" />
                          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-[11px] font-bold text-purple-900 whitespace-nowrap">
                              ลิงก์สินค้า (Online Link) {!requiresMemo && <span className="text-rose-500">*</span>}
                            </span>
                            <input
                              type="url"
                              placeholder="https://shopee.co.th/... หรือ https://lazada.co.th/..."
                              value={item.onlineUrl || ''}
                              onChange={e => handleItemChange(idx, 'onlineUrl', e.target.value)}
                              className="flex-1 bg-white border border-purple-200 rounded-xl px-3.5 py-2 text-xs text-purple-950 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 shadow-2xs"
                            />
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

              {/* Table Footer: Add Row & Items Subtotal Summary Bar */}
              <div className="p-4 sm:p-6 bg-slate-50/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-slate-200/80">
                {/* Left: Outline Add Row Button */}
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500 active:scale-[0.99] font-semibold text-xs sm:text-sm rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ เพิ่มรายการสินค้า (+ Add Item)</span>
                </button>

                {/* Right: Items Subtotal */}
                <div className="flex flex-col items-end text-right">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs sm:text-sm font-semibold text-slate-600">
                      ยอดรวมสินค้า (Items Subtotal):
                    </span>
                    <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900">
                      ฿{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal mt-0.5">
                    {purchaseChannel === 'SELF' 
                      ? '(ยังไม่รวมส่วนลดท้ายบิล และภาษีมูลค่าเพิ่ม 7%)' 
                      : '(ยอดรวมประเมินเบื้องต้น)'}
                  </span>
                </div>
              </div>

            </div>

            {/* ── Financial Summary Card for SELF Purchase Channel ── */}
            {purchaseChannel === 'SELF' && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6 animate-fade-in">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900">
                        สรุปยอดเงิน ส่วนลด และภาษีมูลค่าเพิ่ม
                      </h4>
                      <p className="text-xs text-slate-500 font-normal mt-0.5">
                        กำหนดค่าส่วนลดท้ายบิล ภาษีมูลค่าเพิ่ม 7% และค่าจัดส่ง
                      </p>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full">
                    จัดซื้อเอง (Self-buy Mode)
                  </span>
                </div>

                {/* 2-Column Responsive Layout (60/40 Split: Settings & Summary) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Calculation Controls (7 cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    
                    {/* 1. Order Discount Card */}
                    <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3">
                      <label className="text-xs font-bold text-slate-800 block">
                        ส่วนลดรวมท้ายบิล (Order Discount)
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        {/* Segmented Control */}
                        <div className="inline-flex p-0.5 bg-slate-200/80 rounded-xl shrink-0 border border-slate-200/50">
                          <button
                            type="button"
                            onClick={() => setCombinedDiscountType('percent')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              combinedDiscountType === 'percent'
                                ? 'bg-white text-slate-900 shadow-xs font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            % เปอร์เซ็นต์
                          </button>
                          <button
                            type="button"
                            onClick={() => setCombinedDiscountType('fixed')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              combinedDiscountType === 'fixed'
                                ? 'bg-white text-slate-900 shadow-xs font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ฿ จำนวนบาท
                          </button>
                        </div>

                        {/* Input Field */}
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={combinedDiscountValue || ''}
                            onChange={e => setCombinedDiscountValue(e.target.value)}
                            placeholder={combinedDiscountType === 'percent' ? 'เช่น 5 (%)' : 'เช่น 500 (฿)'}
                            className="w-full h-[40px] bg-white border border-slate-300 rounded-xl px-3.5 pr-8 text-right font-mono font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all tabular-nums"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                            {combinedDiscountType === 'percent' ? '%' : '฿'}
                          </span>
                        </div>
                      </div>

                      {combinedDiscountAmount > 0 && (
                        <p className="text-xs text-slate-500 text-right pt-0.5">
                          คิดเป็นส่วนลดท้ายบิล: <strong className="font-bold text-rose-600 font-mono tabular-nums">-฿{combinedDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </p>
                      )}
                    </div>

                    {/* 2. VAT Calculation Method */}
                    <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3">
                      <label className="text-xs font-bold text-slate-800 block">
                        วิธีคิดภาษีมูลค่าเพิ่ม (VAT 7% Method)
                      </label>
                      <div className="space-y-2">
                        {/* Option A: After Discount */}
                        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none ${
                          vatMode === 'AFTER_DISCOUNT'
                            ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500/20 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50/80 text-slate-700'
                        }`}>
                          <input
                            type="radio"
                            name="vatMode"
                            value="AFTER_DISCOUNT"
                            checked={vatMode === 'AFTER_DISCOUNT'}
                            onChange={() => setVatMode('AFTER_DISCOUNT')}
                            className="mt-0.5 w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              1. หักส่วนลดก่อน แล้วค่อยคิด VAT 7% (วิธีมาตรฐาน)
                            </div>
                            <div className="text-xs font-normal text-slate-500 mt-0.5">
                              ฐานภาษี = (ยอดรวมสินค้า - ส่วนลด) × 7%
                            </div>
                          </div>
                        </label>

                        {/* Option B: Before Discount */}
                        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none ${
                          vatMode === 'BEFORE_DISCOUNT'
                            ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500/20 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50/80 text-slate-700'
                        }`}>
                          <input
                            type="radio"
                            name="vatMode"
                            value="BEFORE_DISCOUNT"
                            checked={vatMode === 'BEFORE_DISCOUNT'}
                            onChange={() => setVatMode('BEFORE_DISCOUNT')}
                            className="mt-0.5 w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              2. คิด VAT 7% ก่อน แล้วค่อยหักส่วนลดท้ายบิล
                            </div>
                            <div className="text-xs font-normal text-slate-500 mt-0.5">
                              ฐานภาษี = ยอดรวมสินค้า × 7% (แล้วนำส่วนลดไปลบท้ายสุด)
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* 3. Rounding Adjustment (+/-) */}
                    <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-800 block">
                          ปรับเศษทศนิยม (+/- ปรับให้ตรงใบกำกับภาษี)
                        </label>
                        <span className="text-xs text-slate-400">ใส่เครื่องหมาย + หรือ - เพื่อแก้เศษทศนิยม</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={roundingAdj || ''}
                        onChange={e => setRoundingAdj(e.target.value)}
                        placeholder="+0.00"
                        className="w-28 h-[40px] text-right font-mono font-bold text-xs sm:text-sm bg-white border border-slate-300 rounded-xl px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all tabular-nums"
                      />
                    </div>

                    {/* 4. Shipping Cost */}
                    <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-800 block">
                          ค่าจัดส่ง (Shipping Cost)
                        </label>
                        <span className="text-xs text-slate-400">ไม่นำไปคำนวณส่วนลดหรือ VAT 7%</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={shippingCost || ''}
                        onChange={e => setShippingCost(e.target.value)}
                        placeholder="0.00"
                        className="w-28 h-[40px] text-right font-mono font-bold text-xs sm:text-sm bg-white border border-slate-300 rounded-xl px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Right Column: Real-time Financial Summary Card (5 cols) */}
                  <div className="lg:col-span-5 bg-slate-50/90 border border-slate-200/90 rounded-3xl p-6 shadow-sm h-fit space-y-4">
                    {/* Summary Header */}
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/80">
                      <Receipt className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        สรุปรายการชำระเงิน (Payment Summary)
                      </span>
                    </div>

                    {/* Line Items Breakdown */}
                    <div className="space-y-2.5 text-xs sm:text-sm">
                      
                      {/* Subtotal */}
                      <div className="flex justify-between items-center text-slate-600">
                        <span>ยอดรวมสินค้าก่อนลด (Subtotal)</span>
                        <span className="font-mono font-semibold tabular-nums text-slate-900">
                          ฿{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Item Discounts */}
                      {itemDiscountTotal > 0 && (
                        <div className="flex justify-between items-center text-rose-600">
                          <span>ส่วนลดรายชิ้นรวม</span>
                          <span className="font-mono font-semibold tabular-nums">
                            -฿{itemDiscountTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {/* Order Discount */}
                      {combinedDiscountAmount > 0 && (
                        <div className="flex justify-between items-center text-rose-600">
                          <span>ส่วนลดท้ายบิล</span>
                          <span className="font-mono font-semibold tabular-nums">
                            -฿{combinedDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {/* Total Discount Summary (if any) */}
                      {totalDiscount > 0 && (
                        <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-slate-200/60 font-medium">
                          <span>รวมส่วนลดทั้งหมด</span>
                          <span className="font-mono font-bold tabular-nums text-rose-600">
                            -฿{totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {/* Taxable Base Amount */}
                      <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-200/60">
                        <span>มูลค่าก่อนคิดภาษี (Tax Base)</span>
                        <span className="font-mono font-medium tabular-nums text-slate-700">
                          ฿{(vatMode === 'BEFORE_DISCOUNT' ? subtotal : netAfterAllDiscount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* VAT 7% */}
                      <div className="flex justify-between items-center text-indigo-700">
                        <span className="font-medium">ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                        <span className="font-mono font-bold tabular-nums">
                          +฿{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Rounding Adjustment */}
                      {parseFloat(roundingAdj) !== 0 && (
                        <div className="flex justify-between items-center text-amber-700">
                          <span>ปรับเศษทศนิยม</span>
                          <span className="font-mono font-bold tabular-nums">
                            {parseFloat(roundingAdj) > 0 ? `+฿${parseFloat(roundingAdj).toFixed(2)}` : `-฿${Math.abs(parseFloat(roundingAdj)).toFixed(2)}`}
                          </span>
                        </div>
                      )}

                      {/* Shipping Cost */}
                      {parseFloat(shippingCost) > 0 && (
                        <div className="flex justify-between items-center text-slate-700">
                          <span className="font-medium">ค่าจัดส่ง (Shipping Cost)</span>
                          <span className="font-mono font-bold tabular-nums">
                            +฿{parseFloat(shippingCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Grand Total Highlight Box */}
                    <div className="mt-4 pt-4 border-t border-slate-200 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          ยอดรวมสุทธิ (Grand Total)
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          รวม VAT 7% แล้ว
                        </span>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-indigo-600 tracking-tight">
                          ฿{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 text-right font-medium">
                        ตรงตามใบกำกับภาษี / ใบเสร็จรับเงิน
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            )}

          </div>

          {/* ─────────────────────────────────────────────────────────────
             SECTION 3: เอกสารประกอบ & แนบไฟล์ (Attachments & Note)
             ───────────────────────────────────────────────────────────── */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-mono font-bold text-xs border border-indigo-100">
                3
              </span>
              <span>เอกสารประกอบและรายละเอียดเพิ่มเติม (Attachments & Note)</span>
            </div>
            
            {requiresMemo && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 flex items-start gap-3.5 text-amber-900 animate-fade-in shadow-2xs">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm">ระบบบังคับแนบ MEMO ขออนุมัติและเอกสารคู่ขนาน</h4>
                  <p className="text-xs sm:text-sm text-amber-800 leading-relaxed font-normal">
                    เนื่องจากยอดรวมขอซื้อตั้งแต่ <span className="font-bold font-mono">฿20,000</span> ขึ้นไป (ยอดปัจจุบัน: ฿{totalAmount.toLocaleString()}) ระบบจำเป็นต้องให้แนบไฟล์ใบเสนอราคา (Quotation), รูปภาพสินค้า และกรอกแบบฟอร์ม MEMO ด้านล่าง
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FileUploader
                  label="ใบเสนอราคา (Quotation)"
                  required={requiresMemo}
                  accept="application/pdf,image/*"
                  multiple={false}
                  files={quotationFiles}
                  setFiles={setQuotationFiles}
                  helperText="รองรับไฟล์ PDF หรือรูปภาพเอกสาร"
                />
              </div>

              <div>
                <FileUploader
                  label="รูปภาพประกอบสินค้า (Images)"
                  required={requiresMemo}
                  accept="image/*"
                  multiple={true}
                  files={imageFiles}
                  setFiles={setImageFiles}
                  helperText="สามารถแนบภาพตัวอย่างสินค้าได้หลายรูป"
                />
              </div>
            </div>

            {/* Note Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">หมายเหตุการขอซื้อ (PR Note)</label>
              <textarea
                rows="3"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ระบุเหตุผลในการขอซื้อเพิ่มเติม วัตถุประสงค์ หรือความเร่งด่วน..."
                className="w-full bg-white border border-slate-300 rounded-2xl p-3.5 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none shadow-2xs"
              />
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
             SECTION 4: ฟอร์ม MEMO ขออนุมัติ (เมื่อยอด ≥ 20,000)
             ───────────────────────────────────────────────────────────── */}
          {requiresMemo && (
            <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50 border-t border-slate-200/80 animate-fade-in">
              <div className="flex items-center gap-2.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-mono font-bold text-xs border border-amber-200">
                  4
                </span>
                <span>แบบฟอร์ม MEMO ขออนุมัติซื้อ (Request For Approval)</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">หัวข้อ / โครงการ (Subject) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={memoData.subject}
                    onChange={e => setMemoData({...memoData, subject: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                    placeholder="เช่น ขออนุมัติติดตั้งระบบหล่อลื่นและเปลี่ยนถ่ายน้ำมันไฮดรอลิก..."
                  />
                </div>
                
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">วัตถุประสงค์ (Purpose) <span className="text-rose-500">*</span></label>
                  <textarea
                    rows="2"
                    value={memoData.purpose}
                    onChange={e => setMemoData({...memoData, purpose: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3.5 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none shadow-2xs"
                    placeholder="ระบุวัตถุประสงค์ความจำเป็นในการจัดซื้อ..."
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">รายละเอียด / พื้นเพ (Background & Scope) <span className="text-rose-500">*</span></label>
                  <textarea
                    rows="2"
                    value={memoData.background}
                    onChange={e => setMemoData({...memoData, background: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3.5 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none shadow-2xs"
                    placeholder="ระบุที่มา ข้อมูลเครื่องจักร หรือผลการตรวจสอบคุณภาพ..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">ประเภทงบประมาณ (Classification)</label>
                  <select
                    value={memoData.classification}
                    onChange={e => setMemoData({...memoData, classification: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs cursor-pointer"
                  >
                    <option value="EXPENSE">Expense (ค่าใช้จ่ายดำเนินงาน)</option>
                    <option value="ASSET">Asset (ทรัพย์สินถาวร)</option>
                    <option value="OTHER">Other (อื่นๆ)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">เงื่อนไขการชำระเงิน (Payment Term)</label>
                  <input
                    type="text"
                    value={memoData.paymentTerm}
                    onChange={e => setMemoData({...memoData, paymentTerm: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                    placeholder="เช่น เครดิต 30 วัน, เงินสด"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
             FOOTER ACTIONS
             ───────────────────────────────────────────────────────────── */}
          <div className="p-6 sm:p-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleCancelAndBack}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 bg-white border border-slate-300 rounded-xl transition-all shadow-xs hover:shadow cursor-pointer"
            >
              ยกเลิก
            </button>
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={(e) => handleCreateSubmit(e, true)}
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all shadow-xs hover:shadow cursor-pointer"
              >
                {editingPR ? 'บันทึกแบบร่าง (Save Draft)' : 'บันทึกแบบร่าง (Draft)'}
              </button>
              <button
                type="button"
                onClick={(e) => handleCreateSubmit(e, false)}
                className="px-7 py-2.5 text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{editingPR ? 'บันทึกและส่งใบ PR ใหม่ (Resubmit)' : 'ส่งใบ PR เข้าสู่ระบบ'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
