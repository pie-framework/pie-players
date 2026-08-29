#!/usr/bin/env node

/**
 * Consumer-impact guard: when a branch changes a surface that downstream host
 * applications are recorded as consuming, require
 * `docs/integrations/consumer-api-dependencies.md` to be touched in the same
 * branch — or an explicit, reasoned override.
 *
 * The pad answers "if I change this, who breaks?" and its value decays the
 * moment it stops matching reality. The failure mode it protects against is
 * specifically silent: the surfaces listed in its highest-risk group break a
 * client-facing host with no build error and no runtime error there, so nothing
 * else in this repo's gate family notices. `check:source-exports`,
 * `check:consumer-boundaries` and `check:custom-elements` all validate that our
 * own packaging is coherent; none of them know that a real host reaches into
 * `pie-section-player-item-card` with a stylesheet.
 *
 * This runs on the branch range rather than the staged index, and is wired into
 * `verify:ci-lint-typecheck` (so PR runs surface it) rather than
 * `verify:pre-commit`. Two reasons: a surface change is usually spread over
 * several commits, and commit messages — where the override lives — do not exist
 * yet at pre-commit time.
 *
 * Trigger set below is deliberately narrow and hand-curated from the pad's own
 * risk groups. A broad glob over every package's `src` would fire on every change and
 * train people to reach for the override, which is worse than no gate. Widen it
 * when the pad gains a row that a real change would have slipped past.
 *
 * Rule: `AGENTS.md` "Downstream Consumer Impact".
 * Procedure: `docs/integrations/consumer-api-dependencies-maintenance.md`.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { isNoOpChange } from "./lib/no-op-change.mjs";

const PAD_PATH = "docs/integrations/consumer-api-dependencies.md";
const RULE_PATH = "AGENTS.md";
const PROCEDURE_PATH =
	"docs/integrations/consumer-api-dependencies-maintenance.md";
const OVERRIDE_TRAILER = "Consumer-pad";
const OVERRIDE_ENV = "PIE_CONSUMER_PAD_OVERRIDE";
const BASE_REFS = ["origin/develop", "develop"];

/**
 * Files whose contents define a surface the pad records a consumer touching.
 * Each entry is a predicate over a repo-relative path plus the reason to show
 * when it trips, so the failure names the actual risk instead of a path list.
 */
const TRIGGERS = [
	{
		reason:
			"custom-element definition: tag name, attribute names, or a prop's declared type",
		match: (file) =>
			/^packages\/[^/]+\/src\/.*Element\.svelte$/.test(file) ||
			/^packages\/[^/]+\/src\/components\/[^/]+-element\.ts$/.test(file),
	},
	{
		reason: "section-player public event vocabulary or layout contract",
		match: (file) => file.startsWith("packages/section-player/src/contracts/"),
	},
	{
		reason:
			"coordinator / section-controller API, or the bubbles+composed defaults hosts rely on to catch events at document level",
		match: (file) =>
			[
				"packages/assessment-toolkit/src/services/section-controller-types.ts",
				"packages/assessment-toolkit/src/services/interfaces.ts",
				"packages/assessment-toolkit/src/services/ToolkitCoordinator.ts",
				"packages/assessment-toolkit/src/runtime/tool-host-contract.ts",
				"packages/assessment-toolkit/src/runtime/registration-events.ts",
			].includes(file),
	},
	{
		reason:
			"theme token surface: token names, scheme mappings, or the published registry",
		match: (file) =>
			/^packages\/theme\/src\/(tokens|color-schemes|font-sizes|components)\.css$/.test(
				file,
			) || file === "packages/theme/src/token-registry.json",
	},
	{
		reason:
			"`Env` pass-through, or how the shared content stylesheet reaches the document",
		match: (file) =>
			file === "packages/players-shared/src/types/index.ts" ||
			file === "packages/players-shared/src/ui/content-styles.ts",
	},
	{
		reason:
			"published type surface of a contract package or a tool export barrel: a name added to or removed from what consumers can import",
		match: (file) =>
			/^packages\/(calculator|tts)\/src\/(index|provider-interface)\.ts$/.test(
				file,
			) ||
			/^packages\/assessment-toolkit\/src\/tools\/(client|internal|types)\.ts$/.test(
				file,
			),
	},
	{
		reason:
			"a tool package's published type entry, the lookup contract a host implements behind it, or the dts config that decides whether either reaches a tarball",
		match: (file) =>
			/^packages\/tool-[^/]+\/(index|lookup)\.ts$/.test(file) ||
			/^packages\/tool-[^/]+\/vite\.config\.ts$/.test(file),
	},
	{
		reason:
			"published type surface of a provider adapter package: the owner of a vendor's configuration types",
		match: (file) =>
			/^packages\/(calculator-desmos|tts-client-server|tts-server-[a-z]+)\/(src\/)?index\.ts$/.test(
				file,
			),
	},
];

const fail = (lines) => {
	console.error(`[check-consumer-pad] ${lines.join("\n")}`);
	process.exit(1);
};

const git = (args) =>
	execFileSync("git", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

const gitOrNull = (args) => {
	try {
		return git(args);
	} catch {
		return null;
	}
};

/**
 * Resolve the merge base to diff against. Prefers `origin/develop` so the answer
 * does not depend on how stale a local `develop` is. Returns null when neither
 * ref exists — a shallow CI clone, or a fresh checkout with no remote — in which
 * case the guard reports and passes rather than blocking on infrastructure.
 */
const resolveMergeBase = () => {
	const explicit = process.env.GITHUB_BASE_REF
		? [`origin/${process.env.GITHUB_BASE_REF}`, process.env.GITHUB_BASE_REF]
		: [];
	for (const ref of [...explicit, ...BASE_REFS]) {
		if (!gitOrNull(["rev-parse", "--verify", "--quiet", ref])) continue;
		const base = gitOrNull(["merge-base", "HEAD", ref]);
		if (base?.trim()) return { ref, sha: base.trim() };
	}
	return null;
};

const base = resolveMergeBase();
if (!base) {
	console.log(
		`[check-consumer-pad] Skipped: no base ref among ${BASE_REFS.join(", ")} is available to diff against.`,
	);
	process.exit(0);
}

// Committed changes on the branch, plus anything still in the working tree, so
// the guard gives the same answer before and after the commit that would trip it.
const changed = new Set(
	[
		gitOrNull(["diff", "--name-only", `${base.sha}...HEAD`]),
		gitOrNull(["diff", "--name-only", "HEAD"]),
		gitOrNull(["diff", "--name-only", "--cached"]),
	]
		.filter(Boolean)
		.join("\n")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean),
);

if (changed.size === 0) process.exit(0);

/**
 * Run a source through biome's formatter to get its normal form. Bare `biome`
 * because the lifecycle runner puts node_modules/.bin on PATH, same as
 * `lint:biome`. stderr is dropped: biome reports "the formatter is disabled" there
 * for Svelte and returns the input untouched, which the caller reads as "cannot
 * prove" via an unchanged normal form.
 */
const formatSource = (file, source) => {
	try {
		return execFileSync("biome", ["format", `--stdin-file-path=${file}`], {
			input: source,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		});
	} catch {
		return null;
	}
};

const contentAtBase = (file) => gitOrNull(["show", `${base.sha}:${file}`]);

const contentNow = (file) => {
	try {
		return readFileSync(file, "utf8");
	} catch {
		return null;
	}
};

/**
 * Compares the merge base against the working tree rather than against HEAD, so a
 * surface change is judged the same whether or not it has been committed yet --
 * matching how `changed` is assembled above.
 */
const isFormattingOnly = (file) =>
	isNoOpChange({
		file,
		before: contentAtBase(file),
		after: contentNow(file),
		formatSource,
	});

const tripped = [];
const ignored = [];
for (const trigger of TRIGGERS) {
	const matched = [...changed].filter(trigger.match).sort();
	const files = [];
	for (const file of matched) {
		if (isFormattingOnly(file)) ignored.push(file);
		else files.push(file);
	}
	if (files.length > 0) tripped.push({ reason: trigger.reason, files });
}

// Say what was discounted. A guard that silently narrows itself is indistinguishable
// from a guard that passed.
if (ignored.length > 0) {
	console.log(
		`[check-consumer-pad] Ignored ${ignored.length} formatting-only change(s) to trigger file(s): ${ignored.sort().join(", ")}`,
	);
}

if (tripped.length === 0) process.exit(0);

if (changed.has(PAD_PATH)) {
	console.log(
		`[check-consumer-pad] Surface changes found and ${PAD_PATH} was updated in the same branch.`,
	);
	process.exit(0);
}

const envOverride = process.env[OVERRIDE_ENV]?.trim();
if (envOverride) {
	console.log(
		`[check-consumer-pad] Overridden via ${OVERRIDE_ENV}: ${envOverride}`,
	);
	process.exit(0);
}

// Any commit in the range may carry the trailer; a surface change is often split
// across commits and only one of them needs to explain the exemption.
const log = gitOrNull(["log", "--format=%B", `${base.sha}..HEAD`]) || "";
const trailer = log.match(
	new RegExp(`^\\s*${OVERRIDE_TRAILER}:\\s*(.+)$`, "im"),
);
if (trailer) {
	console.log(
		`[check-consumer-pad] Overridden via ${OVERRIDE_TRAILER} trailer: ${trailer[1].trim()}`,
	);
	process.exit(0);
}

fail([
	`This branch changes a surface that downstream hosts are recorded as consuming, but ${PAD_PATH} was not updated.`,
	"",
	...tripped.flatMap(({ reason, files }) => [
		`  ${reason}:`,
		...files.map((file) => `    ${file}`),
	]),
	"",
	`Why this is blocking: the surfaces in that pad's highest-risk group break a client-facing host with no build error and no runtime error there, so no other check in this repo will catch it.`,
	"",
	"Resolve it one of three ways:",
	`  1. Update ${PAD_PATH} — follow ${PROCEDURE_PATH}. In Claude Code, run /consumer-dependency-audit.`,
	`  2. If a consumer is affected but the pad rows still read true, say so in the commit message with a trailer:`,
	`       ${OVERRIDE_TRAILER}: rows unchanged, <what you checked>`,
	`  3. If no recorded consumer touches this after all, same trailer with that reason — and consider whether the trigger list in this script is too wide.`,
	"",
	`Compared against ${base.ref} (merge-base ${base.sha.slice(0, 12)}). Rule: ${RULE_PATH} "Downstream Consumer Impact".`,
	`One-off local escape: ${OVERRIDE_ENV}="<reason>" bun run check:consumer-pad`,
]);
