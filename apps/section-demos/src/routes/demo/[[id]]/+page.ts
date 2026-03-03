import { error } from "@sveltejs/kit";
import { getSectionDemoById } from "$lib/content/sections";
import type { PageLoad } from "./$types";

// Disable SSR because demo route custom elements require DOM APIs.
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
