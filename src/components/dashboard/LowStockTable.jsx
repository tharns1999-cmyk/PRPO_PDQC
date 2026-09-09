import React, { useMemo } from 'react';
import { AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';

export default function LowStockTable({ products = [], onQuickPR }) {
  const lowStockItems = useMemo(() => {
    return products.filter(p => Number(p.stockBalance || 0) <= Number(p.reorderPoint || 0));
  }, [products]);

  return (
    <div className="bg-white border border-slate-200/70 rounded-3xl overflow-hidden shadow-sm">
      {/* Header Zone */}
      <div className="p-5 sm:px-6 bg-white border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
              <span>สินค้าแตะจุดสั่งซื้อซ้ำ</span>
              <span className="text-xs font-normal text-slate-400 font-sans hidden sm:inline">(Low Stock Alert)</span>
            </h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              รายการที่ยอดคงเหลือในคลังแตะหรือต่ำกว่าจุดสั่งซื้อซ้ำ (ROP)
            </p>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <span className="text-xs bg-rose-50 text-rose-700 font-semibold px-3 py-1 rounded-full border border-rose-200/80 shadow-2xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span>{lowStockItems.length} รายการเร่งด่วน</span>
          </span>
        )}
      </div>

      {/* Content Feed */}
      {lowStockItems.length === 0 ? (
        <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-800">ไม่มีสินค้าคงเหลือต่ำกว่าจุด Reorder Point ในขณะนี้</p>
          <p className="text-xs text-slate-400">ระดับสต็อกสินค้าทุกรายการอยู่ในเกณฑ์ปกติ</p>
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-2.5 max-h-[420px] overflow-y-auto custom-scrollbar">
          {lowStockItems.map(item => {
            const stock = Number(item.stockBalance || 0);
            const rop = Number(item.reorderPoint || 0);
            const ratioPercent = rop > 0 ? Math.min(Math.round((stock / rop) * 100), 100) : 0;

            return (
              <div
                key={item.id}
                className="bg-rose-50/40 border border-rose-200/60 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-rose-50/70 hover:border-rose-300/80 transition-all shadow-2xs group"
              >
                {/* Left: Department Badge + Code + Product Name */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                    item.category === 'PD'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {item.category || 'PD'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200/70 shrink-0">
                        {item.code}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Center: Mini Stock Indicator vs ROP */}
                <div className="flex items-center sm:justify-center gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-rose-600 font-mono tabular-nums">
                      {stock.toLocaleString()} <span className="text-slate-400 font-normal font-sans">/</span> {rop.toLocaleString()} <span className="text-[11px] font-normal text-slate-500 font-sans">{item.unit || 'หน่วย'}</span>
                    </div>
                    {/* หลอดระดับสั้นๆ */}
                    <div className="w-24 bg-slate-200/80 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          ratioPercent <= 30 ? 'bg-rose-600' : ratioPercent <= 70 ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(ratioPercent, 10)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Action Button "⚡ เปิด PR ด่วน" */}
                <div className="shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onQuickPR && onQuickPR(item)}
                    className="bg-slate-950 hover:bg-rose-600 active:scale-[0.98] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    title={`เปิด PR ด่วนสำหรับ ${item.name}`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 group-hover:text-white group-hover:fill-white transition-colors" />
                    <span>เปิด PR ด่วน</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
