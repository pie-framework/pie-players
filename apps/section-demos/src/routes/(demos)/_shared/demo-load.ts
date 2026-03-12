import { error } from "@sveltejs/kit";
import { getSectionDemoById } from "$lib/content/sections";
import type { Load } from "@sveltejs/kit";

export function createDemoLoad(demoId: string): Load {
	return ({ params, url }) => {
		const demo = getSectionDemoById(demoId);
		if (!demo) {
			throw error(404, `Section demo not found: ${demoId}`);
		}

		const demoPages = demo.sections || [];
		const requestedPageId = params.id || url.searchParams.get("page") || "";
		const activeDemoPage =
			demoPages.find((page) => page.id === requestedPageId) || demoPages[0] || null;
		const section = activeDemoPage?.section || demo.section || null;

		return {
			demo,
			demoPages,
			activeDemoPageId: activeDemoPage?.id || "",
			section
		};
	};
}
