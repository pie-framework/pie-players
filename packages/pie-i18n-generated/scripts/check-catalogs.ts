/**
 * Structural and freshness validation for the generated locale catalogs.
 *
 * The reviewed catalogs in `players-shared` are gated by human audit and
 * `check:i18n-coverage`; this package's catalogs have no such reader standing
 * behind every string, so their guarantee has to be mechanical. What is
 * enforced depends on the locale's manifest status:
 *
 * - **`generated`** — machine output, never reviewed. Freshness is wholesale:
 *   the catalog records the hash of the `en-US` source it was generated from,
 *   and any English change fails the gate, because every stale key would
 *   silently fall back to English. Regeneration replaces the whole file; no
 *   human work is lost, because there is none to lose.
 * - **`reviewed`** — at least one native pass has corrected the file in
 *   place, so wholesale regeneration is no longer allowed: it would clobber
 *   review work. Freshness is surgical instead. The catalog is anchored to an
 *   English snapshot (one leaf per key, written by
 *   `scripts/write-english-snapshot.ts` at review time), the gate diffs that
 *   snapshot against the live English source, and only the keys whose English
 *   actually moved need regenerating. Key, placeholder and plural-shape
 *   parity are enforced for both statuses.
 *
 * Run directly under bun (`bun run scripts/check-catalogs.ts`); it reads the
 * English source across the package boundary by relative path, which no
 * published artifact may do — this script is repo tooling, not package code.
 *
 * @module pie-i18n-generated/scripts/check-catalogs
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import enUS from "../../players-shared/src/i18n/messages/en-US.ts";
import { GENERATED_LOCALES } from "../src/index.ts";
import { flatten, placeholders } from "./lib/catalog-shape.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const manifestPath = resolve(packageRoot, "catalog-manifest.json");
const messagesDir = resolve(packageRoot, "src/messages");

const STATUSES = new Set(["generated", "reviewed"]);

const sourceHash = createHash("sha256")
	.update(JSON.stringify(enUS))
	.digest("hex");

const english = new Map();
flatten(enUS, "", english);

const errors: string[] = [];
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
	source: { hash: string };
	locales: Record<
		string,
		{
			status: string;
			brief: string;
			generatedAt: string;
			model: string;
			sourceHash?: string;
			reviewedAt?: string;
		}
	>;
};

// Manifest ↔ loader-map agreement: a locale registered in one and not the
// other is either unreachable from the runtime or invisible to this check.
const manifestLocales = new Set(Object.keys(manifest.locales));
const runtimeLocales = new Set(GENERATED_LOCALES);
for (const locale of runtimeLocales) {
	if (!manifestLocales.has(locale)) {
		errors.push(`${locale}: in GENERATED_LOCALES but absent from the manifest`);
	}
}
for (const locale of manifestLocales) {
	if (!runtimeLocales.has(locale)) {
		errors.push(`${locale}: in the manifest but absent from GENERATED_LOCALES`);
	}
}

if (manifest.source.hash !== sourceHash) {
	errors.push(
		`manifest.source.hash is stale: manifest records ${manifest.source.hash}, en-US now hashes to ${sourceHash}. Refresh the manifest when the catalogs are regenerated.`,
	);
}

function leafEquals(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Long key lists render one line each in the gate; cap them. */
function listKeys(keys: string[]): string {
	if (keys.length <= 10) return keys.join(", ");
	return `${keys.slice(0, 10).join(", ")} … and ${keys.length - 10} more`;
}

const rows: string[] = [];
for (const locale of [...runtimeLocales].sort()) {
	const entry = manifest.locales[locale];
	if (!entry) continue;

	if (!STATUSES.has(entry.status)) {
		errors.push(
			`${locale}: unknown manifest status "${entry.status}" (generated | reviewed)`,
		);
		continue;
	}

	// Freshness, by status. Computed before the structural checks so the table
	// can report it either way; failures land in `errors` below.
	let freshness: "fresh" | "stale" = "fresh";
	if (entry.status === "generated") {
		if (typeof entry.sourceHash !== "string") {
			errors.push(`${locale}: generated locale has no sourceHash in the manifest`);
			freshness = "stale";
		} else if (entry.sourceHash !== sourceHash) {
			freshness = "stale";
			errors.push(
				`${locale}: catalog is stale — generated from source ${entry.sourceHash}, en-US is now ${sourceHash}. Regenerate the whole catalog per the README (nothing is lost: the locale is unreviewed).`,
			);
		}
	} else {
		const snapshotPath = resolve(messagesDir, `${locale}.english-snapshot.json`);
		let snapshot: Record<string, unknown>;
		try {
			snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
		} catch {
			freshness = "stale";
			errors.push(
				`${locale}: reviewed locale has no readable English snapshot at src/messages/${locale}.english-snapshot.json — write it with scripts/write-english-snapshot.ts`,
			);
			snapshot = {};
		}
		const snapshotKeys = new Set(Object.keys(snapshot));
		const missingFromSnapshot = [...english.keys()].filter(
			(key) => !snapshotKeys.has(key),
		);
		const extraInSnapshot = [...snapshotKeys].filter((key) => !english.has(key));
		const changed = [...english.keys()].filter((key) => {
			const leaf = english.get(key);
			// The snapshot stores bare leaves (a string, or a plural-group
			// object); the flattened map stores them wrapped with a `kind`, so
			// compare against the unwrapped value.
			return (
				leaf !== undefined && snapshotKeys.has(key) && !leafEquals(snapshot[key], leaf.value)
			);
		});
		if (
			missingFromSnapshot.length > 0 ||
			extraInSnapshot.length > 0 ||
			changed.length > 0
		) {
			freshness = "stale";
			if (missingFromSnapshot.length > 0) {
				errors.push(
					`${locale}: English added keys the snapshot does not know: ${listKeys(missingFromSnapshot)}`,
				);
			}
			if (extraInSnapshot.length > 0) {
				errors.push(
					`${locale}: the snapshot carries keys English no longer defines: ${listKeys(extraInSnapshot)}`,
				);
			}
			if (changed.length > 0) {
				errors.push(
					`${locale}: English changed under reviewed translation(s): ${listKeys(changed)} — regenerate ONLY these keys per the brief, keep every other translation, then refresh the snapshot.`,
				);
			}
		}
	}

	const file = resolve(messagesDir, `${locale}.ts`);
	let catalog: Record<string, unknown>;
	try {
		// `bun run` transpiles the sibling source directly; no dist involved.
		const loaded = await import(file);
		catalog = loaded.default;
	} catch (error) {
		errors.push(`${locale}: catalog module failed to load: ${String(error)}`);
		continue;
	}

	const localized = new Map();
	flatten(catalog, "", localized);

	const missing = [...english.keys()].filter((key) => !localized.has(key));
	const extra = [...localized.keys()].filter((key) => !english.has(key));
	for (const key of missing) {
		errors.push(`${locale}: missing key ${key} (falls back to English silently)`);
	}
	for (const key of extra) {
		errors.push(`${locale}: key ${key} is not defined by en-US`);
	}

	let placeholderMismatches = 0;
	for (const [key, leaf] of english) {
		const localizedLeaf = localized.get(key);
		if (!localizedLeaf) continue;
		if (leaf.kind !== localizedLeaf.kind) {
			errors.push(
				`${locale}: ${key} is a ${localizedLeaf.kind} where English has a ${leaf.kind}`,
			);
			continue;
		}
		if (leaf.kind === "plural" && localizedLeaf.kind === "plural") {
			if (typeof localizedLeaf.value.other !== "string") {
				errors.push(`${locale}: plural group ${key} has no 'other'`);
			}
			for (const category of Object.keys(leaf.value)) {
				const localizedText = localizedLeaf.value[category];
				if (typeof localizedText !== "string") continue;
				for (const slot of placeholders(leaf.value[category])) {
					if (!placeholders(localizedText).has(slot)) {
						errors.push(`${locale}: ${key}.${category} lost placeholder {${slot}}`);
						placeholderMismatches += 1;
					}
				}
				for (const slot of placeholders(localizedText)) {
					if (!placeholders(leaf.value[category]).has(slot)) {
						errors.push(`${locale}: ${key}.${category} introduces unknown placeholder {${slot}}`);
						placeholderMismatches += 1;
					}
				}
			}
		}
		if (leaf.kind === "string" && localizedLeaf.kind === "string") {
			const expected = placeholders(leaf.value);
			const found = placeholders(localizedLeaf.value);
			for (const slot of expected) {
				if (!found.has(slot)) {
					errors.push(`${locale}: ${key} lost placeholder {${slot}}`);
					placeholderMismatches += 1;
				}
			}
			for (const slot of found) {
				if (!expected.has(slot)) {
					errors.push(`${locale}: ${key} introduces unknown placeholder {${slot}}`);
					placeholderMismatches += 1;
				}
			}
		}
	}

	const covered = [...english.keys()].filter((key) => localized.has(key)).length;
	const coverage = Math.round((covered / english.size) * 100);
	rows.push(
		`${locale}\t${entry.status}\t${covered}/${english.size} keys (${coverage}%)\t${placeholderMismatches} placeholder mismatches\t${freshness}\t${entry.generatedAt}`,
	);
}

const label = english.size === 1 ? "key" : "keys";
console.log(`en-US: ${english.size} ${label}, source hash ${sourceHash}`);
console.log("");
console.log("locale\tstatus\tcoverage\tplaceholders\tfreshness\tgenerated");
for (const row of rows) console.log(row);

if (errors.length > 0) {
	console.error("");
	for (const error of errors) console.error(`FAIL ${error}`);
	console.error(
		`\n${errors.length} error(s). See packages/pie-i18n-generated/README.md for the regeneration and review lifecycle.`,
	);
	process.exit(1);
}
console.log("\nAll generated catalogs are structurally sound and fresh.");
