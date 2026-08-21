import React from 'react';
import { AlertTriangle, PlusCircle, CheckCircle2 } from 'lucide-react';

export default function LowStockTable({ products, onQuickPR }) {
  const lowStockItems = products.filter(p => p.stockBalance <= p.reorderPoint);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-5 sm:px-7 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 tracking-tight">สินค้าแตะจุดสั่งซื้อซ้ำ (Low Stock Alert)</h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">รายการที่ยอดคงเหลือในคลังแตะหรือต่ำกว่าจุดสั่งซื้อซ้ำ (ROP)</p>
          </div>
        </div>
        <span className="text-xs bg-rose-50 text-rose-700 px-3.5 py-1 rounded-full border border-rose-200/80 font-semibold tracking-wide w-fit">
          {lowStockItems.length} รายการที่ต้องสั่งเพิ่ม
        </span>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
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
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 pl-7">รหัสสินค้า</th>
                <th className="py-3.5 px-4">ชื่อสินค้า</th>
                <th className="py-3.5 px-4">ฝ่าย</th>
                <th className="py-3.5 px-4 text-right">คงเหลือจริง</th>
                <th className="py-3.5 px-4 text-right">จุดสั่งซื้อ (ROP)</th>
                <th className="py-3.5 pr-7 text-center">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStockItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="py-3.5 pl-7 font-mono font-semibold text-slate-700 text-xs">{item.code}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{item.name}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.category === 'PD' ? 'bg-blue-50 text-blue-700 border-blue-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-rose-600 font-mono tabular-nums">
                    {item.stockBalance} <span className="text-xs font-normal text-slate-400 font-sans">{item.unit}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-500 font-mono tabular-nums">
                    {item.reorderPoint} <span className="text-xs font-normal text-slate-400 font-sans">{item.unit}</span>
                  </td>
                  <td className="py-3.5 pr-7 text-center">
                    <button
                      onClick={() => onQuickPR(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl transition-all text-xs font-semibold cursor-pointer shadow-2xs"
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
