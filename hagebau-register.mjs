import {chromium} from 'playwright';

const EMAIL = 'guenther88@agentmail.to';
const PASSWORD = 'hb#Jungle68';

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled']
});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});

// Intercept CAPTCHA
page.route('**/*captcha*', route => route.continue());
page.route('**/*friendly*', route => route.continue());

await page.goto('https://www.hagebau.de/registrierung/', {waitUntil: 'networkidle', timeout: 15000});
console.log('Page loaded');

// Accept cookies
try {
  const rejectBtn = page.locator('button:has-text("Nicht notwendige Cookies ablehnen"), button:has-text("Alle ablehnen")');
  if (await rejectBtn.isVisible({timeout: 2000})) {
    await rejectBtn.click();
    console.log('Cookies rejected');
  }
} catch(e) { /* ignore */ }

await page.waitForTimeout(1500);

// Click "Herr"
await page.getByRole('radio', {name: 'Herr'}).click();
console.log('Herr clicked');

// Fill firstName
await page.locator('#firstName').click();
await page.locator('#firstName').fill('Bastian');
console.log('firstName filled');

// Fill lastName - use the correct selector
await page.locator('#lastName').click();
await page.locator('#lastName').fill('Lewin');
console.log('lastName filled');

// Fill email
await page.locator('#email').click();
await page.locator('#email').fill(EMAIL);
console.log('email filled');

// Fill emailRepeat
await page.locator('#emailRepeat').click();
await page.locator('#emailRepeat').fill(EMAIL);
console.log('emailRepeat filled');

// Fill password
await page.locator('#password').click();
await page.locator('#password').fill(PASSWORD);
console.log('password filled');

// Check newsletter checkbox
const newsletterCheckbox = page.locator('label').filter({hasText: /10 € Willkommensgutschein/}).locator('input[type=checkbox]');
await newsletterCheckbox.click({force: true});
console.log('Newsletter checked');

await page.waitForTimeout(1000);

// Take screenshot for verification
await page.screenshot({path: '/tmp/hagebau-filled.png', fullPage: true});
console.log('Screenshot saved');

// Click submit
await page.getByRole('button', {name: 'REGISTRIEREN'}).click();
console.log('Submit clicked');

await page.waitForTimeout(3000);

// Take screenshot of result
await page.screenshot({path: '/tmp/hagebau-result.png', fullPage: true});
console.log('Result screenshot saved');

await page.close();
await browser.close();