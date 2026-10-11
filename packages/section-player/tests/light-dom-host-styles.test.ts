import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "bun:test";

/**
 * A `shadow: "none"` element's styles land in the document, where Svelte leaves
 * `:host` untransformed and it matches nothing. Five layout and pane elements
 * carried such rules; the panes' one held the gap between cards, which rendered
 * flush from March 2026 until the rule moved to the tag selector.
 */
const COMPONENTS = resolve(import.meta.dir, "../src/components");

const svelteFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return svelteFiles(path);
		return entry.name.endsWith(".svelte") ? [path] : [];
	});

const lightDom = svelteFiles(COMPONENTS).filter((path) =>
	/shadow:\s*"none"/.test(readFileSync(path, "utf8")),
);

describe("light-DOM elements style their host by tag", () => {
	test("the scan reaches the layout and pane elements", () => {
		const names = lightDom.map((path) => relative(COMPONENTS, path));
		expect(names).toContain("PieSectionPlayerSplitPaneElement.svelte");
		expect(names).toContain("shared/SectionItemsPane.svelte");
	});

	for (const path of lightDom) {
		test(`${relative(COMPONENTS, path)} has no :host rule`, () => {
			const source = readFileSync(path, "utf8");
			const style = source.slice(source.indexOf("<style"));
			expect(style.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain(":host");
		});
	}

	test("the stock panes lay their cards out with a gap", () => {
		for (const [file, tag] of [
			["shared/SectionItemsPane.svelte", "pie-section-player-items-pane"],
			["shared/SectionPassagesPane.svelte", "pie-section-player-passages-pane"],
		]) {
			const source = readFileSync(join(COMPONENTS, file), "utf8");
			const collapsed = source.replace(/\s+/g, " ");
			expect(collapsed, file).toContain(
				`:global(${tag}) { display: flex; flex-direction: column; gap: 1rem;`,
			);
		}
	});
});
