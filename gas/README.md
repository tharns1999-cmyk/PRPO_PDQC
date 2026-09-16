# PRPO_PDQC — Google Apps Script Backend (Sprint 2)

สถาปัตยกรรมระบบหลังบ้าน Google Apps Script (GAS) สำหรับเชื่อมต่อ Google Sheets และ Google Drive แบบ Standalone Web App 100%

---

## 1. โครงสร้างไฟล์บริการ (Consolidated Lean Architecture)

```
📁 gas/
├── 📄 appsscript.json        # GAS Manifest (V8 Engine, Timezone Asia/Bangkok, OAuth Scopes, WebApp Config)
├── 📄 Config.gs               # จุดศูนย์รวม Constants, Sheet Names, Drive Config, Script Properties, Department & Permission Helpers
├── 📄 SheetService.gs         # Concurrency Locking (Mutex), Database CRUD, Header Enforcement, Schema Initializer & Migration
├── 📄 Code.gs                 # จุดเชื่อมต่อหลัก: doGet() ให้บริการ SPA Web App, RPC Router, Auth & Drive APIs
└── 📄 README.md               # คู่มือการติดตั้ง การตั้งค่า Script Properties และการ Deploy
```

---

## 2. ข้อมูลจำเพาะทางเทคนิค (Technical Specifications)

### A. สถาปัตยกรรม 1 Single Google Spreadsheet
รวมศูนย์ข้อมูลทั้งระบบไว้ใน Google Spreadsheet ไฟล์เดียว (17 แท็บ) เพื่อลด Latency และรวมศูนย์การจัดการ Access Control:
- **Master Data (7 แท็บ):** `Products`, `Vendors`, `StorageLocations`, `UsageUnits`, `Departments`, `Users`, `Signatures`
- **Transactions (6 แท็บ):** `PRs`, `POs`, `StockLogs`, `BudgetTransactions`, `AuditLogs`, `Notifications`
- **Configuration & Storage (4 แท็บ):** `Budgets`, `PRCounters`, `AppConfig`, `Attachments`

### B. Google Account Native Authentication & RBAC
- ดึงอีเมลผู้ใช้งานปัจจุบันผ่าน `Session.getActiveUser().getEmail()`
- ค้นหาข้อมูลในแท็บ `Users` เพื่อระบุ Role, Level, Primary Department, Allowed Departments และสิทธิ์ละเอียด:
  - `PR_CREATION`: สร้าง/ส่งใบขอซื้อ
  - `REVIEW`: ตรวจทานคำขอ
  - `APPROVAL`: อนุมัติสั่งซื้อและออกเลข PO
  - `PURCHASING`: ดำเนินการสั่งซื้อออนไลน์/บันทึกราคาจริง
  - `INVENTORY`: ตรวจรับพัสดุ (GRN) / จัดการคลังสต็อก
  - `ADMIN`: สิทธิ์บริหารจัดการระบบทั้งหมด
- หากไม่มี Email ในระบบหรือสถานะบัญชีไม่เป็น `ACTIVE` ระบบจะคืนสถานะ `ACCESS_DENIED` ทันที

### C. Mutex Concurrency ด้วย LockService
ใช้ `withScriptLock(callback, timeoutMs, operationName)` ครอบจังหวะธุรกรรมสำคัญ:
1. **การออกเลขที่เอกสารลำดับ (Sequential ID Generation):** `PO-PD-2026-001`, `PD001/2026`
2. **การบันทึกตัดสต็อก/รับของเข้าคลัง (Stock Movements):** คำนวณยอดคงเหลือของสินค้าใน `Products` พร้อมลงบันทึกใน `StockLogs`
3. **การกระทบยอดงบประมาณ (Budget Reconciliation):** ปรับยอด Variance และ Spent ใน `Budgets` พร้อมบันทึกใน `BudgetTransactions`

### D. Drive & File Storage พร้อมกลไก Rollback
- โฟลเดอร์หลัก: `[ERP] PR-PO-Stock-System`
- โครงสร้างโฟลเดอร์ตามโมดูล:
  - `01_PR_Attachments/{YYYY-MM}/`
  - `02_PO_Documents/{YYYY-MM}/`
  - `03_GRN_Evidence/{YYYY-MM}/{PO_NUMBER}/`
  - `04_Claim_Evidence/{YYYY-MM}/{PO_NUMBER}/`
  - `_Backups/{YYYY-MM}/`
- **Rollback Guarantee:** หากอัปโหลดไฟล์เข้า Drive สำเร็จ แต่การบันทึกข้อมูลลงตาราง `Attachments` ล้มเหลว ระบบจะทำการย้ายไฟล์ลงถังขยะ (`setTrashed(true)`) ทันที เพื่อไม่ให้เกิดไฟล์ขยะตกค้าง

### E. มาตรฐาน API Contract (Response Envelope)
ทุกฟังก์ชัน RPC ที่เรียกผ่าน `google.script.run` ถูกครอบด้วย `handleApiRequest()` และส่งผลลัพธ์ในรูปแบบเดียว:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "message": "Operation completed successfully"
}
```

---

## 3. ขั้นตอนการติดตั้งและเริ่มต้นระบบ (Deployment & Initialization)

### ขั้นตอนที่ 1: เตรียม Google Spreadsheet
1. สร้าง Google Spreadsheet ใหม่ใน Google Drive ขององค์กร
2. คัดลอก Spreadsheet ID จาก URL:
   `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### ขั้นตอนที่ 2: Deploy โค้ด GAS
1. เปิดเมนู **ส่วนขยาย (Extensions) → Apps Script** หรือใช้ Google clasp CLI เพื่อ push โค้ดในโฟลเดอร์ `gas/` ขึ้นสู่โปรเจกต์
2. ไปที่ **Project Settings (รูปฟันเฟือง) → Script Properties** และเพิ่มตัวแปรดังนี้:
   - `SPREADSHEET_ID`: `{ไอดีของ Google Spreadsheet ที่สร้างในขั้นตอนที่ 1}`
   - `ADMIN_EMAILS`: `{อีเมลผู้ดูแลระบบ เช่น admin@company.com,user@company.com}`
   - `APP_ENV`: `production`

### ขั้นตอนที่ 3: สั่งรันฟังก์ชันเตรียมระบบ (Production Initializer)
1. ในหน้า Script Editor เลือกฟังก์ชัน `initializeSystem` แล้วกดปุ่ม **Run**
2. ให้สิทธิ์การเข้าถึง (Grant Permissions) ตามที่ Google ร้องขอ
3. ระบบจะสร้างแท็บชีตทั้ง 17 แท็บ, จัดรูปแบบหัวคอลัมน์ (Dark Slate 800 + White text), ตรึงแถวที่ 1 และสร้างโครงสร้างโฟลเดอร์ใน Google Drive ให้โดยอัตโนมัติ (เป็นฟังก์ชัน Idempotent สามารถรันซ้ำได้โดยไม่กระทบข้อมูลเดิม)

### ขั้นตอนที่ 4: นำเข้าข้อมูลเริ่มต้น (Seed Master Data & POs)
1. เลือกฟังก์ชัน `seedInitialMasterData` แล้วกด **Run** เพื่อนำเข้าข้อมูลแผนก, จุดเก็บ, หน่วยเบิก, งบประมาณ และผู้ใช้งานตั้งต้น
2. สำหรับประวัติ PO เดิม สามารถเรียกผ่าน RPC `apiMigratePOsBatch(poRecords)` จากสคริปต์ย้ายข้อมูลเพื่อนำเข้าข้อมูลขึ้นสู่แท็บ `POs`

### ขั้นตอนที่ 5: Deploy Web App
1. กดปุ่ม **Deploy → New deployment**
2. เลือกประเภท: **Web App**
3. กำหนดค่า:
   - **Description:** `PRPO_PDQC Production Release v2.0`
   - **Execute as:** `User accessing the web app` (สิทธิ์ของผู้เข้าใช้งาน)
   - **Who has access:** `Anyone within {Organization Domain}` (เฉพาะบุคคลในองค์กร)
4. กด Deploy แล้วคัดลอก **Web App URL** มาใช้งาน
