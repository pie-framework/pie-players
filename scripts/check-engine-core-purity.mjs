#!/usr/bin/env node

/**
 * `check-engine-core-purity` (M7 + M8).
 *
 * Enforces the layered-architecture purity constraint for the section
 * runtime engine (M7 Variant C) and the tool policy engine (M8). Every
 * file under
 *   - `packages/assessment-toolkit/src/runtime/core/`
 *   - `packages/assessment-toolkit/src/runtime/adapter/`
 *   - `packages/assessment-toolkit/src/policy/core/`
 *   - `packages/assessment-toolkit/src/policy/sources/`
 * must be plain TS:
 *   - no imports from `svelte` (or `svelte/*`);
 *   - no imports from `@pie-players/pie-section-player*` (the wrong
 *     direction; the toolkit is upstream of section-player);
 *   - no imports from any path that resolves to a `.svelte` file.
 *
 * The core layers are pure FSM / pure decision logic; the adapter
 * layer is the I/O bridge. All stay Svelte-free so they can be reused
 * from non-Svelte hosts (Node tests, Storybook, future non-Svelte
 * consumers) and so the `check:custom-elements` `.svelte`
 * published-dist gate has nothing to flag here.
 *
 * If you need a Svelte-side helper, put it in the facade entry points
 * (`runtime/engine.ts`, `policy/engine.ts`) or in the kernel / toolkit
 * Svelte components themselves. If you need section-player-specific
 * data, parameterize it through the resolver/adapter inputs.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOOLKIT_SRC = path.join(
	ROOT,
	"packages",
	"assessment-toolkit",
	"src",
);
const RUNTIME_BASE = path.join(TOOLKIT_SRC, "runtime");
const POLICY_BASE = path.join(TOOLKIT_SRC, "policy");
const SCOPED_DIRS = [
	{ dir: path.join(RUNTIME_BASE, "core"), label: "runtime/core" },
	{ dir: path.join(RUNTIME_BASE, "adapter"), label: "runtime/adapter" },
	{ dir: path.join(POLICY_BASE, "core"), label: "policy/core" },
	{ dir: path.join(POLICY_BASE, "sources"), label: "policy/sources" },
];

const FORBIDDEN_IMPORT_PATTERNS = [
	{
		regex: /from\s+['"]svelte(?:\/[^'"]+)?['"]/g,
		reason: "imports from `svelte` (engine core / adapter must be plain TS)",
	},
	{
		regex: /from\s+['"]@pie-players\/pie-section-player[^'"]*['"]/g,
		reason:
			"imports from `@pie-players/pie-section-player*` (wrong dependency direction; section-player is downstream of the toolkit)",
	},
	{
		regex: /from\s+['"][^'"]+\.svelte['"]/g,
		reason: "imports from a `.svelte` source file",
	},
];

function listTsFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			out.push(...listTsFiles(full));
			continue;
		}
		if (stat.isFile() && full.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

function rel(p) {
	return path.relative(ROOT, p).replaceAll("\\", "/");
}

const violations = [];
let totalFiles = 0;
const labelCounts = {};

for (const scope of SCOPED_DIRS) {
	const files = listTsFiles(scope.dir);
	totalFiles += files.length;
	labelCounts[scope.label] = files.length;
	for (const file of files) {
		const src = readFileSync(file, "utf8");
		for (const { regex, reason } of FORBIDDEN_IMPORT_PATTERNS) {
			// Reset because regex carries state with the `g` flag.
			regex.lastIndex = 0;
			let match = regex.exec(src);
			while (match) {
				violations.push({ file: rel(file), match: match[0], reason });
				match = regex.exec(src);
			}
		}
	}
}

if (violations.length > 0) {
	console.error(
		"[check-engine-core-purity] purity violation(s) under packages/assessment-toolkit/src/{runtime,policy}/{core,adapter,sources}/:",
	);
	for (const v of violations) {
		console.error(`  ${v.file}: ${v.match} — ${v.reason}`);
	}
	console.error(
		"\nEngine cores (runtime + policy) and the runtime adapter are pure TS " +
			"by design. Move host/Svelte/section-player coupling into a facade " +
			"entry point (runtime/engine.ts, policy/engine.ts) or into kernel / " +
			"toolkit Svelte components.",
	);
	process.exit(1);
}

const breakdown = Object.entries(labelCounts)
	.map(([label, count]) => `${label}: ${count}`)
	.join(", ");
console.log(
	`[check-engine-core-purity] OK: validated ${totalFiles} file(s) (${breakdown})`,
);
