import { test, expect } from "@playwright/test";

test("calculator visibility debug", async ({ page }) => {
	const consoleMessages: string[] = [];
	const consoleErrors: string[] = [];

	// Capture console messages
	page.on("console", (msg) => {
		const text = msg.text();
		consoleMessages.push(`[${msg.type()}] ${text}`);
		if (msg.type() === "error" || msg.type() === "warning") {
			consoleErrors.push(`[${msg.type()}] ${text}`);
		}
	});

	// Capture page errors
	page.on("pageerror", (error) => {
		consoleErrors.push(`Page error: ${error.message}`);
	});

	console.log("=== STEP 1: Navigate to http://localhost:5300 ===");
	await page.goto("http://localhost:5300", { waitUntil: "networkidle" });
	await page.waitForTimeout(2000);

	console.log("\n=== STEP 2: Select a demo ===");
	const demoLinks = await page.locator("a, button").all();
	console.log(`Found ${demoLinks.length} interactive elements`);

	let demoFound = false;
	for (const link of demoLinks) {
		const text = await link.textContent();
		if (
			text &&
			(text.toLowerCase().includes("demo") ||
				text.toLowerCase().includes("question"))
		) {
			console.log(`Clicking: "${text}"`);
			await link.click();
			demoFound = true;
			break;
		}
	}

	if (!demoFound && demoLinks.length > 0) {
		const text = await demoLinks[0].textContent();
		console.log(`Clicking first element: "${text}"`);
		await demoLinks[0].click();
	}

	await page.waitForTimeout(2000);

	console.log("\n=== STEP 3: Find and click calculator button ===");

	const calculatorSelectors = [
		'button[aria-label*="calculator" i]',
		'button[title*="calculator" i]',
		'button:has-text("calculator")',
		'[class*="calculator"]',
		'button[data-testid*="calculator"]',
	];

	let calculatorButton = null;
	for (const selector of calculatorSelectors) {
		const button = page.locator(selector).first();
		if ((await button.count()) > 0) {
			console.log(`Found calculator button: ${selector}`);
			calculatorButton = button;
			break;
		}
	}

	if (!calculatorButton) {
		const allButtons = await page.locator("button").all();
		for (const button of allButtons) {
			const html = await button.innerHTML();
			const ariaLabel = (await button.getAttribute("aria-label")) || "";
			const title = (await button.getAttribute("title")) || "";

			if (
				html.toLowerCase().includes("calculator") ||
				ariaLabel.toLowerCase().includes("calculator") ||
				title.toLowerCase().includes("calculator")
			) {
				calculatorButton = button;
				break;
			}
		}
	}

	if (!calculatorButton) {
		throw new Error("Calculator button not found");
	}

	await calculatorButton.click();
	await page.waitForTimeout(1500);

	console.log("\n=== STEP 4: Check pie-tool-calculator element ===");

	// Check if element exists in DOM
	const calculatorElement = page.locator("pie-tool-calculator");
	const elementCount = await calculatorElement.count();
	console.log(`pie-tool-calculator elements found: ${elementCount}`);

	if (elementCount > 0) {
		// Get visible attribute
		const visibleAttr = await calculatorElement.getAttribute("visible");
		console.log(`visible attribute: ${visibleAttr}`);

		// Check if element is actually visible
		const isVisible = await calculatorElement.isVisible();
		console.log(`isVisible(): ${isVisible}`);

		// Get element HTML
		const html = await calculatorElement.innerHTML();
		console.log(`innerHTML length: ${html.length} characters`);
		console.log(`innerHTML preview: ${html.substring(0, 200)}...`);
	} else {
		console.log("⚠️  pie-tool-calculator element not found in DOM!");
	}

	console.log("\n=== STEP 5: Check console errors and warnings ===");
	if (consoleErrors.length === 0) {
		console.log("✓ No errors or warnings");
	} else {
		console.log(`Found ${consoleErrors.length} issues:`);
		consoleErrors.forEach((err) => console.log(`  ${err}`));
	}

	console.log("\n=== STEP 6: Evaluate calculator element styles ===");

	const debugInfo = await page.evaluate(() => {
		const calc = document.querySelector("pie-tool-calculator");
		if (!calc) {
			return { exists: false };
		}

		const computed = window.getComputedStyle(calc);
		const rect = calc.getBoundingClientRect();

		return {
			exists: true,
			visible: calc.getAttribute("visible"),
			display: computed.display,
			visibility: computed.visibility,
			opacity: computed.opacity,
			position: computed.position,
			zIndex: computed.zIndex,
			width: computed.width,
			height: computed.height,
			top: computed.top,
			left: computed.left,
			transform: computed.transform,
			pointerEvents: computed.pointerEvents,
			overflow: computed.overflow,
			rect: {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
				top: rect.top,
				left: rect.left,
				bottom: rect.bottom,
				right: rect.right,
			},
			classList: Array.from(calc.classList),
			hasChildren: calc.children.length > 0,
			childrenCount: calc.children.length,
			innerHTML: calc.innerHTML.substring(0, 500),
		};
	});

	console.log("DOM element evaluation:");
	console.log(JSON.stringify(debugInfo, null, 2));

	console.log("\n=== STEP 7: Check shadow DOM ===");

	const shadowInfo = await page.evaluate(() => {
		const calc = document.querySelector("pie-tool-calculator");
		if (!calc) {
			return { exists: false };
		}

		if (calc.shadowRoot) {
			const shadowContent = calc.shadowRoot.innerHTML;
			return {
				hasShadowRoot: true,
				shadowContentLength: shadowContent.length,
				shadowContentPreview: shadowContent.substring(0, 500),
			};
		}

		return { hasShadowRoot: false };
	});

	console.log("Shadow DOM info:");
	console.log(JSON.stringify(shadowInfo, null, 2));

	console.log("\n=== STEP 8: Check all tool elements ===");

	const allTools = await page.evaluate(() => {
		const tools = document.querySelectorAll(
			'[class*="tool"], [data-testid*="tool"]',
		);
		return Array.from(tools).map((tool) => ({
			tagName: tool.tagName,
			className: tool.className,
			id: tool.id,
			visible: tool.getAttribute("visible"),
			display: window.getComputedStyle(tool).display,
		}));
	});

	console.log("All tool elements:");
	console.log(JSON.stringify(allTools, null, 2));

	// Take final screenshot
	await page.screenshot({
		path: "/Users/eelco.hillenius/dev/prj/pie/pie-players/packages/section-player/tests/screenshots/debug-calculator.png",
		fullPage: true,
	});
	console.log("\n✓ Screenshot saved: debug-calculator.png");

	console.log("\n=== SUMMARY ===");
	console.log(`Calculator element exists: ${debugInfo.exists}`);
	if (debugInfo.exists) {
		console.log(`Visible attribute: ${debugInfo.visible}`);
		console.log(`Display: ${debugInfo.display}`);
		console.log(`Visibility: ${debugInfo.visibility}`);
		console.log(`Opacity: ${debugInfo.opacity}`);
		console.log(`Position: ${debugInfo.position}`);
		console.log(`Dimensions: ${debugInfo.width} x ${debugInfo.height}`);
		console.log(`BoundingRect: ${JSON.stringify(debugInfo.rect)}`);
	}
});
