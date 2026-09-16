import React, { useState, useMemo, useCallback } from 'react';
import { History, ArrowDownRight, ArrowUpRight, X, MapPin, Search, Calendar, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import Portal from '../common/Portal';
import { storageService, normalizeDocNumber } from '../../services/storageService';

/**
 * Resilient Date Parser for diverse stock log formats
 * (ISO string, DD/MM/YYYY, Thai Buddhist Era, timestamps).
 */
export const parseLogDate = (raw) => {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  const str = String(raw).trim();
  if (!str) return null;

  // DD/MM/YYYY [HH:mm[:ss]]
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y > 2400) y -= 543; // Thai BE to CE
    else if (y < 100) y += 2000;
    const m = parseInt(dmy[2], 10) - 1;
    const d = parseInt(dmy[1], 10);
    const hh = dmy[4] ? parseInt(dmy[4], 10) : 0;
    const mm = dmy[5] ? parseInt(dmy[5], 10) : 0;
    const ss = dmy[6] ? parseInt(dmy[6], 10) : 0;
    const dateObj = new Date(y, m, d, hh, mm, ss);
    return isNaN(dateObj.getTime()) ? null : dateObj;
  }

  // ISO string or Standard parse
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Format timestamp/date to 'DD/MM/YYYY HH:mm' in Bangkok (Asia/Bangkok) timezone.
 */
export const formatDateTimeThai = (raw) => {
  if (!raw) return '-';
  const d = parseLogDate(raw);
  if (!d) return String(raw);

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
    return parts.replace(',', '');
  } catch {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
};

/**
 * Movement Type Classifier Helpers
 */
export const isStockIn = (log) => {
  if (!log) return false;
  const type = String(log.type || '').trim().toUpperCase();
  if (['OUT', 'ISSUE', 'DISPATCH', 'CONSUME', 'REDUCE', 'ADJUST_OUT'].includes(type)) {
    return false;
  }
  const qty = Number(log.changeQty ?? (log.changeQty === undefined ? (log.quantity ?? log.qty) : 0) ?? 0);
  return ['IN', 'RECEIVE', 'GRN', 'PURCHASE', 'ADJUST_IN', 'IN_NG'].includes(type) || qty > 0;
};

export const isStockOut = (log) => {
  if (!log) return false;
  const type = String(log.type || '').trim().toUpperCase();
  if (['IN', 'RECEIVE', 'GRN', 'PURCHASE', 'ADJUST_IN', 'IN_NG'].includes(type)) {
    return false;
  }
  const qty = Number(log.changeQty ?? (log.changeQty === undefined ? -(log.quantity ?? log.qty) : 0) ?? 0);
  return ['OUT', 'ISSUE', 'DISPATCH', 'CONSUME', 'REDUCE', 'ADJUST_OUT'].includes(type) || qty < 0;
};

export default function StockMovementTable({
  selectedProduct: propSelectedProduct,
  product,
  stockLogs = [],
  pos = [],
  onClose,
  initialFilterType,
  filterType: controlledFilterType
}) {
  const [internalFilterType, setInternalFilterType] = useState(initialFilterType || 'ALL'); // ALL, IN, OUT
  const filterType = controlledFilterType !== undefined ? controlledFilterType : internalFilterType;
  const setFilterType = (val) => setInternalFilterType(val);
  const [timeFilter, setTimeFilter] = useState('3M'); // 3M (3 เดือนล่าสุด), ALL (ทั้งหมด)
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10-15 rows per page
  const [activeNoteModal, setActiveNoteModal] = useState(null); // Full Note modal state
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

  // Resiliently match logs for this product across id, code, and legacy sku (Defensive Matching)
  const rawProductLogs = useMemo(() => {
    if (!selectedProduct) return [];
    const pId = String(selectedProduct.id || '').trim();
    const pCode = String(selectedProduct.code || selectedProduct.sku || '').trim().toLowerCase();
    const pName = String(selectedProduct.name || '').trim().toLowerCase();

    return resolvedStockLogs.filter(m => {
      if (!m) return false;
      const matchId = m.productId && String(m.productId).trim() === pId;
      const matchCode = m.productCode && (
        String(m.productCode).trim().toLowerCase() === pCode
      );
      const matchLegacySku = m.sku && (
        String(m.sku).trim().toLowerCase() === pCode
      );
      const matchItemCode = m.itemCode && (
        String(m.itemCode).trim().toLowerCase() === pCode
      );
      const matchName = pName && (
        (m.name && String(m.name).trim().toLowerCase() === pName) ||
        (m.productName && String(m.productName).trim().toLowerCase() === pName)
      );
      const matchCrossId = (pId && String(m.productCode || m.sku || '').trim().toLowerCase() === pId.toLowerCase()) ||
                           (pCode && String(m.productId || '').trim().toLowerCase() === pCode);

      return matchId || matchCode || matchLegacySku || matchItemCode || matchName || matchCrossId;
    });
  }, [resolvedStockLogs, selectedProduct]);

  // Self-Healing Data (Migration): If product.stock > 0 but movement logs are empty,
  // auto-generate the initial balance log and persist it so stock and history reconcile
  const effectiveProductLogs = useMemo(() => {
    if (!selectedProduct) return [];
    const stockVal = Number(selectedProduct.stockBalance ?? selectedProduct.stock ?? selectedProduct.qty) || 0;

    if (rawProductLogs.length === 0 && stockVal > 0) {
      const conversionRate = Number(selectedProduct.conversionRate || selectedProduct.conversionRatio) || 1;
      const unitCostInStock = (Number(selectedProduct.price) || 0) / conversionRate;
      const initialSyntheticLog = {
        id: `INIT-${selectedProduct.id || selectedProduct.code || 'SYS'}`,
        date: selectedProduct.createdAt ? new Date(selectedProduct.createdAt).toISOString() : new Date().toISOString(),
        displayDate: selectedProduct.createdAt ? new Date(selectedProduct.createdAt).toISOString() : new Date().toISOString(),
        timestamp: selectedProduct.createdAt ? new Date(selectedProduct.createdAt).toISOString() : new Date().toISOString(),
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
        unitPrice: unitCostInStock,
        totalPrice: unitCostInStock * stockVal,
        conversionRate: conversionRate,
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
        const conversionRate = Number(selectedProduct.conversionRate || selectedProduct.conversionRatio) || 1;
        const unitCostInStock = (Number(selectedProduct.price) || 0) / conversionRate;
        const healedLog = {
          id: `INIT-${selectedProduct.id || selectedProduct.code || Date.now()}`,
          date: new Date().toISOString(),
          timestamp: new Date().toISOString(),
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
          unitPrice: unitCostInStock,
          totalPrice: unitCostInStock * stockVal,
          conversionRate: conversionRate,
          user: 'System Initial Balance',
          locationId: selectedProduct.locationId || '',
          locationName: selectedProduct.locationName || '',
          note: 'ยอดยกมาจากระบบเริ่มต้น (System Initial Balance)'
        };
        const updated = [healedLog, ...allLogs];
        storageService.saveStockLogs(updated);
        try {
          fetch('/api/stock-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          }).catch(() => {});
        } catch {}
      }
    }
  }, [selectedProduct, rawProductLogs.length]);

  // Helper for 3 Months Date Boundary (current month + 2 previous months)
  const isWithinLast3Months = useCallback((rawDate) => {
    const logDate = parseLogDate(rawDate);
    if (!logDate) return true; // Keep if unparseable
    const now = new Date();
    const startOfPeriod = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    return logDate >= startOfPeriod;
  }, []);

  // Filter & Sort logs:
  // 1. Descending sort by timestamp/date (latest first)
  // 2. Filter by 3 Months / All
  // 3. Filter by Type (ALL, IN, OUT)
  // 4. Search by Document No, PO, User, Note
  const productMovementLogs = useMemo(() => {
    if (!selectedProduct) return [];

    // 1. Sort descending: Latest first
    const sorted = [...effectiveProductLogs].sort((a, b) => {
      const dateA = parseLogDate(a.timestamp || a.date || a.createdAt);
      const dateB = parseLogDate(b.timestamp || b.date || b.createdAt);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeB - timeA;
    });

    // 2. Filter by criteria
    return sorted.filter(log => {
      // Type Filter (Supports ALL, IN, +IN, OUT, -OUT, ISSUE, GRN)
      const activeTab = String(filterType || 'ALL').toUpperCase();
      if (activeTab.includes('OUT')) {
        if (!isStockOut(log)) return false;
      } else if (activeTab.includes('IN')) {
        if (!isStockIn(log)) return false;
      }

      // Time Range Filter (3M: 3 เดือนล่าสุด)
      if (timeFilter === '3M') {
        const rawD = log.timestamp || log.date || log.createdAt;
        if (rawD && !isWithinLast3Months(rawD)) return false;
      }

      // Search Query Filter
      if (!searchQuery.trim()) return true;

      const q = searchQuery.trim().toLowerCase();
      const normDoc = normalizeDocNumber(log).toLowerCase();
      const rawDoc = String(log.documentNo || log.docNo || log.referenceDoc || log.id || log.grnNo || log.grNumber || '').toLowerCase();
      const parentPo = String(log.refPo || log.poNumber || log.poNo || '').toLowerCase();
      const user = String(log.user || log.actorName || log.issuedTo || log.requester || '').toLowerCase();
      const note = String(log.note || log.notes || log.remark || log.remarks || log.reason || '').toLowerCase();

      // Stem matching for PO numbers
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
  }, [effectiveProductLogs, selectedProduct, filterType, timeFilter, searchQuery, isWithinLast3Months]);

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

      const conversionRate = Number(
        selectedProduct?.conversionRate ||
        selectedProduct?.conversionRatio ||
        log.conversionRate ||
        log.conversionRatio ||
        1
      ) || 1;

      // 1. Direct fields already attached to the stock log
      let poNumber = log.poNo || log.poNumber || (log.docNo && String(log.docNo).startsWith('PO-') ? log.docNo : null);
      let totalAmount = log.totalAmount !== undefined && log.totalAmount !== null
        ? Number(log.totalAmount)
        : (log.totalPrice !== undefined && log.totalPrice !== null ? Number(log.totalPrice) : null);
      let unitPrice = log.baseUnitCost !== undefined && log.baseUnitCost !== null
        ? Number(log.baseUnitCost)
        : (log.unitPrice !== undefined && log.unitPrice !== null ? Number(log.unitPrice) : null);

      // 2. If PO number not directly found, try to extract from note
      if (!poNumber && (log.note || log.notes)) {
        const fullNote = String(log.note || log.notes);
        const match = fullNote.match(/PO[-\s]?([A-Z0-9\-_/]+)/i);
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

            const convRate = Number(matchedItem.conversionRate || conversionRate) > 0
              ? Number(matchedItem.conversionRate || conversionRate)
              : 1;

            if (unitPrice === null || unitPrice === 0 || (unitPrice === itemPrice && convRate > 1)) {
              unitPrice = itemPrice / convRate;
            }

            if (totalAmount === null || totalAmount === 0 || (totalAmount === (Number(log.qty) * itemPrice) && convRate > 1)) {
              if (Number(log.qty) > 0 && unitPrice > 0) {
                totalAmount = unitPrice * Number(log.qty);
              } else {
                totalAmount = itemTotal;
              }
            }
          } else if ((totalAmount === null || totalAmount === 0) && matchedPO.grandTotal) {
            if (matchedPO.items?.length === 1) {
              totalAmount = Number(matchedPO.grandTotal);
            }
          }
        }
      }

      // 4. Initial balance / Unmatched log Dual-UOM normalization
      if (conversionRate > 1) {
        const prodPrice = Number(selectedProduct?.price) || 0;
        const isDocInit = String(log.documentNo || log.docNo || '').toUpperCase().includes('INITIAL');
        if (unitPrice === prodPrice || isDocInit || (totalAmount && Math.abs(totalAmount - (Number(log.qty) * prodPrice)) < 0.01)) {
          unitPrice = (unitPrice && unitPrice !== prodPrice ? unitPrice : prodPrice) / conversionRate;
          totalAmount = Number(log.qty) * unitPrice;
        }
      }

      // 5. Fallback calculation for unitPrice
      const qtyNum = Number(log.qty) || 0;
      if ((unitPrice === null || unitPrice === 0) && totalAmount !== null && qtyNum > 0) {
        unitPrice = totalAmount / qtyNum;
      } else if ((totalAmount === null || totalAmount === 0) && unitPrice !== null && qtyNum > 0) {
        totalAmount = unitPrice * qtyNum;
      }

      const stockUnitName = selectedProduct?.stockUnit || selectedProduct?.unit || log.unit || 'ชิ้น';

      return {
        poNumber: poNumber || log.poNo || log.poNumber || '-',
        totalPurchaseAmount: totalAmount !== null && totalAmount > 0 ? `${formatCurrency(totalAmount)} ฿` : '-',
        avgUnitPrice: unitPrice !== null && unitPrice > 0 ? `฿${formatCurrency(unitPrice)} / ${stockUnitName}` : '-',
        rawTotalAmount: totalAmount,
        rawUnitPrice: unitPrice
      };
    };

    productMovementLogs.forEach(log => {
      map.set(log.id, _compute(log));
    });
    return map;
  }, [productMovementLogs, resolvedPOs, selectedProduct, formatCurrency]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(productMovementLogs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  
  const visibleLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return productMovementLogs.slice(start, start + pageSize);
  }, [productMovementLogs, safeCurrentPage, pageSize]);

  // Generate Page Numbers for Pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safeCurrentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

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

          {/* Filters & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">ประเภท:</span>
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setFilterType('ALL'); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterType('IN'); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'IN' || filterType === '+IN' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  +IN (รับเข้า)
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterType('OUT'); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'OUT' || filterType === '-OUT' ? 'bg-rose-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  -OUT (เบิกจ่าย)
                </button>
              </div>
            </div>

            {/* Right: Time Period Filter & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter ช่วงเวลา: 3 เดือนล่าสุด (Default) / ทั้งหมด */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/40">
                <div className="flex items-center gap-1 pl-1.5 pr-1 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <button
                  type="button"
                  onClick={() => { setTimeFilter('3M'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    timeFilter === '3M' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3 เดือนล่าสุด
                </button>
                <button
                  type="button"
                  onClick={() => { setTimeFilter('ALL'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    timeFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด
                </button>
              </div>

              {/* Document / PO Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขที่เอกสาร / PO..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 rounded-xl text-xs placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-52 sm:w-56 transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="ล้างคำค้นหา"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Container with Scrollbar & Sticky Header (max-h-[55vh] overflow-y-auto) */}
          <div className="overflow-x-auto overflow-y-auto max-h-[55vh] border border-slate-200/80 rounded-2xl custom-scrollbar relative shadow-2xs">
            <table className="w-full text-left text-xs sm:text-sm min-w-[950px]">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-2xs text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 pl-5 whitespace-nowrap">วัน-เวลา</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">ประเภท</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">เลขที่เอกสาร</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">จำนวน</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">ยอดคงเหลือ</th>
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
                    const isIncoming = isStockIn(log);
                    const isNg = String(log.type || '').toUpperCase() === 'IN_NG';
                    const rawDate = log.timestamp || log.displayDate || log.date || log.createdAt;
                    const normalizedDocNo = normalizeDocNumber(log) || log.docNo || log.documentNo || log.grnNo || log.grnNumber || log.grNumber || '-';
                    const rawNote = log.notes || log.note || log.remark || log.remarks || '';
                    const noteText = String(rawNote).trim();
                    const isNoteLong = noteText.length > 25;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Date: Formatted as DD/MM/YYYY HH:mm in Bangkok Time */}
                        <td className="py-3 pl-5 text-slate-600 whitespace-nowrap font-mono text-xs">
                          {formatDateTimeThai(rawDate)}
                        </td>

                        {/* 2. Type */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isNg ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-amber-200">
                              <ArrowDownRight className="w-3 h-3 text-amber-600" /> IN (NG)
                            </span>
                          ) : isIncoming ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-emerald-200">
                              <ArrowDownRight className="w-3 h-3 text-emerald-600" /> IN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-rose-200">
                              <ArrowUpRight className="w-3 h-3 text-rose-600" /> OUT
                            </span>
                          )}
                        </td>

                        {/* 3. Document Number */}
                        <td className="py-3 px-3 font-mono text-xs whitespace-nowrap">
                          {(() => {
                            const parentPo = log.poNo || log.poNumber || log.refPo || (purchase && purchase.poNumber !== '-' ? purchase.poNumber : null) || (String(log.docNo || log.documentNo || '').startsWith('PO-') ? (log.docNo || log.documentNo) : null);
                            return (
                              <div>
                                <span className="font-mono font-bold text-slate-800">{normalizedDocNo}</span>
                                {parentPo && parentPo !== '-' && parentPo !== normalizedDocNo && (
                                  <div className="text-[11px] text-slate-400 font-sans">อ้างอิง: {parentPo}</div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* 4. Quantity */}
                        <td className={`py-3 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                          isIncoming ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {isIncoming
                            ? `+${Math.abs(Number(log.changeQty ?? log.quantity ?? log.qty ?? 0)).toLocaleString()}`
                            : `-${Math.abs(Number(log.changeQty ?? log.quantity ?? log.qty ?? 0)).toLocaleString()}`}
                        </td>

                        {/* 5. Balance */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {Number(log.balanceAfter ?? log.balance ?? 0).toLocaleString()}
                        </td>

                        {/* 6. PO Number */}
                        <td className="py-3 px-3 font-mono text-xs whitespace-nowrap text-left">
                          {isIncoming && ((log.poNo && log.poNo !== '-') || (log.poNumber && log.poNumber !== '-') || (purchase && purchase.poNumber !== '-')) ? (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 font-bold text-indigo-700 border border-indigo-200/70">
                              {(log.poNo && log.poNo !== '-') ? log.poNo : ((log.poNumber && log.poNumber !== '-') ? log.poNumber : purchase.poNumber)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>

                        {/* 7. Total Purchase Amount */}
                        <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                          {isIncoming && log.totalAmount !== undefined && Number(log.totalAmount) > 0 ? (
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(log.totalAmount)} ฿
                            </span>
                          ) : isIncoming && purchase.totalPurchaseAmount !== '-' ? (
                            <span className="font-semibold text-slate-900">
                              {purchase.totalPurchaseAmount}
                            </span>
                          ) : isIncoming && log.totalPrice !== undefined && Number(log.totalPrice) > 0 ? (
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(log.totalPrice)} ฿
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>

                        {/* 8. Average Unit Price */}
                        <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                          {isIncoming && log.unitPrice !== undefined && Number(log.unitPrice) > 0 ? (
                            <span className="font-semibold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">
                              ฿{formatCurrency(log.unitPrice)} / {selectedProduct?.stockUnit || selectedProduct?.unit || log.unit || 'ชิ้น'}
                            </span>
                          ) : isIncoming && purchase.avgUnitPrice !== '-' ? (
                            <span className="font-semibold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">
                              {purchase.avgUnitPrice}
                            </span>
                          ) : isIncoming && log.baseUnitCost !== undefined && Number(log.baseUnitCost) > 0 ? (
                            <span className="font-semibold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">
                              ฿{formatCurrency(log.baseUnitCost)} / {selectedProduct?.stockUnit || selectedProduct?.unit || log.unit || 'ชิ้น'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>

                        {/* 9. User */}
                        <td className="py-3 px-3 text-slate-700 text-xs whitespace-nowrap">
                          {log.actorName || log.user || '-'}
                        </td>

                        {/* 10. Note: With Full Tooltip and "ดูโน้ต" button for long notes */}
                        <td className="py-3 pr-5 text-slate-600 text-xs">
                          {!noteText ? (
                            <span className="text-slate-300">-</span>
                          ) : (
                            <div className="flex items-center gap-1.5 max-w-[200px]">
                              <span className="truncate text-slate-600" title={noteText}>
                                {noteText}
                              </span>
                              {isNoteLong && (
                                <button
                                  type="button"
                                  onClick={() => setActiveNoteModal({
                                    docNo: normalizedDocNo,
                                    date: formatDateTimeThai(rawDate),
                                    note: noteText
                                  })}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200/80 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                                  title="คลิกเพื่อดูโน้ตเต็ม"
                                >
                                  ดูโน้ต
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination & Summary Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 pt-1 text-xs text-slate-500 select-none">
            {/* Left: Item Range Summary & Page Size selector */}
            <div className="flex items-center gap-3">
              <span>
                แสดง <span className="font-mono font-semibold text-slate-800">{productMovementLogs.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}</span> - <span className="font-mono font-semibold text-slate-800">{Math.min(safeCurrentPage * pageSize, productMovementLogs.length)}</span> จากทั้งหมด <span className="font-mono font-semibold text-slate-800">{productMovementLogs.length}</span> รายการ
              </span>
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <span className="text-[11px] text-slate-400">แสดงหน้าละ:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-mono font-semibold rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                </select>
              </div>
            </div>

            {/* Right: Page Navigation Buttons < 1 2 3 > */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {getPageNumbers().map((pg, idx) => (
                  pg === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 select-none">...</span>
                  ) : (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setCurrentPage(pg)}
                      className={`min-w-6 h-6 px-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        safeCurrentPage === pg
                          ? 'bg-indigo-600 text-white shadow-xs font-bold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {pg}
                    </button>
                  )
                ))}

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100">
            <span>* คอลัมน์ข้อมูลจัดซื้อ (เลขที่ PO, จำนวนเงิน, ราคาเฉลี่ย) จะแสดงเฉพาะรายการรับเข้าสินค้า (+IN)</span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>

          {/* Note Details Modal / Popover */}
          {activeNoteModal && (
            <div
              className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setActiveNoteModal(null)}
            >
              <div
                className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 animate-zoom-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">หมายเหตุ / บันทึก</h4>
                      <div className="text-[11px] text-slate-400 font-mono">
                        เอกสาร: {activeNoteModal.docNo} • {activeNoteModal.date}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveNoteModal(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="py-3.5 my-3 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words bg-slate-50 p-3 rounded-xl border border-slate-100 font-sans">
                  {activeNoteModal.note}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveNoteModal(null)}
                    className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </Portal>
  );
}
