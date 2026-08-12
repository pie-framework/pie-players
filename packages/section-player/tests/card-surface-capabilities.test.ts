import { describe, expect, it } from "bun:test";
import type { ToolRegistration } from "@pie-players/pie-assessment-toolkit";
import { CONTENT_LEAD_SURFACE } from "../src/components/shared/card-media-region.js";
import { resolveSurfaceCapabilities } from "../src/components/shared/card-surface-capabilities.js";

const OWNER_CONTEXT = { kind: "item", itemId: "item-1" } as never;

const baseArgs = (overrides: Record<string, unknown> = {}) => ({
	tools: [] as ToolRegistration[],
	decideFeature: () => null,
	catalogResolver: null,
	ownerContext: OWNER_CONTEXT,
	entity: { id: "item-1" },
	...overrides,
});

/** A region capability with a content dependency, as a real one has. */
const capability = (
	overrides: Partial<ToolRegistration> = {},
): ToolRegistration =>
	({
		toolId: "demoAlternate",
		name: "Demo",
		description: "Demo region capability",
		supportedLevels: ["item"],
		activation: "region",
		surfaces: [CONTENT_LEAD_SURFACE],
		pnpSupportIds: ["demoSupport"],
		requiresAuthoredContent: { resolve: () => ({ text: "hello" }) },
		renderSurface: () => null,
		...overrides,
	}) as ToolRegistration;

describe("resolveSurfaceCapabilities", () => {
	it("clears nothing when no capability is registered", () => {
		expect(resolveSurfaceCapabilities(baseArgs())).toEqual([]);
	});

	it("clears nothing when policy granted nothing", () => {
		expect(
			resolveSurfaceCapabilities(baseArgs({ tools: [capability()] })),
		).toEqual([]);
	});

	it("clears a capability whose support id is granted and whose content resolves", () => {
		expect(
			resolveSurfaceCapabilities(
				baseArgs({
					tools: [capability()],
					decideFeature: (id: string) =>
						id === "demoSupport" ? { granted: true } : null,
				}),
			),
		).toEqual([
			{
				toolId: "demoAlternate",
				featureId: "demoSupport",
				parameters: undefined,
				content: { text: "hello" },
			},
		]);
	});

	it("clears nothing when granted but the content is absent", () => {
		expect(
			resolveSurfaceCapabilities(
				baseArgs({
					tools: [
						capability({ requiresAuthoredContent: { resolve: () => null } }),
					],
					decideFeature: () => ({ granted: true }),
				}),
			),
		).toEqual([]);
	});

	it("carries the policy parameters through to the caller", () => {
		const [entry] = resolveSurfaceCapabilities(
			baseArgs({
				tools: [capability()],
				decideFeature: () => ({
					granted: true,
					parameters: { signLang: "ase" },
				}),
			}),
		);
		expect(entry.parameters).toEqual({ signLang: "ase" });
	});

	it("consults a resolvesWithoutGrant capability with granted false", () => {
		const seen: boolean[] = [];
		const cleared = resolveSurfaceCapabilities(
			baseArgs({
				tools: [
					capability({
						resolvesWithoutGrant: true,
						requiresAuthoredContent: {
							resolve: (context) => {
								seen.push(context.granted);
								return { text: "authored" };
							},
						},
					}),
				],
			}),
		);
		expect(seen).toEqual([false]);
		expect(cleared).toHaveLength(1);
		expect(cleared[0].featureId).toBe("");
	});

	it("lets a resolvesWithoutGrant capability decline on its own", () => {
		expect(
			resolveSurfaceCapabilities(
				baseArgs({
					tools: [
						capability({
							resolvesWithoutGrant: true,
							requiresAuthoredContent: {
								// The accommodation case: no grant, so nothing to show.
								resolve: (context) => (context.granted ? { text: "x" } : null),
							},
						}),
					],
				}),
			),
		).toEqual([]);
	});

	it("reports granted true to a capability once policy grants it", () => {
		const seen: boolean[] = [];
		resolveSurfaceCapabilities(
			baseArgs({
				tools: [
					capability({
						resolvesWithoutGrant: true,
						requiresAuthoredContent: {
							resolve: (context) => {
								seen.push(context.granted);
								return { text: "x" };
							},
						},
					}),
				],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(seen).toEqual([true]);
	});

	it("clears a capability with no content dependency on the grant alone", () => {
		const cleared = resolveSurfaceCapabilities(
			baseArgs({
				tools: [capability({ requiresAuthoredContent: undefined })],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(cleared).toHaveLength(1);
		expect(cleared[0].content).toBeNull();
	});

	it("clears nothing for a capability with neither a grant nor a dependency", () => {
		expect(
			resolveSurfaceCapabilities(
				baseArgs({
					tools: [
						capability({
							requiresAuthoredContent: undefined,
							resolvesWithoutGrant: undefined,
						}),
					],
				}),
			),
		).toEqual([]);
	});

	it("survives a capability that throws while looking for its content", () => {
		const cleared = resolveSurfaceCapabilities(
			baseArgs({
				tools: [
					capability({
						toolId: "throws",
						requiresAuthoredContent: {
							resolve: () => {
								throw new Error("boom");
							},
						},
					}),
					capability({ toolId: "ok" }),
				],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(cleared.map((entry) => entry.toolId)).toEqual(["ok"]);
	});

	it("falls back to the tool id when a capability declares no support ids", () => {
		const cleared = resolveSurfaceCapabilities(
			baseArgs({
				tools: [capability({ pnpSupportIds: undefined })],
				decideFeature: (id: string) =>
					id === "demoAlternate" ? { granted: true } : null,
			}),
		);
		expect(cleared).toHaveLength(1);
		expect(cleared[0].featureId).toBe("demoAlternate");
	});

	it("preserves registration order across capabilities", () => {
		const cleared = resolveSurfaceCapabilities(
			baseArgs({
				tools: [
					capability({ toolId: "first" }),
					capability({ toolId: "second" }),
				],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(cleared.map((entry) => entry.toolId)).toEqual(["first", "second"]);
	});
});
