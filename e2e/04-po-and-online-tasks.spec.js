import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Scenario 4: PO Management & Online Purchase Workflow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('4.1 Online Purchase Lifecycle: Online PR -> Auto Online PO -> Online Purchaser Fulfill', async ({ page }) => {
    page.on('dialog', async dialog => dialog.accept());
    const onlinePrNote = `[TEST]-${Date.now()}-Online-Shopee-PR`;
    const storeName = `[TEST]-Shopee-Store-${Date.now().toString().slice(-4)}`;

    // 1. Login as Requester PD
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    // Select Online Purchase Channel
    await page.locator('input[value="ONLINE"]').check();
    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.locator('input[placeholder*="shopee.co.th"]').fill('https://shopee.co.th/product/12345/67890');
    await page.getByPlaceholder(/ระบุเหตุผลในการขอซื้อเพิ่มเติม/i).fill(onlinePrNote);

    // Submit PR
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();
    await expect(page.getByRole('heading', { name: /รายการใบขอซื้อ/i })).toBeVisible();

    // 2. Asst. Manager Level 2 Review
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const asstPrRow = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await asstPrRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Reviewed/i }).click();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 3. Plant Manager Level 3 Approval
    await loginAs(page, 'คุณประเสริฐ');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const plantPrRow = page.locator('tbody tr').filter({ hasText: /ผ่านตรวจ \/ รออนุมัติ/i }).first();
    await plantPrRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Approve/i }).click();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 4. Switch to Online Purchaser
    await loginAs(page, 'คุณนัท');

    // Navigate to Online Tasks
    await expect(page.getByRole('heading', { name: /งานจัดซื้อออนไลน์/i })).toBeVisible();

    // Acknowledge and specify store name
    await page.locator('input[placeholder*="ระบุร้าน"]').first().fill(storeName);
    await page.getByRole('button', { name: /รับทราบและสั่งซื้อแล้ว/i }).first().click();

    // Verify task moves to Ordered tab
    await expect(page.getByText(/สั่งซื้อแล้ว \/ รอจัดส่ง/i)).toBeVisible();

    // 5. Origin Dept Requester receives and closes PO
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบสั่งซื้อ \(PO \/ รับสินค้า\)/i }).click();
    await expect(page.getByText(/สั่งซื้อแล้ว \(รอจัดส่ง\/รับของ\)/i).first()).toBeVisible();
  });

});
