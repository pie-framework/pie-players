import { error } from '@sveltejs/kit';
import type { AssessmentSection } from '@pie-players/pie-players-shared/types';
import { getSectionDemoById, type SectionDemoInfo } from './sections';

export type DemoPageEntry = {
	id: string;
	name: string;
	section: AssessmentSection;
};

export type DemoRouteData = {
	demo: SectionDemoInfo;
	demoPages: DemoPageEntry[];
	activeDemoPageId: string;
	section: AssessmentSection | null;
};

export function loadDemoRouteDataById(demoId: string, url: URL): DemoRouteData {
	const demo = getSectionDemoById(demoId);
	if (!demo) {
		throw error(404, `Section demo not found: ${demoId}`);
	}

	const demoPages = (demo.sections || []) as DemoPageEntry[];
	const requestedPageId = (url.searchParams.get('page') || '').trim();
	const activeDemoPage =
		demoPages.find((page) => page.id === requestedPageId) || demoPages[0] || null;
	const section = activeDemoPage?.section || demo.section || null;

	return {
		demo,
		demoPages,
		activeDemoPageId: activeDemoPage?.id || '',
		section
	};
}
