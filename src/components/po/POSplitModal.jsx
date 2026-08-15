import React from 'react';
import { createPortal } from 'react-dom';
import { PO_STATUS } from '../../config/constants';
import { Layers, X, Printer, ExternalLink, Building, DollarSign, Package, Info } from 'lucide-react';

import { storageService } from '../../services/storageService';

export default function POSplitModal({ pr, pos = [], onClose, onSelectPO }) {
  if (!pr) return null;

  // Filter POs created from this PR
  const allPOs = pos.length > 0 ? pos : (storageService.getPOs() || []);
  const splitPOs = allPOs.filter(po => !pr || po.prId === pr.id || po.prNo === pr.prNo || po.prId === pr.prNo || po.prNo === pr.id || pos.length > 0);

  const totalAmountAllPOs = splitPOs.reduce((sum, p) => sum + (p.grandTotal || p.subtotal || 0), 0);

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-zoom-in text-slate-800">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                รายการใบสั่งซื้อที่แยกตามผู้ขาย (Split Purchase Orders)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                อ้างอิงใบขอซื้อ (PR): <span className="font-bold text-slate-700 font-mono">{pr.prNo}</span> 
                <span className="mx-2">•</span> 
                แผนก: <span className="font-semibold text-slate-700">{pr.department}</span>
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Banner */}
        <div className="p-4 bg-indigo-50/40 border-b border-indigo-100/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500">จำนวนใบสั่งซื้อที่แยกออก:</span>{' '}
              <span className="font-bold text-indigo-700 text-sm">{splitPOs.length} ใบ</span>
            </div>
            <div className="h-4 w-px bg-indigo-200"></div>
            <div>
              <span className="text-slate-500">ยอดรวมทุกใบ (Grand Total):</span>{' '}
              <span className="font-bold text-slate-800 text-sm font-mono">฿{totalAmountAllPOs.toLocaleString()}</span>
            </div>
          </div>
          <span className="text-[11px] text-indigo-600 font-medium flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>ระบบแยก PO อัตโนมัติตาม Supplier ของสินค้าแต่ละรายการเพื่อความถูกต้องในการสั่งซื้อ</span>
          </span>
        </div>

        {/* Split POs List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
          {splitPOs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Package className="w-12 h-12 stroke-[1.5] mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600 text-sm">ยังไม่มีรายการ PO สำหรับ PR ฉบับนี้</p>
              <p className="text-xs text-slate-400 mt-0.5">PO จะถูกสร้างอัตโนมัติเมื่อ PR ได้รับการอนุมัติ (Final Approval)</p>
            </div>
          ) : (
            splitPOs.map((po, index) => {
              const statusConfig = PO_STATUS[po.status] || { label: po.status, color: 'bg-slate-100 text-slate-700' };
              
              return (
                <div key={po.id} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                  {/* PO Card Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-bold text-slate-800 font-mono text-base">{po.poNo}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          ผู้ขาย: <span className="font-bold text-slate-700">{po.vendorName}</span>
                          {po.vendorId && po.vendorId !== 'ONLINE' && (
                            <span className="text-slate-400 font-mono">({po.vendorId})</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onSelectPO && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectPO(po);
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> ดูรายละเอียด PO
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PO Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100">
                          <th className="py-2.5 pl-4">รหัสสินค้า</th>
                          <th className="py-2.5">ชื่อสินค้า</th>
                          <th className="py-2.5 text-center">จำนวนสั่งซื้อ</th>
                          <th className="py-2.5 text-right">ราคาต่อหน่วย</th>
                          <th className="py-2.5 pr-4 text-right">รวมเงิน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {po.items.map((item, itIdx) => {
                          const pQty = item.purchaseQty ?? item.qty;
                          const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                          const total = item.total || (item.price * pQty);

                          return (
                            <tr key={itIdx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 pl-4 font-mono text-slate-500">{item.code}</td>
                              <td className="py-2.5 font-medium text-slate-800">{item.name}</td>
                              <td className="py-2.5 text-center font-bold text-slate-700">
                                {pQty} <span className="font-normal text-slate-400">{pUnit}</span>
                              </td>
                              <td className="py-2.5 text-right font-mono text-slate-600">
                                ฿{item.price?.toLocaleString()}
                              </td>
                              <td className="py-2.5 pr-4 text-right font-bold font-mono text-slate-800">
                                ฿{total?.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Subtotal & VAT */}
                        <tr className="bg-slate-50/60 font-semibold text-slate-600">
                          <td colSpan="4" className="py-2 text-right pr-3">มูลค่ารวม (Sub Total)</td>
                          <td className="py-2 pr-4 text-right font-mono text-slate-800">฿{po.subtotal?.toLocaleString()}</td>
                        </tr>
                        {po.vat > 0 && (
                          <tr className="bg-slate-50/60 font-semibold text-slate-600">
                            <td colSpan="4" className="py-1.5 text-right pr-3">ภาษีมูลค่าเพิ่ม (VAT 7%)</td>
                            <td className="py-1.5 pr-4 text-right font-mono text-slate-800">฿{po.vat?.toLocaleString()}</td>
                          </tr>
                        )}
                        <tr className="bg-indigo-50/50 font-bold text-indigo-900 border-t border-indigo-100">
                          <td colSpan="4" className="py-2 text-right pr-3">ยอดสุทธิ (Grand Total)</td>
                          <td className="py-2 pr-4 text-right font-mono text-indigo-700 text-sm">฿{po.grandTotal?.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            รวมทั้งสิ้น {splitPOs.length} ใบสั่งซื้อ | ยอดรวมสุทธิ ฿{totalAmountAllPOs.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
