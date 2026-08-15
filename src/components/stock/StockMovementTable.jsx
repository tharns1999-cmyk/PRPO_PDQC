import React, { useState } from 'react';
import { History, ArrowDownRight, ArrowUpRight, X } from 'lucide-react';
import Portal from '../common/Portal';

export default function StockMovementTable({ selectedProduct, stockLogs, onClose }) {
  const [filterType, setFilterType] = useState('ALL'); // ALL, IN, OUT

  if (!selectedProduct) return null;

  // Filter logs for this product, then apply IN/OUT filter
  const productMovementLogs = stockLogs.filter(log => {
    if (log.productId !== selectedProduct.id) return false;
    if (filterType === 'ALL') return true;
    return log.type === filterType;
  });

  return (
    <Portal>
      <div className="fixed inset-0 glass-backdrop z-[100] flex items-center justify-center p-4 overflow-y-auto">
        <div className="impeccable-card p-6 max-w-3xl w-full text-slate-800 space-y-4 my-8 animate-zoom-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-4">
                <History className="w-5 h-5 text-indigo-600" />
                ประวัติการเคลื่อนไหวสินค้า (Stock Movement Log)
              </h3>
              <p className="text-sm text-slate-500 font-mono mt-0.5">
                [{selectedProduct.code}] {selectedProduct.name} (คงเหลือปัจจุบัน: <span className="font-bold text-indigo-600">{selectedProduct.stockBalance}</span> {selectedProduct.unit})
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" title="ปิด">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-500 mr-2">ประเภท:</span>
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterType === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setFilterType('IN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterType === 'IN' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              +IN (รับเข้า)
            </button>
            <button
              onClick={() => setFilterType('OUT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterType === 'OUT' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              -OUT (เบิกจ่าย)
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto max-h-96 border border-slate-200 rounded-xl custom-scrollbar relative">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm text-slate-600 font-semibold sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="p-4">วัน-เวลา</th>
                  <th className="p-4">ประเภท</th>
                  <th className="p-4">เลขที่เอกสาร</th>
                  <th className="p-4 text-right">จำนวน</th>
                  <th className="p-4 text-right">ยอดคงเหลือ</th>
                  <th className="p-4">ผู้ทำรายการ</th>
                  <th className="p-4">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {productMovementLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-slate-400">
                      ไม่พบประวัติความเคลื่อนไหวตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  productMovementLogs.map(log => (
                    <tr key={log.id} className="table-row-impeccable">
                      <td className="p-4 text-slate-600 whitespace-nowrap">{log.date}</td>
                      <td className="p-4">
                        {log.type === 'IN' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded text-[10px]">
                            <ArrowDownRight className="w-3 h-3 text-emerald-600" /> IN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded text-[10px]">
                            <ArrowUpRight className="w-3 h-3 text-rose-600" /> OUT
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800">{log.docNo}</td>
                      <td className={`p-3 text-right font-extrabold ${log.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {log.type === 'IN' ? `+${log.qty}` : `-${log.qty}`}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900">{log.balance}</td>
                      <td className="p-4 text-slate-700">{log.user}</td>
                      <td className="p-4 text-slate-500 italic max-w-[200px] truncate" title={log.note}>{log.note}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white btn-impeccable rounded-lg transition-colors"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}



