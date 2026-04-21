import { error } from '@sveltejs/kit';
import {
	parseElementOverridesFromUrl,
	type ElementOverrides
} from '@pie-players/pie-players-shared/pie';
import type { AssessmentSection } from '@pie-players/pie-players-shared/types';
import { getSectionDemoById, type SectionDemoInfo } from './sections';
import {
	aggregateElementsAcrossPages,
	applyOverridesToSection
} from './apply-overrides';

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
	elementOverrides: ElementOverrides;
	aggregatedElements: Record<string, string>;
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
	const rawSection = activeDemoPage?.section || demo.section || null;

	const elementOverrides = parseElementOverridesFromUrl(url.searchParams);
	const section = applyOverridesToSection(rawSection, elementOverrides);
	const aggregatedElements = aggregateElementsAcrossPages(demoPages, demo.section || null);

	return {
		demo,
		demoPages,
		activeDemoPageId: activeDemoPage?.id || '',
		section,
		elementOverrides,
		aggregatedElements
	};
}
