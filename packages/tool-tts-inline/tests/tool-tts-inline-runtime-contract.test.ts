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
});
