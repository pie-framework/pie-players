import { describe, expect, test } from "bun:test";
import {
	applyDeliveryModelResultToConfigs,
	normalizeDeliveryModelResult,
} from "../src/backend/model-refresh";

const versionedConfig = {
	id: "item-config",
	markup:
		'<multiple-choice--version-11-4-0 id="item-model"></multiple-choice--version-11-4-0>',
	elements: {
		"multiple-choice--version-11-4-0": "@pie-element/multiple-choice@11.4.0",
	},
	models: [
		{
			id: "item-model",
			element: "multiple-choice--version-11-4-0",
			prompt: "Before refresh",
			choices: [],
		},
	],
};

const passageConfig = {
	id: "passage-config",
	markup:
		'<pie-passage--version-1-2-3 id="passage-model"></pie-passage--version-1-2-3>',
	elements: {
		"pie-passage--version-1-2-3": "@pie-element/passage@1.2.3",
	},
	models: [
		{
			id: "passage-model",
			element: "pie-passage--version-1-2-3",
			text: "Before passage refresh",
		},
	],
};

describe("delivery backend model refresh helpers", () => {
	test("normalizes array model refresh results as item models", () => {
		const result = normalizeDeliveryModelResult([
			{ id: "item-model", element: "multiple-choice", prompt: "Updated" },
		]);

		expect(result).toEqual({
			models: [
				{ id: "item-model", element: "multiple-choice", prompt: "Updated" },
			],
			passageModels: undefined,
			metadata: undefined,
		});
	});

	test("updates matching item models with exact versioned element tags", () => {
		const refreshed = applyDeliveryModelResultToConfigs({
			itemConfig: versionedConfig,
			passageConfig: null,
			result: [
				{
					id: "item-model",
					element: "multiple-choice--version-11-4-0",
					prompt: "After refresh",
					choices: [{ value: "a", label: "A" }],
				},
			],
		});

		expect(refreshed.itemConfig?.models).toEqual([
			{
				id: "item-model",
				element: "multiple-choice--version-11-4-0",
				prompt: "After refresh",
				choices: [{ value: "a", label: "A" }],
			},
		]);
		expect(refreshed.passageConfig).toBeNull();
		expect(versionedConfig.models[0]?.prompt).toBe("Before refresh");
	});

	test("keeps item and passage model boundaries separate for split results", () => {
		const refreshed = applyDeliveryModelResultToConfigs({
			itemConfig: versionedConfig,
			passageConfig,
			result: {
				models: [
					{
						id: "item-model",
						element: "multiple-choice--version-11-4-0",
						prompt: "After item refresh",
					},
				],
				passageModels: [
					{
						id: "passage-model",
						element: "pie-passage--version-1-2-3",
						text: "After passage refresh",
					},
				],
				metadata: { source: "model" },
			},
		});

		expect(refreshed.metadata).toEqual({ source: "model" });
		expect(refreshed.itemConfig?.models[0]).toEqual({
			id: "item-model",
			element: "multiple-choice--version-11-4-0",
			prompt: "After item refresh",
		});
		expect(refreshed.passageConfig?.models[0]).toEqual({
			id: "passage-model",
			element: "pie-passage--version-1-2-3",
			text: "After passage refresh",
		});
	});

	test("ignores backend models whose id or element identity does not match current config", () => {
		const refreshed = applyDeliveryModelResultToConfigs({
			itemConfig: versionedConfig,
			passageConfig: null,
			result: [
				{
					id: "item-model",
					element: "pie-not-this-model",
					prompt: "Should not apply",
				},
				{
					id: "unknown-model",
					element: "multiple-choice--version-11-4-0",
					prompt: "Should not add",
				},
			],
		});

		expect(refreshed.itemConfig).toEqual(versionedConfig);
	});

	test("requires exact matches for already-versioned incoming element tags", () => {
		const rejected = applyDeliveryModelResultToConfigs({
			itemConfig: versionedConfig,
			passageConfig: null,
			result: [
				{
					id: "item-model",
					element: "multiple-choice--version-0-0-1",
					prompt: "Wrong version",
				},
			],
		});
		const accepted = applyDeliveryModelResultToConfigs({
			itemConfig: versionedConfig,
			passageConfig: null,
			result: [
				{
					id: "item-model",
					element: "multiple-choice--version-11-4-0",
					prompt: "Exact version",
				},
			],
		});

		expect(rejected.itemConfig).toEqual(versionedConfig);
		expect(accepted.itemConfig?.models[0]).toEqual({
			id: "item-model",
			element: "multiple-choice--version-11-4-0",
			prompt: "Exact version",
		});
	});

	test("rejects unversioned incoming element tags for versioned current models", () => {
		const refreshed = applyDeliveryModelResultToConfigs({
			itemConfig: versionedConfig,
			passageConfig,
			result: {
				models: [
					{
						id: "item-model",
						element: "multiple-choice",
						prompt: "Should not apply",
					},
				],
				passageModels: [
					{
						id: "passage-model",
						element: "pie-passage",
						text: "Should not apply",
					},
				],
			},
		});

		expect(refreshed.itemConfig).toEqual(versionedConfig);
		expect(refreshed.passageConfig).toEqual(passageConfig);
		expect(refreshed.changed).toBe(false);
	});

	test("removes fields omitted by refreshed backend models", () => {
		const refreshed = applyDeliveryModelResultToConfigs({
			itemConfig: versionedConfig,
			passageConfig: null,
			result: [
				{
					id: "item-model",
					element: "multiple-choice--version-11-4-0",
					prompt: "Student-safe refresh",
				},
			],
		});

		expect(refreshed.itemConfig?.models[0]).toEqual({
			id: "item-model",
			element: "multiple-choice--version-11-4-0",
			prompt: "Student-safe refresh",
		});
	});
});
