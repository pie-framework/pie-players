import { expect, test } from "@playwright/test";
import { DEFAULT_SECTION_PLAYER_POLICIES } from "../src/policies/index.js";
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
	});

	test("policy typing allows partial runtime overrides", async () => {
		const override: Partial<SectionPlayerPolicies> = {
			readiness: { mode: "strict" },
			preload: { enabled: false },
		};
		expect(override.readiness?.mode).toBe("strict");
		expect(override.preload?.enabled).toBe(false);
	});
});
