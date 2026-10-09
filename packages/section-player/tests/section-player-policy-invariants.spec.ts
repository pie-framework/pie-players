import { expect, test } from "@playwright/test";
import {
	DEFAULT_SECTION_PLAYER_POLICIES,
	resolveSectionPlayerPolicies,
} from "../src/policies/index.js";
import type { SectionPlayerPolicies } from "../src/policies/types.js";

test.describe("section player policy invariants", () => {
	test("default policy set is complete and stable", async () => {
		const policyKeys = Object.keys(
			DEFAULT_SECTION_PLAYER_POLICIES as Record<string, unknown>,
		);
		expect(policyKeys.sort()).toEqual(
			["preload", "readiness", "telemetry"].sort(),
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

	test("preload and telemetry default on and honor an explicit opt-out", async () => {
		const partial = (value: unknown) => value as SectionPlayerPolicies;
		for (const input of [undefined, null, partial({})]) {
			const resolved = resolveSectionPlayerPolicies(input);
			expect(resolved.preload.enabled).toBe(true);
			expect(resolved.telemetry.enabled).toBe(true);
		}
		const optedOut = resolveSectionPlayerPolicies(
			partial({ preload: { enabled: false }, telemetry: { enabled: false } }),
		);
		expect(optedOut.preload.enabled).toBe(false);
		expect(optedOut.telemetry.enabled).toBe(false);
	});

	test("resolveSectionPlayerPolicies fills every unset field from the defaults", async () => {
		const partial = (value: unknown) => value as SectionPlayerPolicies;
		expect(resolveSectionPlayerPolicies(undefined)).toEqual(
			DEFAULT_SECTION_PLAYER_POLICIES,
		);
		expect(resolveSectionPlayerPolicies(null)).toEqual(
			DEFAULT_SECTION_PLAYER_POLICIES,
		);
		expect(
			resolveSectionPlayerPolicies(partial({ preload: { enabled: false } })),
		).toEqual({
			...DEFAULT_SECTION_PLAYER_POLICIES,
			preload: { enabled: false },
		});
		expect(
			resolveSectionPlayerPolicies(partial({ readiness: { mode: "strict" } })),
		).toEqual({
			...DEFAULT_SECTION_PLAYER_POLICIES,
			readiness: { mode: "strict" },
		});
		expect(resolveSectionPlayerPolicies(partial({ readiness: {} }))).toEqual(
			DEFAULT_SECTION_PLAYER_POLICIES,
		);
	});
});
