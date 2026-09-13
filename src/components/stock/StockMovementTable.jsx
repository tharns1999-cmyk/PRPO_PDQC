import React, { useState, useMemo, useCallback } from 'react';
import { History, ArrowDownRight, ArrowUpRight, X, MapPin, Search } from 'lucide-react';
import Portal from '../common/Portal';
import CollapsibleActivityTimeline from '../common/CollapsibleActivityTimeline';
import { storageService, normalizeDocNumber } from '../../services/storageService';

const PAGE_SIZE = 50;

export default function StockMovementTable({ selectedProduct: propSelectedProduct, product, stockLogs = [], pos = [], onClose }) {
  const [filterType, setFilterType] = useState('ALL'); // ALL, IN, OUT
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const selectedProduct = product || propSelectedProduct;

  // Retrieve pos list from props or storageService as a safe fallback
  const resolvedPOs = useMemo(() => {
    if (pos && pos.length > 0) return pos;
    try {
      return storageService.getPOs() || [];
    } catch {
      return [];
    }
  }, [pos]);

  // Retrieve stock logs with safe fallback to storageService
  const resolvedStockLogs = useMemo(() => {
    if (Array.isArray(stockLogs) && stockLogs.length > 0) return stockLogs;
    try {
      return storageService.getStockLogs() || [];
    } catch {
      return [];
    }
  }, [stockLogs]);

  // Resiliently match logs for this product across id, code, and name
  const rawProductLogs = useMemo(() => {
    if (!selectedProduct) return [];
    const pId = String(selectedProduct.id || '').trim().toLowerCase();
    const pCode = String(selectedProduct.code || '').trim().toLowerCase();
    const pName = String(selectedProduct.name || '').trim().toLowerCase();

    return resolvedStockLogs.filter(log => {
      if (!log) return false;
      const logPId = String(log.productId || '').trim().toLowerCase();
      const logPCode = String(log.productCode || '').trim().toLowerCase();
      const logPName = String(log.name || '').trim().toLowerCase();

      return (
        (pId && (logPId === pId || logPCode === pId)) ||
        (pCode && (logPCode === pCode || logPId === pCode)) ||
        (pName && logPName === pName)
      );
    });
  }, [resolvedStockLogs, selectedProduct]);

  // Self-Healing Data (Migration): If product.stock > 0 but movement logs are empty,
  // auto-generate the initial balance log and persist it so stock and history reconcile
  const effectiveProductLogs = useMemo(() => {
    if (!selectedProduct) return [];
    const stockVal = Number(selectedProduct.stockBalance ?? selectedProduct.stock ?? selectedProduct.qty) || 0;

    if (rawProductLogs.length === 0 && stockVal > 0) {
      const unitPrice = Number(selectedProduct.price) || 0;
      const initialSyntheticLog = {
        id: `INIT-${selectedProduct.id || selectedProduct.code || 'SYS'}`,
        date: selectedProduct.createdAt ? new Date(selectedProduct.createdAt).toLocaleString('th-TH') : new Date().toLocaleString('th-TH'),
        displayDate: selectedProduct.createdAt ? new Date(selectedProduct.createdAt).toLocaleString('th-TH') : new Date().toLocaleString('th-TH'),
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        name: selectedProduct.name,
        type: 'IN',
        documentNo: 'INITIAL-BALANCE',
        docNo: 'INITIAL-BALANCE',
        poNo: '-',
        poNumber: '-',
        qty: stockVal,
        balance: stockVal,
        unit: selectedProduct.stockUnit || selectedProduct.unit || 'ชิ้น',
        unitPrice: unitPrice,
        totalPrice: unitPrice * stockVal,
        user: 'System Initial Balance',
        locationId: selectedProduct.locationId || '',
        locationName: selectedProduct.locationName || '',
        note: 'ยอดยกมาจากระบบเริ่มต้น (System Initial Balance)'
      };
      return [initialSyntheticLog];
    }

    return rawProductLogs;
  }, [rawProductLogs, selectedProduct]);

  // Persist self-healed initial balance log to storage & backend if missing
  React.useEffect(() => {
    if (!selectedProduct) return;
    const stockVal = Number(selectedProduct.stockBalance ?? selectedProduct.stock ?? selectedProduct.qty) || 0;
    if (stockVal > 0 && rawProductLogs.length === 0) {
      const allLogs = storageService.getStockLogs() || [];
      const pId = String(selectedProduct.id || '').trim().toLowerCase();
      const pCode = String(selectedProduct.code || '').trim().toLowerCase();
      const hasAny = allLogs.some(l => {
        if (!l) return false;
        const lpId = String(l.productId || '').trim().toLowerCase();
        const lpCode = String(l.productCode || '').trim().toLowerCase();
        return (pId && (lpId === pId || lpCode === pId)) || (pCode && (lpCode === pCode || lpId === pCode));
      });

      if (!hasAny) {
        const unitPrice = Number(selectedProduct.price) || 0;
        const healedLog = {
          id: `INIT-${selectedProduct.id || selectedProduct.code || Date.now()}`,
          date: new Date().toLocaleString('th-TH'),
          productId: selectedProduct.id,
          productCode: selectedProduct.code,
          name: selectedProduct.name,
          type: 'IN',
          documentNo: 'INITIAL-BALANCE',
          docNo: 'INITIAL-BALANCE',
          poNo: '-',
          poNumber: '-',
          qty: stockVal,
          balance: stockVal,
          unit: selectedProduct.stockUnit || selectedProduct.unit || 'ชิ้น',
          unitPrice: unitPrice,
          totalPrice: unitPrice * stockVal,
          user: 'System Initial Balance',
          locationId: selectedProduct.locationId || '',
          locationName: selectedProduct.locationName || '',
          note: 'ยอดยกมาจากระบบเริ่มต้น (System Initial Balance)'
        };
        const updated = [healedLog, ...allLogs];
        storageService.saveStockLogs(updated);
        try {
          fetch('http://localhost:3001/api/stock-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          }).catch(() => {});
        } catch {}
      }
    }
  }, [selectedProduct, rawProductLogs.length]);

  // Filter logs for this product, then apply IN/OUT filter and document/PO search
  const productMovementLogs = useMemo(() => {
    if (!selectedProduct) return [];
    return effectiveProductLogs.filter(log => {
      if (filterType !== 'ALL' && log.type !== filterType) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.trim().toLowerCase();
      const normDoc = normalizeDocNumber(log).toLowerCase();
      const rawDoc = String(log.documentNo || log.docNo || log.grnNo || log.grNumber || '').toLowerCase();
      const parentPo = String(log.refPo || log.poNumber || log.poNo || '').toLowerCase();
      const user = String(log.user || '').toLowerCase();
      const note = String(log.note || '').toLowerCase();

      // Stem matching: If user searches for e.g. GRN-PO-PD-2026-001-01 or PO-PD-2026-001,
      // extract the base PO stem so both Round 1 & Round 2 records are retrieved
      let qPoStem = q;
      if (q.startsWith('grn-')) {
        const match = q.match(/grn-(po-[a-z0-9-]+?)(?:-\d{2})?$/i);
        if (match) qPoStem = match[1].toLowerCase();
      }

      return (
        normDoc.includes(q) ||
        rawDoc.includes(q) ||
        parentPo.includes(q) ||
        parentPo.includes(qPoStem) ||
        normDoc.includes(qPoStem) ||
        user.includes(q) ||
        note.includes(q)
      );
    });
  }, [effectiveProductLogs, selectedProduct, filterType, searchQuery]);

  // Transform logs into progressive activity timeline events
  const timelineEvents = useMemo(() => {
    if (!selectedProduct) return [];
    return productMovementLogs.map(log => {
      const typeLabel = log.type === 'IN' ? 'รับเข้า (+IN)' : log.type === 'IN_NG' ? 'รับเข้าของเสีย (+IN NG)' : 'เบิกจ่าย (-OUT)';
      const qtyStr = `${log.type === 'OUT' ? '-' : '+'}${Number(log.qty).toLocaleString()} ${selectedProduct.unit || log.unit || 'ชิ้น'}`;
      const docStr = (log.documentNo || log.docNo) ? ` [เอกสาร: ${log.documentNo || log.docNo}]` : '';
      return {
        id: log.id,
        title: `${typeLabel} ${qtyStr}${docStr}`,
        role: log.type,
        actor: log.user || 'เจ้าหน้าที่คลัง',
        time: log.displayDate || log.date || '-',
        note: [
          log.note,
          (log.poNo || log.poNumber) ? `PO: ${log.poNo || log.poNumber}` : null,
          log.balance !== undefined ? `คงเหลือ: ${Number(log.balance).toLocaleString()} ${selectedProduct.unit || log.unit || ''}` : null
        ].filter(Boolean).join(' • ')
      };
    });
  }, [productMovementLogs, selectedProduct]);

  // Helper to format currency numbers (stable reference via useCallback)
  const formatCurrency = useCallback((val) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  /**
   * Pre-computed purchase detail lookup Map (Performance)
   * Runs once per productMovementLogs/resolvedPOs change instead of
   * re-computing on every render cycle for every visible row.
   * Returns: Map<log.id, { poNumber, totalPurchaseAmount, avgUnitPrice }>
   */
  const purchaseDetailMap = useMemo(() => {
    const map = new Map();
    const _compute = (log) => {
      // Only calculate and display for incoming inventory (+IN / IN_NG)
      if (log.type !== 'IN' && log.type !== 'IN_NG') {
        return { poNumber: '-', totalPurchaseAmount: '-', avgUnitPrice: '-' };
      }

      // 1. Direct fields already attached to the stock log
      let poNumber = log.poNo || log.poNumber || (log.docNo && String(log.docNo).startsWith('PO-') ? log.docNo : null);
      let totalAmount = log.totalPrice !== undefined && log.totalPrice !== null ? Number(log.totalPrice) : null;
      let unitPrice = log.unitPrice !== undefined && log.unitPrice !== null ? Number(log.unitPrice) : null;

      // 2. If PO number not directly found, try to extract from note (e.g. "...จาก PO PO-PD-2026-001")
      if (!poNumber && log.note) {
        const match = log.note.match(/PO[-\s]?([A-Z0-9\-_/]+)/i);
        if (match) {
          poNumber = match[0].trim();
        }
      }

      // 3. Match with PO in state/storage
      if (poNumber || log.poId) {
        const matchedPO = resolvedPOs.find(p =>
          (poNumber && (p.poNo === poNumber || p.poNumber === poNumber)) ||
          (log.poId && p.id === log.poId) ||
          (log.docNo && (p.poNo === log.docNo || p.id === log.docNo))
        );

        if (matchedPO) {
          if (!poNumber) poNumber = matchedPO.poNo || matchedPO.poNumber;

          // Find matching item in PO items
          const matchedItem = (matchedPO.items || []).find(item =>
            (item.productId && (item.productId === log.productId || item.productId === selectedProduct.id)) ||
            (item.code && (item.code === log.productCode || item.code === selectedProduct.code)) ||
            (item.name && selectedProduct.name && item.name === selectedProduct.name)
          );

          if (matchedItem) {
            const itemPrice = Number(matchedItem.actUnitPrice ?? matchedItem.actualPrice ?? matchedItem.price) || 0;
            const discountAmt = Number(matchedItem.discountAmount) || 0;
            const itemTotal = matchedItem.total !== undefined
              ? Number(matchedItem.total)
              : Math.max(0, (itemPrice * (Number(matchedItem.purchaseQty ?? matchedItem.qty) || 1)) - discountAmt);

            const convRate = Number(matchedItem.conversionRate) > 0 ? Number(matchedItem.conversionRate) : 1;

            // Price per stock unit (เช่น ราคากิโลกรัมละ / แผ่นละ)
            if (unitPrice === null || unitPrice === 0) {
              unitPrice = itemPrice / convRate;
            }

            // Total amount for this received log:
            if (totalAmount === null || totalAmount === 0) {
              if (Number(log.qty) > 0 && unitPrice > 0) {
                totalAmount = unitPrice * Number(log.qty);
              } else {
                totalAmount = itemTotal;
              }
            }
          } else if ((totalAmount === null || totalAmount === 0) && matchedPO.grandTotal) {
            // Fallback if PO only had 1 item
            if (matchedPO.items?.length === 1) {
              totalAmount = Number(matchedPO.grandTotal);
            }
          }
        }
      }

      // 4. Fallback calculation for avgUnitPrice with guard against division by zero
      const qtyNum = Number(log.qty) || 0;
      if ((unitPrice === null || unitPrice === 0) && totalAmount !== null && qtyNum > 0) {
        unitPrice = totalAmount / qtyNum;
      }

      return {
        poNumber: poNumber || log.poNo || log.poNumber || '-',
        totalPurchaseAmount: totalAmount !== null && totalAmount > 0 ? `${formatCurrency(totalAmount)} ฿` : '-',
        avgUnitPrice: unitPrice !== null && unitPrice > 0 ? `${formatCurrency(unitPrice)} ฿` : '-'
      };
    };

    productMovementLogs.forEach(log => {
      map.set(log.id, _compute(log));
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productMovementLogs, resolvedPOs, selectedProduct, formatCurrency]);

  // Paginated slice — caps DOM nodes to PAGE_SIZE rows; user can load more
  const visibleLogs = useMemo(
    () => productMovementLogs.slice(0, visibleCount),
    [productMovementLogs, visibleCount]
  );
  const hasMore = visibleCount < productMovementLogs.length;


  return (
    <Portal>
      <div className="fixed inset-0 glass-backdrop z-[100] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-7 max-w-6xl w-full text-slate-800 space-y-4 my-8 animate-zoom-in">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-2xs">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>ประวัติการเคลื่อนไหวสินค้า (Stock Movement Log)</span>
                </h3>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold">[{selectedProduct.code}] {selectedProduct.name}</span>
                  <span>•</span>
                  <span>คงเหลือ: <span className="font-bold text-indigo-600 font-mono tabular-nums">{selectedProduct.stockBalance}</span> {selectedProduct.unit}</span>
                  {selectedProduct.locationName && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        <MapPin className="w-3 h-3 text-indigo-600" />
                        <span>{selectedProduct.locationName}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" 
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">ประเภท:</span>
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
                <button
                  onClick={() => { setFilterType('ALL'); setVisibleCount(PAGE_SIZE); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => { setFilterType('IN'); setVisibleCount(PAGE_SIZE); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'IN' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  +IN (รับเข้า)
                </button>
                <button
                  onClick={() => { setFilterType('OUT'); setVisibleCount(PAGE_SIZE); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'OUT' ? 'bg-rose-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  -OUT (เบิกจ่าย)
                </button>
              </div>
            </div>

            {/* Document / PO Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่เอกสาร / PO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 rounded-xl text-xs placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-56 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="ล้างคำค้นหา"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Movement Timeline */}
          {timelineEvents.length > 0 && (
            <CollapsibleActivityTimeline
              events={timelineEvents}
              title="ประวัติการเคลื่อนไหวสต็อก (Movement Timeline)"
              defaultExpanded={false}
              reverseOrder={false}
            />
          )}

          {/* Table Container with Horizontal Scroll & Min Width */}
          <div className="overflow-x-auto overflow-y-auto max-h-[28rem] border border-slate-200/80 rounded-2xl custom-scrollbar relative shadow-2xs">
            <table className="w-full text-left text-xs sm:text-sm min-w-[950px]">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 pl-5 whitespace-nowrap">วัน-เวลา</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">ประเภท</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">เลขที่เอกสาร</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">จำนวน</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">ยอดคงเหลือ</th>
                  {/* 3 New Columns */}
                  <th className="py-3.5 px-3 whitespace-nowrap text-left bg-indigo-50/40 text-indigo-900">เลขที่ PO</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap bg-indigo-50/40 text-indigo-900">จำนวนเงินที่ซื้อ</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap bg-indigo-50/40 text-indigo-900">ราคาเฉลี่ย/หน่วย</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">ผู้ทำรายการ</th>
                  <th className="py-3.5 pr-5 whitespace-nowrap">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {productMovementLogs.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-8 text-center text-slate-400">
                      ไม่พบประวัติความเคลื่อนไหวตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  visibleLogs.map(log => {
                    const purchase = purchaseDetailMap.get(log.id) || { poNumber: '-', totalPurchaseAmount: '-', avgUnitPrice: '-' };
                    const isIncoming = log.type === 'IN' || log.type === 'IN_NG';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Date */}
                        <td className="py-3.5 pl-5 text-slate-500 whitespace-nowrap font-mono text-xs">
                          {log.displayDate || (log.date && String(log.date).includes('T') ? new Date(log.date).toLocaleString('th-TH') : (log.date || '-'))}
                        </td>

                        {/* 2. Type */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {log.type === 'IN' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-emerald-200">
                              <ArrowDownRight className="w-3 h-3 text-emerald-600" /> IN
                            </span>
                          ) : log.type === 'IN_NG' ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-amber-200">
                              <ArrowDownRight className="w-3 h-3 text-amber-600" /> IN (NG)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-rose-200">
                              <ArrowUpRight className="w-3 h-3 text-rose-600" /> OUT
                            </span>
                          )}
                        </td>

                        {/* 3. Document Number */}
                        <td className="py-3.5 px-3 font-mono text-xs whitespace-nowrap">
                          {(() => {
                            const normalizedDocNo = normalizeDocNumber(log) || log.documentNo || log.docNo || log.grNumber || '-';
                            const parentPo = log.refPo || log.poNumber || log.poNo || (purchase && purchase.poNumber !== '-' ? purchase.poNumber : null);
                            return (
                              <div>
                                <span className="font-mono font-bold text-slate-800">{normalizedDocNo}</span>
                                {parentPo && parentPo !== '-' && (
                                  <div className="text-[11px] text-slate-400 font-sans">อ้างอิง: {parentPo}</div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* 4. Quantity */}
                        <td className={`py-3.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                          isIncoming ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {isIncoming ? `+${Number(log.qty).toLocaleString()}` : `-${Number(log.qty).toLocaleString()}`}
                        </td>

                        {/* 5. Balance */}
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {Number(log.balance).toLocaleString()}
                        </td>

                        {/* 6. [NEW] PO Number */}
                        <td className="py-3.5 px-3 font-mono text-xs whitespace-nowrap text-left">
                          {isIncoming && (purchase.poNumber !== '-' || log.poNo || log.poNumber) ? (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 font-bold text-indigo-700 border border-indigo-200/70">
                              {purchase.poNumber !== '-' ? purchase.poNumber : (log.poNo || log.poNumber)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>

                        {/* 7. [NEW] Total Purchase Amount */}
                        <td className="py-3.5 px-3 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                          {isIncoming && (purchase.totalPurchaseAmount !== '-' || (log.totalPrice !== undefined && Number(log.totalPrice) > 0)) ? (
                            <span className="font-semibold text-slate-900">
                              {purchase.totalPurchaseAmount !== '-' ? purchase.totalPurchaseAmount : `${formatCurrency(log.totalPrice)} ฿`}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>

                        {/* 8. [NEW] Average Unit Price */}
                        <td className="py-3.5 px-3 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                          {isIncoming && (purchase.avgUnitPrice !== '-' || (log.unitPrice !== undefined && Number(log.unitPrice) > 0)) ? (
                            <span className="font-semibold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">
                              {purchase.avgUnitPrice !== '-' ? purchase.avgUnitPrice : `${formatCurrency(log.unitPrice)} ฿`}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>

                        {/* 9. User */}
                        <td className="py-3.5 px-3 text-slate-700 text-xs whitespace-nowrap">
                          {log.user || '-'}
                        </td>

                        {/* 10. Note */}
                        <td className="py-3.5 pr-5 text-slate-600 text-xs max-w-xs truncate" title={log.note}>
                          {log.note || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Load More Pagination — prevents unbounded DOM growth */}
          {hasMore && (
            <div className="pt-1 flex justify-center">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                โหลดเพิ่ม ({productMovementLogs.length - visibleCount} รายการที่เหลือ)
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
            <span>* คอลัมน์ข้อมูลจัดซื้อ (เลขที่ PO, จำนวนเงิน, ราคาเฉลี่ย) จะแสดงเฉพาะรายการรับเข้าสินค้า (+IN)</span>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
