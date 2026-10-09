import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-annotation-toolbar.svelte", import.meta.url),
).text();

describe("tool-annotation-toolbar failure reporting", () => {
	test("reports losing or failing to restore highlights to the toolkit", () => {
		expect(source).toContain(
			"reportToolFailure(runtimeContext?.toolkitCoordinator, 'annotationToolbar', 'tool-state-save', error);",
		);
		expect(source).toContain(
			"reportToolFailure(runtimeContext?.toolkitCoordinator, 'annotationToolbar', 'tool-state-load', error);",
		);
	});

	test("reports a read-aloud playback failure as the speech tool's", () => {
		expect(source).toContain(
			"reportToolFailure(runtimeContext?.toolkitCoordinator, 'textToSpeech', 'tool-playback', error);",
		);
	});
});
