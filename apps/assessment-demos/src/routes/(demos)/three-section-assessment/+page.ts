import { getAssessmentDemoById } from "$lib/content/assessments";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const ssr = false;

export const load: PageLoad = () => {
	const demo = getAssessmentDemoById("three-section-assessment");
	if (!demo) {
		throw error(404, "Assessment demo not found");
	}
	return {
		demo,
	};
};
