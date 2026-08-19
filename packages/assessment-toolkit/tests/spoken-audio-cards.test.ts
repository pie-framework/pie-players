import { describe, expect, test } from "bun:test";
import type { CatalogCardPayload } from "@pie-players/pie-players-shared";
import { resolveSpokenAudioMedia } from "../src/services/spoken-audio-cards";

const payload = (overrides: Record<string, unknown> = {}): CatalogCardPayload =>
	({
		media: {
			version: 1,
			id: "prompt-audio",
			kind: "audio",
			sources: [{ src: "/audio/prompt.mp3", type: "audio/mpeg" }],
		},
		...overrides,
	}) as CatalogCardPayload;

const silently = <T>(run: () => T): { value: T; warnings: string[] } => {
	const warnings: string[] = [];
	const original = console.warn;
	console.warn = (...args: unknown[]) => {
		warnings.push(args.map(String).join(" "));
	};
	try {
		return { value: run(), warnings };
	} finally {
		console.warn = original;
	}
};

describe("resolveSpokenAudioMedia", () => {
	test("resolves a well-formed recording", () => {
		const media = resolveSpokenAudioMedia({ payload: payload() });
		expect(media?.sources).toEqual([
			{ src: "/audio/prompt.mp3", type: "audio/mpeg" },
		]);
	});

	test("is silent for a script card, which is not a fault", () => {
		// Resolution asks for the payload form as a *preference*, so a `content`
		// card legitimately arrives here. Warning on it would fire for every
		// ordinary SSML node in the item.
		const { value, warnings } = silently(() =>
			resolveSpokenAudioMedia({ content: "<speak>hello</speak>" }),
		);
		expect(value).toBeNull();
		expect(warnings).toEqual([]);
	});

	test("reports a payload with no media", () => {
		const { value, warnings } = silently(() =>
			resolveSpokenAudioMedia({ payload: {} as CatalogCardPayload }),
		);
		expect(value).toBeNull();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("no `media`");
	});

	test("refuses media that is not audio", () => {
		// A signing video filed under `spoken` is a mis-authored card, not an audio
		// track to guess at.
		const { value, warnings } = silently(() =>
			resolveSpokenAudioMedia({
				payload: payload({
					media: {
						version: 1,
						id: "v",
						kind: "video",
						sources: [{ src: "/video/signing.webm" }],
					},
				}),
			}),
		);
		expect(value).toBeNull();
		expect(warnings[0]).toContain('kind "video"');
	});

	test("refuses a media version this build does not render", () => {
		// The contract requires unknown-version rejection rather than rendering on a
		// guess at which fields still mean what they did.
		const { value, warnings } = silently(() =>
			resolveSpokenAudioMedia({
				payload: payload({
					media: {
						version: 2,
						id: "prompt-audio",
						kind: "audio",
						sources: [{ src: "/audio/prompt.mp3" }],
					},
				}),
			}),
		);
		expect(value).toBeNull();
		expect(warnings[0]).toContain("version 2");
	});

	test("accepts a recording that omits the version", () => {
		// Producers predate the field; absence is not a positive claim of another
		// version, so it resolves rather than being dropped.
		const { value, warnings } = silently(() =>
			resolveSpokenAudioMedia({
				payload: payload({
					media: {
						id: "prompt-audio",
						kind: "audio",
						sources: [{ src: "/audio/prompt.mp3" }],
					},
				}),
			}),
		);
		expect(value?.sources).toEqual([{ src: "/audio/prompt.mp3" }]);
		expect(warnings).toEqual([]);
	});

	test("reports a payload whose sources yield no usable URL", () => {
		const { value, warnings } = silently(() =>
			resolveSpokenAudioMedia({
				payload: payload({
					media: {
						version: 1,
						id: "a",
						kind: "audio",
						sources: [{ src: "javascript:alert(1)" }],
					},
				}),
			}),
		);
		expect(value).toBeNull();
		expect(warnings[0]).toContain("no usable URL");
	});

	test("keeps a usable time range and drops an impossible one", () => {
		expect(
			resolveSpokenAudioMedia({
				payload: payload({ fragment: { startSeconds: 4, endSeconds: 9 } }),
			})?.fragment,
		).toEqual({ startSeconds: 4, endSeconds: 9 });
		expect(
			resolveSpokenAudioMedia({
				payload: payload({ fragment: { startSeconds: 9, endSeconds: 4 } }),
			})?.fragment,
		).toEqual({ startSeconds: 9 });
	});
});
