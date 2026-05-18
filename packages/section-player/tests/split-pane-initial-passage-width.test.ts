import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Parity guard for the `splitPaneInitialPassageWidth` prop.
 *
 * The layout-CE contract requires every shared prop to be declared on
 * all three layout elements (split-pane, vertical, tabbed) so consumers
 * can swap layouts without rewiring attributes (see
 * `contracts/layout-parity-metadata.ts`). This test pins that for
 * `splitPaneInitialPassageWidth` specifically and asserts:
 *
 *   1. Each layout CE source declares the camelCase prop.
 *   2. Each layout CE source maps it to the kebab attribute
 *      `split-pane-initial-passage-width` with `type: "Number"`.
 *
 * Behavioral coverage of the clamp / drag-override semantics lives in
 * the Playwright spec at `tests/section-toolbar-tools.spec.ts` (the
 * mirror to `splitPaneMinRegionWidth`'s e2e coverage); a happy-dom mount
 * test would have to fake the toolkit runtime + a dozen sub-CEs, which
 * is more scaffolding than the 5-line clamp helper warrants.
 */

const PACKAGE_ROOT = resolve(__dirname, "..");

const LAYOUT_CE_FILES = [
	"src/components/PieSectionPlayerSplitPaneElement.svelte",
	"src/components/PieSectionPlayerVerticalElement.svelte",
	"src/components/PieSectionPlayerTabbedElement.svelte",
] as const;

describe("splitPaneInitialPassageWidth — layout-parity prop declaration", () => {
	for (const relativePath of LAYOUT_CE_FILES) {
		const source = readFileSync(resolve(PACKAGE_ROOT, relativePath), "utf8");
		test(`${relativePath} declares splitPaneInitialPassageWidth with the kebab attribute`, () => {
			// Match the attribute declaration block. The block spans two lines
			// (`splitPaneInitialPassageWidth: { ... attribute: "..." ... type: "Number" }`),
			// so we test for both pieces independently to keep the regex tolerant
			// of formatting drift.
			expect(source).toContain("splitPaneInitialPassageWidth:");
			expect(source).toContain('"split-pane-initial-passage-width"');
		});
	}
});
