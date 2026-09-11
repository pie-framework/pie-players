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

test("containment is derived from the containing block", () => {
	// Either route to the containing block satisfies this: reading `offsetParent`
	// here, or delegating to players-shared. What fails it is deriving containment
	// from the viewport, which places the panel outside any positioned ancestor --
	// window dimensions are only the initial-containing-block fallback.
	const readsContainingBlock =
		source.includes("containerEl.offsetParent") ||
		source.includes("resolveContainingBlockRect(");
	expect(readsContainingBlock).toBe(true);
	expect(source).not.toInclude("window.innerWidth / 2");
});

test("revealing the panel cannot scroll its pane", () => {
	const focusCalls = source.match(/\.focus\([^)]*\)/g) ?? [];
	expect(focusCalls.length).toBeGreaterThan(0);
	for (const call of focusCalls) {
		expect(call).toInclude("preventScroll");
	}
});
