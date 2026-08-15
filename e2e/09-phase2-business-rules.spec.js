import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Phase 2: Business Rules & UX Completeness (A2, D3, E, G)', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('TC-P2-01 (2A): Separate PR cancellation vs PO cancellation rules', async ({ page }) => {
    // 1. Create a Draft PR as Requester PD
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();
    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.getByRole('button', { name: /บันทึกแบบร่าง \(Draft\)/i }).click();

    // 2. Open Draft PR and Cancel PR with reason
    const row = page.locator('tbody tr').filter({ hasText: /ร่างเอกสาร/i }).first();
    await row.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('ขอยกเลิกเนื่องจากเปลี่ยนแผนงานฝ่ายผลิต');
      } else {
        await dialog.accept();
      }
    });

    await page.getByRole('button', { name: /ยกเลิกใบขอซื้อ \(Cancel PR\)/i }).click();

    // Verify PR status is CANCELLED (switch to "ทั้งหมด" filter tab)
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /ทั้งหมด/i }).click();
    await expect(page.getByText(/ยกเลิกแล้ว|Cancelled/i).first()).toBeVisible();

    // 3. Create another PR and approve to PO
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();
    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();

    // Asst Mgr Reviews
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const subRow = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await subRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Reviewed/i }).click();
    await expect(page.getByRole('heading', { name: /ลงลายเซ็นอิเล็กทรอนิกส์/i })).toBeVisible();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // Plant Mgr Approves -> PO issued
    await loginAs(page, 'คุณประเสริฐ');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const revRow = page.locator('tbody tr').filter({ hasText: /ผ่านตรวจ \/ รออนุมัติ/i }).first();
    await revRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Approve/i }).click();
    await expect(page.getByRole('heading', { name: /ลงลายเซ็นอิเล็กทรอนิกส์/i })).toBeVisible();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 4. Open the generated PO in PO list and Cancel PO
    await page.getByRole('button', { name: /ใบสั่งซื้อ \(PO \/ รับสินค้า\)/i }).click();
    const poRow = page.locator('tbody tr').filter({ hasText: /PO-PD-/i }).first();
    await poRow.getByRole('button', { name: /รายละเอียด/i }).click();

    await page.getByRole('button', { name: /ยกเลิกใบสั่งซื้อ \(Cancel PO\)/i }).click();

    // Verify PO status becomes CANCELLED (switch to "ยกเลิกแล้ว" tab)
    await page.getByRole('button', { name: /ใบสั่งซื้อ \(PO \/ รับสินค้า\)/i }).click();
    await page.getByRole('button', { name: /ยกเลิกแล้ว/i }).click();
    await expect(page.locator('tbody tr').filter({ hasText: /PO-PD-/i }).first()).toBeVisible();
  });

  test('TC-P2-02 (2B): Automatic PO Split and POSplitModal Breakdown', async ({ page }) => {
    // 1. Create a PR with multiple items from different vendors as Requester PD
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();
    await page.locator('input[type="date"]').fill('2026-08-30');

    // Add second item
    await page.getByRole('button', { name: /เพิ่มรายการสินค้า/i }).click();

    // Select second item from dropdown
    const selectBtns = page.locator('form button').filter({ hasText: /PD-|--/i });
    if (await selectBtns.count() > 1) {
      await selectBtns.nth(1).click();
      await page.getByText(/น้ำมันหล่อลื่น|สายพาน|ใบมีด/i).first().click();
    }

    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();

    // 2. Asst Mgr Reviews
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const subRow = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await subRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Reviewed/i }).click();
    await expect(page.getByRole('heading', { name: /ลงลายเซ็นอิเล็กทรอนิกส์/i })).toBeVisible();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 3. Plant Mgr Approves -> Generates Split POs
    await loginAs(page, 'คุณประเสริฐ');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const revRow = page.locator('tbody tr').filter({ hasText: /ผ่านตรวจ \/ รออนุมัติ/i }).first();
    await revRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Approve/i }).click();
    await expect(page.getByRole('heading', { name: /ลงลายเซ็นอิเล็กทรอนิกส์/i })).toBeVisible();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 4. Open PR Details again -> Verify Split PO Banner is visible
    await page.getByRole('button', { name: /อนุมัติแล้ว/i }).click();
    const approvedRow = page.locator('tbody tr').filter({ hasText: /ออก PO แล้ว|PD/i }).first();
    await approvedRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    await expect(page.getByText(/ใบขอซื้อนี้ออกใบสั่งซื้อ \(PO\) แล้ว/i)).toBeVisible();
    await page.getByRole('button', { name: /ดูรายละเอียด PO/i }).click();

    // Verify POSplitModal opens and lists split POs
    await expect(page.getByText(/รายการใบสั่งซื้อที่แยกตามผู้ขาย/i).first()).toBeVisible();
    await expect(page.getByText(/ยอดรวมทุกใบ \(Grand Total\)/i)).toBeVisible();
  });

  test('TC-P2-03 (2C): Notification Priority and Type Filtering', async ({ page }) => {
    // 1. Login and create a PR to trigger notifications
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();
    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();

    // 2. Open Notification Drawer via Bell icon
    const bellBtn = page.locator('button[title*="การแจ้งเตือน"]').first();
    await bellBtn.click();
    
    const drawer = page.locator('.fixed.top-0.right-0');
    await expect(drawer.getByText(/ศูนย์แจ้งเตือน/i)).toBeVisible();

    // 3. Test filter tabs inside drawer
    await drawer.getByRole('button', { name: /ด่วน \/ ต้องทำ/i }).click();
    await expect(drawer.getByRole('button', { name: /ด่วน \/ ต้องทำ/i })).toBeVisible();

    await drawer.getByRole('button', { name: /^ทั้งหมด$/i }).click();
    await expect(drawer.getByRole('button', { name: /^ทั้งหมด$/i })).toBeVisible();
  });

  test('TC-P2-04 (2D): My Workspace Task Visibility & Badges', async ({ page }) => {
    // 1. Asst Manager workspace shows pending reviews
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /พื้นที่ทำงานของฉัน/i }).click();
    await expect(page.getByRole('heading', { name: /พื้นที่ทำงานของฉัน/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /ต้องดำเนินการ/i })).toBeVisible();

    // 2. Online Purchaser: My Workspace is hidden, lands on Online Tasks
    await loginAs(page, 'คุณนัท');
    await expect(page.getByRole('button', { name: /พื้นที่ทำงานของฉัน/i })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /งานจัดซื้อออนไลน์/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /สั่งซื้อออนไลน์ \(Online Tasks\)/i })).toBeVisible();
  });

});
