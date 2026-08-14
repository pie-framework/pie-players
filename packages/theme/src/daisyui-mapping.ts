/**
 * The one table that says which DaisyUI slot each `--pie-*` token comes from,
 * and one renderer that turns it into variables.
 *
 * It exists because the same 47-row table was written out four times — the
 * provider adapter here, two mappers in `@pie-players/pie-theme-daisyui`, and
 * that package's `bridge.css` — and copies drift. Two defects lived in the drift:
 * `--pie-missing` was corrected to `--color-warning` in one copy while three kept
 * it on `--color-error`, and the parity test that was supposed to catch this
 * compared only the token names, never the slot each one derived from.
 *
 * CSS cannot import a table, so `bridge.css` stays hand-written and is held to
 * this one by `tests/daisyui-mapping-parity.test.mjs` instead.
 */

import {
	LEGIBLE_NON_TEXT_MINIMUM,
	LEGIBLE_TEXT_MINIMUM,
	UNMEASURED_HUE_WEIGHT,
	UNMEASURED_NON_TEXT_HUE_WEIGHT,
	type ColorMeasure,
	legibleColorAgainst,
} from "./contrast.js";

/** The DaisyUI slots this mapping reads. Not all of DaisyUI's palette. */
export type DaisySlot =
	| "base100"
	| "base200"
	| "base300"
	| "baseContent"
	| "primary"
	| "secondary"
	| "accent"
	| "neutral"
	| "neutralContent"
	| "success"
	| "error"
	| "warning";

export const DAISY_SLOT_CSS_VARIABLES: Record<DaisySlot, string> = {
	base100: "--color-base-100",
	base200: "--color-base-200",
	base300: "--color-base-300",
	baseContent: "--color-base-content",
	primary: "--color-primary",
	secondary: "--color-secondary",
	accent: "--color-accent",
	neutral: "--color-neutral",
	neutralContent: "--color-neutral-content",
	success: "--color-success",
	error: "--color-error",
	warning: "--color-warning",
};

export type DaisyMappingEntry =
	/** The slot, verbatim. */
	| { token: string; kind: "direct"; from: DaisySlot }
	/** A fixed blend, for tints and shades that are not contrast-critical. */
	| {
			token: string;
			kind: "mix";
			from: DaisySlot;
			towards: DaisySlot;
			weight: number;
	  }
	/**
	 * The slot if it already clears `minimum` against the page, otherwise the
	 * largest share of it that does. For the tokens PIE paints as a foreground or
	 * as the boundary of a control, where a DaisyUI surface slot taken verbatim is
	 * unreadable.
	 */
	| {
			token: string;
			kind: "legible";
			from: DaisySlot;
			minimum: number;
			fallbackWeight: number;
	  };

const legible = (token: string, from: DaisySlot): DaisyMappingEntry => ({
	token,
	kind: "legible",
	from,
	minimum: LEGIBLE_TEXT_MINIMUM,
	fallbackWeight: UNMEASURED_HUE_WEIGHT,
});

const boundary = (token: string, from: DaisySlot): DaisyMappingEntry => ({
	token,
	kind: "legible",
	from,
	minimum: LEGIBLE_NON_TEXT_MINIMUM,
	fallbackWeight: UNMEASURED_NON_TEXT_HUE_WEIGHT,
});

const direct = (token: string, from: DaisySlot): DaisyMappingEntry => ({
	token,
	kind: "direct",
	from,
});

const mix = (
	token: string,
	from: DaisySlot,
	towards: DaisySlot,
	weight: number,
): DaisyMappingEntry => ({ token, kind: "mix", from, towards, weight });

export const DAISYUI_PIE_TOKEN_MAP: readonly DaisyMappingEntry[] = [
	direct("--pie-background", "base100"),
	direct("--pie-background-dark", "base200"),
	direct("--pie-secondary-background", "base200"),
	direct("--pie-dropdown-background", "base300"),
	direct("--pie-text", "baseContent"),
	direct("--pie-primary", "primary"),
	mix("--pie-primary-light", "primary", "base100", 60),
	mix("--pie-primary-dark", "primary", "baseContent", 75),
	mix("--pie-faded-primary", "primary", "base100", 20),
	direct("--pie-secondary", "secondary"),
	mix("--pie-secondary-light", "secondary", "base100", 60),
	mix("--pie-secondary-dark", "secondary", "baseContent", 75),
	direct("--pie-tertiary", "accent"),
	mix("--pie-tertiary-light", "accent", "base100", 60),
	// Boundaries. `--color-base-300` is a surface tint, so an outline painted with
	// it sits at 1.09:1 to 1.53:1 across the shipped themes against the 3:1 SC
	// 1.4.11 asks -- and since `--pie-button-bg` is `--color-base-100`, the page's
	// own colour, that outline is the only thing separating a button from the page.
	boundary("--pie-border", "base300"),
	// Not corrected: the players use this one for card edges and pane dividers,
	// which 1.4.11 exempts, and a 3:1 outline around every item card would be a
	// visual regression rather than a fix.
	direct("--pie-border-light", "base200"),
	boundary("--pie-border-dark", "neutral"),
	boundary("--pie-border-gray", "base300"),
	// Foregrounds. DaisyUI's semantic slots are chosen to sit behind their
	// `-content` counterparts; PIE paints these as `color:`.
	legible("--pie-correct", "success"),
	mix("--pie-correct-secondary", "success", "base100", 20),
	legible("--pie-correct-tertiary", "success"),
	legible("--pie-correct-icon", "success"),
	// Authored red emphasis inside content. Taken from the error slot through the
	// legible correction rather than mixed from a bare red: a red-toward-ink mix
	// falls under 4.5:1 on seven of the 35 shipped themes (2.91:1 on `aqua`),
	// while the corrected error family clears it on all of them.
	legible("--pie-content-emphasis", "error"),
	legible("--pie-incorrect", "error"),
	mix("--pie-incorrect-secondary", "error", "base100", 20),
	legible("--pie-incorrect-icon", "error"),
	// Warning, not error: an unanswered question is not a wrong one, and both on
	// `--color-error` made the two states the same colour in every theme. This is
	// the mapping the rest of PIE declares -- pie-elements-ng keys `--pie-missing`
	// to `warning`, and the assessment toolkit's `.pie-warning` rule paints it.
	legible("--pie-missing", "warning"),
	legible("--pie-missing-icon", "warning"),
	direct("--pie-disabled", "base300"),
	direct("--pie-disabled-secondary", "base200"),
	mix("--pie-focus-checked", "primary", "base100", 20),
	direct("--pie-focus-checked-border", "primary"),
	direct("--pie-focus-unchecked", "base200"),
	direct("--pie-focus-unchecked-border", "base300"),
	direct("--pie-blue-grey-100", "base100"),
	direct("--pie-blue-grey-300", "base200"),
	direct("--pie-blue-grey-600", "base300"),
	direct("--pie-blue-grey-900", "baseContent"),
	direct("--pie-black", "neutralContent"),
	direct("--pie-white", "base100"),
	direct("--pie-button-bg", "base100"),
	boundary("--pie-button-border", "base300"),
	direct("--pie-button-color", "baseContent"),
	direct("--pie-button-hover-bg", "base200"),
	boundary("--pie-button-hover-border", "base300"),
	direct("--pie-button-hover-color", "baseContent"),
	// DaisyUI guarantees base-content against the page, not every deeper surface.
	// `valentine` is 4.17:1 on base-300. A 70% share is the nearest 5% step
	// toward base-100 that keeps the pair at 4.5:1 across all shipped themes.
	mix("--pie-button-active-bg", "base300", "base100", 70),
	// The keyboard focus indicator, and the one token here that is only ever an
	// `outline` -- eight declarations across the tools, never a fill. It takes
	// `--color-primary`, which DaisyUI pairs with `--color-primary-content` for
	// fills rather than choosing for contrast against the page, so it inherited
	// 1.90:1 in `business`. `--pie-primary` itself cannot be corrected the same
	// way: PIE paints it as a foreground in some places and as a button fill in
	// others, and a value legible against the page is the wrong one behind
	// `--color-primary-content`.
	boundary("--pie-button-focus-outline", "primary"),
];

/**
 * @param read one DaisyUI slot's value, or `undefined` when this source has none
 * @param measure resolves a colour so `legible` entries can be corrected against
 *   a measured ratio. Omit it where the values are `var()` references rather than
 *   colours: those cannot be measured, and every `legible` entry then takes its
 *   pessimistic fixed weight instead.
 */
export function resolveDaisyPieVariables(args: {
	read: (slot: DaisySlot) => string | undefined;
	measure?: ColorMeasure | null;
}): Record<string, string> {
	const { read, measure } = args;
	const resolved: Record<string, string> = {};
	for (const entry of DAISYUI_PIE_TOKEN_MAP) {
		const from = read(entry.from);
		if (!from) {
			continue;
		}
		let value: string | undefined;
		if (entry.kind === "direct") {
			value = from;
		} else if (entry.kind === "mix") {
			const towards = read(entry.towards);
			value = towards
				? `color-mix(in srgb, ${from} ${entry.weight}%, ${towards})`
				: undefined;
		} else {
			value = legibleColorAgainst({
				hue: from,
				text: read("baseContent"),
				background: read("base100"),
				measure,
				minimum: entry.minimum,
				unmeasuredHueWeight: entry.fallbackWeight,
			});
		}
		if (value) {
			resolved[entry.token] = value;
		}
	}
	return resolved;
}
