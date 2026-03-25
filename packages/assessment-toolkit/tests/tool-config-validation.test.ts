import { describe, expect, test } from "bun:test";
import { createPackagedToolRegistry } from "../src/services/createDefaultToolRegistry.js";
import { ToolRegistry, type ToolRegistration } from "../src/services/ToolRegistry.js";
import { normalizeAndValidateToolsConfig } from "../src/services/tool-config-validation.js";

describe("tool-config-validation", () => {
	test("keeps deterministic validation pipeline diagnostics", () => {
		const registry = createPackagedToolRegistry();
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

	test("supports strictness warn without throwing", () => {
		const registry = createPackagedToolRegistry();
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
		expect(result.diagnostics.some((entry) => entry.code === "tools.unknownProviderKey")).toBe(
			true,
		);
	});

	test("normalizes invalid strictness to error behavior", () => {
		const registry = createPackagedToolRegistry();
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

	test("defaults to packaged registry semantics when no registry is supplied", () => {
		expect(() =>
			normalizeAndValidateToolsConfig(
				{
					placement: {
						item: ["notARealTool"],
					},
				},
				{
					strictness: "error",
					source: "test",
				},
			),
		).toThrow(`Unknown tool id "notARealTool"`);
	});

	test("throws in strict error mode when diagnostics exist", () => {
		const registry = createPackagedToolRegistry();
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

	test("deprecated providers.tts always throws regardless of strictness", () => {
		const registry = createPackagedToolRegistry();
		expect(() =>
			normalizeAndValidateToolsConfig(
				{
					providers: {
						tts: {
							enabled: true,
						},
					},
				},
				{
					strictness: "off",
					source: "test",
					toolRegistry: registry,
				},
			),
		).toThrow(`Provider key "tts" is no longer supported`);
		expect(() =>
			normalizeAndValidateToolsConfig(
				{
					providers: {
						tts: {
							enabled: true,
						},
					},
				},
				{
					strictness: "warn",
					source: "test",
					toolRegistry: registry,
				},
			),
		).toThrow(`Provider key "tts" is no longer supported`);
	});

	test("flags unsupported placement level for known tool id", () => {
		const registry = createPackagedToolRegistry();
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
		expect(result.diagnostics.some((entry) => entry.code === "tools.unsupportedLevel")).toBe(
			true,
		);
	});

	test("runs provider sanitize and validate hooks", () => {
		const registry = new ToolRegistry();
		const registration: ToolRegistration = {
			toolId: "customTool",
			name: "Custom Tool",
			description: "Testing custom provider hooks",
			icon: "test",
			supportedLevels: ["item"],
			isVisibleInContext: () => true,
			renderToolbar: () => null,
			provider: {
				createProvider: () =>
					({
						providerName: "custom",
						providerVersion: "1.0.0",
						category: "utility",
						requiresAuth: false,
						isReady: () => true,
						initialize: async () => {},
						createInstance: async () => ({}),
						destroy: () => {},
					}) as any,
				sanitizeConfig: (config) => ({
					...config,
					settings: {
						...(config.settings || {}),
						sanitized: true,
					},
				}),
				validateConfig: (config) => {
					if ((config.settings as Record<string, unknown> | undefined)?.sanitized === true) {
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

		expect((result.config.providers.customTool?.settings as Record<string, unknown>).sanitized).toBe(
			true,
		);
		expect(result.diagnostics).toEqual([]);
	});

});
