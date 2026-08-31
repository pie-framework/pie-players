import { expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-line-reader.svelte", import.meta.url),
).text();

test("every position write is clamped to the containing block", () => {
	const writes = source.match(/\bposition = (?!\$state)([^\n]*)/g) ?? [];
	expect(writes.length).toBeGreaterThan(0);
	for (const write of writes) {
		expect(write).toInclude("clampToContainingBlock(");
	}
});

test("containment is derived from the containing block, not the viewport", () => {
	expect(source).toInclude("containerEl.offsetParent");
	// A viewport-derived seed places the panel outside any positioned ancestor;
	// window dimensions are only the initial-containing-block fallback.
	expect(source).not.toInclude("window.innerWidth / 2");
});

test("revealing the panel cannot scroll its pane", () => {
	const focusCalls = source.match(/\.focus\([^)]*\)/g) ?? [];
	expect(focusCalls.length).toBeGreaterThan(0);
	for (const call of focusCalls) {
		expect(call).toInclude("preventScroll");
	}
});
