/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { demo10TtsMathSection } from "../src/lib/content/demo10-tts-math";

const collectVisibleMarkup = (): string[] => {
	const visible: string[] = [];
	for (const block of demo10TtsMathSection.rubricBlocks ?? []) {
		const passage = block.passage;
		if (passage?.config?.markup) visible.push(passage.config.markup);
	}
	for (const itemRef of demo10TtsMathSection.assessmentItemRefs ?? []) {
		for (const model of itemRef.item?.config?.models ?? []) {
			if (typeof model.prompt === "string") visible.push(model.prompt);
			for (const choice of model.choices ?? []) {
				if (typeof choice.label === "string") visible.push(choice.label);
			}
		}
	}
	return visible;
};

describe("tts-math demo contract", () => {
	test("authors visible math examples as namespaced MathML", () => {
		const visibleMarkup = collectVisibleMarkup().join("\n");

		expect(visibleMarkup).toContain(
			'<math xmlns="http://www.w3.org/1998/Math/MathML"',
		);
		expect(visibleMarkup).not.toContain(">x^2</span>");
		expect(visibleMarkup).not.toContain('data-mathml="<math><');
		expect(visibleMarkup).toContain("<msub>");
		expect(visibleMarkup).not.toMatch(/<mrow>\s*<mi>y<\/mi>\s*<mn>2<\/mn>/);
		expect(visibleMarkup).not.toMatch(/<mrow>\s*<mi>x<\/mi>\s*<mn>1<\/mn>/);
	});
});
