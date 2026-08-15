import { test, expect } from '@playwright/test';

test.describe('Scenario 1: Authentication & Role-Based Access Control (RBAC)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1.1 Login as Requester PD and verify PD permissions', async ({ page }) => {
    // Verify on Login screen
    await expect(page.getByRole('heading', { name: /PR\/PO & Inventory System/i })).toBeVisible();

    // Click quick login for Requester PD
    await page.getByRole('button', { name: /คุณวิชัย/i }).click();

    // Verify main app dashboard appears with PD Requester role
    await expect(page.getByRole('button', { name: /คุณวิชัย/i })).toBeVisible();

    // Verify Sidebar menus visible for Requester PD
    await expect(page.getByRole('button', { name: /ภาพรวมระบบ \(Dashboard\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /พื้นที่ทำงานของฉัน/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /คลังสต็อก \(Warehouse\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /เบิกสินค้า \(Quick Issue\)/i })).toBeVisible();

    // Verify Budget menu is NOT visible for normal requester
    await expect(page.getByRole('button', { name: /งบประมาณ \(Budget\)/i })).not.toBeVisible();
  });

  test('1.2 Login as Asst. Manager and verify supervisor badge & approval menus', async ({ page }) => {
    // Login as Asst. Manager
    await page.getByRole('button', { name: /คุณสมชาย/i }).click();

    // Verify Assistant Manager profile in header
    await expect(page.getByRole('button', { name: /คุณสมชาย/i })).toBeVisible();

    // Verify Supervisor approval menus are accessible
    await expect(page.getByRole('button', { name: /ใบขอซื้อ \(PR Workflow\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /ใบสั่งซื้อ \(PO \/ รับสินค้า\)/i })).toBeVisible();
  });

  test('1.3 Login as Online Purchaser and verify Online Tasks menu', async ({ page }) => {
    // Login as Online Purchaser
    await page.getByRole('button', { name: /คุณนัท/i }).click();

    await expect(page.getByRole('button', { name: /คุณนัท/i })).toBeVisible();
    // Verify Online Tasks heading and menu is visible
    await expect(page.getByRole('heading', { name: /งานจัดซื้อออนไลน์/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /สั่งซื้อออนไลน์ \(Online Tasks\)/i })).toBeVisible();
  });

  test('1.4 Login as System Admin and verify unrestricted access including Master Data & Budget', async ({ page }) => {
    // Login as Admin
    await page.getByRole('button', { name: /ผู้ดูแลระบบ/i }).click();

    await expect(page.getByRole('button', { name: /Admin/i })).toBeVisible();

    // Admin has access to all menus
    await expect(page.getByRole('button', { name: /จัดการ Master Data/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /งบประมาณ \(Budget\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /สั่งซื้อออนไลน์ \(Online Tasks\)/i })).toBeVisible();
  });

  test('1.5 Open User Profile modal and test Logout', async ({ page }) => {
    // Login first as PD
    await page.getByRole('button', { name: /คุณวิชัย/i }).click();
    await expect(page.getByRole('button', { name: /คุณวิชัย/i })).toBeVisible();

    // Click profile button in header to open User Profile modal
    await page.getByRole('button', { name: /คุณวิชัย/i }).click();

    // Verify User Profile modal is visible
    await expect(page.getByRole('heading', { name: /ข้อมูลผู้ใช้งาน/i })).toBeVisible();

    // Click Logout
    await page.getByRole('button', { name: /ออกจากระบบ/i }).click();

    // Verify returned to LoginView
    await expect(page.getByRole('heading', { name: /PR\/PO & Inventory System/i })).toBeVisible();
  });

});
