import { expect, test } from "@playwright/test";
import {
	DEFAULT_SECTION_PLAYER_POLICIES,
	isPreloadEnabled,
	isTelemetryEnabled,
} from "../src/policies/index.js";
import type { SectionPlayerPolicies } from "../src/policies/types.js";

test.describe("section player policy invariants", () => {
	test("default policy set is complete and stable", async () => {
		const policyKeys = Object.keys(
			DEFAULT_SECTION_PLAYER_POLICIES as Record<string, unknown>,
		);
		expect(policyKeys.sort()).toEqual(
			["focus", "preload", "readiness", "telemetry"].sort(),
		);
		expect(DEFAULT_SECTION_PLAYER_POLICIES.readiness.mode).toBe("progressive");
		expect(DEFAULT_SECTION_PLAYER_POLICIES.preload.enabled).toBe(true);
		expect(DEFAULT_SECTION_PLAYER_POLICIES.telemetry.enabled).toBe(true);
	});

	test("policy typing allows partial runtime overrides", async () => {
		const override: Partial<SectionPlayerPolicies> = {
			readiness: { mode: "strict" },
			preload: { enabled: false },
		};
		expect(override.readiness?.mode).toBe("strict");
		expect(override.preload?.enabled).toBe(false);
	});

	test("isPreloadEnabled defaults to true and respects explicit opt-out", async () => {
		expect(isPreloadEnabled(undefined)).toBe(true);
		expect(isPreloadEnabled(null)).toBe(true);
		expect(isPreloadEnabled({} as SectionPlayerPolicies)).toBe(true);
		expect(isPreloadEnabled(DEFAULT_SECTION_PLAYER_POLICIES)).toBe(true);
		expect(
			isPreloadEnabled({
				...DEFAULT_SECTION_PLAYER_POLICIES,
				preload: { enabled: true },
			}),
		).toBe(true);
		expect(
			isPreloadEnabled({
				...DEFAULT_SECTION_PLAYER_POLICIES,
				preload: { enabled: false },
			}),
		).toBe(false);
	});

	test("isTelemetryEnabled defaults to true and respects explicit opt-out", async () => {
		expect(isTelemetryEnabled(undefined)).toBe(true);
		expect(isTelemetryEnabled(null)).toBe(true);
		expect(isTelemetryEnabled({} as SectionPlayerPolicies)).toBe(true);
		expect(isTelemetryEnabled(DEFAULT_SECTION_PLAYER_POLICIES)).toBe(true);
		expect(
			isTelemetryEnabled({
				...DEFAULT_SECTION_PLAYER_POLICIES,
				telemetry: { enabled: true },
			}),
		).toBe(true);
		expect(
			isTelemetryEnabled({
				...DEFAULT_SECTION_PLAYER_POLICIES,
				telemetry: { enabled: false },
			}),
		).toBe(false);
	});
});
