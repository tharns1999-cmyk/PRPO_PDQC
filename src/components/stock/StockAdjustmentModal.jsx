import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, AlertCircle, X, Check, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { storageService } from '../../services/storageService';
import SearchableSelect from '../common/SearchableSelect';

export default function StockAdjustmentModal({ products = [], currentRole, onClose, onRefresh }) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [actionType, setActionType] = useState('OUT'); // 'IN' | 'OUT'
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('ปรับปรุงยอดคงเหลือ (Stock Adjustment)');
  const [customNote, setCustomNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Only show products matching this role's dept
  const availableProducts = useMemo(() => {
    return currentRole.canViewAllDepts
      ? products
      : products.filter(p => p.category === currentRole.department);
  }, [products, currentRole]);

  const productOptions = useMemo(() => {
    return availableProducts.map(p => ({
      value: p.id,
      label: p.name,
      code: p.code,
      subLabel: `คงเหลือ: ${p.stockBalance || 0} ${p.stockUnit || p.unit || 'ชิ้น'}`,
      badge: p.category === 'PD' ? 'ฝ่ายผลิต' : 'ฝ่าย QC',
      keywords: `${p.code} ${p.name} ${p.unit}`
    }));
  }, [availableProducts]);

  const selectedProduct = availableProducts.find(p => p.id === selectedProductId);
  const sUnit = selectedProduct?.stockUnit || selectedProduct?.unit || 'ชิ้น';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedProductId) { setError('กรุณาเลือกสินค้า'); return; }
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum <= 0) { setError('จำนวนต้องมากกว่า 0'); return; }
    if (!reason) { setError('กรุณาระบุเหตุผล'); return; }

    const currentBalance = Number(selectedProduct.stockBalance || 0);

    if (actionType === 'OUT' && qtyNum > currentBalance) {
      setError(`ไม่สามารถปรับลด (${qtyNum}) ได้มากกว่ายอดคงเหลือปัจจุบัน (${currentBalance})`);
      return;
    }

    setSaving(true);
    try {
      const allProducts = storageService.getProducts();
      const stockLogs = storageService.getStockLogs();
      const timestamp = new Date().toLocaleString('th-TH');
      const docNo = `ADJ-${actionType}-${Date.now().toString().slice(-6)}`;

      const prodIndex = allProducts.findIndex(p => p.id === selectedProductId);
      if (prodIndex === -1) throw new Error('ไม่พบสินค้าในระบบ');

      const adjustAmount = actionType === 'IN' ? qtyNum : -qtyNum;
      const newBalance = Math.round((currentBalance + adjustAmount) * 10000) / 10000;
      allProducts[prodIndex].stockBalance = newBalance;

      stockLogs.unshift({
        id: `LOG-${Date.now()}`,
        date: timestamp,
        productId: selectedProductId,
        productCode: selectedProduct.code || '',
        type: actionType,
        docNo,
        qty: qtyNum,
        balance: newBalance,
        user: `${currentRole.name} (${currentRole.title})`,
        note: `[ปรับปรุงสต็อก ${actionType === 'IN' ? '+ เพิ่ม' : '- ลด'}] ${reason}${customNote ? ` — ${customNote}` : ''}`,
        isManual: true,
        reason
      });

      storageService.saveProducts(allProducts);
      storageService.saveStockLogs(stockLogs);

      onClose();
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-4 print:hidden animate-fade-in">
      <div className="modal-content w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col text-slate-800 animate-zoom-in">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex items-center justify-center shadow-2xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">ปรับปรุงสต็อก (Stock Adjustment +/-)</h3>
              <p className="text-xs text-slate-500">ปรับเพิ่มหรือลดจำนวนสินค้าคงเหลือ พร้อมบันทึกเหตุผล</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Type Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ประเภทการปรับปรุง <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActionType('OUT')}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  actionType === 'OUT'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>ปรับลดสต็อก (-)</span>
              </button>
              <button
                type="button"
                onClick={() => setActionType('IN')}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  actionType === 'IN'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>ปรับเพิ่มสต็อก (+)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              เลือกสินค้า <span className="text-rose-500">*</span>
            </label>
            <SearchableSelect
              options={productOptions}
              value={selectedProductId}
              onChange={setSelectedProductId}
              placeholder="ค้นหาชื่อ หรือรหัสสินค้า..."
            />
            {selectedProduct && (
              <div className="mt-2.5 p-3 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs shadow-2xs">
                <span className="text-slate-500">ยอดคงเหลือปัจจุบัน:</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedProduct.stockBalance || 0} {sUnit}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              จำนวนที่ต้องการปรับ ({actionType === 'IN' ? '+ เพิ่ม' : '- ลด'}) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.0001"
                placeholder="ระบุจำนวน..."
                value={qty}
                onChange={e => setQty(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                required
              />
              {selectedProduct && (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                  {sUnit}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              เหตุผลการปรับปรุง <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="เช่น นับสต็อกจริงประจำปี, สินค้าชำรุดเสียหาย, ปรับปรุงยอดผิดพลาด..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              หมายเหตุเพิ่มเติม (ถ้ามี)
            </label>
            <textarea
              rows={2}
              placeholder="ระบุรายละเอียดเพิ่มเติม..."
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none shadow-2xs"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
                actionType === 'OUT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : `ยืนยันปรับปรุง (${actionType === 'IN' ? '+ เพิ่ม' : '- ลด'})`}</span>
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
}
