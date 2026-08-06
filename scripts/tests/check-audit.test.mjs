import { describe, expect, test } from "bun:test";

import {
	SEVERITY_ORDER,
	collectFindings,
	countBySeverity,
	formatCounts,
	meetsLevel,
	partitionFindings,
	severityRank,
} from "../check-audit.mjs";

const SAMPLE_AUDIT = {
	"brace-expansion": [
		{
			id: 1,
			url: "https://github.com/advisories/GHSA-mh99-v99m-4gvg",
			title: "brace-expansion: DoS via unbounded expansion length",
			severity: "high",
			vulnerable_versions: ">=2.0.0 <2.1.3",
		},
	],
	dompurify: [
		{
			id: 2,
			url: "https://github.com/advisories/GHSA-hpcv-96wg-7vj8",
			title: "DOMPurify: cross-realm IN_PLACE sanitization",
			severity: "moderate",
			vulnerable_versions: "<=3.4.5",
		},
		{
			id: 3,
			url: "https://github.com/advisories/GHSA-c2j3-45gr-mqc4",
			title: "DOMPurify: CUSTOM_ELEMENT_HANDLING bypass",
			severity: "low",
			vulnerable_versions: "<=3.4.5",
		},
	],
};

describe("severity ranking", () => {
	test("orders lowest to highest", () => {
		expect(SEVERITY_ORDER).toEqual(["low", "moderate", "high", "critical"]);
		expect(severityRank("critical")).toBeGreaterThan(severityRank("high"));
		expect(severityRank("high")).toBeGreaterThan(severityRank("moderate"));
	});

	test("is case insensitive", () => {
		expect(severityRank("HIGH")).toBe(severityRank("high"));
	});

	test("treats an unknown severity as the lowest rank rather than throwing", () => {
		// A new registry severity label must not crash the gate.
		expect(severityRank("spicy")).toBe(0);
	});

	test("meetsLevel is inclusive at the boundary", () => {
		expect(meetsLevel("high", "high")).toBe(true);
		expect(meetsLevel("moderate", "high")).toBe(false);
		expect(meetsLevel("critical", "high")).toBe(true);
	});
});

describe("collectFindings", () => {
	test("flattens per-package advisories and sorts by descending severity", () => {
		const findings = collectFindings(SAMPLE_AUDIT);

		expect(findings).toHaveLength(3);
		expect(findings[0]).toMatchObject({
			packageName: "brace-expansion",
			severity: "high",
		});
		expect(findings.at(-1)).toMatchObject({
			packageName: "dompurify",
			severity: "low",
		});
	});

	test("returns nothing for a clean audit", () => {
		expect(collectFindings({})).toEqual([]);
	});

	test("tolerates a missing or non-object payload", () => {
		expect(collectFindings(null)).toEqual([]);
		expect(collectFindings(undefined)).toEqual([]);
		expect(collectFindings("nope")).toEqual([]);
	});

	test("skips entries whose value is not an array", () => {
		expect(collectFindings({ weird: { severity: "high" } })).toEqual([]);
	});

	test("defaults a missing severity to low rather than dropping the finding", () => {
		const findings = collectFindings({ mystery: [{ title: "no severity" }] });

		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe("low");
	});
});

describe("counts", () => {
	test("counts every severity bucket", () => {
		expect(countBySeverity(collectFindings(SAMPLE_AUDIT))).toEqual({
			low: 1,
			moderate: 1,
			high: 1,
			critical: 0,
		});
	});

	test("formats highest severity first and omits empty buckets", () => {
		expect(formatCounts(countBySeverity(collectFindings(SAMPLE_AUDIT)))).toBe(
			"1 high, 1 moderate, 1 low",
		);
	});

	test("formats a clean tree as none", () => {
		expect(formatCounts(countBySeverity([]))).toBe("none");
	});
});

describe("partitionFindings", () => {
	const findings = collectFindings(SAMPLE_AUDIT);

	test("blocks nothing below the fail level but still reports it", () => {
		const { blocking, reported } = partitionFindings(findings, {
			failLevel: "critical",
			reportLevel: "low",
		});

		expect(blocking).toEqual([]);
		expect(reported).toHaveLength(3);
	});

	test("blocks at the configured level so tightening the gate is one change", () => {
		const { blocking } = partitionFindings(findings, {
			failLevel: "high",
			reportLevel: "low",
		});

		expect(blocking).toHaveLength(1);
		expect(blocking[0].packageName).toBe("brace-expansion");
	});

	test("a critical finding blocks under the shipped default", () => {
		const withCritical = collectFindings({
			...SAMPLE_AUDIT,
			"something-bad": [
				{
					severity: "critical",
					title: "rce",
					url: "",
					vulnerable_versions: "*",
				},
			],
		});

		expect(partitionFindings(withCritical).blocking).toHaveLength(1);
	});

	test("report level can hide noise without changing what blocks", () => {
		const { blocking, reported } = partitionFindings(findings, {
			failLevel: "critical",
			reportLevel: "high",
		});

		expect(blocking).toEqual([]);
		expect(reported).toHaveLength(1);
	});
});
