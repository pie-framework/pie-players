import { getAssessmentDemoById } from "$lib/content/assessments";
import { resolveAssessmentDemoTtsBackend } from "$lib/demo-runtime/demo-tts";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const demo = getAssessmentDemoById("session-hydrate-db");
	if (!demo) {
		throw error(404, "Assessment demo not found");
	}
	return {
		demo,
		ttsBackend: await resolveAssessmentDemoTtsBackend(fetch),
	};
};
