import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import {
	SSMLExtractor,
	sanitizeSsmlString,
} from "../src/services/SSMLExtractor";

beforeAll(() => {
	if (typeof (globalThis as unknown as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

let extractor: SSMLExtractor;
beforeEach(() => {
	extractor = new SSMLExtractor();
});

function extractSsml(markup: string): string {
	const { catalogs } = extractor.extractFromItemConfig({
		markup,
		elements: {},
		models: [],
	} as unknown as import("@pie-players/pie-players-shared/types").ConfigEntity);
	return catalogs[0]?.cards[0]?.content ?? "";
}

describe("SSMLExtractor sanitization", () => {
	test("strips <script> tags smuggled inside <speak>", () => {
		const markup =
			'<p><speak>Hello <script>alert(1)</script>world</speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml).not.toContain("<script");
		expect(ssml).not.toContain("alert");
		expect(ssml).toContain("Hello");
		expect(ssml).toContain("world");
	});

	test("unwraps disallowed HTML elements while preserving text", () => {
		const markup =
			'<p><speak>Hello <b>bold</b> <img src="x" /></speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml).not.toContain("<b>");
		expect(ssml).not.toContain("<img");
		expect(ssml).toContain("bold");
	});

	test("removes event-handler attributes from SSML elements", () => {
		const markup =
			'<p><speak onclick="evil()"><prosody rate="slow" onload="bad()">hi</prosody></speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml.toLowerCase()).not.toContain("onclick");
		expect(ssml.toLowerCase()).not.toContain("onload");
		expect(ssml).toContain("<prosody");
		expect(ssml).toContain('rate="slow"');
	});

	test("keeps allowed SSML tags and attributes untouched", () => {
		const markup =
			'<p><speak xml:lang="en-US"><break time="500ms"/><say-as interpret-as="characters">NASA</say-as></speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml).toContain('xml:lang="en-US"');
		expect(ssml).toContain("<break");
		expect(ssml).toContain('time="500ms"');
		expect(ssml).toContain("<say-as");
		expect(ssml).toContain('interpret-as="characters"');
		expect(ssml).toContain("NASA");
	});

	test("strips javascript: URLs from audio src", () => {
		const markup =
			'<p><speak><audio src="javascript:alert(1)">fallback</audio></speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml.toLowerCase()).not.toContain("javascript:");
		// Element remains (so the fallback text still renders via the
		// TTS provider) but the unsafe src is dropped.
		expect(ssml).toContain("<audio");
		expect(ssml).not.toMatch(/src=/i);
	});

	test("strips data: URLs from audio src", () => {
		const markup =
			'<p><speak><audio src="data:text/html,x">fallback</audio></speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml.toLowerCase()).not.toContain("data:");
		expect(ssml).not.toMatch(/src=/i);
	});

	test("strips private / metadata hosts from audio src", () => {
		const markup =
			'<p><speak><audio src="http://169.254.169.254/latest/meta-data/">fallback</audio></speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml).not.toContain("169.254.169.254");
		expect(ssml).not.toMatch(/src=/i);
	});

	test("keeps legitimate https audio src", () => {
		const markup =
			'<p><speak><audio src="https://cdn.example.com/bell.mp3">bell</audio></speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml).toContain('src="https://cdn.example.com/bell.mp3"');
	});

	test("preserves self-closing <break/> across HTML parse round-trip", () => {
		// Regression: HTML5's parser does not treat <break> as void and
		// silently drops the `/`, then nests every following sibling as
		// its child. Round-trip used to emit `<break>…rest…</break>`,
		// which AWS Polly rejects as InvalidSsmlException. Verify the
		// serializer keeps the empty-element shape and does NOT swallow
		// the trailing prose into the break.
		const markup =
			'<p><speak xml:lang="en-US">Before pause <break time="400ms"/> after pause</speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml).toContain('<break time="400ms"/>');
		expect(ssml).not.toContain("</break>");
		expect(ssml).not.toMatch(/<break[^/]*>[^<]+after pause/);
		expect(ssml).toContain("after pause");
	});

	test("preserves multiple self-closing <break/> elements", () => {
		const markup =
			'<p><speak>One <break time="200ms"/> two <break time="300ms"/> three</speak></p>';
		const ssml = extractSsml(markup);
		expect(ssml.match(/<break /g)?.length ?? 0).toBe(2);
		expect(ssml).not.toContain("</break>");
		expect(ssml).toContain("One");
		expect(ssml).toContain("two");
		expect(ssml).toContain("three");
	});

	test("sanitizeSsmlString fragment input preserves self-closing void tags", () => {
		const fragment =
			'Intro <prosody rate="slow">word</prosody> <break time="100ms"/> outro';
		const sanitized = sanitizeSsmlString(fragment);
		expect(sanitized).toContain('<break time="100ms"/>');
		expect(sanitized).not.toContain("</break>");
		expect(sanitized).toContain("outro");
	});
});
