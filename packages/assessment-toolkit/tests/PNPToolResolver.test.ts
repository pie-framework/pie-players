import { describe, expect, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import { PnpToolResolver } from "../src/services/PNPToolResolver.js";
import { ToolRegistry } from "../src/services/ToolRegistry.js";

describe("PnpToolResolver", () => {
	test("prohibitedSupports blocks even when supports omits the tool", () => {
		const resolver = new PnpToolResolver(new ToolRegistry());
		const result = resolver.resolveToolsWithProvenance({
			id: "a1",
			personalNeedsProfile: {
				prohibitedSupports: ["calculator"],
			},
		} as AssessmentEntity);

		expect(result.tools).toEqual([]);
		expect(result.provenance.decisionLog).toContainEqual(
			expect.objectContaining({
				rule: "pnp-prohibited",
				featureId: "calculator",
				action: "block",
			}),
		);
		expect(result.provenance.summary.blocked).toBe(1);
	});
});
