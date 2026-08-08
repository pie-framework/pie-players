import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import type { ConfigEntity } from "@pie-players/pie-players-shared/types";

import { SignLanguageExtractor } from "../src/services/SignLanguageExtractor";
import { resolveSignLanguageMedia } from "../src/services/sign-language-cards";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

let extractor: SignLanguageExtractor;
beforeEach(() => {
	extractor = new SignLanguageExtractor();
});

function config(overrides: Partial<ConfigEntity> = {}): ConfigEntity {
	return { markup: "", elements: {}, models: [], ...overrides };
}

describe("SignLanguageExtractor", () => {
	test("lifts a marked video out of a prompt into a catalog card", () => {
		const { catalogs, cleanedConfig } = extractor.extractFromItemConfig(
			config({
				models: [
					{
						id: "q1",
						element: "pie-multiple-choice",
						prompt:
							'<div><p>What is 2 + 2?</p><video data-sign-language="ase" poster="p.jpg"><source src="asl.mp4" type="video/mp4"></video></div>',
					},
				],
			}),
		);

		expect(catalogs).toHaveLength(1);
		const [catalog] = catalogs;
		expect(catalog.identifier).toBe("auto-sign-prompt-q1-0");
		expect(catalog.cards[0].catalog).toBe("sign-language");
		expect(catalog.cards[0].language).toBe("ase");

		const media = resolveSignLanguageMedia(catalog.cards[0]);
		expect(media?.sources).toEqual([{ src: "asl.mp4", type: "video/mp4" }]);
		expect(media?.poster).toBe("p.jpg");

		// The video is gone from visible content — in PIE the signed alternate is
		// gated, not unconditional item content.
		const prompt = cleanedConfig.models[0].prompt as string;
		expect(prompt).not.toContain("<video");
		expect(prompt).toContain("What is 2 + 2?");
	});

	test("docks the catalog id on the content the signing translates", () => {
		const { cleanedConfig } = extractor.extractFromItemConfig(
			config({
				models: [
					{
						id: "q1",
						element: "pie-multiple-choice",
						prompt:
							'<p>Prompt text<video data-sign-language="ase" src="asl.mp4"></video></p>',
					},
				],
			}),
		);
		expect(cleanedConfig.models[0].prompt).toContain(
			'data-catalog-idref="auto-sign-prompt-q1-0"',
		);
	});

	test("never overwrites an existing catalog idref", () => {
		// One canonical attribute, two readers: clobbering it would break TTS
		// resolution for that node.
		const { catalogs, cleanedConfig } = extractor.extractFromItemConfig(
			config({
				models: [
					{
						id: "q1",
						element: "pie-multiple-choice",
						prompt:
							'<p data-catalog-idref="auto-prompt-q1-0">Prompt<video data-sign-language="ase" src="asl.mp4"></video></p>',
					},
				],
			}),
		);
		expect(catalogs).toHaveLength(1);
		const prompt = cleanedConfig.models[0].prompt as string;
		expect(prompt).toContain('data-catalog-idref="auto-prompt-q1-0"');
		expect(prompt).not.toContain("auto-sign-prompt-q1-0");
	});

	test("keeps a marked wrapper as the docking node and strips the marker", () => {
		const { cleanedConfig } = extractor.extractFromItemConfig(
			config({
				markup:
					'<div data-sign-language="ase" data-sign-language-start="2"><span>Read this</span><video src="asl.mp4"></video></div>',
			}),
		);
		expect(cleanedConfig.markup).toContain("Read this");
		expect(cleanedConfig.markup).not.toContain("data-sign-language");
		expect(cleanedConfig.markup).toContain(
			'data-catalog-idref="auto-sign-markup-0"',
		);
	});

	test("extracts a fragment range from the marked element", () => {
		const { catalogs } = extractor.extractFromItemConfig(
			config({
				markup:
					'<video data-sign-language="ase" data-sign-language-start="3" data-sign-language-end="11" src="asl.mp4"></video>',
			}),
		);
		expect(resolveSignLanguageMedia(catalogs[0].cards[0])?.fragment).toEqual({
			startSeconds: 3,
			endSeconds: 11,
		});
	});

	test("defaults an empty marker value to ASL", () => {
		const { catalogs } = extractor.extractFromItemConfig(
			config({ markup: '<video data-sign-language src="asl.mp4"></video>' }),
		);
		expect(catalogs[0].cards[0].language).toBe("ase");
	});

	test("honours a non-ASL sign language rather than assuming ASL", () => {
		const { catalogs } = extractor.extractFromItemConfig(
			config({
				markup: '<video data-sign-language="bfi" src="bsl.mp4"></video>',
			}),
		);
		expect(catalogs[0].cards[0].language).toBe("bfi");
	});

	test("extracts from choice labels for future per-node docking", () => {
		const { catalogs } = extractor.extractFromItemConfig(
			config({
				models: [
					{
						id: "q1",
						element: "pie-multiple-choice",
						choices: [
							{
								value: "a",
								label:
									'<span>Four<video data-sign-language="ase" src="a.mp4"></video></span>',
							},
							{ value: "b", label: "<span>Five</span>" },
						],
					},
				],
			}),
		);
		expect(catalogs.map((catalog) => catalog.identifier)).toEqual([
			"auto-sign-choice-q1-a-0",
		]);
	});

	test("leaves content untouched when a marked region carries no video", () => {
		const markup = '<div data-sign-language="ase"><p>No video here</p></div>';
		const { catalogs, cleanedConfig } = extractor.extractFromItemConfig(
			config({ markup }),
		);
		expect(catalogs).toHaveLength(0);
		expect(cleanedConfig.markup).toContain("No video here");
	});

	test("skips a marked video with no usable source", () => {
		const { catalogs } = extractor.extractFromItemConfig(
			config({ markup: '<video data-sign-language="ase"></video>' }),
		);
		expect(catalogs).toHaveLength(0);
	});

	test("is a no-op for content with no signing markup", () => {
		const original = config({
			markup: "<p>Plain passage</p>",
			models: [
				{ id: "q1", element: "pie-multiple-choice", prompt: "<p>Hi</p>" },
			],
		});
		const { catalogs, cleanedConfig } =
			extractor.extractFromItemConfig(original);
		expect(catalogs).toHaveLength(0);
		expect(cleanedConfig.markup).toBe("<p>Plain passage</p>");
		expect(cleanedConfig.models[0].prompt).toBe("<p>Hi</p>");
	});

	test("does not mutate the caller's config", () => {
		const original = config({
			markup: '<video data-sign-language="ase" src="asl.mp4"></video>',
			models: [
				{
					id: "q1",
					element: "pie-multiple-choice",
					prompt:
						'<p>Hi<video data-sign-language="ase" src="asl.mp4"></video></p>',
				},
			],
		});
		const originalPrompt = original.models[0].prompt;
		extractor.extractFromItemConfig(original);
		expect(original.markup).toContain("<video");
		expect(original.models[0].prompt).toBe(originalPrompt);
	});

	test("mints stable, unique ids across regions", () => {
		const { catalogs } = extractor.extractFromItemConfig(
			config({
				markup:
					'<p>A<video data-sign-language="ase" src="a.mp4"></video></p><p>B<video data-sign-language="ase" src="b.mp4"></video></p>',
			}),
		);
		expect(catalogs.map((catalog) => catalog.identifier)).toEqual([
			"auto-sign-markup-0",
			"auto-sign-markup-1",
		]);
	});
});
