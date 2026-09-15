/**
 * @file MigrationService.gs
 * @description Data Seeding and Legacy Data Migration Service
 * Migrates local JSON data (Master Data & POS.json 258KB) into Google Sheets
 * ensuring seamless transition without loss of document numbering or history.
 * @version 2.0.0
 */

/**
 * Baseline Seed Master Data for Initial System Setup
 */
const SEED_DATA = {
  DEPARTMENTS: [
    { id: 'DEPT-PD', code: 'PD', name: 'ฝ่ายผลิต', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'DEPT-QC', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'DEPT-WH', code: 'WH', name: 'ฝ่ายคลังสินค้า', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }
  ],

  STORAGE_LOCATIONS: [
    { id: 'LOC-PD-001', name: 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)', department: 'PD', isActive: true },
    { id: 'LOC-PD-002', name: 'ชั้นวาง A-02 (อะไหล่เครื่องจักร & สายพาน)', department: 'PD', isActive: true },
    { id: 'LOC-PD-003', name: 'ตู้เก็บอุปกรณ์ความปลอดภัย (PPE)', department: 'PD', isActive: true },
    { id: 'LOC-PD-004', name: 'ห้องแพ็คเกจจิ้ง', department: 'PD', isActive: true },
    { id: 'LOC-QC-001', name: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)', department: 'QC', isActive: true },
    { id: 'LOC-QC-002', name: 'ชั้นวางอาหารเลี้ยงเชื้อ (Media Shelf B)', department: 'QC', isActive: true },
    { id: 'LOC-QC-003', name: 'ตู้เก็บตัวอย่างควบคุม (Retain Sample Room)', department: 'QC', isActive: true },
    { id: 'LOC-QC-004', name: 'ห้องปฏิบัติการกลาง (Central Lab)', department: 'QC', isActive: true }
  ],

  USAGE_UNITS: [
    { id: 'UNIT-PD-001', name: 'ห้อง K1', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-002', name: 'ห้อง K2', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-003', name: 'ห้องผลไม้', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-004', name: 'ห้องสลัด', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-005', name: 'ห้องล้าง/เตรียมผัก', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-006', name: 'ห้องเตรียมวัตถุดิบ 1', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-007', name: 'ห้องพาสเจอร์ไรซ์ (Hot Process)', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-PD-008', name: 'ห้องบรรจุขวด/แพ็คเกจจิ้ง (Aseptic Filling)', department: 'PD', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-QC-001', name: 'ห้อง Lab 1 (เคมี)', department: 'QC', status: 'ACTIVE', isActive: true },
    { id: 'UNIT-QC-002', name: 'ห้อง Lab 2 (จุลชีววิทยา)', department: 'QC', status: 'ACTIVE', isActive: true }
  ],

  USERS: [
    {
      id: 'USR-0001',
      employeeId: 'EMP-PD-001',
      username: 'siraphat.pd',
      email: '',
      name: 'สิรภัทร แจ่มมิน',
      employeeName: 'สิรภัทร แจ่มมิน',
      displayName: 'สิรภัทร แจ่มมิน',
      position: 'เจ้าหน้าที่ฝ่ายผลิต',
      department: 'PD',
      primaryDepartment: 'PD',
      departments: ['PD'],
      allowedDepartments: ['PD'],
      roleId: 'REQUESTER_PD',
      canonicalRole: 'REQUESTER',
      level: 1,
      status: 'ACTIVE',
      isActive: true,
      description: 'สร้าง/ส่ง PR ฝ่ายผลิต, เบิกจ่ายสินค้า, ตรวจรับของเข้าสต็อก'
    },
    {
      id: 'USR-0002',
      employeeId: 'EMP-QC-001',
      username: 'natthinee.qc',
      email: '',
      name: 'ณัฐธินีย์ สอนครบบุรี',
      employeeName: 'ณัฐธินีย์ สอนครบบุรี',
      displayName: 'ณัฐธินีย์ สอนครบบุรี',
      position: 'เจ้าหน้าที่ฝ่ายควบคุมคุณภาพ (QC)',
      department: 'QC',
      primaryDepartment: 'QC',
      departments: ['QC'],
      allowedDepartments: ['QC'],
      roleId: 'REQUESTER_QC',
      canonicalRole: 'REQUESTER',
      level: 1,
      status: 'ACTIVE',
      isActive: true,
      description: 'สร้าง/ส่ง PR ฝ่าย QC/Lab, เบิกจ่ายสารเคมี, ตรวจรับของ'
    },
    {
      id: 'USR-0003',
      employeeId: 'EMP-MGR-001',
      username: 'kallayani.mgr',
      email: '',
      name: 'กัลยาณี พลไกร',
      employeeName: 'กัลยาณี พลไกร',
      displayName: 'กัลยาณี พลไกร',
      position: 'ผู้ช่วยผู้จัดการฝ่ายผลิต (Asst. Manager)',
      department: 'PD',
      primaryDepartment: 'PD',
      departments: ['PD', 'QC'],
      allowedDepartments: ['PD', 'QC'],
      roleId: 'ASST_MANAGER',
      canonicalRole: 'REVIEWER',
      level: 2,
      status: 'ACTIVE',
      isActive: true,
      description: 'ตรวจทาน PR (Level 1 Reviewer)'
    },
    {
      id: 'USR-0004',
      employeeId: 'EMP-PUR-001',
      username: 'nat.on',
      email: '',
      name: 'คุณนัท จัดซื้อ',
      employeeName: 'คุณนัท จัดซื้อ',
      displayName: 'คุณนัท จัดซื้อ',
      position: 'เจ้าหน้าที่จัดซื้อออนไลน์',
      department: 'PUR',
      primaryDepartment: 'PUR',
      departments: ['PD', 'QC', 'WH', 'PUR', 'ENG'],
      allowedDepartments: ['*'],
      roleId: 'ONLINE_PURCHASER',
      canonicalRole: 'PURCHASER',
      level: 2,
      status: 'ACTIVE',
      isActive: true,
      description: 'จัดการสั่งซื้อออนไลน์ Shopee/Lazada'
    },
    {
      id: 'USR-0005',
      employeeId: 'EMP-MGR-002',
      username: 'prasert.pm',
      email: '',
      name: 'คุณประเสริฐ ยิ่งยง',
      employeeName: 'คุณประเสริฐ ยิ่งยง',
      displayName: 'คุณประเสริฐ ยิ่งยง',
      position: 'ผู้จัดการโรงงาน (Plant Manager)',
      department: 'MGT',
      primaryDepartment: 'MGT',
      departments: ['PD', 'QC', 'WH', 'PUR', 'ENG'],
      allowedDepartments: ['*'],
      roleId: 'PLANT_MANAGER',
      canonicalRole: 'APPROVER',
      level: 3,
      status: 'ACTIVE',
      isActive: true,
      description: 'อนุมัติสั่งซื้อ (Final Approver)'
    },
    {
      id: 'USR-0006',
      employeeId: 'EMP-SYS-999',
      username: 'admin',
      email: '',
      name: 'ผู้ดูแลระบบ',
      employeeName: 'ผู้ดูแลระบบ',
      displayName: 'ผู้ดูแลระบบ',
      position: 'ผู้ดูแลระบบ (Admin)',
      department: 'MGT',
      primaryDepartment: 'MGT',
      departments: ['*'],
      allowedDepartments: ['*'],
      roleId: 'ADMIN',
      canonicalRole: 'ADMIN',
      level: 99,
      status: 'ACTIVE',
      isActive: true,
      description: 'ผู้ดูแลระบบ สิทธิ์สูงสุด'
    }
  ],

  BUDGETS: [
    {
      dept: 'PD',
      monthlyBudget: 1000000,
      spent: 0,
      pending: 0,
      variance: 1000000,
      year: 2026,
      month: 9,
      historicalSpent: { '2026-09': 0 },
      history: { '2026-09': 1000000 },
      refundCredits: { '2026-09': 817 },
      updatedAt: new Date().toISOString()
    },
    {
      dept: 'QC',
      monthlyBudget: 150050,
      spent: 0,
      pending: 0,
      variance: 150000,
      year: 2026,
      month: 9,
      historicalSpent: { '2026-09': 0 },
      history: { '2026-09': 150000 },
      refundCredits: {},
      updatedAt: new Date().toISOString()
    },
    {
      dept: 'WH',
      monthlyBudget: 120000,
      spent: 0,
      pending: 0,
      variance: 120000,
      year: 2026,
      month: 9,
      historicalSpent: { '2026-09': 0 },
      history: { '2026-09': 120000 },
      refundCredits: {},
      updatedAt: new Date().toISOString()
    }
  ],

  PR_COUNTERS: [
    { dept: 'PD', docType: 'PR', lastNumber: 2, prefix: 'PD', year: 2026, updatedAt: new Date().toISOString() },
    { dept: 'PD', docType: 'PO', lastNumber: 2, prefix: 'PO', year: 2026, updatedAt: new Date().toISOString() },
    { dept: 'QC', docType: 'PR', lastNumber: 0, prefix: 'QC', year: 2026, updatedAt: new Date().toISOString() },
    { dept: 'QC', docType: 'PO', lastNumber: 0, prefix: 'PO', year: 2026, updatedAt: new Date().toISOString() }
  ],

  PRODUCTS: [
    // ─── PRODUCTION (PD) ITEMS (10 Items) ───
    {
      id: 'PROD-PD-001',
      code: 'PD-OIL-068',
      name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'ถัง (200L)',
      stockUnit: 'ลิตร',
      conversionRate: 200,
      price: 14500,
      stockBalance: 2400,
      reorderPoint: 1000,
      leadTimeDays: 5,
      locationId: 'LOC-PD-001',
      locationName: 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-002',
      code: 'PD-GRS-002',
      name: 'จาระบีทนความร้อนสูงเกรดอาหาร (High-Temp Food Grade Grease NLGI 2)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'กล่อง (12 กระป๋อง)',
      stockUnit: 'กระป๋อง',
      conversionRate: 12,
      price: 9600,
      stockBalance: 25,
      reorderPoint: 10,
      leadTimeDays: 3,
      locationId: 'LOC-PD-001',
      locationName: 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-003',
      code: 'PD-BLT-380',
      name: 'สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'เส้น',
      stockUnit: 'เส้น',
      conversionRate: 1,
      price: 620,
      stockBalance: 6,
      reorderPoint: 8,
      leadTimeDays: 7,
      locationId: 'LOC-PD-002',
      locationName: 'ชั้นวาง A-02 (อะไหล่เครื่องจักร & สายพาน)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-004',
      code: 'PD-GLV-NBR',
      name: 'ถุงมือไนไตรล์ป้องกันสารเคมี (Nitrile Chemical Resistant Gloves Size L)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'กล่อง (100 ชิ้น)',
      stockUnit: 'ชิ้น',
      conversionRate: 100,
      price: 320,
      stockBalance: 2000,
      reorderPoint: 750,
      leadTimeDays: 3,
      locationId: 'LOC-PD-003',
      locationName: 'ตู้เก็บอุปกรณ์ความปลอดภัย (PPE)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-005',
      code: 'PD-CLN-IND',
      name: 'น้ำยาทำความสะอาดคราบน้ำมันเครื่องจักร (Heavy Duty Degreaser Cleaner)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'แกลลอน (20L)',
      stockUnit: 'ลิตร',
      conversionRate: 20,
      price: 1850,
      stockBalance: 360,
      reorderPoint: 120,
      leadTimeDays: 4,
      locationId: 'LOC-PD-001',
      locationName: 'ชั้นวาง A-01 (สารหล่อลื่น & น้ำมัน)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-006',
      code: 'PD-FLT-050',
      name: 'ไส้กรองน้ำมันระบบหล่อเย็น (Coolant Cartridge Filter 50 Micron)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'กล่อง (10 ชิ้น)',
      stockUnit: 'ชิ้น',
      conversionRate: 10,
      price: 4200,
      stockBalance: 30,
      reorderPoint: 12,
      leadTimeDays: 5,
      locationId: 'LOC-PD-002',
      locationName: 'ชั้นวาง A-02 (อะไหล่เครื่องจักร & สายพาน)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-007',
      code: 'PD-STP-015',
      name: 'สายรัดพาเลทพลาสติก PP Band (15mm x 3000m)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'ม้วน',
      stockUnit: 'ม้วน',
      conversionRate: 1,
      price: 980,
      stockBalance: 20,
      reorderPoint: 8,
      leadTimeDays: 3,
      locationId: 'LOC-PD-004',
      locationName: 'ห้องแพ็คเกจจิ้ง',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-008',
      code: 'PD-STF-001',
      name: 'ฟิล์มยืดพันพาเลท (Stretch Film 15 Micron 500mm x 300m)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'ลัง (6 ม้วน)',
      stockUnit: 'ม้วน',
      conversionRate: 6,
      price: 1100,
      stockBalance: 60,
      reorderPoint: 25,
      leadTimeDays: 2,
      locationId: 'LOC-PD-004',
      locationName: 'ห้องแพ็คเกจจิ้ง',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-009',
      code: 'PD-BRG-620',
      name: 'ตลับลูกปืนเม็ดกลมร่องลึก (Deep Groove Ball Bearing 6205-2RS)',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'ตลับ',
      stockUnit: 'ตลับ',
      conversionRate: 1,
      price: 280,
      stockBalance: 22,
      reorderPoint: 10,
      leadTimeDays: 5,
      locationId: 'LOC-PD-002',
      locationName: 'ชั้นวาง A-02 (อะไหล่เครื่องจักร & สายพาน)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-PD-010',
      code: 'PD-MSK-N95',
      name: 'หน้ากากป้องกันฝุ่นละอองและละอองสารเคมี N95',
      category: 'PD',
      department: 'PD',
      purchaseUnit: 'กล่อง (20 ชิ้น)',
      stockUnit: 'ชิ้น',
      conversionRate: 20,
      price: 480,
      stockBalance: 700,
      reorderPoint: 300,
      leadTimeDays: 3,
      locationId: 'LOC-PD-003',
      locationName: 'ตู้เก็บอุปกรณ์ความปลอดภัย (PPE)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },

    // ─── QUALITY CONTROL (QC) ITEMS (10 Items) ───
    {
      id: 'PROD-QC-001',
      code: 'QC-BUF-PH7',
      name: 'สารละลายบัฟเฟอร์มาตรฐานสอบเทียบ pH 7.00 Buffer Solution (500ml)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'ขวด',
      stockUnit: 'ขวด',
      conversionRate: 1,
      price: 750,
      stockBalance: 8,
      reorderPoint: 4,
      leadTimeDays: 5,
      locationId: 'LOC-QC-001',
      locationName: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-002',
      code: 'QC-BUF-PH4',
      name: 'สารละลายบัฟเฟอร์มาตรฐานสอบเทียบ pH 4.01 Buffer Solution (500ml)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'ขวด',
      stockUnit: 'ขวด',
      conversionRate: 1,
      price: 750,
      stockBalance: 6,
      reorderPoint: 3,
      leadTimeDays: 5,
      locationId: 'LOC-QC-001',
      locationName: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-003',
      code: 'QC-PPT-100',
      name: 'ทิปปิเปตไมโครสีขาว (Micropipette Tips 100-1000 uL, DNase/RNase Free)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'กล่อง (1000 ชิ้น)',
      stockUnit: 'ชิ้น',
      conversionRate: 1000,
      price: 1200,
      stockBalance: 15000,
      reorderPoint: 5000,
      leadTimeDays: 4,
      locationId: 'LOC-QC-001',
      locationName: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-004',
      code: 'QC-FLT-WAT',
      name: 'กระดาษกรองเชิงคุณภาพ Whatman Grade 1 (เส้นผ่านศูนย์กลาง 110mm)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'กล่อง (100 แผ่น)',
      stockUnit: 'แผ่น',
      conversionRate: 100,
      price: 950,
      stockBalance: 1200,
      reorderPoint: 400,
      leadTimeDays: 7,
      locationId: 'LOC-QC-002',
      locationName: 'ชั้นวางอาหารเลี้ยงเชื้อ (Media Shelf B)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-005',
      code: 'QC-AGR-PCA',
      name: 'อาหารเลี้ยงเชื้อ Plate Count Agar (PCA) สำหรับทดสอบจุลชีววิทยา (500g)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'ขวด (500g)',
      stockUnit: 'กรัม',
      conversionRate: 500,
      price: 2850,
      stockBalance: 2500,
      reorderPoint: 1000,
      leadTimeDays: 10,
      locationId: 'LOC-QC-002',
      locationName: 'ชั้นวางอาหารเลี้ยงเชื้อ (Media Shelf B)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-006',
      code: 'QC-PDI-STR',
      name: 'แผ่นทดสอบความสะอาดสวอปสำเร็จรูป (Surface Hygiene Swab Test Kits)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'กล่อง (50 ชิ้น)',
      stockUnit: 'ชิ้น',
      conversionRate: 50,
      price: 3600,
      stockBalance: 400,
      reorderPoint: 150,
      leadTimeDays: 7,
      locationId: 'LOC-QC-003',
      locationName: 'ตู้ควบคุมอุณหภูมิ 4°C (Cold Storage)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-007',
      code: 'QC-THM-CAL',
      name: 'โพรบวัดอุณหภูมิดิจิตอลพร้อมใบรับรองการสอบเทียบ ISO/IEC 17025',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'ชุด',
      stockUnit: 'ชุด',
      conversionRate: 1,
      price: 4500,
      stockBalance: 4,
      reorderPoint: 2,
      leadTimeDays: 14,
      locationId: 'LOC-QC-001',
      locationName: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-008',
      code: 'QC-GLV-EXM',
      name: 'ถุงมือตรวจโรคลาเท็กซ์ไม่มีแป้งสำหรับการทดสอบแล็บ (Powder-Free Latex Gloves Size M)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'กล่อง (100 ชิ้น)',
      stockUnit: 'ชิ้น',
      conversionRate: 100,
      price: 260,
      stockBalance: 1200,
      reorderPoint: 400,
      leadTimeDays: 3,
      locationId: 'LOC-QC-001',
      locationName: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-009',
      code: 'QC-ETH-995',
      name: 'เอทานอลบริสุทธิ์เกรดวิเคราะห์ Ethanol Absolute 99.5% AR Grade (4.0L)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'ขวด (4.0L)',
      stockUnit: 'ลิตร',
      conversionRate: 4,
      price: 1650,
      stockBalance: 24,
      reorderPoint: 8,
      leadTimeDays: 5,
      locationId: 'LOC-QC-001',
      locationName: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'PROD-QC-010',
      code: 'QC-ALC-PAD',
      name: 'แผ่นแอลกอฮอล์ฆ่าเชื้อสำหรับทำความสะอาดอุปกรณ์วัด (Alcohol Prep Pads)',
      category: 'QC',
      department: 'QC',
      purchaseUnit: 'กล่อง (200 แผ่น)',
      stockUnit: 'แผ่น',
      conversionRate: 200,
      price: 180,
      stockBalance: 2000,
      reorderPoint: 800,
      leadTimeDays: 3,
      locationId: 'LOC-QC-001',
      locationName: 'ตู้เก็บสารเคมีทดสอบ (Lab 1)',
      status: 'ACTIVE',
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ]
};

/**
 * Seeds products data into Products sheet tab (Idempotent by code/id).
 * Directly writes all 20 baseline products (10 PD, 10 QC).
 * @returns {number} Number of products inserted
 */
function seedProductsData() {
  console.info('[MigrationService] Seeding Products master data (20 items)...');
  return seedSheetIfEmpty(SHEET_NAMES.PRODUCTS, SEED_DATA.PRODUCTS, 'code');
}

/**
 * Seeds base master data into the Google Sheet if sheets are empty.
 * Idempotent: Only inserts records if not already existing.
 * 
 * @returns {Object} Seeding execution report
 */
function seedInitialMasterData() {
  console.info('[MigrationService] Seeding baseline Master Data...');
  const report = {
    departmentsInserted: 0,
    locationsInserted: 0,
    unitsInserted: 0,
    usersInserted: 0,
    budgetsInserted: 0,
    countersInserted: 0,
    productsInserted: 0
  };

  // 1. Departments
  report.departmentsInserted = seedSheetIfEmpty(SHEET_NAMES.DEPARTMENTS, SEED_DATA.DEPARTMENTS, 'code');

  // 2. Storage Locations
  report.locationsInserted = seedSheetIfEmpty(SHEET_NAMES.STORAGE_LOCATIONS, SEED_DATA.STORAGE_LOCATIONS, 'id');

  // 3. Usage Units
  report.unitsInserted = seedSheetIfEmpty(SHEET_NAMES.USAGE_UNITS, SEED_DATA.USAGE_UNITS, 'id');

  // 4. Users (Seed if empty; also assigns active developer email to Admin if empty)
  const currentEmail = getCurrentUserEmail();
  const usersToSeed = SEED_DATA.USERS.map(u => {
    if (u.roleId === 'ADMIN' && currentEmail && !u.email) {
      return Object.assign({}, u, { email: currentEmail });
    }
    return u;
  });
  report.usersInserted = seedSheetIfEmpty(SHEET_NAMES.USERS, usersToSeed, 'username');

  // 5. Budgets
  report.budgetsInserted = seedSheetIfEmpty(SHEET_NAMES.BUDGETS, SEED_DATA.BUDGETS, 'dept');

  // 6. Counters
  report.countersInserted = seedSheetIfEmpty(SHEET_NAMES.PR_COUNTERS, SEED_DATA.PR_COUNTERS, 'dept');

  // 7. Products (20 items: 10 PD, 10 QC)
  report.productsInserted = seedProductsData();

  console.info('[MigrationService] Master Data Seeding completed:', JSON.stringify(report));
  return report;
}

/**
 * Helper to seed records only if target sheet has no data rows.
 */
function seedSheetIfEmpty(sheetName, records, idField) {
  const existing = batchReadRecords(sheetName);
  if (existing.length === 0) {
    batchAppendRecords(sheetName, records);
    return records.length;
  }

  // If partially populated, upsert missing records
  let count = 0;
  records.forEach(rec => {
    const found = existing.some(ex => String(ex[idField]) === String(rec[idField]));
    if (!found) {
      appendRecord(sheetName, rec);
      count++;
    }
  });

  return count;
}

/**
 * Sanitizes PO items before writing to Sheet to avoid exceeding 50,000 chars per cell limit.
 * Strips huge inline base64 image strings while preserving product codes, quantities, and metadata.
 * 
 * @param {Array|string} items
 * @returns {string} JSON string of sanitized items
 */
function sanitizePoItemsForStorage(items) {
  if (!items) return '[]';
  let rawItems = items;
  if (typeof items === 'string') {
    try {
      rawItems = JSON.parse(items);
    } catch (e) {
      return items;
    }
  }

  if (!Array.isArray(rawItems)) return JSON.stringify(rawItems);

  const cleanItems = rawItems.map(it => {
    if (!it || typeof it !== 'object') return it;
    const cleanIt = Object.assign({}, it);

    if (Array.isArray(cleanIt.images)) {
      cleanIt.images = cleanIt.images.map(img => {
        if (img && typeof img === 'object') {
          return {
            name: img.name || 'image',
            size: img.size || 0,
            type: img.type || 'image/jpeg',
            previewUrl: (img.previewUrl && String(img.previewUrl).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (img.previewUrl || ''),
            url: (img.url && String(img.url).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (img.url || '')
          };
        }
        return img;
      });
    }

    if (Array.isArray(cleanIt.attachments)) {
      cleanIt.attachments = cleanIt.attachments.map(att => {
        if (att && typeof att === 'object') {
          return {
            name: att.name || 'file',
            size: att.size || 0,
            type: att.type || 'application/octet-stream',
            previewUrl: (att.previewUrl && String(att.previewUrl).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (att.previewUrl || ''),
            url: (att.url && String(att.url).startsWith('data:')) ? '[INLINE_BASE64_STORED_IN_DRIVE]' : (att.url || '')
          };
        }
        return att;
      });
    }

    return cleanIt;
  });

  return JSON.stringify(cleanItems);
}

/**
 * Migrates a batch of PO records (such as from data/pos.json) into the POs sheet.
 * Preserves all existing IDs, document numbers, timestamps, and nested items.
 * 
 * @param {Object[]} poRecords Array of PO records
 * @returns {number} Count of successfully imported POs
 */
function migratePOsBatch(poRecords = []) {
  if (!poRecords || poRecords.length === 0) return 0;

  console.info(`[MigrationService] Migrating batch of ${poRecords.length} PO records...`);
  
  // Read existing PO numbers to avoid duplicate collisions
  const existingPOs = batchReadRecords(SHEET_NAMES.POS);
  const existingPoNos = new Set(existingPOs.map(p => String(p.poNo || p.id).trim()));

  const recordsToInsert = [];

  poRecords.forEach(po => {
    const key = String(po.poNo || po.id).trim();
    if (!key || existingPoNos.has(key)) {
      return; // Skip existing
    }

    // Sanitize and serialize complex structures
    const cleanPo = {
      id: po.id || `PO-${Date.now()}`,
      poNo: po.poNo || po.id,
      prId: po.prId || '',
      prNo: po.prNo || po.prNumber || '',
      department: po.department || 'PD',
      vendorName: po.vendorName || po.vendor || '',
      vendorId: po.vendorId || '',
      purchaseChannel: po.purchaseChannel || (po.isOnline ? 'ONLINE' : 'DIRECT'),
      issueDate: po.issueDate || po.createdAt || '',
      orderDate: po.orderDate || '',
      status: po.status || 'PENDING',
      workflowStatus: po.workflowStatus || po.status || 'PENDING',
      items: sanitizePoItemsForStorage(po.items),
      subtotal: Number(po.subtotal || 0),
      vat: Number(po.vat || 0),
      grandTotal: Number(po.grandTotal || 0),
      isOnline: Boolean(po.isOnline),
      isClosed: Boolean(po.isClosed),
      claimStatus: po.claimStatus || '',
      ngItems: typeof po.ngItems === 'object' ? JSON.stringify(po.ngItems) : (po.ngItems || '[]'),
      reviewedBy: typeof po.reviewedBy === 'object' ? JSON.stringify(po.reviewedBy) : (po.reviewedBy || ''),
      reviewedAt: po.reviewedAt || '',
      approvedBy: typeof po.approvedBy === 'object' ? JSON.stringify(po.approvedBy) : (po.approvedBy || ''),
      approvedAt: po.approvedAt || '',
      activityLog: typeof po.activityLog === 'object' ? JSON.stringify(po.activityLog) : (po.activityLog || '[]'),
      createdAt: po.createdAt || new Date().toISOString(),
      completedAt: po.completedAt || '',
      updatedAt: po.updatedAt || new Date().toISOString()
    };

    recordsToInsert.push(cleanPo);
    existingPoNos.add(key);
  });

  if (recordsToInsert.length > 0) {
    batchAppendRecords(SHEET_NAMES.POS, recordsToInsert);
    console.info(`[MigrationService] Successfully inserted ${recordsToInsert.length} POs.`);
  }

  return recordsToInsert.length;
}

/**
 * Generic Batch Importer for Master Data or Transactions.
 * 
 * @param {string} sheetName Name of target sheet tab
 * @param {Object[]} records Array of record objects
 * @param {string} idField Unique identifier field
 * @returns {number} Number of records inserted/updated
 */
function migrateGenericRecords(sheetName, records = [], idField = 'id') {
  if (!records || records.length === 0) return 0;
  console.info(`[MigrationService] Migrating ${records.length} records into "${sheetName}"...`);

  let count = 0;
  records.forEach(rec => {
    upsertRecordById(sheetName, idField, rec);
    count++;
  });

  return count;
}

/**
 * Enterprise Migration: Completely Purges ALL Department Entity & Refactors Management Scope.
 * - Removes 'ALL' / 'ส่วนกลาง / ทุกฝ่าย' from Departments sheet tab
 * - Removes any budget row for 'ALL' from Budgets sheet tab
 * - Normalizes Users with department: 'ALL' to appropriate management codes ('MGT' or 'PUR')
 *   while preserving global access in allowedDepartments / departments array (['*'])
 * - Idempotent and thread-safe.
 * 
 * @returns {Object} Migration audit report
 */
function purgeAllDepartmentEntity() {
  console.info('[MigrationService] Starting purgeAllDepartmentEntity migration...');
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.DEFAULTS.SCRIPT_LOCK_TIMEOUT_MS);
  } catch (e) {
    console.warn('[MigrationService] Lock acquisition timeout, proceeding anyway.');
  }

  const report = {
    deptsPurged: 0,
    budgetsPurged: 0,
    usersMigrated: 0,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Purge 'ALL' from Departments tab
    const depts = batchReadRecords(SHEET_NAMES.DEPARTMENTS);
    const cleanDepts = depts.filter(d => {
      const code = String(d.code || '').trim().toUpperCase();
      const id = String(d.id || '').trim().toUpperCase();
      const name = String(d.name || '');
      const isAll = (code === 'ALL' || id === 'DEPT-ALL' || name.includes('ส่วนกลาง') || name.includes('ทุกฝ่าย'));
      if (isAll) report.deptsPurged++;
      return !isAll;
    });

    if (report.deptsPurged > 0) {
      batchWriteRecords(SHEET_NAMES.DEPARTMENTS, cleanDepts);
      console.info(`[MigrationService] Successfully purged ${report.deptsPurged} ALL department records from ${SHEET_NAMES.DEPARTMENTS}.`);
    }

    // 2. Purge 'ALL' from Budgets tab
    const budgets = batchReadRecords(SHEET_NAMES.BUDGETS);
    const cleanBudgets = budgets.filter(b => {
      const dept = String(b.dept || '').trim().toUpperCase();
      const isAll = (dept === 'ALL');
      if (isAll) report.budgetsPurged++;
      return !isAll;
    });

    if (report.budgetsPurged > 0) {
      batchWriteRecords(SHEET_NAMES.BUDGETS, cleanBudgets);
      console.info(`[MigrationService] Successfully purged ${report.budgetsPurged} ALL budget records from ${SHEET_NAMES.BUDGETS}.`);
    }

    // 3. Migrate Users with department: 'ALL'
    const users = batchReadRecords(SHEET_NAMES.USERS);
    let usersUpdated = false;
    const migratedUsers = users.map(u => {
      const dept = String(u.department || '').trim().toUpperCase();
      const pDept = String(u.primaryDepartment || '').trim().toUpperCase();
      const roleId = String(u.roleId || '').trim().toUpperCase();
      const uname = String(u.username || '').trim().toLowerCase();

      if (dept === 'ALL' || pDept === 'ALL') {
        report.usersMigrated++;
        usersUpdated = true;
        const targetDept = (roleId === 'ONLINE_PURCHASER' || uname.includes('pur') || uname.includes('nat.on')) ? 'PUR' : 'MGT';

        // Clean allowedDepartments: Ensure it does not contain 'ALL', but contains '*'
        let allowed = [];
        if (Array.isArray(u.allowedDepartments)) {
          allowed = u.allowedDepartments.filter(d => String(d).toUpperCase() !== 'ALL');
        } else if (typeof u.allowedDepartments === 'string') {
          try {
            allowed = JSON.parse(u.allowedDepartments).filter(d => String(d).toUpperCase() !== 'ALL');
          } catch (e) {
            allowed = u.allowedDepartments.split(',').map(d => d.trim()).filter(d => d && d.toUpperCase() !== 'ALL');
          }
        }
        if (!allowed.includes('*')) {
          allowed.push('*');
        }

        // Clean departments array:
        let deptArr = [];
        if (Array.isArray(u.departments)) {
          deptArr = u.departments.filter(d => String(d).toUpperCase() !== 'ALL');
        } else if (typeof u.departments === 'string') {
          try {
            deptArr = JSON.parse(u.departments).filter(d => String(d).toUpperCase() !== 'ALL');
          } catch (e) {
            deptArr = u.departments.split(',').map(d => d.trim()).filter(d => d && d.toUpperCase() !== 'ALL');
          }
        }
        if (!deptArr.includes('*') && deptArr.length === 0) {
          deptArr.push('*');
        }

        return Object.assign({}, u, {
          department: targetDept,
          primaryDepartment: targetDept,
          allowedDepartments: allowed,
          departments: deptArr,
          updatedAt: new Date().toISOString()
        });
      }
      return u;
    });

    if (usersUpdated) {
      batchWriteRecords(SHEET_NAMES.USERS, migratedUsers);
      console.info(`[MigrationService] Successfully migrated ${report.usersMigrated} users with ALL department.`);
    }

    setScriptProperty('ALL_DEPARTMENT_PURGED_V1', 'true');
    console.info('[MigrationService] purgeAllDepartmentEntity completed successfully:', JSON.stringify(report));
  } catch (err) {
    console.error('[MigrationService] purgeAllDepartmentEntity error:', err.message);
    throw err;
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }

  return report;
}

