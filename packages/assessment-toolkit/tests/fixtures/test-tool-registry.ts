/**
 * Test-local capabilities for exercising this package.
 *
 * The toolkit's tests used to reach for `createPackagedToolRegistry()`, which is
 * how a test picked up eleven real registrations to satisfy the registry's
 * per-tool `supportedLevels` validation. That factory now lives in
 * `@pie-players/pie-default-tool-loaders`, which depends on this package — so
 * importing it here would be a cycle, and the layering PIE-886 establishes says
 * core must not know capability names anyway.
 *
 * These stubs carry the same tool ids and `supportedLevels` the tests were
 * relying on, so the assertions keep testing what they tested: the registry,
 * policy engine and coordinator against a populated registry. They are stubs on
 * purpose — a test of core should not depend on a real capability's render
 * behaviour.
 */

import {
	ToolRegistry,
	type ToolRegistration,
} from "../../src/services/ToolRegistry.js";
import type { ToolLevel } from "../../src/services/tool-context.js";

export interface TestToolSpec {
	toolId: string;
	supportedLevels: ToolLevel[];
	provider?: ToolRegistration["provider"];
}

/**
 * A provider descriptor whose auth fetch always fails.
 *
 * For exercising the coordinator's provider lifecycle and telemetry forwarding.
 * Those paths were previously tested through the real TTS provider descriptor,
 * which is a capability and now lives in the composition layer; the mechanism
 * under test is the coordinator's, so a stub is both sufficient and more honest
 * than borrowing a capability to reach it.
 */
export function createFailingAuthProviderDescriptor(
	toolId: string,
	message = "stub auth failure",
): NonNullable<ToolRegistration["provider"]> {
	return {
		createProvider: () => ({
			providerName: `Stub ${toolId} provider`,
			category: "service-dependent",
			version: "0.0.0",
			requiresAuth: true,
			initialize: async () => undefined,
			createInstance: async () => ({}),
			getCapabilities: () => ({}) as never,
			isReady: () => true,
			destroy: () => undefined,
		}),
		getAuthFetcher: () => async () => {
			throw new Error(message);
		},
	};
}

/** Ids and levels matching the packaged set the tests previously borrowed. */
export const TEST_TOOL_SPECS: TestToolSpec[] = [
	{
		toolId: "calculator",
		supportedLevels: ["item", "section", "element"],
	},
	{
		toolId: "textToSpeech",
		supportedLevels: ["item", "passage"],
	},
	{ toolId: "graph", supportedLevels: ["section"] },
	{
		toolId: "periodicTable",
		supportedLevels: ["section"],
	},
	{
		toolId: "theme",
		supportedLevels: ["assessment", "section"],
	},
	{
		toolId: "lineReader",
		supportedLevels: ["section", "passage", "item"],
	},
	{
		toolId: "answerEliminator",
		supportedLevels: ["item", "element"],
	},
	{
		toolId: "annotationToolbar",
		supportedLevels: ["passage", "rubric", "item", "element"],
	},
	{
		toolId: "highlighter",
		supportedLevels: ["passage", "rubric", "item", "element"],
	},
	{
		toolId: "ruler",
		supportedLevels: ["element", "section"],
	},
	{
		toolId: "protractor",
		supportedLevels: ["element", "section"],
	},
];

export function createTestToolRegistration(
	spec: TestToolSpec,
): ToolRegistration {
	return {
		toolId: spec.toolId,
		name: spec.toolId,
		description: `Test stub for ${spec.toolId}`,
		icon: "stub",
		supportedLevels: spec.supportedLevels,
		provider: spec.provider,
		isVisibleInContext: () => true,
		renderToolbar: () => null,
	};
}

/**
 * A registry holding {@link TEST_TOOL_SPECS}, optionally narrowed to a subset.
 */
export function createTestToolRegistry(toolIds?: string[]): ToolRegistry {
	const registry = new ToolRegistry();
	const wanted = toolIds ? new Set(toolIds) : null;
	for (const spec of TEST_TOOL_SPECS) {
		if (wanted && !wanted.has(spec.toolId)) continue;
		registry.register(createTestToolRegistration(spec));
	}
	return registry;
}
