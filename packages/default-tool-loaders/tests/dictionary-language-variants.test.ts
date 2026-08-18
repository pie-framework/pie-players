/**
 * A dictionary capability per language.
 *
 * The language of a definition belongs to the learner, not to the content, so a variant
 * carries its own corpus language and its own PNP grant rather than following whatever the
 * section was authored in. These assertions pin the three things a host depends on: the
 * grant is separate, the language reaches the panel, and a host naming a language still
 * wins.
 */

import { describe, expect, test } from "bun:test";
import type {
	ToolContext,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

import { PACKAGED_TOOL_TAG_MAP } from "../src/tool-tag-map.js";
import {
	createDictionaryToolRegistration,
	createPictureDictionaryToolRegistration,
	dictionaryToolRegistration,
	pictureDictionaryToolRegistration,
	spanishDictionaryToolRegistration,
	spanishPictureDictionaryToolRegistration,
} from "../src/index.js";

describe("the packaged Spanish variants", () => {
	test("are separate capabilities from the content-following dictionaries", () => {
		expect(spanishDictionaryToolRegistration.toolId).toBe("dictionarySpanish");
		expect(spanishPictureDictionaryToolRegistration.toolId).toBe(
			"pictureDictionarySpanish",
		);
		expect(dictionaryToolRegistration.toolId).toBe("dictionary");
		expect(pictureDictionaryToolRegistration.toolId).toBe("pictureDictionary");
	});

	// The whole point of the split: a programme grants Spanish without granting English, or
	// the other way round. Sharing a support id would collapse that back into one grant.
	test("share no PNP support id with the base capabilities", () => {
		const base = new Set([
			...(dictionaryToolRegistration.pnpSupportIds ?? []),
			...(pictureDictionaryToolRegistration.pnpSupportIds ?? []),
		]);
		const variant = [
			...(spanishDictionaryToolRegistration.pnpSupportIds ?? []),
			...(spanishPictureDictionaryToolRegistration.pnpSupportIds ?? []),
		];
		expect(variant.length).toBeGreaterThan(0);
		expect(variant.filter((id) => base.has(id))).toEqual([]);
	});

	test("claim no universal support, because a dictionary is always granted", () => {
		// Guarded here as well as in the composition: a variant that declared one would hand
		// every learner a Spanish gloss on a vocabulary item, changing what it measures.
		expect(spanishDictionaryToolRegistration.pnpSupportIds).not.toContain(
			"dictionary",
		);
	});

	test("carry their own catalog keys, derived from the capability id", () => {
		expect(spanishDictionaryToolRegistration.nameKey).toBe(
			"tools.dictionarySpanish.name",
		);
		expect(spanishPictureDictionaryToolRegistration.descriptionKey).toBe(
			"tools.pictureDictionarySpanish.description",
		);
	});
});

describe("composing a variant for another language", () => {
	test("takes a capability id, a grant and a corpus language", () => {
		const french = createDictionaryToolRegistration({
			toolId: "dictionaryFrench",
			name: "French Dictionary",
			pnpSupportIds: ["frenchDictionary"],
			lookupLanguage: "fr",
		});

		expect(french.toolId).toBe("dictionaryFrench");
		expect(french.name).toBe("French Dictionary");
		expect(french.pnpSupportIds).toEqual(["frenchDictionary"]);
		expect(french.nameKey).toBe("tools.dictionaryFrench.name");
	});

	// A host catalog will not carry PIE's key names, and `resolveKeyedString` falls back to
	// the literal when a key does not resolve — so a prefix plus a name is a complete label.
	test("takes a host catalog prefix", () => {
		const custom = createPictureDictionaryToolRegistration({
			toolId: "symbols",
			name: "Symbols",
			messageKeyPrefix: "host.tools.symbols",
		});

		expect(custom.nameKey).toBe("host.tools.symbols.name");
		expect(custom.descriptionKey).toBe("host.tools.symbols.description");
	});

	test("defaults to the base capability when given nothing", () => {
		const base = createDictionaryToolRegistration();
		expect(base.toolId).toBe("dictionary");
		expect(base.nameKey).toBe("tools.dictionary.name");
		expect(base.pnpSupportIds).toEqual(
			dictionaryToolRegistration.pnpSupportIds ?? [],
		);
	});

	test("keeps the base capabilities' own levels and icons", () => {
		const spanish = createDictionaryToolRegistration({ lookupLanguage: "es" });
		expect(spanish.supportedLevels).toEqual(
			dictionaryToolRegistration.supportedLevels,
		);
		expect(spanish.icon).toBe(dictionaryToolRegistration.icon);
	});
});

/** A DOM stub good enough for a registration that only sets properties and attributes. */
const createFakeElement = (tag: string) =>
	({
		tagName: tag.toUpperCase(),
		attrs: new Map<string, string>(),
		setAttribute(name: string, value: string) {
			this.attrs.set(name, value);
		},
		removeAttribute(name: string) {
			this.attrs.delete(name);
		},
		getAttribute(name: string) {
			return this.attrs.get(name) || null;
		},
	}) as any;

const withFakeDocument = <T>(fn: () => T): T => {
	const previous = (globalThis as { document?: Document }).document;
	(globalThis as { document?: Document }).document = {
		createElement: (tag: string) => createFakeElement(tag),
	} as unknown as Document;
	try {
		return fn();
	} finally {
		(globalThis as { document?: Document }).document = previous;
	}
};

const renderWithParams = (
	registration: ReturnType<typeof createDictionaryToolRegistration>,
	params: Record<string, unknown>,
	contentLanguage = "en-US",
) => {
	const context: ToolContext = {
		level: "section",
		assessment: {} as any,
		itemRef: { id: "i1" } as any,
		item: { id: "i1", config: { elements: { "el-1": "<p>a word</p>" } } } as any,
	};
	const toolbarContext = {
		scope: { level: "section", scopeId: "s1" },
		itemId: "i1",
		catalogId: "i1",
		language: contentLanguage,
		i18n: resolveInterfaceI18n(null),
		toolCoordinator: null,
		toolkitCoordinator: null,
		ttsService: null,
		elementToolStateStore: null,
		toggleTool: () => {},
		isToolVisible: () => false,
		subscribeVisibility: null,
		getToolRenderParams: () => params,
		componentOverrides: { toolTagMap: PACKAGED_TOOL_TAG_MAP },
	} as ToolbarContext;

	const result = withFakeDocument(() =>
		registration.renderToolbar(context, toolbarContext),
	);
	return result.elements?.[0]?.element as HTMLElement & { language?: string };
};

describe("which language reaches the panel", () => {
	// The reason the variant exists: a Spanish gloss for an English passage. If the
	// content's language won here, the variant would be indistinguishable from the base
	// capability on exactly the content it is meant for.
	test("a variant's corpus language outranks the content language", () => {
		const element = renderWithParams(
			spanishDictionaryToolRegistration,
			{ endpoint: "/api/dictionary" },
			"en-US",
		);
		expect(element?.language).toBe("es");
	});

	test("a host naming a language for the tool still wins", () => {
		const element = renderWithParams(
			spanishDictionaryToolRegistration,
			{ endpoint: "/api/dictionary", language: "es-MX" },
			"en-US",
		);
		expect(element?.language).toBe("es-MX");
	});

	test("the base capability still follows the content", () => {
		const element = renderWithParams(
			dictionaryToolRegistration,
			{ endpoint: "/api/dictionary" },
			"nl-NL",
		);
		expect(element?.language).toBe("nl-NL");
	});

	test("the picture variant carries its language too", () => {
		const element = renderWithParams(
			spanishPictureDictionaryToolRegistration,
			{ endpoint: "/api/picture-dictionary" },
			"en-US",
		);
		expect(element?.language).toBe("es");
	});
});
