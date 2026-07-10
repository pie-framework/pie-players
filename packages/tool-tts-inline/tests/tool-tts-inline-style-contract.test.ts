import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-tts-inline.svelte", import.meta.url),
).text();
const styleSource = source.slice(source.indexOf("<style>"));

const cssRuleBody = (selector: string): string => {
	const selectorIndex = styleSource.indexOf(`${selector} {`);
	if (selectorIndex === -1) {
		throw new Error(`Could not find CSS rule for ${selector}`);
	}
	const openBrace = styleSource.indexOf("{", selectorIndex);
	const closeBrace = styleSource.indexOf("\n\t}", openBrace);
	if (openBrace === -1 || closeBrace === -1) {
		throw new Error(`Could not parse CSS rule for ${selector}`);
	}
	return styleSource.slice(openBrace + 1, closeBrace);
};

const hexToRgb = (hex: string): [number, number, number] => {
	const normalized = hex.replace("#", "");
	return [0, 2, 4].map((index) =>
		Number.parseInt(normalized.slice(index, index + 2), 16),
	) as [number, number, number];
};

const relativeLuminance = ([red, green, blue]: [number, number, number]) => {
	const toLinear = (channel: number) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return (
		0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
	);
};

const contrastRatio = (foreground: string, background: string): number => {
	const fg = relativeLuminance(hexToRgb(foreground));
	const bg = relativeLuminance(hexToRgb(background));
	const lighter = Math.max(fg, bg);
	const darker = Math.min(fg, bg);
	return (lighter + 0.05) / (darker + 0.05);
};

const triggerSnippet = source.slice(
	source.indexOf("{#snippet triggerButton()}"),
	source.indexOf("{/snippet}", source.indexOf("{#snippet triggerButton()}")),
);

describe("tool-tts-inline trigger styling contract", () => {
	test("play/pause trigger renders as a circular NDS icon button", () => {
		expect(triggerSnippet).toContain("<nds-icon-button");
		expect(triggerSnippet).toContain('type="circle"');
		expect(triggerSnippet).toContain(
			"icon-name={speaking && !paused ? 'pause' : 'play'}",
		);
	});

	test("open trigger uses the filled primary NDS variant, resting uses ghost", () => {
		expect(triggerSnippet).toContain(
			"variant={controlsVisible ? 'primary' : 'ghost'}",
		);
	});

	test("trigger reflects disclosure + toggle semantics onto its inner button", () => {
		expect(triggerSnippet).toContain("use:reflectAria");
		expect(triggerSnippet).toContain("'aria-expanded'");
		expect(triggerSnippet).toContain("'aria-controls'");
		expect(triggerSnippet).toContain("'aria-pressed'");
	});

	test("trigger glyphs are forced to the Solid FA weight (not thin outline)", () => {
		// NDS hardcodes `fa-light`; the mount action swaps it to `fa-solid` so
		// play/pause render as filled media-control icons and work under FA Free.
		expect(source).toContain("icon.classList.remove('fa-light')");
		expect(source).toContain("icon.classList.add('fa-solid')");
	});

	test("trigger fill colour is a host-settable variable", () => {
		const body = cssRuleBody(".pie-tool-tts-inline__trigger").replace(
			/\s+/g,
			"",
		);
		expect(body).toContain(
			"--color-interactive-blue:var(--pie-tts-button-color,",
		);
	});

	test("trigger size variants set the NDS outer button size", () => {
		const md = cssRuleBody(".pie-tool-tts-inline__trigger--md").replace(
			/\s+/g,
			"",
		);
		expect(md).toContain("--height-32:2rem");
	});

	test("trigger keeps the NDS-native glyph size (no icon-size override)", () => {
		// The glyph must not be enlarged past the NDS icon-button spec, so the
		// component must not set --nds-icon-small anywhere.
		expect(styleSource).not.toContain("--nds-icon-small");
	});

	test("panel controls keep the canonical button token fallbacks", () => {
		const controlBody = cssRuleBody(".pie-tool-tts-inline__control").replace(
			/\s+/g,
			"",
		);
		const hoverBody = cssRuleBody(
			".pie-tool-tts-inline__control:hover:not(:disabled)",
		).replace(/\s+/g, "");

		expect(controlBody).toContain(
			"--pie-button-border-color,var(--pie-button-border,",
		);
		expect(controlBody).toContain(
			"--pie-button-background-color,var(--pie-button-bg,",
		);
		expect(hoverBody).toContain(
			"--pie-button-hover-background-color,var(--pie-button-hover-bg,",
		);
	});

	test("icon-only secondary controls are circular", () => {
		expect(styleSource.replace(/\s+/g, "")).toContain(
			".pie-tool-tts-inline__control--secondary{border-radius:50%;}",
		);
	});

	test("filled active trigger meets WCAG AA contrast (white on NDS interactive blue)", () => {
		// The open trigger uses NDS `variant="primary"`: white glyph on
		// --color-interactive-blue (#146eb3). Guard that pairing stays AA.
		expect(contrastRatio("#ffffff", "#146eb3")).toBeGreaterThanOrEqual(4.5);
	});
});

describe("tool-tts-inline overlay redesign contract", () => {
	const stripped = styleSource.replace(/\s+/g, "");

	test("overlay panels render transparent (controls sit on the external header)", () => {
		// Grouped rule for floating-overlay + left-aligned panels.
		expect(stripped).toContain(
			".pie-tool-tts-inline__panel--floating,.pie-tool-tts-inline__panel--left-aligned-inline{",
		);
		expect(stripped).toContain("background:transparent;border:0;");
	});

	test("media + selected-speed accent flows through the settable --pie-tts-button-color", () => {
		expect(stripped).toContain(
			"color:var(--pie-tts-button-color,var(--pie-primary,#146eb3))",
		);
	});

	test("selected speed uses a white chip; muted text otherwise", () => {
		expect(stripped).toContain("background:var(--pie-tts-selected-bg,#fff)");
		expect(stripped).toContain(
			"color:var(--pie-tts-inline-muted-color,#5b6b73)",
		);
		// The compact current-speed button shares the chip class.
		expect(source).toContain("pie-tool-tts-inline__control--speed-current");
	});

	test("speed dropdown card carries the Figma elevation shadow", () => {
		expect(stripped).toContain(
			"box-shadow:var(--pie-tts-menu-shadow,01px5px0rgba(0,0,0,0.3))",
		);
	});

	test("overlay trigger is elevated with a themeable shadow", () => {
		expect(stripped).toContain("box-shadow:var(--pie-tts-trigger-shadow,");
	});
});

describe("tool-tts-inline compact speed dropdown contract", () => {
	test("compact collapses speed into a current-speed button that opens a menu", () => {
		// Opener button (labelled with the current speed) toggles the dropdown.
		expect(source).toContain('aria-haspopup="menu"');
		expect(source).toContain("Playback speed: ${currentSpeedOption?.label");
		expect(source).toContain("onclick={toggleMoreMenu}");
		// Dropdown items are radio menu items, reusing the shared menu plumbing.
		expect(source).toContain('role="menuitemradio"');
		expect(source).toContain("data-pie-tts-more-control");
	});

	test("media controls are no longer hidden when the overlay is compact", () => {
		// The old design hid --secondary in compact and moved media into the menu.
		expect(styleSource).not.toContain(
			"__panel--compact .pie-tool-tts-inline__control--secondary",
		);
		// The removed ellipsis 'More reading controls' menu should be gone.
		expect(source).not.toContain('button-aria-label="More reading controls"');
	});
});

describe("tool-tts-inline speed control accessibility contract", () => {
	test("renders playback speed as a named radio group", () => {
		expect(source).toContain('role="radiogroup"');
		expect(source).toContain('aria-label="Playback speed"');
		expect(source).toContain('role="radio"');
		expect(source).toContain("aria-checked={playbackRate === option.rate}");
	});

	test("does not keep the old built-in speed toggle contract", () => {
		expect(source).not.toContain("Playback speed reset to 1x");
		expect(source).not.toContain("aria-pressed={playbackRate === option.rate}");
		expect(source).not.toContain(
			"playbackRate === option.rate ? 1 : option.rate",
		);
	});

	test("hides one-option speed groups unless the host opts in", () => {
		expect(source).toContain("showSingleSpeedOption");
		expect(source).toContain(
			"speedChoices.length > 1 || showSingleSpeedOption",
		);
	});

	test("lets omitted speedOptions use semantic Slow Normal Fast defaults", () => {
		expect(source).not.toContain(
			"speedOptions = [...DEFAULT_TTS_SPEED_OPTIONS] as TTSSpeedOption[]",
		);
		expect(source).toContain("speedOptions = undefined");
	});

	test("keeps radio behavior semantic instead of rendering visual radio inputs", () => {
		expect(source).not.toContain("pie-tool-tts-inline__control--speed-active");
		expect(source).not.toContain("pie-tool-tts-inline__speed-radio");
		expect(source).toContain(
			".pie-tool-tts-inline__control--speed[aria-checked='true']",
		);
	});

	test("renders speed labels lowercase without touching the accessible name", () => {
		// Visible label text is lowercased via CSS so hosts can pass canonical
		// casing (Slow/Normal/Fast) while the control shows slow/normal/fast.
		const body = cssRuleBody(".pie-tool-tts-inline__speed-label").replace(
			/\s+/g,
			"",
		);
		expect(body).toContain("text-transform:lowercase");
		// The accessible name comes from aria-label, not the visible span, so the
		// lowercasing must not reach it.
		expect(source).toContain("aria-label={option.ariaLabel}");
	});

	test("keeps speed radio buttons the same height as other toolbar controls", () => {
		const body = cssRuleBody(".pie-tool-tts-inline__control--speed");

		expect(body).toContain("height: 2rem");
		expect(body).not.toContain("min-height: 2.75rem");
	});
});
