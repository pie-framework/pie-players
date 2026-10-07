import {
	type PreloadedController,
	type PreloadedElement,
	type PreloadedRegistrationOptions,
	registerPreloadedElements,
} from "@pie-players/pie-item-player/preloaded";
import { parsePackageName } from "@pie-players/pie-players-shared/pie";
import { ESM_DEMO_ELEMENT_VERSIONS } from "./element-versions";

/**
 * Registration of the demo content's elements for `strategy="preloaded"`, as a
 * host whose bundler resolves pie-elements-ng runs it: each element's
 * `./browser/delivery` and `./browser/controller` come from the packages
 * demo-ui installs, at the installed version, and the players load no element
 * code. The controller is registered because the demo players are not hosted.
 *
 * Content authors whatever version it was written against; the players align
 * each authored version to the registered one. A package demo-ui does not
 * install cannot be preloaded.
 */

/**
 * The registration options of every demo that preloads pie-elements-ng. The
 * bundler leaves the copies of the MathJax adapter in the elements no npm root
 * of their own, so they load MathJax's fonts and speech from jsDelivr's.
 */
export const DEMO_PRELOADED_OPTIONS: PreloadedRegistrationOptions = {
	math: { assetRoot: "https://cdn.jsdelivr.net/npm" },
};

type BrowserBuild = {
	delivery: () => Promise<unknown>;
	controller: () => Promise<unknown>;
};

/** The literal specifiers are what lets the bundler resolve each build. */
export const ESM_DEMO_BROWSER_BUILDS: Readonly<Record<string, BrowserBuild>> = {
	"@pie-element/categorize": {
		delivery: () => import("@pie-element/categorize/browser/delivery"),
		controller: () => import("@pie-element/categorize/browser/controller"),
	},
	"@pie-element/charting": {
		delivery: () => import("@pie-element/charting/browser/delivery"),
		controller: () => import("@pie-element/charting/browser/controller"),
	},
	"@pie-element/complex-rubric": {
		delivery: () => import("@pie-element/complex-rubric/browser/delivery"),
		controller: () => import("@pie-element/complex-rubric/browser/controller"),
	},
	"@pie-element/drag-in-the-blank": {
		delivery: () => import("@pie-element/drag-in-the-blank/browser/delivery"),
		controller: () =>
			import("@pie-element/drag-in-the-blank/browser/controller"),
	},
	"@pie-element/drawing-response": {
		delivery: () => import("@pie-element/drawing-response/browser/delivery"),
		controller: () =>
			import("@pie-element/drawing-response/browser/controller"),
	},
	"@pie-element/ebsr": {
		delivery: () => import("@pie-element/ebsr/browser/delivery"),
		controller: () => import("@pie-element/ebsr/browser/controller"),
	},
	"@pie-element/explicit-constructed-response": {
		delivery: () =>
			import("@pie-element/explicit-constructed-response/browser/delivery"),
		controller: () =>
			import("@pie-element/explicit-constructed-response/browser/controller"),
	},
	"@pie-element/extended-text-entry": {
		delivery: () => import("@pie-element/extended-text-entry/browser/delivery"),
		controller: () =>
			import("@pie-element/extended-text-entry/browser/controller"),
	},
	"@pie-element/fraction-model": {
		delivery: () => import("@pie-element/fraction-model/browser/delivery"),
		controller: () => import("@pie-element/fraction-model/browser/controller"),
	},
	"@pie-element/graphing": {
		delivery: () => import("@pie-element/graphing/browser/delivery"),
		controller: () => import("@pie-element/graphing/browser/controller"),
	},
	"@pie-element/graphing-solution-set": {
		delivery: () =>
			import("@pie-element/graphing-solution-set/browser/delivery"),
		controller: () =>
			import("@pie-element/graphing-solution-set/browser/controller"),
	},
	"@pie-element/hotspot": {
		delivery: () => import("@pie-element/hotspot/browser/delivery"),
		controller: () => import("@pie-element/hotspot/browser/controller"),
	},
	"@pie-element/image-cloze-association": {
		delivery: () =>
			import("@pie-element/image-cloze-association/browser/delivery"),
		controller: () =>
			import("@pie-element/image-cloze-association/browser/controller"),
	},
	"@pie-element/inline-dropdown": {
		delivery: () => import("@pie-element/inline-dropdown/browser/delivery"),
		controller: () => import("@pie-element/inline-dropdown/browser/controller"),
	},
	"@pie-element/likert": {
		delivery: () => import("@pie-element/likert/browser/delivery"),
		controller: () => import("@pie-element/likert/browser/controller"),
	},
	"@pie-element/match": {
		delivery: () => import("@pie-element/match/browser/delivery"),
		controller: () => import("@pie-element/match/browser/controller"),
	},
	"@pie-element/match-list": {
		delivery: () => import("@pie-element/match-list/browser/delivery"),
		controller: () => import("@pie-element/match-list/browser/controller"),
	},
	"@pie-element/math-inline": {
		delivery: () => import("@pie-element/math-inline/browser/delivery"),
		controller: () => import("@pie-element/math-inline/browser/controller"),
	},
	"@pie-element/math-templated": {
		delivery: () => import("@pie-element/math-templated/browser/delivery"),
		controller: () => import("@pie-element/math-templated/browser/controller"),
	},
	"@pie-element/matrix": {
		delivery: () => import("@pie-element/matrix/browser/delivery"),
		controller: () => import("@pie-element/matrix/browser/controller"),
	},
	"@pie-element/mc-populated-blank": {
		delivery: () => import("@pie-element/mc-populated-blank/browser/delivery"),
		controller: () =>
			import("@pie-element/mc-populated-blank/browser/controller"),
	},
	"@pie-element/multi-trait-rubric": {
		delivery: () => import("@pie-element/multi-trait-rubric/browser/delivery"),
		controller: () =>
			import("@pie-element/multi-trait-rubric/browser/controller"),
	},
	"@pie-element/multiple-choice": {
		delivery: () => import("@pie-element/multiple-choice/browser/delivery"),
		controller: () => import("@pie-element/multiple-choice/browser/controller"),
	},
	"@pie-element/number-line": {
		delivery: () => import("@pie-element/number-line/browser/delivery"),
		controller: () => import("@pie-element/number-line/browser/controller"),
	},
	"@pie-element/passage": {
		delivery: () => import("@pie-element/passage/browser/delivery"),
		controller: () => import("@pie-element/passage/browser/controller"),
	},
	"@pie-element/placement-ordering": {
		delivery: () => import("@pie-element/placement-ordering/browser/delivery"),
		controller: () =>
			import("@pie-element/placement-ordering/browser/controller"),
	},
	"@pie-element/rubric": {
		delivery: () => import("@pie-element/rubric/browser/delivery"),
		controller: () => import("@pie-element/rubric/browser/controller"),
	},
	"@pie-element/select-text": {
		delivery: () => import("@pie-element/select-text/browser/delivery"),
		controller: () => import("@pie-element/select-text/browser/controller"),
	},
};

type ElementMap = Readonly<Record<string, string>>;

/** Register every element the maps (tag to package spec) name. */
export async function preloadDemoElements(
	elementMaps: readonly ElementMap[],
): Promise<void> {
	const entries = elementMaps.flatMap((elements) => Object.entries(elements));
	if (entries.length === 0) {
		throw new Error("No element packages were found to preload");
	}
	const packageNames = [
		...new Set(entries.map(([, spec]) => parsePackageName(spec).name)),
	];
	const notInstalled = packageNames.filter(
		(name) => !ESM_DEMO_BROWSER_BUILDS[name],
	);
	if (notInstalled.length > 0) {
		throw new Error(
			`The preloaded strategy registers the pie-elements-ng packages demo-ui installs; ${notInstalled.join(", ")} is not one of them`,
		);
	}
	const builds = new Map(
		await Promise.all(
			packageNames.map(async (name) => {
				const build = ESM_DEMO_BROWSER_BUILDS[name] as BrowserBuild;
				const [element, controller] = await Promise.all([
					build.delivery(),
					build.controller(),
				]);
				return [name, { element, controller }] as const;
			}),
		),
	);

	registerPreloadedElements(
		entries.map(([tag, spec]) => {
			const { name } = parsePackageName(spec);
			const { element, controller } = builds.get(name) as {
				element: unknown;
				controller: unknown;
			};
			return {
				tag,
				package: name,
				version: ESM_DEMO_ELEMENT_VERSIONS[name] as string,
				element: element as PreloadedElement["element"],
				controller: controller as PreloadedController,
			};
		}),
		DEMO_PRELOADED_OPTIONS,
	);
}
