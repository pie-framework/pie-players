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

	test("authors visible math examples as MathML", () => {
		const visibleMarkup = collectVisibleMarkup().join("\n");

		expect(visibleMarkup).toContain(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"',
		);
		expect(visibleMarkup).not.toContain("ax² + bx + c = 0");
		expect(visibleMarkup).not.toContain("x = (-b ± √(b² - 4ac)) / 2a");
		expect(visibleMarkup).not.toContain("b² - 4ac");
		expect(visibleMarkup).not.toContain("x² - 5x + 6 = 0");
		expect(visibleMarkup).not.toContain("(x - 2)(x - 3)");
		expect(visibleMarkup).toContain("<mo>&#x2062;</mo>");
		expect(visibleMarkup).not.toContain("<mn>4</mn><mi>a</mi><mi>c</mi>");
		expect(visibleMarkup).not.toContain("<mi>b</mi><mi>x</mi>");
		expect(visibleMarkup).not.toContain("<mn>5</mn><mi>x</mi>");
	});

	test("scopes Q1 math expressions to their own MathML catalog refs", () => {
		const q1Model = demo4Section.assessmentItemRefs?.[0]?.item?.config
			?.models?.[0] as { prompt?: string; choices?: Array<{ label?: string }> };
		const prompt = q1Model.prompt || "";
		const choiceB = q1Model.choices?.find((choice) =>
			choice.label?.includes("q1-choice-b-equation"),
		)?.label;

		expect(prompt).toContain('data-catalog-idref="q1-prompt-text"');
		expect(prompt).toContain('data-catalog-idref="q1-equation"');
		expect(prompt).not.toContain('data-catalog-idref="q1-prompt"');
		expect(choiceB).toContain('data-catalog-idref="q1-choice-b-text"');
		expect(choiceB).toContain('data-catalog-idref="q1-choice-b-equation"');
		expect(choiceB).not.toContain('data-catalog-idref="q1-choice-b"');
	});

	test("authors catalog math speech with explicit letter pronunciation", () => {
		const spokenCatalogContent = collectSpokenCatalogContent().join("\n");

		expect(spokenCatalogContent).toContain("A X squared");
		expect(spokenCatalogContent).toContain("B X");
		expect(spokenCatalogContent).toContain("4 A C");
		expect(spokenCatalogContent).not.toContain("a x squared");
		expect(spokenCatalogContent).not.toContain("four a c");
	});
});
