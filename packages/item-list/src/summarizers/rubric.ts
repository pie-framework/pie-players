import type { ElementSummary } from "@pie-element/shared-types";
import { isRecord, type Model, option, summarizer, text } from "./shared.js";

/** Score points as options, highest first as delivery lists them, each labelled with its score. */
export function rubricSummary(model: Model): ElementSummary {
	const points = Array.isArray(model.points) ? model.points : [];
	const lowest = model.excludeZero === true ? 1 : 0;
	const options = [];
	for (let score = points.length - 1; score >= lowest; score -= 1) {
		const description = text(points[score]) ?? "";
		options.push(option(String(score), `<b>${score}</b> ${description}`.trim()));
	}
	return { options, manualScoring: true };
}

export const rubric = summarizer(rubricSummary);

/** A trait per part, its score descriptors as options. */
function multiTraitSummary(model: Model): ElementSummary {
	const parts = [];
	for (const scale of Array.isArray(model.scales) ? model.scales : []) {
		if (!isRecord(scale)) continue;
		const labels = Array.isArray(scale.scorePointsLabels) ? scale.scorePointsLabels : [];
		const lowest = model.excludeZero === true ? 1 : 0;
		for (const [index, trait] of (Array.isArray(scale.traits) ? scale.traits : []).entries()) {
			if (!isRecord(trait)) continue;
			const descriptors = Array.isArray(trait.scorePointsDescriptors) ? trait.scorePointsDescriptors : [];
			const options = [];
			for (let score = lowest; score < descriptors.length; score += 1) {
				const label = text(labels[score]);
				const descriptor = text(descriptors[score]) ?? "";
				options.push(option(String(score), `<b>${label ?? score}</b> ${descriptor}`.trim()));
			}
			parts.push({ id: String(index), prompt: text(trait.name), options });
		}
	}
	return { parts, manualScoring: true };
}

export const multiTraitRubric = summarizer(multiTraitSummary);

/** The rubric `rubricType` selects. */
export const complexRubric = summarizer((model) => {
	const rubrics = isRecord(model.rubrics) ? model.rubrics : {};
	const type = text(model.rubricType) ?? "simpleRubric";
	const selected = isRecord(rubrics[type]) ? rubrics[type] : {};
	return type === "multiTraitRubric" ? multiTraitSummary(selected) : rubricSummary(selected);
});
