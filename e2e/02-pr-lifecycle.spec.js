import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Scenario 2: Purchase Requisition (PR) Full Lifecycle', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('2.1 Requester PD creates a standard PR (< 20k) with autocomplete product selection', async ({ page }) => {
    const testPrNote = `[TEST]-${Date.now()}-PD-Req-Standard`;

    // 1. Login as Requester PD
    await page.getByRole('button', { name: /คุณวิชัย/i }).click();
    await expect(page.getByRole('button', { name: /คุณวิชัย/i })).toBeVisible();

    // 2. Navigate to PR Workflow
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await expect(page.getByRole('heading', { name: /รายการใบขอซื้อ/i })).toBeVisible();

    // 3. Click Create New PR
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();
    await expect(page.getByRole('heading', { name: /สร้างใบขอซื้อใหม่/i })).toBeVisible();

    // 4. Verify department is locked to PD
    await expect(page.getByText(/ฝ่ายผลิต \(PD - Production\)/i).first()).toBeVisible();

    // 5. Open Autocomplete Searchable Select (click item select button)
    const selectBtn = page.locator('form button').filter({ hasText: /PD-|--/i }).first();
    await selectBtn.click();
    
    // Type in search box to find a PD grease item
    const searchInput = page.getByPlaceholder(/ค้นหารหัส ชื่อสินค้า/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('จาระบี');

    // Click matching option
    await page.getByText(/จาระบีทนความร้อนสูง/i).first().click();

    // 6. Enter Quantity (use the quantity input)
    const qtyInputs = page.locator('form input[type="number"]');
    await qtyInputs.nth(1).fill('2'); // nth(0) is price, nth(1) is qty

    // 7. Enter Note
    await page.getByPlaceholder(/ระบุเหตุผลในการขอซื้อเพิ่มเติม/i).fill(testPrNote);

    // 8. Submit PR
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();

    // 9. Verify redirected to PR list and our test PR is listed
    await expect(page.getByRole('heading', { name: /รายการใบขอซื้อ/i })).toBeVisible();
    await expect(page.getByText(/จาระบีทนความร้อนสูง/i).first()).toBeVisible();
    await expect(page.getByText(/รอตรวจสอบ/i).first()).toBeVisible();

    // 10. Click View Details button to open modal
    const testRow = page.locator('tbody tr').filter({ hasText: /จาระบีทนความร้อนสูง/i }).first();
    await testRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await expect(page.getByText(testPrNote)).toBeVisible();
  });

  test('2.2 High-Value PR (>= 20k) enforces MEMO form and File Uploads', async ({ page }) => {
    const testPrNote = `[TEST]-${Date.now()}-High-Value-Memo`;
    const memoSubject = `[TEST]-${Date.now()}-Project Maintenance Overhaul`;

    // 1. Login as Requester PD
    await page.getByRole('button', { name: /คุณวิชัย/i }).click();
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    // 2. Select a product and increase quantity to exceed 20,000 THB threshold
    const selectBtn = page.locator('form button').filter({ hasText: /PD-|--/i }).first();
    await selectBtn.click();
    await page.getByPlaceholder(/ค้นหารหัส ชื่อสินค้า/i).fill('ไฮดรอลิก');
    await page.getByText(/น้ำมันไฮดรอลิก/i).first().click();

    // Set qty to 10 (10 * ~3,500 = 35,000 THB >= 20,000 THB threshold)
    const qtyInputs = page.locator('form input[type="number"]');
    await qtyInputs.nth(1).fill('10');

    // 3. Verify MEMO Alert Banner appears
    await expect(page.getByText(/ระบบบังคับแนบ MEMO ขออนุมัติและเอกสารคู่ขนาน/i)).toBeVisible();
    await expect(page.getByText(/4\. แบบฟอร์ม MEMO ขออนุมัติซื้อ/i)).toBeVisible();

    // 4. Upload Quotation PDF & Sample Image fixtures
    const quoteFilePath = path.join(__dirname, 'fixtures', 'dummy-quote.pdf');
    const imageFilePath = path.join(__dirname, 'fixtures', 'dummy-image.png');

    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(quoteFilePath); // Quotation
    await fileInputs.nth(1).setInputFiles(imageFilePath); // Images

    // Verify uploaded file chips appear
    await expect(page.getByText(/dummy-quote\.pdf/i)).toBeVisible();
    await expect(page.getByAltText(/dummy-image\.png/i)).toBeVisible();

    // 5. Fill MEMO form fields
    await page.getByPlaceholder(/ขออนุมัติติดตั้งระบบหล่อลื่น/i).fill(memoSubject);
    await page.getByPlaceholder(/ระบุวัตถุประสงค์ความจำเป็น/i).fill('ทดแทนสารหล่อลื่นที่หมดอายุการใช้งานตามรอบ PM ประจำปี');
    await page.getByPlaceholder(/ระบุที่มา ข้อมูลเครื่องจักร/i).fill('เครื่องเพรสหมายเลข Line-03 มีชั่วโมงการทำงานครบ 5,000 ชม.');
    await page.getByPlaceholder(/ระบุเหตุผลในการขอซื้อเพิ่มเติม/i).fill(testPrNote);

    // 6. Submit PR
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();

    // 7. Verify PR appears in list
    await expect(page.getByRole('heading', { name: /รายการใบขอซื้อ/i })).toBeVisible();
    await expect(page.getByText(/น้ำมันไฮดรอลิก/i).first()).toBeVisible();

    // Open PR Details Modal to verify MEMO details
    await page.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).first().click();
    await expect(page.getByText(memoSubject)).toBeVisible();
  });

  test('2.3 Save PR as Draft', async ({ page }) => {
    const draftNote = `[TEST]-${Date.now()}-Draft-PR`;

    // 1. Login as Requester QC
    await page.getByRole('button', { name: /คุณสมหญิง/i }).click();
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    // 2. Select a QC product (Buffer solution)
    const selectBtn = page.locator('form button').filter({ hasText: /QC-|--/i }).first();
    await selectBtn.click();
    await page.getByPlaceholder(/ค้นหารหัส ชื่อสินค้า/i).fill('บัฟเฟอร์');
    await page.getByText(/สารละลายบัฟเฟอร์/i).first().click();

    await page.getByPlaceholder(/ระบุเหตุผลในการขอซื้อเพิ่มเติม/i).fill(draftNote);

    // 3. Click Save as Draft
    await page.getByRole('button', { name: /บันทึกแบบร่าง \(Draft\)/i }).click();

    // 4. Verify PR is created with DRAFT status
    await expect(page.getByRole('heading', { name: /รายการใบขอซื้อ/i })).toBeVisible();
    await expect(page.getByText(/สารละลายบัฟเฟอร์/i).first()).toBeVisible();
    await expect(page.getByText(/ร่างเอกสาร \(Draft\)/i).first()).toBeVisible();
  });

});
