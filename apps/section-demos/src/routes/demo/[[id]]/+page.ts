import { error } from "@sveltejs/kit";
import { getSectionDemoById } from "$lib/content/sections";
import type { PageLoad } from "./$types";

// Disable SSR because PieSectionPlayer is built as a custom element
// which requires DOM APIs not available during SSR
export const ssr = false;

export const load: PageLoad = ({ params }) => {
	const demo = getSectionDemoById(params.id);

	if (!demo) {
		throw error(404, `Section demo not found: ${params.id}`);
	}

	return {
		demo,
		section: demo.section,
	};
};
