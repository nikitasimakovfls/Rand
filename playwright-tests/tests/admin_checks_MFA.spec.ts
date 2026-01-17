import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Admin MFA Verification', () => {

  test('admin can see the MFA QR code after starting enrollment', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Set a global timeout for this specific test
    test.setTimeout(60000);

    // Admin Authorization
    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await page.keyboard.press('Enter');

    // Navigate to MFA Section
    // Locating the MFA link within the navigation menu
    await page.locator('li.nav-item').getByRole('link', { name: 'MFA', exact: true }).click();
    
    // Confirm navigation by checking the heading visibility
    await expect(page.locator('#mfa-heading')).toBeVisible();

    // Start MFA Enrollment Process
    await page.getByRole('button', { name: 'Start MFA Enrollment' }).click();

    // Verify Physical Presence of the QR Code
    // According to the DOM structure, the QR code is a <canvas role="img">
    const qrCanvas = page.locator('canvas[role="img"]');

    // Wait for the element to appear in DOM and become visible
    await expect(qrCanvas).toBeVisible({ timeout: 15000 });

    // Verify that the QR code is actually rendered (has dimensions > 0)
    // This ensures the canvas is not empty or collapsed
    const box = await qrCanvas.boundingBox();
    
    if (!box || box.width < 10 || box.height < 10) {
        throw new Error('QR Code canvas is visible but has no physical size (not rendered correctly).');
    }

    // Additional check for the instructional text context nearby
    await expect(page.locator('text=Add an account by scanning a QR code')).toBeVisible();

    console.log(`[Success] Test finished: QR code is visible with dimensions ${box.width}x${box.height}`);
  });
});