/**
 * Host gates on the feature-scoped path.
 *
 * `tools.policy.allowed` / `blocked` name capabilities rather than placements,
 * so they are the only host lever over a capability that renders as its own
 * surface — configuration validation rejects a `region` capability from
 * `tools.placement`, and the feature path deliberately ignores placement. Before
 * this, `decideFeature(...)` consulted only the PNP source, so a host blocklist
 * entry was silently inert for exactly the capabilities it was the sole lever
 * for.
 */

import { describe, expect, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import { ToolPolicyEngine } from "../../src/policy/core/ToolPolicyEngine.js";
import { isHostDeniedFeature } from "../../src/policy/core/feature-decision.js";
import { normalizeToolsConfig } from "../../src/services/tools-config-normalizer.js";
import { ToolRegistry } from "../../src/services/ToolRegistry.js";

const FEATURE = "transcript";

const granting = {
	id: "a1",
	personalNeedsProfile: { supports: [FEATURE] },
} as AssessmentEntity;

function engine(policy: { allowed?: string[]; blocked?: string[] }) {
	return new ToolPolicyEngine({
		toolRegistry: new ToolRegistry(),
		inputs: {
			assessment: granting,
			tools: normalizeToolsConfig({
				policy,
				placement: { section: [], item: [], passage: [] },
				providers: {},
			}),
		},
	});
}

describe("host gates on feature decisions", () => {
	test("a blocked feature is denied even when a profile grants it", () => {
		const decision = engine({ blocked: [FEATURE] }).decideFeature(FEATURE);
		expect(decision).toMatchObject({
			granted: false,
			action: "block",
			rule: "host-blocked",
			precedence: 0,
			sourceType: "host",
		});
		expect(isHostDeniedFeature(decision)).toBe(true);
	});

	test("a non-empty allowlist that omits the feature denies it", () => {
		const decision = engine({ allowed: ["calculator"] }).decideFeature(FEATURE);
		expect(decision).toMatchObject({
			granted: false,
			action: "block",
			rule: "host-allowlist",
			precedence: 0,
		});
		expect(decision.reason).toContain("calculator");
	});

	test("an allowlist naming the feature leaves the policy read intact", () => {
		const decision = engine({ allowed: [FEATURE] }).decideFeature(FEATURE);
		expect(decision).toMatchObject({ granted: true, rule: "pnp-support" });
		expect(isHostDeniedFeature(decision)).toBe(false);
	});

	test("blocked wins over allowed, as it does on the placement path", () => {
		const decision = engine({
			allowed: [FEATURE],
			blocked: [FEATURE],
		}).decideFeature(FEATURE);
		expect(decision.rule).toBe("host-blocked");
	});

	test("an empty policy is not an allowlist of nothing", () => {
		const decision = engine({}).decideFeature(FEATURE);
		expect(decision).toMatchObject({ granted: true, rule: "pnp-support" });
	});

	test("a host denial reports assessmentBound, so a debugger can tell it apart", () => {
		// The flag qualifies a *policy* denial ("nothing was bound to ask"). A host
		// blocklist is a verdict either way, and reporting it keeps one shape for
		// every denial a panel renders.
		const unbound = new ToolPolicyEngine({
			toolRegistry: new ToolRegistry(),
			inputs: {
				tools: normalizeToolsConfig({
					policy: { blocked: [FEATURE] },
					placement: { section: [], item: [], passage: [] },
					providers: {},
				}),
			},
		}).decideFeature(FEATURE);
		expect(unbound).toMatchObject({
			rule: "host-blocked",
			assessmentBound: false,
		});
	});
});
