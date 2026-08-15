import React from 'react';
import { AlertTriangle, PlusCircle, CheckCircle2 } from 'lucide-react';

export default function LowStockTable({ products, onQuickPR }) {
  const lowStockItems = products.filter(p => p.stockBalance <= p.reorderPoint);

  return (
    <div className="impeccable-card overflow-hidden bg-white border border-slate-200">
      <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-400/20 text-amber-300 rounded-xl">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white tracking-tight">สินค้าแจ้งเตือนสต็อกต่ำ (Low Stock Alert)</h3>
            <p className="text-[11px] text-slate-400">รายการที่ยอดคงเหลือในคลังแตะหรือต่ำกว่าจุดสั่งซื้อซ้ำ (ROP)</p>
          </div>
        </div>
        <span className="text-xs bg-rose-500/20 text-rose-300 px-3 py-1 rounded-full border border-rose-500/30 font-bold tracking-wide w-fit">
          {lowStockItems.length} รายการที่ต้องสั่งเพิ่ม
        </span>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700">ไม่มีสินค้าคงเหลือต่ำกว่าจุด Reorder Point ในขณะนี้</p>
            <p className="text-xs text-slate-400 mt-0.5">ระดับสต็อกสินค้าทุกรายการอยู่ในเกณฑ์ปกติ</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar relative">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 pl-6">รหัสสินค้า</th>
                <th className="py-4">ชื่อสินค้า</th>
                <th className="py-4">ฝ่าย</th>
                <th className="py-4 text-right">คงเหลือจริง</th>
                <th className="py-4 text-right">จุดสั่งซื้อ (ROP)</th>
                <th className="py-4 text-center pr-6">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStockItems.map(item => (
                <tr key={item.id} className="hover:bg-amber-50/40 transition-colors group">
                  <td className="py-4 pl-6 font-mono font-medium text-slate-600 text-xs">{item.code}</td>
                  <td className="py-4 font-semibold text-slate-800">{item.name}</td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${item.category === 'PD' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="py-4 text-right font-black text-rose-600 font-mono">
                    {item.stockBalance} <span className="text-xs font-normal text-slate-400 font-sans">{item.unit}</span>
                  </td>
                  <td className="py-4 text-right font-semibold text-slate-500 font-mono">
                    {item.reorderPoint} <span className="text-xs font-normal text-slate-400 font-sans">{item.unit}</span>
                  </td>
                  <td className="py-4 text-center pr-6">
                    <button
                      onClick={() => onQuickPR(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer"
                      title="เปิด PR สินค้านี้ทันที"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>เปิด PR ด่วน</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
