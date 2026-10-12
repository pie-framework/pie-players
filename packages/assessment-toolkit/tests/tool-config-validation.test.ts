import { describe, expect, test } from "bun:test";
import { createTestToolRegistry } from "./fixtures/test-tool-registry.js";
import {
	ToolRegistry,
	type ToolRegistration,
} from "../src/services/ToolRegistry.js";
import { normalizeAndValidateToolsConfig } from "../src/services/tool-config-validation.js";

describe("tool-config-validation", () => {
	test("keeps deterministic validation pipeline diagnostics", () => {
		const registry = createTestToolRegistry();
		const result = normalizeAndValidateToolsConfig(
			{
				placement: {
					item: ["notARealTool"],
				},
				providers: {
					unknownProvider: {
						enabled: true,
					},
				},
			},
			{
				strictness: "off",
				source: "test",
				toolRegistry: registry,
			},
		);

		expect(result.diagnostics.map((entry) => entry.code)).toEqual([
			"tools.unknownToolId",
			"tools.unknownProviderKey",
		]);
	});

	test("a diagnostic names its tool once, as toolId", () => {
		const registry = new ToolRegistry();
		registry.register({
			toolId: "customTool",
			name: "Custom Tool",
			description: "Testing diagnostic ids",
			icon: "test",
			supportedLevels: ["item"],
			isVisibleInContext: () => true,
			renderToolbar: () => null,
			validateConfig: () => [
				{
					code: "tools.providerValidateFailed",
					severity: "error",
					path: "",
					message: "always fails",
				},
			],
		});
		const result = normalizeAndValidateToolsConfig(
			{
				providers: {
					customTool: { enabled: true },
					unknownProvider: { enabled: true },
				},
			},
			{ strictness: "off", source: "test", toolRegistry: registry },
		);

		expect(
			result.diagnostics.map(({ code, path, toolId }) => ({
				code,
				path,
				toolId,
			})),
		).toEqual([
			{
				code: "tools.providerValidateFailed",
				path: "providers.customTool",
				toolId: "customTool",
			},
			{
				code: "tools.unknownProviderKey",
				path: "providers.unknownProvider",
				toolId: "unknownProvider",
			},
		]);
		for (const diagnostic of result.diagnostics) {
			expect(diagnostic).not.toHaveProperty("providerId");
		}
	});

	test("supports strictness warn without throwing", () => {
		const registry = createTestToolRegistry();
		const result = normalizeAndValidateToolsConfig(
			{
				providers: {
					unknownProvider: {
						enabled: true,
					},
				},
			},
			{
				strictness: "warn",
				source: "test",
				toolRegistry: registry,
			},
		);
		expect(
			result.diagnostics.some(
				(entry) => entry.code === "tools.unknownProviderKey",
			),
		).toBe(true);
	});

	test("normalizes invalid strictness to error behavior", () => {
		const registry = createTestToolRegistry();
		expect(() =>
			normalizeAndValidateToolsConfig(
				{
					providers: {
						unknownProvider: {
							enabled: true,
						},
					},
				},
				{
					// Runtime safety: callers may pass unchecked string values.
					strictness: "invalid" as any,
					source: "test",
					toolRegistry: registry,
				},
			),
		).toThrow(`Unknown provider key "unknownProvider"`);
	});

	test("reports that it could not validate when no registry is supplied", () => {
		// This package holds no capability set to fall back to, so there is nothing
		// to check ids against. It says so rather than rejecting every configured id,
		// which would turn an existing host setup into a construction failure — and
		// rather than skipping in silence, which downgrades "your ids are valid" to
		// "nobody looked" with no signal.
		const result = normalizeAndValidateToolsConfig(
			{ placement: { item: ["notARealTool"] } },
			{ strictness: "error", source: "test" },
		);

		const diagnostic = result.diagnostics.find(
			(entry) => entry.code === "tools.registryUnavailable",
		);
		expect(diagnostic?.severity).toBe("warning");
		expect(diagnostic?.message).toContain("createPackagedToolRegistry");
		expect(result.diagnostics.map((entry) => entry.code)).not.toContain(
			"tools.unknownToolId",
		);
		expect(result.config.placement.item).toEqual(["notARealTool"]);
	});

	test("stays silent when no registry is supplied and no tools are configured", () => {
		// A host that configures no tools is not missing a registry.
		const result = normalizeAndValidateToolsConfig(
			{},
			{ strictness: "error", source: "test" },
		);
		expect(result.diagnostics).toEqual([]);
	});

	test("throws in strict error mode when diagnostics exist", () => {
		const registry = createTestToolRegistry();
		expect(() =>
			normalizeAndValidateToolsConfig(
				{
					providers: {
						unknownProvider: {
							enabled: true,
						},
					},
				},
				{
					strictness: "error",
					source: "test",
					toolRegistry: registry,
				},
			),
		).toThrow(`Unknown provider key "unknownProvider"`);
	});

	test("flags unsupported placement level for known tool id", () => {
		const registry = createTestToolRegistry();
		const result = normalizeAndValidateToolsConfig(
			{
				placement: {
					section: ["answerEliminator"],
				},
			},
			{
				strictness: "off",
				source: "test",
				toolRegistry: registry,
			},
		);
		expect(
			result.diagnostics.some(
				(entry) => entry.code === "tools.unsupportedLevel",
			),
		).toBe(true);
	});

	test("rejects removed colorScheme tool id", () => {
		const registry = createTestToolRegistry();
		const result = normalizeAndValidateToolsConfig(
			{
				placement: {
					section: ["colorScheme"],
				},
			},
			{
				strictness: "off",
				source: "test",
				toolRegistry: registry,
			},
		);
		expect(
			result.diagnostics.some(
				(entry) =>
					entry.code === "tools.unknownToolId" &&
					entry.toolId === "colorScheme",
			),
		).toBe(true);
	});

	test("allows section-capable tools in item placement without unsupported-level diagnostics", () => {
		const registry = createTestToolRegistry();
		const result = normalizeAndValidateToolsConfig(
			{
				placement: {
					item: ["graph"],
				},
			},
			{
				strictness: "error",
				source: "test",
				toolRegistry: registry,
			},
		);
		expect(
			result.diagnostics.some(
				(entry) => entry.code === "tools.unsupportedLevel",
			),
		).toBe(false);
	});

	test("runs the registration's sanitize and validate hooks", () => {
		// The hooks belong to the tool's config, so a tool with no provider has
		// its config sanitized and validated too.
		const registry = new ToolRegistry();
		const registration: ToolRegistration = {
			toolId: "customTool",
			name: "Custom Tool",
			description: "Testing tool config hooks",
			icon: "test",
			supportedLevels: ["item"],
			isVisibleInContext: () => true,
			renderToolbar: () => null,
			sanitizeConfig: (config) => ({
				...config,
				settings: {
					...(config.settings || {}),
					sanitized: true,
				},
			}),
			validateConfig: (config) => {
				if (
					(config.settings as Record<string, unknown> | undefined)
						?.sanitized === true
				) {
					return [];
				}
				return [
					{
						code: "tools.providerValidateFailed",
						severity: "error",
						path: "providers.customTool.settings",
						message: "sanitized flag missing",
					},
				];
			},
		};
		registry.register(registration);

		const result = normalizeAndValidateToolsConfig(
			{
				placement: {
					item: ["customTool"],
				},
				providers: {
					customTool: {
						enabled: true,
						settings: {},
					},
				},
			},
			{
				strictness: "error",
				source: "test",
				toolRegistry: registry,
			},
		);

		const customTool = result.config.providers.customTool;
		if (!customTool) throw new Error("expected a customTool provider entry");
		expect((customTool.settings as Record<string, unknown>).sanitized).toBe(
			true,
		);
		expect(result.diagnostics).toEqual([]);
	});

	test("reports a region capability named in toolbar placement", () => {
		// A region capability has no toolbar button, so placing it names a surface
		// that will never render it. Caught at the config rather than at render
		// time, where the symptom is an absent accommodation and no error.
		const registry = new ToolRegistry();
		registry.register({
			toolId: "hostAlternateMedia",
			name: "Host Alternate Media",
			description: "Docked alternate media for an item",
			supportedLevels: ["item"],
			activation: "region",
			surfaces: ["item-media"],
			isVisibleInContext: () => true,
			renderSurface: () => ({ element: {} as HTMLElement }),
		} as ToolRegistration);

		const result = normalizeAndValidateToolsConfig(
			{ placement: { item: ["hostAlternateMedia"] } },
			{ strictness: "off", source: "test", toolRegistry: registry },
		);

		const diagnostic = result.diagnostics.find(
			(entry) => entry.code === "tools.unplaceableActivation",
		);
		expect(diagnostic?.severity).toBe("error");
		expect(diagnostic?.toolId).toBe("hostAlternateMedia");
		expect(diagnostic?.path).toBe("placement.item");
		// Not also reported as an unsupported level: the placement is wrong for a
		// reason that has nothing to do with which levels it supports.
		expect(result.diagnostics.map((entry) => entry.code)).not.toContain(
			"tools.unsupportedLevel",
		);
	});
});
