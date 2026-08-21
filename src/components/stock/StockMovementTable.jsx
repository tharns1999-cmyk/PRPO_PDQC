import React, { useState } from 'react';
import { History, ArrowDownRight, ArrowUpRight, X } from 'lucide-react';
import Portal from '../common/Portal';

export default function StockMovementTable({ selectedProduct: propSelectedProduct, product, stockLogs = [], onClose }) {
  const [filterType, setFilterType] = useState('ALL'); // ALL, IN, OUT
  const selectedProduct = product || propSelectedProduct;

  if (!selectedProduct) return null;

  // Filter logs for this product, then apply IN/OUT filter
  const productMovementLogs = stockLogs.filter(log => {
    if (log.productId !== selectedProduct.id && log.productCode !== selectedProduct.code) return false;
    if (filterType === 'ALL') return true;
    return log.type === filterType;
  });

  return (
    <Portal>
      <div className="fixed inset-0 glass-backdrop z-[100] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-7 max-w-4xl w-full text-slate-800 space-y-4 my-8 animate-zoom-in">
          
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
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  [{selectedProduct.code}] {selectedProduct.name} • คงเหลือปัจจุบัน: <span className="font-bold text-indigo-600 tabular-nums">{selectedProduct.stockBalance}</span> {selectedProduct.unit}
                </p>
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

          {/* Filters */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">ประเภท:</span>
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setFilterType('IN')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'IN' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                +IN (รับเข้า)
              </button>
              <button
                onClick={() => setFilterType('OUT')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'OUT' ? 'bg-rose-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                -OUT (เบิกจ่าย)
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto max-h-96 border border-slate-200/80 rounded-2xl custom-scrollbar relative">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/90 shadow-2xs text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 pl-6">วัน-เวลา</th>
                  <th className="py-3.5 px-4">ประเภท</th>
                  <th className="py-3.5 px-4">เลขที่เอกสาร</th>
                  <th className="py-3.5 px-4 text-right">จำนวน</th>
                  <th className="py-3.5 px-4 text-right">ยอดคงเหลือ</th>
                  <th className="py-3.5 px-4">ผู้ทำรายการ</th>
                  <th className="py-3.5 pr-6">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productMovementLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">
                      ไม่พบประวัติความเคลื่อนไหวตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  productMovementLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-6 text-slate-500 whitespace-nowrap font-mono text-xs">{log.date}</td>
                      <td className="py-3.5 px-4">
                        {log.type === 'IN' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-emerald-200">
                            <ArrowDownRight className="w-3 h-3 text-emerald-600" /> IN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-rose-200">
                            <ArrowUpRight className="w-3 h-3 text-rose-600" /> OUT
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 text-xs">{log.docNo}</td>
                      <td className={`py-3.5 px-4 text-right font-mono font-bold tabular-nums ${log.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {log.type === 'IN' ? `+${log.qty}` : `-${log.qty}`}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">{log.balance}</td>
                      <td className="py-3.5 px-4 text-slate-700 text-xs">{log.user}</td>
                      <td className="py-3.5 pr-6 text-slate-600 text-xs max-w-xs truncate">{log.note || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="pt-2 flex justify-end">
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
