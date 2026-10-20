/**
 * Anchor a reviewed locale's corrections to the English they were reviewed
 * against.
 *
 * A reviewed catalog's translations are preserved across regenerations, so
 * "which English strings changed since the last pass" has to be answerable.
 * This script writes that answer: one English leaf per catalog key, as of the
 * moment the locale was last touched. `check-catalogs.ts` diffs the snapshot
 * against the live `en-US` and lists exactly the keys whose English moved, so
 * a regeneration for a reviewed locale is surgical — translate only the
 * listed keys, keep every other correction, then re-run this script to move
 * the anchor forward.
 *
 * Run it when a locale's manifest status flips to `reviewed` (anchoring the
 * pass that just landed) and after every surgical regeneration of a reviewed
 * locale.
 *
 * Usage: bun run scripts/write-english-snapshot.ts <locale>
 *
 * @module pie-i18n-generated/scripts/write-english-snapshot
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import enUS from "../../players-shared/src/i18n/messages/en-US.ts";
import { flatten } from "./lib/catalog-shape.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const manifest = JSON.parse(
	readFileSync(resolve(packageRoot, "catalog-manifest.json"), "utf8"),
);

const locale = process.argv[2];
if (!locale || !manifest.locales[locale]) {
	const known = Object.keys(manifest.locales).join(", ");
	console.error(`Usage: bun run scripts/write-english-snapshot.ts <locale>
Known locales: ${known}`);
	process.exit(1);
}
if (manifest.locales[locale].status !== "reviewed") {
	console.error(
		`${locale}: status is "${manifest.locales[locale].status}". A snapshot anchors review work; unreviewed ("generated") locales regenerate wholesale and need none. Flip the manifest status to "reviewed" when a pass has landed, then run this.`,
	);
	process.exit(1);
}

const english = new Map();
flatten(enUS, "", english);

const snapshot: Record<string, unknown> = {};
for (const [key, leaf] of english) {
	snapshot[key] = leaf.value;
}

const outPath = resolve(packageRoot, `src/messages/${locale}.english-snapshot.json`);
writeFileSync(outPath, `${JSON.stringify(snapshot, null, "\t")}\n`);
console.log(
	`Wrote ${outPath}: ${english.size} English leaves, anchoring ${locale}'s reviewed translations.`,
);
