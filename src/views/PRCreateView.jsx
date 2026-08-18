import React, { useState, useMemo, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { 
  FileText, ArrowLeft, Info, AlertTriangle, FileSignature, 
  Plus, Trash2, Building2, Calendar, ShoppingBag, Globe, 
  Sparkles, CheckCircle2, ShoppingCart, SlidersHorizontal, Repeat, ArrowRight 
} from 'lucide-react';
import { PR_SOURCE, PURCHASE_CHANNEL, MEMO_THRESHOLD, DEPARTMENTS } from '../config/constants';
import FileUploader from '../components/common/FileUploader';
import SearchableSelect from '../components/common/SearchableSelect';
import { modalService } from '../services/modalService';

export default function PRCreateView({ products = [], currentRole, onNavigate, onRefresh, preselectedProduct, clearPreselectedProduct }) {
  // Determine effective department (locked for PD/QC users, selectable for ALL)
  const initialDept = currentRole.department === 'ALL' 
    ? (preselectedProduct?.category || 'PD') 
    : currentRole.department;

  const [department, setDepartment] = useState(initialDept);
  const [source, setSource] = useState('FACTORY');
  const [purchaseChannel, setPurchaseChannel] = useState('SELF');
  const [requiredDate, setRequiredDate] = useState('');
  
  // File attachments
  const [onlineLink, setOnlineLink] = useState('');
  const [quotationFiles, setQuotationFiles] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  
  const [note, setNote] = useState('');

  // Filter products by the active department
  const availableProducts = useMemo(() => {
    return products.filter(p => p.category === department);
  }, [products, department]);

  // Transform available products into searchable options
  const productOptions = useMemo(() => {
    return availableProducts.map(p => {
      const pUnit = p.purchaseUnit || p.unit || 'ชิ้น';
      const sUnit = p.stockUnit || p.unit || 'ชิ้น';
      const rate = Number(p.conversionRate) > 0 ? Number(p.conversionRate) : 1;
      const unitText = rate > 1 ? `${pUnit} (1:${rate} ${sUnit})` : pUnit;
      return {
        value: p.id,
        label: p.name,
        code: p.code,
        subLabel: `฿${p.price?.toLocaleString()} / ${pUnit} • คงเหลือ: ${p.stockBalance || 0} ${sUnit} • ROP: ${p.reorderPoint} ${sUnit}`,
        badge: p.category === 'PD' ? 'ฝ่ายผลิต' : 'ฝ่าย QC',
        keywords: `${p.code} ${p.name} ${p.location} ${pUnit} ${sUnit}`
      };
    });
  }, [availableProducts]);

  // Initial PR Items state
  const [prItems, setPrItems] = useState(() => {
    if (preselectedProduct && preselectedProduct.category === initialDept) {
      return [{ 
        productId: preselectedProduct.id, 
        qty: Math.max(1, (preselectedProduct.reorderPoint || 5) * 2), 
        price: preselectedProduct.price || 0 
      }];
    }
    const initialList = products.filter(p => p.category === initialDept);
    return [{ 
      productId: initialList[0]?.id || '', 
      qty: 1, 
      price: initialList[0]?.price || 0 
    }];
  });

  // When department changes, sync prItems so all items belong to new department
  useEffect(() => {
    if (availableProducts.length > 0) {
      setPrItems(prevItems => {
        const needsReset = prevItems.some(item => !availableProducts.some(p => p.id === item.productId));
        if (needsReset) {
          return [{
            productId: availableProducts[0].id,
            qty: 1,
            price: availableProducts[0].price || 0
          }];
        }
        return prevItems;
      });
    }
  }, [department, availableProducts]);

  // Memo Fields
  const [memoData, setMemoData] = useState({
    subject: '',
    purpose: '',
    background: '',
    paymentTerm: 'เครดิต 30 วัน',
    classification: 'EXPENSE',
    remarkAttachedFile: ''
  });

  const totalAmount = useMemo(() => {
    return prItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
  }, [prItems]);

  const requiresMemo = totalAmount >= MEMO_THRESHOLD;
  const isOnline = purchaseChannel === 'ONLINE';

  const handleAddItemRow = () => {
    const defaultProd = availableProducts[0];
    setPrItems(prev => [
      ...prev, 
      { productId: defaultProd?.id || '', qty: 1, price: defaultProd?.price || 0, isCustom: false }
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
        price: current.price || 0,
        qty: current.qty || 1
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
        price: defaultProd?.price || 0,
        qty: current.qty || 1
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
        updated[index].price = prod.price || 0;
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

      if (isOnline && !requiresMemo && !onlineLink.trim()) {
        return modalService.warning('กรุณาระบุ Online Link (Shopee/Lazada) สำหรับการสั่งซื้อออนไลน์');
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
        if (item.isCustom) {
          const pQty = Number(item.qty) || 1;
          const price = Number(item.price) || 0;
          const unit = item.customUnit?.trim() || 'ชิ้น';
          const code = item.customCode || `TEMP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
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
            total: price * pQty,
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
        const price = Number(item.price) || 0;
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
          total: price * pQty,
          isCustom: false,
          isUnitOverridden: Boolean(item.overrideUnit && Number(item.customRate) > 0)
        };
      });

      // Construct Memo if required
      let finalMemo = null;
      if (requiresMemo) {
        finalMemo = {
          applicantDept: department,
          applicantName1: currentRole.name,
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

      await apiService.createPR({
        department,
        source,
        purchaseChannel,
        requiredDate: requiredDate || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
        specUrl: onlineLink || (quotationFiles[0] ? quotationFiles[0].name : ''),
        attachments: [
          ...quotationFiles.map(f => ({ name: f.name, size: f.size, type: f.type || 'application/pdf', previewUrl: f.previewUrl, category: 'QUOTATION' })),
          ...imageFiles.map(f => ({ name: f.name, size: f.size, type: f.type || 'image/jpeg', previewUrl: f.previewUrl, category: 'IMAGE' }))
        ],
        note,
        items: itemsFormatted,
        memo: finalMemo
      }, currentRole, isDraft);

      if (clearPreselectedProduct) clearPreselectedProduct();
      onRefresh();
      onNavigate('pr-list');
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการสร้าง PR', err.message);
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in-up pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button 
            type="button"
            onClick={() => {
              if (clearPreselectedProduct) clearPreselectedProduct();
              onNavigate('pr-list');
            }}
            className="p-2.5 hover:bg-slate-200 bg-white border border-slate-200 rounded-2xl transition-all text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer"
            title="ย้อนกลับไปรายการ PR"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-indigo-600" />
              สร้างใบขอซื้อใหม่ (Create Purchase Requisition)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              เปิดคำขอสั่งซื้อสินค้าตามสเปกและโควต้าแผนก <span className="font-bold text-indigo-600">[{department}]</span>
            </p>
          </div>
        </div>

        {/* Department Scope Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-2xl border border-slate-200 shadow-xs w-fit">
          <Building2 className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500 font-semibold">แผนกผู้ขอซื้อ:</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
            department === 'PD' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {department === 'PD' ? 'ฝ่ายผลิต (Production - PD)' : 'ฝ่ายควบคุมคุณภาพ (QC/Lab)'}
          </span>
        </div>
      </div>

      {/* ── Main Form Container ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <form className="divide-y divide-slate-200/80">
          
          {/* ── SECTION 1: ข้อมูลเบื้องต้น ── */}
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>1. ข้อมูลเบื้องต้น (General Info)</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Department Selector */}
              <div>
                <label className="impeccable-label">
                  ฝ่ายผู้ขอซื้อ (Department) <span className="text-rose-500">*</span>
                </label>
                {currentRole.department !== 'ALL' ? (
                  <div className={`w-full border rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 ${
                    department === 'PD' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>{department === 'PD' ? 'ฝ่ายผลิต (PD - Production)' : 'ฝ่ายควบคุมคุณภาพ (QC - Lab)'}</span>
                    <span className="text-xs font-normal text-slate-500 ml-auto">(ตามสิทธิ์ของคุณ)</span>
                  </div>
                ) : (
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="impeccable-input font-bold text-indigo-950"
                  >
                    <option value="PD">ฝ่ายผลิต (PD - Production)</option>
                    <option value="QC">ฝ่ายควบคุมคุณภาพ (QC - Quality Control)</option>
                  </select>
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  * รายการสินค้าในช่องเลือกด้านล่างจะแสดงเฉพาะสินค้าของแผนกนี้
                </p>
              </div>

              {/* Required Date */}
              <div>
                <label className="impeccable-label">
                  วันที่ต้องการสินค้า (Required Date) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={requiredDate}
                    onChange={e => setRequiredDate(e.target.value)}
                    className="impeccable-input font-medium"
                  />
                </div>
              </div>

              {/* Source / Usage Type */}
              <div>
                <label className="impeccable-label">ประเภทการใช้งาน (Source)</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {Object.values(PR_SOURCE).map(src => {
                    const isChecked = source === src.id;
                    return (
                      <label 
                        key={src.id} 
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold shadow-xs' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 font-medium'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="source" 
                          value={src.id} 
                          checked={isChecked} 
                          onChange={() => setSource(src.id)} 
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
                        />
                        <span className="text-xs">{src.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Purchase Channel */}
              <div>
                <label className="impeccable-label">ช่องทางจัดซื้อ (Purchase Channel)</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {Object.values(PURCHASE_CHANNEL).map(ch => {
                    const isChecked = purchaseChannel === ch.id;
                    return (
                      <label 
                        key={ch.id} 
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold shadow-xs' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 font-medium'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="purchaseChannel" 
                          value={ch.id} 
                          checked={isChecked} 
                          onChange={() => setPurchaseChannel(ch.id)} 
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
                        />
                        <span className="text-xs flex items-center gap-1.5">
                          {ch.id === 'ONLINE' ? (
                            <ShoppingCart className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <span>{ch.label}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 2: รายการสินค้า (Line Items Table with Pure Horizontal Baseline Alignment) ── */}
          <div className="p-6 md:p-8 space-y-5 bg-slate-50/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  <span>2. รายการสินค้าที่ขอซื้อ (Items Selection)</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  เลือกสินค้าเฉพาะแผนก <span className="font-bold text-indigo-600">[{department}]</span> (มีทั้งหมด {availableProducts.length} รายการ)
                </p>
              </div>

              {/* Total Summary Header Pill */}
              <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-md self-start sm:self-auto">
                <span className="text-xs text-indigo-200 font-medium uppercase">ยอดรวมประเมิน:</span>
                <span className="text-lg font-black text-amber-300 font-mono">฿{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Table / List Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              
              {/* Desktop Column Header */}
              <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-white text-[11px] font-bold text-slate-500 uppercase tracking-wider items-center border-b border-slate-100 shadow-xs">
                <div className="col-span-5 flex items-center gap-2">
                  <span className="w-7 text-center">#</span>
                  <span>รายการสินค้า / สเปก (Item Name & Code)</span>
                </div>
                <div className="col-span-2 text-right">
                  <span>ราคา/หน่วย (฿)</span>
                </div>
                <div className="col-span-2 text-center">
                  <span>จำนวนขอซื้อ</span>
                </div>
                <div className="col-span-2 text-right">
                  <span>รวมเงิน (฿)</span>
                </div>
                <div className="col-span-1 text-center">
                  <span>ลบ</span>
                </div>
              </div>

              {/* Item Rows */}
              {prItems.map((item, idx) => {
                const selProd = !item.isCustom ? (availableProducts.find(p => p.id === item.productId) || products.find(p => p.id === item.productId)) : null;
                return (
                  <div 
                    key={idx} 
                    className="p-4 sm:p-5 md:py-3 md:px-5 hover:bg-slate-50/50 transition-colors space-y-2 border-b border-slate-50 last:border-0"
                  >
                    {/* Primary Input Row: 100% Identical 44px Height & Baseline Alignment */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      
                      {/* Col 1: # Index + Product Selector or Custom Free-text Input (h-[44px]) */}
                      <div className="md:col-span-5 flex items-center gap-2">
                        <span className="w-7 h-[44px] rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          {item.isCustom ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[11px] font-bold rounded-lg border border-purple-200 shrink-0 font-mono">
                                {item.customCode || 'TEMP'}
                              </span>
                              <input
                                type="text"
                                value={item.customName || ''}
                                onChange={e => handleItemChange(idx, 'customName', e.target.value)}
                                placeholder="พิมพ์ชื่อสินค้า/สเปกที่ต้องการขอซื้อ (Non-Catalog)..."
                                className="impeccable-input h-[44px] text-xs font-semibold text-slate-800"
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

                      {/* Col 2: Price/Unit (h-[44px]) */}
                      <div className="md:col-span-2">
                        <div className="md:hidden text-xs font-semibold text-slate-500 mb-1">ราคาประเมิน/หน่วย (฿)</div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">฿</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={e => handleItemChange(idx, 'price', e.target.value)}
                            className="impeccable-input h-[44px] pl-7 text-right font-mono font-bold text-slate-900"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Col 3: Quantity + Unit Badge / Custom Unit Input (h-[44px]) */}
                      <div className="md:col-span-2">
                        <div className="md:hidden text-xs font-semibold text-slate-500 mb-1">
                          จำนวนที่ขอซื้อ ({item.isCustom ? (item.customUnit || 'หน่วย') : (selProd?.purchaseUnit || 'หน่วยซื้อ')})
                        </div>
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={item.qty}
                            onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                            required
                            placeholder="1"
                            className="impeccable-input h-[44px] rounded-r-none text-center font-mono font-bold text-indigo-700 text-sm border-r-0"
                          />
                          {item.isCustom ? (
                            <input
                              type="text"
                              value={item.customUnit || 'ชิ้น'}
                              onChange={e => handleItemChange(idx, 'customUnit', e.target.value)}
                              placeholder="หน่วย"
                              className="h-[44px] w-20 px-2 bg-slate-100 border border-slate-300 rounded-r-xl text-xs font-semibold text-slate-700 text-center outline-none focus:bg-white shrink-0"
                            />
                          ) : (
                            <span 
                              className="h-[44px] px-2.5 flex items-center justify-center bg-slate-100 border border-slate-300 rounded-r-xl text-xs font-semibold text-slate-600 truncate min-w-[65px] max-w-[90px] shrink-0"
                              title={selProd?.purchaseUnit || selProd?.unit || 'หน่วย'}
                            >
                              {selProd?.purchaseUnit || selProd?.unit || 'หน่วย'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Col 4: Subtotal (h-[44px]) */}
                      <div className="md:col-span-2">
                        <div className="md:hidden text-xs font-semibold text-slate-500 mb-1 text-right">รวมเงิน</div>
                        <div className="h-[44px] flex items-center justify-end px-3 bg-indigo-50/70 rounded-xl border border-indigo-100 font-mono font-black text-indigo-900 text-sm shadow-xs">
                          ฿{((Number(item.price) || 0) * (Number(item.qty) || 0)).toLocaleString()}
                        </div>
                      </div>

                      {/* Col 5: Delete Action (h-[44px]) */}
                      <div className="md:col-span-1 flex items-center justify-center h-[44px]">
                        {prItems.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="w-8"></span>
                        )}
                      </div>

                    </div>

                    {/* Secondary Info Bar & Unit Conversion Hint / Custom Item Mode Switch */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] pl-9 pt-1.5 pb-0.5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 font-medium">
                        {selProd ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">สต็อก:</span>
                              <span className="font-bold text-slate-700">{selProd.stockBalance || 0} {selProd.stockUnit || selProd.unit}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">ROP:</span>
                              <span className="font-bold text-amber-600">{selProd.reorderPoint}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">ที่เก็บ:</span>
                              <span className="text-slate-600">{selProd.location}</span>
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
                                  <div className="flex items-center gap-1.5 ml-2">
                                    <Sparkles className={`w-3 h-3 ${item.overrideUnit ? 'text-amber-500' : 'text-indigo-400'}`} />
                                    <span className={item.overrideUnit ? 'text-amber-700 font-bold' : 'text-indigo-600 font-bold'}>
                                      ยอดเข้าคลัง: {(Number(item.qty || 0) * effectiveRate).toLocaleString()} {effectiveStockUnit}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        ) : item.isCustom ? (
                          <span className="text-purple-600 font-medium flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            สินค้านอกแคตตาล็อก
                          </span>
                        ) : null}
                      </div>

                      {/* Action Buttons: Unit Override & Custom Item Mode Switch */}
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
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors font-semibold ${
                              item.overrideUnit
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            {item.overrideUnit ? 'ตั้งค่าสเปคเฉพาะใบนี้ (เปิด)' : 'ตั้งค่าสเปคเฉพาะใบนี้'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleCustomItem(idx)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors font-semibold"
                        >
                          {item.isCustom ? '← เลือกสินค้าจากระบบ' : '+ เพิ่มสินค้านอกแคตตาล็อก'}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Unit Mapping Override Panel for this PR item */}
                    {selProd && item.overrideUnit && (
                      <div className="mt-2.5 ml-9 p-4 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in flex flex-col sm:flex-row sm:items-end gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">หน่วยขอซื้อ</label>
                          <input
                            type="text"
                            value={item.customPurchaseUnit || selProd.purchaseUnit || selProd.unit || ''}
                            onChange={e => handleItemChange(idx, 'customPurchaseUnit', e.target.value)}
                            placeholder="เช่น ถัง (50L)"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                        
                        <div className="flex flex-col items-center justify-end pb-2 hidden sm:flex text-slate-400">
                          <span className="text-[10px] font-bold mb-1">=</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>

                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">อัตราแปลงเป็นสต็อก</label>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.customRate ?? selProd.conversionRate ?? 1}
                            onChange={e => handleItemChange(idx, 'customRate', e.target.value)}
                            placeholder="เช่น 50"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-700 text-center outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>

                        <div className="flex flex-col items-center justify-end pb-2 hidden sm:flex text-slate-400">
                          <span className="text-[10px] font-bold mb-1">×</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>

                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">หน่วยเข้าคลัง</label>
                          <input
                            type="text"
                            value={item.customStockUnit || selProd.stockUnit || selProd.unit || ''}
                            onChange={e => handleItemChange(idx, 'customStockUnit', e.target.value)}
                            placeholder="เช่น ลิตร"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Table Footer Actions */}
              <div className="p-4 bg-slate-50/90 flex items-center justify-between gap-3 border-t border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรายการสินค้า (+ Row)</span>
                </button>
                <div className="text-xs text-slate-500 font-medium">
                  มีทั้งหมด <span className="font-bold text-slate-800">{prItems.length}</span> รายการ
                </div>
              </div>

            </div>
          </div>

          {/* ── SECTION 3: เอกสารประกอบ & แนบไฟล์ ── */}
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider">
              <FileSignature className="w-4 h-4 text-indigo-600" />
              <span>3. เอกสารประกอบและรายละเอียด (Attachments & Note)</span>
            </div>
            
            {requiresMemo && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3.5 text-amber-900 animate-fade-in shadow-xs">
                <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">ระบบบังคับแนบ MEMO ขออนุมัติและเอกสารคู่ขนาน</h4>
                  <p className="text-xs mt-1 text-amber-800 leading-relaxed">
                    เนื่องจากยอดรวมขอซื้อตั้งแต่ <span className="font-bold">฿20,000</span> ขึ้นไป (ยอดปัจจุบัน: ฿{totalAmount.toLocaleString()}) ระบบจำเป็นต้องให้แนบไฟล์ใบเสนอราคา (Quotation), รูปภาพสินค้า และกรอกข้อมูลฟอร์ม MEMO ด้านล่าง
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

            {/* Online Link if Online purchase */}
            {isOnline && (
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-1.5">
                <label className="impeccable-label text-purple-950 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-purple-600" />
                  <span>ลิงก์สินค้าออนไลน์ (Online Store Link - Shopee / Lazada) {(!requiresMemo) && <span className="text-rose-500">*</span>}</span>
                </label>
                <input
                  type="url"
                  placeholder="https://shopee.co.th/product/... หรือ https://www.lazada.co.th/products/..."
                  value={onlineLink}
                  onChange={e => setOnlineLink(e.target.value)}
                  className="impeccable-input border-purple-200 focus:border-purple-500 bg-white"
                />
                <p className="text-[11px] text-purple-700/80">
                  ระบุ URL หน้าสินค้าเพื่อให้เจ้าหน้าที่จัดซื้อออนไลน์สามารถกดสั่งซื้อได้ตรงรุ่น
                </p>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="impeccable-label">หมายเหตุการขอซื้อ (PR Note)</label>
              <textarea
                rows="2"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ระบุเหตุผลในการขอซื้อเพิ่มเติม หรือความเร่งด่วน..."
                className="impeccable-input resize-none"
              />
            </div>
          </div>

          {/* ── SECTION 4: ฟอร์ม MEMO ขออนุมัติ (เมื่อยอด ≥ 20,000) ── */}
          {requiresMemo && (
            <div className="p-6 md:p-8 space-y-6 bg-slate-50/80 border-t border-slate-200 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <FileSignature className="w-4 h-4 text-amber-600" />
                <span>4. แบบฟอร์ม MEMO ขออนุมัติซื้อ (Request For Approval)</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="md:col-span-2">
                  <label className="impeccable-label">หัวข้อ / โครงการ (Subject) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={memoData.subject}
                    onChange={e => setMemoData({...memoData, subject: e.target.value})}
                    className="impeccable-input font-medium"
                    placeholder="เช่น ขออนุมัติติดตั้งระบบหล่อลื่นและเปลี่ยนถ่ายน้ำมันไฮดรอลิก..."
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="impeccable-label">วัตถุประสงค์ (Purpose) <span className="text-rose-500">*</span></label>
                  <textarea
                    rows="2"
                    value={memoData.purpose}
                    onChange={e => setMemoData({...memoData, purpose: e.target.value})}
                    className="impeccable-input font-medium resize-none"
                    placeholder="ระบุวัตถุประสงค์ความจำเป็นในการจัดซื้อ..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="impeccable-label">รายละเอียด / พื้นเพ (Background & Scope) <span className="text-rose-500">*</span></label>
                  <textarea
                    rows="2"
                    value={memoData.background}
                    onChange={e => setMemoData({...memoData, background: e.target.value})}
                    className="impeccable-input font-medium resize-none"
                    placeholder="ระบุที่มา ข้อมูลเครื่องจักร หรือผลการตรวจสอบคุณภาพ..."
                  />
                </div>

                <div>
                  <label className="impeccable-label">ประเภทงบประมาณ (Classification)</label>
                  <select
                    value={memoData.classification}
                    onChange={e => setMemoData({...memoData, classification: e.target.value})}
                    className="impeccable-input font-medium"
                  >
                    <option value="EXPENSE">Expense (ค่าใช้จ่ายดำเนินงาน)</option>
                    <option value="ASSET">Asset (ทรัพย์สินถาวร)</option>
                    <option value="OTHER">Other (อื่นๆ)</option>
                  </select>
                </div>

                <div>
                  <label className="impeccable-label">เงื่อนไขการชำระเงิน (Payment Term)</label>
                  <input
                    type="text"
                    value={memoData.paymentTerm}
                    onChange={e => setMemoData({...memoData, paymentTerm: e.target.value})}
                    className="impeccable-input font-medium"
                    placeholder="เช่น เครดิต 30 วัน, เงินสด"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Footer Actions ── */}
          <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (clearPreselectedProduct) clearPreselectedProduct();
                onNavigate('pr-list');
              }}
              className="px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={(e) => handleCreateSubmit(e, true)}
                className="px-6 py-3 text-sm font-bold bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                บันทึกแบบร่าง (Draft)
              </button>
              <button
                type="button"
                onClick={(e) => handleCreateSubmit(e, false)}
                className="px-8 py-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ส่งใบ PR เข้าสู่ระบบ</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
