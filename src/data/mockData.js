// Initial Mock Master Data for Production (PD) & Quality Control (QC)
// Designed for local testing without pre-existing PR/PO workflow documents

export const initialProducts = [
  // ─── PRODUCTION (PD) ITEMS ───
  {
    id: 'PROD-PD-001',
    code: 'PD-OIL-068',
    name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
    category: 'PD',
    purchaseUnit: 'ถัง (200L)',
    stockUnit: 'ลิตร',
    conversionRate: 200,
    unit: 'ลิตร',
    price: 14500,
    stockBalance: 2400,
    reorderPoint: 1000,
    leadTimeDays: 5,
    supplierId: null
  },
  {
    id: 'PROD-PD-002',
    code: 'PD-GRS-002',
    name: 'จาระบีทนความร้อนสูงเกรดอาหาร (High-Temp Food Grade Grease NLGI 2)',
    category: 'PD',
    purchaseUnit: 'กล่อง (12 กระป๋อง)',
    stockUnit: 'กระป๋อง',
    conversionRate: 12,
    unit: 'กระป๋อง',
    price: 9600,
    stockBalance: 25,
    reorderPoint: 10,
    leadTimeDays: 3,
    supplierId: null
  },
  {
    id: 'PROD-PD-003',
    code: 'PD-BLT-380',
    name: 'สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15)',
    category: 'PD',
    purchaseUnit: 'เส้น',
    stockUnit: 'เส้น',
    conversionRate: 1,
    unit: 'เส้น',
    price: 620,
    stockBalance: 6,
    reorderPoint: 8,
    leadTimeDays: 7,
    supplierId: null
  },
  {
    id: 'PROD-PD-004',
    code: 'PD-GLV-NBR',
    name: 'ถุงมือไนไตรล์ป้องกันสารเคมี (Nitrile Chemical Resistant Gloves Size L)',
    category: 'PD',
    purchaseUnit: 'กล่อง (100 ชิ้น)',
    stockUnit: 'ชิ้น',
    conversionRate: 100,
    unit: 'ชิ้น',
    price: 320,
    stockBalance: 2000,
    reorderPoint: 750,
    leadTimeDays: 3,
    supplierId: null
  },
  {
    id: 'PROD-PD-005',
    code: 'PD-CLN-IND',
    name: 'น้ำยาทำความสะอาดคราบน้ำมันเครื่องจักร (Heavy Duty Degreaser Cleaner)',
    category: 'PD',
    purchaseUnit: 'แกลลอน (20L)',
    stockUnit: 'ลิตร',
    conversionRate: 20,
    unit: 'ลิตร',
    price: 1850,
    stockBalance: 360,
    reorderPoint: 120,
    leadTimeDays: 4,
    supplierId: null
  },
  {
    id: 'PROD-PD-006',
    code: 'PD-FLT-050',
    name: 'ไส้กรองน้ำมันระบบหล่อเย็น (Coolant Cartridge Filter 50 Micron)',
    category: 'PD',
    purchaseUnit: 'กล่อง (10 ชิ้น)',
    stockUnit: 'ชิ้น',
    conversionRate: 10,
    unit: 'ชิ้น',
    price: 4200,
    stockBalance: 30,
    reorderPoint: 12,
    leadTimeDays: 5,
    supplierId: null
  },
  {
    id: 'PROD-PD-007',
    code: 'PD-STP-015',
    name: 'สายรัดพาเลทพลาสติก PP Band (15mm x 3000m)',
    category: 'PD',
    purchaseUnit: 'ม้วน',
    stockUnit: 'ม้วน',
    conversionRate: 1,
    unit: 'ม้วน',
    price: 980,
    stockBalance: 20,
    reorderPoint: 8,
    leadTimeDays: 3,
    supplierId: null
  },
  {
    id: 'PROD-PD-008',
    code: 'PD-STF-001',
    name: 'ฟิล์มยืดพันพาเลท (Stretch Film 15 Micron 500mm x 300m)',
    category: 'PD',
    purchaseUnit: 'ลัง (6 ม้วน)',
    stockUnit: 'ม้วน',
    conversionRate: 6,
    unit: 'ม้วน',
    price: 1100,
    stockBalance: 60,
    reorderPoint: 25,
    leadTimeDays: 2,
    supplierId: null
  },
  {
    id: 'PROD-PD-009',
    code: 'PD-BRG-620',
    name: 'ตลับลูกปืนเม็ดกลมร่องลึก (Deep Groove Ball Bearing 6205-2RS)',
    category: 'PD',
    purchaseUnit: 'ตลับ',
    stockUnit: 'ตลับ',
    conversionRate: 1,
    unit: 'ตลับ',
    price: 280,
    stockBalance: 22,
    reorderPoint: 10,
    leadTimeDays: 5,
    supplierId: null
  },
  {
    id: 'PROD-PD-010',
    code: 'PD-MSK-N95',
    name: 'หน้ากากป้องกันฝุ่นละอองและละอองสารเคมี N95',
    category: 'PD',
    purchaseUnit: 'กล่อง (20 ชิ้น)',
    stockUnit: 'ชิ้น',
    conversionRate: 20,
    unit: 'ชิ้น',
    price: 480,
    stockBalance: 700,
    reorderPoint: 300,
    leadTimeDays: 3,
    supplierId: null
  },

  // ─── QUALITY CONTROL (QC) ITEMS ───
  {
    id: 'PROD-QC-001',
    code: 'QC-BUF-PH7',
    name: 'สารละลายบัฟเฟอร์มาตรฐานสอบเทียบ pH 7.00 Buffer Solution (500ml)',
    category: 'QC',
    purchaseUnit: 'ขวด',
    stockUnit: 'ขวด',
    conversionRate: 1,
    unit: 'ขวด',
    price: 750,
    stockBalance: 8,
    reorderPoint: 4,
    leadTimeDays: 5,
    supplierId: null
  },
  {
    id: 'PROD-QC-002',
    code: 'QC-BUF-PH4',
    name: 'สารละลายบัฟเฟอร์มาตรฐานสอบเทียบ pH 4.01 Buffer Solution (500ml)',
    category: 'QC',
    purchaseUnit: 'ขวด',
    stockUnit: 'ขวด',
    conversionRate: 1,
    unit: 'ขวด',
    price: 750,
    stockBalance: 6,
    reorderPoint: 3,
    leadTimeDays: 5,
    supplierId: null
  },
  {
    id: 'PROD-QC-003',
    code: 'QC-PPT-100',
    name: 'ทิปปิเปตไมโครสีขาว (Micropipette Tips 100-1000 uL, DNase/RNase Free)',
    category: 'QC',
    purchaseUnit: 'กล่อง (1000 ชิ้น)',
    stockUnit: 'ชิ้น',
    conversionRate: 1000,
    unit: 'ชิ้น',
    price: 1200,
    stockBalance: 15000,
    reorderPoint: 5000,
    leadTimeDays: 4,
    supplierId: null
  },
  {
    id: 'PROD-QC-004',
    code: 'QC-FLT-WAT',
    name: 'กระดาษกรองเชิงคุณภาพ Whatman Grade 1 (เส้นผ่านศูนย์กลาง 110mm)',
    category: 'QC',
    purchaseUnit: 'กล่อง (100 แผ่น)',
    stockUnit: 'แผ่น',
    conversionRate: 100,
    unit: 'แผ่น',
    price: 950,
    stockBalance: 1200,
    reorderPoint: 400,
    leadTimeDays: 7,
    supplierId: null
  },
  {
    id: 'PROD-QC-005',
    code: 'QC-AGR-PCA',
    name: 'อาหารเลี้ยงเชื้อ Plate Count Agar (PCA) สำหรับทดสอบจุลชีววิทยา (500g)',
    category: 'QC',
    purchaseUnit: 'ขวด (500g)',
    stockUnit: 'กรัม',
    conversionRate: 500,
    unit: 'กรัม',
    price: 2850,
    stockBalance: 2500,
    reorderPoint: 1000,
    leadTimeDays: 10,
    supplierId: null
  },
  {
    id: 'PROD-QC-006',
    code: 'QC-PDI-STR',
    name: 'แผ่นทดสอบความสะอาดสวอปสำเร็จรูป (Surface Hygiene Swab Test Kits)',
    category: 'QC',
    purchaseUnit: 'กล่อง (50 ชิ้น)',
    stockUnit: 'ชิ้น',
    conversionRate: 50,
    unit: 'ชิ้น',
    price: 3600,
    stockBalance: 400,
    reorderPoint: 150,
    leadTimeDays: 7,
    supplierId: null
  },
  {
    id: 'PROD-QC-007',
    code: 'QC-THM-CAL',
    name: 'โพรบวัดอุณหภูมิดิจิตอลพร้อมใบรับรองการสอบเทียบ ISO/IEC 17025',
    category: 'QC',
    purchaseUnit: 'ชุด',
    stockUnit: 'ชุด',
    conversionRate: 1,
    unit: 'ชุด',
    price: 4500,
    stockBalance: 4,
    reorderPoint: 2,
    leadTimeDays: 14,
    supplierId: null
  },
  {
    id: 'PROD-QC-008',
    code: 'QC-BEA-250',
    name: 'บีกเกอร์แก้วโบโรซิลิเกตทนความร้อน (Glass Beaker Borosilicate 250ml)',
    category: 'QC',
    purchaseUnit: 'ชิ้น',
    stockUnit: 'ชิ้น',
    conversionRate: 1,
    unit: 'ชิ้น',
    price: 160,
    stockBalance: 25,
    reorderPoint: 10,
    leadTimeDays: 3,
    supplierId: null
  },
  {
    id: 'PROD-QC-009',
    code: 'QC-IPA-998',
    name: 'ไอโซโพรพิลแอลกอฮอล์เกรดวิเคราะห์ (Isopropanol / IPA 99.8% AR Grade 2.5L)',
    category: 'QC',
    purchaseUnit: 'แกลลอน (2.5L)',
    stockUnit: 'ลิตร',
    conversionRate: 2.5,
    unit: 'ลิตร',
    price: 1350,
    stockBalance: 25,
    reorderPoint: 10,
    leadTimeDays: 4,
    supplierId: null
  },
  {
    id: 'PROD-QC-010',
    code: 'QC-WIP-KIM',
    name: 'กระดาษเช็ดเลนส์และเครื่องมือวิทยาศาสตร์ไร้ขุย (Kimwipes Delicate Task Wipers)',
    category: 'QC',
    purchaseUnit: 'กล่อง (280 แผ่น)',
    stockUnit: 'แผ่น',
    conversionRate: 280,
    unit: 'แผ่น',
    price: 145,
    stockBalance: 14000,
    reorderPoint: 5600,
    leadTimeDays: 2,
    supplierId: null
  }
];

export const initialVendors = [
  {
    id: 'VEN-001',
    code: 'VND-TH-001',
    name: 'บริษัท สยามอินดัสเตรียล ซัพพลาย แอนด์ เซอร์วิส จำกัด',
    contactPerson: 'คุณธนากร สมบูรณ์',
    phone: '02-345-6789',
    taxId: '0105558012341',
    department: 'PD',
    address: '88/12 นิคมอุตสาหกรรมบางปู ซอย 11 ต.บางปูใหม่ อ.เมือง จ.สมุทรปราการ 10280'
  },
  {
    id: 'VEN-002',
    code: 'VND-TH-002',
    name: 'บริษัท พรีเมียร์ แมชชีน แอนด์ สแปร์พาร์ท จำกัด',
    contactPerson: 'คุณสุภาพร รัตนเวช',
    phone: '02-789-0123',
    taxId: '0105559023452',
    department: 'PD',
    address: '456/78 ถ.เทพารักษ์ ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540'
  },
  {
    id: 'VEN-003',
    code: 'VND-TH-003',
    name: 'บริษัท บางกอกไซแอนติฟิก อินสตรูเมนท์ส จำกัด',
    contactPerson: 'ดร.กิตติพงศ์ วงศ์สวรรค์',
    phone: '02-555-8899',
    taxId: '0105560034563',
    department: 'QC',
    address: '99/5 อาคารไซแอนซ์แล็บ ถ.พหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900'
  },
  {
    id: 'VEN-004',
    code: 'VND-TH-004',
    name: 'บริษัท ไทยแล็บ แอนด์ เคมีคอล ซัพพลาย จำกัด',
    contactPerson: 'คุณนพดล สุขเกษม',
    phone: '02-987-6543',
    taxId: '0105561045674',
    department: 'QC',
    address: '120/14 ถ.รามอินทรา แขวงมีนบุรี เขตมีนบุรี กรุงเทพฯ 10510'
  },
  {
    id: 'VEN-005',
    code: 'VND-TH-005',
    name: 'บริษัท โปรเทคทีฟ เซฟตี้ โซลูชั่นส์ จำกัด',
    contactPerson: 'คุณวรรณา จันทร์เพ็ญ',
    phone: '02-444-1122',
    taxId: '0105562056785',
    department: 'BOTH',
    address: '333/19 ถ.เพชรเกษม แขวงหนองค้างพลู เขตหนองแขม กรุงเทพฯ 10160'
  },
  {
    id: 'VEN-006',
    code: 'VND-TH-006',
    name: 'บริษัท รุ่งเรือง แพคเกจจิ้ง แอนด์ แมททีเรียลส์ จำกัด',
    contactPerson: 'คุณสมศักดิ์ เจริญพร',
    phone: '02-666-3322',
    taxId: '0105563067896',
    department: 'BOTH',
    address: '77/8 หมู่ 3 ถ.เศรษฐกิจ 1 ต.คลองมะเดื่อ อ.กระทุ่มแบน จ.สมุทรสาคร 74110'
  }
];
export const initialPRs = [];

export const initialPOs = [];

export const initialStockLogs = [];

export const initialBudgets = {
  PD: { monthlyBudget: 250000, spent: 0, pending: 0, variance: 0 },
  QC: { monthlyBudget: 150000, spent: 0, pending: 0, variance: 0 }
};

export const initialCounters = {
  PD: { PR: 0, PO: 0 },
  QC: { PR: 0, PO: 0 }
};
