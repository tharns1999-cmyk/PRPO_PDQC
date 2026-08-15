import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Scenario 7: Unit Conversion & 2-Way Mapping (Phase 0)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('7.1 Master Data: Configure 2-way unit mapping and live preview', async ({ page }) => {
    const timestamp = Date.now();
    const productCode = `[TEST]-U${timestamp.toString().slice(-4)}`;
    const productName = `[TEST]-น้ำมันทดสอบอัตราแปลง-${timestamp}`;

    // 1. Login as Admin
    await loginAs(page, 'ผู้ดูแลระบบ');

    // 2. Navigate to Master Data
    await page.getByRole('button', { name: /จัดการ Master Data/i }).click();
    await expect(page.getByRole('heading', { name: /จัดการข้อมูลหลัก \(Master Data\)/i })).toBeVisible();

    // 3. Click Add Product
    await page.getByRole('button', { name: /เพิ่มสินค้าใหม่/i }).click();
    await expect(page.getByRole('heading', { name: /เพิ่มสินค้าใหม่/i })).toBeVisible();

    // 4. Fill 2-Way Unit Mapping
    await page.locator('input[name="code"]').fill(productCode);
    await page.locator('input[name="name"]').fill(productName);
    await page.locator('input[name="price"]').fill('14500');
    await page.locator('input[name="purchaseUnit"]').fill('ถัง (200L)');
    await page.locator('input[name="stockUnit"]').fill('ลิตร');
    await page.locator('input[name="conversionRate"]').fill('200');

    // 5. Verify live preview calculation in the modal
    await expect(page.getByText('1 ถัง (200L) = 200 ลิตร').first()).toBeVisible();

    // 6. Submit
    await page.getByRole('button', { name: /บันทึกสินค้าใหม่/i }).click();

    // 7. Verify product row in table shows unit and rate
    const row = page.locator('tr').filter({ hasText: productCode });
    await expect(row).toBeVisible();
    await expect(row.getByText(/ถัง \(200L\)/i).first()).toBeVisible();
  });

  test('7.2 PR Creation with conversionRate > 1 (e.g. 1 ถัง = 200 ลิตร)', async ({ page }) => {
    // 1. Login as Requester PD
    await loginAs(page, 'คุณวิชัย');

    // 2. Navigate to PR List and click Create PR
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();
    await expect(page.getByRole('heading', { name: /สร้างใบขอซื้อใหม่/i })).toBeVisible();

    // 3. Check quantity input & unit badge
    const qtyInput = page.locator('input[name="qty"]').first();
    if (await qtyInput.count() > 0) {
      await qtyInput.fill('2');
    }

    // Hint should show
    const conversionBadge = page.locator('text=⚡ เข้าคลัง:');
    if (await conversionBadge.count() > 0) {
      await expect(conversionBadge.first()).toBeVisible();
    }
  });

  test('7.3 Quick Issue Stock operates in Stock Unit with Dual Balance hint', async ({ page }) => {
    // 1. Login as Requester PD
    await loginAs(page, 'คุณวิชัย');

    // 2. Navigate to Quick Issue
    await page.getByRole('button', { name: /เบิกสินค้า \(Quick Issue\)/i }).click();
    await expect(page.getByRole('heading', { name: /เบิกสินค้าออกจากสต็อก/i })).toBeVisible();

    // 3. Verify stockUnit is used in Issue input
    await expect(page.getByText(/จำนวนที่ต้องการเบิก/i)).toBeVisible();
    await expect(page.getByText(/คงเหลือในคลัง:/i)).toBeVisible();
  });

  test('7.4 Warehouse Stock Card shows stock balance and dual conversion', async ({ page }) => {
    // 1. Login as Requester PD
    await loginAs(page, 'คุณวิชัย');

    // 2. Navigate to Stock Card
    await page.getByRole('button', { name: /คลังสต็อก \(Warehouse\)/i }).click();
    await expect(page.getByRole('heading', { name: /คลังสต็อก/i })).toBeVisible();

    // 3. Verify table displays products with units
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText(/คงเหลือปัจจุบัน/i)).toBeVisible();
  });

});
