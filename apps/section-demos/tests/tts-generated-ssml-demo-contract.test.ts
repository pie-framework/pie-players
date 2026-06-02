/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { demo10TtsGeneratedSsmlSection } from "../src/lib/content/demo10-tts-generated-ssml";

const collectVisibleMarkup = (): string[] => {
	const visible: string[] = [];
	for (const block of demo10TtsGeneratedSsmlSection.rubricBlocks ?? []) {
		const passage = block.passage;
		if (passage?.config?.markup) visible.push(passage.config.markup);
	}
	for (const itemRef of demo10TtsGeneratedSsmlSection.assessmentItemRefs ?? []) {
		for (const model of itemRef.item?.config?.models ?? []) {
			if (typeof model.prompt === "string") visible.push(model.prompt);
			for (const choice of model.choices ?? []) {
				if (typeof choice.label === "string") visible.push(choice.label);
			}
		}
	}
	return visible;
};

describe("tts-generated-ssml demo contract", () => {
	test("authors visible math examples as namespaced MathML", () => {
		const visibleMarkup = collectVisibleMarkup().join("\n");

		expect(visibleMarkup).toContain(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"',
		);
		// Mirrors the tts-ssml content: quadratic formula + discriminant.
		expect(visibleMarkup).toContain("<msqrt>");
		expect(visibleMarkup).toContain("<mfrac>");
	});

	test("ships NO authored SSML so the toolkit generates it on the fly", () => {
		const serialized = JSON.stringify(demo10TtsGeneratedSsmlSection);

		// The whole point of this demo: identical content to tts-ssml, but with
		// every authored speech affordance removed.
		expect(serialized).not.toContain("<speak");
		expect(serialized).not.toContain("accessibilityCatalogs");
		expect(serialized).not.toContain("data-catalog-idref");
	});
});
