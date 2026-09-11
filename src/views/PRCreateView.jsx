import React, { useState, useMemo, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { 
  ArrowLeft, AlertTriangle, Plus, Minus, Trash2, Building2, 
  Globe, Sparkles, CheckCircle2, ShoppingCart, 
  Factory, Building, Receipt, Loader2, Wallet
} from 'lucide-react';
import { MEMO_THRESHOLD, DEPARTMENTS } from '../config/constants';
import FileUploader from '../components/common/FileUploader';
import SearchableSelect from '../components/common/SearchableSelect';
import { modalService } from '../services/modalService';
import { sanitizeExternalUrl, getProductUrl } from '../utils/urlHelper';

export default function PRCreateView({ 
  products = [], 
  departments = [],
  currentRole, 
  onNavigate, 
  onRefresh, 
  preselectedProduct, 
  clearPreselectedProduct,
  editingPR,
  clearEditingPR,
  createPR,
  updatePR
}) {
  // Submission Guard to prevent duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Departments from context / master data
  const deptList = useMemo(() => {
    return (departments && departments.length > 0) ? departments : (DEPARTMENTS ? Object.values(DEPARTMENTS) : []);
  }, [departments]);

  const activeDepartments = useMemo(() => {
    return deptList.filter(d => d.isActive !== false);
  }, [deptList]);

  const deptMap = useMemo(() => {
    return deptList.reduce((acc, d) => {
      acc[d.code] = d;
      return acc;
    }, {});
  }, [deptList]);

  // Determine effective department (locked for dept-specific users, selectable for ALL)
  const defaultCode = activeDepartments[0]?.code || 'PD';
  const initialDept = editingPR 
    ? editingPR.department 
    : (currentRole?.department === 'ALL' 
        ? (preselectedProduct?.category || defaultCode) 
        : (currentRole?.department || defaultCode));

  const [department, setDepartment] = useState(initialDept);
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

  // Financial State for Order Adjustments
  const [combinedDiscountType, setCombinedDiscountType] = useState(editingPR?.financials?.combinedDiscountType || 'percent'); // 'percent' | 'fixed'
  const [combinedDiscountValue, setCombinedDiscountValue] = useState(editingPR?.financials?.combinedDiscountValue ?? 0);
  const [roundingAdj, setRoundingAdj] = useState(editingPR?.financials?.roundingAdj ?? 0);
  const [shippingCost, setShippingCost] = useState(editingPR?.financials?.shippingCost ?? 0);

  // VAT Toggle State: true = 7%, false = 0% (Directive 1)
  const [hasVat, setHasVat] = useState(() => {
    if (editingPR?.financials?.hasVat !== undefined) return Boolean(editingPR.financials.hasVat);
    if (editingPR?.financials?.vatMode === 'NONE') return false;
    return true;
  });

  // Toggle state for extra costs & adjustments (Directive 2: Hide shipping & rounding inputs by default)
  const [showExtraAdjustments, setShowExtraAdjustments] = useState(() => {
    return Boolean(
      (parseFloat(editingPR?.financials?.shippingCost) || 0) > 0 ||
      (parseFloat(editingPR?.financials?.roundingAdj) || 0) !== 0 ||
      (parseFloat(editingPR?.financials?.combinedDiscountValue) || 0) > 0
    );
  });

  // Find return/reject reason if this PR was returned
  const returnReason = useMemo(() => {
    if (!editingPR || !editingPR.activityLog) return null;
    const lastReject = [...editingPR.activityLog].reverse().find(l => 
      l.action?.includes('ส่งกลับ') || l.action?.includes('Reject') || l.action?.includes('ปฏิเสธ')
    );
    return lastReject?.note || null;
  }, [editingPR]);

  // Filter products by the active department (Exclude Deactivated/Inactive products)
  const availableProducts = useMemo(() => {
    return products
      .filter(p => {
        const isInactive = p.isActive === false || String(p.status || '').toUpperCase() === 'INACTIVE';
        if (isInactive) return false;
        return (p.category || p.department) === department;
      })
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [products, department]);

  // Transform available products into searchable options
  const productOptions = useMemo(() => {
    return availableProducts.map(p => {
      const pUnit = p.purchaseUnit || p.unit || 'ชิ้น';
      const sUnit = p.stockUnit || p.unit || 'ชิ้น';
      const pCat = p.category || p.department || 'PD';
      return {
        value: p.id,
        label: p.name,
        code: p.code,
        subLabel: `฿${Number(p.price || 0).toLocaleString()} / ${pUnit} • คงเหลือ: ${Number(p.stockBalance || 0).toLocaleString()} ${sUnit} • ROP: ${Number(p.reorderPoint || 0).toLocaleString()} ${sUnit}`,
        badge: deptMap[pCat]?.name || pCat,
        keywords: `${p.code} ${p.name} ${pUnit} ${sUnit} ${pCat}`
      };
    });
  }, [availableProducts, deptMap]);

  // Initial PR Items state
  const [prItems, setPrItems] = useState(() => {
    if (editingPR && editingPR.items && editingPR.items.length > 0) {
      return editingPR.items.map(it => ({
        productId: it.productId || it.code,
        qty: Number(it.purchaseQty ?? it.qty) || 1,
        price: parseFloat(it.price) || 0,
        discountPercent: parseFloat(it.discountPercent) || 0,
        discountAmount: parseFloat(it.discountAmount) || 0,
        onlineUrl: getProductUrl(it) || '',
        productUrl: getProductUrl(it) || '',
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
    const initialList = products.filter(p => {
      const isInactive = p.isActive === false || String(p.status || '').toUpperCase() === 'INACTIVE';
      return !isInactive && (p.category === initialDept || p.department === initialDept);
    });
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

  // ── Financial Calculations (Smart Standard VAT: (Subtotal - Discount) * 0.07) ──
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

  // Standard Automatic 7% VAT or 0% based on hasVat (Directive 1)
  const vatAmount = useMemo(() => {
    if (purchaseChannel !== 'SELF' || !hasVat) return 0;
    return parseFloat((netAfterAllDiscount * 0.07).toFixed(2));
  }, [purchaseChannel, hasVat, netAfterAllDiscount]);

  const grandTotal = useMemo(() => {
    if (purchaseChannel !== 'SELF') {
      return subtotal;
    }
    const safeRounding = parseFloat(roundingAdj) || 0;
    const safeShipping = parseFloat(shippingCost) || 0;
    return parseFloat((netAfterAllDiscount + vatAmount + safeRounding + safeShipping).toFixed(2));
  }, [purchaseChannel, subtotal, netAfterAllDiscount, vatAmount, roundingAdj, shippingCost]);

  // Dynamic Memo Requirement Directive 3: const requiresMemo = grandTotal >= 20000;
  const requiresMemo = grandTotal >= (MEMO_THRESHOLD || 20000);

  // Department Budget Usage Bar (Directive 1)
  const budgetInfo = useMemo(() => {
    try {
      const summary = apiService.calculateBudgetSummary();
      const deptData = summary?.current?.[department];
      if (!deptData) return null;
      const allocated = Number(deptData.baseAllocated ?? deptData.allocated) || 0;
      const actualSpent = Number(deptData.actualSpent ?? 0);
      const committed = Number(deptData.committed ?? 0);
      const spent = actualSpent + committed;
      const prAmount = grandTotal || 0;
      const projectedSpent = spent + prAmount;
      const currentPercent = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
      const projectedPercent = allocated > 0 ? Math.min(100, Math.round((projectedSpent / allocated) * 100)) : 0;
      const remaining = allocated - projectedSpent;
      const isOverBudget = projectedSpent > allocated;
      return {
        allocated,
        spent,
        prAmount,
        projectedSpent,
        currentPercent,
        projectedPercent,
        remaining,
        isOverBudget
      };
    } catch {
      return null;
    }
  }, [department, grandTotal]);

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

    // Keep productUrl and onlineUrl synchronized
    if (field === 'onlineUrl' || field === 'productUrl') {
      updated[index].onlineUrl = value;
      updated[index].productUrl = value;
    }
    
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

  // Quantity Stepper Handlers (Directive 4: [ - ] [ 1 ] [ + ])
  const handleDecrementQty = (index) => {
    const currentQty = parseFloat(prItems[index].qty) || 1;
    const nextQty = Math.max(1, currentQty - 1);
    handleItemChange(index, 'qty', nextQty);
  };

  const handleIncrementQty = (index) => {
    const currentQty = parseFloat(prItems[index].qty) || 0;
    handleItemChange(index, 'qty', currentQty + 1);
  };

  const handleCreateSubmit = async (e, isDraft) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

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

    setIsSubmitting(true);
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
            onlineUrl: sanitizeExternalUrl(item.productUrl || item.onlineUrl || ''),
            productUrl: sanitizeExternalUrl(item.productUrl || item.onlineUrl || ''),
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
          onlineUrl: sanitizeExternalUrl(item.productUrl || item.onlineUrl || ''),
          productUrl: sanitizeExternalUrl(item.productUrl || item.onlineUrl || ''),
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
          applicantName1: editingPR?.requestedBy || currentRole?.name || 'Staff',
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
          estimatedCost: grandTotal,
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
        hasVat,
        vatMode: hasVat ? 'AFTER_DISCOUNT' : 'NONE',
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
        hasVat: false,
        vatMode: 'NONE',
        vatAmount: 0,
        roundingAdj: 0,
        shippingCost: 0,
        grandTotal: subtotal
      };

      const prPayload = {
        department,
        purchaseChannel,
        hasVat: purchaseChannel === 'SELF' ? hasVat : false,
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
        if (updatePR) {
          await updatePR(editingPR.id, prPayload, isDraft);
        } else {
          await apiService.updatePR(editingPR.id, prPayload, currentRole, isDraft);
        }
        if (clearEditingPR) clearEditingPR();
        modalService.success(isDraft ? 'บันทึกแบบร่างเรียบร้อย' : 'แก้ไขและยื่นส่งใบขอซื้อ (PR) สำเร็จ');
      } else {
        if (createPR) {
          await createPR(prPayload, isDraft);
        } else {
          await apiService.createPR(prPayload, currentRole, isDraft);
        }
        if (clearPreselectedProduct) clearPreselectedProduct();
        modalService.success(isDraft ? 'บันทึกแบบร่างสำเร็จ' : 'สร้างและยื่นส่งใบขอซื้อ (PR) สำเร็จ');
      }

      if (onRefresh) await onRefresh();
      onNavigate('pr-list');
    } catch (err) {
      modalService.error(editingPR ? 'เกิดข้อผิดพลาดในการแก้ไข PR' : 'เกิดข้อผิดพลาดในการสร้าง PR', err.message);
    } finally {
      setIsSubmitting(false);
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
                {editingPR ? `แก้ไขใบขอซื้อ (${editingPR.prNo})` : 'สร้างใบขอซื้อใหม่ (New PR)'}
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
        <div className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm w-fit self-start sm:self-auto">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">สังกัดฝ่าย:</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            {deptMap[department]?.name ? `${deptMap[department].name} (${department})` : department}
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

      {/* ─────────────────────────────────────────────────────────────
         2-COLUMN GRID ARCHITECTURE (Directive 1)
         Left Column: lg:col-span-8 (Channel, Items, Compact Attachments, Conditional Memo)
         Right Column: lg:col-span-4 (Payment Summary, Budget Usage Bar, Sticky Actions)
         ───────────────────────────────────────────────────────────── */}
      <form onSubmit={e => e.preventDefault()} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ══════════════════════════════════════════════════════════════
           LEFT COLUMN: Main Work Area (lg:col-span-8)
           ══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Card 1: Channel & Department Info */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              {/* Department Selector */}
              <div className="space-y-1.5 flex-1 max-w-xs">
                <label className="text-xs font-bold text-slate-700 block">
                  ฝ่ายผู้ขอซื้อ (Department) <span className="text-rose-500">*</span>
                </label>
                {currentRole?.department !== 'ALL' ? (
                  <div className="w-full border border-slate-200/80 bg-slate-50/60 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center justify-between gap-2 text-slate-800">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{deptMap[department]?.name ? `${deptMap[department].name} (${department})` : department}</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-400">(ตามสิทธิ์)</span>
                  </div>
                ) : (
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    {activeDepartments.map(d => (
                      <option key={d.code} value={d.code}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Purchase Channel: Modern Segmented Pill Switcher (Directive 2) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  ช่องทางจัดซื้อ (Purchase Channel) <span className="text-rose-500">*</span>
                </label>
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/70 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPurchaseChannel('SELF')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      purchaseChannel === 'SELF'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Building2 className={`w-3.5 h-3.5 ${purchaseChannel === 'SELF' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>🏢 สั่งซื้อภายใน</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchaseChannel('ONLINE')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      purchaseChannel === 'ONLINE'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <ShoppingCart className={`w-3.5 h-3.5 ${purchaseChannel === 'ONLINE' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span>🛒 จัดซื้อออนไลน์</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Online Channel URL helper (if ONLINE is selected) */}
            {purchaseChannel === 'ONLINE' && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2.5 animate-fade-in">
                <Globe className="w-4 h-4 text-purple-600 shrink-0" />
                <input
                  type="url"
                  value={onlineLink}
                  onChange={e => setOnlineLink(e.target.value)}
                  placeholder="ลิงก์ร้านค้าหรือหน้าตะกร้าหลัก (Shopee / Lazada / เว็บไซต์ผู้จำหน่าย)..."
                  className="flex-1 bg-purple-50/30 border border-purple-200 rounded-xl px-3.5 py-2 text-xs text-purple-950 placeholder:text-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
              </div>
            )}
          </div>

          {/* Card 2: Minimalist Items Selection List (Directive 4) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  รายการสินค้าที่ขอซื้อ
                </h3>
                <span className="text-xs font-semibold text-slate-500 font-mono">
                  ({availableProducts.length} ในแผนก {department})
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                {prItems.length} รายการ
              </span>
            </div>

            {/* List of Minimalist Card Items */}
            <div className="space-y-3">
              {prItems.map((item, idx) => {
                const selProd = !item.isCustom ? (availableProducts.find(p => p.id === item.productId) || products.find(p => p.id === item.productId)) : null;
                const itemGross = (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0);
                const itemRowNet = Math.max(0, itemGross - (parseFloat(item.discountAmount) || 0));

                return (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-sm transition-all space-y-3.5"
                  >
                    {/* Primary Row: Index, Product / Custom, Unit Price, Stepper Qty, Total, Trash */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      
                      {/* Left: Index & Searchable Product / Custom Input */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          {item.isCustom ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-mono font-bold rounded-lg border border-purple-200 shrink-0">
                                {item.customCode || 'NON-CAT'}
                              </span>
                              <input
                                type="text"
                                value={item.customName || ''}
                                onChange={e => handleItemChange(idx, 'customName', e.target.value)}
                                placeholder="พิมพ์ชื่อสินค้า/สเปกที่ต้องการขอซื้อ (Non-Catalog)..."
                                className="w-full h-9.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl px-3 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                      </div>

                      {/* Right: Price, Stepper Qty, Unit, Line Total, Trash */}
                      <div className="flex items-center justify-between md:justify-end gap-2.5 flex-wrap sm:flex-nowrap pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        
                        {/* Unit Price */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400 font-mono">฿</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={e => handleItemChange(idx, 'price', e.target.value)}
                            placeholder="0.00"
                            className="w-20 sm:w-24 h-9 bg-slate-50/60 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-2.5 text-right font-mono font-semibold text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 tabular-nums transition-all"
                            title="ราคาต่อหน่วย"
                          />
                        </div>

                        {/* Stepper Qty Control: [ - ] [ 1 ] [ + ] (Directive 4) */}
                        <div className="inline-flex items-center rounded-xl border border-slate-200/90 bg-slate-50/60 p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleDecrementQty(idx)}
                            disabled={Number(item.qty) <= 1}
                            className="w-7 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                            title="ลดจำนวน"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={item.qty}
                            onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                            required
                            className="w-12 h-8 text-center font-mono font-bold text-xs sm:text-sm text-indigo-700 outline-none bg-transparent tabular-nums"
                            title="ระบุจำนวน"
                          />
                          <button
                            type="button"
                            onClick={() => handleIncrementQty(idx)}
                            className="w-7 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
                            title="เพิ่มจำนวน"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Unit Label */}
                        <div 
                          className="text-xs font-semibold text-slate-600 px-2.5 py-1 bg-slate-100 rounded-lg min-w-[44px] text-center shrink-0 truncate max-w-[85px]"
                          title={item.isCustom ? (item.customUnit || 'ชิ้น') : (selProd?.purchaseUnit || selProd?.unit || 'ชิ้น')}
                        >
                          {item.isCustom ? (
                            <input
                              type="text"
                              value={item.customUnit || 'ชิ้น'}
                              onChange={e => handleItemChange(idx, 'customUnit', e.target.value)}
                              className="w-10 bg-transparent text-center outline-none text-xs font-semibold text-slate-700"
                              placeholder="หน่วย"
                            />
                          ) : (
                            selProd?.purchaseUnit || selProd?.unit || 'ชิ้น'
                          )}
                        </div>

                        {/* Line Total */}
                        <div className="w-24 sm:w-28 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm tabular-nums shrink-0">
                          ฿{itemRowNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>

                        {/* Remove Row Button */}
                        {prItems.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="w-8 shrink-0"></span>
                        )}

                      </div>
                    </div>

                    {/* Sub-row: Destination pill switcher & Minimalist Subtle Stock Chips */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        
                        {/* Destination Pill Switcher */}
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleItemChange(idx, 'source', 'FACTORY')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                              item.source === 'FACTORY' || !item.source
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Factory className="w-3 h-3 text-indigo-600" />
                            <span>โรงงาน</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleItemChange(idx, 'source', 'OFFICE')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                              item.source === 'OFFICE'
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Building className="w-3 h-3 text-indigo-600" />
                            <span>ออฟฟิศ</span>
                          </button>
                        </div>

                        {/* Subtle Minimalist Stock Chips (Directive 4) */}
                        {selProd && (
                          <>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200/60">
                              <span className="text-slate-400">คงเหลือ:</span>
                              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                                {selProd.stockBalance || 0} {selProd.stockUnit || selProd.unit}
                              </span>
                            </span>

                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              (selProd.stockBalance <= selProd.reorderPoint)
                                ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                                : 'bg-slate-100 text-slate-600 border-slate-200/60'
                            }`}>
                              <span className="text-slate-400">ROP:</span>
                              <span className="font-mono font-semibold tabular-nums">
                                {selProd.reorderPoint || 0} {selProd.stockUnit || selProd.unit}
                              </span>
                            </span>

                            {(() => {
                              const effectiveRate = (item.overrideUnit && Number(item.customRate) > 0)
                                ? Number(item.customRate)
                                : (Number(selProd.conversionRate) > 0 ? Number(selProd.conversionRate) : 1);
                              const effectiveStockUnit = (item.overrideUnit && item.customStockUnit?.trim())
                                ? item.customStockUnit.trim()
                                : (selProd.stockUnit || selProd.unit || 'ชิ้น');

                              if (effectiveRate > 1 || item.overrideUnit) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium border border-indigo-200/70">
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    <span>เข้าคลัง: {(Number(item.qty || 0) * effectiveRate).toLocaleString()} {effectiveStockUnit}</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}

                        {item.isCustom && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-medium border border-purple-200">
                            <Sparkles className="w-3 h-3" />
                            สินค้านอกแคตตาล็อก
                          </span>
                        )}
                      </div>

                      {/* Customization & Non-catalog Toggles */}
                      <div className="flex items-center gap-2 ml-auto">
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
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                              item.overrideUnit ? 'bg-amber-100 text-amber-800' : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {item.overrideUnit ? 'สเปกเฉพาะใบนี้ (เปิด)' : '⚙️ สเปกเฉพาะ'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleCustomItem(idx)}
                          className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          {item.isCustom ? '← เลือกจากระบบ' : '+ นอกแคตตาล็อก'}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Unit Mapping Override Panel */}
                    {selProd && item.overrideUnit && (
                      <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-end gap-3 animate-fade-in">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">หน่วยขอซื้อ</label>
                          <input
                            type="text"
                            value={item.customPurchaseUnit || selProd.purchaseUnit || selProd.unit || ''}
                            onChange={e => handleItemChange(idx, 'customPurchaseUnit', e.target.value)}
                            placeholder="เช่น ถัง (50L)"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">อัตราแปลงเป็นสต็อก</label>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.customRate ?? selProd.conversionRate ?? 1}
                            onChange={e => handleItemChange(idx, 'customRate', e.target.value)}
                            placeholder="เช่น 50"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-700 text-center outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">หน่วยเข้าคลัง</label>
                          <input
                            type="text"
                            value={item.customStockUnit || selProd.stockUnit || selProd.unit || ''}
                            onChange={e => handleItemChange(idx, 'customStockUnit', e.target.value)}
                            placeholder="เช่น ลิตร"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Online Link for item (If channel is ONLINE) */}
                    {purchaseChannel === 'ONLINE' && (
                      <div className="p-2.5 bg-purple-50/40 border border-purple-200/80 rounded-xl flex items-center gap-2 animate-fade-in">
                        <Globe className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <input
                          type="url"
                          placeholder="ลิงก์สินค้าสำหรับรายการนี้ (Shopee / Lazada)..."
                          value={item.onlineUrl || ''}
                          onChange={e => handleItemChange(idx, 'onlineUrl', e.target.value)}
                          className="flex-1 bg-white border border-purple-200 rounded-lg px-2.5 py-1 text-xs text-purple-950 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Dashed Button for Adding Items (Full width, clean - Directive 4) */}
            <button
              type="button"
              onClick={handleAddItemRow}
              className="w-full py-3 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-600 hover:text-indigo-600 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs group"
            >
              <Plus className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span>+ เพิ่มรายการสินค้า</span>
            </button>
          </div>

          {/* Card 3: Compact Attachments & PR Note (Directive 2: max height <= 70px) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                เอกสารประกอบและหมายเหตุ (Attachments & Note)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                แนบใบเสนอราคาหรือรูปภาพสินค้าประกอบการจัดซื้อ
              </p>
            </div>

            {/* Compact File Uploaders (height <= 70px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FileUploader
                label="ใบเสนอราคา (Quotation)"
                required={requiresMemo}
                accept="application/pdf,image/*"
                multiple={false}
                files={quotationFiles}
                setFiles={setQuotationFiles}
                compact={true}
                helperText="คลิกหรือลากไฟล์ PDF/รูปภาพ"
              />

              <FileUploader
                label="รูปภาพสินค้า (Images)"
                required={requiresMemo}
                accept="image/*"
                multiple={true}
                files={imageFiles}
                setFiles={setImageFiles}
                compact={true}
                helperText="แนบรูปภาพตัวอย่างสินค้า"
              />
            </div>

            {/* PR Note Textarea */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-slate-700 block">
                หมายเหตุการขอซื้อ (PR Note)
              </label>
              <textarea
                rows="2"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ระบุเหตุผลในการขอซื้อเพิ่มเติม วัตถุประสงค์ หรือความเร่งด่วน..."
                className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl p-3 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
              />
            </div>
          </div>

          {/* Card 4: Conditional Memo Section (Rule: grandTotal >= 20,000) (Directive 3) */}
          {requiresMemo && (
            <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 animate-fade-in">
              
              {/* Amber Tint Alert Header (Directive 3) */}
              <div className="flex items-start gap-3 text-amber-900 pb-2 border-b border-amber-200/60">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-sm text-amber-950">
                    ⚠️ ยอดสั่งซื้อตั้งแต่ ฿20,000 ขึ้นไป ต้องระบุรายละเอียด Memo แนบเพื่อเสนอผู้จัดการโรงงาน
                  </h4>
                  <p className="text-xs text-amber-800 font-normal">
                    ยอดคำนวณสุทธิของใบขอซื้อนี้คือ <strong className="font-mono font-bold">฿{grandTotal.toLocaleString()}</strong> ซึ่งเข้าเกณฑ์ต้องกรอกข้อมูลและแนบเอกสารเพื่อเสนอขออนุมัติ
                  </p>
                </div>
              </div>

              {/* Memo Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    หัวข้อ / โครงการ (Subject) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={memoData.subject}
                    onChange={e => setMemoData({...memoData, subject: e.target.value})}
                    placeholder="เช่น ขออนุมัติติดตั้งระบบหล่อลื่นและเปลี่ยนถ่ายน้ำมันไฮดรอลิก..."
                    className="w-full bg-white border border-amber-200/90 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    วัตถุประสงค์ (Purpose) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows="2"
                    value={memoData.purpose}
                    onChange={e => setMemoData({...memoData, purpose: e.target.value})}
                    placeholder="ระบุวัตถุประสงค์และความจำเป็นในการจัดซื้อครั้งนี้..."
                    className="w-full bg-white border border-amber-200/90 focus:border-indigo-500 rounded-xl p-3 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    รายละเอียด / พื้นเพความจำเป็น (Background & Scope) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows="2"
                    value={memoData.background}
                    onChange={e => setMemoData({...memoData, background: e.target.value})}
                    placeholder="ระบุที่มา ข้อมูลเครื่องจักร หรือผลการตรวจสอบคุณภาพ..."
                    className="w-full bg-white border border-amber-200/90 focus:border-indigo-500 rounded-xl p-3 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    ประเภทงบประมาณ (Classification)
                  </label>
                  <select
                    value={memoData.classification}
                    onChange={e => setMemoData({...memoData, classification: e.target.value})}
                    className="w-full bg-white border border-amber-200/90 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                  >
                    <option value="EXPENSE">Expense (ค่าใช้จ่ายดำเนินงาน)</option>
                    <option value="ASSET">Asset (ทรัพย์สินถาวร)</option>
                    <option value="OTHER">Other (อื่นๆ)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    เงื่อนไขการชำระเงิน (Payment Term)
                  </label>
                  <input
                    type="text"
                    value={memoData.paymentTerm}
                    onChange={e => setMemoData({...memoData, paymentTerm: e.target.value})}
                    placeholder="เช่น เครดิต 30 วัน, เงินสด"
                    className="w-full bg-white border border-amber-200/90 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ══════════════════════════════════════════════════════════════
           RIGHT COLUMN: Sticky Sidebar (lg:col-span-4)
           Contains: Payment Summary, Department Budget Usage Bar, Actions
           ══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-5">
          
          {/* Box 1: Payment Summary Card (Directive 1 & 2) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold">สรุปรายการชำระเงิน</h3>
              </div>
              {purchaseChannel === 'SELF' ? (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setHasVat(true)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      hasVat ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    มี VAT 7%
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasVat(false)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      !hasVat ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    ไม่มี VAT (0%)
                  </button>
                </div>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-mono">
                  จัดซื้อออนไลน์
                </span>
              )}
            </div>

            {/* Financial Breakdown Items */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>ยอดรวมสินค้า (Subtotal)</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  ฿{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {itemDiscountTotal > 0 && (
                <div className="flex justify-between items-center text-rose-600">
                  <span>ส่วนลดรายชิ้น</span>
                  <span className="font-mono font-semibold tabular-nums">
                    -฿{itemDiscountTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {combinedDiscountAmount > 0 && (
                <div className="flex justify-between items-center text-rose-600">
                  <span>ส่วนลดท้ายบิล</span>
                  <span className="font-mono font-semibold tabular-nums">
                    -฿{combinedDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* VAT Row (Directive 3) */}
              {purchaseChannel === 'SELF' && (
                <div className={`flex justify-between items-center pt-1 border-t border-slate-100 ${
                  hasVat ? 'text-indigo-700' : 'text-slate-400'
                }`}>
                  <span className="font-medium">
                    ภาษีมูลค่าเพิ่ม {hasVat ? '(VAT 7%)' : '(0%)'}
                  </span>
                  <span className="font-mono font-bold tabular-nums">
                    {hasVat 
                      ? `+฿${vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : '฿0.00'}
                  </span>
                </div>
              )}

              {/* Extra Costs: Shipping & Rounding (if set) */}
              {parseFloat(shippingCost) > 0 && (
                <div className="flex justify-between items-center text-slate-700">
                  <span>ค่าจัดส่ง</span>
                  <span className="font-mono font-semibold tabular-nums">
                    +฿{parseFloat(shippingCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {parseFloat(roundingAdj) !== 0 && (
                <div className="flex justify-between items-center text-amber-700">
                  <span>ปรับเศษทศนิยม</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {parseFloat(roundingAdj) > 0 ? `+฿${parseFloat(roundingAdj).toFixed(2)}` : `-฿${Math.abs(parseFloat(roundingAdj)).toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>

            {/* Clutter-Free Toggler for Shipping & Rounding & Order Discount (Directive 2) */}
            {purchaseChannel === 'SELF' && (
              <div className="pt-2 border-t border-slate-100">
                {!showExtraAdjustments ? (
                  <button
                    type="button"
                    onClick={() => setShowExtraAdjustments(true)}
                    className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl border border-dashed border-slate-200 hover:border-indigo-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ เพิ่มค่าส่ง / ส่วนลดท้ายบิล</span>
                  </button>
                ) : (
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        ส่วนลดท้ายบิล & ค่าจัดส่ง
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowExtraAdjustments(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        ซ่อน
                      </button>
                    </div>

                    {/* Order Discount Input */}
                    <div className="flex items-center gap-1.5">
                      <div className="inline-flex p-0.5 bg-slate-200 rounded-lg text-[10px] shrink-0 font-semibold">
                        <button
                          type="button"
                          onClick={() => setCombinedDiscountType('percent')}
                          className={`px-1.5 py-0.5 rounded ${combinedDiscountType === 'percent' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setCombinedDiscountType('fixed')}
                          className={`px-1.5 py-0.5 rounded ${combinedDiscountType === 'fixed' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                        >
                          ฿
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={combinedDiscountValue || ''}
                        onChange={e => setCombinedDiscountValue(e.target.value)}
                        placeholder="ส่วนลดท้ายบิล"
                        className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-right font-mono text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Shipping Cost Input */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">ค่าจัดส่ง (฿)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={shippingCost || ''}
                        onChange={e => setShippingCost(e.target.value)}
                        placeholder="0.00"
                        className="w-24 h-8 bg-white border border-slate-300 rounded-lg px-2 text-right font-mono text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Rounding Adjustment Input */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">ปรับเศษสตางค์ (฿)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={roundingAdj || ''}
                        onChange={e => setRoundingAdj(e.target.value)}
                        placeholder="+/-0.00"
                        className="w-24 h-8 bg-white border border-slate-300 rounded-lg px-2 text-right font-mono text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Grand Total Display Box */}
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">ยอดรวมสุทธิ (Grand Total)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  purchaseChannel === 'SELF'
                    ? (hasVat 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border-slate-200')
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}>
                  {purchaseChannel === 'SELF'
                    ? (hasVat ? 'รวม VAT 7% แล้ว' : 'ไม่มี VAT')
                    : 'สุทธิ (ออนไลน์)'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black font-mono text-indigo-600 tracking-tight tabular-nums">
                  ฿{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Box 2: Department Budget Usage Bar (Directive 1) */}
          {budgetInfo && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    งบประมาณแผนก ({department})
                  </h4>
                </div>
                <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-full ${
                  budgetInfo.isOverBudget 
                    ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                }`}>
                  {budgetInfo.projectedPercent}%
                </span>
              </div>

              {/* Multi-tier Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                <div 
                  className="bg-slate-400 transition-all duration-500"
                  style={{ width: `${budgetInfo.currentPercent}%` }}
                  title={`ใช้ไปแล้ว: ฿${budgetInfo.spent.toLocaleString()}`}
                />
                <div 
                  className={`transition-all duration-500 ${budgetInfo.isOverBudget ? 'bg-rose-500' : 'bg-indigo-600'}`}
                  style={{ width: `${Math.max(0, budgetInfo.projectedPercent - budgetInfo.currentPercent)}%` }}
                  title={`PR ใบนี้: +฿${budgetInfo.prAmount.toLocaleString()}`}
                />
              </div>

              {/* Budget Metrics Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-500">
                  <span>งบที่ได้รับจัดสรร</span>
                  <span className="font-mono font-medium text-slate-800">
                    ฿{budgetInfo.allocated.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>ใช้ไปแล้ว (Actual + Commit)</span>
                  <span className="font-mono font-medium text-slate-800">
                    ฿{budgetInfo.spent.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-indigo-600 font-semibold">
                  <span>ใบนี้เพิ่ม (This PR)</span>
                  <span className="font-mono tabular-nums">
                    +฿{budgetInfo.prAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                  <span className={`font-semibold ${budgetInfo.isOverBudget ? 'text-rose-600' : 'text-slate-700'}`}>
                    {budgetInfo.isOverBudget ? 'เกินงบประมาณ' : 'งบประมาณคงเหลือ'}
                  </span>
                  <span className={`font-mono font-bold tabular-nums ${budgetInfo.isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {budgetInfo.isOverBudget ? '-' : ''}฿{Math.abs(budgetInfo.remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Box 3: Main Action Buttons (Directive 1 & 5) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2.5">
            {/* Primary Submit Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={(e) => handleCreateSubmit(e, false)}
              className={`w-full py-3 rounded-xl font-semibold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>
                {isSubmitting 
                  ? 'กำลังประมวลผล...' 
                  : (editingPR ? 'บันทึกและส่งใบ PR ใหม่ (Resubmit)' : 'ส่งใบ PR เข้าสู่ระบบ')}
              </span>
            </button>

            {/* Save Draft Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={(e) => handleCreateSubmit(e, true)}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
                isSubmitting ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              {editingPR ? 'บันทึกแบบร่าง (Save Draft)' : 'บันทึกแบบร่าง (Draft)'}
            </button>

            {/* Cancel / Back Link */}
            <button
              type="button"
              onClick={handleCancelAndBack}
              className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors text-center cursor-pointer"
            >
              ยกเลิกและย้อนกลับ
            </button>
          </div>

        </div>

      </form>
    </div>
  );
}
