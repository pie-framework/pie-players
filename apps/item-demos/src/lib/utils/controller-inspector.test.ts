import { describe, expect, test } from "bun:test";
import { BundleType } from "@pie-players/pie-players-shared";
import {
	buildControllerInspectionRows,
	loadControllerInspectionRows,
	type ControllerLookup,
} from "./controller-inspector";

describe("buildControllerInspectionRows", () => {
	const versionedTag = "pie-multiple-choice--version-1-2-3";
	const config = {
		markup: `<${versionedTag} id="q1"></${versionedTag}>`,
		elements: {
			[versionedTag]: "@pie-element/multiple-choice@1.2.3",
		},
		models: [
			{
				id: "q1",
				element: versionedTag,
			},
		],
	};

	test("looks up controllers by exact versioned model element tag", () => {
		const lookedUpTags: string[] = [];
		const lookup: ControllerLookup = (tag) => {
			lookedUpTags.push(tag);
			return {
				model: async (model: unknown) => model,
				outcome: async () => ({ score: 1 }),
				validate: () => ({ errors: [] }),
			};
		};

		const rows = buildControllerInspectionRows(config, lookup);

		expect(lookedUpTags).toEqual([versionedTag]);
		expect(rows).toEqual([
			{
				modelId: "q1",
				element: versionedTag,
				packageSpec: "@pie-element/multiple-choice@1.2.3",
				status: "loaded",
				methods: ["model", "outcome", "validate"],
			},
		]);
	});

	test("reports missing controllers without mutating element names", () => {
		const rows = buildControllerInspectionRows(config, () => undefined);

		expect(rows).toEqual([
			{
				modelId: "q1",
				element: versionedTag,
				packageSpec: "@pie-element/multiple-choice@1.2.3",
				status: "missing",
				methods: [],
				error: "No controller registered for pie-multiple-choice--version-1-2-3",
			},
		]);
	});

	test("discovers methods on default-wrapped controllers", () => {
		const rows = buildControllerInspectionRows(config, () => ({
			default: {
				model: async (model: unknown) => model,
				outcome: async () => ({ score: 1 }),
			},
		}));

		expect(rows[0]?.methods).toEqual(["model", "outcome"]);
	});

	test("discovers methods on class instance controllers", () => {
		class FixtureController {
			async model(model: unknown) {
				return model;
			}

			async outcome() {
				return { score: 1 };
			}
		}

		const rows = buildControllerInspectionRows(config, () => new FixtureController());

		expect(rows[0]?.methods).toEqual(["model", "outcome"]);
	});

	test("still resolves controllers for tags that registered during a partial load failure", () => {
		const lookedUpTags: string[] = [];
		const secondTag = "pie-hotspot--version-4-5-6";
		const multiElementConfig = {
			markup: `${config.markup}<${secondTag} id="q2"></${secondTag}>`,
			elements: {
				...config.elements,
				[secondTag]: "@pie-element/hotspot@4.5.6",
			},
			models: [
				...config.models,
				{
					id: "q2",
					element: secondTag,
				},
			],
		};

		const rows = buildControllerInspectionRows(
			multiElementConfig,
			(tag) => {
				lookedUpTags.push(tag);
				return tag === versionedTag
					? {
							model: async (model: unknown) => model,
					  }
					: undefined;
			},
			{
				message: "Some elements failed to register",
				failedTags: new Set([secondTag]),
			},
		);

		expect(lookedUpTags).toEqual([versionedTag]);
		expect(rows).toEqual([
			{
				modelId: "q1",
				element: versionedTag,
				packageSpec: "@pie-element/multiple-choice@1.2.3",
				status: "loaded",
				methods: ["model"],
			},
			{
				modelId: "q2",
				element: secondTag,
				packageSpec: "@pie-element/hotspot@4.5.6",
				status: "error",
				methods: [],
				error: "Some elements failed to register",
			},
		]);
	});

	test("loads client-player bundles and resolves transformed versioned tags", async () => {
		const requestedElements: Array<Record<string, string>> = [];
		const requestedOptions: unknown[] = [];
		const lookedUpTags: string[] = [];
		const rawConfig = {
			markup: '<pie-multiple-choice id="q1"></pie-multiple-choice>',
			elements: {
				"pie-multiple-choice": "@pie-element/multiple-choice@1.2.3",
			},
			models: [
				{
					id: "q1",
					element: "pie-multiple-choice",
				},
			],
		};

		const result = await loadControllerInspectionRows(rawConfig, {
			ensureRegistered: async (elements, options) => {
				requestedElements.push(elements);
				requestedOptions.push(options);
			},
			lookupController: (tag) => {
				lookedUpTags.push(tag);
				return {
					outcome: async () => ({ score: 1 }),
				};
			},
		});

		expect(requestedElements).toEqual([
			{
				[versionedTag]: "@pie-element/multiple-choice@1.2.3",
			},
		]);
		expect(requestedOptions).toEqual([
			{
				backend: {
					kind: "iife",
					bundleHost: "https://proxy.pie-api.com/bundles/",
					bundleType: BundleType.clientPlayer,
					needsControllers: true,
				},
			},
		]);
		expect(lookedUpTags).toEqual([versionedTag]);
		expect(result).toEqual({
			rows: [
				{
					modelId: "q1",
					element: versionedTag,
					packageSpec: "@pie-element/multiple-choice@1.2.3",
					status: "loaded",
					methods: ["outcome"],
				},
			],
			errorMessage: null,
		});
	});

	test("returns an error result when tag normalization fails", async () => {
		const result = await loadControllerInspectionRows(
			{
				markup: '<pie-multiple-choice id="q1"></pie-multiple-choice>',
				elements: {
					"pie-multiple-choice": "",
				},
				models: [
					{
						id: "q1",
						element: "pie-multiple-choice",
					},
				],
			},
			{
				ensureRegistered: async () => {
					throw new Error("ensureRegistered should not run");
				},
				lookupController: () => undefined,
			},
		);

		expect(result).toEqual({
			rows: [],
			errorMessage: "Parameter is required: input",
		});
	});
});
