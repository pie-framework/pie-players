import { describe, expect, test } from "bun:test";

/**
 * The debug and inspection panels are developer and QA surfaces, so they carry no
 * WCAG obligation toward a test taker. They do have to be readable by the person
 * inspecting a section, and they were not: each one read DaisyUI's own `--color-*`
 * slots, which follow the host's DaisyUI palette, or a light literal where the host
 * has none, but never the PIE colour scheme. Under White on Black that left a light
 * panel over a dark page.
 *
 * The supported direction is DaisyUI feeding `--pie-*` through pie-theme's provider.
 * A panel reading the slots directly bypasses the contract, so this guards the
 * boundary rather than the individual colours.
 */
const PANELS = [
	"../DebugPanelToggles.svelte",
	"../SharedFloatingPanel.svelte",
	"../PanelWindowControls.svelte",
	"../PanelResizeHandle.svelte",
	"../SessionDbPanel.svelte",
	"../../section-player-tools-pnp-debugger/PnpPanel.svelte",
	"../../section-player-tools-event-debugger/EventPanel.svelte",
	"../../section-player-tools-instrumentation-debugger/InstrumentationPanel.svelte",
	"../../section-player-tools-session-debugger/SectionSessionPanel.svelte",
	"../../section-player-tools-tts-settings/TtsSettingsPanel.svelte",
	"../../item-player/src/ItemSessionDebugger.svelte",
];

const sources = new Map<string, string>();
for (const relative of PANELS) {
	sources.set(
		relative.replace(/^(\.\.\/)+/, ""),
		await Bun.file(new URL(relative, import.meta.url)).text(),
	);
}

/** Declarations only; a `--color-*` a panel *sets* for a third party is fine. */
const readsDaisySlot = /var\(\s*--color-[a-z0-9-]+/g;

const COLOUR_PROPERTY =
	/^\s*(color|background|background-color|border|border-color|border-top|border-right|border-bottom|border-left|border-top-color|border-right-color|border-bottom-color|border-left-color|outline|outline-color|fill|stroke|caret-color|text-decoration-color|accent-color|scrollbar-color|-webkit-text-fill-color)\s*:\s*(.+?);?\s*$/;
const COLOUR_LITERAL =
	/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)|\b(?:white|black|red|blue|green|yellow|orange|purple|gray|grey|silver|navy|teal|maroon|olive)\b/;

describe("debug panel theming", () => {
	for (const [name, source] of sources) {
		test(`${name} reads no DaisyUI slot`, () => {
			const offenders = [...source.matchAll(readsDaisySlot)]
				.map((match) => match[0])
				// A slot named inside a comment is documentation, not a read.
				.filter((slot) => !source.includes(`\`${slot}`));
			expect(offenders, "DaisyUI slots read directly").toEqual([]);
		});

		test(`${name} paints no colour outside the token contract`, () => {
			const offenders: string[] = [];
			source.split("\n").forEach((line, index) => {
				const trimmed = line.trim();
				if (trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
				const match = COLOUR_PROPERTY.exec(line);
				if (!match) return;
				const value = match[2];
				if (value.includes("var(--pie-")) return;
				if (!COLOUR_LITERAL.test(value)) return;
				// Drop shadows are not surfaces, inks or boundaries: they darken
				// whatever is behind them and read the same on any palette.
				if (/^(box-shadow|filter)/.test(match[1])) return;
				offenders.push(`${index + 1}: ${trimmed}`);
			});
			expect(offenders, "colour declarations with no --pie-* token").toEqual(
				[],
			);
		});
	}

	test("the debug toggles carry no DaisyUI button class", () => {
		const source = sources.get("DebugPanelToggles.svelte") ?? "";
		expect(source).not.toMatch(/class(?::|="[^"]*\b)btn\b/);
		expect(source).toInclude(
			'.pie-debug-panel-toggles__button[aria-pressed="true"]',
		);
	});

	test("the TTS settings backdrop takes the theme's scrim", () => {
		const source = sources.get(
			"section-player-tools-tts-settings/TtsSettingsPanel.svelte",
		);
		const backdrop =
			source?.match(/\.pie-tts-dialog-backdrop \{[^}]*\}/)?.[0] ?? "";
		expect(backdrop).toInclude("background: var(--pie-scrim,");
	});
});
