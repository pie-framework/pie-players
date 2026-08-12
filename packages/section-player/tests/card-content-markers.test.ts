import { describe, expect, it } from "bun:test";
import type { ToolRegistration } from "@pie-players/pie-assessment-toolkit";
import {
	CONTENT_MARKER_SURFACE,
	resolveContentMarkerClasses,
} from "../src/components/shared/card-content-markers.js";

const OWNER_CONTEXT = { kind: "item", itemId: "item-1" } as never;

const baseArgs = (overrides: Record<string, unknown> = {}) => ({
	tools: [] as ToolRegistration[],
	decideFeature: () => null,
	catalogResolver: null,
	ownerContext: OWNER_CONTEXT,
	entity: { id: "item-1" },
	...overrides,
});

/** A marker capability with a content dependency, as a real one has. */
const markerTool = (
	overrides: Partial<ToolRegistration> = {},
): ToolRegistration =>
	({
		toolId: "demoMarker",
		name: "Demo",
		description: "Demo marker capability",
		supportedLevels: ["item"],
		activation: "region",
		surfaces: [CONTENT_MARKER_SURFACE],
		pnpSupportIds: ["demoSupport"],
		requiresAuthoredContent: { resolve: () => ({ present: true }) },
		markContent: { resolve: () => ["demo-class"] },
		...overrides,
	}) as ToolRegistration;

describe("resolveContentMarkerClasses", () => {
	it("applies nothing when no capability is registered", () => {
		expect(resolveContentMarkerClasses(baseArgs())).toEqual([]);
	});

	it("applies nothing when policy granted nothing", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({ tools: [markerTool()] }),
		);
		expect(classes).toEqual([]);
	});

	it("applies the capability's classes when granted and content resolves", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [markerTool()],
				decideFeature: (id: string) =>
					id === "demoSupport" ? { granted: true } : null,
			}),
		);
		expect(classes).toEqual(["demo-class"]);
	});

	it("applies nothing when granted but the content is absent", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [
					markerTool({ requiresAuthoredContent: { resolve: () => null } }),
				],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(classes).toEqual([]);
	});

	it("consults a resolvesWithoutGrant capability with granted false", () => {
		const seen: boolean[] = [];
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [
					markerTool({
						resolvesWithoutGrant: true,
						requiresAuthoredContent: {
							resolve: (context) => {
								seen.push(context.granted);
								return { present: true };
							},
						},
					}),
				],
			}),
		);
		expect(seen).toEqual([false]);
		expect(classes).toEqual(["demo-class"]);
	});

	it("lets the capability decline on its own when there is no grant", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [
					markerTool({
						resolvesWithoutGrant: true,
						markContent: {
							resolve: (context) => (context.granted ? ["demo-class"] : null),
						},
					}),
				],
			}),
		);
		expect(classes).toEqual([]);
	});

	it("passes the resolved content and the granted support id to the marker", () => {
		let received: unknown = null;
		resolveContentMarkerClasses(
			baseArgs({
				tools: [
					markerTool({
						markContent: {
							resolve: (context) => {
								received = context;
								return null;
							},
						},
					}),
				],
				decideFeature: () => ({ granted: true, parameters: { size: "lg" } }),
			}),
		);
		expect(received).toMatchObject({
			toolId: "demoMarker",
			featureId: "demoSupport",
			surface: CONTENT_MARKER_SURFACE,
			granted: true,
			parameters: { size: "lg" },
			content: { present: true },
		});
	});

	it("drops values that are not single class tokens", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [
					markerTool({
						markContent: {
							resolve: () =>
								[
									"good",
									"two tokens",
									"",
									"   ",
									42,
									null,
								] as unknown as string[],
						},
					}),
				],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(classes).toEqual(["good"]);
	});

	it("deduplicates and orders classes across capabilities", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [
					markerTool({
						toolId: "a",
						markContent: { resolve: () => ["zeta", "beta"] },
					}),
					markerTool({ toolId: "b", markContent: { resolve: () => ["beta"] } }),
				],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(classes).toEqual(["beta", "zeta"]);
	});

	it("caps how many classes one capability can contribute", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [
					markerTool({
						markContent: {
							resolve: () => Array.from({ length: 20 }, (_, i) => `c${i}`),
						},
					}),
				],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(classes).toHaveLength(8);
	});

	it("survives a capability that throws in either half", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [
					markerTool({
						toolId: "throws-content",
						requiresAuthoredContent: {
							resolve: () => {
								throw new Error("boom");
							},
						},
					}),
					markerTool({
						toolId: "throws-marker",
						markContent: {
							resolve: () => {
								throw new Error("boom");
							},
						},
					}),
					markerTool({ toolId: "ok" }),
				],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(classes).toEqual(["demo-class"]);
	});

	it("ignores a capability registered on the surface with no marker", () => {
		const classes = resolveContentMarkerClasses(
			baseArgs({
				tools: [markerTool({ markContent: undefined })],
				decideFeature: () => ({ granted: true }),
			}),
		);
		expect(classes).toEqual([]);
	});
});
