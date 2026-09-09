import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { ISSUE_LOCATIONS, ISSUE_LOCATION_CONFIG, INITIAL_USAGE_UNITS } from '../config/constants';
import { hasDepartmentAccess, getUserAccessibleDepartments } from '../utils/permissions';
import { 
  SendToBack, CheckCircle2, AlertCircle, AlertTriangle, 
  PackageCheck, Layers, MapPin, Clock, ArrowRight,
  History, Boxes, Building2, User, Sparkles, PlusCircle, Check,
  BarChart2, Calendar, Filter, Search, Download, ChevronRight,
  LayoutGrid, ListFilter, SlidersHorizontal, DoorClosed, Briefcase,
  FileSpreadsheet, ArrowUpRight, ArrowDownRight, Tag, PieChart,
  RefreshCw, TrendingUp, HelpCircle
} from 'lucide-react';
import SearchableSelect from '../components/common/SearchableSelect';

const ISSUE_REASONS = [
  'เบิกใช้ในสายการผลิต (Production Line)',
  'เบิกสำหรับสุ่มทดสอบ QC / Lab Test',
  'เบิกสำหรับงานซ่อมบำรุง (Maintenance / PM)',
  'เบิกใช้ทั่วไปภายในแผนก',
  'ปรับปรุงยอดสินค้าชำรุด / เสื่อมสภาพ',
  'อื่นๆ (ระบุในหมายเหตุ)'
];

// Helper to reliably parse date from stock logs
const parseLogDate = (log) => {
  if (!log) return new Date();
  if (log.date) {
    if (/^\d{4}-\d{2}-\d{2}/.test(log.date)) {
      return new Date(log.date);
    }
    const parts = log.date.split(',')[0].trim().split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts.map(n => parseInt(n, 10));
      if (y > 2500) y -= 543;
      return new Date(y, m - 1, d);
    }
  }
  if (log.timestamp) {
    if (/^\d{4}-\d{2}-\d{2}/.test(log.timestamp)) return new Date(log.timestamp);
    const parts = log.timestamp.split(' ')[0].trim().split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts.map(n => parseInt(n, 10));
      if (y > 2500) y -= 543;
      return new Date(y, m - 1, d);
    }
  }
  return new Date();
};

// Helper to extract unit / room name from log
const getLogUnit = (log) => {
  if (log.issueUnit && log.issueUnit.trim()) return log.issueUnit.trim();
  if (log.note) {
    const match = log.note.match(/\[(.*?)\]/);
    if (match && match[1]) {
      const parsed = match[1].trim();
      if (parsed.includes('1') || parsed.includes('Mixing')) return 'ห้อง K1';
      if (parsed.includes('2') || parsed.includes('Filling')) return 'ห้อง K2';
      if (parsed.includes('3') || parsed.includes('Packing')) return 'ห้องแพ็ค';
      return parsed;
    }
  }
  return 'ไม่ระบุหน่วย';
};

export default function QuickIssueView({
  products = [],
  stockLogs = [],
  usageUnits: propUsageUnits,
  currentRole,
  currentUser: propCurrentUser,
  onRefresh,
  onNavigate,
  onQuickPR
}) {
  const user = propCurrentUser || currentRole || {};
  const userAccessibleDepts = useMemo(() => {
    return getUserAccessibleDepartments(user, ['PD', 'QC']);
  }, [user]);
  const hasMultiDeptAccess = userAccessibleDepts.length > 1;

  const [activeTab, setActiveTab] = useState('ISSUE'); // 'ISSUE' | 'STATS'

  const allUsageUnits = useMemo(() => {
    if (propUsageUnits && propUsageUnits.length > 0) return propUsageUnits;
    return INITIAL_USAGE_UNITS;
  }, [propUsageUnits]);

  // Usage units strictly filtered by user's permitted departments
  const userAllowedUnits = useMemo(() => {
    return allUsageUnits.filter(u => hasDepartmentAccess(user, u.department));
  }, [allUsageUnits, user]);

  // Form State
  const [categoryFilter, setCategoryFilter] = useState(() => hasMultiDeptAccess ? 'ALL' : (userAccessibleDepts[0] || user?.department || 'PD'));
  const [selectedProdId, setSelectedProdId] = useState('');
  const [issueQty, setIssueQty] = useState(1);
  const [reason, setReason] = useState(ISSUE_REASONS[0]);
  const [note, setNote] = useState('');
  const [productionUnit, setProductionUnit] = useState('ห้อง K1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Statistics & Analytics Filter State
  const [statsUnitFilter, setStatsUnitFilter] = useState('ALL'); // 'ALL' | 'ห้อง K1' | ...
  const [statsTimeFilter, setStatsTimeFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
  const [statsCustomStart, setStatsCustomStart] = useState('');
  const [statsCustomEnd, setStatsCustomEnd] = useState('');
  const [statsDeptFilter, setStatsDeptFilter] = useState(() => hasMultiDeptAccess ? 'ALL' : (userAccessibleDepts[0] || user?.department || 'PD'));
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [statsViewMode, setStatsViewMode] = useState('UNITS'); // 'UNITS' (Card breakdown) | 'MATRIX' (Item x Unit table) | 'LOGS' (Detailed table)

  // Synchronize department & unit filters when user/role changes (Fast Switcher)
  useEffect(() => {
    const initialDept = hasMultiDeptAccess ? 'ALL' : (userAccessibleDepts[0] || user?.department || 'PD');
    setStatsDeptFilter(initialDept);
    setStatsUnitFilter('ALL');
    setCategoryFilter(hasMultiDeptAccess ? 'ALL' : (userAccessibleDepts[0] || user?.department || 'PD'));
  }, [user?.id, user?.username, hasMultiDeptAccess, userAccessibleDepts, user?.department]);

  // Department and Category Filtered Products
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        const pCat = p.category || p.department || 'PD';
        const matchesDept = hasDepartmentAccess(user, pCat);
        const matchesCat = categoryFilter === 'ALL' || pCat === categoryFilter;
        return matchesDept && matchesCat;
      })
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [products, user, categoryFilter]);

  // Transform to SearchableSelect options
  const productOptions = useMemo(() => {
    return filteredProducts.map(p => {
      const sUnit = p.stockUnit || p.unit || 'ชิ้น';
      const pUnit = p.purchaseUnit || p.unit || sUnit;
      const rate = Number(p.conversionRate) > 0 ? Number(p.conversionRate) : 1;
      const dualText = rate > 1 
        ? ` • (≈ ${((p.stockBalance || 0) / rate).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} ${pUnit})` 
        : '';
      const pCat = p.category || p.department || 'PD';
      return {
        value: p.id,
        label: p.name,
        code: p.code,
        subLabel: `จุดเก็บ: ${p.locationName || 'คลังหลัก'} • คงเหลือ: ${Number(p.stockBalance || 0).toLocaleString()} ${sUnit}${dualText} • ROP: ${Number(p.reorderPoint || 0).toLocaleString()} ${sUnit}`,
        badge: pCat === 'PD' ? 'ฝ่ายผลิต' : 'ฝ่าย QC',
        keywords: `${p.code} ${p.name} ${sUnit} ${pUnit} ${pCat} ${p.locationName || ''}`
      };
    });
  }, [filteredProducts]);

  // Set initial product if not set
  React.useEffect(() => {
    if (filteredProducts.length > 0 && (!selectedProdId || !filteredProducts.some(p => p.id === selectedProdId))) {
      setSelectedProdId(filteredProducts[0].id);
    }
  }, [filteredProducts, selectedProdId]);

  const selectedProduct = filteredProducts.find(p => p.id === selectedProdId) || products.find(p => p.id === selectedProdId);

  // Target department for form based on selected product or current role
  const formDept = useMemo(() => {
    if (selectedProduct?.category) return selectedProduct.category;
    if (selectedProduct?.department) return selectedProduct.department;
    if (currentRole?.department && !currentRole.canViewAllDepts) return currentRole.department;
    return categoryFilter !== 'ALL' ? categoryFilter : 'PD';
  }, [selectedProduct, currentRole, categoryFilter]);

  // Dynamic usage units for form tab (Department-Scoped)
  const formUsageUnits = useMemo(() => {
    const matched = allUsageUnits.filter(u => u.department === formDept && u.status !== 'INACTIVE');
    if (matched.length > 0) return matched;
    const fallbackDept = allUsageUnits.filter(u => u.department === formDept);
    if (fallbackDept.length > 0) return fallbackDept;
    return allUsageUnits;
  }, [allUsageUnits, formDept]);

  // Dynamic displayed units for Statistics Tab based on dropdown filter
  const displayedUnits = useMemo(() => {
    if (statsDeptFilter === 'ALL') {
      return userAllowedUnits;
    }
    return userAllowedUnits.filter(u => u.department === statsDeptFilter);
  }, [userAllowedUnits, statsDeptFilter]);

  // Dynamic usage unit config map for styling & dots
  const usageUnitConfigMap = useMemo(() => {
    const map = { ...ISSUE_LOCATION_CONFIG };
    allUsageUnits.forEach(u => {
      map[u.name] = {
        id: u.name,
        label: u.name,
        color: u.color || 'bg-slate-100 text-slate-700 border-slate-200',
        badgeBg: u.badgeBg || 'bg-slate-100 text-slate-800',
        dot: u.dot || 'bg-slate-500',
        department: u.department
      };
    });
    return map;
  }, [allUsageUnits]);

  // Auto-select first unit of the department when department changes or current selection is invalid
  useEffect(() => {
    if (formUsageUnits.length > 0) {
      const exists = formUsageUnits.some(u => u.name === productionUnit);
      if (!exists) {
        setProductionUnit(formUsageUnits[0].name);
      }
    }
  }, [formUsageUnits, productionUnit]);

  // Reset statsUnitFilter if it does not belong to displayedUnits
  useEffect(() => {
    if (statsUnitFilter !== 'ALL') {
      const exists = displayedUnits.some(u => u.name === statsUnitFilter);
      if (!exists) setStatsUnitFilter('ALL');
    }
  }, [displayedUnits, statsUnitFilter]);

  // Post-issue balance calculation & ROP Warning logic
  const currentBalance = Number(selectedProduct?.stockBalance || 0);
  const qtyNumber = Number(issueQty || 0);
  const postIssueBalance = Math.round((currentBalance - qtyNumber) * 10000) / 10000;
  const reorderPoint = Number(selectedProduct?.reorderPoint || 0);
  const willTriggerROP = selectedProduct && postIssueBalance <= reorderPoint && postIssueBalance >= 0;
  const isOutOfStock = selectedProduct && postIssueBalance < 0;

  const sUnit = selectedProduct?.stockUnit || selectedProduct?.unit || 'ชิ้น';
  const pUnit = selectedProduct?.purchaseUnit || selectedProduct?.unit || sUnit;
  const rate = Number(selectedProduct?.conversionRate) > 0 ? Number(selectedProduct.conversionRate) : 1;

  // Recent OUT stock logs for this department (Live sidebar)
  const recentIssueLogs = useMemo(() => {
    return stockLogs
      .filter(log => {
        if (log.type !== 'OUT') return false;
        if (currentRole.canViewAllDepts) return true;
        const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
        return prod ? prod.category === currentRole.department : true;
      })
      .slice(0, 6);
  }, [stockLogs, products, currentRole]);

  const handleQuickQty = (amount) => {
    if (amount === 'max') {
      setIssueQty(currentBalance > 0 ? currentBalance : 1);
    } else {
      setIssueQty(prev => {
        const next = Math.round((Number(prev || 0) + amount) * 10000) / 10000;
        return Math.min(Math.max(0.01, next), Math.max(0.01, currentBalance));
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!selectedProdId) {
      return setErrorMsg('กรุณาเลือกสินค้าที่ต้องการเบิกจ่าย');
    }

    if (!productionUnit) {
      return setErrorMsg('กรุณาเลือกหน่วยที่ต้องการเบิก');
    }

    if (qtyNumber <= 0) {
      return setErrorMsg('จำนวนที่ต้องการเบิกต้องมากกว่า 0');
    }

    if (currentBalance < qtyNumber) {
      return setErrorMsg(`จำนวนที่ขอเบิก (${qtyNumber} ${sUnit}) เกินกว่ายอดคงเหลือในคลัง (${currentBalance} ${sUnit})`);
    }

    setIsSubmitting(true);
    try {
      const fullNote = `[${productionUnit}] ${reason}${note.trim() ? ` — ${note.trim()}` : ''}`;
      await apiService.quickIssueStock(selectedProdId, qtyNumber, currentRole, fullNote, productionUnit);
      setSuccessMsg(`เบิกสินค้า [${selectedProduct.name}] สำหรับ ${productionUnit} จำนวน ${qtyNumber} ${sUnit} สำเร็จ! ยอดสต็อกตัดจ่ายเรียบร้อย`);
      setIssueQty(1);
      setNote('');
      onRefresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Filtered OUT Logs for Statistics ───
  const filteredStatsLogs = useMemo(() => {
    let logs = stockLogs.filter(log => log.type === 'OUT');

    // Role department permission filter
    logs = logs.filter(log => {
      const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
      const prodCat = prod?.category || prod?.department || log.department;
      return hasDepartmentAccess(user, prodCat);
    });

    // UI Department filter
    if (statsDeptFilter !== 'ALL') {
      logs = logs.filter(log => {
        const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
        const prodCat = prod?.category || prod?.department || log.department;
        return prodCat === statsDeptFilter;
      });
    }

    // Unit filter
    if (statsUnitFilter !== 'ALL') {
      logs = logs.filter(log => getLogUnit(log) === statsUnitFilter);
    }

    // Time filter
    const now = new Date();
    logs = logs.filter(log => {
      const logDate = parseLogDate(log);

      if (statsTimeFilter === 'TODAY') {
        return logDate.toDateString() === now.toDateString();
      } else if (statsTimeFilter === 'WEEK') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        return logDate >= weekAgo;
      } else if (statsTimeFilter === 'MONTH') {
        return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
      } else if (statsTimeFilter === 'LAST_MONTH') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return logDate.getMonth() === lastMonth && logDate.getFullYear() === year;
      } else if (statsTimeFilter === 'CUSTOM') {
        if (statsCustomStart) {
          const start = new Date(statsCustomStart);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) return false;
        }
        if (statsCustomEnd) {
          const end = new Date(statsCustomEnd);
          end.setHours(23, 59, 59, 999);
          if (logDate > end) return false;
        }
      }
      return true;
    });

    // Search filter
    if (statsSearchQuery.trim()) {
      const q = statsSearchQuery.trim().toLowerCase();
      logs = logs.filter(log => {
        const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
        const name = prod?.name?.toLowerCase() || '';
        const code = log.productCode?.toLowerCase() || '';
        const note = log.note?.toLowerCase() || '';
        const actor = log.user?.toLowerCase() || '';
        const unit = getLogUnit(log).toLowerCase();
        return name.includes(q) || code.includes(q) || note.includes(q) || actor.includes(q) || unit.includes(q);
      });
    }

    return logs;
  }, [stockLogs, products, user, statsUnitFilter, statsTimeFilter, statsCustomStart, statsCustomEnd, statsDeptFilter, statsSearchQuery]);

  // ─── Aggregated Statistics Calculations ───
  const analytics = useMemo(() => {
    const totalIssues = filteredStatsLogs.length;
    const totalQty = filteredStatsLogs.reduce((sum, log) => sum + (Number(log.qty) || 0), 0);

    // 1. Group by Unit
    const unitMap = {};
    displayedUnits.forEach(u => {
      unitMap[u.name] = {
        name: u.name,
        department: u.department,
        color: u.color,
        badgeBg: u.badgeBg,
        dot: u.dot,
        count: 0,
        totalQty: 0,
        items: {},
        lastIssued: null
      };
    });

    filteredStatsLogs.forEach(log => {
      const unitName = getLogUnit(log);
      if (!unitMap[unitName]) {
        const found = allUsageUnits.find(u => u.name === unitName);
        unitMap[unitName] = {
          name: unitName,
          department: found?.department || 'ALL',
          color: found?.color || 'bg-slate-100 text-slate-700',
          badgeBg: found?.badgeBg || 'bg-slate-100 text-slate-800',
          dot: found?.dot || 'bg-slate-500',
          count: 0,
          totalQty: 0,
          items: {},
          lastIssued: null
        };
      }
      unitMap[unitName].count += 1;
      unitMap[unitName].totalQty += Number(log.qty) || 0;

      const pCode = log.productCode || log.productId || 'UNKNOWN';
      const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
      const pName = prod?.name || pCode;
      const pUnit = prod?.stockUnit || prod?.unit || log.unit || 'ชิ้น';
      const dept = prod?.category || 'PD';

      if (!unitMap[unitName].items[pCode]) {
        unitMap[unitName].items[pCode] = {
          code: pCode,
          name: pName,
          unit: pUnit,
          dept: dept,
          qty: 0,
          count: 0,
          lastDate: log.date || '-'
        };
      }
      unitMap[unitName].items[pCode].qty += Number(log.qty) || 0;
      unitMap[unitName].items[pCode].count += 1;
      unitMap[unitName].items[pCode].lastDate = log.date || unitMap[unitName].items[pCode].lastDate;
    });

    const unitList = Object.values(unitMap).map(u => ({
      ...u,
      topItems: Object.values(u.items).sort((a, b) => b.qty - a.qty),
      uniqueItemCount: Object.keys(u.items).length
    })).sort((a, b) => b.count - a.count);

    // Most active unit
    const mostActiveUnit = unitList.find(u => u.count > 0) || null;

    // 2. Group by Product (Top products across all filtered logs)
    const productMap = {};
    filteredStatsLogs.forEach(log => {
      const code = log.productCode || 'UNKNOWN';
      const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
      const name = prod?.name || code;
      const unit = prod?.stockUnit || prod?.unit || log.unit || 'ชิ้น';
      const dept = prod?.category || 'PD';

      if (!productMap[code]) {
        productMap[code] = {
          code,
          name,
          unit,
          dept,
          qty: 0,
          count: 0,
          usedInUnits: {}
        };
      }
      productMap[code].qty += Number(log.qty) || 0;
      productMap[code].count += 1;

      const unitName = getLogUnit(log);
      productMap[code].usedInUnits[unitName] = (productMap[code].usedInUnits[unitName] || 0) + (Number(log.qty) || 0);
    });

    const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty);
    const mostIssuedProduct = topProducts[0] || null;

    // 3. Matrix of (Unit x Product) rows
    const matrixRows = [];
    Object.values(unitMap).forEach(u => {
      Object.values(u.items).forEach(item => {
        matrixRows.push({
          unitName: u.name,
          ...item,
          pctOfTotal: totalQty > 0 ? ((item.qty / totalQty) * 100).toFixed(1) : 0
        });
      });
    });
    matrixRows.sort((a, b) => b.qty - a.qty);

    return {
      totalIssues,
      totalQty,
      unitList,
      mostActiveUnit,
      topProducts,
      mostIssuedProduct,
      matrixRows,
      uniqueProductCount: topProducts.length
    };
  }, [filteredStatsLogs, products]);

  // Unit count badges for quick filter pills
  const unitBadgeCounts = useMemo(() => {
    const counts = { ALL: 0 };
    displayedUnits.forEach(u => { counts[u.name] = 0; });
    stockLogs.forEach(log => {
      if (log.type === 'OUT') {
        const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
        const prodCat = prod?.category || prod?.department || log.department;
        if (!hasDepartmentAccess(user, prodCat)) return;
        if (statsDeptFilter !== 'ALL' && prodCat !== statsDeptFilter) return;

        const u = getLogUnit(log);
        if (counts[u] !== undefined) {
          counts[u] += 1;
          counts.ALL = (counts.ALL || 0) + 1;
        }
      }
    });
    return counts;
  }, [stockLogs, displayedUnits, products, user, statsDeptFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    if (analytics.matrixRows.length === 0) return;
    const headers = ['หน่วยที่เบิก', 'รหัสสินค้า', 'ชื่อสินค้า', 'แผนก', 'จำนวนครั้งที่เบิก', 'ยอดรวมที่เบิก', 'หน่วยนับ', 'เบิกล่าสุด'];
    const rows = analytics.matrixRows.map(r => [
      `"${r.unitName}"`,
      `"${r.code}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.dept}"`,
      r.count,
      r.qty,
      `"${r.unit}"`,
      `"${r.lastDate}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_Issue_Statistics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in-up pb-10">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="p-2.5 bg-slate-950 text-white rounded-2xl shadow-sm shadow-slate-900/10">
              <SendToBack className="w-5 h-5" />
            </div>
            <span>เบิกสินค้าออกจากสต็อก (Quick Issue)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            บันทึกตัดยอดสต็อกสินค้าทันที (-OUT) พร้อมจำลองสต็อกคงเหลือแบบ Real-time
          </p>
        </div>

        {/* Department Badge with Glowing Dot */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-full border border-slate-200/80 shadow-2xs w-fit text-xs font-medium text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shrink-0" />
          <span className="text-slate-500">สิทธิ์การเบิก:</span>
          <span className="font-semibold text-slate-900">
            {currentRole.department === 'ALL' ? 'ทุกแผนก (ALL)' : `แผนก ${currentRole.department}`}
          </span>
        </div>
      </div>

      {/* ── Alert Notifications ── */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 rounded-2xl flex items-center justify-between gap-2.5 text-xs font-medium shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50/80 border border-rose-200/80 text-rose-900 rounded-2xl flex items-center justify-between gap-2.5 text-xs font-medium shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-700 hover:text-rose-900 text-xs cursor-pointer font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {/* ── Floating Capsule Bar Navigation ── */}
      <div className="flex items-center">
        <div className="bg-slate-100/90 p-1.5 rounded-full inline-flex gap-1 border border-slate-200/50 shadow-2xs">
          <button
            onClick={() => setActiveTab('ISSUE')}
            className={`transition-all cursor-pointer flex items-center gap-2 text-xs sm:text-sm ${
              activeTab === 'ISSUE' 
                ? 'bg-white shadow-sm font-semibold text-slate-900 rounded-full px-5 py-2' 
                : 'text-slate-500 hover:text-slate-900 font-medium px-5 py-2 rounded-full'
            }`}
          >
            <SendToBack className="w-4 h-4" />
            <span>ฟอร์มเบิกสินค้า</span>
          </button>
          <button
            onClick={() => setActiveTab('STATS')}
            className={`transition-all flex items-center gap-2 cursor-pointer text-xs sm:text-sm ${
              activeTab === 'STATS' 
                ? 'bg-white shadow-sm font-semibold text-slate-900 rounded-full px-5 py-2' 
                : 'text-slate-500 hover:text-slate-900 font-medium px-5 py-2 rounded-full'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>สถิติการใช้งาน & วิเคราะห์ตามหน่วย</span>
            {stockLogs.filter(l => l.type === 'OUT').length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-900 text-white ml-0.5">
                {stockLogs.filter(l => l.type === 'OUT').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'ISSUE' ? (
      /* ─────────────────────────────────────────────────────────────
         TAB 1: QUICK ISSUE FORM
         ───────────────────────────────────────────────────────────── */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column: Issue Form (7 cols = 60%) ── */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-7 space-y-6">
          
          {/* Department Filter Toggle */}
          <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100 flex-wrap">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>ระบุข้อมูลการเบิกจ่ายสินค้า</span>
            </span>

            {currentRole.canViewAllDepts && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 text-xs">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    categoryFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ทั้งหมด ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('PD')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    categoryFilter === 'PD' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ฝ่ายผลิต (PD)
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('QC')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    categoryFilter === 'QC' ? 'bg-white text-amber-700 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ฝ่าย QC
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 0. Unit / Room Selector (Tactile Capsule Chips) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <DoorClosed className="w-4 h-4 text-indigo-600" />
                  <span>หน่วยที่เบิก / พื้นที่ใช้งาน (Location / Unit)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-normal">เลือกห้องหรือพื้นที่ที่นำสินค้าไปใช้</span>
              </div>

              {/* Visual Tactile Capsule Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {formUsageUnits.map(unit => {
                  const isSelected = productionUnit === unit.name;
                  const dot = unit.dot || 'bg-slate-500';
                  const color = unit.color || 'bg-slate-50 text-slate-700 border-slate-200/80';
                  return (
                    <button
                      key={unit.id || unit.name}
                      type="button"
                      onClick={() => setProductionUnit(unit.name)}
                      className={`px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all text-center flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15 ring-2 ring-slate-900/10'
                          : `${color} hover:border-slate-300 shadow-2xs`
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-emerald-400 shadow-xs ring-2 ring-white/20' : dot}`} />
                      <span className="truncate">{unit.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. Product Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span>เลือกสินค้าจากคลัง <span className="text-rose-500">*</span></span>
                {selectedProduct && (
                  <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                    {selectedProduct.code}
                  </span>
                )}
              </label>
              <SearchableSelect
                options={productOptions}
                value={selectedProdId}
                onChange={val => setSelectedProdId(val)}
                placeholder="-- พิมพ์ชื่อสินค้า หรือรหัสสินค้า --"
                searchPlaceholder="พิมพ์ชื่อสินค้า, รหัส, หรือตำแหน่งจัดเก็บ..."
                emptyMessage="ไม่พบสินค้าที่ตรงกับการค้นหา"
                required
              />
              
              {/* Compact Micro-badge Info Strip */}
              {selectedProduct && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-normal px-1">
                  <div className="flex items-center gap-2">
                    {rate > 1 && (
                      <span className="text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100 font-mono text-[10px]">
                        1 {pUnit} = {rate} {sUnit}
                      </span>
                    )}
                    <span className="text-slate-500">
                      จุดจัดเก็บ: <strong className="text-slate-700 font-medium">{selectedProduct.locationName || 'คลังหลัก'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>จุดสั่งซื้อ ROP:</span>
                    <strong className="text-amber-800 font-mono font-medium">{Number(reorderPoint).toLocaleString()} {sUnit}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Modern Quantity Stepper & Stock Simulation */}
            <div className="space-y-3 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  <span>จำนวนที่ต้องการเบิก ({sUnit})</span>
                  <span className="text-rose-500">*</span>
                </label>
                
                {/* Glassy Micro-pills Quick Steppers */}
                <div className="flex items-center gap-1.5">
                  {[1, 5, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleQuickQty(n)}
                      className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer border border-slate-200/40 text-slate-600"
                    >
                      +{n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleQuickQty('max')}
                    className="bg-slate-100 hover:bg-amber-50 hover:text-amber-700 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer border border-slate-200/40 text-slate-700 flex items-center gap-1"
                  >
                    <span>⚡ Max</span>
                  </button>
                </div>
              </div>

              {/* Large Stepper Input (Center/Left High Contrast) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={Math.max(0.001, currentBalance)}
                  value={issueQty}
                  onChange={e => setIssueQty(e.target.value)}
                  required
                  placeholder="0"
                  className="w-full font-mono text-3xl font-bold text-slate-900 outline-none bg-transparent px-2"
                />
                <span className="font-medium text-xs text-slate-500 px-3 py-1 bg-slate-100 rounded-xl shrink-0">
                  {sUnit}
                </span>
              </div>

              {/* Live Simulation Bar: Current -> Post Issue */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>สต็อกเดิม:</span>
                    <span className="font-mono font-medium text-slate-800">{Number(currentBalance).toLocaleString()} {sUnit}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-500">หลังเบิกจริง:</span>
                    <span className={`font-mono font-bold ${postIssueBalance < 0 ? 'text-rose-600' : postIssueBalance <= reorderPoint ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {Number(postIssueBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })} {sUnit}
                    </span>
                  </div>
                </div>

                {/* Progress bar visualizer */}
                <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      postIssueBalance < 0 
                        ? 'bg-rose-500' 
                        : postIssueBalance <= reorderPoint 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    }`}
                    style={{ 
                      width: `${currentBalance > 0 ? Math.max(0, Math.min(100, (postIssueBalance / currentBalance) * 100)) : 0}%` 
                    }}
                  />
                  {qtyNumber > 0 && currentBalance > 0 && postIssueBalance >= 0 && (
                    <div 
                      className="h-full bg-slate-300 opacity-60 transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (qtyNumber / currentBalance) * 100)}%` 
                      }}
                      title={`กำลังจะเบิกออก ${qtyNumber} ${sUnit}`}
                    />
                  )}
                </div>
              </div>

              {/* Status alerts */}
              {isOutOfStock ? (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-normal">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>จำนวนที่ขอเบิกเกินยอดคงเหลือในคลัง ({currentBalance} {sUnit})</span>
                </div>
              ) : willTriggerROP ? (
                <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl flex items-start gap-2 text-amber-900 text-xs font-normal">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    หลังเบิกยอดจะเหลือ <strong>{postIssueBalance} {sUnit}</strong> ซึ่งแตะจุดสั่งซื้อ ROP ({reorderPoint} {sUnit})
                  </span>
                </div>
              ) : null}
            </div>

            {/* 3. Reason Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span>วัตถุประสงค์การเบิก <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer"
              >
                {ISSUE_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* 4. Additional Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="เช่น กะดึก, ซ่อมบำรุงเครื่องจักร No.3, หรืองานทดสอบพิเศษ..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>

            {/* 5. Hero Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isOutOfStock}
                className="w-full bg-slate-950 hover:bg-slate-900 text-white rounded-2xl py-4 font-semibold text-base shadow-xl shadow-slate-900/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <PackageCheck className="w-5 h-5 text-emerald-400" />
                <span>{isSubmitting ? 'กำลังบันทึกตัดยอด...' : `ยืนยันการเบิกจ่ายสินค้า (-OUT) สู่ ${productionUnit}`}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── Right Column: Product Snapshot & Recent Logs (5 cols = 40%) ── */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Bento Card - Selected Product Inventory Snapshot */}
          {selectedProduct && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  <span>ข้อมูลสต็อกสินค้า</span>
                </div>
                <span className="font-mono text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  {selectedProduct.code}
                </span>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-slate-900 leading-snug">
                  {selectedProduct.name}
                </h4>

                {/* 2-Column Pastel Bento Metrics */}
                <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                    <span className="text-slate-500 block text-[11px]">คงเหลือปัจจุบัน</span>
                    <span className="text-2xl font-bold text-slate-900 font-mono mt-1 block">
                      {Number(currentBalance).toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">{sUnit}</span>
                    </span>
                  </div>
                  <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-100/60">
                    <span className="text-amber-800 block text-[11px]">จุดสั่งซื้อ ROP</span>
                    <span className="text-2xl font-bold text-amber-800 font-mono mt-1 block">
                      {Number(reorderPoint).toLocaleString()} <span className="text-xs font-normal text-amber-600 font-sans">{sUnit}</span>
                    </span>
                  </div>
                </div>

                {/* Stock Level Progress Indicator */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>ระดับสต็อก</span>
                    <span className={currentBalance <= reorderPoint ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}>
                      {currentBalance <= reorderPoint ? 'แตะจุดสั่งซื้อ (Low Stock)' : 'พร้อมใช้งานปกติ'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        currentBalance <= reorderPoint ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(8, (currentBalance / Math.max(currentBalance, reorderPoint * 2)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 2: Bento Card - Recent Issue Activity Log */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>ประวัติการเบิกจ่ายล่าสุด</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">ล่าสุด {recentIssueLogs.length} รายการ</span>
            </div>

            {recentIssueLogs.length > 0 ? (
              <div className="divide-y divide-slate-100/80">
                {recentIssueLogs.map(log => {
                  const logUnit = getLogUnit(log);
                  const unitConf = usageUnitConfigMap[logUnit] || { color: 'bg-slate-100 text-slate-600 border-slate-200' };
                  return (
                    <div 
                      key={log.id} 
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${unitConf.color}`}>
                            {logUnit}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {log.productCode}
                          </span>
                          <span className="font-medium text-slate-800 truncate block text-xs" title={log.productCode}>
                            {products.find(p => p.id === log.productId || p.code === log.productCode)?.name || log.productCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate leading-relaxed">
                          {log.note || 'เบิกใช้งาน'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{log.date}</span>
                          <span>•</span>
                          <span>{log.user || 'ผู้เบิก'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                          -{log.qty} {products.find(p => p.id === log.productId || p.code === log.productCode)?.stockUnit || products.find(p => p.id === log.productId || p.code === log.productCode)?.unit || log.unit || 'ชิ้น'}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1 font-mono">คงเหลือ: {log.balance}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1.5">
                <PackageCheck className="w-7 h-7 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="font-normal text-slate-400">ยังไม่มีประวัติการเบิกจ่ายสินค้า</p>
              </div>
            )}
          </div>

        </div>

      </div>
      ) : (
      /* ─────────────────────────────────────────────────────────────
         TAB 2: COMPREHENSIVE USAGE STATISTICS & UNIT BREAKDOWN
         ───────────────────────────────────────────────────────────── */
      <div className="space-y-6 animate-fade-in">
        
        {/* ── Filter Toolbar ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">ตัวกรองสถิติการใช้งาน (Filters)</h3>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setStatsViewMode('UNITS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statsViewMode === 'UNITS'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>จำแนกตามหน่วย ({displayedUnits.length} หน่วย)</span>
              </button>
              <button
                type="button"
                onClick={() => setStatsViewMode('MATRIX')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statsViewMode === 'MATRIX'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>ตารางหน่วย × รายการสินค้า</span>
              </button>
              <button
                type="button"
                onClick={() => setStatsViewMode('LOGS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statsViewMode === 'LOGS'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>ประวัติทั้งหมด ({filteredStatsLogs.length})</span>
              </button>
            </div>
          </div>

          {/* 1. Unit Quick Filter Pills */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <DoorClosed className="w-3.5 h-3.5 text-indigo-600" />
                <span>เลือกดูหน่วยที่เบิก (Location Filter):</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">คลิกเลือกหน่วยเพื่อเจาะลึกเฉพาะห้องนั้นๆ</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatsUnitFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                  statsUnitFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>ทุกหน่วย (All Units)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${statsUnitFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {unitBadgeCounts.ALL || 0}
                </span>
              </button>

              {displayedUnits.map(unit => {
                const isSelected = statsUnitFilter === unit.name;
                const dot = unit.dot || 'bg-slate-500';
                const color = unit.color || 'bg-slate-100 text-slate-700 border-slate-200';
                const count = unitBadgeCounts[unit.name] || 0;
                return (
                  <button
                    key={unit.id || unit.name}
                    type="button"
                    onClick={() => setStatsUnitFilter(unit.name)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-indigo-500/20'
                        : `${color} hover:shadow-2xs`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-400' : dot}`} />
                    <span>{unit.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-white/80 text-slate-700 border border-slate-200/50'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Secondary Filter Bar: Time + Department + Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            
            {/* Time Filter Select */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">ช่วงเวลา (Time Period)</label>
              <select
                value={statsTimeFilter}
                onChange={e => setStatsTimeFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">ทั้งหมด (All Time)</option>
                <option value="TODAY">วันนี้ (Today)</option>
                <option value="WEEK">7 วันล่าสุด (Last 7 Days)</option>
                <option value="MONTH">เดือนนี้ (This Month)</option>
                <option value="LAST_MONTH">เดือนที่แล้ว (Last Month)</option>
                <option value="CUSTOM">กำหนดช่วงวันเอง (Custom Range)</option>
              </select>
            </div>

            {/* Department Filter (Scoped to User Permissions) */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">แผนกสินค้า (Department)</label>
              <select
                value={statsDeptFilter}
                onChange={e => setStatsDeptFilter(e.target.value)}
                disabled={!hasMultiDeptAccess}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-75 disabled:bg-slate-100/80 cursor-pointer disabled:cursor-not-allowed"
              >
                {hasMultiDeptAccess && (
                  <option value="ALL">ทุกแผนก (PD + QC)</option>
                )}
                {userAccessibleDepts.includes('PD') && (
                  <option value="PD">ฝ่ายผลิต (PD)</option>
                )}
                {userAccessibleDepts.includes('QC') && (
                  <option value="QC">ฝ่าย QC</option>
                )}
                {userAccessibleDepts.filter(d => d !== 'PD' && d !== 'QC').map(d => (
                  <option key={d} value={d}>แผนก {d}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="lg:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">ค้นหารายการ / รหัส / ผู้เบิก</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={statsSearchQuery}
                  onChange={e => setStatsSearchQuery(e.target.value)}
                  placeholder="พิมพ์ชื่อสินค้า, รหัสสินค้า, หมายเหตุ, หรือชื่อผู้เบิก..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                {statsSearchQuery && (
                  <button 
                    onClick={() => setStatsSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Custom Date Range Picker (Conditional) */}
            {statsTimeFilter === 'CUSTOM' && (
              <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-fade-in">
                <div>
                  <label className="text-[11px] font-semibold text-indigo-900 block mb-1">ตั้งแต่วันที่</label>
                  <input
                    type="date"
                    value={statsCustomStart}
                    onChange={e => setStatsCustomStart(e.target.value)}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-indigo-900 block mb-1">ถึงวันที่</label>
                  <input
                    type="date"
                    value={statsCustomEnd}
                    onChange={e => setStatsCustomEnd(e.target.value)}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Top 4 KPI Executive Summary Scorecards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* KPI 1: Total Issues */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">จำนวนครั้งที่เบิกจ่าย</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-1 tracking-tight">
                  {analytics.totalIssues}
                  <span className="text-xs font-semibold text-slate-400 ml-1.5 font-sans">ครั้ง</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                <History className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>ขอบเขต: {statsUnitFilter === 'ALL' ? 'ทุกหน่วย' : statsUnitFilter}</span>
              <span className="font-semibold text-indigo-600">Active Logs</span>
            </div>
          </div>

          {/* KPI 2: Total Items Quantity Out */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ปริมาณสินค้าตัดจ่ายรวม</p>
                <h3 className="text-2xl sm:text-3xl font-black text-rose-600 font-mono mt-1 tracking-tight">
                  {analytics.totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-xs font-semibold text-slate-400 ml-1.5 font-sans">หน่วย</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
                <SendToBack className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>ชนิดสินค้าที่เบิก:</span>
              <span className="font-bold text-slate-800 font-mono">{analytics.uniqueProductCount} ชนิด</span>
            </div>
          </div>

          {/* KPI 3: Top Active Unit */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">หน่วยที่เบิกใช้งานสูงสุด</p>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 truncate" title={analytics.mostActiveUnit?.name || '-'}>
                  {analytics.mostActiveUnit ? analytics.mostActiveUnit.name : '-'}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {analytics.mostActiveUnit ? `${analytics.mostActiveUnit.count} ครั้ง (${analytics.mostActiveUnit.totalQty.toLocaleString()} หน่วย)` : 'ไม่มีข้อมูล'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>อันดับ 1 ในการเบิก</span>
              <span className="font-semibold text-emerald-700">Top Consumer</span>
            </div>
          </div>

          {/* KPI 4: Top Product */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">สินค้าที่ถูกเบิกมากที่สุด</p>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1 truncate" title={analytics.mostIssuedProduct?.name || '-'}>
                  {analytics.mostIssuedProduct ? analytics.mostIssuedProduct.name : '-'}
                </h3>
                <p className="text-xs font-mono font-bold text-indigo-600 mt-0.5">
                  {analytics.mostIssuedProduct ? `${analytics.mostIssuedProduct.qty.toLocaleString()} ${analytics.mostIssuedProduct.unit} (${analytics.mostIssuedProduct.count} ครั้ง)` : 'ไม่มีข้อมูล'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 shadow-2xs">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>รหัส: {analytics.mostIssuedProduct?.code || '-'}</span>
              <span className="font-semibold text-amber-700">Top Item</span>
            </div>
          </div>

        </div>

        {/* ── View Mode 1: 5 Unit Comparison Cards & Breakdown ── */}
        {statsViewMode === 'UNITS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-indigo-600" />
                  <span>การใช้งานแยกตามหน่วยทั้ง {displayedUnits.length} หน่วย (Unit Breakdown)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  สรุปรายละเอียดว่าแต่ละห้องมีการเบิกสินค้าอะไรบ้าง และปริมาณการใช้งานในแต่ละห้อง
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>ส่งออกข้อมูล (CSV)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedUnits.map(unit => {
                const uData = analytics.unitList.find(u => u.name === unit.name) || {
                  name: unit.name,
                  count: 0,
                  totalQty: 0,
                  topItems: [],
                  uniqueItemCount: 0
                };
                const isCurrentFilter = statsUnitFilter === unit.name;
                const dot = unit.dot || 'bg-slate-500';
                const badgeBg = unit.badgeBg || 'bg-slate-200 text-slate-800';

                return (
                  <div
                    key={unit.id || unit.name}
                    className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 shadow-xs ${
                      isCurrentFilter 
                        ? 'border-indigo-600 ring-2 ring-indigo-500/10 shadow-sm' 
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full ${dot}`} />
                          <h4 className="font-bold text-sm text-slate-900">{unit.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${unit.department === 'PD' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {unit.department}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${badgeBg}`}>
                          {uData.count} ครั้ง
                        </span>
                      </div>

                      {/* Stat summary */}
                      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-500 block">ปริมาณเบิกรวม</span>
                          <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                            {uData.totalQty.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-500 block">จำนวนชนิดสินค้า</span>
                          <span className="text-base font-black text-indigo-700 font-mono mt-0.5 block">
                            {uData.uniqueItemCount} ชนิด
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Top items consumed in this unit */}
                    <div className="space-y-2 flex-1">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>สินค้าที่เบิกในห้องนี้</span>
                        <span>จำนวน</span>
                      </p>

                      {uData.topItems.length > 0 ? (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                          {uData.topItems.map((item, idx) => (
                            <div key={item.code} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50/70 hover:bg-slate-100/80 transition-colors">
                              <div className="min-w-0 pr-2 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono text-slate-400 font-semibold">{idx + 1}.</span>
                                  <span className="font-semibold text-slate-800 truncate block" title={item.name}>
                                    {item.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 block ml-3.5">
                                  {item.code} • เบิก {item.count} ครั้ง
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-800 text-xs shrink-0 bg-white px-2 py-0.5 rounded border border-slate-200/60">
                                {item.qty.toLocaleString()} {item.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
                          ยังไม่มีประวัติการเบิกในห้องนี้
                        </div>
                      )}
                    </div>

                    {/* Action Footer */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setStatsUnitFilter(unit?.name || unit?.id || '');
                          setStatsViewMode('MATRIX');
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>ดูตารางสินค้าของ {unit?.name || unit?.id}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── View Mode 2: Detailed Matrix (Unit × Product Aggregation) ── */}
        {statsViewMode === 'MATRIX' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-indigo-600" />
                  <span>ตารางสรุป "หน่วยไหนใช้งานอะไร" (Unit × Item Usage Matrix)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  แสดงรายการสินค้าที่แต่ละห้องเบิกไปใช้งาน พร้อมความถี่ ยอดรวม และสัดส่วน
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono font-semibold">
                  พบ {analytics.matrixRows.length} รายการ
                </span>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[550px] custom-scrollbar relative">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-2xs text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 pl-6">หน่วยที่เบิก (Location)</th>
                    <th className="py-3.5 px-4">รหัสสินค้า</th>
                    <th className="py-3.5 px-4">ชื่อสินค้า</th>
                    <th className="py-3.5 px-4 text-center">แผนก</th>
                    <th className="py-3.5 px-4 text-center">จำนวนครั้ง</th>
                    <th className="py-3.5 px-4 text-right">ยอดรวมที่เบิก</th>
                    <th className="py-3.5 px-4 text-right">สัดส่วน (%)</th>
                    <th className="py-3.5 px-4 text-right pr-6">เบิกล่าสุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.matrixRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        <PackageCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">ไม่พบข้อมูลการเบิกจ่ายตามเงื่อนไขที่เลือก</p>
                        <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนตัวกรองหน่วยหรือช่วงเวลาเพื่อดูข้อมูล</p>
                      </td>
                    </tr>
                  ) : (
                    analytics.matrixRows.map((row, idx) => {
                      const config = usageUnitConfigMap[row.unitName] || { color: 'bg-slate-100 text-slate-700', badgeBg: 'bg-slate-100 text-slate-800' };
                      return (
                        <tr key={`${row.unitName}-${row.code}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 pl-6">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${config.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${config.dot || 'bg-slate-500'}`} />
                              {row.unitName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700 text-xs">
                            {row.code}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 max-w-[280px] truncate" title={row.name}>
                            {row.name}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.dept === 'PD' ? 'bg-blue-50 text-blue-700 border border-blue-200/60' : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            }`}>
                              {row.dept}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                            {row.count} ครั้ง
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 text-sm">
                            {row.qty.toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">{row.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            <div className="flex items-center justify-end gap-1.5">
                              <span>{row.pctOfTotal}%</span>
                              <div className="w-10 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(5, row.pctOfTotal))}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right pr-6 text-xs text-slate-500 whitespace-nowrap">
                            {row.lastDate}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── View Mode 3: Detailed Transaction Issue Logs ── */}
        {statsViewMode === 'LOGS' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-indigo-600" />
                  <span>ประวัติรายการเบิกจ่ายรายครั้ง (Detailed Issue Logs)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  บันทึกประวัติการเบิกสินค้าตัดสต็อกทุกรายการพร้อมผู้ทำรายการและเวลา
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono font-semibold">
                  แสดง {filteredStatsLogs.length} รายการ
                </span>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[550px] custom-scrollbar relative">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-2xs text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 pl-6">วัน-เวลา</th>
                    <th className="py-3.5 px-4">เลขที่เอกสาร</th>
                    <th className="py-3.5 px-4">หน่วยที่เบิก</th>
                    <th className="py-3.5 px-4">สินค้า</th>
                    <th className="py-3.5 px-4 text-right">จำนวนที่เบิก</th>
                    <th className="py-3.5 px-4 text-right">คงเหลือ</th>
                    <th className="py-3.5 px-4">ผู้ทำรายการ</th>
                    <th className="py-3.5 px-4 pr-6">วัตถุประสงค์ / หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStatsLogs.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        <PackageCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">ไม่พบประวัติการเบิกจ่ายตามเงื่อนไขที่เลือก</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStatsLogs.map(log => {
                      const logUnit = getLogUnit(log);
                      const unitConf = usageUnitConfigMap[logUnit] || { color: 'bg-slate-100 text-slate-700 border-slate-200' };
                      const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 pl-6 text-slate-600 whitespace-nowrap text-xs">
                            {log.date}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                            {log.docNo}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border ${unitConf.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${unitConf.dot || 'bg-slate-500'}`} />
                              {logUnit}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-[220px]">
                            <span className="font-mono text-[11px] font-semibold text-slate-500 block">{log.productCode}</span>
                            <span className="font-semibold text-slate-800 truncate block text-xs" title={prod?.name || log.productCode}>
                              {prod?.name || log.productCode}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 text-sm whitespace-nowrap">
                            -{log.qty} <span className="text-xs font-normal text-slate-400 font-sans">{prod?.stockUnit || prod?.unit || log.unit || 'ชิ้น'}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                            {log.balance}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                            {log.user || 'ผู้เบิก'}
                          </td>
                          <td className="py-3 px-4 pr-6 text-xs text-slate-500 max-w-[200px] truncate" title={log.note}>
                            {log.note || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      )}

    </div>
  );
}

// Icon helper
function TableIcon(props) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
    </svg>
  );
}
