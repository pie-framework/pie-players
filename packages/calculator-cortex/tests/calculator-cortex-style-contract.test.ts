import { describe, expect, test } from "bun:test";

/**
 * Style invariants this package cannot express in TypeScript, checked by parsing
 * the components rather than by rendering them — the same idiom as
 * `tool-periodic-table-style-contract.test.ts`.
 *
 * Two of these encode accommodations that failed silently before, which is the
 * reason they are tests and not comments: nothing rendered wrong, the
 * accommodation simply never arrived.
 */
const COMPONENTS = [
	"CalculatorView.svelte",
	"GraphView.svelte",
	"Keypad.svelte",
	"MathFieldInput.svelte",
] as const;

const sources = new Map<string, string>();
for (const name of COMPONENTS) {
	sources.set(
		name,
		await Bun.file(new URL(`../src/${name}`, import.meta.url)).text(),
	);
}

/** Comments are stripped: they quote the very patterns these tests forbid. */
const withoutComments = (value: string): string =>
	value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const styleOf = (name: string): string => {
	const source = sources.get(name) ?? "";
	const start = source.indexOf("<style>");
	return start < 0 ? "" : withoutComments(source.slice(start));
};

const allStyles = COMPONENTS.map(styleOf).join("\n");

describe("host theming reaches the calculator", () => {
	test("no --pie-* token is declared on the calculator itself", () => {
		/*
		 * `@pie-players/pie-theme` publishes ten `[data-color-scheme]` PNP palettes and
		 * marks every token this tool uses as `required`, i.e. each scheme redefines
		 * it. A declaration *on* the calculator element wins over anything an ancestor
		 * set, so declaring `--pie-primary: …` here silently defeated the learner's
		 * colour-scheme accommodation everywhere except the six series colours, which
		 * already used the fallback pattern. Package defaults therefore live on
		 * `--cortex-*` names and are consumed as `var(--pie-x, var(--cortex-x))`.
		 */
		const declarations = [
			...allStyles.matchAll(/^\s*(--pie-[a-z0-9-]+)\s*:/gim),
		].map((match) => match[1]);
		expect(declarations).toEqual([]);
	});

	test("every --cortex-* fallback is reached through a --pie-* token", () => {
		// A bare `var(--cortex-x)` would be a package default a host cannot override.
		const bare = [
			...allStyles.matchAll(/var\(\s*(--cortex-[a-z0-9-]+)/gi),
		].filter((match) => {
			const before = allStyles.slice(
				Math.max(0, match.index - 220),
				match.index,
			);
			return !/var\(\s*--pie-[a-z0-9-]+\s*,\s*$/.test(before);
		});
		const offenders = bare
			.map((match) => match[1])
			.filter(
				(name) =>
					// Spacing, radii and the tape inset are geometry, not palette: there is
					// no canonical PIE token for them and no accommodation rides on them.
					!/^--cortex-(space|radius|tape)-/.test(name ?? ""),
			);
		expect(offenders).toEqual([]);
	});

	test("surfaces never resolve through --pie-background", () => {
		/*
		 * The canonical light theme publishes `--pie-background: rgba(255,255,255,0)`.
		 * A surface that resolved through it would be transparent over whatever the
		 * host painted, and every text-contrast guarantee in this package would stop
		 * being the package's to make. `--pie-white` and `--pie-background-dark` are
		 * opaque in both base themes and in all ten schemes.
		 */
		const surfaceRules = [
			...allStyles.matchAll(/(?:^|\n)\s*background(?:-color)?:\s*([^;]+);/g),
		].map((match) => match[1] ?? "");
		for (const rule of surfaceRules) {
			expect(rule).not.toMatch(/var\(\s*--pie-background\s*[,)]/);
		}
	});
});

describe("the layout responds to its panel, not the window", () => {
	test("no size media query survives in the package's own styles", () => {
		/*
		 * The shipped tool panel is 380px wide inside a viewport that is typically
		 * 1280px. Viewport media queries therefore never fired in production: the
		 * graphing grid stayed at its 34rem floor inside a 333px box, and the shell —
		 * which sets `overflow-x: hidden` — clipped the right 229px, most of the plot.
		 * Width-dependent rules are container queries. `max-height` stays a media
		 * query on purpose: it is the viewport's height that constrains the panel, and
		 * that is the 400%-zoom case.
		 */
		const widthQueries = [
			...allStyles.matchAll(/@media\s*\(([^)]*(?:min|max)-width[^)]*)\)/g),
		].map((match) => match[1]);
		expect(widthQueries).toEqual([]);
		expect(allStyles).toContain("container-type: inline-size");
	});

	test("every keypad and split grid uses minmax(0, 1fr)", () => {
		/*
		 * Bare `1fr` is `minmax(auto, 1fr)`, so one wide key or the plot's own
		 * min-content width widens its track and the columns stop lining up — which is
		 * the exact misalignment this layout exists to fix.
		 */
		const tracks = [
			...allStyles.matchAll(/grid-template-(?:columns|rows):([^;]+);/g),
		].map((match) => (match[1] ?? "").replace(/\s+/g, " ").trim());
		expect(tracks.length).toBeGreaterThan(0);
		for (const track of tracks) {
			// `minmax(0, 1fr)` is the whole point, so remove those before looking.
			const remainder = track.replace(/minmax\([^)]*\)/g, "");
			expect(remainder, `bare 1fr in "${track}"`).not.toMatch(/(^|[\s(])1fr/);
		}
	});
});

describe("interaction states and forced colours", () => {
	test("controls carry hover, active and a 3px focus ring", () => {
		// The package previously had no hover or active state at all, which is a large
		// part of why it read as a form rather than as an instrument.
		expect(allStyles).toContain("--pie-button-hover-bg");
		expect(allStyles).toContain("--pie-button-active-bg");
		// Anchored to a declaration start, or it also matches inside
		// `--cortex-focus-outline: …`.
		const rings = [
			...allStyles.matchAll(/(?:^|[\s{;])outline:\s*([^;]+);/g),
		].map((match) => match[1] ?? "");
		expect(rings.length).toBeGreaterThan(0);
		for (const ring of rings) expect(ring).toContain("3px");
	});

	test("every animated control is silenced under reduced motion", () => {
		for (const name of COMPONENTS) {
			const style = styleOf(name);
			if (!style.includes("transition:")) continue;
			expect(
				style,
				`${name} animates without a reduced-motion branch`,
			).toContain("prefers-reduced-motion: reduce");
		}
	});

	test("the keypad and its chrome survive forced colours", () => {
		// Forced colours strip every fill, so a keypad whose grouping and emphasis rest
		// on background colour flattens into one undifferentiated block.
		expect(styleOf("Keypad.svelte")).toContain("forced-colors: active");
		expect(styleOf("CalculatorView.svelte")).toContain("forced-colors: active");
		expect(styleOf("GraphView.svelte")).toContain("forced-colors: active");
	});
});

describe("keypad and graph markup invariants", () => {
	test("keypad rows are pinned to LTR", () => {
		// A CSS grid in an RTL interface flows columns right to left, which would
		// render [7][8][9] as [9][8][7]. Mathematics is LTR in every locale.
		expect(sources.get("Keypad.svelte")).toContain('dir="ltr"');
	});

	test("the visible series caption is still rendered", () => {
		/*
		 * It is the only non-colour cue telling a sighted colour-blind learner which
		 * line style belongs to which row, and it is the *visible* half of the pair —
		 * the field's `aria-label` duplicates it, not the reverse.
		 */
		expect(sources.get("GraphView.svelte")).toContain(
			"pie-cortex-series-description",
		);
	});

	test("the graph summary and trace stay out of a disclosure", () => {
		/*
		 * The plot is `aria-hidden`, so this text *is* the graph for assistive
		 * technology, and PIE's read-aloud excludes `.pie-sr-only` content
		 * (`isElementHiddenForTTS`) — so hiding it visually would drop it from the TTS
		 * accommodation too. Only the chrome was compacted.
		 */
		const source = sources.get("GraphView.svelte") ?? "";
		expect(source).not.toContain("<details");
		expect(source).not.toMatch(
			/class="[^"]*pie-cortex-sr-only[^"]*"[^>]*>\s*\{i18n\.t\('graphSummary'\)/,
		);
		expect(source).toContain("i18n.t('graphSummary')");
		expect(source).toContain("i18n.t('keyboardTrace')");
	});

	test("the region keeps a real h2 above the graph view's h3s", () => {
		// Demoting it to a span leaves `h1 → h3`, an axe `heading-order` violation at
		// moderate impact — which the e2e serious/critical filter cannot fail on.
		expect(sources.get("CalculatorView.svelte")).toContain("<h2");
		expect(sources.get("GraphView.svelte")).toContain("<h3>");
	});
});
