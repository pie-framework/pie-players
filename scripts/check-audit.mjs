#!/usr/bin/env node

/**
 * Dependency vulnerability gate, backed by `bun audit`.
 *
 * Why this exists rather than relying on Dependabot alerts: GitHub's dependency
 * graph does not parse `bun.lock`. Verified 2026-08-05 — the graph reports zero
 * manifests for this repo and the SBOM endpoint 404s, while a sibling npm-based
 * repo (pie-lib) returns 32 manifests and 2310 packages through the same API and
 * token. So Dependabot *alerts* cannot see this repo's dependencies at all, and
 * a clean alerts page is not evidence of a clean tree. (Dependabot *version
 * updates* are unaffected — those come from the `bun` ecosystem entry in
 * `.github/dependabot.yml`, a separate mechanism that works.)
 *
 * ## Why severity alone is the wrong gate
 *
 * `bun audit` has no dev/production distinction — its whole flag surface is
 * `--json`, `--audit-level` and `--ignore`, with no `npm audit --omit=dev`
 * equivalent. It reports every package resolved in the workspace-wide lockfile,
 * so build tooling and shipped runtime code arrive in one undifferentiated list.
 *
 * Gating on severity alone therefore measures the wrong thing. An advisory's
 * severity describes the bug, not how this repo consumes it: a `high` in
 * `vite-plugin-dts` means a hostile file could misbehave during someone's build,
 * while a `moderate` XSS bypass in `dompurify` reaches every learner's browser.
 * A severity-only threshold would block the former and wave through the latter.
 *
 * So this gate classifies first and thresholds second:
 *
 * - **Shipped** — the package is reachable through the `dependencies` (or
 *   `optionalDependencies`) closure of at least one publishable workspace
 *   package. A consumer running `npm install @pie-players/...` gets it. These
 *   block at `SHIPPED_FAIL_LEVEL`, which is deliberately strict because the set
 *   is small.
 * - **Dev-only** — everything else: build tooling, test harnesses, CLIs, private
 *   apps. Always reported, never blocking. Not harmless (build tools run in CI
 *   with repo write access and secrets) but not a threat to delivered code, and
 *   not something that should hold up an unrelated PR.
 *
 * Classification is by package *name*, because that is the granularity
 * `bun audit --json` reports. If a name is reachable from any publishable
 * runtime path it counts as shipped — the conservative direction for a security
 * gate, since it over-includes rather than under-includes.
 *
 * `peerDependencies` of publishable packages count as shipped: the consumer
 * installs them into the app that runs our code. They currently add only two
 * workspace names to the closure, so this costs nothing and avoids mislabelling
 * a dependency that genuinely executes in delivered apps.
 *
 * ## Known limitation: bundled dependencies are invisible here
 *
 * This classifies from *manifests*, so it only sees what a consumer installs.
 * Anything compiled or bundled into `dist/` at build time from a
 * devDependency is shipped code that this gate will label dev-only.
 *
 * `svelte` is exactly that case: `check:svelte-runtime-deps` deliberately keeps
 * it out of published `dependencies` (it is compiled in), so a svelte advisory
 * would appear here as dev-only despite reaching real browsers. Catching that
 * class of finding needs advisory matching against built bundles, which this
 * gate does not attempt. Treat a dev-only finding in something known to be
 * bundled as shipped, by hand, until that gap is closed.
 *
 * ## Deliberately not a local hook
 *
 * Not wired into `verify:pre-commit` or `verify:pre-push`. It needs network
 * access and its verdict changes with advisory data rather than with the diff,
 * so a local hook would break offline commits and fail for reasons unrelated to
 * the change being pushed. It runs as its own CI job instead. It also needs
 * `node_modules` present, which the CI job guarantees by installing first.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_ROOT = process.cwd();

/** Severity ranking, lowest to highest. Mirrors the registry advisory levels. */
export const SEVERITY_ORDER = ["low", "moderate", "high", "critical"];

/**
 * Findings on shipped paths fail the build at or above this severity.
 *
 * `low` is intentional. The shipped closure is small, so anything in it is worth
 * a deliberate decision rather than a silent tolerance — and an advisory the
 * registry rates `low` in a sanitizer can still be an XSS bypass in delivered
 * markup.
 */
const SHIPPED_FAIL_LEVEL = "low";

/** Dev-only findings are printed from this severity up, and never block. */
const DEV_REPORT_LEVEL = "low";

/** Workspace globs to scan for package manifests. */
const WORKSPACE_DIRS = ["packages", "apps", "tools"];

/**
 * Shipped findings that are known and accepted for now, keyed by GHSA id.
 *
 * This is not a severity escape hatch. Every entry needs a reason and an exit
 * condition, and a stale entry — one that no longer matches any current finding
 * — FAILS the gate, so the list cannot quietly outlive its purpose.
 */
const SHIPPED_ALLOWLIST = {
	"GHSA-hpcv-96wg-7vj8":
		"dompurify <=3.4.5 — cleared by the pending 3.4.13 bump",
	"GHSA-r47g-fvhr-h676":
		"dompurify <=3.4.5 — cleared by the pending 3.4.13 bump",
	"GHSA-rp9w-3fw7-7cwq":
		"dompurify <=3.4.6 — cleared by the pending 3.4.13 bump",
	"GHSA-x4vx-rjvf-j5p4":
		"dompurify <=3.4.6 — cleared by the pending 3.4.13 bump",
	"GHSA-76mc-f452-cxcm":
		"dompurify <3.4.7 — cleared by the pending 3.4.13 bump",
	"GHSA-gvmj-g25r-r7wr":
		"dompurify <=3.4.7 — cleared by the pending 3.4.13 bump",
	"GHSA-vxr8-fq34-vvx9":
		"dompurify <3.4.9 — cleared by the pending 3.4.13 bump",
	"GHSA-cmwh-pvxp-8882":
		"dompurify <=3.4.10 — cleared by the pending 3.4.13 bump",
	"GHSA-c2j3-45gr-mqc4":
		"dompurify <=3.4.11 — cleared by the pending 3.4.13 bump",
};

/**
 * Every entry above is a dompurify sanitizer-bypass advisory in
 * `@pie-players/pie-players-shared`, which is shipped. The 3.4.13 bump clears
 * all nine and is verified correct in Chromium, but dompurify >=3.4.8 fails open
 * under happy-dom, which breaks the sanitizer unit tests. Landing the bump is
 * blocked on choosing a test environment for those tests, not on the dependency.
 * Delete these entries with the bump; the stale-entry check will insist.
 */
const ALLOWLIST_CONTEXT =
	"9 dompurify advisories pending the 3.4.13 bump (blocked on sanitizer test env, not on the dependency).";

export function severityRank(severity) {
	const index = SEVERITY_ORDER.indexOf(String(severity).toLowerCase());
	return index === -1 ? 0 : index;
}

export function meetsLevel(severity, level) {
	return severityRank(severity) >= severityRank(level);
}

/** Extracts `GHSA-...` from an advisory URL. */
export function advisoryId(url) {
	const match = String(url ?? "").match(/GHSA-[\w-]+/i);
	return match ? match[0] : "";
}

function readJsonOrNull(filePath) {
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}
}

/**
 * Collects workspace package manifests. Returns `{ dir, json }` entries.
 */
export function collectWorkspacePackages(root = DEFAULT_ROOT) {
	const found = [];
	for (const workspaceDir of WORKSPACE_DIRS) {
		const base = path.join(root, workspaceDir);
		if (!existsSync(base)) continue;
		for (const entry of readdirSync(base, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const dir = path.join(base, entry.name);
			const json = readJsonOrNull(path.join(dir, "package.json"));
			if (json?.name) found.push({ dir, json });
		}
	}
	return found;
}

/**
 * Resolves a dependency name to its installed manifest, walking `node_modules`
 * from `fromDir` up to `root` the way the runtime resolver would.
 */
function resolveInstalled(root, fromDir, name) {
	let current = fromDir;
	for (;;) {
		const candidate = path.join(current, "node_modules", name, "package.json");
		const json = readJsonOrNull(candidate);
		if (json) return { dir: path.join(current, "node_modules", name), json };
		if (current === root) return null;
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

/**
 * Names reachable through the runtime dependency closure of publishable
 * workspace packages.
 *
 * Walks the installed tree rather than the lockfile: `bun.lock` is JSONC with
 * trailing commas that neither `JSON.parse` nor `Bun.file().json()` accepts, and
 * the installed tree reflects real resolution (including nesting) anyway.
 * Workspace-to-workspace links are symlinks, so a publishable package depending
 * on another is followed transparently.
 */
export function collectShippedNames(root = DEFAULT_ROOT, workspacePackages) {
	const packages = workspacePackages ?? collectWorkspacePackages(root);
	const publishable = packages.filter(({ json }) => json.private !== true);

	const shipped = new Set();
	const queue = [];

	for (const { dir, json } of publishable) {
		for (const field of [
			"dependencies",
			"optionalDependencies",
			"peerDependencies",
		]) {
			for (const name of Object.keys(json[field] ?? {})) {
				queue.push({ name, fromDir: dir });
			}
		}
	}

	while (queue.length > 0) {
		const { name, fromDir } = queue.pop();
		if (shipped.has(name)) continue;
		// Record the name even when it cannot be resolved on disk — an
		// unresolvable dependency of a shipped package is still shipped, and
		// treating it as dev-only would be the unsafe direction.
		shipped.add(name);

		const resolved = resolveInstalled(root, fromDir, name);
		if (!resolved) continue;
		for (const field of ["dependencies", "optionalDependencies"]) {
			for (const dep of Object.keys(resolved.json[field] ?? {})) {
				if (!shipped.has(dep)) queue.push({ name: dep, fromDir: resolved.dir });
			}
		}
	}

	return shipped;
}

/**
 * Flattens `bun audit --json` output.
 *
 * Shape is `{ "<package>": [{ id, url, title, severity, vulnerable_versions }] }`.
 * An empty object means no findings.
 */
export function collectFindings(auditJson, shippedNames = new Set()) {
	if (!auditJson || typeof auditJson !== "object") return [];

	const findings = [];
	for (const [packageName, advisories] of Object.entries(auditJson)) {
		if (!Array.isArray(advisories)) continue;
		for (const advisory of advisories) {
			findings.push({
				packageName,
				severity: String(advisory?.severity ?? "low").toLowerCase(),
				title: advisory?.title ?? "(untitled advisory)",
				url: advisory?.url ?? "",
				ghsa: advisoryId(advisory?.url),
				vulnerableVersions: advisory?.vulnerable_versions ?? "",
				shipped: shippedNames.has(packageName),
			});
		}
	}

	return findings.sort(
		(a, b) =>
			Number(b.shipped) - Number(a.shipped) ||
			severityRank(b.severity) - severityRank(a.severity) ||
			a.packageName.localeCompare(b.packageName),
	);
}

export function countBySeverity(findings) {
	const counts = {};
	for (const severity of SEVERITY_ORDER) counts[severity] = 0;
	for (const finding of findings) {
		if (finding.severity in counts) counts[finding.severity] += 1;
	}
	return counts;
}

export function formatCounts(counts) {
	const parts = [...SEVERITY_ORDER]
		.reverse()
		.filter((severity) => counts[severity] > 0)
		.map((severity) => `${counts[severity]} ${severity}`);
	return parts.length > 0 ? parts.join(", ") : "none";
}

/**
 * Splits findings into blocking, allowed-but-shipped, and dev-only buckets, and
 * reports allowlist entries that no longer match anything.
 */
export function classifyFindings(
	findings,
	{
		shippedFailLevel = SHIPPED_FAIL_LEVEL,
		devReportLevel = DEV_REPORT_LEVEL,
		allowlist = SHIPPED_ALLOWLIST,
	} = {},
) {
	const shipped = findings.filter((finding) => finding.shipped);
	const dev = findings.filter(
		(finding) =>
			!finding.shipped && meetsLevel(finding.severity, devReportLevel),
	);

	const atOrAboveLevel = shipped.filter((finding) =>
		meetsLevel(finding.severity, shippedFailLevel),
	);
	const allowed = atOrAboveLevel.filter((finding) => finding.ghsa in allowlist);
	const blocking = atOrAboveLevel.filter(
		(finding) => !(finding.ghsa in allowlist),
	);

	const matchedIds = new Set(findings.map((finding) => finding.ghsa));
	const staleAllowlistIds = Object.keys(allowlist).filter(
		(id) => !matchedIds.has(id),
	);

	return { shipped, dev, blocking, allowed, staleAllowlistIds };
}

function runBunAudit() {
	const result = spawnSync("bun", ["audit", "--json"], {
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	});

	if (result.error) {
		return {
			ok: false,
			reason: `could not run \`bun audit\`: ${result.error.message}`,
		};
	}

	const stdout = (result.stdout ?? "").trim();

	// `bun audit` exits non-zero when it finds advisories, which is not an error
	// for our purposes — the classification below decides. But an unparseable
	// payload means the audit itself failed (offline, registry outage, CLI
	// change), and that must not be mistaken for a clean tree.
	if (stdout === "") {
		const stderr = (result.stderr ?? "").trim();
		return {
			ok: false,
			reason: `\`bun audit\` produced no JSON output${stderr ? `: ${stderr}` : ""}`,
		};
	}

	try {
		return { ok: true, auditJson: JSON.parse(stdout) };
	} catch (cause) {
		return {
			ok: false,
			reason: `could not parse \`bun audit --json\` output: ${cause.message}`,
		};
	}
}

function writeStepSummary(lines) {
	const summaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (!summaryPath) return;
	try {
		appendFileSync(summaryPath, `${lines.join("\n")}\n`);
	} catch {
		// A summary is a nicety; never fail the gate over it.
	}
}

function printFinding(finding, marker) {
	console.log(
		`  [${marker}] ${finding.severity.padEnd(8)} ${finding.packageName} ${finding.vulnerableVersions}`.trimEnd(),
	);
	console.log(`           ${finding.title}`);
	if (finding.url) console.log(`           ${finding.url}`);
}

if (import.meta.main) {
	const audit = runBunAudit();

	if (!audit.ok) {
		console.error(`[check-audit] FAILED: ${audit.reason}`);
		console.error(
			"[check-audit] Treating an audit that could not run as a failure — an unreadable result is not a clean result.",
		);
		process.exit(1);
	}

	const workspacePackages = collectWorkspacePackages(DEFAULT_ROOT);
	const publishableCount = workspacePackages.filter(
		({ json }) => json.private !== true,
	).length;
	const shippedNames = collectShippedNames(DEFAULT_ROOT, workspacePackages);
	const findings = collectFindings(audit.auditJson, shippedNames);
	const { shipped, dev, blocking, allowed, staleAllowlistIds } =
		classifyFindings(findings);

	console.log(
		`[check-audit] ${shippedNames.size} package name(s) reachable from the runtime closure of ${publishableCount} publishable workspace package(s)`,
	);

	if (findings.length === 0) {
		console.log("[check-audit] OK: bun audit reports no known vulnerabilities");
		writeStepSummary(["### Dependency audit", "", "No known vulnerabilities."]);
		process.exit(0);
	}

	console.log(
		`[check-audit] ${findings.length} finding(s): ${shipped.length} on shipped paths (${formatCounts(countBySeverity(shipped))}), ${dev.length} dev-only (${formatCounts(countBySeverity(dev))})`,
	);
	console.log(
		`[check-audit] Shipped findings fail at severity >= ${SHIPPED_FAIL_LEVEL}. Dev-only findings never fail.`,
	);

	if (shipped.length > 0) {
		console.log("[check-audit] Shipped:");
		for (const finding of shipped) {
			const marker = blocking.includes(finding)
				? "FAIL"
				: allowed.includes(finding)
					? "allow"
					: "warn";
			printFinding(finding, marker);
			if (allowed.includes(finding)) {
				console.log(`           allowed: ${SHIPPED_ALLOWLIST[finding.ghsa]}`);
			}
		}
	}

	if (dev.length > 0) {
		console.log("[check-audit] Dev-only (reported, not blocking):");
		for (const finding of dev) printFinding(finding, "dev");
	}

	writeStepSummary([
		"### Dependency audit",
		"",
		`**${shipped.length}** finding(s) on shipped paths — ${formatCounts(countBySeverity(shipped))}.`,
		`**${dev.length}** dev-only finding(s) — ${formatCounts(countBySeverity(dev))}, never blocking.`,
		"",
		`Shipped means reachable through the \`dependencies\` closure of a publishable package. Gate fails on shipped findings at severity >= \`${SHIPPED_FAIL_LEVEL}\`.`,
		"",
		"| Scope | Severity | Package | Vulnerable | Advisory |",
		"| --- | --- | --- | --- | --- |",
		...[...shipped, ...dev].map(
			(finding) =>
				`| ${finding.shipped ? (blocking.includes(finding) ? "**shipped**" : "shipped (allowed)") : "dev"} | ${finding.severity} | \`${finding.packageName}\` | \`${finding.vulnerableVersions}\` | [${finding.ghsa || finding.title}](${finding.url}) |`,
		),
	]);

	if (staleAllowlistIds.length > 0) {
		console.error(
			`[check-audit] FAILED: ${staleAllowlistIds.length} allowlist entry/entries no longer match any finding and must be removed:`,
		);
		for (const id of staleAllowlistIds) {
			console.error(`  - ${id}: ${SHIPPED_ALLOWLIST[id]}`);
		}
		process.exit(1);
	}

	if (blocking.length > 0) {
		console.error(
			`[check-audit] FAILED: ${blocking.length} unaccepted finding(s) on shipped paths at or above ${SHIPPED_FAIL_LEVEL}`,
		);
		process.exit(1);
	}

	console.log(
		`[check-audit] OK: no unaccepted shipped findings. Accepted: ${allowed.length} (${ALLOWLIST_CONTEXT})`,
	);
}
