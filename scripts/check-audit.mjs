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
 * `bun audit` reads bun.lock directly and queries the registry advisory API, so
 * it sees what the graph cannot.
 *
 * Deliberately NOT wired into `verify:pre-commit` or `verify:pre-push`. It needs
 * network access, and advisory data changes independently of the code, so a
 * local hook would both break offline commits and fail for reasons unrelated to
 * the change being pushed. It runs as its own CI job instead.
 *
 * Threshold: `FAIL_LEVEL` below is what makes the build red. It is set to
 * `critical` because the tree currently carries known high findings, all in the
 * dev/build chain (see BASELINE_NOTE). Everything at or above `REPORT_LEVEL` is
 * always printed, so lowering the gate later is a one-line change once those are
 * cleared — the report does not hide what the gate tolerates.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

/** Severity ranking, lowest to highest. Mirrors the registry advisory levels. */
export const SEVERITY_ORDER = ["low", "moderate", "high", "critical"];

/** Fails the build at or above this severity. */
const FAIL_LEVEL = "critical";

/** Always printed at or above this severity, whether or not it fails. */
const REPORT_LEVEL = "low";

/**
 * As of 2026-08-05 the tree carries 17 findings: 7 high, 6 moderate, 4 low.
 * The highs are all transitive through build tooling — `fast-uri` and
 * `brace-expansion` via `vite-plugin-dts`/`oclif`/`glob`, `postcss` via `vite`.
 * The one that touches shipped runtime code is `dompurify`, a direct dependency
 * of `pie-players-shared`, whose findings are moderate and low.
 */
const BASELINE_NOTE =
	"Known baseline as of 2026-08-05: 7 high (all dev/build-chain), 6 moderate, 4 low.";

export function severityRank(severity) {
	const index = SEVERITY_ORDER.indexOf(String(severity).toLowerCase());
	return index === -1 ? 0 : index;
}

export function meetsLevel(severity, level) {
	return severityRank(severity) >= severityRank(level);
}

/**
 * Flattens `bun audit --json` output.
 *
 * Shape is `{ "<package>": [{ id, url, title, severity, vulnerable_versions }] }`.
 * An empty object means no findings.
 */
export function collectFindings(auditJson) {
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
				vulnerableVersions: advisory?.vulnerable_versions ?? "",
			});
		}
	}

	return findings.sort(
		(a, b) =>
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
 * Splits findings into what fails the build and what is only reported.
 */
export function partitionFindings(
	findings,
	{ failLevel = FAIL_LEVEL, reportLevel = REPORT_LEVEL } = {},
) {
	return {
		blocking: findings.filter((finding) =>
			meetsLevel(finding.severity, failLevel),
		),
		reported: findings.filter((finding) =>
			meetsLevel(finding.severity, reportLevel),
		),
	};
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
	// for our purposes — the threshold below decides. But an unparseable payload
	// means the audit itself failed (offline, registry outage, CLI change), and
	// that must not be mistaken for a clean tree.
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

if (import.meta.main) {
	const audit = runBunAudit();

	if (!audit.ok) {
		console.error(`[check-audit] FAILED: ${audit.reason}`);
		console.error(
			"[check-audit] Treating an audit that could not run as a failure — an unreadable result is not a clean result.",
		);
		process.exit(1);
	}

	const findings = collectFindings(audit.auditJson);
	const counts = countBySeverity(findings);
	const { blocking, reported } = partitionFindings(findings);

	if (findings.length === 0) {
		console.log("[check-audit] OK: bun audit reports no known vulnerabilities");
		writeStepSummary(["### Dependency audit", "", "No known vulnerabilities."]);
		process.exit(0);
	}

	console.log(
		`[check-audit] bun audit found ${findings.length} advisory finding(s): ${formatCounts(counts)}`,
	);
	console.log(`[check-audit] Build fails at severity >= ${FAIL_LEVEL}.`);

	for (const finding of reported) {
		const marker = meetsLevel(finding.severity, FAIL_LEVEL) ? "FAIL" : "warn";
		console.log(
			`  [${marker}] ${finding.severity.padEnd(8)} ${finding.packageName} ${finding.vulnerableVersions}`.trimEnd(),
		);
		console.log(`           ${finding.title}`);
		if (finding.url) console.log(`           ${finding.url}`);
	}

	writeStepSummary([
		"### Dependency audit",
		"",
		`\`bun audit\` found **${findings.length}** finding(s): ${formatCounts(counts)}.`,
		"",
		`Gate fails at severity >= \`${FAIL_LEVEL}\`. ${BASELINE_NOTE}`,
		"",
		"| Severity | Package | Vulnerable | Advisory |",
		"| --- | --- | --- | --- |",
		...reported.map(
			(finding) =>
				`| ${finding.severity} | \`${finding.packageName}\` | \`${finding.vulnerableVersions}\` | [${finding.title}](${finding.url}) |`,
		),
	]);

	if (blocking.length > 0) {
		console.error(
			`[check-audit] FAILED: ${blocking.length} finding(s) at or above ${FAIL_LEVEL}`,
		);
		process.exit(1);
	}

	console.log(
		`[check-audit] OK: no findings at or above ${FAIL_LEVEL}. ${BASELINE_NOTE}`,
	);
}
