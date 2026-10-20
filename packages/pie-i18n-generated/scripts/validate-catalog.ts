#!/usr/bin/env bun
/**
 * Structural validation for a catalog that is not registered yet — the
 * self-check a locale generation run makes before the locale joins the
 * loader map and manifest.
 *
 * Enforces what `check-catalogs.ts` enforces once registered, minus freshness
 * and manifest bookkeeping: full key parity with en-US, leaf-kind agreement,
 * plural-group shape with `other` required, and placeholder-name parity in
 * every string and plural category the two catalogs share.
 *
 * Usage: bun run scripts/validate-catalog.ts <path-to-catalog.ts>
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import enUS from "../../players-shared/src/i18n/messages/en-US.ts";
import { flatten, placeholders } from "./lib/catalog-shape.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
if (process.argv[2] === undefined) {
	console.error("Usage: bun run scripts/validate-catalog.ts <path-to-catalog.ts>");
	process.exit(1);
}
// Resolved from the package root, matching the README's usage
// (`bun run scripts/validate-catalog.ts src/messages/<locale>.ts`); absolute
// paths pass through unchanged.
const catalogPath = resolve(packageRoot, process.argv[2]);

const loaded = await import(catalogPath);
const catalog = loaded.default;

const english = new Map();
flatten(enUS, "", english);
const localized = new Map();
flatten(catalog, "", localized);

const errors: string[] = [];

for (const key of [...english.keys()].filter((key) => !localized.has(key))) {
	errors.push(`missing key ${key} (falls back to English silently once shipped)`);
}
for (const key of [...localized.keys()].filter((key) => !english.has(key))) {
	errors.push(`key ${key} is not defined by en-US`);
}

let placeholderMismatches = 0;
for (const [key, leaf] of english) {
	const localizedLeaf = localized.get(key);
	if (!localizedLeaf) continue;
	if (leaf.kind !== localizedLeaf.kind) {
		errors.push(`${key} is a ${localizedLeaf.kind} where English has a ${leaf.kind}`);
		continue;
	}
	if (leaf.kind === "plural" && localizedLeaf.kind === "plural") {
		if (typeof localizedLeaf.value.other !== "string") {
			errors.push(`plural group ${key} has no 'other'`);
		}
	}
	const pairs: Array<[string, string, string]> = [];
	if (leaf.kind === "string" && localizedLeaf.kind === "string") {
		pairs.push([key, leaf.value, localizedLeaf.value]);
	}
	if (leaf.kind === "plural" && localizedLeaf.kind === "plural") {
		for (const category of Object.keys(leaf.value)) {
			const localizedText = localizedLeaf.value[category];
			if (typeof localizedText !== "string") continue;
			pairs.push([`${key}.${category}`, leaf.value[category], localizedText]);
		}
	}
	for (const [label, en, lo] of pairs) {
		for (const slot of placeholders(en)) {
			if (!placeholders(lo).has(slot)) {
				errors.push(`${label} lost placeholder {${slot}}`);
				placeholderMismatches += 1;
			}
		}
		for (const slot of placeholders(lo)) {
			if (!placeholders(en).has(slot)) {
				errors.push(`${label} introduces unknown placeholder {${slot}}`);
				placeholderMismatches += 1;
			}
		}
	}
}

console.log(`en-US: ${english.size} keys; catalog: ${localized.size} keys`);
if (errors.length > 0) {
	for (const error of errors) console.error(`FAIL ${error}`);
	console.error(`\n${errors.length} error(s). Fix the catalog and re-run.`);
	process.exit(1);
}
console.log(
	"Catalog is structurally sound against en-US: full key parity, placeholders intact, plural groups valid.",
);
