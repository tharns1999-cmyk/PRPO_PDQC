import React from 'react';

export default function PrintablePO({ po }) {
  if (!po) return null;

  return (
    <div className="bg-white text-black p-8 max-w-[210mm] mx-auto text-sm font-sans">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider">บริษัท พีดีคิวซี จำกัด (PDQC Co., Ltd.)</h1>
          <p className="text-sm mt-1">123/45 ถนนอุตสาหกรรม ตำบลโรงงาน อำเภอผลิตผล 10000</p>
          <p className="text-sm">โทร: 02-123-4567 | อีเมล: info@pdqc.co.th</p>
          <p className="text-sm mt-2 font-semibold">
            อ้างอิงใบขอซื้อ (PR Ref): <span className="font-bold">{po.prNo}</span> 
            <span className="ml-4">แผนกที่ขอซื้อ: {po.department}</span>
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-black uppercase text-gray-800">ใบสั่งซื้อ</h2>
          <h2 className="text-xl font-bold uppercase tracking-widest text-gray-600 mb-2">Purchase Order</h2>
          <p className="font-bold text-lg">{po.poNo}</p>
          <p className="text-sm mt-1">วันที่ (Date): {po.issueDate}</p>

        </div>
      </div>

      {/* Vendor Info */}
      <div className="border border-black p-4 mb-6 rounded-sm">
        <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">ข้อมูลผู้ขาย (Vendor Information)</h3>
        <p><span className="font-semibold w-24 inline-block">ชื่อบริษัท:</span> {po.vendorName}</p>
        <p><span className="font-semibold w-24 inline-block">รหัสผู้ขาย:</span> {po.vendorId}</p>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-black mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-4 w-12 text-center">ลำดับ<br/>(No.)</th>
            <th className="border border-black p-4 w-24 text-center">รหัสสินค้า<br/>(Code)</th>
            <th className="border border-black p-4 text-left">รายการสินค้า<br/>(Description)</th>
            <th className="border border-black p-4 w-20 text-center">จำนวน<br/>(Qty)</th>
            <th className="border border-black p-4 w-24 text-right">ราคาหน่วย<br/>(Unit Price)</th>
            <th className="border border-black p-4 w-32 text-right">จำนวนเงิน<br/>(Amount)</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((item, index) => (
            <tr key={index}>
              <td className="border border-black p-4 text-center">{index + 1}</td>
              <td className="border border-black p-4 text-center font-mono text-sm">{item.code}</td>
              <td className="border border-black p-4">{item.name}</td>
              <td className="border border-black p-4 text-center">{item.qty} {item.unit}</td>
              <td className="border border-black p-4 text-right">{(item.price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-4 text-right">{(item.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          ))}
          
          {/* Empty rows for padding if few items */}
          {po.items.length < 5 && Array.from({ length: 5 - po.items.length }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td className="border-x border-black p-4 h-8"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
              <td className="border-x border-black p-4"></td>
            </tr>
          ))}

          {/* Totals */}
          {po.vat > 0 ? (
            <>
              <tr>
                <td colSpan="4" rowSpan="3" className="border border-black p-4 align-top">
                  <span className="font-semibold text-sm">หมายเหตุ (Remarks):</span>
                  <p className="text-sm mt-1">1. โปรดระบุเลขที่ใบสั่งซื้อ (PO No.) ในเอกสารใบกำกับภาษีทุกครั้ง</p>
                  <p className="text-sm">2. กรณีส่งมอบล่าช้ากว่ากำหนด บริษัทขอสงวนสิทธิ์ในการปรับ</p>
                </td>
                <td className="border border-black p-4 text-right font-bold text-sm">รวมเป็นเงิน<br/>(Sub Total)</td>
                <td className="border border-black p-4 text-right font-bold">{(po.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td className="border border-black p-4 text-right font-bold text-sm">ภาษีมูลค่าเพิ่ม<br/>(VAT 7%)</td>
                <td className="border border-black p-4 text-right font-bold">{(po.vat || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td className="border border-black p-4 text-right font-bold text-sm bg-gray-100">ยอดเงินสุทธิ<br/>(Grand Total)</td>
                <td className="border border-black p-4 text-right font-bold text-sm bg-gray-100">{(po.grandTotal || po.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan="4" className="border border-black p-4 align-top">
                <span className="font-semibold text-sm">หมายเหตุ (Remarks):</span>
                <p className="text-sm mt-1">1. โปรดระบุเลขที่ใบสั่งซื้อ (PO No.) ในเอกสารใบกำกับภาษีทุกครั้ง</p>
                <p className="text-sm">2. กรณีส่งมอบล่าช้ากว่ากำหนด บริษัทขอสงวนสิทธิ์ในการปรับ</p>
              </td>
              <td className="border border-black p-4 text-right font-bold text-sm bg-gray-100">ยอดเงินสุทธิ<br/>(Grand Total)</td>
              <td className="border border-black p-4 text-right font-bold text-sm bg-gray-100">{(po.grandTotal || po.totalAmount || po.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-2 mt-12 text-center">
        <div>
          <div className="border-b border-black w-3/4 mx-auto mb-2 h-10"></div>
          <p className="font-semibold">ผู้จัดทำ (Prepared By)</p>
          <p className="text-sm mt-1">วันที่ ___________________</p>
        </div>
        <div>
          <div className="border-b border-black w-3/4 mx-auto mb-2 h-10"></div>
          <p className="font-semibold">ผู้อนุมัติ (Authorized By)</p>
          <p className="text-sm mt-1">วันที่ ___________________</p>
        </div>
        <div>
          <div className="border-b border-black w-3/4 mx-auto mb-2 h-10"></div>
          <p className="font-semibold">ผู้ขายรับเอกสาร (Accepted By)</p>
          <p className="text-sm mt-1">วันที่ ___________________</p>
        </div>
      </div>
    </div>
  );
}



