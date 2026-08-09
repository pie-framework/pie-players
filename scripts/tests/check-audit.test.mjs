import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	SEVERITY_ORDER,
	advisoryId,
	classifyFindings,
	collectFindings,
	collectShippedNames,
	collectWorkspacePackages,
	countBySeverity,
	formatCounts,
	meetsLevel,
	severityRank,
} from "../check-audit.mjs";

const SAMPLE_AUDIT = {
	"brace-expansion": [
		{
			url: "https://github.com/advisories/GHSA-mh99-v99m-4gvg",
			title: "brace-expansion: DoS via unbounded expansion length",
			severity: "high",
			vulnerable_versions: ">=2.0.0 <2.1.3",
		},
	],
	dompurify: [
		{
			url: "https://github.com/advisories/GHSA-hpcv-96wg-7vj8",
			title: "DOMPurify: cross-realm IN_PLACE sanitization",
			severity: "moderate",
			vulnerable_versions: "<=3.4.5",
		},
		{
			url: "https://github.com/advisories/GHSA-c2j3-45gr-mqc4",
			title: "DOMPurify: CUSTOM_ELEMENT_HANDLING bypass",
			severity: "low",
			vulnerable_versions: "<=3.4.11",
		},
	],
};

/** dompurify ships; brace-expansion is build tooling. */
const SHIPPED = new Set(["dompurify"]);

function write(root, relPath, content) {
	const absPath = path.join(root, relPath);
	mkdirSync(path.dirname(absPath), { recursive: true });
	writeFileSync(absPath, content);
}

function pkg(json) {
	return JSON.stringify(json);
}

/**
 * Fixture shaped like the real repo: a publishable package with a runtime dep
 * and a dev dep, plus a private package whose *runtime* dep must still count as
 * dev-only because the package is never published.
 */
function createFixtureRoot() {
	const root = mkdtempSync(path.join(tmpdir(), "pie-check-audit-"));

	write(root, "package.json", pkg({ name: "root", private: true }));

	write(
		root,
		"packages/shared/package.json",
		pkg({
			name: "@scope/shared",
			dependencies: { sanitizer: "^1.0.0" },
			devDependencies: { bundler: "^1.0.0" },
			peerDependencies: { framework: "^1.0.0" },
		}),
	);

	write(
		root,
		"packages/cli/package.json",
		pkg({
			name: "@scope/cli",
			private: true,
			dependencies: { "cli-core": "^1.0.0" },
		}),
	);

	write(
		root,
		"apps/demo/package.json",
		pkg({ name: "@scope/demo", private: true }),
	);

	// Installed tree. `sanitizer` pulls a transitive runtime dep; `bundler` and
	// `cli-core` pull their own, which must not be classified as shipped.
	write(
		root,
		"node_modules/sanitizer/package.json",
		pkg({
			name: "sanitizer",
			version: "1.0.0",
			dependencies: { "deep-util": "^1.0.0" },
		}),
	);
	write(
		root,
		"node_modules/deep-util/package.json",
		pkg({ name: "deep-util", version: "1.0.0" }),
	);
	write(
		root,
		"node_modules/bundler/package.json",
		pkg({
			name: "bundler",
			version: "1.0.0",
			dependencies: { "build-only": "^1.0.0" },
		}),
	);
	write(
		root,
		"node_modules/build-only/package.json",
		pkg({ name: "build-only", version: "1.0.0" }),
	);
	write(
		root,
		"node_modules/cli-core/package.json",
		pkg({ name: "cli-core", version: "1.0.0" }),
	);
	write(
		root,
		"node_modules/framework/package.json",
		pkg({ name: "framework", version: "1.0.0" }),
	);

	return root;
}

describe("severity ranking", () => {
	test("orders lowest to highest", () => {
		expect(SEVERITY_ORDER).toEqual(["low", "moderate", "high", "critical"]);
		expect(severityRank("critical")).toBeGreaterThan(severityRank("high"));
	});

	test("is case insensitive", () => {
		expect(severityRank("HIGH")).toBe(severityRank("high"));
	});

	test("treats an unknown severity as the lowest rank rather than throwing", () => {
		expect(severityRank("spicy")).toBe(0);
	});

	test("meetsLevel is inclusive at the boundary", () => {
		expect(meetsLevel("low", "low")).toBe(true);
		expect(meetsLevel("moderate", "high")).toBe(false);
	});
});

describe("advisoryId", () => {
	test("extracts the GHSA id from an advisory URL", () => {
		expect(
			advisoryId("https://github.com/advisories/GHSA-hpcv-96wg-7vj8"),
		).toBe("GHSA-hpcv-96wg-7vj8");
	});

	test("returns empty string when there is no id to find", () => {
		expect(advisoryId("")).toBe("");
		expect(advisoryId(undefined)).toBe("");
		expect(advisoryId("https://example.com/nope")).toBe("");
	});
});

describe("shipped closure", () => {
	test("includes runtime deps of publishable packages, transitively", () => {
		const root = createFixtureRoot();
		const shipped = collectShippedNames(root);

		expect(shipped.has("sanitizer")).toBe(true);
		expect(shipped.has("deep-util")).toBe(true);
	});

	test("includes peerDependencies — the consumer installs those into the running app", () => {
		const root = createFixtureRoot();

		expect(collectShippedNames(root).has("framework")).toBe(true);
	});

	test("excludes devDependencies of publishable packages", () => {
		const root = createFixtureRoot();
		const shipped = collectShippedNames(root);

		expect(shipped.has("bundler")).toBe(false);
		expect(shipped.has("build-only")).toBe(false);
	});

	test("excludes runtime deps of private packages — nothing there is published", () => {
		const root = createFixtureRoot();
		const shipped = collectShippedNames(root);

		// The real case this guards: @oclif/core is a `dependencies` entry, but
		// its package is private, so it never reaches a consumer.
		expect(shipped.has("cli-core")).toBe(false);
	});

	test("counts an unresolvable dependency as shipped rather than dev-only", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/ghost/package.json",
			pkg({
				name: "@scope/ghost",
				dependencies: { "never-installed": "^1.0.0" },
			}),
		);

		expect(collectShippedNames(root).has("never-installed")).toBe(true);
	});

	test("collectWorkspacePackages finds packages and apps but tolerates missing dirs", () => {
		const root = createFixtureRoot();
		const names = collectWorkspacePackages(root).map(({ json }) => json.name);

		expect(names).toContain("@scope/shared");
		expect(names).toContain("@scope/demo");
		expect(names).not.toContain("root");
	});
});

describe("collectFindings", () => {
	test("tags each finding with shipped and its GHSA id", () => {
		const findings = collectFindings(SAMPLE_AUDIT, SHIPPED);

		const dompurify = findings.filter((f) => f.packageName === "dompurify");
		expect(dompurify).toHaveLength(2);
		expect(dompurify.every((f) => f.shipped)).toBe(true);
		expect(dompurify[0].ghsa).toStartWith("GHSA-");

		const brace = findings.find((f) => f.packageName === "brace-expansion");
		expect(brace.shipped).toBe(false);
	});

	test("sorts shipped findings ahead of higher-severity dev findings", () => {
		const findings = collectFindings(SAMPLE_AUDIT, SHIPPED);

		// The dev finding is `high`; shipped ones are moderate/low. Scope wins.
		expect(findings[0].shipped).toBe(true);
		expect(findings.at(-1).packageName).toBe("brace-expansion");
	});

	test("treats an unknown package as dev-only when no shipped set is given", () => {
		expect(collectFindings(SAMPLE_AUDIT).every((f) => !f.shipped)).toBe(true);
	});

	test("tolerates missing or malformed payloads", () => {
		expect(collectFindings(null)).toEqual([]);
		expect(collectFindings("nope")).toEqual([]);
		expect(collectFindings({ weird: { severity: "high" } })).toEqual([]);
	});

	test("defaults a missing severity to low rather than dropping the finding", () => {
		const findings = collectFindings({ mystery: [{ title: "no severity" }] });
		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe("low");
	});
});

describe("counts", () => {
	test("counts and formats highest severity first", () => {
		const counts = countBySeverity(collectFindings(SAMPLE_AUDIT, SHIPPED));
		expect(counts).toEqual({ low: 1, moderate: 1, high: 1, critical: 0 });
		expect(formatCounts(counts)).toBe("1 high, 1 moderate, 1 low");
	});

	test("formats a clean tree as none", () => {
		expect(formatCounts(countBySeverity([]))).toBe("none");
	});
});

describe("classifyFindings", () => {
	const findings = collectFindings(SAMPLE_AUDIT, SHIPPED);

	test("blocks shipped findings and never blocks dev ones", () => {
		const { blocking, dev } = classifyFindings(findings, { allowlist: {} });

		expect(blocking.map((f) => f.packageName)).toEqual([
			"dompurify",
			"dompurify",
		]);
		// The dev finding is `high` — more severe than either shipped one — and
		// still does not block. That inversion is the whole point of the gate.
		expect(dev.map((f) => f.packageName)).toEqual(["brace-expansion"]);
	});

	test("a low-severity shipped finding blocks under the strict default", () => {
		const { blocking } = classifyFindings(findings, { allowlist: {} });
		expect(blocking.some((f) => f.severity === "low")).toBe(true);
	});

	test("allowlisted shipped findings move out of blocking but stay visible", () => {
		const { blocking, allowed, shipped } = classifyFindings(findings, {
			allowlist: { "GHSA-hpcv-96wg-7vj8": "accepted for test" },
		});

		expect(allowed).toHaveLength(1);
		expect(blocking).toHaveLength(1);
		expect(shipped).toHaveLength(2);
	});

	test("reports allowlist entries that no longer match any finding", () => {
		const { staleAllowlistIds } = classifyFindings(findings, {
			allowlist: { "GHSA-does-not-exist": "left behind after a bump" },
		});

		expect(staleAllowlistIds).toEqual(["GHSA-does-not-exist"]);
	});

	test("an allowlist matching every current finding is not stale", () => {
		const { staleAllowlistIds } = classifyFindings(findings, {
			allowlist: { "GHSA-hpcv-96wg-7vj8": "accepted for test" },
		});

		expect(staleAllowlistIds).toEqual([]);
	});

	test("raising the shipped fail level narrows blocking without hiding findings", () => {
		const { blocking, shipped } = classifyFindings(findings, {
			shippedFailLevel: "high",
			allowlist: {},
		});

		expect(blocking).toEqual([]);
		expect(shipped).toHaveLength(2);
	});

	test("dev report level filters the dev list only", () => {
		const { dev, blocking } = classifyFindings(findings, {
			devReportLevel: "critical",
			allowlist: {},
		});

		expect(dev).toEqual([]);
		expect(blocking).toHaveLength(2);
	});
});
