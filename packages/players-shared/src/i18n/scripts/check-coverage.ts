#!/usr/bin/env bun
/**
 * Translation coverage checker.
 *
 * Two tiers, because they answer different questions. A **complete** locale must
 * carry every key the English catalog defines; a missing one is a build failure.
 * A **carried** locale is reported and never gates: its gaps resolve to English
 * through the provider's fallback chain, which is a working state, and gating on
 * it would only pressure someone into committing unreviewed translation.
 *
 * The English catalog's shape also generates `MessageKey`, so a mistyped key at a
 * call site is already a compile error. This script answers the other half —
 * whether a locale is missing a key it should have, carries one English no longer
 * defines, or left a value byte-identical to English.
 *
 * Usage:
 *   bun run check-i18n
 *   bun run check-i18n -- --locale nl-NL
 *
 * Exit codes:
 *   0 — every complete locale is at 100%
 *   1 — a complete locale has gaps, or any locale carries a stale key
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED_LOCALES } from "../catalogs.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MESSAGES = resolve(HERE, "../messages");

const REFERENCE_LOCALE = "en-US";

/**
 * Locales carried at partial coverage. Reported, never gating.
 *
 * Empty by design. The tier exists for a locale mid-translation — a batch lands,
 * the tag sits here while review catches up, and the gaps resolve to English
 * meanwhile. It is not a home for a catalog nobody is translating: the four
 * pre-adoption locales sat at nominal 100% against a reference harvested from a
 * design rather than from call sites, so the number certified nothing.
 */
const CARRIED_LOCALES: string[] = [];

/**
 * Locales that must be complete: everything the loader map ships, minus the
 * reference and minus the carried tier.
 *
 * Derived rather than listed, so adding a catalog to `catalogs.ts` cannot leave
 * it unmeasured. Moving a tag out of `CARRIED_LOCALES` is the last step of
 * translating it; the check then keeps it complete.
 */
const COMPLETE_LOCALES = BUNDLED_LOCALES.filter(
	(locale) => locale !== REFERENCE_LOCALE && !CARRIED_LOCALES.includes(locale),
);

const PLURAL_CATEGORIES = new Set([
	"zero",
	"one",
	"two",
	"few",
	"many",
	"other",
]);

type Node = string | { [key: string]: Node };

interface Coverage {
	locale: string;
	tier: "complete" | "carried";
	total: number;
	translated: number;
	missing: string[];
	stale: string[];
	identical: string[];
}

function isPluralGroup(node: Node): boolean {
	if (typeof node !== "object") return false;
	const keys = Object.keys(node);
	return keys.length > 0 && keys.every((key) => PLURAL_CATEGORIES.has(key));
}

/**
 * Flatten a catalog to dot-notation leaves.
 *
 * A plural group is one leaf, matching how `MessageKey` treats it and how
 * `plural()` is called: the group is the key, its categories are not.
 */
function flatten(node: Node, prefix = "", out = new Map<string, Node>()) {
	if (typeof node === "string") {
		out.set(prefix, node);
		return out;
	}
	if (isPluralGroup(node)) {
		out.set(prefix, node);
		return out;
	}
	for (const [key, value] of Object.entries(node)) {
		flatten(value, prefix ? `${prefix}.${key}` : key, out);
	}
	return out;
}

async function loadCatalog(locale: string): Promise<Node> {
	const module = await import(`${MESSAGES}/${locale}.ts`);
	return module.default as Node;
}

function sameValue(a: Node | undefined, b: Node | undefined): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

async function measure(
	locale: string,
	tier: Coverage["tier"],
	reference: Map<string, Node>,
): Promise<Coverage> {
	const flat = flatten(await loadCatalog(locale));
	const missing: string[] = [];
	const identical: string[] = [];

	for (const [key, referenceValue] of reference) {
		const value = flat.get(key);
		if (value === undefined) {
			missing.push(key);
			continue;
		}
		if (sameValue(value, referenceValue)) identical.push(key);
	}

	const stale = [...flat.keys()].filter((key) => !reference.has(key));

	return {
		locale,
		tier,
		total: reference.size,
		translated: reference.size - missing.length,
		missing,
		stale,
		identical,
	};
}

function pct(coverage: Coverage): number {
	return coverage.total === 0
		? 100
		: Math.round((coverage.translated / coverage.total) * 1000) / 10;
}

function report(coverage: Coverage, verbose: boolean): void {
	const percentage = pct(coverage);
	const complete = coverage.tier === "complete";
	const mark = complete ? (percentage === 100 ? "✅" : "❌") : "ℹ️ ";

	console.log(
		`${mark} ${coverage.locale.padEnd(7)} ${String(percentage).padStart(5)}%  ` +
			`${coverage.translated}/${coverage.total} keys` +
			(coverage.tier === "carried" ? "  (carried — not gating)" : ""),
	);

	if (coverage.stale.length > 0) {
		console.log(
			`   ⚠️  ${coverage.stale.length} key(s) English no longer defines:`,
		);
		for (const key of coverage.stale) console.log(`      ${key}`);
	}

	if (coverage.identical.length > 0) {
		console.log(
			`   ·  ${coverage.identical.length} value(s) identical to English` +
				(verbose ? ":" : " (--verbose to list)"),
		);
		if (verbose)
			for (const key of coverage.identical) console.log(`      ${key}`);
	}

	if (coverage.missing.length > 0 && (complete || verbose)) {
		console.log(`   ✗  ${coverage.missing.length} missing:`);
		for (const key of coverage.missing) console.log(`      ${key}`);
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const verbose = args.includes("--verbose");
	const only = args.includes("--locale")
		? args[args.indexOf("--locale") + 1]
		: undefined;

	const reference = flatten(await loadCatalog(REFERENCE_LOCALE));

	const targets: [string, Coverage["tier"]][] = [
		...COMPLETE_LOCALES.map((l): [string, Coverage["tier"]] => [l, "complete"]),
		...CARRIED_LOCALES.map((l): [string, Coverage["tier"]] => [l, "carried"]),
	].filter(([locale]) => !only || locale === only);

	if (targets.length === 0) {
		console.error(
			only
				? `Unknown locale: ${only}. Known: ${[...COMPLETE_LOCALES, ...CARRIED_LOCALES].join(", ")}`
				: "No locales configured.",
		);
		process.exit(1);
	}

	console.log(
		`\nTranslation coverage against ${REFERENCE_LOCALE} (${reference.size} keys)\n`,
	);

	const results: Coverage[] = [];
	for (const [locale, tier] of targets) {
		const coverage = await measure(locale, tier, reference);
		results.push(coverage);
		report(coverage, verbose);
	}

	const incomplete = results.filter(
		(r) => r.tier === "complete" && r.missing.length > 0,
	);
	const withStale = results.filter((r) => r.stale.length > 0);

	console.log("");
	if (incomplete.length > 0) {
		console.error(
			`❌ ${incomplete.map((r) => r.locale).join(", ")} declared complete but incomplete.\n` +
				`   Translate the keys above, or move the tag to CARRIED_LOCALES in this script.\n`,
		);
	}
	if (withStale.length > 0) {
		console.error(
			`❌ ${withStale.map((r) => r.locale).join(", ")} carry keys English no longer defines.\n` +
				`   Remove them; a key absent from English is unreachable.\n`,
		);
	}
	if (incomplete.length > 0 || withStale.length > 0) process.exit(1);

	console.log("✅ Every locale declared complete is complete.\n");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
