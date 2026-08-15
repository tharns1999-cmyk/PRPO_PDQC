import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Scenario 3: Multi-Level Approval & Workflow Engine', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('3.1 Full End-to-End: Create PR -> Asst. Mgr Review (Pass) -> Plant Mgr Approve -> Auto PO Generated', async ({ page }) => {
    const prNote = `[TEST]-${Date.now()}-Full-Approval-Flow`;

    // ── STEP 1: Requester PD creates a PR ──
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.getByPlaceholder(/ระบุเหตุผลในการขอซื้อเพิ่มเติม/i).fill(prNote);
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();

    // Verify PR created in list
    await expect(page.getByRole('heading', { name: /รายการใบขอซื้อ/i })).toBeVisible();

    // ── STEP 2: Login as Asst. Manager (Level 2 Review) ──
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const row = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await row.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    // Click Level 2 Action
    const passButton = page.getByRole('button', { name: /Reviewed/i });
    await expect(passButton).toBeVisible();
    await passButton.click();

    // E-Signature confirmation
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // ── STEP 3: Login as Plant Manager (Level 3 Approval) ──
    await loginAs(page, 'คุณประเสริฐ');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const revRow = page.locator('tbody tr').filter({ hasText: /ผ่านตรวจ \/ รออนุมัติ/i }).first();
    await revRow.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    // Plant Manager approves
    const approveButton = page.getByRole('button', { name: /Approve/i });
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // E-Signature confirmation
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // ── STEP 4: Verify Auto PO is generated in PO list ──
    await page.getByRole('button', { name: /ใบสั่งซื้อ \(PO \/ รับสินค้า\)/i }).click();
    await expect(page.getByRole('heading', { name: /รายการใบสั่งซื้อ|ใบสั่งซื้อ/i })).toBeVisible();
    await expect(page.getByText(/PO-PD-/i).first()).toBeVisible();
  });

  test('3.2 Asst. Manager returns PR for edit (Reject/Return)', async ({ page }) => {
    const returnPrNote = `[TEST]-${Date.now()}-Return-For-Edit-PR`;

    // 1. Create PR as Requester PD
    await loginAs(page, 'คุณวิชัย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    await page.getByRole('button', { name: /สร้างใบ PR ใหม่/i }).click();

    await page.locator('input[type="date"]').fill('2026-08-30');
    await page.getByPlaceholder(/ระบุเหตุผลในการขอซื้อเพิ่มเติม/i).fill(returnPrNote);
    await page.getByRole('button', { name: /ส่งใบ PR เข้าสู่ระบบ/i }).click();

    // 2. Login as Asst. Manager
    await loginAs(page, 'คุณสมชาย');
    await page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i }).click();
    const row = page.locator('tbody tr').filter({ hasText: /รอตรวจสอบ/i }).first();
    await row.getByRole('button', { name: /ดำเนินการ|ดูรายละเอียด/i }).click();

    // Fill rejection comment
    await page.locator('input[placeholder*="ความเห็น / เหตุผล"]').fill('ขอปรับลดจำนวนลง');

    const returnBtn = page.getByRole('button', { name: /Reject \(ส่งกลับผู้ขอซื้อ/i });
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // E-Signature confirmation
    await page.getByRole('button', { name: /ยืนยันและลงนาม/i }).click();

    // 3. Verify PR is now in list with returned status
    await page.getByRole('button', { name: /ทั้งหมด/i }).click();
    await expect(page.getByText(/ถูกส่งกลับให้แก้ไข/i).first()).toBeVisible();
  });

});
