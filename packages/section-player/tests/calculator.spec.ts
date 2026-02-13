import { test, expect } from "@playwright/test";

test("calculator functionality", async ({ page }) => {
	const consoleMessages: string[] = [];
	const consoleErrors: string[] = [];

	// Capture console messages
	page.on("console", (msg) => {
		const text = msg.text();
		consoleMessages.push(`[${msg.type()}] ${text}`);
		if (msg.type() === "error") {
			consoleErrors.push(text);
		}
	});

	// Capture page errors
	page.on("pageerror", (error) => {
		consoleErrors.push(`Page error: ${error.message}`);
	});

	console.log("Step 1: Navigating to http://localhost:5300");
	await page.goto("http://localhost:5300", { waitUntil: "networkidle" });

	// Take initial screenshot
	await page.screenshot({
		path: "/Users/eelco.hillenius/dev/prj/pie/pie-players/packages/section-player/tests/screenshots/01-initial-page.png",
		fullPage: true,
	});
	console.log("✓ Screenshot saved: 01-initial-page.png");

	// Wait a bit for the page to fully load
	await page.waitForTimeout(2000);

	console.log("Step 2: Looking for demo with questions");

	// Try to find and click a demo link or button
	// First, let's see what's on the page
	const pageContent = await page.content();

	// Look for demo links or buttons
	const demoLinks = await page.locator("a, button").all();
	console.log(`Found ${demoLinks.length} interactive elements`);

	// Try to find a demo that might have questions
	let demoFound = false;
	for (const link of demoLinks) {
		const text = await link.textContent();
		if (
			text &&
			(text.includes("demo") ||
				text.includes("Demo") ||
				text.includes("question") ||
				text.includes("Question"))
		) {
			console.log(`Found potential demo link: "${text}"`);
			await link.click();
			demoFound = true;
			break;
		}
	}

	// If no specific demo link found, try the first link
	if (!demoFound && demoLinks.length > 0) {
		console.log(
			"No specific demo link found, clicking first available element",
		);
		await demoLinks[0].click();
	}

	await page.waitForTimeout(2000);

	// Take screenshot after selecting demo
	await page.screenshot({
		path: "/Users/eelco.hillenius/dev/prj/pie/pie-players/packages/section-player/tests/screenshots/02-demo-selected.png",
		fullPage: true,
	});
	console.log("✓ Screenshot saved: 02-demo-selected.png");

	console.log("Step 3: Looking for calculator button");

	// Try different selectors for calculator button
	const calculatorSelectors = [
		'button[aria-label*="calculator" i]',
		'button[title*="calculator" i]',
		'button:has-text("calculator")',
		'[class*="calculator"]',
		'button[data-testid*="calculator"]',
		".calculator-button",
		"#calculator-button",
	];

	let calculatorButton = null;
	for (const selector of calculatorSelectors) {
		const button = page.locator(selector).first();
		if ((await button.count()) > 0) {
			console.log(`Found calculator button with selector: ${selector}`);
			calculatorButton = button;
			break;
		}
	}

	// If still not found, try to find any button with calculator icon or text
	if (!calculatorButton) {
		const allButtons = await page.locator("button").all();
		console.log(
			`Searching through ${allButtons.length} buttons for calculator`,
		);

		for (const button of allButtons) {
			const html = await button.innerHTML();
			const ariaLabel = (await button.getAttribute("aria-label")) || "";
			const title = (await button.getAttribute("title")) || "";

			if (
				html.toLowerCase().includes("calculator") ||
				ariaLabel.toLowerCase().includes("calculator") ||
				title.toLowerCase().includes("calculator")
			) {
				console.log("Found calculator button by content/attributes");
				calculatorButton = button;
				break;
			}
		}
	}

	if (!calculatorButton) {
		console.log("Calculator button not found. Available buttons:");
		const allButtons = await page.locator("button").all();
		for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
			const text = await allButtons[i].textContent();
			const ariaLabel = await allButtons[i].getAttribute("aria-label");
			console.log(`  Button ${i}: text="${text}", aria-label="${ariaLabel}"`);
		}
		throw new Error("Calculator button not found");
	}

	// Take screenshot before clicking calculator
	await page.screenshot({
		path: "/Users/eelco.hillenius/dev/prj/pie/pie-players/packages/section-player/tests/screenshots/03-before-calculator.png",
		fullPage: true,
	});
	console.log("✓ Screenshot saved: 03-before-calculator.png");

	console.log("Step 4: Clicking calculator button");
	await calculatorButton.click();

	// Wait for calculator to appear
	await page.waitForTimeout(1500);

	// Take screenshot with calculator open
	await page.screenshot({
		path: "/Users/eelco.hillenius/dev/prj/pie/pie-players/packages/section-player/tests/screenshots/04-calculator-opened.png",
		fullPage: true,
	});
	console.log("✓ Screenshot saved: 04-calculator-opened.png");

	console.log("Step 5: Verifying calculator opened without errors");

	// Check for calculator UI elements
	const calculatorVisible =
		(await page
			.locator('[class*="calculator"], [data-testid*="calculator"]')
			.count()) > 0;
	console.log(`Calculator UI visible: ${calculatorVisible}`);

	// Wait a bit more to catch any delayed errors
	await page.waitForTimeout(2000);

	// Take final screenshot
	await page.screenshot({
		path: "/Users/eelco.hillenius/dev/prj/pie/pie-players/packages/section-player/tests/screenshots/05-final-state.png",
		fullPage: true,
	});
	console.log("✓ Screenshot saved: 05-final-state.png");

	// Print console messages
	console.log("\n=== CONSOLE MESSAGES ===");
	consoleMessages.forEach((msg) => console.log(msg));

	// Print errors
	console.log("\n=== ERRORS ===");
	if (consoleErrors.length === 0) {
		console.log("✓ No errors detected!");
	} else {
		console.log(`✗ Found ${consoleErrors.length} error(s):`);
		consoleErrors.forEach((err) => console.log(`  - ${err}`));
	}

	// Check for specific initialization errors
	const hasInitError = consoleErrors.some(
		(err) =>
			err.includes("Calculator") ||
			err.includes("provider") ||
			err.includes("initialization") ||
			err.includes("undefined"),
	);

	if (hasInitError) {
		console.log("\n✗ Calculator initialization error detected!");
	} else {
		console.log("\n✓ Calculator initialized successfully without errors!");
	}

	// Assertions
	expect(calculatorVisible, "Calculator should be visible").toBe(true);
	expect(
		consoleErrors.filter((err) => err.includes("Calculator")).length,
		"Should not have calculator-related errors",
	).toBe(0);
});
