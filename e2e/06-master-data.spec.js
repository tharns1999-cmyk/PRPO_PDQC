import { test, expect } from '@playwright/test';

test.describe('Scenario 6: Master Data Management (CRUD)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('6.1 Product Master: Create, List & Edit in 3-Section Modal', async ({ page }) => {
    const timestamp = Date.now();
    const productCode = `[TEST]-P${timestamp.toString().slice(-4)}`;
    const productName = `[TEST]-สินค้าทดสอบอะไหล่-${timestamp}`;

    // 1. Login as Admin
    await page.getByRole('button', { name: /ผู้ดูแลระบบ/i }).click();

    // 2. Navigate to Master Data
    await page.getByRole('button', { name: /จัดการ Master Data/i }).click();
    await expect(page.getByRole('heading', { name: /จัดการข้อมูลหลัก \(Master Data\)/i })).toBeVisible();

    // 3. Open Add Product Modal
    await page.getByRole('button', { name: /เพิ่มสินค้าใหม่/i }).click();
    await expect(page.getByRole('heading', { name: /เพิ่มสินค้าใหม่/i })).toBeVisible();

    // 4. Fill Product Form
    await page.locator('input[name="code"]').fill(productCode);
    await page.locator('input[name="name"]').fill(productName);
    await page.locator('input[name="price"]').fill('1250');
    await page.locator('input[name="reorderPoint"]').fill('15');

    // 5. Submit Product (button text is "บันทึกสินค้าใหม่")
    await page.getByRole('button', { name: /บันทึกสินค้าใหม่/i }).click();

    // 6. Verify product appears in the table
    await expect(page.getByText(productCode)).toBeVisible();
    await expect(page.getByText(productName)).toBeVisible();

    // 7. Edit Product
    const row = page.locator('tr').filter({ hasText: productCode });
    await row.getByRole('button', { name: /แก้ไข/i }).click();
    await expect(page.getByRole('heading', { name: /แก้ไขข้อมูลสินค้า/i })).toBeVisible();

    // Update price
    await page.locator('input[name="price"]').fill('1500');
    await page.getByRole('button', { name: /บันทึกการแก้ไข/i }).click();

    // Verify updated price in table
    await expect(row.getByText(/1,500/i)).toBeVisible();
  });

  test('6.2 Vendor Master: Create & List Vendor', async ({ page }) => {
    const timestamp = Date.now();
    const vendorCode = `[TEST]-V${timestamp.toString().slice(-4)}`;
    const vendorName = `[TEST]-บริษัท ทดสอบจัดซื้อ จำกัด-${timestamp}`;

    // 1. Login as Admin
    await page.getByRole('button', { name: /ผู้ดูแลระบบ/i }).click();
    await page.getByRole('button', { name: /จัดการ Master Data/i }).click();

    // 2. Switch to Vendors tab
    await page.getByRole('button', { name: /ผู้ขาย \/ Vendor/i }).click();

    // 3. Open Add Vendor Modal
    await page.getByRole('button', { name: /เพิ่มผู้ขายใหม่/i }).click();
    await expect(page.getByRole('heading', { name: /เพิ่มผู้ขายใหม่/i })).toBeVisible();

    // 4. Fill Vendor Form
    await page.locator('input[name="code"]').fill(vendorCode);
    await page.locator('input[name="name"]').fill(vendorName);
    await page.locator('input[name="contactPerson"]').fill('คุณประดิษฐ์');
    await page.locator('input[name="phone"]').fill('089-111-2233');

    // 5. Submit Vendor (button text is "บันทึกผู้ขายใหม่")
    await page.getByRole('button', { name: /บันทึกผู้ขายใหม่/i }).click();

    // 6. Verify vendor listed in table
    await expect(page.getByText(vendorCode)).toBeVisible();
    await expect(page.getByText(vendorName)).toBeVisible();
  });

});
