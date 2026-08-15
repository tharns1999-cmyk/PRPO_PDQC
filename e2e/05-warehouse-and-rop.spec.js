import { test, expect } from '@playwright/test';

test.describe('Scenario 5: Warehouse Inventory Management & ROP Auto-Trigger', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('5.1 Quick Stock Issue (-OUT) with autocomplete, quick chips, and live simulation', async ({ page }) => {
    const issueReasonNote = `[TEST]-${Date.now()}-Maintenance-Shift-2`;

    // 1. Login as Requester PD
    await page.getByRole('button', { name: /คุณวิชัย/i }).click();

    // 2. Navigate to Quick Issue view
    await page.getByRole('button', { name: /เบิกสินค้า \(Quick Issue\)/i }).click();
    await expect(page.getByRole('heading', { name: /เบิกสินค้าออกจากสต็อก/i })).toBeVisible();

    // 3. Select product via Autocomplete Searchable Select
    const selectBtn = page.locator('button').filter({ hasText: /PD-|--/i }).first();
    await selectBtn.click();
    await page.locator('[class*="animate-zoom-in"]').getByText(/จาระบีทนความร้อนสูง/i).first().click();

    // 4. Test Quick Increment Buttons
    await page.getByRole('button', { name: /\+5/i }).click();

    // 5. Fill Machine / Reason Note
    await page.getByPlaceholder(/เช่น เครื่องปั๊มชิ้นงาน/i).fill(issueReasonNote);

    // 6. Verify real-time simulation updates
    await expect(page.getByText(/การจำลองยอดคงเหลือ/i)).toBeVisible();

    // 7. Submit Stock Issue
    await page.getByRole('button', { name: /บันทึกเบิกจ่ายสินค้า \(-OUT\)/i }).click();

    // 8. Verify Success Alert & Recent Audit Log entry
    await expect(page.getByText(/เบิกสินค้า .* สำเร็จ!/i)).toBeVisible();
    await expect(page.getByText(issueReasonNote)).toBeVisible();
  });

  test('5.2 Manual Stock Receipt (+IN) in Warehouse Stock Card', async ({ page }) => {
    const stockInNote = `[TEST]-${Date.now()}-Manual-Stock-Receipt`;

    // 1. Login as Admin
    await page.getByRole('button', { name: /ผู้ดูแลระบบ/i }).click();

    // 2. Navigate to Warehouse Stock Card
    await page.getByRole('button', { name: /คลังสต็อก \(Warehouse\)/i }).click();
    await expect(page.getByRole('heading', { name: /คลังสต็อก \(Warehouse\)/i })).toBeVisible();

    // 3. Open Manual Stock-In Modal
    await page.getByRole('button', { name: /รับสินค้าเข้าคลัง/i }).click();
    await expect(page.getByRole('heading', { name: /รับสินค้าเข้าคลัง \(Manual Stock-In\)/i })).toBeVisible();

    // 4. Pick product via Searchable Select inside modal
    const picker = page.locator('.modal-content button').filter({ hasText: /พิมพ์ค้นหา|เลือกสินค้า/i });
    await picker.click();
    
    // Type in search box and select directly from portal dropdown container
    await page.getByPlaceholder(/ค้นหาชื่อสินค้า รหัส หรือตำแหน่ง/i).fill('จาระบี');
    await page.locator('[class*="animate-zoom-in"]').getByText(/จาระบีทนความร้อนสูง/i).first().click();

    // Fill Qty and Note
    await page.getByPlaceholder(/ระบุจำนวน/i).fill('10');
    await page.getByPlaceholder(/เช่น: ล็อตนำเข้า/i).fill(stockInNote);

    // Confirm Stock In
    await page.getByRole('button', { name: /บันทึกรับเข้าคลัง/i }).click();

    // 5. Verify modal closed and stock list visible
    await expect(page.getByRole('heading', { name: /คลังสต็อก \(Warehouse\)/i })).toBeVisible();
  });

});
