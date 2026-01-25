import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Admin MFA verification', () => {

  test('admin can see the MFA QR code after starting enrollment', async ({ page }) => {
    const loginPage = new LoginPage(page);

    test.setTimeout(60000);

    // --- Step 1: Admin Authorization ---
    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await expect(page).not.toHaveURL(/.*\/login/);

    console.log(`[Admin] Loged In`);

    // --- Step 2: Navigate to MFA Section ---
    const mfaLink = page.locator('li.nav-item').getByRole('link', { name: 'MFA', exact: true });
    await mfaLink.click();
    
    const mfaHeading = page.locator('#mfa-heading');
    await expect(mfaHeading).toBeVisible({ timeout: 10000 });

    // --- Step 3: Start MFA Enrollment Process ---
    const startEnrollmentBtn = page.getByRole('button', { name: 'Start MFA Enrollment' });
    await startEnrollmentBtn.click();

    // --- Step 4: Verify Physical Presence of the QR Code ---
    const qrCanvas = page.locator('canvas[role="img"]');

    await expect(qrCanvas).toBeVisible({ timeout: 15000 });

    // Verify that the QR code is actually rendered with valid dimensions
    // This ensures the canvas isn't collapsed (0x0)
    const box = await qrCanvas.boundingBox();
    
    if (!box || box.width < 10 || box.height < 10) {
        throw new Error('QR Code canvas is visible but not rendered correctly (invalid dimensions).');
    }

    // Check for accompanying instructional text
    const instructions = page.locator('text=Add an account by scanning a QR code');
    await expect(instructions).toBeVisible();

    console.log(`[Admin] MFA QR code is verified. Dimensions: ${box.width}x${box.height}\n`);
    console.log(`✅ [Success] Test completed\n`);
  });
});