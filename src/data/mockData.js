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
    stockUnit: 'คู่',
    conversionRate: 50,
    unit: 'คู่',
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
export const initialPRs = [
  // ─── Scenario 1: PD Single Item - Large Quantity (Self-buy / Direct Vendor) ───
  {
    id: 'PR-202608-PD001',
    prNo: 'PR001/2026',
    department: 'PD',
    requestedBy: 'คุณวิชัย (PD)',
    requesterId: 'REQUESTER_PD',
    requestedDate: '2026-08-20',
    urgency: 'NORMAL',
    purchaseChannel: 'SELF',
    onlineLink: null,
    purpose: 'สั่งซื้อหน้ากาก N95 สำรองใช้งานในไลน์การผลิต 1,000 ชิ้น (50 กล่อง)',
    status: 'PO_ISSUED',
    totalAmount: 24000,
    grandTotal: 24000,
    items: [
      {
        productId: 'PROD-PD-010',
        code: 'PD-MSK-N95',
        name: 'หน้ากากป้องกันฝุ่นละอองและละอองสารเคมี N95',
        category: 'PD',
        purchaseQty: 50,
        stockQty: 1000,
        qty: 50,
        purchaseUnit: 'กล่อง (20 ชิ้น)',
        stockUnit: 'ชิ้น',
        unit: 'กล่อง (20 ชิ้น)',
        conversionRate: 20,
        price: 480,
        unitPrice: 480,
        estimatedPrice: 480,
        lineTotal: 24000
      }
    ],
    activityLog: [
      {
        action: 'สร้างใบขอซื้อ (Draft PR)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '20/8/2569 09:00:00',
        note: 'สร้างคำขอซื้อหน้ากาก N95'
      },
      {
        action: 'ส่งพิจารณา (Submit)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '20/8/2569 09:15:00',
        note: 'ส่ง PR เข้าสู่ระบบเพื่อพิจารณา'
      },
      {
        action: 'ตรวจสอบแล้ว (Level 1 - Asst Mgr)',
        user: 'คุณสมชาย (Asst. Mgr)',
        role: 'Assistant Manager',
        timestamp: '20/8/2569 10:00:00',
        note: 'ตรวจสอบรายการและงบประมาณแล้ว อนุมัติผ่าน'
      },
      {
        action: 'อนุมัติ (Final Approval - Plant Mgr)',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 10:30:00',
        note: 'อนุมัติการสั่งซื้อ ออก PO อัตโนมัติ'
      }
    ]
  },

  // ─── Scenario 2: PD Multi-Item (2 Items) - High Value & Large Quantity (Self-buy) ───
  {
    id: 'PR-202608-PD002',
    prNo: 'PR002/2026',
    department: 'PD',
    requestedBy: 'คุณวิชัย (PD)',
    requesterId: 'REQUESTER_PD',
    requestedDate: '2026-08-20',
    urgency: 'URGENT',
    purchaseChannel: 'SELF',
    onlineLink: null,
    purpose: 'สั่งซื้อน้ำมันไฮดรอลิกสำหรับซ่อมบำรุงเครื่องจักรรอบใหญ่ และน้ำยาทำความสะอาดคราบน้ำมัน',
    status: 'PO_ISSUED',
    totalAmount: 91000,
    grandTotal: 91000,
    items: [
      {
        productId: 'PROD-PD-001',
        code: 'PD-OIL-068',
        name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
        category: 'PD',
        purchaseQty: 5,
        stockQty: 1000,
        qty: 5,
        purchaseUnit: 'ถัง (200L)',
        stockUnit: 'ลิตร',
        unit: 'ถัง (200L)',
        conversionRate: 200,
        price: 14500,
        unitPrice: 14500,
        estimatedPrice: 14500,
        lineTotal: 72500
      },
      {
        productId: 'PROD-PD-005',
        code: 'PD-CLN-IND',
        name: 'น้ำยาทำความสะอาดคราบน้ำมันเครื่องจักร (Heavy Duty Degreaser Cleaner)',
        category: 'PD',
        purchaseQty: 10,
        stockQty: 200,
        qty: 10,
        purchaseUnit: 'แกลลอน (20L)',
        stockUnit: 'ลิตร',
        unit: 'แกลลอน (20L)',
        conversionRate: 20,
        price: 1850,
        unitPrice: 1850,
        estimatedPrice: 1850,
        lineTotal: 18500
      }
    ],
    activityLog: [
      {
        action: 'สร้างใบขอซื้อ (Draft PR)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '20/8/2569 09:30:00',
        note: 'สร้างคำขอซื้อน้ำมันไฮดรอลิกและน้ำยาทำความสะอาด'
      },
      {
        action: 'ส่งพิจารณา (Submit)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '20/8/2569 09:45:00',
        note: 'ส่ง PR ด่วน'
      },
      {
        action: 'ตรวจสอบแล้ว (Level 1 - Asst Mgr)',
        user: 'คุณสมชาย (Asst. Mgr)',
        role: 'Assistant Manager',
        timestamp: '20/8/2569 10:15:00',
        note: 'ตรวจสอบรายการเร่งด่วน อนุมัติผ่าน'
      },
      {
        action: 'อนุมัติ (Final Approval - Plant Mgr)',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 10:45:00',
        note: 'อนุมัติการจัดซื้อ ออก PO อัตโนมัติ'
      }
    ]
  },

  // ─── Scenario 3: PD Single Item - Online Purchase (Shopee - Ordered & In Delivery) ───
  {
    id: 'PR-202608-PD003',
    prNo: 'PR003/2026',
    department: 'PD',
    requestedBy: 'คุณวิชัย (PD)',
    requesterId: 'REQUESTER_PD',
    requestedDate: '2026-08-20',
    urgency: 'NORMAL',
    purchaseChannel: 'ONLINE',
    onlineLink: 'https://shopee.co.th/product/12345/timing-belt-380-5m',
    purpose: 'สั่งซื้อสายพานไทม์มิ่งอะไหล่สำรองเครื่องแพ็คกิ้ง จาก Shopee',
    status: 'IN_PROGRESS_ONLINE',
    totalAmount: 12400,
    grandTotal: 12400,
    items: [
      {
        productId: 'PROD-PD-003',
        code: 'PD-BLT-380',
        name: 'สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15)',
        category: 'PD',
        purchaseQty: 20,
        stockQty: 20,
        qty: 20,
        purchaseUnit: 'เส้น',
        stockUnit: 'เส้น',
        unit: 'เส้น',
        conversionRate: 1,
        price: 620,
        unitPrice: 620,
        estimatedPrice: 620,
        lineTotal: 12400
      }
    ],
    activityLog: [
      {
        action: 'สร้างใบขอซื้อ (Draft PR)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '20/8/2569 10:00:00',
        note: 'สร้างคำขอซื้อสายพานออนไลน์'
      },
      {
        action: 'ส่งพิจารณา (Submit)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '20/8/2569 10:10:00',
        note: 'ส่ง PR ออนไลน์'
      },
      {
        action: 'ตรวจสอบแล้ว (Level 1 - Asst Mgr)',
        user: 'คุณสมชาย (Asst. Mgr)',
        role: 'Assistant Manager',
        timestamp: '20/8/2569 10:30:00',
        note: 'อนุมัติผ่าน'
      },
      {
        action: 'อนุมัติ (Final Approval - Plant Mgr)',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 11:00:00',
        note: 'อนุมัติการสั่งซื้อออนไลน์ ส่งต่อให้คุณนัท'
      }
    ]
  },

  // ─── Scenario 4: QC Multi-Item (3 Items) - Online Purchase (Lazada - Ordered & In Delivery) ───
  {
    id: 'PR-202608-QC001',
    prNo: 'PR004/2026',
    department: 'QC',
    requestedBy: 'คุณสมหญิง (QC)',
    requesterId: 'REQUESTER_QC',
    requestedDate: '2026-08-20',
    urgency: 'NORMAL',
    purchaseChannel: 'ONLINE',
    onlineLink: 'https://lazada.co.th/sciencelab-official-store',
    purpose: 'สั่งซื้ออุปกรณ์และวัสดุสิ้นเปลืองสำหรับห้องแล็บ QC จาก Lazada',
    status: 'IN_PROGRESS_ONLINE',
    totalAmount: 20425,
    grandTotal: 20425,
    items: [
      {
        productId: 'PROD-QC-003',
        code: 'QC-PPT-100',
        name: 'ทิปปิเปตไมโครสีขาว (Micropipette Tips 100-1000 uL, DNase/RNase Free)',
        category: 'QC',
        purchaseQty: 10,
        stockQty: 10000,
        qty: 10,
        purchaseUnit: 'กล่อง (1000 ชิ้น)',
        stockUnit: 'ชิ้น',
        unit: 'กล่อง (1000 ชิ้น)',
        conversionRate: 1000,
        price: 1200,
        unitPrice: 1200,
        estimatedPrice: 1200,
        lineTotal: 12000
      },
      {
        productId: 'PROD-QC-010',
        code: 'QC-WIP-KIM',
        name: 'กระดาษเช็ดเลนส์และเครื่องมือวิทยาศาสตร์ไร้ขุย (Kimwipes Delicate Task Wipers)',
        category: 'QC',
        purchaseQty: 25,
        stockQty: 7000,
        qty: 25,
        purchaseUnit: 'กล่อง (280 แผ่น)',
        stockUnit: 'แผ่น',
        unit: 'กล่อง (280 แผ่น)',
        conversionRate: 280,
        price: 145,
        unitPrice: 145,
        estimatedPrice: 145,
        lineTotal: 3625
      },
      {
        productId: 'PROD-QC-008',
        code: 'QC-BEA-250',
        name: 'บีกเกอร์แก้วโบโรซิลิเกตทนความร้อน (Glass Beaker Borosilicate 250ml)',
        category: 'QC',
        purchaseQty: 30,
        stockQty: 30,
        qty: 30,
        purchaseUnit: 'ชิ้น',
        stockUnit: 'ชิ้น',
        unit: 'ชิ้น',
        conversionRate: 1,
        price: 160,
        unitPrice: 160,
        estimatedPrice: 160,
        lineTotal: 4800
      }
    ],
    activityLog: [
      {
        action: 'สร้างใบขอซื้อ (Draft PR)',
        user: 'คุณสมหญิง (QC)',
        role: 'Requester (QC)',
        timestamp: '20/8/2569 10:15:00',
        note: 'สร้างคำขอซื้ออุปกรณ์แล็บ QC 3 รายการ'
      },
      {
        action: 'ส่งพิจารณา (Submit)',
        user: 'คุณสมหญิง (QC)',
        role: 'Requester (QC)',
        timestamp: '20/8/2569 10:25:00',
        note: 'ส่ง PR เข้าสู่ระบบ'
      },
      {
        action: 'ตรวจสอบแล้ว (Level 1 - Asst Mgr)',
        user: 'คุณสมชาย (Asst. Mgr)',
        role: 'Assistant Manager',
        timestamp: '20/8/2569 11:00:00',
        note: 'ตรวจสอบรายการแล็บแล้ว อนุมัติผ่าน'
      },
      {
        action: 'อนุมัติ (Final Approval - Plant Mgr)',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 11:30:00',
        note: 'อนุมัติ PR ส่งให้ฝ่ายจัดซื้อออนไลน์'
      }
    ]
  },

  // ─── Scenario 5: QC Single Item - Chemical/Culture Media (Self-buy) ───
  {
    id: 'PR-202608-QC002',
    prNo: 'PR005/2026',
    department: 'QC',
    requestedBy: 'คุณสมหญิง (QC)',
    requesterId: 'REQUESTER_QC',
    requestedDate: '2026-08-20',
    urgency: 'NORMAL',
    purchaseChannel: 'SELF',
    onlineLink: null,
    purpose: 'สั่งซื้ออาหารเลี้ยงเชื้อ PCA สำหรับการทดสอบ Microbe ในแล็บควบคุมคุณภาพ',
    status: 'PO_ISSUED',
    totalAmount: 22800,
    grandTotal: 22800,
    items: [
      {
        productId: 'PROD-QC-005',
        code: 'QC-AGR-PCA',
        name: 'อาหารเลี้ยงเชื้อ Plate Count Agar (PCA) สำหรับทดสอบจุลชีววิทยา (500g)',
        category: 'QC',
        purchaseQty: 8,
        stockQty: 4000,
        qty: 8,
        purchaseUnit: 'ขวด (500g)',
        stockUnit: 'กรัม',
        unit: 'ขวด (500g)',
        conversionRate: 500,
        price: 2850,
        unitPrice: 2850,
        estimatedPrice: 2850,
        lineTotal: 22800
      }
    ],
    activityLog: [
      {
        action: 'สร้างใบขอซื้อ (Draft PR)',
        user: 'คุณสมหญิง (QC)',
        role: 'Requester (QC)',
        timestamp: '20/8/2569 11:00:00',
        note: 'สร้างคำขอซื้ออาหารเลี้ยงเชื้อ'
      },
      {
        action: 'ส่งพิจารณา (Submit)',
        user: 'คุณสมหญิง (QC)',
        role: 'Requester (QC)',
        timestamp: '20/8/2569 11:15:00',
        note: 'ส่ง PR เพื่อตรวจสอบ'
      },
      {
        action: 'ตรวจสอบแล้ว (Level 1 - Asst Mgr)',
        user: 'คุณสมชาย (Asst. Mgr)',
        role: 'Assistant Manager',
        timestamp: '20/8/2569 11:45:00',
        note: 'อนุมัติผ่าน'
      },
      {
        action: 'อนุมัติ (Final Approval - Plant Mgr)',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 13:00:00',
        note: 'อนุมัติการสั่งซื้อ ออก PO'
      }
    ]
  },

  // ─── Scenario 6: PD Partial Received PO - Packaging Stretch Film (Self-buy) ───
  {
    id: 'PR-202608-PD004',
    prNo: 'PR006/2026',
    department: 'PD',
    requestedBy: 'คุณวิชัย (PD)',
    requesterId: 'REQUESTER_PD',
    requestedDate: '2026-08-19',
    urgency: 'NORMAL',
    purchaseChannel: 'SELF',
    onlineLink: null,
    purpose: 'สั่งซื้อฟิล์มยืดพันพาเลทสำหรับฝ่ายบรรจุภัณฑ์ 20 ลัง (120 ม้วน)',
    status: 'PO_ISSUED',
    totalAmount: 22000,
    grandTotal: 22000,
    items: [
      {
        productId: 'PROD-PD-008',
        code: 'PD-STF-001',
        name: 'ฟิล์มยืดพันพาเลท (Stretch Film 15 Micron 500mm x 300m)',
        category: 'PD',
        purchaseQty: 20,
        stockQty: 120,
        qty: 20,
        purchaseUnit: 'ลัง (6 ม้วน)',
        stockUnit: 'ม้วน',
        unit: 'ลัง (6 ม้วน)',
        conversionRate: 6,
        price: 1100,
        unitPrice: 1100,
        estimatedPrice: 1100,
        lineTotal: 22000
      }
    ],
    activityLog: [
      {
        action: 'สร้างใบขอซื้อ (Draft PR)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '19/8/2569 14:00:00',
        note: 'สร้างคำขอซื้อฟิล์มยืด'
      },
      {
        action: 'ส่งพิจารณา (Submit)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '19/8/2569 14:15:00',
        note: 'ส่ง PR'
      },
      {
        action: 'ตรวจสอบแล้ว (Level 1 - Asst Mgr)',
        user: 'คุณสมชาย (Asst. Mgr)',
        role: 'Assistant Manager',
        timestamp: '19/8/2569 15:00:00',
        note: 'อนุมัติผ่าน'
      },
      {
        action: 'อนุมัติ (Final Approval - Plant Mgr)',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '19/8/2569 15:30:00',
        note: 'อนุมัติการสั่งซื้อ ออก PO อัตโนมัติ'
      }
    ]
  }
];

export const initialPOs = [
  // ─── PO 1: PD Single Item - Ready to Receive Goods (50 Boxes N95) ───
  {
    id: 'PO-202608-PD001',
    poNo: 'PD001/2026',
    prId: 'PR-202608-PD001',
    prNo: 'PR001/2026',
    requestedBy: 'คุณวิชัย (PD)',
    requesterId: 'REQUESTER_PD',
    department: 'PD',
    vendorId: 'VEN-005',
    vendorName: 'บริษัท โปรเทคทีฟ เซฟตี้ โซลูชั่นส์ จำกัด',
    purchaseChannel: 'SELF',
    onlineLink: null,
    issueDate: '2026-08-20',
    status: 'ISSUED',
    subtotal: 24000,
    vat: 0,
    grandTotal: 24000,
    totalAmount: 24000,
    items: [
      {
        productId: 'PROD-PD-010',
        code: 'PD-MSK-N95',
        name: 'หน้ากากป้องกันฝุ่นละอองและละอองสารเคมี N95',
        category: 'PD',
        purchaseQty: 50,
        stockQty: 1000,
        qty: 50,
        purchaseUnit: 'กล่อง (20 ชิ้น)',
        stockUnit: 'ชิ้น',
        unit: 'กล่อง (20 ชิ้น)',
        conversionRate: 20,
        price: 480,
        unitPrice: 480,
        estimatedPrice: 480,
        orderedQty: 50,
        receivedQty: 0,
        receivedStockQty: 0,
        receivedNgQty: 0,
        remainingQty: 50,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 24000
      }
    ],
    activityLog: [
      {
        action: 'แปลง PR เป็น PO และออกใบสั่งซื้ออัตโนมัติ',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 10:30:00',
        note: 'อนุมัติสร้างเอกสาร PO เลขที่ PD001/2026'
      }
    ]
  },

  // ─── PO 2: PD Multi-Item (2 Items) - Ready to Receive Goods (Hydraulic Oil + Cleaner) ───
  {
    id: 'PO-202608-PD002',
    poNo: 'PD002/2026',
    prId: 'PR-202608-PD002',
    prNo: 'PR002/2026',
    requestedBy: 'คุณวิชัย (PD)',
    requesterId: 'REQUESTER_PD',
    department: 'PD',
    vendorId: 'VEN-001',
    vendorName: 'บริษัท สยามอินดัสเตรียล ซัพพลาย แอนด์ เซอร์วิส จำกัด',
    purchaseChannel: 'SELF',
    onlineLink: null,
    issueDate: '2026-08-20',
    status: 'ISSUED',
    subtotal: 91000,
    vat: 0,
    grandTotal: 91000,
    totalAmount: 91000,
    items: [
      {
        productId: 'PROD-PD-001',
        code: 'PD-OIL-068',
        name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
        category: 'PD',
        purchaseQty: 5,
        stockQty: 1000,
        qty: 5,
        purchaseUnit: 'ถัง (200L)',
        stockUnit: 'ลิตร',
        unit: 'ถัง (200L)',
        conversionRate: 200,
        price: 14500,
        unitPrice: 14500,
        estimatedPrice: 14500,
        orderedQty: 5,
        receivedQty: 0,
        receivedStockQty: 0,
        receivedNgQty: 0,
        remainingQty: 5,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 72500
      },
      {
        productId: 'PROD-PD-005',
        code: 'PD-CLN-IND',
        name: 'น้ำยาทำความสะอาดคราบน้ำมันเครื่องจักร (Heavy Duty Degreaser Cleaner)',
        category: 'PD',
        purchaseQty: 10,
        stockQty: 200,
        qty: 10,
        purchaseUnit: 'แกลลอน (20L)',
        stockUnit: 'ลิตร',
        unit: 'แกลลอน (20L)',
        conversionRate: 20,
        price: 1850,
        unitPrice: 1850,
        estimatedPrice: 1850,
        orderedQty: 10,
        receivedQty: 0,
        receivedStockQty: 0,
        receivedNgQty: 0,
        remainingQty: 10,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 18500
      }
    ],
    activityLog: [
      {
        action: 'แปลง PR เป็น PO และออกใบสั่งซื้ออัตโนมัติ',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 10:45:00',
        note: 'อนุมัติสร้างเอกสาร PO เลขที่ PD002/2026'
      }
    ]
  },

  // ─── PO 3: PD Single Item - Online Purchased (Shopee - Ready for Warehouse Receiving) ───
  {
    id: 'PO-202608-PD003',
    poNo: 'PD003/2026',
    prId: 'PR-202608-PD003',
    prNo: 'PR003/2026',
    requestedBy: 'คุณวิชัย (PD)',
    requesterId: 'REQUESTER_PD',
    department: 'PD',
    vendorId: 'ONLINE',
    vendorName: 'ร้าน ThaiIndustrial Machinery (Shopee Mall)',
    purchaseChannel: 'ONLINE',
    onlineLink: 'https://shopee.co.th/product/12345/timing-belt-380-5m',
    issueDate: '2026-08-20',
    status: 'ORDERED_PENDING_DELIVERY',
    subtotal: 12400,
    vat: 0,
    grandTotal: 12400,
    totalAmount: 12400,
    items: [
      {
        productId: 'PROD-PD-003',
        code: 'PD-BLT-380',
        name: 'สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15)',
        category: 'PD',
        purchaseQty: 20,
        stockQty: 20,
        qty: 20,
        purchaseUnit: 'เส้น',
        stockUnit: 'เส้น',
        unit: 'เส้น',
        conversionRate: 1,
        price: 620,
        unitPrice: 620,
        estimatedPrice: 620,
        orderedQty: 20,
        receivedQty: 0,
        receivedStockQty: 0,
        receivedNgQty: 0,
        remainingQty: 20,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 12400
      }
    ],
    activityLog: [
      {
        action: 'แปลง PR เป็น PO และออกใบสั่งซื้ออัตโนมัติ',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 11:00:00',
        note: 'อนุมัติสร้างเอกสาร PO ออนไลน์ เลขที่ PD003/2026'
      },
      {
        action: 'รับทราบและสั่งซื้อออนไลน์แล้ว (Online Order Placed)',
        user: 'คุณนัท (Online Purchaser)',
        role: 'Online Purchaser (จัดซื้อออนไลน์)',
        timestamp: '20/8/2569 11:45:00',
        note: 'สั่งซื้อจาก: ร้าน ThaiIndustrial Machinery (Shopee Mall) — ส่งต่อให้แผนกต้นทางตรวจรับและปิด PO'
      }
    ]
  },

  // ─── PO 4: QC Multi-Item (3 Items) - Online Purchased (Lazada - Ready for Warehouse Receiving) ───
  {
    id: 'PO-202608-QC001',
    poNo: 'QC001/2026',
    prId: 'PR-202608-QC001',
    prNo: 'PR004/2026',
    requestedBy: 'คุณสมหญิง (QC)',
    requesterId: 'REQUESTER_QC',
    department: 'QC',
    vendorId: 'ONLINE',
    vendorName: 'ScienceLab Thailand Official Store (Lazada)',
    purchaseChannel: 'ONLINE',
    onlineLink: 'https://lazada.co.th/sciencelab-official-store',
    issueDate: '2026-08-20',
    status: 'ORDERED_PENDING_DELIVERY',
    subtotal: 20425,
    vat: 0,
    grandTotal: 20425,
    totalAmount: 20425,
    items: [
      {
        productId: 'PROD-QC-003',
        code: 'QC-PPT-100',
        name: 'ทิปปิเปตไมโครสีขาว (Micropipette Tips 100-1000 uL, DNase/RNase Free)',
        category: 'QC',
        purchaseQty: 10,
        stockQty: 10000,
        qty: 10,
        purchaseUnit: 'กล่อง (1000 ชิ้น)',
        stockUnit: 'ชิ้น',
        unit: 'กล่อง (1000 ชิ้น)',
        conversionRate: 1000,
        price: 1200,
        unitPrice: 1200,
        estimatedPrice: 1200,
        orderedQty: 10,
        receivedQty: 0,
        receivedStockQty: 0,
        receivedNgQty: 0,
        remainingQty: 10,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 12000
      },
      {
        productId: 'PROD-QC-010',
        code: 'QC-WIP-KIM',
        name: 'กระดาษเช็ดเลนส์และเครื่องมือวิทยาศาสตร์ไร้ขุย (Kimwipes Delicate Task Wipers)',
        category: 'QC',
        purchaseQty: 25,
        stockQty: 7000,
        qty: 25,
        purchaseUnit: 'กล่อง (280 แผ่น)',
        stockUnit: 'แผ่น',
        unit: 'กล่อง (280 แผ่น)',
        conversionRate: 280,
        price: 145,
        unitPrice: 145,
        estimatedPrice: 145,
        orderedQty: 25,
        receivedQty: 0,
        receivedStockQty: 0,
        receivedNgQty: 0,
        remainingQty: 25,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 3625
      },
      {
        productId: 'PROD-QC-008',
        code: 'QC-BEA-250',
        name: 'บีกเกอร์แก้วโบโรซิลิเกตทนความร้อน (Glass Beaker Borosilicate 250ml)',
        category: 'QC',
        purchaseQty: 30,
        stockQty: 30,
        qty: 30,
        purchaseUnit: 'ชิ้น',
        stockUnit: 'ชิ้น',
        unit: 'ชิ้น',
        conversionRate: 1,
        price: 160,
        unitPrice: 160,
        estimatedPrice: 160,
        orderedQty: 30,
        receivedQty: 0,
        receivedStockQty: 0,
        receivedNgQty: 0,
        remainingQty: 30,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 4800
      }
    ],
    activityLog: [
      {
        action: 'แปลง PR เป็น PO และออกใบสั่งซื้ออัตโนมัติ',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 11:30:00',
        note: 'อนุมัติสร้างเอกสาร PO ออนไลน์ เลขที่ QC001/2026'
      },
      {
        action: 'รับทราบและสั่งซื้อออนไลน์แล้ว (Online Order Placed)',
        user: 'คุณนัท (Online Purchaser)',
        role: 'Online Purchaser (จัดซื้อออนไลน์)',
        timestamp: '20/8/2569 12:15:00',
        note: 'สั่งซื้อจาก: ScienceLab Thailand Official Store (Lazada) — ส่งต่อให้แผนก QC ตรวจรับสินค้า'
      }
    ]
  },

  // ─── PO 5: QC Single Item - Ready to Receive Goods (PCA Agar 8 Bottles) ───
  {
    id: 'PO-202608-QC002',
    poNo: 'QC002/2026',
    prId: 'PR-202608-QC002',
    prNo: 'PR005/2026',
    requestedBy: 'คุณสมหญิง (QC)',
    requesterId: 'REQUESTER_QC',
    department: 'QC',
    vendorId: 'VEN-004',
    vendorName: 'บริษัท ไทยแล็บ แอนด์ เคมีคอล ซัพพลาย จำกัด',
    purchaseChannel: 'SELF',
    onlineLink: null,
    issueDate: '2026-08-20',
    status: 'ISSUED',
    subtotal: 22800,
    vat: 0,
    grandTotal: 22800,
    totalAmount: 22800,
    items: [
      {
        productId: 'PROD-QC-005',
        code: 'QC-AGR-PCA',
        name: 'อาหารเลี้ยงเชื้อ Plate Count Agar (PCA) สำหรับทดสอบจุลชีววิทยา (500g)',
        category: 'QC',
        purchaseQty: 8,
        stockQty: 4000,
        qty: 8,
        purchaseUnit: 'ขวด (500g)',
        stockUnit: 'กรัม',
        unit: 'ขวด (500g)',
        conversionRate: 500,
        price: 2850,
        unitPrice: 2850,
        estimatedPrice: 2850,
        orderedQty: 8,
        receivedQty: 0,
        receivedStockQty: 0,
        receivedNgQty: 0,
        remainingQty: 8,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 22800
      }
    ],
    activityLog: [
      {
        action: 'แปลง PR เป็น PO และออกใบสั่งซื้ออัตโนมัติ',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '20/8/2569 13:00:00',
        note: 'อนุมัติสร้างเอกสาร PO เลขที่ QC002/2026'
      }
    ]
  },

  // ─── PO 6: PD Partial Received - Packaging Stretch Film (20 Boxes ordered, 12 received, 8 remaining) ───
  {
    id: 'PO-202608-PD004',
    poNo: 'PD004/2026',
    prId: 'PR-202608-PD004',
    prNo: 'PR006/2026',
    requestedBy: 'คุณวิชัย (PD)',
    requesterId: 'REQUESTER_PD',
    department: 'PD',
    vendorId: 'VEN-006',
    vendorName: 'บริษัท รุ่งเรือง แพคเกจจิ้ง แอนด์ แมททีเรียลส์ จำกัด',
    purchaseChannel: 'SELF',
    onlineLink: null,
    issueDate: '2026-08-19',
    status: 'PARTIAL',
    subtotal: 22000,
    vat: 0,
    grandTotal: 22000,
    totalAmount: 22000,
    items: [
      {
        productId: 'PROD-PD-008',
        code: 'PD-STF-001',
        name: 'ฟิล์มยืดพันพาเลท (Stretch Film 15 Micron 500mm x 300m)',
        category: 'PD',
        purchaseQty: 20,
        stockQty: 120,
        qty: 20,
        purchaseUnit: 'ลัง (6 ม้วน)',
        stockUnit: 'ม้วน',
        unit: 'ลัง (6 ม้วน)',
        conversionRate: 6,
        price: 1100,
        unitPrice: 1100,
        estimatedPrice: 1100,
        orderedQty: 20,
        receivedQty: 12,
        receivedStockQty: 72,
        receivedNgQty: 0,
        remainingQty: 8,
        actUnitPrice: null,
        source: 'FACTORY',
        lineTotal: 22000
      }
    ],
    activityLog: [
      {
        action: 'แปลง PR เป็น PO และออกใบสั่งซื้ออัตโนมัติ',
        user: 'คุณประเสริฐ (Plant Mgr)',
        role: 'Plant Manager',
        timestamp: '19/8/2569 15:30:00',
        note: 'อนุมัติสร้างเอกสาร PO เลขที่ PD004/2026'
      },
      {
        action: 'ตรวจรับสินค้าบางส่วน (Partial Receive)',
        user: 'คุณวิชัย (PD)',
        role: 'Requester (PD)',
        timestamp: '20/8/2569 09:30:00',
        note: 'รับสินค้าเข้าคลังรอบแรก 12 ลัง (72 ม้วน) คงเหลือค้างส่งอีก 8 ลัง (48 ม้วน)'
      }
    ]
  }
];

export const initialStockLogs = [
  {
    id: 'LOG-INIT-001',
    productId: 'PROD-PD-008',
    productCode: 'PD-STF-001',
    productName: 'ฟิล์มยืดพันพาเลท (Stretch Film 15 Micron 500mm x 300m)',
    date: '2026-08-20',
    timestamp: '20/8/2569 09:30:00',
    type: 'IN',
    qty: 72,
    balance: 60,
    unit: 'ม้วน',
    refType: 'PO',
    refDoc: 'PD004/2026',
    operator: 'คุณวิชัย (PD)',
    note: 'ตรวจรับสินค้าเข้าคลังบางส่วน (12 ลัง x 6 ม้วน)'
  }
];

export const initialBudgets = {
  PD: { monthlyBudget: 250000, spent: 13200, pending: 127400, variance: 0 },
  QC: { monthlyBudget: 150000, spent: 0, pending: 43225, variance: 0 }
};

export const initialCounters = {
  PD: { PR: 4, PO: 4 },
  QC: { PR: 2, PO: 2 }
};



