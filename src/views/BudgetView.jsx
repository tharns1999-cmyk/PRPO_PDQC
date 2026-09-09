import React, { useState, useMemo } from 'react';
import { DEPARTMENTS } from '../config/constants';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { modalService } from '../services/modalService';
import { 
  Wallet, ShieldAlert, TrendingUp,
  Building2, BarChart3, History,
  Edit2, Save, X, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, AlertTriangle, Layers, Calendar
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  Cell, PieChart as RechartsPieChart, Pie
} from 'recharts';

const RANGE_OPTIONS = [
  { value: 3, label: '3 ด.' },
  { value: 6, label: '6 ด.' },
  { value: 12, label: '12 ด.' },
  { value: 24, label: '24 ด.' }
];

export default function BudgetView({ budgetSummary, currentRole, prs = [], pos = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState(6);
  const [selectedDept, setSelectedDept] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editBaseValue, setEditBaseValue] = useState('');

  // Month & Year state (Defaults to current Date)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);

  const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Recalculate dynamic budget summary based on selected month (Zero-Based Budgeting)
  const dynamicSummary = useMemo(() => {
    return apiService.calculateBudgetSummary(selectedMonthKey);
  }, [selectedMonthKey, budgetSummary, prs, pos]);

  // Thai month names
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // Load budget transaction log (refund entries)
  const budgetTransactions = useMemo(() => storageService.getBudgetTransactions(), [pos, prs]);

  const handleEditSave = async (dept) => {
    if (!editBaseValue || isNaN(editBaseValue) || Number(editBaseValue) < 0) return;
    try {
      await apiService.updateBudget(dept, Number(editBaseValue), selectedMonthKey);
      setEditingBudget(null);
      if (onRefresh) onRefresh();
    } catch (e) {
      modalService.error('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกงบประมาณได้: ' + e.message);
    }
  };

  const currentMonthSummary = dynamicSummary?.current || {};

  const deptsToShow = selectedDept === 'ALL' 
    ? Object.keys(DEPARTMENTS)
    : [selectedDept];

  const canEditBudget = currentRole?.id === 'ADMIN' || currentRole?.canFinalApprove || currentRole?.canReview;

  // Analytics Calculations (6-Month Comparative Dataset & Category Breakdown)
  const analyticsData = useMemo(() => {
    const trendData = [];
    const tableData = [];

    if (dynamicSummary?.trends) {
      const allMonths = Object.keys(dynamicSummary.trends).sort();
      const targetIdx = allMonths.indexOf(selectedMonthKey);
      let sliceMonths = [];
      if (targetIdx !== -1) {
        const start = Math.max(0, targetIdx - (timeRange - 1));
        sliceMonths = allMonths.slice(start, targetIdx + 1);
      } else {
        sliceMonths = allMonths.slice(-timeRange);
      }

      sliceMonths.forEach((monthStr, idx) => {
        const data = dynamicSummary.trends[monthStr] || {};
        let allocated = 0;
        let actualSpent = 0;
        let committed = 0;

        Object.keys(data).forEach(dept => {
          if (selectedDept === 'ALL' || dept === selectedDept) {
            allocated += data[dept]?.allocated || 0;
            actualSpent += data[dept]?.actualSpent || 0;
            committed += data[dept]?.committed || 0;
          }
        });

        const totalSpent = actualSpent + committed;
        const remaining = allocated - totalSpent;
        const percentage = allocated > 0 ? Math.round((totalSpent / allocated) * 100) : 0;

        const [yyyy, mm] = monthStr.split('-');
        const monthShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const monthFull = [
          "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
          "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
        ];
        const mNum = parseInt(mm, 10);
        const displayMonth = `${monthShort[mNum - 1]} ${(parseInt(yyyy, 10) + 543).toString().substring(2)}`;
        const displayMonthFull = `${monthFull[mNum - 1]} ${parseInt(yyyy, 10) + 543}`;

        // Previous month calculation for MoM comparison in table
        let momDiff = null;
        if (idx > 0 && sliceMonths[idx - 1]) {
          const prevData = dynamicSummary.trends[sliceMonths[idx - 1]] || {};
          let prevSpent = 0;
          Object.keys(prevData).forEach(dept => {
            if (selectedDept === 'ALL' || dept === selectedDept) {
              prevSpent += (prevData[dept]?.actualSpent || 0) + (prevData[dept]?.committed || 0);
            }
          });
          const diff = totalSpent - prevSpent;
          const percentDiff = prevSpent > 0 ? Math.round((diff / prevSpent) * 1000) / 10 : 0;
          momDiff = { diff, percentDiff, prevSpent };
        }

        const item = {
          month: displayMonth,
          monthFull: displayMonthFull,
          monthRaw: monthStr,
          allocated,
          actualSpent,
          committed,
          totalSpent,
          remaining,
          percentage,
          momDiff,
          isCurrent: monthStr === selectedMonthKey
        };

        trendData.push(item);
        tableData.push(item);
      });
    }

    // Category Spending (Donut Chart)
    const itemMap = {};
    pos.forEach(po => {
      if (DEPARTMENTS[po.department] && po.status !== 'CANCELLED' && (selectedDept === 'ALL' || po.department === selectedDept)) {
        po.items.forEach(item => {
          const total = item.actUnitPrice ? item.actUnitPrice * item.qty : item.price * item.qty;
          if (!itemMap[item.name]) itemMap[item.name] = 0;
          itemMap[item.name] += total;
        });
      }
    });

    const sortedItems = Object.keys(itemMap).map(k => ({ name: k, value: itemMap[k] })).sort((a, b) => b.value - a.value);
    const top5 = sortedItems.slice(0, 5);
    const others = sortedItems.slice(5).reduce((sum, item) => sum + item.value, 0);
    const categoryData = [...top5];
    if (others > 0) categoryData.push({ name: 'อื่นๆ (Others)', value: others });

    return { trendData, tableData, categoryData };
  }, [pos, selectedDept, dynamicSummary, selectedMonthKey, timeRange]);

  if (!currentRole?.canViewBudget) {
    return (
      <div className="w-full my-12 text-center p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4 animate-fade-in">
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center border border-rose-100">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">สิทธิ์การเข้าถึงถูกจำกัด (Access Restricted)</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          บทบาท <b>{currentRole?.title}</b> ไม่ได้รับอนุญาตให้ดูข้อมูลการเงินและงบประมาณประจำเดือน
        </p>
      </div>
    );
  }

  // Minimalist Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const alloc = payload.find(p => p.dataKey === 'allocated')?.value || 0;
      const spent = payload.find(p => p.dataKey === 'actualSpent')?.value || 0;
      const ratio = alloc > 0 ? Math.round((spent / alloc) * 100) : 0;
      const rowItem = payload[0]?.payload;
      const displayLabel = rowItem?.monthFull || label;

      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/60 text-xs space-y-1.5 min-w-[190px]">
          <div className="font-semibold text-slate-200 border-b border-slate-700/80 pb-1 flex justify-between items-center">
            <span>{displayLabel}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
              ratio > 90 ? 'bg-rose-500/20 text-rose-400' : ratio > 70 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {ratio}% ใช้ไป
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              งบจัดสรร:
            </span>
            <span className="font-mono font-medium text-white tabular-nums">฿{alloc.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              ใช้จ่ายจริง:
            </span>
            <span className="font-mono font-bold text-indigo-300 tabular-nums">฿{spent.toLocaleString()}</span>
          </div>
          {rowItem && rowItem.remaining !== undefined && (
            <div className="flex justify-between items-center text-slate-400 pt-0.5 border-t border-slate-800">
              <span>ส่วนต่าง:</span>
              <span className={`font-mono text-[11px] ${rowItem.remaining < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {rowItem.remaining < 0 ? '-' : '+'}฿{Math.abs(rowItem.remaining).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-6 animate-fade-in pb-12">
      {/* Header & Month Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs">
                <Wallet className="w-5 h-5" />
              </div>
              <span>ระบบควบคุมงบประมาณ (Monthly Budget Management)</span>
            </h2>
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Zero-Based
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            ระบบตัดรอบงบประมาณรายเดือนแบบฐานศูนย์ (Zero-Based Budget) พร้อมการวิเคราะห์เปรียบเทียบย้อนหลัง (Comparative Analytics)
          </p>
        </div>

        {/* Action Controls: Department & Month Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Segmented Selector */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-0.5 text-center min-w-[140px]">
              <span className="text-xs font-semibold text-slate-900 font-sans block">
                {thaiMonths[selectedMonth - 1]} {selectedYear + 543}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ({selectedMonthKey})
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Department Filter */}
          {currentRole.canViewAllDepts && (
            <select
              className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer shadow-xs"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="ALL">รวมทุกแผนก (All Departments)</option>
              {Object.keys(DEPARTMENTS).map(k => (
                <option key={k} value={k}>{DEPARTMENTS[k].name} ({k})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/60 shadow-2xs overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>ภาพรวมงบประมาณรายเดือน</span>
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'trends'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          <span>แนวโน้ม & การเปรียบเทียบย้อนหลัง (Comparative Analytics)</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <History className="w-4 h-4 text-slate-500" />
          <span>ประวัติการปรับปรุง & คืนงบ</span>
          {budgetTransactions.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {budgetTransactions.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Overview Department Cards */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {deptsToShow.map(dept => {
            const rawData = currentMonthSummary[dept] || {};
            const baseAllocated = Number(rawData.baseAllocated ?? rawData.allocated) || (DEPARTMENTS[dept]?.monthlyBudget || 200000);
            const actualSpent = Number(rawData.actualSpent) || 0;
            const committed = Number(rawData.committed) || 0;
            const totalSpent = actualSpent + committed;
            const remaining = baseAllocated - totalSpent;

            const actualPercent = baseAllocated > 0 ? Math.round((actualSpent / baseAllocated) * 100) : 0;
            const committedPercent = baseAllocated > 0 ? Math.round((committed / baseAllocated) * 100) : 0;
            const totalPercent = actualPercent + committedPercent;

            const isEditing = editingBudget === dept;
            const isCritical = totalPercent >= 90 || remaining < 0;
            const isWarning = totalPercent >= 70 && totalPercent < 90;

            const momDelta = rawData.momDelta;

            return (
              <div 
                key={dept} 
                className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-200 flex flex-col justify-between space-y-5"
              >
                <div>
                  {/* Department Header & Actions */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100/80 flex items-center justify-center text-slate-700 shadow-xs">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-base text-slate-900">{DEPARTMENTS[dept]?.name || dept}</h4>
                          <span className="text-xs text-slate-400 font-mono">({dept})</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">
                          กรอบงบประมาณประจำเดือน (ฐานศูนย์)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Delta Badge (MoM comparison) */}
                      {momDelta && (
                        <div className="hidden sm:flex">
                          {momDelta.isHigher ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>+{momDelta.spentPercentDiff}% vs เดือนก่อน</span>
                            </span>
                          ) : momDelta.isLower ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              <span>ประหยัด ฿{Math.abs(momDelta.spentDiff).toLocaleString()} vs เดือนก่อน</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                              <Minus className="w-3.5 h-3.5" />
                              <span>คงที่ vs เดือนก่อน</span>
                            </span>
                          )}
                        </div>
                      )}

                      {canEditBudget && !isEditing && (
                        <button 
                          onClick={() => { 
                            setEditingBudget(dept); 
                            setEditBaseValue(baseAllocated);
                          }}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                          title="แก้ไขกรอบงบประมาณ"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">
                          งบประมาณฐานประจำเดือน (฿)
                        </label>
                        <input
                          type="number"
                          value={editBaseValue}
                          onChange={(e) => setEditBaseValue(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          * ตัดรอบใหม่แบบฐานศูนย์ทุกเดือน ไม่มีภาระทบยอดข้ามเดือน
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleEditSave(dept)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>บันทึกการจัดสรรงบ</span>
                        </button>
                        <button
                          onClick={() => setEditingBudget(null)}
                          className="py-2 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {/* Metric Display Grid (4 Snapshot Cards) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                          <span className="text-slate-400 text-xs block font-medium">งบจัดสรรฐาน</span>
                          <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block tabular-nums">
                            ฿{baseAllocated.toLocaleString()}
                          </span>
                        </div>

                        <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/60">
                          <span className="text-indigo-600 text-xs block font-medium">ใช้จ่ายจริง</span>
                          <span className="text-base font-bold text-indigo-900 font-mono mt-0.5 block tabular-nums">
                            ฿{actualSpent.toLocaleString()}
                          </span>
                        </div>

                        <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100/60">
                          <span className="text-amber-700 text-xs block font-medium">ผูกพัน (PR/PO)</span>
                          <span className="text-base font-bold text-amber-900 font-mono mt-0.5 block tabular-nums">
                            ฿{committed.toLocaleString()}
                          </span>
                        </div>

                        <div className={`p-3 rounded-xl border ${
                          remaining < 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-emerald-50/70 border-emerald-200'
                        }`}>
                          <span className={`text-xs block font-medium ${remaining < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {remaining < 0 ? 'เกินงบ' : 'งบคงเหลือ'}
                          </span>
                          <span className={`text-base font-bold font-mono mt-0.5 block tabular-nums ${
                            remaining < 0 ? 'text-rose-700' : 'text-emerald-800'
                          }`}>
                            ฿{Math.abs(remaining).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar (Triple-Tone: Green <70%, Amber 70-90%, Rose >=90%) */}
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between items-center text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">อัตราการใช้งานรวม</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isCritical 
                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                : isWarning 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {isCritical ? 'ใกล้เต็มงบ / เกินงบ' : isWarning ? 'เฝ้าระวัง' : 'ปกติ'}
                            </span>
                          </div>
                          <span className={`font-mono font-bold text-sm ${
                            isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-700'
                          }`}>
                            {totalPercent}%
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex shadow-inner">
                          {/* Segment 1: Actual Spent (Indigo) */}
                          <div 
                            className="bg-indigo-600 h-full transition-all duration-300"
                            style={{ width: `${Math.min(actualPercent, 100)}%` }}
                            title={`ใช้จริง: ${actualPercent}%`}
                          />
                          {/* Segment 2: Committed (Amber) */}
                          <div 
                            className="bg-amber-400 h-full transition-all duration-300"
                            style={{ width: `${Math.min(committedPercent, Math.max(0, 100 - actualPercent))}%` }}
                            title={`ผูกพัน: ${committedPercent}%`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 font-medium">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                            ใช้จริง: <span className="font-mono text-slate-800 font-semibold">{actualPercent}%</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                            ผูกพัน: <span className="font-mono text-slate-800 font-semibold">{committedPercent}%</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                            ว่าง: <span className="font-mono text-slate-800 font-semibold">{Math.max(0, 100 - totalPercent)}%</span>
                          </span>
                        </div>
                      </div>

                      {/* Mobile Delta View */}
                      {momDelta && (
                        <div className="flex sm:hidden pt-2 border-t border-slate-100 text-xs items-center justify-between">
                          <span className="text-slate-400">เทียบเดือนก่อนหน้า:</span>
                          {momDelta.isHigher ? (
                            <span className="font-semibold text-amber-600 flex items-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" /> +{momDelta.spentPercentDiff}%
                            </span>
                          ) : momDelta.isLower ? (
                            <span className="font-semibold text-emerald-600 flex items-center gap-1">
                              <ArrowDownRight className="w-3.5 h-3.5" /> ประหยัด ฿{Math.abs(momDelta.spentDiff).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium">คงที่</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Summary */}
                <div className="pt-3.5 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    รอบ: {selectedMonthKey}
                  </span>
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    ตัดรอบฐานศูนย์ (Zero-Based)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Trends & Comparative Analytics */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Multi-Range Comparative Bar Chart (Allocated vs Actual Spent) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    เปรียบเทียบงบประมาณจัดสรร vs ยอดใช้จ่ายจริง (ย้อนหลัง {timeRange} เดือน)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    เปรียบเทียบ Bar Chart แบบ 2 แท่งคู่กันเพื่อตรวจสอบประสิทธิภาพการใช้งบประมาณรายเดือน
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Range Selector: Segmented Pill */}
                  <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-2xs">
                    {RANGE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTimeRange(opt.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          timeRange === opt.value
                            ? 'bg-white text-indigo-700 shadow-xs font-bold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                        }`}
                        title={`ดูย้อนหลัง ${opt.value} เดือน`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <span className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 w-fit">
                    {selectedDept === 'ALL' ? 'รวมทุกแผนก' : `แผนก ${selectedDept}`}
                  </span>
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={analyticsData.trendData} 
                    barGap={timeRange > 12 ? 1 : 3} 
                    barCategoryGap={timeRange > 12 ? '10%' : '20%'}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#94a3b8" 
                      fontSize={timeRange > 12 ? 9 : 11} 
                      tickLine={false}
                      interval={timeRange === 24 ? 1 : 0}
                      angle={timeRange > 6 ? -35 : 0}
                      textAnchor={timeRange > 6 ? 'end' : 'middle'}
                      height={timeRange > 6 ? 42 : 28}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} 
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: '16px', fontSize: '12px' }}
                    />
                    <Bar 
                      dataKey="allocated" 
                      name="งบประมาณจัดสรร" 
                      fill="#CBD5E1" 
                      radius={[3, 3, 0, 0]} 
                      maxBarSize={timeRange === 24 ? 8 : timeRange === 12 ? 14 : 22}
                    />
                    <Bar 
                      dataKey="actualSpent" 
                      name="ยอดใช้จ่ายจริง" 
                      fill="#4F46E5" 
                      radius={[3, 3, 0, 0]} 
                      maxBarSize={timeRange === 24 ? 8 : timeRange === 12 ? 14 : 22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Donut Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-base">สัดส่วนค่าใช้จ่ายตามรายการ</h4>
                <p className="text-xs text-slate-500 mt-0.5">5 อันดับรายการที่มีการสั่งซื้อสูงสุด</p>
              </div>

              <div className="h-64 my-auto flex items-center justify-center">
                {analyticsData.categoryData.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center">ไม่มีข้อมูลค่าใช้จ่ายตามรายการ</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={analyticsData.categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {analyticsData.categoryData.map((entry, index) => {
                          const colors = ['#4F46E5', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#94A3B8'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <RechartsTooltip formatter={v => `฿${Number(v).toLocaleString()}`} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                {analyticsData.categoryData.slice(0, 3).map((item, idx) => {
                  const colors = ['bg-indigo-600', 'bg-emerald-500', 'bg-amber-500'];
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600 truncate max-w-[150px]">
                        <span className={`w-2 h-2 rounded-full ${colors[idx]} inline-block shrink-0`} />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        ฿{item.value.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Historical Comparison Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>ตารางวิเคราะห์เปรียบเทียบงบประมาณรายเดือน (Historical Monthly Comparison)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  แสดงผลการเบิกจ่าย เปอร์เซ็นต์การใช้งาน ส่วนต่างคงเหลือ และการเปลี่ยนแปลง MoM ย้อนหลัง {timeRange} เดือน
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                ข้อมูลย้อนหลัง {timeRange} เดือน ({analyticsData.tableData[0]?.monthRaw} ถึง {analyticsData.tableData[analyticsData.tableData.length - 1]?.monthRaw})
              </span>
            </div>

            <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/95 backdrop-blur-xs text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/80 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-3.5 pl-6">เดือน / รอบบัญชี</th>
                    <th className="py-3.5 px-4 text-right">งบจัดสรร (฿)</th>
                    <th className="py-3.5 px-4 text-right">ใช้จ่ายจริง (฿)</th>
                    <th className="py-3.5 px-4 text-right">ผูกพัน (฿)</th>
                    <th className="py-3.5 px-4 text-right">รวมใช้ไป (฿)</th>
                    <th className="py-3.5 px-4 text-center">อัตราการใช้ (%)</th>
                    <th className="py-3.5 px-4 text-right">ส่วนต่างคงเหลือ (฿)</th>
                    <th className="py-3.5 px-4 text-center">เปรียบเทียบ MoM</th>
                    <th className="py-3.5 pr-6 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analyticsData.tableData.map((row) => {
                    const isOver = row.remaining < 0 || row.percentage > 100;
                    const isWatch = row.percentage >= 70 && row.percentage < 90;
                    const isNear = row.percentage >= 90 && row.percentage <= 100;

                    return (
                      <tr 
                        key={row.monthRaw} 
                        className={`transition-colors hover:bg-slate-50/80 ${
                          row.isCurrent ? 'bg-indigo-50/30 font-medium' : ''
                        }`}
                      >
                        <td className="py-3.5 pl-6 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-semibold">{row.monthFull}</span>
                            {row.isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                เดือนปัจจุบัน
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            {row.monthRaw}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                          ฿{row.allocated.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-indigo-600 tabular-nums">
                          ฿{row.actualSpent.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-amber-600 tabular-nums">
                          ฿{row.committed.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          ฿{row.totalSpent.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                            isOver ? 'bg-rose-100 text-rose-800' : isNear ? 'bg-rose-50 text-rose-700' : isWatch ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {row.percentage}%
                          </span>
                        </td>

                        <td className={`py-3.5 px-4 text-right font-mono font-bold tabular-nums ${
                          row.remaining < 0 ? 'text-rose-600' : 'text-emerald-700'
                        }`}>
                          ฿{row.remaining.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {row.momDiff ? (
                            row.momDiff.diff > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                +{row.momDiff.percentDiff}%
                              </span>
                            ) : row.momDiff.diff < 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                                <ArrowDownRight className="w-3.5 h-3.5" />
                                ประหยัด ฿{Math.abs(row.momDiff.diff).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">— คงที่</span>
                            )
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">รอบฐาน</span>
                          )}
                        </td>

                        <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                          {isOver ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" /> เกินงบ
                            </span>
                          ) : isNear ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              ใกล้เต็มงบ
                            </span>
                          ) : isWatch ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              เฝ้าระวัง
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> ปกติ
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: History & Refund Logs */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">ประวัติการปรับปรุงงบประมาณ & การคืนเงินงบประมาณ</h4>
            <span className="text-xs text-slate-500 font-mono">ทั้งหมด {budgetTransactions.length} รายการ</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 pl-6">วัน-เวลา</th>
                  <th className="py-3.5 px-4">ประเภทรายการ</th>
                  <th className="py-3.5 px-4">แผนก</th>
                  <th className="py-3.5 px-4 text-right">จำนวนเงิน</th>
                  <th className="py-3.5 px-4">อ้างอิงเอกสาร</th>
                  <th className="py-3.5 pr-6">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgetTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">
                      ยังไม่มีประวัติการปรับปรุงงบประมาณหรือการคืนเงิน
                    </td>
                  </tr>
                ) : (
                  budgetTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-6 whitespace-nowrap text-slate-500 font-mono text-xs">{tx.date}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {tx.type === 'REFUND_CREDIT' ? 'คืนงบประมาณ (Refund)' : tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">ฝ่าย {tx.dept}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        +฿{tx.amount?.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-indigo-600">{tx.refId || '-'}</td>
                      <td className="py-3.5 pr-6 text-xs text-slate-600">{tx.note || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
