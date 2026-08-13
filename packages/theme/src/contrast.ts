/**
 * Enough colour maths to keep a resolved token legible: WCAG relative luminance,
 * a contrast ratio, and the largest share of a hue that still clears a threshold
 * against the surface it is painted on.
 *
 * Colour parsing is injected rather than implemented here. Provider slots resolve
 * to `oklch()` under DaisyUI 5, so an oklch-to-sRGB implementation in this file
 * would be a second opinion about colours the browser has already decided;
 * `createCanvasColorMeasure` asks the browser instead.
 */

export interface Srgb {
	r: number;
	g: number;
	b: number;
	/** 0..1 */
	a: number;
}

/** Resolves any CSS colour syntax to 8-bit sRGB, or `null` if not a colour. */
export type ColorMeasure = (value: string) => Srgb | null;

/** WCAG 2.2 1.4.3 for text. */
export const LEGIBLE_TEXT_MINIMUM = 4.5;

/** WCAG 2.2 1.4.11 for component boundaries, states and graphical objects. */
export const LEGIBLE_NON_TEXT_MINIMUM = 3;

/**
 * The hue share used when contrast cannot be measured. 30% is the largest 5%
 * step that clears 4.5:1 for every success, error and warning slot across
 * DaisyUI's 28 shipped themes — measured across all 84 combinations rather than
 * picked. It is deliberately pessimistic: a theme whose slot needed no
 * correction at all still gets pulled most of the way to the text colour.
 */
export const UNMEASURED_HUE_WEIGHT = 30;

/**
 * The same pessimistic fallback for a 3:1 target: 35% is the largest 5% step
 * that clears 3:1 for `--color-base-300` and `--color-neutral` in all 28 themes.
 */
export const UNMEASURED_NON_TEXT_HUE_WEIGHT = 35;

const HUE_WEIGHT_STEP = 5;

function channelLuminance(channel: number): number {
	const c = channel / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. Alpha is ignored; composite before calling. */
export function relativeLuminance(color: Srgb): number {
	return (
		0.2126 * channelLuminance(color.r) +
		0.7152 * channelLuminance(color.g) +
		0.0722 * channelLuminance(color.b)
	);
}

export function contrastRatio(foreground: Srgb, background: Srgb): number {
	const a = relativeLuminance(foreground);
	const b = relativeLuminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function mixTowards(
	hue: string,
	target: string,
	hueWeight: number,
): string {
	return `color-mix(in srgb, ${hue} ${hueWeight}%, ${target})`;
}

/**
 * Resolves any CSS colour the browser understands to 8-bit sRGB by painting one
 * pixel and reading it back, so `oklch()` and `color-mix()` need no parser here.
 *
 * Returns `null` where there is no canvas to paint on — a server render, or a
 * DOM shim in tests — which callers treat as "contrast is unmeasurable" rather
 * than as an error.
 */
export function createCanvasColorMeasure(): ColorMeasure | null {
	if (typeof document === "undefined") {
		return null;
	}
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext?.("2d", { willReadFrequently: true });
	if (!context) {
		return null;
	}

	/**
	 * `fillStyle` silently ignores a value it cannot parse, leaving the previous
	 * one in place. Assigning over two different sentinels separates the cases
	 * exactly: a parsed colour serializes the same both times, an ignored one
	 * keeps whichever sentinel it started from.
	 */
	return (value: string): Srgb | null => {
		const trimmed = value.trim();
		if (!trimmed) {
			return null;
		}
		try {
			context.fillStyle = "#000000";
			context.fillStyle = trimmed;
			const fromBlack = context.fillStyle;
			context.fillStyle = "#ffffff";
			context.fillStyle = trimmed;
			if (context.fillStyle !== fromBlack) {
				return null;
			}
			context.clearRect(0, 0, 1, 1);
			context.fillRect(0, 0, 1, 1);
			const data = context.getImageData(0, 0, 1, 1).data;
			return {
				r: data[0],
				g: data[1],
				b: data[2],
				a: data[3] / 255,
			};
		} catch {
			return null;
		}
	};
}

/**
 * The given hue if it already clears `minimum` against `background`, otherwise
 * the largest share of it that does, mixed toward `text`.
 *
 * Mixing toward the theme's own text colour rather than toward black or white
 * uses the theme's own guarantee: `text` is what that theme chose to be readable
 * on that surface, in a light theme and a dark one alike. Stepping down from the
 * top keeps as much hue as the threshold allows, so a slot that was already fine
 * comes back untouched and a slot that was invisible loses only what it must.
 */
export function legibleColorAgainst(args: {
	hue?: string;
	text?: string;
	background?: string;
	measure?: ColorMeasure | null;
	minimum?: number;
	unmeasuredHueWeight?: number;
}): string | undefined {
	const { hue, text, background, measure } = args;
	if (!hue) {
		return undefined;
	}
	if (!text) {
		return hue;
	}
	const minimum = args.minimum ?? LEGIBLE_TEXT_MINIMUM;
	const fallbackWeight = args.unmeasuredHueWeight ?? UNMEASURED_HUE_WEIGHT;
	const unmeasured = (): string => mixTowards(hue, text, fallbackWeight);
	if (!measure || !background) {
		return unmeasured();
	}
	const surface = measure(background);
	const raw = measure(hue);
	// Compositing a translucent value needs the surface behind the surface, which
	// a provider adapter reading one element does not have. Correcting against a
	// guess is worse than taking the pessimistic weight.
	if (!surface || !raw || surface.a < 1 || raw.a < 1) {
		return unmeasured();
	}
	if (contrastRatio(raw, surface) >= minimum) {
		return hue;
	}
	for (
		let weight = 100 - HUE_WEIGHT_STEP;
		weight >= HUE_WEIGHT_STEP;
		weight -= HUE_WEIGHT_STEP
	) {
		const candidate = mixTowards(hue, text, weight);
		const resolved = measure(candidate);
		// The measurer cannot resolve `color-mix`, so every further step is
		// unmeasurable too. Stop rather than walking down to the text colour.
		if (!resolved) {
			return unmeasured();
		}
		if (contrastRatio(resolved, surface) >= minimum) {
			return candidate;
		}
	}
	// Nothing with any hue left in it passes, so fall back to the one colour the
	// theme guarantees against this surface.
	return text;
}
