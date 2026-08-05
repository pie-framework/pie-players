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

	test("trigger uses the NDS tertiary variant", () => {
		expect(triggerSnippet).toContain('variant="tertiary"');
	});

	test("trigger glyph colour is the settable --pie-tts-button-color", () => {
		const body = cssRuleBody(".pie-tool-tts-inline__trigger").replace(
			/\s+/g,
			"",
		);
		expect(body).toContain(
			"--color-interactive-blue:var(--pie-tts-button-color,#146eb3)",
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

	test("tertiary trigger glyph meets WCAG AA contrast (interactive blue on NDS new-gray)", () => {
		// NDS `variant="tertiary"`: --color-interactive-blue (#146eb3) glyph on
		// --color-new-gray (#f3f5f7). Guard that pairing stays AA.
		expect(contrastRatio("#146eb3", "#f3f5f7")).toBeGreaterThanOrEqual(4.5);
	});
});

describe("tool-tts-inline overlay redesign contract", () => {
	const stripped = styleSource.replace(/\s+/g, "");

	test("overlay panels render as a white card with the Figma dropdown shadow", () => {
		// Grouped rule for floating-overlay + left-aligned panels.
		expect(stripped).toContain(
			".pie-tool-tts-inline__panel--floating,.pie-tool-tts-inline__panel--left-aligned-inline{",
		);
		expect(stripped).toContain("background:var(--pie-tts-selected-bg,#fff)");
		expect(stripped).toContain(
			"box-shadow:var(--pie-tts-menu-shadow,01px5px0rgba(0,0,0,0.3))",
		);
	});

	test("media + selected-speed accent flows through the settable --pie-tts-button-color", () => {
		expect(stripped).toContain("color:var(--pie-tts-button-color,#146eb3)");
	});

	test("selected speed uses a white chip; muted text otherwise (roomy)", () => {
		expect(stripped).toContain("background:var(--pie-tts-selected-bg,#fff)");
		expect(stripped).toContain(
			"color:var(--pie-tts-inline-muted-color,#5b6b73)",
		);
	});

	test("compact stacked card carries the Figma elevation shadow", () => {
		expect(stripped).toContain(
			"box-shadow:var(--pie-tts-menu-shadow,01px5px0rgba(0,0,0,0.3))",
		);
	});
});

describe("tool-tts-inline compact stacked speed contract", () => {
	const stripped = styleSource.replace(/\s+/g, "");

	test("compact keeps a single always-visible speed radiogroup (no toggle/menu)", () => {
		// Same radiogroup in both layouts; only a modifier class switches it to the
		// stacked card. There is no current-speed toggle button or popover menu.
		expect(source).toContain('role="radiogroup"');
		expect(source).toContain(
			"class:pie-tool-tts-inline__speed-group--stacked={leftAlignedCompact}",
		);
		expect(source).not.toContain('aria-haspopup="menu"');
		expect(source).not.toContain('role="menuitemradio"');
		expect(source).not.toContain("toggleMoreMenu");
	});

	test("compact stacks speeds vertically below the media row", () => {
		// order + full-width basis drop the card onto its own line under the media
		// controls, which stay inline (no --compact display:none for --secondary).
		expect(stripped).toContain("__speed-group--stacked{");
		expect(stripped).toContain("flex-basis:100%;flex-direction:column");
		expect(styleSource).not.toContain(
			"__panel--compact .pie-tool-tts-inline__control--secondary",
		);
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

	test("honours the documented active/open trigger hooks (PIE-727)", () => {
		// The README documents these three as the supported way to style the
		// trigger while its panel is open. The component had stopped referencing
		// any of them, so a host following the docs got no effect. These
		// assertions are the regression guard.
		const body = cssRuleBody(
			'.pie-tool-tts-inline__trigger--plain[aria-expanded="true"]',
		).replace(/\s+/g, "");

		expect(body).toContain("var(--pie-tool-trigger-active-background,");
		expect(body).toContain("var(--pie-tool-trigger-active-color,");
		expect(body).toContain("var(--pie-tool-trigger-active-border-color,");
	});

	test("leaves the trigger visually unchanged when the hooks are unset", () => {
		// Each hook falls back to the value the element already resolves to, so
		// adding the rule cannot restyle the control for hosts that set nothing.
		// Unlike the calculator, this trigger has never had a filled active look.
		const active = cssRuleBody(
			'.pie-tool-tts-inline__trigger--plain[aria-expanded="true"]',
		).replace(/\s+/g, "");
		const control = cssRuleBody(".pie-tool-tts-inline__control").replace(
			/\s+/g,
			"",
		);
		const plain = cssRuleBody(".pie-tool-tts-inline__trigger--plain").replace(
			/\s+/g,
			"",
		);

		// Background and border fallbacks match the __control box exactly.
		expect(control).toContain(
			"background:var(--pie-button-background-color,var(--pie-button-bg,var(--pie-background,#fff)))",
		);
		expect(active).toContain(
			"var(--pie-button-background-color,var(--pie-button-bg,var(--pie-background,#fff)))",
		);
		expect(control).toContain(
			"var(--pie-button-border-color,var(--pie-button-border,var(--pie-border,#c6c6c6)))",
		);
		expect(active).toContain(
			"var(--pie-button-border-color,var(--pie-button-border,var(--pie-border,#c6c6c6)))",
		);

		// Foreground fallback matches __control, NOT --plain. Both declare `color`
		// at equal specificity and __control comes later in the sheet, so it wins
		// and --plain's accent colour is dead. Falling back to the accent would
		// turn the glyph blue on open. Verified in Chromium: the plain trigger
		// computes the dark --pie-button-color, not #146eb3.
		expect(control).toContain("color:var(--pie-button-color,var(--pie-text,#222))");
		expect(active).toContain("var(--pie-button-color,var(--pie-text,#222))");
		// Guard the trap directly: the accent must not be the active fallback.
		expect(active).not.toContain("var(--pie-tts-button-color,#146eb3)");
		expect(plain).toContain("color:var(--pie-tts-button-color,#146eb3)");
	});

	test("remaps the NDS trigger accent rather than painting a box it lacks", () => {
		// The NDS button owns its own surface; setting background/border on the
		// host element would paint a box the tertiary button does not have. Only
		// the foreground hook applies, via the same --color-interactive-blue
		// remap the base rule uses.
		const body = cssRuleBody(
			'.pie-tool-tts-inline__trigger:not(.pie-tool-tts-inline__trigger--plain)[aria-expanded="true"]',
		).replace(/\s+/g, "");

		expect(body).toContain("--color-interactive-blue:var(--pie-tool-trigger-active-color,");
		expect(body).not.toContain("background:");
		expect(body).not.toContain("border-color:");
	});
});

describe("tool-tts-inline keyboard order contract", () => {
	test("overlay layouts render the controls panel before the trigger", () => {
		// The overlay panels (floating-overlay + left-aligned, the default) open to
		// the LEFT of the play/pause trigger, so they must precede it in the DOM:
		// Shift+Tab then moves backwards from Play/Pause into the additional
		// controls, matching visual order.
		expect(source).toContain(
			"const isPanelBeforeTrigger = $derived(isFloatingLayout || isLeftAlignedFloatingLayout)",
		);
		const overlayBranch = source.slice(
			source.indexOf("{#if isPanelBeforeTrigger}"),
			source.indexOf("{:else}", source.indexOf("{#if isPanelBeforeTrigger}")),
		);
		expect(overlayBranch.indexOf("{@render controlsPanel()}")).toBeGreaterThan(
			-1,
		);
		expect(overlayBranch.indexOf("{@render controlsPanel()}")).toBeLessThan(
			overlayBranch.indexOf("{@render triggerButton()}"),
		);
	});

	test("the trigger never disables itself while the play action is in flight", () => {
		// A disabled element cannot hold focus, so disabling the trigger mid-action
		// blurs it and a keyboard user loses their place on every Play press.
		// Re-entrancy is guarded in handlePlayPause; the pending state is aria-busy.
		expect(source).not.toContain(
			"disabled={!ttsService || playActionInFlight}",
		);
		expect(source).toContain("'aria-busy': playActionInFlight ? 'true' : null");
		expect(source).toContain(
			"aria-busy={playActionInFlight ? 'true' : undefined}",
		);
		expect(source).toContain("if (playActionInFlight) return;");
	});

	test("the trigger stays visibly focused after a pointer activation", () => {
		// Focus deliberately stays on the trigger while the panel opens beside it,
		// so it must paint a ring even when the browser suppresses :focus-visible.
		// Scoped to :focus:not(:focus-visible) so keyboard focus keeps the shared
		// __control / NDS ring exactly as-is.
		const stripped = styleSource.replace(/\s+/g, "");
		expect(stripped).toContain(
			".pie-tool-tts-inline__trigger:focus:not(:focus-visible),",
		);
		// The NDS variant holds focus on a Lit-created inner <button>, which has no
		// Svelte scoping class and so must be reached with :global().
		expect(stripped).toContain(
			".pie-tool-tts-inline__trigger:global(button:focus:not(:focus-visible)){",
		);
	});

	test("stopping hands focus back to the trigger it unmounts the panel with", () => {
		const stopFn = source.slice(
			source.indexOf("function handleStop()"),
			source.indexOf("async function handleSeekForward"),
		);
		// Captured BEFORE resetLocalPlaybackUi tears the panel down.
		expect(stopFn.indexOf("panelHasFocus()")).toBeLessThan(
			stopFn.indexOf("resetLocalPlaybackUi"),
		);
		expect(stopFn).toContain("focusTriggerIfPanelHadFocus(true)");
	});

	test("stop stays active after reading finishes; seek controls do not", () => {
		// Reading finishing on its own clears `speaking`, which must NOT take Stop
		// with it — Stop can still halt playback / dismiss the panel, and staying
		// enabled is what lets it keep focus it already had.
		expect(source).toContain(
			'aria-label="Stop reading"\n\t\t\t\t\t\tdisabled={!ttsService}',
		);
		// Rewind / fast-forward correctly go inactive with `speaking`.
		expect(source).toContain("disabled={!ttsService || !speaking}");
		expect(source).not.toContain(
			"disabled={!ttsService || (!speaking && !paused)}",
		);
	});

	test("focus is moved off a seek control that reading-end disables", () => {
		// The focused element has to be read BEFORE the state flags flip: once
		// `speaking` is false, Svelte disables the seek buttons and the browser
		// blurs whichever held focus, losing the only evidence of which it was.
		const listener = source.slice(
			source.indexOf("const stateListener = (state: unknown)"),
			source.indexOf("ttsService.onStateChange"),
		);
		expect(listener.indexOf("isSeekControlFocused()")).toBeLessThan(
			listener.indexOf("syncFromState(state as string)"),
		);
		expect(listener).toContain("moveFocusOffDisabledSeekControl");
		// Focus lands on Stop, falling back to the trigger if the panel has closed.
		const repair = source.slice(
			source.indexOf("function moveFocusOffDisabledSeekControl"),
			source.indexOf("function focusTriggerIfPanelHadFocus"),
		);
		expect(repair).toContain("STOP_BUTTON_SELECTOR");
		expect(repair).toContain("stop.focus()");
		expect(repair).toContain("focusTriggerIfPanelHadFocus(true)");
	});

	test("media buttons are real Tab stops, not a roving toolbar", () => {
		// rewind / fast-forward / stop must carry NO tabindex override, so each is
		// its own Tab stop and Shift+Tab off the trigger walks stop → fast-forward
		// → rewind before reaching the speeds.
		// Template only — the script also mentions the attribute as a selector.
		const mediaButtons = source
			.slice(source.indexOf("</script>"))
			.split("data-pie-tts-media")
			.slice(1)
			.map((chunk) => chunk.slice(0, chunk.indexOf("</button>")));
		expect(mediaButtons).toHaveLength(3);
		for (const button of mediaButtons) {
			expect(button).not.toContain("tabindex");
		}
	});

	test("the speed radiogroup's single Tab stop is the checked option", () => {
		// ARIA radiogroup pattern: the checked radio is the one in the Tab sequence.
		expect(source).toContain(
			"tabindex={playbackRate === option.rate ? 0 : -1}",
		);
	});

	test("arrowing onto a speed option selects it without Spacebar/Enter", () => {
		const selectFn = source.slice(
			source.indexOf("function focusClusterControlAt"),
			source.indexOf("function moveClusterFocus"),
		);
		// Focus moves, then the option is applied — the answer-choice behaviour.
		expect(selectFn).toContain("target.focus()");
		expect(selectFn).toContain("handlePlaybackRate(option)");
		// Selection is scoped to the radiogroup; media buttons must not self-activate.
		expect(selectFn).toContain(
			"if (selector !== SPEED_RADIO_SELECTOR) return;",
		);
	});

	test("arrow keys never cross the radiogroup boundary", () => {
		// Each cluster navigates within itself, so an arrow key cannot leave the
		// speed radios for the media buttons (Tab is what crosses clusters).
		expect(source).toContain(
			"handleClusterKeydown(SPEED_RADIO_SELECTOR, event)",
		);
		expect(source).toContain(
			"handleClusterKeydown(MEDIA_BUTTON_SELECTOR, event)",
		);
	});

	test("arrow navigation skips disabled controls", () => {
		// `.focus()` is a no-op on a disabled button, so including one would strand
		// focus on the current control.
		const clusterFn = source.slice(
			source.indexOf("function getClusterControls"),
			source.indexOf("function focusClusterControlAt"),
		);
		expect(clusterFn).toContain("!control.disabled");
	});

	test("row layouts keep the trigger before the panel it drops below", () => {
		const rowBranch = source.slice(
			source.indexOf("{:else}", source.indexOf("{#if isPanelBeforeTrigger}")),
			source.indexOf("{/if}", source.indexOf("{#if isPanelBeforeTrigger}")),
		);
		expect(rowBranch.indexOf("{@render triggerButton()}")).toBeGreaterThan(-1);
		expect(rowBranch.indexOf("{@render triggerButton()}")).toBeLessThan(
			rowBranch.indexOf("{@render controlsPanel()}"),
		);
	});
});
