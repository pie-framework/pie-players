import { strategyElementVersions } from "@pie-players/demo-ui/element-versions";
import { error } from "@sveltejs/kit";
import {
	parseElementOverridesFromUrl,
	type ElementOverrides,
} from "@pie-players/pie-players-shared/pie";
import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import { getSectionDemoById, type SectionDemoInfo } from "./sections";
import {
	aggregateElementsAcrossPages,
	applyOverridesToSection,
} from "./apply-overrides";

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
	const requestedPageId = (url.searchParams.get("page") || "").trim();
	const activeDemoPage =
		demoPages.find((page) => page.id === requestedPageId) ||
		demoPages[0] ||
		null;
	const rawSection = activeDemoPage?.section || demo.section || null;
	const allowElementVersionOverrides =
		demo.allowElementVersionOverrides !== false;
	// The strategy's versions apply whether or not URL overrides are allowed:
	// they are what the `?player` strategy can load.
	const strategyVersions = strategyElementVersions(
		url.searchParams.get("player"),
	);

	const elementOverrides = allowElementVersionOverrides
		? parseElementOverridesFromUrl(url.searchParams)
		: {};
	const section = applyOverridesToSection(rawSection, {
		...strategyVersions,
		...elementOverrides,
	});
	const aggregatedElements = allowElementVersionOverrides
		? aggregateElementsAcrossPages(
				demoPages.map((page) => ({
					...page,
					section: applyOverridesToSection(page.section, strategyVersions),
				})) as DemoPageEntry[],
				applyOverridesToSection(demo.section || null, strategyVersions),
			)
		: {};

	return {
		demo,
		demoPages,
		activeDemoPageId: activeDemoPage?.id || "",
		section,
		elementOverrides,
		aggregatedElements,
	};
}
