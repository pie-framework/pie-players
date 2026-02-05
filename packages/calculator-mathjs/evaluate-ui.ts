import { chromium } from "playwright";

async function evaluateCalculator() {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 1280, height: 720 },
	});
	const page = await context.newPage();

	console.log("📸 Capturing calculator screenshots...\n");

	// Navigate to the demo
	await page.goto("http://localhost:3000");
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(1000); // Let any animations settle

	// 1. Scientific calculator - Light theme
	console.log("1. Scientific Calculator - Light Theme");
	await page.screenshot({
		path: "screenshots/scientific-light.png",
		fullPage: true,
	});

	// 2. Scientific calculator - Dark theme
	console.log("2. Scientific Calculator - Dark Theme");
	const darkButton = page.locator("button").filter({ hasText: "Dark" });
	await darkButton.click();
	await page.waitForTimeout(500);
	await page.screenshot({
		path: "screenshots/scientific-dark.png",
		fullPage: true,
	});

	// 3. Basic calculator - Light theme
	console.log("3. Basic Calculator - Light Theme");
	const lightButton = page.locator("button").filter({ hasText: "Light" });
	await lightButton.click();
	await page.waitForTimeout(500);

	const basicButton = page.locator("button").filter({ hasText: "Basic" });
	await basicButton.click();
	await page.waitForTimeout(500);
	await page.screenshot({
		path: "screenshots/basic-light.png",
		fullPage: true,
	});

	// 4. Basic calculator - Dark theme
	console.log("4. Basic Calculator - Dark Theme");
	await darkButton.click();
	await page.waitForTimeout(500);
	await page.screenshot({
		path: "screenshots/basic-dark.png",
		fullPage: true,
	});

	// 5. Test actual math calculations
	console.log("5. Testing Calculator Math Functions\n");
	await lightButton.click();
	await page.waitForTimeout(500);

	const scientificButton = page
		.locator("button")
		.filter({ hasText: "Scientific" });
	await scientificButton.click();
	await page.waitForTimeout(500);

	// Helper function to test a calculation
	async function testCalculation(
		expression: string,
		expectedPattern: RegExp | string,
		description: string,
	) {
		await page.keyboard.press("Escape"); // Clear
		await page.waitForTimeout(200);

		await page.keyboard.type(expression);
		await page.waitForTimeout(200);

		await page.keyboard.press("Enter");
		await page.waitForTimeout(300);

		const result = await page.inputValue('input[type="text"]');
		const matches =
			typeof expectedPattern === "string"
				? result === expectedPattern
				: expectedPattern.test(result);

		console.log(`  ${matches ? "✓" : "✗"} ${description}`);
		console.log(`    Expression: ${expression}`);
		console.log(`    Result: ${result}`);
		console.log(`    Expected: ${expectedPattern}\n`);

		return matches;
	}

	// Test basic arithmetic
	await testCalculation("2+2", "4", "Basic Addition");
	await testCalculation("10-3", "7", "Basic Subtraction");
	await testCalculation("6*7", "42", "Basic Multiplication");
	await testCalculation("15/3", "5", "Basic Division");
	await testCalculation("2+3*4", "14", "Order of Operations");
	await testCalculation("(2+3)*4", "20", "Parentheses");

	// Test scientific functions
	await testCalculation("sin(0)", "0", "Sin(0)");
	await testCalculation("cos(0)", "1", "Cos(0)");
	await testCalculation("sqrt(16)", "4", "Square Root");
	await testCalculation("2^3", "8", "Exponentiation");
	await testCalculation("log(100)", "2", "Log Base 10");

	// Test decimal calculations
	await testCalculation("0.1+0.2", /0\.3/, "Decimal Addition");
	await testCalculation("1.5*2", "3", "Decimal Multiplication");

	// Test negative numbers
	await testCalculation("-5+3", "-2", "Negative Numbers");
	await testCalculation("10*-2", "-20", "Negative Multiplication");

	// Screenshot with a calculation
	await page.keyboard.press("Escape");
	await page.waitForTimeout(200);
	await page.keyboard.type("sin(45)+10");
	await page.screenshot({
		path: "screenshots/scientific-with-expression.png",
		fullPage: true,
	});

	await page.keyboard.press("Enter");
	await page.waitForTimeout(300);
	await page.screenshot({
		path: "screenshots/scientific-with-result.png",
		fullPage: true,
	});

	// 6. Test button focus states
	console.log("6. Focus States Test");
	await page.keyboard.press("Escape"); // Clear
	await page.waitForTimeout(300);

	// Tab to calculator and test focus
	await page.keyboard.press("Tab");
	await page.waitForTimeout(300);
	await page.screenshot({
		path: "screenshots/focus-state.png",
		fullPage: true,
	});

	// 7. Analyze color contrast
	console.log("\n📊 Analyzing UI Metrics...\n");

	const metrics = await page.evaluate(() => {
		const calculator = document.querySelector("[data-theme]") as HTMLElement;
		const buttons = Array.from(document.querySelectorAll("button"));

		// Get computed styles
		const calcButtons = buttons.filter(
			(b) => b.textContent && /^[0-9+\-×÷=AC]$/.test(b.textContent.trim()),
		);

		const buttonSizes = calcButtons.slice(0, 5).map((btn) => {
			const rect = btn.getBoundingClientRect();
			return {
				width: rect.width,
				height: rect.height,
				text: btn.textContent?.trim(),
			};
		});

		// Get display styling
		const display = document.querySelector(
			"input[readonly]",
		) as HTMLInputElement;
		const displayStyle = display ? window.getComputedStyle(display) : null;

		// Get calculator dimensions
		const calcRect = calculator?.getBoundingClientRect();

		return {
			buttonSizes,
			displayFontSize: displayStyle?.fontSize,
			displayFontWeight: displayStyle?.fontWeight,
			calculatorWidth: calcRect?.width,
			calculatorHeight: calcRect?.height,
			totalButtons: buttons.length,
		};
	});

	console.log("Button Sizes (first 5 number buttons):");
	metrics.buttonSizes.forEach((btn: any) => {
		console.log(
			`  ${btn.text}: ${btn.width.toFixed(1)}px × ${btn.height.toFixed(1)}px`,
		);
	});
	console.log(
		`\nDisplay Font: ${metrics.displayFontSize} (weight: ${metrics.displayFontWeight})`,
	);
	console.log(
		`Calculator Size: ${metrics.calculatorWidth?.toFixed(0)}px × ${metrics.calculatorHeight?.toFixed(0)}px`,
	);
	console.log(`Total Buttons: ${metrics.totalButtons}`);

	// 8. Check accessibility features
	console.log("\n♿ Accessibility Checks...\n");

	const a11y = await page.evaluate(() => {
		const buttons = Array.from(document.querySelectorAll("button"));
		const calcButtons = buttons.filter(
			(b) => b.closest('[role="grid"]') || b.getAttribute("aria-label"),
		);

		const hasAriaLabels = calcButtons.filter((b) =>
			b.getAttribute("aria-label"),
		).length;
		const hasRoleGrid = document.querySelector('[role="grid"]') !== null;
		const hasLiveRegion = document.querySelector("[aria-live]") !== null;

		return {
			buttonsWithAriaLabels: hasAriaLabels,
			totalCalculatorButtons: calcButtons.length,
			hasRoleGrid,
			hasLiveRegion,
		};
	});

	console.log(
		`ARIA Labels: ${a11y.buttonsWithAriaLabels}/${a11y.totalCalculatorButtons} buttons`,
	);
	console.log(`ARIA Grid Pattern: ${a11y.hasRoleGrid ? "✓" : "✗"}`);
	console.log(`Live Regions: ${a11y.hasLiveRegion ? "✓" : "✗"}`);

	console.log("\n✅ Screenshots saved to screenshots/ directory");
	console.log("\nUI Evaluation Complete!\n");

	await browser.close();
}

evaluateCalculator().catch(console.error);
