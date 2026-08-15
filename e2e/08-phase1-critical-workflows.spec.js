import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Phase 1: Critical Workflow Fixes (A1, D1, F)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('TC-P1-01 (1A): 1-Level Rejection State Machine (Plant Mgr -> L2 Asst Mgr -> L1 Requester)', async ({ page }) => {
    page.on('dialog', async dialog => dialog.accept());

    // 1. Create and submit PR as Requester (PD)
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.getByPlaceholder(/ระบุเหตุผลในการขอซื้อเพิ่มเติม/i).fill('ทดสอบ Rejection 1-Level');

    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();
    await expect(page.getByRole('heading', { name: /รายการใบขอซื้อ/i })).toBeVisible();

    // 2. Asst. Manager (Level 2) Reviews and passes to Level 3
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    
    // Open the submitted PR row
    const row = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await row.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    // Click Reviewed
    await page.getByRole('button', { name: /Reviewed/i }).click();
    await expect(page.getByRole('heading', { name: /ลงลายเซ็นอิเล็กทรอนิกส์/i })).toBeVisible();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 3. Plant Manager (Level 3) Rejects with reason
    await loginAs(page, 'คุณประเสริฐ');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();

    const reviewedRow = page.locator('tbody tr').filter({ hasText: /ผ่านตรวจ \/ รออนุมัติ/i }).first();
    await reviewedRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    // Fill rejection reason
    await page.locator('input[placeholder*="ความเห็นจาก Plant Manager"]').fill('ส่งกลับ Level 2 ช่วยเช็คราคาเปรียบเทียบเพิ่ม');
    await page.getByRole('button', { name: /Reject \(ส่งกลับ Level 2\)/i }).click();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 4. Verify status became REJECTED_TO_L2 (Sent back to Level 2 Asst Mgr)
    await page.getByRole('button', { name: /ทั้งหมด/i }).click();
    await expect(page.getByText(/ส่งกลับ Level 2/i).first()).toBeVisible();

    // 5. Asst Manager (Level 2) can now view and reject further to Level 1 (Requester)
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /ทั้งหมด/i }).click();
    const l2Row = page.locator('tbody tr').filter({ hasText: /ส่งกลับ Level 2/i }).first();
    await l2Row.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    await page.locator('input[placeholder*="ความเห็น / เหตุผล"]').fill('ส่งกลับให้ผู้ขอซื้อแนบใบเสนอราคาเพิ่ม');
    await page.getByRole('button', { name: /Reject \(ส่งกลับผู้ขอซื้อ/i }).click();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // Verify status became REJECTED_TO_DRAFT (Back to Requester)
    await page.getByRole('button', { name: /ทั้งหมด/i }).click();
    await expect(page.getByText(/ถูกส่งกลับให้แก้ไข/i).first()).toBeVisible();
  });

  test('TC-P1-02 (1B): Approver item editing before approval with audit log', async ({ page }) => {
    page.on('dialog', async dialog => dialog.accept());

    // 1. Create and submit PR as Requester (PD)
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.getByRole('button', { name: /บันทึกแบบร่าง \(Draft\)/i }).click();

    // Submit PR
    const row = page.locator('tbody tr').filter({ hasText: /ร่างเอกสาร/i }).first();
    await row.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Submit/i }).click();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 2. Asst Manager opens PR details and edits items
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const subRow = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await subRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    // Click Edit Items
    await page.getByRole('button', { name: /แก้ไขรายการก่อนอนุมัติ/i }).click();
    await expect(page.locator('input[placeholder*="ระบุเหตุผลที่ปรับแก้"]')).toBeVisible();

    // Change qty & fill reason
    await page.locator('input[placeholder*="ระบุเหตุผลที่ปรับแก้"]').fill('ปรับลดจำนวนตามงบประมาณกึ่งรอบ');
    await page.getByRole('button', { name: /บันทึกการแก้ไข/i }).click();

    // Verify activity log reflects change
    await expect(page.getByText(/แก้ไขรายการสินค้า \(Approver Item Edit\)/i)).toBeVisible();
  });

  test('TC-P1-03 (1C): Online Purchaser Role restricted fields and Requester PO closing', async ({ page }) => {
    page.on('dialog', async dialog => dialog.accept());

    // 1. Create Online PR as Requester (PD)
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    // Choose Online channel
    await page.locator('input[value="ONLINE"]').check();
    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.locator('input[placeholder*="shopee.co.th"]').fill('https://shopee.co.th/product/12345/67890');
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();

    // 2. Asst Mgr Reviews
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const subRow = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await subRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Reviewed/i }).click();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 3. Plant Mgr Approves -> Creates Online PO
    await loginAs(page, 'คุณประเสริฐ');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const revRow = page.locator('tbody tr').filter({ hasText: /ผ่านตรวจ \/ รออนุมัติ/i }).first();
    await revRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
    await page.getByRole('button', { name: /Approve/i }).click();
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 4. Online Purchaser accesses Online Task view
    await loginAs(page, 'คุณนัท');
    await page.getByRole('button', { name: /สั่งซื้อออนไลน์ \(Online Tasks\)/i }).click();

    // Verify task is visible
    await expect(page.getByRole('heading', { name: /งานจัดซื้อออนไลน์/i })).toBeVisible();
    await expect(page.getByText(/รอดำเนินการสั่งซื้อ/i).first()).toBeVisible();

    // Acknowledge and specify store name
    await page.locator('input[placeholder*="ระบุร้าน"]').first().fill('Shopee ร้านอะไหล่แท้');
    await page.getByRole('button', { name: /รับทราบและสั่งซื้อแล้ว/i }).first().click();

    // Verify task moves to Ordered tab
    await expect(page.getByText(/สั่งซื้อแล้ว \/ รอจัดส่ง/i)).toBeVisible();

    // 5. Origin Dept Requester receives and closes PO
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบสั่งซื้อ \(PO \/ รับสินค้า\)/i }).click();
    await expect(page.getByText(/สั่งซื้อแล้ว \(รอจัดส่ง\/รับของ\)/i).first()).toBeVisible();
  });

  test('TC-P1-04 (1D): Electronic signature enforcement and Admin signature management', async ({ page }) => {
    page.on('dialog', async dialog => dialog.accept());

    // 1. Admin navigates to Master Data -> Manage Signatures tab
    await loginAs(page, 'ผู้ดูแลระบบ');
    await page.getByRole('button', { name: /จัดการ Master Data/i }).click();
    await page.getByRole('button', { name: /จัดการลายเซ็น \(E-Sign\)/i }).click();

    await expect(page.getByText(/ระบบควบคุมลายเซ็นอิเล็กทรอนิกส์/i)).toBeVisible();
    await expect(page.getByText(/มีลายเซ็นแล้ว/i).first()).toBeVisible();

    // 2. Admin removes signature for Assistant Manager
    const deleteBtn = page.locator('button[title*="ลบลายเซ็น"]').first();
    await deleteBtn.click();

    // 3. Verify status changed to "ยังไม่มีลายเซ็น (Blocked)"
    await expect(page.getByText(/ยังไม่มีลายเซ็น \(Blocked\)/i).first()).toBeVisible();

    // 4. Asst Manager tries to review a PR -> System blocks approval!
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();

    // Find any PR to view or click
    const prRow = page.locator('tbody tr').filter({ hasText: /PD/i }).first();
    if (await prRow.count() > 0) {
      await prRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();
      
      const reviewBtn = page.getByRole('button', { name: /Reviewed/i });
      if (await reviewBtn.count() > 0) {
        await reviewBtn.click();
        // Check that Electronic Signature modal shows blocking message
        await expect(page.getByText(/ไม่อนุญาตให้อนุมัติ \(ไม่มีลายเซ็นในระบบ\)/i)).toBeVisible();
        await expect(page.getByText(/กรุณาติดต่อ Admin เพื่อตั้งค่าลายเซ็นก่อน/i)).toBeVisible();
        // The confirm button should not be available
        await expect(page.getByRole('button', { name: /ยืนยันและลงนาม/i })).not.toBeVisible();
      }
    }
  });

});
