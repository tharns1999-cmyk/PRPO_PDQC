const fs = require('fs');
const file = 'src/components/po/PrintablePO.jsx';
let content = fs.readFileSync(file, 'utf8');

const startTag = '{/* ==================== HEADER & VENDOR BLOCK (CLEAN STRUCTURE) ==================== */}';
const endTag = '{/* Items Table */}';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const userBlock = `
{/* ==================== HEADER & VENDOR BLOCK (CLEAN STRUCTURE) ==================== */}
<div className="w-full font-sans text-slate-800">
  
  {/* 1. ส่วนหัวบริษัท และ กล่องเลขที่ PO ด้านบนสุด */}
  <div className="flex items-start justify-between gap-6 pb-4 border-b border-slate-200">
    {/* ฝั่งซ้าย: โลโก้ + ข้อมูลบริษัท เศรษฐชล */}
    <div className="flex items-start gap-4">
      <img 
        src="/images/sc-logo.png" 
        alt="Logo" 
        className="h-16 w-auto object-contain shrink-0 mt-0.5" 
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-bold text-slate-900 leading-snug">
          บริษัท เศรษฐชล จำกัด (สำนักงานใหญ่)
        </h1>
        <p className="text-xs text-slate-600 leading-normal">
          ที่อยู่ 225 หมู่ที่ 12 ถนนเทพารักษ์ ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ 10540
        </p>
        <p className="text-xs text-slate-600 leading-normal">
          เลขประจำตัวผู้เสียภาษี (TAX ID): <span className="font-mono font-medium">0-10553-2104-63-7</span>
        </p>
        <div className="mt-1">
          <span className="text-sm font-bold text-blue-900 tracking-tight">
            ใบสั่งซื้อสินค้า / PURCHASE ORDER
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 font-medium">
          <span>อ้างอิงใบขอซื้อ (PR): <strong className="text-slate-800 font-mono">{po.prNumber || po.prId || '-'}</strong></span>
          <span>•</span>
          <span>แผนกผู้ขอ: <strong className="text-slate-800">{po.department || '-'}</strong></span>
        </div>
      </div>
    </div>

    {/* ฝั่งขวา: กล่องเลขที่ PO ชิดขอบบนสุดเสมอ */}
    <div className="shrink-0 w-52 border border-slate-300 rounded-lg p-2.5 bg-slate-50/70 text-xs shadow-2xs self-start">
      <div className="flex justify-between items-center mb-1">
        <span className="text-slate-500 font-medium">เลขที่ PO:</span>
        <span className="font-mono font-bold text-slate-900">{po.id || po.poNumber}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-slate-500 font-medium">วันที่ออก PO:</span>
        <span className="font-mono text-slate-700">{po.issuedDate || po.createdAt ? new Date(po.issuedDate || po.createdAt).toLocaleDateString('th-TH') : '2026-09-11'}</span>
      </div>
    </div>
  </div>

  {/* 2. กล่องข้อมูลผู้จำหน่าย (CSS Grid ชัดเจน ไม่ทับซ้อน 100%) */}
  <div className="my-4 p-3 rounded-lg border border-slate-200 bg-slate-50/40 text-xs">
    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 mb-2 font-bold text-slate-900">
      <span>ข้อมูลคู่ค้า / ผู้จำหน่าย</span>
      <span className="font-mono text-slate-500 font-normal">รหัสผู้ขาย: {po.vendorCode || po.vendorDetails?.code || '-'}</span>
    </div>
    
    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
      {/* ฝั่งซ้าย */}
      <div className="space-y-1">
        <div>
          <span className="font-medium text-slate-500">ชื่อบริษัท/ร้านค้า: </span>
          <span className="font-bold text-slate-900 break-words">{po.vendorName || po.vendorDetails?.name || 'ไม่ระบุผู้ขาย (รอจัดซื้อดำเนินการ)'}</span>
        </div>
        <div>
          <span className="font-medium text-slate-500">เลขประจำตัวผู้เสียภาษี: </span>
          <span className="font-mono text-slate-800">{po.vendorDetails?.taxId || '-'}</span>
        </div>
        <div>
          <span className="font-medium text-slate-500">ที่อยู่: </span>
          <span className="text-slate-700 break-words">{po.vendorDetails?.address || '-'}</span>
        </div>
      </div>

      {/* ฝั่งขวา */}
      <div className="space-y-1">
        <div>
          <span className="font-medium text-slate-500">ผู้ติดต่อ: </span>
          <span className="text-slate-800">{po.vendorDetails?.contactPerson || '-'}</span>
        </div>
        <div>
          <span className="font-medium text-slate-500">โทรศัพท์: </span>
          <span className="font-mono text-slate-800">{po.vendorDetails?.phone || '-'}</span>
        </div>
      </div>
    </div>
  </div>

</div>
{/* ================================================================================= */}

      `;

const newContent = content.substring(0, startIndex) + userBlock.trim() + '\n\n      ' + content.substring(endIndex);
fs.writeFileSync(file, newContent);
console.log("Replaced successfully!");
