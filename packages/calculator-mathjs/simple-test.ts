import { chromium } from 'playwright';

async function simpleTest() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Test cos(0)
  console.log('\n=== Testing cos(0) ===');

  await page.click('input[type="text"]');
  await page.keyboard.type('cos(0)');
  await page.waitForTimeout(300);

  const before = await page.inputValue('input[type="text"]');
  console.log('Before Enter:', before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  const after = await page.inputValue('input[type="text"]');
  console.log('After Enter:', after);
  console.log('Expected: 1');

  await browser.close();
}

simpleTest().catch(console.error);
