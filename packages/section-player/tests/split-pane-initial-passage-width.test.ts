import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The `split-pane-*` attributes belong to the splitpane layout alone. Vertical
 * and tabbed declare none of them.
 *
 * Behavioral coverage of the clamp / drag-override semantics lives in
 * `tests/section-toolbar-tools.spec.ts`.
 */

const PACKAGE_ROOT = resolve(__dirname, "..");
const read = (relativePath: string) =>
	readFileSync(resolve(PACKAGE_ROOT, relativePath), "utf8");

describe("split-pane attributes", () => {
	test("splitpane declares splitPaneInitialPassageWidth with the kebab attribute", () => {
		const source = read("src/components/PieSectionPlayerSplitPaneElement.svelte");
		expect(source).toContain("splitPaneInitialPassageWidth:");
		expect(source).toContain('"split-pane-initial-passage-width"');
	});

	for (const relativePath of [
		"src/components/PieSectionPlayerVerticalElement.svelte",
		"src/components/PieSectionPlayerTabbedElement.svelte",
	]) {
		test(`${relativePath} declares no split-pane attribute`, () => {
			const source = read(relativePath);
			expect(source).not.toContain("splitPane");
			expect(source).not.toContain('"split-pane-');
		});
	}
});
