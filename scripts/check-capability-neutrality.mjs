#!/usr/bin/env node

/**
 * `check-capability-neutrality` (PIE-886).
 *
 * The generic tool/PNP core must not name a specific capability. A host has to be
 * able to contribute a tool or an accommodation without editing our packages, and
 * a core module that hard-codes `signLanguage` or `annotationToolbar` is exactly
 * what makes that impossible.
 *
 * PIE-886 removed every such reference. This is what keeps them out: without a
 * gate the regression returns with the next capability, which is how the previous
 * ones arrived — each one reasonable on its own, each one a name in a file that
 * should not have had it.
 *
 * Scope is a named list of files, not the whole package. The toolkit legitimately
 * still contains TTS-specific code (`TTSService`, `services/tts/**`) and provider
 * descriptors for calculators and TTS, and moving those is separate, larger work.
 * The files below are the ones whose whole job is to be capability-agnostic:
 * policy decisions, the registry, catalog resolution, tools-config validation and
 * the registry/tag factories.
 *
 * Comments are exempt. A comment naming a capability is usually explaining why
 * the code no longer does, and gating prose would push authors toward vaguer
 * comments rather than cleaner code.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOOLKIT_SRC = path.join(ROOT, "packages", "assessment-toolkit", "src");

/**
 * Capability ids that must not appear in the scoped files. Sourced from the
 * packaged set plus the accommodations PIE ships or has committed to.
 */
const CAPABILITY_IDS = [
	"signLanguage",
	"annotationToolbar",
	"highlighter",
	"answerEliminator",
	"lineReader",
	"periodicTable",
	"protractor",
	"calculator",
	"textToSpeech",
	"graph",
	"ruler",
	"theme",
];

/**
 * Element tags are the other way a file names a capability.
 */
const CAPABILITY_TAG_PATTERN = /pie-tool-[a-z0-9-]+/g;

const SCOPED_TARGETS = [
	{ dir: path.join(TOOLKIT_SRC, "policy"), label: "policy/**" },
	{ file: path.join(TOOLKIT_SRC, "services", "ToolRegistry.ts") },
	{
		file: path.join(TOOLKIT_SRC, "services", "AccessibilityCatalogResolver.ts"),
	},
	{ file: path.join(TOOLKIT_SRC, "services", "tool-config-validation.ts") },
	{ file: path.join(TOOLKIT_SRC, "services", "tool-config-defaults.ts") },
	{ file: path.join(TOOLKIT_SRC, "services", "createDefaultToolRegistry.ts") },
	{
		file: path.join(TOOLKIT_SRC, "services", "defaultPersonalNeedsProfile.ts"),
	},
	{ file: path.join(TOOLKIT_SRC, "tools", "tool-tag-map.ts") },
];

/**
 * `pnp-standard-features.ts` is deliberately not scoped: it enumerates the
 * AfA/QTI vocabulary and is exported rather than imported by any core module. A
 * published list of standard support ids is legitimate — it is a vocabulary, not
 * a dependency on a capability.
 */

/**
 * Known exceptions, each with the reason it is one.
 *
 * An allowlist rather than dropping the file from scope: an exemption should be
 * one line a reviewer can see and argue with, not a silent gap in coverage.
 */
const ALLOWED = [
	{
		file: path.join(TOOLKIT_SRC, "services", "tool-config-validation.ts"),
		id: "textToSpeech",
		// A migration diagnostic for the `providers.tts` -> `providers.textToSpeech`
		// rename. It is one capability's rename living in generic validation, and it
		// is a legacy shim of the kind AGENTS.md disallows outside the `pie-item`
		// contract. Left in place because deleting it silently drops a useful
		// migration error, and generalising it (a `deprecatedProviderKeys`
		// declaration on the registration) is a design change rather than part of
		// moving the registrations. Tracked as follow-up work, not exempted forever.
		reason:
			"providers.tts -> providers.textToSpeech migration diagnostic; see PIE-886 follow-up",
	},
];

function isAllowed(absPath, id) {
	return ALLOWED.some((entry) => entry.file === absPath && entry.id === id);
}

/** Strip comments and string-free code so prose does not trip the check. */
function stripComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function collectTsFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const abs = path.join(dir, entry);
		if (statSync(abs).isDirectory()) {
			out.push(...collectTsFiles(abs));
			continue;
		}
		if (abs.endsWith(".ts") && !abs.endsWith(".d.ts")) out.push(abs);
	}
	return out;
}

function resolveTargets() {
	const files = [];
	for (const target of SCOPED_TARGETS) {
		if (target.file) {
			files.push(target.file);
			continue;
		}
		files.push(...collectTsFiles(target.dir));
	}
	return files;
}

function checkFile(absPath) {
	const relPath = path.relative(ROOT, absPath);
	const code = stripComments(readFileSync(absPath, "utf8"));
	const violations = [];

	for (const id of CAPABILITY_IDS) {
		// Only a quoted id counts. `calculator` appears in type names and generic
		// identifiers where it is not naming a capability instance.
		const quoted = new RegExp(`["'\`]${id}["'\`]`);
		if (quoted.test(code) && !isAllowed(absPath, id)) {
			violations.push(`names capability id "${id}"`);
		}
	}

	for (const tag of code.match(CAPABILITY_TAG_PATTERN) ?? []) {
		violations.push(`names capability element tag "${tag}"`);
	}

	return violations.map((message) => `${relPath}: ${message}`);
}

const failures = resolveTargets().flatMap(checkFile);

if (failures.length > 0) {
	console.error(
		"[check-capability-neutrality] the generic tool/PNP core must name no capability:\n",
	);
	for (const failure of failures) console.error(`  - ${failure}`);
	console.error(
		"\nMove the capability-specific part into a capability package, or into the" +
			"\ncomposition layer (@pie-players/pie-default-tool-loaders) if it is a" +
			"\ndecision about which capabilities a deployment has. The layers, and which" +
			"\none this belongs in, are in docs/tools-and-accomodations/architecture.md" +
			"\nunder Capability Ownership Layers. See also PIE-886.",
	);
	process.exit(1);
}

const checked = resolveTargets().length;
console.log(
	`[check-capability-neutrality] OK: validated ${checked} core file(s) name no capability`,
);
