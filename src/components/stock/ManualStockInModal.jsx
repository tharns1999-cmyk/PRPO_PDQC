import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PackagePlus, AlertCircle, X, Check } from 'lucide-react';
import { STOCK_IN_REASONS } from '../../config/constants';
import { storageService } from '../../services/storageService';
import SearchableSelect from '../common/SearchableSelect';

export default function ManualStockInModal({ products = [], currentRole, onClose, onRefresh }) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState(STOCK_IN_REASONS[0]);
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
      subLabel: `คงเหลือ: ${p.stockBalance || 0} ${p.unit} • ที่เก็บ: ${p.location}`,
      badge: p.category === 'PD' ? 'ฝ่ายผลิต' : 'ฝ่าย QC',
      keywords: `${p.code} ${p.name} ${p.location} ${p.unit}`
    }));
  }, [availableProducts]);

  const selectedProduct = availableProducts.find(p => p.id === selectedProductId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedProductId) { setError('กรุณาเลือกสินค้า'); return; }
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum <= 0) { setError('จำนวนต้องมากกว่า 0'); return; }
    if (!reason) { setError('กรุณาระบุเหตุผล'); return; }

    setSaving(true);
    try {
      const allProducts = storageService.getProducts();
      const stockLogs = storageService.getStockLogs();
      const timestamp = new Date().toLocaleString('th-TH');
      const docNo = `MAN-IN-${Date.now().toString().slice(-6)}`;

      const prodIndex = allProducts.findIndex(p => p.id === selectedProductId);
      if (prodIndex === -1) throw new Error('ไม่พบสินค้าในระบบ');

      const newBalance = Math.round(((allProducts[prodIndex].stockBalance || 0) + qtyNum) * 10000) / 10000;
      allProducts[prodIndex].stockBalance = newBalance;

      stockLogs.unshift({
        id: `LOG-${Date.now()}`,
        date: timestamp,
        productId: selectedProductId,
        productCode: selectedProduct?.code || '',
        type: 'IN',
        docNo,
        qty: qtyNum,
        balance: newBalance,
        user: `${currentRole.name} (${currentRole.title})`,
        note: `[รับเข้าด้วยตนเอง] ${reason}${customNote ? ` — ${customNote}` : ''}`,
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
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-3 sm:p-4 print:hidden animate-fade-in">
      <div className="modal-content w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col text-slate-800 animate-zoom-in">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl">
              <PackagePlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">รับสินค้าเข้าคลัง (Manual Stock-In)</h3>
              <p className="text-xs text-slate-300">บันทึก Audit Log เพิ่มสต็อกสินค้าโดยอัตโนมัติ</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm custom-scrollbar bg-slate-50/50">
          <form id="stockin-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Product selector */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                เลือกสินค้าจาก Master Data <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={productOptions}
                value={selectedProductId}
                onChange={val => setSelectedProductId(val)}
                placeholder="-- พิมพ์ค้นหาหรือเลือกสินค้า --"
                searchPlaceholder="ค้นหาชื่อสินค้า รหัส หรือตำแหน่ง..."
                emptyMessage="ไม่พบสินค้าที่ตรงกับการค้นหา"
                required
              />
            </div>

            {/* Current balance simulation box */}
            {selectedProduct && (
              <div className="flex items-center justify-around bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="text-center">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">คงเหลือปัจจุบัน</div>
                  <div className="text-lg font-black text-slate-800 font-mono">
                    {Number(selectedProduct.stockBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-[11px] text-slate-500">{selectedProduct.stockUnit || selectedProduct.unit}</div>
                </div>
                <div className="text-slate-300 text-2xl font-light">+</div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold text-emerald-600 uppercase">จะรับเข้า</div>
                  <div className="text-lg font-black text-emerald-600 font-mono">
                    {Number(qty || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-[11px] text-emerald-600">{selectedProduct.stockUnit || selectedProduct.unit}</div>
                </div>
                <div className="text-slate-300 text-2xl font-light">=</div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold text-indigo-600 uppercase">ยอดคงเหลือใหม่</div>
                  <div className="text-lg font-black text-indigo-700 font-mono">
                    {Number(Math.round(((selectedProduct.stockBalance || 0) + (Number(qty) || 0)) * 10000) / 10000).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-[11px] text-indigo-600">{selectedProduct.stockUnit || selectedProduct.unit}</div>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                จำนวนที่รับเข้า ({selectedProduct?.stockUnit || selectedProduct?.unit || 'หน่วยคลัง'}) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="ระบุจำนวน เช่น 1.25, 10..."
                  className="impeccable-input font-mono font-bold text-emerald-700 text-base"
                  required
                />
                <span className="text-xs font-bold text-slate-600 bg-white px-3 py-2.5 rounded-xl border border-slate-200 shrink-0">
                  {selectedProduct?.stockUnit || selectedProduct?.unit || 'หน่วย'}
                </span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                เหตุผลการรับเข้า <span className="text-rose-500">*</span>
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="impeccable-input font-medium"
              >
                {STOCK_IN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Custom Note */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
              <input
                type="text"
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                placeholder="เช่น: ล็อตนำเข้าจากต่างประเทศ, อ้างอิงใบส่งสินค้าเลขที่..."
                className="impeccable-input font-medium"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-100 bg-white">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button 
            type="submit" 
            form="stockin-form"
            disabled={saving}
            className="px-6 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl shadow-lg shadow-emerald-600/30 transition-all hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'กำลังบันทึก...' : 'บันทึกรับเข้าคลัง'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
