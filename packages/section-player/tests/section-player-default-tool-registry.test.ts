import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_ELEMENT_PATH = resolve(
	__dirname,
	"../src/components/PieSectionPlayerBaseElement.svelte",
);
const KERNEL_PATH = resolve(
	__dirname,
	"../src/components/shared/SectionPlayerLayoutKernel.svelte",
);
const KERNEL_HOST_PATH = resolve(
	__dirname,
	"../src/components/PieSectionPlayerKernelHostElement.svelte",
);
const ITEM_CARD_PATH = resolve(
	__dirname,
	"../src/components/shared/SectionItemCard.svelte",
);
const PASSAGE_CARD_PATH = resolve(
	__dirname,
	"../src/components/shared/SectionPassageCard.svelte",
);
const MEDIA_SPLIT_PATH = resolve(
	__dirname,
	"../src/components/shared/SectionCardMediaSplit.svelte",
);
const MEDIA_REGION_PATH = resolve(
	__dirname,
	"../src/components/shared/card-media-region.ts",
);
const SURFACE_STACK_PATH = resolve(
	__dirname,
	"../src/components/shared/SectionCardSurfaceStack.svelte",
);

function readSource(path: string): string {
	return readFileSync(path, "utf8");
}

/**
 * Source with comments removed, for the assertions about what these files must
 * not name.
 *
 * Same position `scripts/check-capability-neutrality.mjs` takes, and for the same
 * reason: a comment naming a capability is usually explaining why the code no
 * longer does, and matching prose pushes authors toward vaguer comments rather
 * than cleaner code. It did exactly that here before this helper existed — the
 * comments left behind pointed at "the package README" for a name they were not
 * allowed to write.
 */
function readCode(path: string): string {
	return readSource(path)
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:\w])\/\/[^\n]*/g, "$1")
		.replace(/<!--[\s\S]*?-->/g, " ");
}

describe("section-player default tool registry boundary", () => {
	test("base and layout kernel create a synchronous default-loader-backed registry", () => {
		for (const sourcePath of [BASE_ELEMENT_PATH, KERNEL_PATH]) {
			const source = readSource(sourcePath);

			// Both the packaged registry factory and the loaders now come from the
			// composition package: the registrations they hold name capabilities, so
			// they cannot live in the generic toolkit.
			expect(source).toContain('from "@pie-players/pie-default-tool-loaders"');
			expect(source).toContain("createPackagedToolRegistry,");
			expect(source).toContain("DEFAULT_TOOL_MODULE_LOADERS,");
			expect(source).toContain(
				"const defaultToolRegistry = createPackagedToolRegistry({",
			);
			// And not from the toolkit, which no longer exports it.
			expect(source).not.toContain(
				'createPackagedToolRegistry } from "@pie-players/pie-assessment-toolkit"',
			);
			expect(source).toContain(
				"toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS",
			);
			expect(source).toContain(
				"const effectiveToolRegistry = $derived(toolRegistry ?? defaultToolRegistry);",
			);
			expect(source).not.toContain(
				'import("@pie-players/pie-default-tool-loaders")',
			);
		}
	});

	test("kernel-host panes receive the kernel effective registry from the slot", () => {
		const source = readSource(KERNEL_HOST_PATH);

		expect(source).toContain("let:toolRegistry={layoutToolRegistry}");
		expect(source).toContain("toolRegistry={layoutToolRegistry}");
		expect(source).not.toContain(
			"passageToolbarTools={passageToolbarTools}\n\t\t\t\t{toolRegistry}",
		);
		expect(source).not.toContain(
			"itemToolbarTools={itemToolbarTools}\n\t\t\t{toolRegistry}",
		);
	});
});
describe("section-player tool surface host seam", () => {
	test("all three geometry adapters delegate lifecycle ownership", () => {
		for (const sourcePath of [
			BASE_ELEMENT_PATH,
			MEDIA_SPLIT_PATH,
			SURFACE_STACK_PATH,
		]) {
			const source = readCode(sourcePath);
			expect(source).toContain("createToolSurfaceHost(");
			expect(source).not.toContain("getToolsBySurface(");
			expect(source).not.toContain("ensureToolModuleLoaded(");
			expect(source).not.toContain("renderForSurface(");
		}

		// The other half — that the host is what calls the registry — moved with the
		// module into `@pie-players/pie-assessment-toolkit`, where a second renderer
		// now drives the same seam. Its own suite owns those assertions.
	});

	test("the section adapter declares only its surface and scope", () => {
		const source = readCode(BASE_ELEMENT_PATH);
		expect(source).toContain(
			'const SECTION_OVERLAY_SURFACE = "section-overlay";',
		);
		expect(source).toContain('kind: "section"');
		expect(source).not.toContain("annotationToolbar");
		expect(source).not.toContain("pie-tool-annotation-toolbar");
	});

	test("the surface is named for the relationship, not for one card kind", () => {
		// The regression this guards: the surface was `item-media` and lived in the
		// item card, so an alternate authored against passage content had nowhere to
		// render even though it resolved. Both cards now open one surface, which is
		// also why a capability declares it once.
		expect(readSource(MEDIA_REGION_PATH)).toContain(
			'export const CONTENT_MEDIA_SURFACE = "content-media";',
		);
		for (const sourcePath of [ITEM_CARD_PATH, PASSAGE_CARD_PATH]) {
			expect(readSource(sourcePath)).toContain("<SectionCardMediaSplit");
		}
	});

	test("the lead surface is a host slot both cards open, named for the relationship", () => {
		// A text alternate has to be read in order with the content rather than
		// watched beside it, which the docked media geometry cannot express. Both
		// cards open the slot, so a capability declares it once and reaches an item
		// and a passage alike.
		expect(readSource(MEDIA_REGION_PATH)).toContain(
			'export const CONTENT_LEAD_SURFACE = "content-lead";',
		);
		for (const sourcePath of [ITEM_CARD_PATH, PASSAGE_CARD_PATH]) {
			const source = readCode(sourcePath);
			expect(source).toContain("<SectionCardSurfaceStack");
			expect(source).toContain("surface={CONTENT_LEAD_SURFACE}");
			// No capability named in the code, and no reveal class: the slot mounts
			// whatever registered on it. The regression this guards is the design this
			// replaced, where the card resolved the transcript card itself and stamped
			// an element-specific class.
			expect(source).not.toContain("transcript");
			expect(source).not.toContain("rli-with-audio");
		}
		const stack = readCode(SURFACE_STACK_PATH);
		expect(stack).toContain('kind: "content"');
		expect(stack).toContain("surfaceHost.update({");
	});

	test("the region follows what mounted, not what was granted", () => {
		// The regression this guards: the region and its focusable resize divider
		// were rendered from the grant count, but `renderSurface` returning `null` is
		// a legitimate answer — so a host that remapped the element tag got an empty
		// column with a handle dividing nothing. And losing the last grant destroys
		// the anchor, which the mount effect used to treat as "nothing to do",
		// leaving a detached `<video>` playing and the region permanently blank on
		// the next grant.
		const source = readCode(MEDIA_SPLIT_PATH);

		expect(source).toContain("surfaceSnapshot.occupied");
		expect(source).toContain("surfaceSnapshot.mountable");
		expect(source).toContain(
			"mediaDividerVisible = $derived(mediaRegionOccupied",
		);
	});

	test("the cards, the region and its sizing module name no capability, support id or tag", () => {
		// The regression this guards: signing used to be named here in six places —
		// the support id, the catalog refs walk, the resolver call, the requested
		// language, the region import and the element — so no host could contribute a
		// docked accommodation without a PR against this repo. PIE-886 removed all
		// six. `check:player-tool-boundaries` forbids the package name; this covers
		// the ids and the element tag.
		for (const sourcePath of [
			ITEM_CARD_PATH,
			PASSAGE_CARD_PATH,
			MEDIA_SPLIT_PATH,
			MEDIA_REGION_PATH,
		]) {
			const source = readCode(sourcePath);

			expect(source).not.toContain("signLanguage");
			expect(source).not.toContain("signLang");
			expect(source).not.toContain("sign-language");
			expect(source).not.toContain("pie-tool-sign-language");
			expect(source).not.toContain("SectionItemMediaRegion");
		}
	});
});
