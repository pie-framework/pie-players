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

import { SSMLExtractor } from "../src/services/SSMLExtractor";

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

let extractor: SSMLExtractor;
beforeEach(() => {
	extractor = new SSMLExtractor();
});

function extract(markup: string) {
	return extractor.extractFromItemConfig({
		markup,
		elements: {},
		models: [],
	} as unknown as ConfigEntity);
}

describe("SSMLExtractor docking", () => {
	test("docks the extracted catalog on the wrapper holding the visible content", () => {
		const { catalogs, cleanedConfig } = extract(
			"<p><speak>Spoken form</speak>Visible form</p>",
		);
		expect(catalogs).toHaveLength(1);
		expect(cleanedConfig.markup).toContain(
			`data-catalog-idref="${catalogs[0].identifier}"`,
		);
		expect(cleanedConfig.markup).not.toContain("<speak");
	});

	test("preserves an existing data-catalog-idref instead of overwriting it", () => {
		// The attribute is one canonical name pointing at a whole card array, and
		// the wrapper is usually an element the author wrote. Replacing the
		// reference to win the spoken type would take that node's braille,
		// simplified-language and sign-language cards down with it — so the
		// authored reference stays and the extracted catalog goes undocked.
		const { catalogs, cleanedConfig } = extract(
			'<p data-catalog-idref="authored-prompt"><speak>Spoken form</speak>Visible form</p>',
		);
		expect(cleanedConfig.markup).toContain(
			'data-catalog-idref="authored-prompt"',
		);
		expect(cleanedConfig.markup).not.toContain("auto-markup");
		// Still emitted: a reader resolving through the item's catalog set can
		// find it, and dropping it silently would lose the author's SSML outright.
		expect(catalogs).toHaveLength(1);
		expect(catalogs[0].cards[0].content).toContain("Spoken form");
		// The SSML never stays in visible content either way.
		expect(cleanedConfig.markup).not.toContain("<speak");
	});

	test("keeps the first docking when two <speak> elements share one wrapper", () => {
		const { catalogs, cleanedConfig } = extract(
			"<p><speak>First</speak><speak>Second</speak>Visible form</p>",
		);
		expect(catalogs).toHaveLength(2);
		expect(cleanedConfig.markup).toContain(
			`data-catalog-idref="${catalogs[0].identifier}"`,
		);
		expect(cleanedConfig.markup).not.toContain(catalogs[1].identifier);
	});

	test("emits an undocked catalog when a <speak> has no element around it", () => {
		// Nothing is synthesized to stand in for a docking node: a `<speak>` with
		// no element around it has no content node to be an alternate *for*, and a
		// span invented to hold the reference would have to invent visible content
		// too — which would put spoken phrasing ("x squared") on screen.
		const { catalogs, cleanedConfig } = extract("<speak>x squared</speak>");
		expect(catalogs).toHaveLength(1);
		expect(catalogs[0].cards[0].content).toContain("x squared");
		expect(cleanedConfig.markup).not.toContain("<span");
		expect(cleanedConfig.markup).not.toContain("data-catalog-idref");
		expect(cleanedConfig.markup).not.toContain("x squared");
	});
});
