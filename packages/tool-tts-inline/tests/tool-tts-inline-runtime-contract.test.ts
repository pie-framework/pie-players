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
		// Announcements go through the interface-locale catalog, so these assert the
		// key rather than the English. The English value itself is asserted by the
		// catalog and by `check:i18n-coverage`.
		expect(source).toContain(
			"statusMessage = interfaceI18n.t('tools.textToSpeech.inline.starting');",
		);
		expect(source).toContain("tools.textToSpeech.inline.started");
		// The upgrade is gated on the in-flight flag, never on comparing
		// `statusMessage` against the rendered "starting" text: that comparison
		// drops the announcement whenever the locale changes between the two reads.
		expect(source).toContain("if (playbackStartInFlight && ownsRun()) {");
		expect(source).not.toMatch(/statusMessage\s*===/);
		expect(source).toContain("let playbackStartInFlight = $state(false);");
		expect(source).toContain("playbackStartInFlight = true;");
		expect(source).toContain("playbackStartInFlight = false;");
		expect(source).toContain("'aria-busy': playbackStartInFlight ? 'true' : null");
		expect(source).toContain(
			"aria-busy={playbackStartInFlight ? 'true' : undefined}",
		);
	});

	test("failed playback start restores toolbar focus", () => {
		expect(source).toContain("'tools.textToSpeech.inline.startFailed'");
		expect(source).toContain("const hadPanelFocus = panelHasFocus();");
		expect(source).toContain("focusTriggerIfPanelHadFocus(true);");
		expect(source).toContain("handlePlaybackStartFailure(error, resolverDisposer);");
	});

});
