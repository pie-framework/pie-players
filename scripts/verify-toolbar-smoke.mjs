#!/usr/bin/env node

import { chromium } from "playwright";

const URL =
	process.env.TOOLBAR_SMOKE_URL ||
	"http://localhost:5300/demo/question-passage?player=iife&layout=split-panel&mode=candidate&esmSource=remote";

const mustNotContain = [
	"Failed to resolve module specifier",
	"Cannot find module",
	"Uncaught (in promise) TypeError",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
	if (msg.type() === "error") {
		consoleErrors.push(msg.text());
	}
});

const pageErrors = [];
page.on("pageerror", (err) => {
	pageErrors.push(String(err));
});

try {
	await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });

	// Wait until at least one item toolbar appears.
	await page.waitForSelector("pie-item-toolbar", { timeout: 30000 });

	// Check core toolbar presence.
	const itemToolbarCount = await page.locator("pie-item-toolbar").count();
	const sectionToolbarCount = await page.locator("pie-section-toolbar").count();
	if (itemToolbarCount < 1) {
		throw new Error("No item toolbars rendered.");
	}
	if (sectionToolbarCount < 1) {
		throw new Error("No section toolbar rendered.");
	}

	// Check section toolbar buttons.
	await page
		.locator("pie-section-toolbar")
		.first()
		.waitFor({ timeout: 45000 });
	const sectionButtons = page.locator(
		"pie-section-toolbar .tool-button, pie-section-toolbar .item-toolbar__button",
	);
	await sectionButtons.first().waitFor({ timeout: 45000 });
	const sectionButtonCount = await sectionButtons.count();
	if (sectionButtonCount < 1) {
		throw new Error("No section toolbar buttons rendered.");
	}

	// Attempt question-level click paths for known controls if present.
	const calcInline = page.locator("pie-tool-calculator-inline");
	if ((await calcInline.count()) > 0) {
		await calcInline.first().click({ force: true });
		await page.waitForTimeout(300);
	}

	const ttsInline = page.locator("pie-tool-tts-inline");
	if ((await ttsInline.count()) > 0) {
		await ttsInline.first().click({ force: true });
		await page.waitForTimeout(300);
	}

	const answerElimButton = page.locator(
		"pie-item-toolbar .item-toolbar__button[aria-label='Answer Eliminator']",
	);
	if ((await answerElimButton.count()) > 0) {
		await answerElimButton.first().click({ force: true });
		await page.waitForTimeout(300);
	}

	const allRuntimeErrors = [...consoleErrors, ...pageErrors];
	const badErrors = allRuntimeErrors.filter((entry) =>
		mustNotContain.some((needle) => entry.includes(needle)),
	);

	if (badErrors.length > 0) {
		throw new Error(
			`Runtime import/tool errors detected:\n${badErrors.join("\n")}`,
		);
	}

	console.log("Toolbar smoke check passed.");
	console.log(`- item toolbars: ${itemToolbarCount}`);
	console.log(`- section toolbars: ${sectionToolbarCount}`);
	console.log(`- section buttons: ${sectionButtonCount}`);
} finally {
	await browser.close();
}

