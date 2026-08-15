import React, { useState, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { 
  SendToBack, CheckCircle2, AlertCircle, AlertTriangle, 
  PackageCheck, Layers, MapPin, Clock, ArrowRight,
  History, Boxes, Building2, User, Sparkles, PlusCircle, Check
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

export default function QuickIssueView({ products = [], stockLogs = [], currentRole, onRefresh, onNavigate, onQuickPR }) {
  const [categoryFilter, setCategoryFilter] = useState(currentRole.canViewAllDepts ? 'ALL' : currentRole.department);
  const [selectedProdId, setSelectedProdId] = useState('');
  const [issueQty, setIssueQty] = useState(1);
  const [reason, setReason] = useState(ISSUE_REASONS[0]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Department and Category Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesDept = currentRole.canViewAllDepts || p.category === currentRole.department;
      const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
      return matchesDept && matchesCat;
    });
  }, [products, currentRole, categoryFilter]);

  // Transform to SearchableSelect options
  const productOptions = useMemo(() => {
    return filteredProducts.map(p => {
      const sUnit = p.stockUnit || p.unit || 'ชิ้น';
      const pUnit = p.purchaseUnit || p.unit || sUnit;
      const rate = Number(p.conversionRate) > 0 ? Number(p.conversionRate) : 1;
      const dualText = rate > 1 
        ? ` • (≈ ${((p.stockBalance || 0) / rate).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} ${pUnit})` 
        : '';
      return {
        value: p.id,
        label: p.name,
        code: p.code,
        subLabel: `คงเหลือ: ${Number(p.stockBalance || 0).toLocaleString()} ${sUnit}${dualText} • ที่เก็บ: ${p.location || 'คลังหลัก'} • ROP: ${p.reorderPoint} ${sUnit}`,
        badge: p.category === 'PD' ? 'ฝ่ายผลิต' : 'ฝ่าย QC',
        keywords: `${p.code} ${p.name} ${p.location} ${sUnit} ${pUnit}`
      };
    });
  }, [filteredProducts]);

  // Set initial product if not set
  React.useEffect(() => {
    if (filteredProducts.length > 0 && (!selectedProdId || !filteredProducts.some(p => p.id === selectedProdId))) {
      setSelectedProdId(filteredProducts[0].id);
    }
  }, [filteredProducts, selectedProdId]);

  const selectedProduct = products.find(p => p.id === selectedProdId);

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

  // Recent OUT stock logs for this department
  const recentIssueLogs = useMemo(() => {
    return stockLogs
      .filter(log => {
        if (log.type !== 'OUT') return false;
        if (currentRole.canViewAllDepts) return true;
        const prod = products.find(p => p.id === log.productId || p.code === log.productCode);
        return prod ? prod.category === currentRole.department : true;
      })
      .slice(0, 5);
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

    if (qtyNumber <= 0) {
      return setErrorMsg('จำนวนที่ต้องการเบิกต้องมากกว่า 0');
    }

    if (currentBalance < qtyNumber) {
      return setErrorMsg(`จำนวนที่ขอเบิก (${qtyNumber} ${sUnit}) เกินกว่ายอดคงเหลือในคลัง (${currentBalance} ${sUnit})`);
    }

    setIsSubmitting(true);
    try {
      const fullNote = `${reason}${note.trim() ? ` — ${note.trim()}` : ''}`;
      await apiService.quickIssueStock(selectedProdId, qtyNumber, currentRole, fullNote);
      setSuccessMsg(`เบิกสินค้า [${selectedProduct.name}] จำนวน ${qtyNumber} ${sUnit} สำเร็จ! ยอดสต็อกตัดจ่ายเรียบร้อย`);
      setIssueQty(1);
      setNote('');
      onRefresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in-up pb-10">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <div className="p-2 bg-rose-600 text-white rounded-xl shadow-md shadow-rose-500/20">
              <SendToBack className="w-5 h-5" />
            </div>
            <span>เบิกสินค้าออกจากคลัง</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            บันทึกตัดยอดสต็อกสินค้าทันที (-OUT) สำหรับการใช้งานในไลน์ผลิตและงานควบคุมคุณภาพ
          </p>
        </div>

        {/* Department Badge */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs w-fit text-xs font-semibold text-slate-600">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span>สิทธิ์การเบิก:</span>
          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
            currentRole.department === 'PD' 
              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
              : currentRole.department === 'QC'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {currentRole.department === 'ALL' ? 'ทุกแผนก (ALL)' : `แผนก ${currentRole.department}`}
          </span>
        </div>
      </div>

      {/* ── Alert Notifications ── */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold shadow-xs animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold shadow-xs animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── 2-Column Responsive Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column: Streamlined Issue Form (7 cols) ── */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-6">
          
          {/* Filter Bar (Only shown if user has multi-dept access) */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 flex-wrap">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>ระบุรายการสินค้าที่ต้องการเบิก</span>
            </span>

            {currentRole.canViewAllDepts && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ทั้งหมด ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('PD')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'PD' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ฝ่ายผลิต (PD)
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('QC')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'QC' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ฝ่าย QC
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Product Selector */}
            <div>
              <label className="impeccable-label">
                เลือกสินค้าจากคลัง <span className="text-rose-500">*</span>
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
            </div>

            {/* 2. Compact Item Info Strip (Only Essential Info) */}
            {selectedProduct && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs flex-wrap gap-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-slate-600 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>ที่เก็บ: <strong>{selectedProduct.location || 'คลังหลัก'}</strong></span>
                  </span>
                  {rate > 1 && (
                    <span className="text-slate-500 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                      1 {pUnit} = {rate} {sUnit}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">จุดสั่งซื้อ ROP:</span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {Number(reorderPoint).toLocaleString()} {sUnit}
                  </span>
                </div>
              </div>
            )}

            {/* 3. Issue Quantity with Integrated Live Stock Calculator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="impeccable-label mb-0">
                  จำนวนที่เบิก ({sUnit}) <span className="text-rose-500">*</span>
                </label>
                
                {/* Quick Add Chips */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">ปุ่มลัด:</span>
                  {[1, 5, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleQuickQty(n)}
                      className="px-2.5 py-0.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      +{n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleQuickQty('max')}
                    className="px-2.5 py-0.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  >
                    เบิกทั้งหมด (Max)
                  </button>
                </div>
              </div>

              {/* Input Row */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={Math.max(0.001, currentBalance)}
                  value={issueQty}
                  onChange={e => setIssueQty(e.target.value)}
                  required
                  placeholder="0.00"
                  className="impeccable-input h-[46px] w-36 text-center font-mono font-black text-rose-600 text-lg border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                />
                <span className="h-[46px] px-4 flex items-center bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shrink-0">
                  {sUnit}
                </span>

                {/* Live Stock Comparison Chip */}
                <div className="flex-1 min-w-0 pl-1">
                  <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                    <span>คงเหลือ: <strong className="text-slate-900 font-mono">{Number(currentBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong></span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span>หลังเบิก: <strong className={`font-mono ${postIssueBalance < 0 ? 'text-rose-600' : 'text-indigo-700 font-bold'}`}>
                      {Number(postIssueBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </strong> {sUnit}</span>
                  </div>
                </div>
              </div>

              {/* Real-time Status Alert Pill (Directly below Quantity) */}
              {isOutOfStock ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>จำนวนที่ขอเบิกเกินสต็อกที่มีอยู่จริงในคลัง ({currentBalance} {sUnit})</span>
                </div>
              ) : willTriggerROP ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    หลังเบิกยอดจะเหลือ <strong>{postIssueBalance} {sUnit}</strong> ซึ่งแตะจุดสั่งซื้อ ROP ({reorderPoint} {sUnit}) ระบบจะแจ้งเตือนให้เปิด PR อัตโนมัติ
                  </span>
                </div>
              ) : null}
            </div>

            {/* 4. Reason Selector */}
            <div>
              <label className="impeccable-label">
                วัตถุประสงค์การเบิก <span className="text-rose-500">*</span>
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="impeccable-input font-medium cursor-pointer"
              >
                {ISSUE_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* 5. Additional Note */}
            <div>
              <label className="impeccable-label">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="เช่น เครื่องจักร No.2, กะดึก, หรือ งานทดสอบแล็บ..."
                className="impeccable-input font-medium"
              />
            </div>

            {/* 6. Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isOutOfStock}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <PackageCheck className="w-5 h-5" />
                <span>{isSubmitting ? 'กำลังบันทึกตัดยอด...' : 'ยืนยันการเบิกจ่ายสินค้า (-OUT)'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── Right Column: Product Snapshot & Recent Logs (5 cols) ── */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Selected Product Inventory Snapshot */}
          {selectedProduct && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  <span>ข้อมูลสต็อกสินค้า</span>
                </div>
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  {selectedProduct.code}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 leading-snug">
                  {selectedProduct.name}
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">คงเหลือปัจจุบัน</span>
                    <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">
                      {Number(currentBalance).toLocaleString()} <span className="text-xs font-normal text-slate-500">{sUnit}</span>
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                    <span className="text-amber-700 block text-[11px]">จุดสั่งซื้อ ROP</span>
                    <span className="text-base font-black text-amber-800 font-mono mt-0.5 block">
                      {Number(reorderPoint).toLocaleString()} <span className="text-xs font-normal text-amber-600">{sUnit}</span>
                    </span>
                  </div>
                </div>

                {/* Stock Level Progress Indicator */}
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>สถานะสต็อก</span>
                    <span className={currentBalance <= reorderPoint ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                      {currentBalance <= reorderPoint ? 'แตะจุดสั่งซื้อ (Low Stock)' : 'พร้อมใช้งานปกติ'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        currentBalance <= reorderPoint ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(10, (currentBalance / Math.max(currentBalance, reorderPoint * 2)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 2: Recent Issue Activity Log */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-600" />
                <span>ประวัติการเบิกจ่ายล่าสุด</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">5 รายการล่าสุด</span>
            </div>

            {recentIssueLogs.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentIssueLogs.map(log => (
                  <div 
                    key={log.id} 
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                          {log.productCode}
                        </span>
                        <span className="font-bold text-slate-800 truncate block text-xs">
                          {products.find(p => p.id === log.productId || p.code === log.productCode)?.name || log.productCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {log.note || 'เบิกใช้งาน'}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{log.date}</span>
                        <span>•</span>
                        <span>{log.user || 'ผู้เบิก'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 text-xs">
                        -{log.qty} {log.unit || 'ชิ้น'}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-1 font-mono">เหลือ: {log.balance}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                <PackageCheck className="w-7 h-7 mx-auto text-slate-300" />
                <p>ยังไม่มีประวัติการเบิกจ่ายสินค้า</p>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
