import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-tts-inline.svelte", import.meta.url),
).text();

describe("tool-tts-inline runtime dependency contract", () => {
	test("does not import Svelte runtime APIs from source", () => {
		expect(source).not.toMatch(
			/^\s*import\s+(?!type\b).*from\s+['"]svelte['"];?\s*$/m,
		);
	});

	test("announces reading as started only after playback enters playing state", () => {
		expect(source).toContain("statusMessage = 'Starting reading';");
		expect(source).toContain(
			"playbackState === 'playing' && statusMessage === 'Starting reading'",
		);
		expect(source).toContain("statusMessage = 'Reading started';");
		expect(source).toContain("let playbackStartInFlight = $state(false);");
		expect(source).toContain(
			"const startupInFlight = $derived(playActionInFlight || playbackStartInFlight);",
		);
		expect(source).toContain("playbackStartInFlight = true;");
		expect(source).toContain("playbackStartInFlight = false;");
		expect(source).toContain("startupInFlight ||");
		expect(source).toContain("'aria-busy': startupInFlight ? 'true' : null");
		expect(source).toContain(
			"aria-busy={startupInFlight ? 'true' : undefined}",
		);
	});

	test("failed playback start releases ownership and restores toolbar focus", () => {
		expect(source).toContain(
			"resetLocalPlaybackUi('Unable to start reading');",
		);
		expect(source).toContain("const hadPanelFocus = panelHasFocus();");
		expect(source).toContain("releaseActiveOwner();");
		expect(source).toContain("focusTriggerIfPanelHadFocus(true);");
		expect(source).toContain("handlePlaybackStartFailure(resolverDisposer);");
	});
});
