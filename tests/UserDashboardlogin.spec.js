import { test, expect } from '@playwright/test';

const USER_DASHBOARD_URL = 'https://bizprospex.aml-pep-data.com';

// ─────────────────────────────────────────────────────────
// TEST: Full Login with Browser Prompt OTP Input
// ─────────────────────────────────────────────────────────
test.describe('Full Login Flow - Browser Prompt OTP', () => {

    test('should login successfully with OTP via browser prompt', async ({ page }) => {
        test.setTimeout(120000);

        const testEmail = 'yash@bizprospex.com';

        // Step 1: Login page pe jao
        await page.goto(`${USER_DASHBOARD_URL}/user/login/`, { timeout: 60000 });

        // Step 2: Email bharo aur OTP request karo
        await page.fill('#email-address', testEmail);
        await page.click('button:has-text("Send OTP Code")');

        // Step 3: OTP step aane ka wait karo
        await expect(
            page.locator('h3:has-text("Enter Secure Code")')
        ).toBeVisible({ timeout: 20000 });

        console.log('✅ OTP step aa gaya — ab ek input box browser mein khuleg...');

        // Step 4: Page pe ek custom OTP input overlay inject karo
        // (window.prompt Playwright mein theek se kaam nahi karta)
        const otp = await page.evaluate(() => {
            return new Promise((resolve) => {
                // Overlay div banao
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.7); z-index: 999999;
                    display: flex; align-items: center; justify-content: center;
                `;

                // Box banao
                const box = document.createElement('div');
                box.style.cssText = `
                    background: white; padding: 32px; border-radius: 12px;
                    text-align: center; font-family: sans-serif; min-width: 320px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                `;

                box.innerHTML = `
                    <div style="font-size:32px; margin-bottom:12px;">📧</div>
                    <h2 style="margin:0 0 8px; color:#1a1a1a;">OTP Daalo</h2>
                    <p style="color:#666; margin:0 0 20px; font-size:14px;">
                        Email aaya hai <b>yash@bizprospex.com</b> pe
                    </p>
                    <input 
                        id="otp-manual-input"
                        type="text" 
                        maxlength="6" 
                        placeholder="6-digit OTP"
                        style="
                            width: 100%; padding: 14px; font-size: 28px;
                            text-align: center; border: 2px solid #ddd;
                            border-radius: 8px; letter-spacing: 8px;
                            outline: none; box-sizing: border-box;
                        "
                    />
                    <br/><br/>
                    <button 
                        id="otp-submit-btn"
                        style="
                            background: #2563eb; color: white; border: none;
                            padding: 12px 40px; font-size: 16px; border-radius: 8px;
                            cursor: pointer; width: 100%;
                        "
                    >✅ Submit OTP</button>
                    <p id="otp-error" style="color:red; font-size:13px; margin-top:10px; display:none;">
                        ❌ Sirf 6 digit number daalo!
                    </p>
                `;

                overlay.appendChild(box);
                document.body.appendChild(overlay);

                // Input pe focus
                setTimeout(() => {
                    document.getElementById('otp-manual-input').focus();
                }, 100);

                // Submit button click
                document.getElementById('otp-submit-btn').addEventListener('click', () => {
                    const val = document.getElementById('otp-manual-input').value.trim();
                    if (/^\d{6}$/.test(val)) {
                        document.body.removeChild(overlay);
                        resolve(val);
                    } else {
                        document.getElementById('otp-error').style.display = 'block';
                        document.getElementById('otp-manual-input').focus();
                    }
                });

                // Enter key se bhi submit ho
                document.getElementById('otp-manual-input').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        document.getElementById('otp-submit-btn').click();
                    }
                });
            });
        });

        console.log(`🔑 OTP mila: ${otp}`);

        // Step 5: OTP boxes mein ek ek digit fill karo
        const otpInputs = page.locator('input[type="text"][inputmode="numeric"]');
        await expect(otpInputs).toHaveCount(6);

        const digits = otp.split('');
        for (let i = 0; i < 6; i++) {
            await otpInputs.nth(i).fill(digits[i]);
            await page.waitForTimeout(100);
        }

        console.log('✅ OTP fill ho gaya — Verify dabaa raha hoon...');

        // Step 6: Verify & Sign In button dabao
        await page.click('button:has-text("Verify & Sign In")');

        // Step 7: Dashboard redirect ka wait
        await expect(page).toHaveURL(/\/user\/app/, { timeout: 30000 });

        console.log('🎉 LOGIN SUCCESS! Dashboard pe aa gaye.');
    });
});

// ─────────────────────────────────────────────────────────
// TEST: Home → Login Navigation
// ─────────────────────────────────────────────────────────
test.describe('Navigation Checks', () => {

    test('should navigate to login page from home page', async ({ page }) => {
        await page.goto(USER_DASHBOARD_URL, { timeout: 60000 });
        const loginBtn = page.locator('header a:has-text("Login")');
        await expect(loginBtn).toBeVisible({ timeout: 20000 });
        await loginBtn.click();
        await expect(page).toHaveURL(/\/user\/login/, { timeout: 20000 });
    });

    test('should show error for invalid email', async ({ page }) => {
        await page.goto(`${USER_DASHBOARD_URL}/user/login/`, { timeout: 60000 });
        await page.fill('#email-address', 'not-an-email');
        await page.click('button:has-text("Send OTP Code")');
        await expect(
            page.locator('h3:has-text("Enter Secure Code")')
        ).not.toBeVisible({ timeout: 10000 });
    });
});
