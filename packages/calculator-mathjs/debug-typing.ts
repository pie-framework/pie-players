import { chromium } from 'playwright';

async function debugTyping() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Focus the input
  await page.click('input[type="text"]');
  await page.waitForTimeout(500);

  // Type slowly and log each character
  const text = 'sin(45)';
  console.log(`Typing: ${text}`);

  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(200);
    const value = await page.inputValue('input[type="text"]');
    console.log(`  Typed '${char}' -> Input value: "${value}"`);
  }

  await page.waitForTimeout(2000);
  await browser.close();
}

debugTyping().catch(console.error);
