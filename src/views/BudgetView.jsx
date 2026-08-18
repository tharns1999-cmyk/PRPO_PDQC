import React, { useState, useMemo } from 'react';
import { DEPARTMENTS, PR_STATUS, PO_STATUS } from '../config/constants';
import { apiService } from '../services/apiService';
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
      <div className="w-full my-12 text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-4 animate-fade-in-up">
        <div className="p-4 bg-rose-100 text-rose-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">สิทธิ์การเข้าถึงถูกจำกัด (Access Restricted)</h3>
        <p className="text-sm text-slate-600">
          บทบาท <b>{currentRole?.title}</b> ไม่ได้รับอนุญาตให้ดูข้อมูลการเงินและงบประมาณประจำเดือน
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <Wallet className="w-6 h-6 text-emerald-600" />
            ระบบควบคุมงบประมาณ (Budget Dashboard)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            ติดตามและวิเคราะห์การใช้งบประมาณรายแผนกแบบ Real-time
          </p>
        </div>
        {currentRole.canViewAllDepts && (
          <select
            className="input-impeccable py-2 text-sm w-48 font-semibold text-slate-700"
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
      <div className="flex space-x-1 bg-slate-100 p-1.5 rounded-xl w-fit overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
        >
          <PieChart className="w-4 h-4" /> ภาพรวมเดือนปัจจุบัน
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
        >
          <BarChart3 className="w-4 h-4" /> วิเคราะห์แนวโน้ม (Analytics)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
        >
          <History className="w-4 h-4" /> ประวัติรายการ (History)
        </button>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deptsToShow.map(dept => {
              const data = currentMonthSummary[dept] || { allocated: 0, actualSpent: 0, committed: 0 };
              const totalUsed = data.actualSpent + data.committed;
              const remaining = data.allocated - totalUsed;
              const usedPct = data.allocated > 0 ? Math.round((totalUsed / data.allocated) * 100) : 0;
              const actualPct = data.allocated > 0 ? Math.round((data.actualSpent / data.allocated) * 100) : 0;
              const commitPct = data.allocated > 0 ? Math.round((data.committed / data.allocated) * 100) : 0;

              let statusColor = 'emerald';
              if (usedPct >= 100) statusColor = 'rose';
              else if (usedPct >= 80) statusColor = 'amber';

              return (
                <div key={dept} className={`impeccable-card p-6 bg-white space-y-5 border-t-4 border-t-${statusColor}-500 relative overflow-hidden group`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-${statusColor}-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500`}></div>
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-[11px] font-bold bg-${statusColor}-100 text-${statusColor}-800 px-2.5 py-1 rounded-md`}>
                        {DEPARTMENTS[dept]?.name || dept} ({dept})
                      </span>
                      
                      {editingBudget === dept ? (
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-slate-500 font-bold">฿</span>
                          <input 
                            type="number"
                            className="input-impeccable py-1.5 px-3 text-lg font-bold w-32"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleEditSave(dept)} className="p-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingBudget(null)} className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mt-2 group/edit">
                          <h3 className="text-2xl font-black text-slate-900">
                            ฿{data.allocated.toLocaleString()} <span className="text-sm font-normal text-slate-500">/ เดือน</span>
                          </h3>
                          {canEditBudget && (
                            <button 
                              onClick={() => { setEditingBudget(dept); setEditValue(data.allocated); }}
                              className="opacity-0 group-hover/edit:opacity-100 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                              title="แก้ไขงบประมาณ"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600 font-medium flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                        ใช้จ่ายจริง (Actual Spent):
                      </span>
                      <span className="font-bold text-slate-900">฿{data.actualSpent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600 font-medium flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                        ภาระผูกพัน (Committed/Pending):
                      </span>
                      <span className="font-bold text-indigo-600">฿{data.committed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-bold border-t border-slate-200 pt-3 text-sm">
                      <span>งบประมาณคงเหลือ (Remaining):</span>
                      <span className={remaining < 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}>
                        ฿{remaining.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Health Badge & Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-2 font-medium">
                      <span>อัตราการใช้วงเงินสะสม</span>
                      <span className={`font-bold text-${statusColor}-600`}>{usedPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex shadow-inner">
                      <div className="bg-slate-800 h-3 transition-all duration-1000" style={{ width: `${Math.min(actualPct, 100)}%` }} title={`Actual: ${actualPct}%`} />
                      <div className="bg-indigo-400 h-3 transition-all duration-1000" style={{ width: `${Math.min(commitPct, 100 - actualPct)}%` }} title={`Committed: ${commitPct}%`} />
                    </div>

                    {usedPct >= 100 ? (
                      <div className="mt-4 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">คำเตือน: ใช้งบประมาณเกินวงเงิน</p>
                          <p className="text-rose-600/80 mt-0.5">กรุณาตรวจสอบรายการสั่งซื้อ หรือขออนุมัติเพิ่มวงเงิน</p>
                        </div>
                      </div>
                    ) : usedPct >= 80 ? (
                      <div className="mt-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 font-medium">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">เฝ้าระวัง: ใช้งบประมาณเกิน 80% แล้ว</p>
                          <p className="text-amber-700/80 mt-0.5">ควรพิจารณาสั่งซื้อเฉพาะรายการที่จำเป็นเร่งด่วน</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>สถานะงบประมาณปกติ อยู่ในกรอบวงเงิน</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* YTD Scorecards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="impeccable-card p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-600/20">
                <p className="text-indigo-200 font-medium mb-1">งบประมาณสะสม (YTD Allocated)</p>
                <h3 className="text-4xl font-bold font-mono">฿{analyticsData.ytd.allocated.toLocaleString()}</h3>
              </div>
              <div className="impeccable-card p-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/20">
                <p className="text-slate-400 font-medium mb-1">ใช้จ่ายสะสม (YTD Spent & Committed)</p>
                <h3 className="text-4xl font-bold font-mono text-emerald-400">฿{analyticsData.ytd.spent.toLocaleString()}</h3>
                <div className="mt-3 text-sm text-slate-300 font-medium flex items-center gap-2">
                  <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden flex-1">
                    <div className="bg-emerald-400 h-full" style={{ width: `${Math.min((analyticsData.ytd.spent / (analyticsData.ytd.allocated || 1)) * 100, 100)}%` }}></div>
                  </div>
                  <span>{analyticsData.ytd.allocated > 0 ? Math.round((analyticsData.ytd.spent / analyticsData.ytd.allocated) * 100) : 0}% ของงบสะสม</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Trend Chart */}
              <div className="impeccable-card p-6 bg-white xl:col-span-2 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" /> แนวโน้มการใช้งบประมาณ (MoM Trend)
                </h3>
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={analyticsData.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `฿${(val/1000)}k`} />
                      <RechartsTooltip 
                        formatter={(value) => `฿${value.toLocaleString()}`}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontWeight: 600 }}
                        cursor={{fill: '#f8fafc'}}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />
                      <Bar yAxisId="left" dataKey="actualSpent" name="จ่ายจริง (Actual)" stackId="a" fill="#1e293b" radius={[0, 0, 4, 4]} barSize={40} />
                      <Bar yAxisId="left" dataKey="committed" name="ผูกพัน (Committed)" stackId="a" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={40} />
                      <Line yAxisId="left" type="monotone" dataKey="allocated" name="งบประมาณ (Allocated)" stroke="#10b981" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 7 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Donut Chart */}
              <div className="impeccable-card p-6 bg-white shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-rose-500" /> สัดส่วนยอดซื้อตามสินค้า (Top 5)
                </h3>
                {analyticsData.categoryData.length > 0 ? (
                  <div className="w-full h-[320px] flex flex-col justify-center">
                    <ResponsiveContainer width="100%" height={240}>
                      <RechartsPieChart>
                        <Pie
                          data={analyticsData.categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {analyticsData.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#1e293b', '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#94a3b8'][index % 6]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value) => `฿${value.toLocaleString()}`}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 600 }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2 px-2 max-h-24 overflow-y-auto custom-scrollbar">
                      {analyticsData.categoryData.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: ['#1e293b', '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#94a3b8'][idx % 6]}}></div>
                            <span className="truncate text-slate-700 font-medium" title={item.name}>{item.name}</span>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0">฿{(item.value/1000).toFixed(1)}k</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[320px] flex items-center justify-center text-slate-400 text-sm">ไม่มีข้อมูลการสั่งซื้อ</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="impeccable-card bg-white overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-500" /> ประวัติการใช้จ่าย (PR & PO)
              </h3>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white shadow-sm text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4 pl-6">วันที่</th>
                    <th className="p-4">ประเภท/เลขที่</th>
                    <th className="p-4">แผนก</th>
                    <th className="p-4">รายการ</th>
                    <th className="p-4 text-right">ยอดเงิน</th>
                    <th className="p-4 text-center pr-6">สถานะผูกพัน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ...pos.filter(p => DEPARTMENTS[p.department] && (selectedDept === 'ALL' || p.department === selectedDept)).map(p => ({ ...p, type: 'PO', date: p.issueDate || 'N/A', amount: p.grandTotal })),
                    ...prs.filter(p => DEPARTMENTS[p.department] && (selectedDept === 'ALL' || p.department === selectedDept) && ['SUBMITTED', 'REVIEWED', 'APPROVED'].includes(p.status)).map(p => ({ ...p, type: 'PR', date: p.requestedDate || 'N/A', amount: p.totalAmount }))
                  ].sort((a, b) => new Date(b.date) - new Date(a.date)).map((doc, idx) => (
                    <tr key={`${doc.type}-${doc.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 pl-6 text-slate-600">{doc.date}</td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mr-2 ${doc.type === 'PO' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {doc.type}
                        </span>
                        <span className="font-mono font-medium">{doc.type === 'PO' ? doc.poNo : doc.prNo}</span>
                      </td>
                      <td className="p-4">{doc.department}</td>
                      <td className="p-4 text-slate-600 truncate max-w-[200px]">
                        {doc.items?.[0]?.name} {doc.items?.length > 1 ? `และอื่นๆ (+${doc.items.length - 1})` : ''}
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-700">฿{doc.amount?.toLocaleString()}</td>
                      <td className="p-4 text-center pr-6">
                        {doc.type === 'PO' && ['CLOSED', 'RECEIVED'].includes(doc.status) ? (
                          <span className="px-2.5 py-1 bg-slate-800 text-white rounded-full text-[10px] font-bold">จ่ายจริง (Actual)</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">ผูกพัน (Committed)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
