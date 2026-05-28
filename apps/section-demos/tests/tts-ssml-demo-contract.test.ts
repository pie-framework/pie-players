/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { demo4Section } from "../src/lib/content/demo4-tts-ssml";

const collectVisibleMarkup = (): string[] => {
	const visible: string[] = [];
	for (const block of demo4Section.rubricBlocks ?? []) {
		const passage = block.passage;
		if (passage?.config?.markup) visible.push(passage.config.markup);
	}
	for (const itemRef of demo4Section.assessmentItemRefs ?? []) {
		for (const model of itemRef.item?.config?.models ?? []) {
			if (typeof model.prompt === "string") visible.push(model.prompt);
			for (const choice of model.choices ?? []) {
				if (typeof choice.label === "string") visible.push(choice.label);
			}
		}
	}
	return visible;
};

const collectSpokenCatalogContent = (): string[] => {
	const spoken: string[] = [];
	for (const block of demo4Section.rubricBlocks ?? []) {
		for (const catalog of block.passage?.accessibilityCatalogs ?? []) {
			spoken.push(...catalog.cards.map((card) => card.content));
		}
	}
	for (const itemRef of demo4Section.assessmentItemRefs ?? []) {
		for (const model of itemRef.item?.config?.models ?? []) {
			for (const catalog of model.accessibilityCatalogs ?? []) {
				spoken.push(...catalog.cards.map((card) => card.content));
			}
		}
	}
	return spoken;
};

const collectIdRefs = (markup: string): string[] =>
	Array.from(markup.matchAll(/data-catalog-idref=["']([^"']+)["']/g)).map(
		(match) => match[1],
	);

describe("tts-ssml demo catalog contract", () => {
	test("keeps SSML in catalogs instead of visible markup", () => {
		const visibleMarkup = collectVisibleMarkup();
		const spokenCatalogContent = collectSpokenCatalogContent();

		expect(visibleMarkup.join("\n").toLowerCase()).not.toContain("<speak");
		expect(visibleMarkup.join("\n")).toContain("data-catalog-idref");
		expect(spokenCatalogContent.length).toBeGreaterThan(0);
		expect(spokenCatalogContent.join("\n").toLowerCase()).toContain("<speak");
	});

	test("resolves every visible catalog idref within its authored owner", () => {
		for (const block of demo4Section.rubricBlocks ?? []) {
			const passage = block.passage;
			if (!passage) continue;
			const passageCatalogIds = new Set(
				(passage.accessibilityCatalogs ?? []).map(
					(catalog) => catalog.identifier,
				),
			);
			for (const idref of collectIdRefs(passage.config?.markup ?? "")) {
				expect(passageCatalogIds.has(idref)).toBe(true);
			}
		}

		for (const itemRef of demo4Section.assessmentItemRefs ?? []) {
			for (const model of itemRef.item?.config?.models ?? []) {
				const modelCatalogIds = new Set(
					(model.accessibilityCatalogs ?? []).map(
						(catalog) => catalog.identifier,
					),
				);
				const visibleMarkup = [
					typeof model.prompt === "string" ? model.prompt : "",
					...(model.choices ?? []).map((choice: { label?: unknown }) =>
						typeof choice.label === "string" ? choice.label : "",
					),
				].join("\n");
				for (const idref of collectIdRefs(visibleMarkup)) {
					expect(modelCatalogIds.has(idref)).toBe(true);
				}
			}
		}
	});
});
