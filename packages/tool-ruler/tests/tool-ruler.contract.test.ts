import { expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-ruler.svelte", import.meta.url),
).text();

test("keyboard placement is wired to the panel", () => {
	expect(source).toInclude("onkeydown={handleKeyDown}");
});

test("keyboard placement writes the channel Moveable reads", () => {
	// Moveable derives geometry from `transform` and writes `style.transform`;
	// a keyboard path writing anywhere else desynchronises the two.
	expect(source).toInclude("containerEl.style.transform =");
	expect(source).toInclude("target.style.transform = transform");
});

test("drag containment is declared against the CSS box", () => {
	expect(source).toInclude("position: 'css'");
});

test("revealing the tool cannot scroll its pane", () => {
	const focusCalls = source.match(/\.focus\([^)]*\)/g) ?? [];
	expect(focusCalls.length).toBeGreaterThan(0);
	for (const call of focusCalls) {
		expect(call).toInclude("preventScroll");
	}
});
