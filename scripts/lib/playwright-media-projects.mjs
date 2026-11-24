import { devices } from "@playwright/test";

/**
 * The Chromium projects that rerun a config's axe tests under the media settings a
 * learner can turn on: forced colours over a light and over a dark system palette, and
 * reduced motion. `test-support/a11y-media.ts` holds the check each test runs in them.
 *
 * Chromium only: its emulated forced-colours palette follows `colorScheme`, while Firefox
 * emulates a light palette only and WebKit forces nothing.
 *
 * `testMatch` limits a project to the config's axe spec files, and the `@axe` tag to the
 * tests in them that run axe.
 *
 * Opt-in through `PIE_E2E_A11Y_MEDIA=1`, because Playwright runs every project of a config
 * unless `--project` names some: the required suites and the pre-push gate name none, so
 * without the variable they get none of these. The `test:e2e:a11y-media:*` scripts set it
 * and select the projects by their shared `a11y-` prefix.
 *
 * @param {RegExp} testMatch the config's spec files that run axe
 * @returns {import("@playwright/test").Project[]}
 */
export function a11yMediaProjects(testMatch) {
	if (process.env.PIE_E2E_A11Y_MEDIA !== "1") return [];
	const grep = /@axe\b/;
	const chrome = devices["Desktop Chrome"];
	return [
		{
			name: "a11y-forced-colors-light",
			testMatch,
			grep,
			use: { ...chrome, forcedColors: "active", colorScheme: "light" },
		},
		{
			name: "a11y-forced-colors-dark",
			testMatch,
			grep,
			use: { ...chrome, forcedColors: "active", colorScheme: "dark" },
		},
		{
			name: "a11y-reduced-motion",
			testMatch,
			grep,
			use: { ...chrome, reducedMotion: "reduce" },
		},
	];
}
