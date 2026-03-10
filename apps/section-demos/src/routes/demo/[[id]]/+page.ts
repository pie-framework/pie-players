import { error } from "@sveltejs/kit";
import { getSectionDemoById } from "$lib/content/sections";
import type { PageLoad } from "./$types";

// Disable SSR because demo route custom elements require DOM APIs.
export const ssr = false;

export const load: PageLoad = ({ params, url }) => {
	const demo = getSectionDemoById(params.id);

	if (!demo) {
		throw error(404, `Section demo not found: ${params.id}`);
	}

	const demoPages = demo.sections || [];
	const requestedPageId = url.searchParams.get("page") || "";
	const activeDemoPage =
		demoPages.find((page) => page.id === requestedPageId) || demoPages[0] || null;
	const section = activeDemoPage?.section || demo.section || null;

	return {
		demo,
		demoPages,
		activeDemoPageId: activeDemoPage?.id || "",
		section,
	};
};
