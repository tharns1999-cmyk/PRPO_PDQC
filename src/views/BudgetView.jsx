import React, { useState, useMemo } from 'react';
import { DEPARTMENTS, PR_STATUS, PO_STATUS } from '../config/constants';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { modalService } from '../services/modalService';
import { 
  Wallet, ShieldAlert, PieChart, TrendingUp, AlertCircle, 
  Building2, CheckCircle2, BarChart3, History, DollarSign,
  Edit2, Save, X, ArrowRight
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, Area, Cell, PieChart as RechartsPieChart, Pie
} from 'recharts';

export default function BudgetView({ budgetSummary, currentRole, prs = [], pos = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDept, setSelectedDept] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Load budget transaction log (refund entries)
  const budgetTransactions = useMemo(() => storageService.getBudgetTransactions(), [pos, prs]);

  const handleEditSave = async (dept) => {
    if (!editValue || isNaN(editValue)) return;
    try {
      await apiService.updateBudget(dept, Number(editValue));
      setEditingBudget(null);
      if (onRefresh) onRefresh();
    } catch (e) {
      modalService.error('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกงบประมาณได้: ' + e.message);
    }
  };

  const currentMonthSummary = budgetSummary?.current || {};

  const deptsToShow = selectedDept === 'ALL' 
    ? Object.keys(currentMonthSummary).filter(k => currentMonthSummary[k].allocated > 0 || currentMonthSummary[k].actualSpent > 0 || currentMonthSummary[k].committed > 0)
    : [selectedDept];

  const canEditBudget = currentRole?.id === 'ADMIN' || currentRole?.canFinalApprove || currentRole?.canReview;

  // Analytics Calculations
  const analyticsData = useMemo(() => {
    // 1. Trend Data (MoM)
    const trendData = [];
    if (budgetSummary?.trends) {
      const months = Object.keys(budgetSummary.trends).sort();
      months.forEach(monthStr => {
        const data = budgetSummary.trends[monthStr];
        let allocated = 0;
        let actualSpent = 0;
        let committed = 0;

        Object.keys(data).forEach(dept => {
          if (selectedDept === 'ALL' || dept === selectedDept) {
            allocated += data[dept].allocated || 0;
            actualSpent += data[dept].actualSpent || 0;
            committed += data[dept].committed || 0;
          }
        });

        const [yyyy, mm] = monthStr.split('-');
        const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const displayMonth = `${monthNames[parseInt(mm, 10) - 1]} ${yyyy.substring(2)}`;

        trendData.push({
          month: displayMonth,
          monthRaw: monthStr,
          allocated,
          actualSpent,
          committed,
          totalSpent: actualSpent + committed
        });
      });
    }

    // 2. Category Spending (Donut Chart)
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

    // 3. YTD Summary
    const ytd = trendData.reduce((acc, curr) => {
      acc.allocated += curr.allocated;
      acc.spent += curr.totalSpent;
      return acc;
    }, { allocated: 0, spent: 0 });

    return { trendData, categoryData, ytd };
  }, [pos, selectedDept, budgetSummary]);

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

  return (
    <div className="w-full space-y-6 animate-fade-in pb-10">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-2xs">
              <Wallet className="w-5 h-5" />
            </div>
            <span>ระบบควบคุมงบประมาณ (Budget Management)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            ติดตามและวิเคราะห์การใช้งบประมาณรายแผนกแบบ Real-time
          </p>
        </div>
        {currentRole.canViewAllDepts && (
          <select
            className="w-full sm:w-56 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="ALL">รวมทุกแผนก (All)</option>
            {Object.keys(DEPARTMENTS).map(k => (
              <option key={k} value={k}>{DEPARTMENTS[k].name} ({k})</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
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
          <span>แนวโน้มการใช้งาน (Trends & Analytics)</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {deptsToShow.map(dept => {
            const data = currentMonthSummary[dept] || { allocated: 0, actualSpent: 0, committed: 0, remaining: 0, percentage: 0 };
            const isEditing = editingBudget === dept;
            const isCritical = data.percentage >= 90;
            const isWarning = data.percentage >= 75 && data.percentage < 90;

            return (
              <div key={dept} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{DEPARTMENTS[dept]?.name || dept}</h4>
                        <span className="text-[11px] text-slate-400 font-mono">({dept})</span>
                      </div>
                    </div>
                    {canEditBudget && !isEditing && (
                      <button 
                        onClick={() => { setEditingBudget(dept); setEditValue(data.allocated); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="แก้ไขงบประมาณ"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <label className="text-[11px] font-bold text-slate-600">แก้ไขงบประมาณที่จัดสรร (฿)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900"
                        />
                        <button
                          onClick={() => handleEditSave(dept)}
                          className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingBudget(null)}
                          className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <span className="text-slate-400 text-[10px] block">งบที่ได้รับจัดสรร</span>
                          <span className="text-base font-black text-slate-900 font-mono mt-0.5 block tabular-nums">
                            ฿{data.allocated.toLocaleString()}
                          </span>
                        </div>
                        <div className={`p-3 rounded-2xl border ${
                          data.remaining < 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                        }`}>
                          <span className={`text-[10px] block ${data.remaining < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {data.remaining < 0 ? 'เกินงบประมาณ' : 'งบคงเหลือ'}
                          </span>
                          <span className={`text-base font-black font-mono mt-0.5 block tabular-nums ${
                            data.remaining < 0 ? 'text-rose-700' : 'text-emerald-800'
                          }`}>
                            ฿{Math.abs(data.remaining).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-500">อัตราการใช้งบรวม</span>
                          <span className={`font-mono font-bold ${
                            isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-700'
                          }`}>
                            {data.percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(data.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                  <span>ใช้จริง: ฿{(data.actualSpent || 0).toLocaleString()}</span>
                  <span>ผูกพัน: ฿{(data.committed || 0).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Trends Charts */}
      {activeTab === 'trends' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-4">แนวโน้มการใช้งบประมาณรายเดือน (MoM Spending)</h4>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analyticsData.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={v => `฿${Number(v).toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="actualSpent" name="ใช้จ่ายจริง" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="allocated" name="งบประมาณจัดสรร" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-4">สัดส่วนค่าใช้จ่ายตามรายการสินค้า (Top Spending Items)</h4>
            <div className="h-72 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={analyticsData.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {analyticsData.categoryData.map((entry, index) => {
                      const colors = ['#4F46E5', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#94A3B8'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <RechartsTooltip formatter={v => `฿${Number(v).toLocaleString()}`} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: History & Refund Logs */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
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
