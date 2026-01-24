import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { load as loadYaml } from "js-yaml";

type ExpectMatcher =
	| { equals: string | number | boolean }
	| { contains: string }
	| { containsAny: string[] }
	| { containsAll: string[] }
	| { equalsOrdered: string[] }
	| { notEqualsOrdered: string[] }
	| { lengthGte: number }
	| { isNullOrEmpty: boolean }
	| { gte: number }
	| { exists: boolean }
	| { valueContains: string }
	| { maxViolations: number }
	| { range: [number, number] }
	| { greaterThan: number }
	| { greaterThanOrEqual: number }
	| { lessThan: number }
	| { lessThanOrEqual: number }
	| { notEquals: string | number | boolean }
	| { notContains: string }
	| { in: Array<string | number | boolean> };

type EvalTarget = {
	testId?: string;
};

type EvalStep =
	| { action: "navigate"; path: string }
	| { action: "click"; target: EvalTarget }
	| { action: "type"; target: EvalTarget; value: string }
	| { action: "select"; target: EvalTarget; value: string }
	| { action: "observe"; target: EvalTarget; expect: ExpectMatcher }
	| {
			action: "dispatchEvent";
			target: EvalTarget;
			eventType: string;
			detail?: any;
	  }
	| {
			action: "axe";
			scope: { includeTestId: string };
			expect: { maxViolations: number };
	  };

type EvalCase = {
	id: string;
	sampleId?: string;
	gradeBand?: string;
	subject?: string;
	severity?: "error" | "warn";
	intent?: string;
	notes?: string[];
	steps: EvalStep[];
	spiritChecks?: string[];
	// Legacy support during migration
	spirit_checks?: string[];
};

type EvalFile = {
	version: number;
	component?: { area?: string; underTest?: string };
	examplesApp?: { app?: string; routeTemplate?: string };
	evals: EvalCase[];
};

function listFilesRecursive(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listFilesRecursive(full));
		else out.push(full);
	}
	return out;
}

function readEvalFiles(): Array<{ filePath: string; data: EvalFile }> {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	// This file lives at: apps/example/tests/evals/*
	// Repo root is 4 levels up from here.
	const repoRoot = path.resolve(__dirname, "../../../../");
	const evalRoot = path.join(repoRoot, "docs/evals");

	const candidates = listFilesRecursive(evalRoot)
		.filter((p) => p.endsWith("evals.yaml"))
		.sort((a, b) => a.localeCompare(b));
	return candidates.map((filePath) => {
		const raw = fs.readFileSync(filePath, "utf8");
		const data = loadYaml(raw) as EvalFile;
		return { filePath, data };
	});
}

function getByTestId(page: Page, testId: string) {
	return page.locator(`[data-testid="${testId}"]`);
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function runObserve(
	page: Page,
	target: EvalTarget,
	matcher: ExpectMatcher,
) {
	if (!target.testId) throw new Error("observe requires target.testId");
	const loc = getByTestId(page, target.testId);
	const DEFAULT_TIMEOUT = 15_000;

	if ("exists" in matcher) {
		if (matcher.exists) {
			await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		} else {
			await expect(loc).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
		}
		return;
	}

	if ("valueContains" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		// Wait until the value contains substring.
		await expect(loc).toHaveValue(
			new RegExp(escapeRegExp(matcher.valueContains)),
			{ timeout: DEFAULT_TIMEOUT },
		);
		return;
	}

	if ("equals" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect(loc).toHaveText(String(matcher.equals), {
			timeout: DEFAULT_TIMEOUT,
		});
		return;
	}
	if ("contains" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect(loc).toContainText(matcher.contains, {
			timeout: DEFAULT_TIMEOUT,
		});
		return;
	}
	if ("containsAny" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					return matcher.containsAny.some((s) => text.includes(s));
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("containsAll" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					return matcher.containsAll.every((s) => text.includes(s));
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("equalsOrdered" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					try {
						const parsed = JSON.parse(text);
						return (
							Array.isArray(parsed) &&
							JSON.stringify(parsed) === JSON.stringify(matcher.equalsOrdered)
						);
					} catch {
						return false;
					}
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("notEqualsOrdered" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					try {
						const parsed = JSON.parse(text);
						return (
							!Array.isArray(parsed) ||
							JSON.stringify(parsed) !==
								JSON.stringify(matcher.notEqualsOrdered)
						);
					} catch {
						return true;
					}
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("lengthGte" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					try {
						const parsed = JSON.parse(text);
						if (Array.isArray(parsed)) {
							return parsed.length >= matcher.lengthGte;
						}
					} catch {
						// If not JSON, treat as string length
						return text.length >= matcher.lengthGte;
					}
					return false;
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("isNullOrEmpty" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					if (matcher.isNullOrEmpty) {
						// Check if empty
						if (text === "" || text === "null" || text === "undefined") {
							return true;
						}
						try {
							const parsed = JSON.parse(text);
							return (
								parsed === null ||
								parsed === undefined ||
								(Array.isArray(parsed) && parsed.length === 0)
							);
						} catch {
							return false;
						}
					}
					// Check if NOT empty
					if (text === "" || text === "null" || text === "undefined") {
						return false;
					}
					try {
						const parsed = JSON.parse(text);
						return !(
							parsed === null ||
							parsed === undefined ||
							(Array.isArray(parsed) && parsed.length === 0)
						);
					} catch {
						return true;
					}
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("gte" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					const num = Number.parseFloat(text);
					return !Number.isNaN(num) && num >= matcher.gte;
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("notEquals" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					return text !== String(matcher.notEquals);
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("notContains" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					return !text.includes(matcher.notContains);
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("in" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					return matcher.in.some((val) => text === String(val));
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	// Numeric matchers (require numeric text content)
	if ("range" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					const num = Number.parseFloat(text);
					if (Number.isNaN(num)) return false;
					return num >= matcher.range[0] && num <= matcher.range[1];
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("greaterThan" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					const num = Number.parseFloat(text);
					return !Number.isNaN(num) && num > matcher.greaterThan;
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("greaterThanOrEqual" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					const num = Number.parseFloat(text);
					return !Number.isNaN(num) && num >= matcher.greaterThanOrEqual;
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("lessThan" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					const num = Number.parseFloat(text);
					return !Number.isNaN(num) && num < matcher.lessThan;
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	if ("lessThanOrEqual" in matcher) {
		await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
		await expect
			.poll(
				async () => {
					const text = (await loc.innerText().catch(() => "")).trim();
					const num = Number.parseFloat(text);
					return !Number.isNaN(num) && num <= matcher.lessThanOrEqual;
				},
				{ timeout: DEFAULT_TIMEOUT },
			)
			.toBe(true);
		return;
	}

	throw new Error("Unsupported observe matcher");
}

async function dispatchOnPieItemRoot(
	page: Page,
	hostTestId: string,
	eventType: string,
	detail: any,
) {
	await page.evaluate(
		({ hostTestId, eventType, detail }) => {
			const host = document.querySelector(
				`[data-testid="${hostTestId}"]`,
			) as HTMLElement | null;
			if (!host) throw new Error(`Missing host [data-testid="${hostTestId}"]`);
			// Prefer dispatching on the internal PieItemPlayer root when present.
			// Fall back to dispatching on the host element itself (useful when bundles didn’t load yet).
			const root =
				(host.querySelector(".pie-item-player") as HTMLElement | null) ?? host;

			root.dispatchEvent(
				new CustomEvent(eventType, { detail, bubbles: true, composed: true }),
			);
		},
		{ hostTestId, eventType, detail },
	);
}

async function runStep(page: Page, step: EvalStep): Promise<void> {
	switch (step.action) {
		case "navigate":
			// NOTE: With ESM loading (import maps + dynamic imports), "networkidle" can be
			// unreliable (long-running/streaming requests). We rely on subsequent observe
			// steps to assert readiness instead.
			await page.goto(step.path, { waitUntil: "domcontentloaded" });
			return;
		case "click":
			if (!step.target.testId) throw new Error("click requires target.testId");
			await getByTestId(page, step.target.testId).click();
			return;
		case "type":
			if (!step.target.testId) throw new Error("type requires target.testId");
			await getByTestId(page, step.target.testId).fill(step.value);
			return;
		case "select":
			if (!step.target.testId) throw new Error("select requires target.testId");
			await getByTestId(page, step.target.testId).selectOption(step.value);
			return;
		case "observe":
			await runObserve(page, step.target, step.expect);
			return;
		case "dispatchEvent":
			if (!step.target.testId)
				throw new Error("dispatchEvent requires target.testId");
			await dispatchOnPieItemRoot(
				page,
				step.target.testId,
				step.eventType,
				step.detail ?? null,
			);
			return;
		case "axe": {
			const root = `[data-testid="${step.scope.includeTestId}"]`;
			const results = await new AxeBuilder({ page })
				.include(root)
				.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
				.analyze();
			const max = step.expect.maxViolations;
			if (results.violations.length > max) {
				throw new Error(
					`axe violations (${results.violations.length}) > maxViolations (${max})`,
				);
			}
			return;
		}
		default:
			throw new Error(`Unknown action ${(step as any).action}`);
	}
}

/**
 * Spirit Checker - validates semantic and tone quality beyond technical correctness.
 * Inspired by BarbellBee's SpiritChecker for validating user-facing content.
 */
async function validateSpiritChecks(
	page: Page,
	checks: string[],
): Promise<string[]> {
	const failures: string[] = [];

	for (const check of checks) {
		const passed = await evaluateSpiritCheck(page, check);
		if (!passed) {
			failures.push(check);
		}
	}

	return failures;
}

async function evaluateSpiritCheck(
	page: Page,
	check: string,
): Promise<boolean> {
	// Extract quoted phrases (exact matches required)
	const quotedPhrases = extractQuotedPhrases(check);

	// Extract concept keywords
	const concepts = extractConcepts(check);

	// Get all visible text from the page
	const pageText = await page.textContent("body");
	if (!pageText) return false;

	const textLower = pageText.toLowerCase();
	const checkLower = check.toLowerCase();

	// Check for quoted phrases (must be present)
	for (const phrase of quotedPhrases) {
		if (!textLower.includes(phrase.toLowerCase())) {
			return false;
		}
	}

	// Semantic pattern matching
	if (checkLower.includes("avoids") || checkLower.includes("no ")) {
		// Negative check: ensure certain words are NOT present
		const forbiddenWords = extractForbiddenWords(check);
		for (const word of forbiddenWords) {
			if (textLower.includes(word.toLowerCase())) {
				return false;
			}
		}
	}

	if (checkLower.includes("suggests") || checkLower.includes("mentions")) {
		// Positive check: ensure guidance/information is present
		// Already handled by quoted phrases or general concept matching
	}

	if (
		checkLower.includes("tone is") ||
		checkLower.includes("is supportive") ||
		checkLower.includes("is encouraging")
	) {
		// Tone validation: look for positive sentiment words
		const positiveWords = [
			"great",
			"good",
			"excellent",
			"progress",
			"success",
			"helpful",
			"clear",
		];
		const hasPositive = positiveWords.some((word) => textLower.includes(word));
		if (!hasPositive && quotedPhrases.length === 0) {
			return false;
		}
	}

	if (checkLower.includes("user understands")) {
		// Check for explanatory language
		const explanatoryPatterns = [
			"because",
			"since",
			"this means",
			"indicates",
			"shows",
		];
		const hasExplanation = explanatoryPatterns.some((pattern) =>
			textLower.includes(pattern),
		);
		if (!hasExplanation && quotedPhrases.length === 0) {
			return false;
		}
	}

	// If we have quoted phrases and they all matched, that's sufficient
	if (quotedPhrases.length > 0) {
		return true;
	}

	// If we have concept keywords, check if any are present
	if (concepts.length > 0) {
		return concepts.some((concept) =>
			textLower.includes(concept.toLowerCase()),
		);
	}

	// Default: if no specific patterns matched but no failures, consider it passed
	return true;
}

function extractQuotedPhrases(check: string): string[] {
	const phrases: string[] = [];
	// Match both single and double quoted strings
	const regex = /(['"])(.*?)\1/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(check)) !== null) {
		phrases.push(match[2]);
	}
	return phrases;
}

function extractConcepts(check: string): string[] {
	// Extract key concept words from unquoted parts
	const withoutQuotes = check.replace(/(['"])(.*?)\1/g, "");
	const words = withoutQuotes
		.toLowerCase()
		.split(/\s+/)
		.filter(
			(w) =>
				w.length > 4 &&
				![
					"should",
					"would",
					"could",
					"about",
					"their",
					"which",
					"where",
					"there",
				].includes(w),
		);
	return words;
}

function extractForbiddenWords(check: string): string[] {
	const forbidden: string[] = [];

	// Look for patterns like "no 'word'" or "avoids 'word'"
	const patterns = [
		/no ['"]([^'"]+)['"]/gi,
		/avoids? ['"]([^'"]+)['"]/gi,
		/not ['"]([^'"]+)['"]/gi,
		/without ['"]([^'"]+)['"]/gi,
	];

	for (const pattern of patterns) {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(check)) !== null) {
			forbidden.push(match[1]);
		}
	}

	return forbidden;
}

function handleEvalFailure(
	testInfo: TestInfo,
	evalId: string,
	severity: "error" | "warn",
	err: unknown,
) {
	const message = err instanceof Error ? err.message : String(err);
	if (severity === "warn") {
		// Local-only: keep the test green, but surface signal in output.
		testInfo.annotations.push({ type: "warning", description: message });
		console.warn(`[eval warn] ${evalId}: ${message}`);
		return;
	}
	throw err;
}

const evalFiles = readEvalFiles();

test.describe("docs/evals (YAML-driven, local-only)", () => {
	for (const { filePath, data } of evalFiles) {
		test.describe(path.relative(process.cwd(), filePath), () => {
			for (const c of data.evals) {
				test(c.id, async ({ page }, testInfo) => {
					const severity: "error" | "warn" = c.severity ?? "error";
					try {
						// Run all test steps
						for (const step of c.steps) {
							await runStep(page, step);
						}

						// Run spirit checks if present (support both camelCase and snake_case)
						const spiritChecks = c.spiritChecks || c.spirit_checks;
						if (spiritChecks && spiritChecks.length > 0) {
							const failures = await validateSpiritChecks(page, spiritChecks);
							if (failures.length > 0) {
								const failedChecks = failures.map((f) => `  - ${f}`).join("\n");
								throw new Error(`Spirit check failures:\n${failedChecks}`);
							}
						}
					} catch (err) {
						handleEvalFailure(testInfo, c.id, severity, err);
					}
				});
			}
		});
	}
});
