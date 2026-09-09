import React, { useState, useMemo } from 'react';
import { AlertTriangle, PlusCircle, CheckCircle2 } from 'lucide-react';
import Pagination from '../common/Pagination';

export default function LowStockTable({ products = [], onQuickPR }) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const lowStockItems = useMemo(() => {
    return products.filter(p => p.stockBalance <= p.reorderPoint);
  }, [products]);

  const totalPages = Math.ceil(lowStockItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return lowStockItems.slice(start, start + pageSize);
  }, [lowStockItems, currentPage, pageSize]);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <div className="p-6 sm:px-8 bg-white border-b border-slate-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-rose-50/70 text-rose-600 rounded-xl border border-rose-100/60 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-slate-900 tracking-tight">สินค้าแตะจุดสั่งซื้อซ้ำ (Low Stock Alert)</h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">รายการที่ยอดคงเหลือในคลังแตะหรือต่ำกว่าจุดสั่งซื้อซ้ำ (ROP)</p>
          </div>
        </div>
        <span className="text-xs bg-rose-50/70 text-rose-700 px-3.5 py-1 rounded-full border border-rose-200/50 font-medium tracking-wide w-fit">
          {lowStockItems.length} รายการที่ต้องสั่งเพิ่ม
        </span>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50/70 text-emerald-600 flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">ไม่มีสินค้าคงเหลือต่ำกว่าจุด Reorder Point ในขณะนี้</p>
            <p className="text-xs text-slate-400 mt-1">ระดับสต็อกสินค้าทุกรายการอยู่ในเกณฑ์ปกติ</p>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto overflow-y-auto max-h-[380px] custom-scrollbar relative">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 pl-8">รหัสสินค้า</th>
                  <th className="py-3.5 px-5">ชื่อสินค้า</th>
                  <th className="py-3.5 px-5">ฝ่าย</th>
                  <th className="py-3.5 px-5 text-right">คงเหลือจริง</th>
                  <th className="py-3.5 px-5 text-right">จุดสั่งซื้อ (ROP)</th>
                  <th className="py-3.5 pr-8 text-center">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {paginatedItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3.5 pl-8 font-mono font-medium text-slate-600 text-xs">{item.code}</td>
                    <td className="py-3.5 px-5 font-medium text-slate-900">{item.name}</td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${item.category === 'PD' ? 'bg-blue-50/80 text-blue-700 border-blue-200/50' : 'bg-amber-50/80 text-amber-700 border-amber-200/50'}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-semibold text-rose-600 font-mono tabular-nums">
                      {Number(item.stockBalance || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">{item.unit}</span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-medium text-slate-500 font-mono tabular-nums">
                      {Number(item.reorderPoint || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">{item.unit}</span>
                    </td>
                    <td className="py-3.5 pr-8 text-center">
                      <button
                        onClick={() => onQuickPR && onQuickPR(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all text-xs font-medium cursor-pointer shadow-xs hover:shadow-sm"
                        title="เปิด PR สินค้านี้ทันที"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-slate-300" />
                        <span>เปิด PR ด่วน</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={lowStockItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
