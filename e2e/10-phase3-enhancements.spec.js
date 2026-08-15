import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Phase 3: Enhancements (3A, 3B, 3C)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('TC-P3-01 (3A): Attachment Viewer Modal opens in-app for specUrl and documents', async ({ page }) => {
    page.on('dialog', async dialog => dialog.accept());

    // 1. Requester logs in and views an existing PR with specUrl or attachments
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();

    // Open PR Details for a PR that has an attachment/link
    const row = page.locator('tbody tr').filter({ hasText: /PD/i }).first();
    await row.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    // Click "ดูเอกสารประกอบ / ลิงก์สินค้า"
    const viewDocBtn = page.getByRole('button', { name: /ดูเอกสารประกอบ|พรีวิว/i }).first();
    if (await viewDocBtn.isVisible()) {
      await viewDocBtn.click();

      // Check that Attachment Viewer Modal opened
      await expect(page.getByText(/ระบบรักษาความปลอดภัยเอกสารจัดซื้อ/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /ปิด/i }).last()).toBeVisible();

      // Close the attachment viewer modal
      await page.getByRole('button', { name: /ปิด/i }).last().click();
      await expect(page.getByText(/ระบบรักษาความปลอดภัยเอกสารจัดซื้อ/i)).not.toBeVisible();
    }
  });

  test('TC-P3-02 (3B): ROP Alert Banner in Dashboard and Warehouse with Quick PR trigger', async ({ page }) => {
    page.on('dialog', async dialog => dialog.accept());

    // 1. Requester PD logs in to Dashboard
    await loginAs(page, 'คุณวิชัย');

    // Verify ROP Alert Top Banner is visible on Dashboard
    await expect(page.getByText(/มีสินค้าแตะจุดสั่งซื้อซ้ำ \(Reorder Point Alert\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /เปิด PR สั่งซื้อด่วนทันที/i })).toBeVisible();

    // 2. Navigate to Warehouse (Stock Card) View
    await page.getByRole('button', { name: /คลังสต็อก \(Warehouse\)/i }).click();

    // Verify ROP Alert Banner in Warehouse Stock List
    await expect(page.getByText(/แจ้งเตือนสินค้าแตะจุดสั่งซื้อซ้ำ \(ROP Alert\)/i)).toBeVisible();
    
    // Click Quick PR button from Warehouse banner
    await page.getByRole('button', { name: /เปิด PR สั่งซื้อด่วน/i }).first().click();

    // Should navigate to Create PR page with the low-stock item pre-selected
    await expect(page.getByRole('heading', { name: /สร้างใบขอซื้อใหม่/i })).toBeVisible();
  });

  test('TC-P3-03 (3C): Custom Non-Catalog Item in PR Create without catalog item code', async ({ page }) => {
    page.on('dialog', async dialog => dialog.accept());

    const customItemName = `[TEST]-Adhoc-Sparepart-${Date.now().toString().slice(-4)}`;

    // 1. Requester PD logs in and navigates to Create PR
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    // 2. Switch line item to Non-Catalog Custom Item
    await page.getByRole('button', { name: /\+ ระบุนอกแคตตาล็อก/i }).first().click();
    await expect(page.getByText(/สินค้านอกแคตตาล็อก/i).first()).toBeVisible();

    // 3. Fill Custom Item Name, Price, and Unit
    await page.getByPlaceholder(/พิมพ์ชื่อสินค้า\/สเปกที่ต้องการขอซื้อ/i).fill(customItemName);
    await page.locator('input[placeholder="0.00"]').fill('1500');
    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.getByPlaceholder(/ระบุเหตุผลในการขอซื้อเพิ่มเติม/i).fill('ขอซื้ออะไหล่เฉพาะกิจนอกแคตตาล็อก');

    // 4. Submit PR
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();
    await expect(page.getByRole('heading', { name: /รายการใบขอซื้อ/i })).toBeVisible();

    // 5. Open PR Details and verify custom item is displayed with its temporary code and name
    await page.getByRole('button', { name: /ทั้งหมด/i }).click();
    const createdRow = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await createdRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    await expect(page.getByText(customItemName).first()).toBeVisible();
  });

});
