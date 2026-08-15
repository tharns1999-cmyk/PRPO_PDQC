/**
 * Helper to ensure a specific role is logged in
 */
export async function loginAs(page, roleName) {
  // Close any open modals if present
  const closeBtn = page.getByRole('button', { name: /ปิดหน้าต่าง|ปิด/i }).first();
  if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeBtn.click().catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});

  // 1. Check if user is already logged in
  const profileButton = page.locator('header button[title*="ข้อมูลผู้ใช้งาน"]');
  if (await profileButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = await profileButton.innerText().catch(() => '');
    if (new RegExp(roleName, 'i').test(text)) {
      return; // Already logged in as target role
    }

    // Otherwise, click profile button and click Logout
    await profileButton.click({ force: true });
    const logoutBtn = page.getByRole('button', { name: /ออกจากระบบ/i });
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutBtn.click();
    }
  }

  // 2. We should now be on the Login screen
  const targetRoleBtn = page.getByRole('button', { name: new RegExp(roleName, 'i') }).first();
  await targetRoleBtn.waitFor({ state: 'visible', timeout: 5000 });
  await targetRoleBtn.click();
  await page.waitForLoadState('domcontentloaded');
}
