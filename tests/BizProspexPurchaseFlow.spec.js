const { test, expect } = require('@playwright/test');
const GoogleSheetReporter = require('../reporter/googleSheetReporter');

const sheet = new GoogleSheetReporter();

async function getUserDetailsViaOverlay(page) {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 9999999;
        display: flex; align-items: center; justify-content: center;
      `;
      overlay.innerHTML = `
        <div style="background:white; padding:36px; border-radius:16px;
            text-align:center; font-family:sans-serif; min-width:360px;">
          <div style="font-size:40px;">🧾</div>
          <h2 style="color:#1a1a1a; margin-bottom:6px;">Checkout Details</h2>
          <p style="color:#555; margin-bottom:20px;">Apni details bharo</p>
          <input id="inp-fname" type="text" placeholder="First Name"
            style="width:100%; padding:12px; font-size:16px; border:2px solid #e2e8f0;
            border-radius:10px; outline:none; box-sizing:border-box; margin-bottom:12px;"/>
          <input id="inp-lname" type="text" placeholder="Last Name"
            style="width:100%; padding:12px; font-size:16px; border:2px solid #e2e8f0;
            border-radius:10px; outline:none; box-sizing:border-box; margin-bottom:12px;"/>
          <input id="inp-email" type="email" placeholder="Email Address"
            style="width:100%; padding:12px; font-size:16px; border:2px solid #e2e8f0;
            border-radius:10px; outline:none; box-sizing:border-box; margin-bottom:12px;"/>
          <button id="inp-submit"
            style="background:#2E75B6; color:white; border:none; padding:14px 40px;
            font-size:16px; border-radius:10px; cursor:pointer; width:100%;
            margin-top:4px; font-weight:600;">✅ Submit</button>
          <p id="inp-err" style="color:red; font-size:13px; margin-top:8px; display:none;">
            ❌ Sabhi fields bharna zaroori hai!</p>
        </div>
      `;
      document.body.appendChild(overlay);
      setTimeout(() => document.getElementById('inp-fname').focus(), 100);
      document.getElementById('inp-submit').addEventListener('click', () => {
        const firstName = document.getElementById('inp-fname').value.trim();
        const lastName = document.getElementById('inp-lname').value.trim();
        const email = document.getElementById('inp-email').value.trim();
        if (!firstName || !lastName || !email) {
          document.getElementById('inp-err').style.display = 'block';
          return;
        }
        document.body.removeChild(overlay);
        resolve({ firstName, lastName, email });
      });
    });
  });
}

test('TC_PURCHASEFLOW_001 - BizProspex Full Purchase Flow', async ({ page, browserName }) => {
  const BASE = 'https://bizprospex.aml-pep-data.com';

  // STEP 1: Navigate to /data/
  await page.goto(`${BASE}/data/`);
  await page.waitForLoadState('domcontentloaded');
  await sheet.logResult({ testId: 'TC_PURCHASEFLOW_001', feature: 'BizProspexPurchaseFlow.spec.js', testCase: 'Step 1: Navigate to /data/', browser: browserName, status: 'Pass' });

  // STEP 2: Click random pagination number

  const paginationButtons = page.locator(
    'div.flex.justify-center.items-center button'
  );

  const pages = [];
  const buttons = await paginationButtons.all();

  for (const btn of buttons) {
    const text = (await btn.textContent()).trim();

    // Only numbers (1,2,3,4...)
    if (/^\d+$/.test(text)) {
      pages.push(btn);
    }
  }

  console.log(`📄 Total pagination buttons found: ${pages.length}`);

  if (pages.length > 1) {

    const randomIndex = Math.floor(Math.random() * (pages.length - 1)) + 1;

    const chosenBtn = pages[randomIndex];

    const pageNum = await chosenBtn.textContent();

    console.log(`📄 Clicking page: ${pageNum}`);

    await Promise.all([
      page.waitForLoadState('networkidle'),
      chosenBtn.click()
    ]);

    await sheet.logResult({
      testId: 'TC_PURCHASEFLOW_001',
      feature: 'BizProspexPurchaseFlow.spec.js',
      testCase: `Step 2: Navigate to page ${pageNum}`,
      browser: browserName,
      status: 'Pass'
    });

  } else {

    console.log('⚠️ Only 1 page exists');

    await sheet.logResult({
      testId: 'TC_PURCHASEFLOW_001',
      feature: 'BizProspexPurchaseFlow.spec.js',
      testCase: 'Step 2: Only 1 page, staying on /data/',
      browser: browserName,
      status: 'Pass'
    });
  }

  // STEP 3: Pick random product → click View (with retry for non-purchasable pages)
  await page.waitForLoadState('domcontentloaded');

  let productName = '';
  let foundCart = false;
  const maxRetries = 5;
  const triedIndexes = new Set();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const viewLinks = await page.locator('a:has-text("View")').all();
    console.log(`🔗 View links found: ${viewLinks.length}`);

    if (viewLinks.length === 0) throw new Error('❌ Koi bhi View link nahi mila page pe');

    // Untried indexes mein se pick karo
    const availableIndexes = [...Array(viewLinks.length).keys()].filter(i => !triedIndexes.has(i));

    if (availableIndexes.length === 0) throw new Error('❌ Saare products try ho gaye, koi cart nahi mila');

    const randomIdx = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    triedIndexes.add(randomIdx);

    // Link href store karo PEHLE click se (goBack ke baad fresh locator chahiye)
    const pick = viewLinks[randomIdx];
    const href = await pick.getAttribute('href');
    console.log(`🔗 Attempt ${attempt + 1}: Trying index ${randomIdx} → ${href}`);

    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    productName = (await page.locator('h1').first().textContent()).trim();
    console.log(`✅ Product (attempt ${attempt + 1}): ${productName}`);

    // Check if this page has a cart form
    try {
      await page.waitForSelector('form.cart', { timeout: 5000 });
      foundCart = true;
      console.log('✅ form.cart found, proceeding!');
      break;
    } catch {
      console.log(`⚠️ form.cart nahi mila "${productName}" pe, next product try karta hoon...`);
      await page.goto(page.url().replace(/\/[^/]+\/?$/, '/') + '../data/');
      await page.waitForLoadState('domcontentloaded');
    }
  }

  if (!foundCart) throw new Error('❌ Koi purchasable product nahi mila after retries');

  await sheet.logResult({
    testId: 'TC_PURCHASEFLOW_001',
    feature: 'BizProspexPurchaseFlow.spec.js',
    testCase: `Step 3: View product - ${productName}`,
    browser: browserName,
    status: 'Pass'
  });
  // STEP 4: Handle lead options if present
  // ... baaki code same rehega, aur ab form.cart waitForSelector hata do kyunki upar already check ho gaya
  // STEP 4: Buy Now
  // STEP 4: Handle lead options if present
  const leads = page.locator('input[type="checkbox"]');

  if (await leads.count() > 0) {
    await leads.first().check();
    console.log("✅ Lead option selected");
  }

  // STEP 5: Buy Now

  // Try selecting dropdown if exists
  const dropdown = page.locator('form.cart select');

  if (await dropdown.count() > 0) {
    await dropdown.first().selectOption({ index: 1 });
    console.log("✅ Dropdown option selected");
  }

  // Try checkbox
  const checkbox = page.locator('form.cart input[type="checkbox"]');

  if (await checkbox.count() > 0) {
    await checkbox.first().check();
    console.log("✅ Checkbox selected");
  }

  // Wait for Buy button
  const buyBtn = page.locator('button.single_add_to_cart_button').first();
  await expect(buyBtn).toBeVisible({ timeout: 20000 });

  // Click Buy Now
  await buyBtn.click();

  // Wait for cart page element
  await page.waitForSelector('.woocommerce-cart, .cart_totals', { timeout: 30000 });

  // Ensure cart URL
  await expect(page).toHaveURL(/cart/);

  await sheet.logResult({
    testId: 'TC_PURCHASEFLOW_001',
    feature: 'BizProspexPurchaseFlow.spec.js',
    testCase: 'Step 4: Click Buy Now',
    browser: browserName,
    status: 'Pass'
  });


  // STEP 6: Proceed to Checkout

  const checkoutBtn = page.locator('a.checkout-button, a:has-text("Proceed to checkout")').first();

  await expect(checkoutBtn).toBeVisible({ timeout: 20000 });

  await checkoutBtn.click();

  // Wait for checkout page
  await page.waitForSelector('.woocommerce-checkout', { timeout: 30000 });

  // Ensure checkout URL
  await expect(page).toHaveURL(/checkout/);

  await sheet.logResult({
    testId: 'TC_PURCHASEFLOW_001',
    feature: 'BizProspexPurchaseFlow.spec.js',
    testCase: 'Step 5: Proceed to Checkout',
    browser: browserName,
    status: 'Pass'
  });

  // STEP 6: Overlay → user details
  console.log('📍 Step 6: Browser overlay show ho raha hai...');
  const { firstName, lastName, email } = await getUserDetailsViaOverlay(page);
  console.log(`✅ User details: ${firstName} ${lastName} | ${email}`);

  await page.locator('input#billing_first_name').fill(firstName);
  await page.locator('input#billing_last_name').fill(lastName);
  await page.locator('input#billing_email').fill(email);
  await sheet.logResult({ testId: 'TC_PURCHASEFLOW_001', feature: 'BizProspexPurchaseFlow.spec.js', testCase: `Step 6: Fill form - ${firstName} ${lastName} | ${email}`, browser: browserName, status: 'Pass' });

  // STEP 7: Country = India
  await page.locator('select#billing_country').selectOption({ label: 'India' });
  await page.waitForTimeout(800);
  await sheet.logResult({ testId: 'TC_PURCHASEFLOW_001', feature: 'BizProspexPurchaseFlow.spec.js', testCase: 'Step 7: Select Country = India', browser: browserName, status: 'Pass' });

  // STEP 8: Cash on Delivery
  await page.locator('input#payment_method_cod, input[value="cod"]').first().click({ force: true });
  await sheet.logResult({ testId: 'TC_PURCHASEFLOW_001', feature: 'BizProspexPurchaseFlow.spec.js', testCase: 'Step 8: Select Cash on Delivery', browser: browserName, status: 'Pass' });

  // STEP 9: Accept T&C
  await page.locator('input#terms').check({ force: true });
  await sheet.logResult({ testId: 'TC_PURCHASEFLOW_001', feature: 'BizProspexPurchaseFlow.spec.js', testCase: 'Step 9: Accept Terms and Conditions', browser: browserName, status: 'Pass' });

  // STEP 10: Place Order
  await page.locator('button#place_order').click();
  await page.waitForTimeout(3000);
  await sheet.logResult({ testId: 'TC_PURCHASEFLOW_001', feature: 'BizProspexPurchaseFlow.spec.js', testCase: 'Step 10: Place Order', browser: browserName, status: 'Pass' });
});
