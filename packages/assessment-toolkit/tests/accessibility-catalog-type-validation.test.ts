/**
 * Unknown catalog types are reported rather than silently inert.
 *
 * `CatalogType` ends in `| string`, so the named literals were documentation
 * only: a card written `"spokn"` was a valid `CatalogType` that no reader would
 * ever ask for. It failed by being invisible. The type stays open — QTI's support
 * vocabulary is extensible and catalogs arrive as authored JSON anyway — so the
 * check is at runtime, on both sides, because a typo in a lookup is exactly as
 * quiet as one on a card.
 */
import { describe, expect, test } from "bun:test";
import {
	AccessibilityCatalogResolver,
	isKnownCatalogType,
} from "../src/services/AccessibilityCatalogResolver";

const captureWarnings = <T>(run: () => T): { value: T; warnings: string[] } => {
	const warnings: string[] = [];
	const original = console.warn;
	console.warn = (...args: unknown[]) => {
		warnings.push(args.map(String).join(" "));
	};
	try {
		return { value: run(), warnings };
	} finally {
		console.warn = original;
	}
};

describe("isKnownCatalogType", () => {
	test("accepts the types PIE names", () => {
		for (const type of [
			"spoken",
			"sign-language",
			"transcript",
			"braille",
			"tactile",
			"simplified-language",
			"audio-description",
			"extended-description",
		]) {
			expect(isKnownCatalogType(type)).toBe(true);
		}
	});

	test("accepts a prefixed vendor extension", () => {
		// QTI reserves `ext:` for these and pairs one with a standard card in its
		// own examples, so a prefixed token is a deliberate extension, not a slip.
		expect(isKnownCatalogType("ext:custom-pronunciation")).toBe(true);
	});

	test("rejects a bare prefix and an unknown token", () => {
		expect(isKnownCatalogType("ext:")).toBe(false);
		expect(isKnownCatalogType("spokn")).toBe(false);
	});
});

describe("unknown catalog types are reported", () => {
	test("a mistyped card type is reported at registration", () => {
		const { warnings } = captureWarnings(
			() =>
				new AccessibilityCatalogResolver([
					{
						identifier: "prompt-1",
						cards: [{ catalog: "spokn", content: "<speak>hi</speak>" }],
					},
				]),
		);

		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('"spokn"');
		expect(warnings[0]).toContain("prompt-1");
		// The consequence, not just the fact — this is the sentence that tells an
		// author why nothing appeared.
		expect(warnings[0]).toContain("never be shown");
	});

	test("scoped registration is covered by the same funnel", () => {
		const resolver = new AccessibilityCatalogResolver();
		const { warnings } = captureWarnings(() =>
			resolver.registerCatalogs({ ownerKind: "itemModel", itemId: "item-1" }, [
				{
					identifier: "prompt-2",
					cards: [{ catalog: "sign-lanugage", content: "x" }],
				},
			]),
		);

		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('"sign-lanugage"');
	});

	test("a mistyped lookup type is reported too", () => {
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "prompt-3",
				cards: [{ catalog: "spoken", content: "<speak>hi</speak>" }],
			},
		]);

		const { value, warnings } = captureWarnings(() =>
			resolver.getAlternative("prompt-3", { type: "brallie" }),
		);

		expect(value).toBeNull();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("cannot match any card");
	});

	test("says it once per token, not once per card or lookup", () => {
		const { warnings } = captureWarnings(
			() =>
				new AccessibilityCatalogResolver([
					{
						identifier: "a",
						cards: [
							{ catalog: "repeated-typo", content: "one" },
							{ catalog: "repeated-typo", content: "two" },
						],
					},
					{
						identifier: "b",
						cards: [{ catalog: "repeated-typo", content: "three" }],
					},
				]),
		);

		expect(warnings).toHaveLength(1);
	});

	test("stays quiet for known types and extensions", () => {
		const { warnings } = captureWarnings(() => {
			const resolver = new AccessibilityCatalogResolver([
				{
					identifier: "quiet",
					cards: [
						{ catalog: "spoken", content: "<speak>hi</speak>" },
						{ catalog: "transcript", content: "The word is look." },
						{ catalog: "ext:custom-pronunciation", content: "tomato" },
					],
				},
			]);
			return resolver.getAlternative("quiet", { type: "spoken" });
		});

		// `transcript` in particular: the Learnosity importer emits it, so treating
		// it as unknown would warn on ordinary imported audio items.
		expect(warnings).toEqual([]);
	});
});
