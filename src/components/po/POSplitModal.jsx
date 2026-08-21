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
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-xl border border-slate-200 overflow-hidden flex flex-col text-slate-800 animate-zoom-in">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-2xs border border-indigo-100/80 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-800">
                รายละเอียดการแยกใบสั่งซื้อ (Split PO Details)
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                อ้างอิงใบขอซื้อ (PR): <span className="font-mono font-semibold text-slate-800">{pr?.prNo}</span> • แผนก: <strong className="text-slate-800 font-semibold">{pr?.department}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer shrink-0"
            title="ปิดหน้าต่าง (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Banner */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 px-5 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <span className="text-slate-500">จำนวนใบสั่งซื้อที่แยกออก:</span>{' '}
              <span className="font-bold text-slate-800">{splitPOs.length} ใบ</span>
            </div>
            <div className="h-3.5 w-px bg-indigo-200"></div>
            <div>
              <span className="text-slate-500">ยอดรวมทุกใบ (Grand Total):</span>{' '}
              <span className="font-bold text-slate-900 font-mono text-sm sm:text-base">฿{totalAmountAllPOs.toLocaleString()}</span>
            </div>
          </div>
          <span className="text-xs text-indigo-800 font-medium flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>ระบบแยก PO อัตโนมัติตาม Supplier ของสินค้าแต่ละรายการ</span>
          </span>
        </div>

        {/* Split POs List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-slate-50/50">
          {splitPOs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Package className="w-10 h-10 stroke-[1.5] mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600 text-sm">ยังไม่มีรายการ PO สำหรับ PR ฉบับนี้</p>
              <p className="text-xs text-slate-400 mt-1">PO จะถูกสร้างอัตโนมัติเมื่อ PR ได้รับการอนุมัติ (Final Approval)</p>
            </div>
          ) : (
            splitPOs.map((po, index) => {
              const statusConfig = PO_STATUS[po.status] || { label: po.status, color: 'bg-slate-100 text-slate-700' };
              
              return (
                <div key={po.id} className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
                  {/* PO Card Header */}
                  <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 font-mono text-sm sm:text-base">{po.poNo}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>ผู้ขาย: <strong className="text-slate-800 font-semibold">{po.vendorName}</strong></span>
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> ดูรายละเอียด PO
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PO Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80 text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 pl-4 w-1 whitespace-nowrap">รหัสสินค้า</th>
                          <th className="py-2.5 px-3">ชื่อสินค้า</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">จำนวนสั่งซื้อ</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">ราคาต่อหน่วย (฿)</th>
                          <th className="py-2.5 pr-4 text-right whitespace-nowrap">รวมเงิน (฿)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {po.items.map((item, itIdx) => {
                          const pQty = item.purchaseQty ?? item.qty;
                          const pUnit = item.purchaseUnit || item.unit || 'ชิ้น';
                          const total = item.total || (item.price * pQty);

                          return (
                            <tr key={itIdx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3 pl-4 whitespace-nowrap">
                                <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">{item.code || '-'}</span>
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-slate-800 text-xs sm:text-sm break-words max-w-sm" title={item.name}>
                                  {item.name}
                                </div>
                                {item.onlineUrl && (
                                  <a href={item.onlineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/70 px-2 py-0.5 rounded-md transition-colors font-medium">
                                    <Globe className="w-3 h-3" />
                                    <span>ลิงก์สินค้า</span>
                                  </a>
                                )}
                              </td>
                              <td className="p-3 text-center font-bold text-slate-800 font-mono whitespace-nowrap">
                                {pQty} <span className="font-normal text-slate-500 text-xs">{pUnit}</span>
                              </td>
                              <td className="p-3 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                                ฿{item.price?.toLocaleString()}
                              </td>
                              <td className="p-3 pr-4 text-right font-bold font-mono text-slate-800 whitespace-nowrap">
                                ฿{total?.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50/50 border-t border-slate-200/80 text-xs text-slate-600">
                          <td colSpan="4" className="py-2 px-4 text-right font-medium">มูลค่ารวม (Sub Total):</td>
                          <td className="py-2 pr-4 text-right font-semibold font-mono text-slate-800">฿{po.subtotal?.toLocaleString()}</td>
                        </tr>
                        {po.vat > 0 && (
                          <tr className="bg-slate-50/50 text-xs text-indigo-700">
                            <td colSpan="4" className="py-2 px-4 text-right font-medium">ภาษีมูลค่าเพิ่ม (VAT 7%):</td>
                            <td className="py-2 pr-4 text-right font-semibold font-mono">฿{po.vat?.toLocaleString()}</td>
                          </tr>
                        )}
                        <tr className="bg-slate-50/90 border-t border-slate-200/80 text-xs">
                          <td colSpan="4" className="py-2.5 px-4 text-right font-semibold text-slate-700">ยอดสุทธิ (Grand Total):</td>
                          <td className="py-2.5 pr-4 text-right font-bold font-mono text-slate-900 text-sm">฿{po.grandTotal?.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs sm:text-sm text-slate-500 font-medium">
            รวมทั้งสิ้น {splitPOs.length} ใบสั่งซื้อ | ยอดรวมสุทธิ <strong className="font-mono text-slate-900 font-bold">฿{totalAmountAllPOs.toLocaleString()}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-slate-300/80 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
