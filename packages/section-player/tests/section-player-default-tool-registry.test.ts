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
const SURFACE_CAPABILITIES_PATH = resolve(
	__dirname,
	"../src/components/shared/card-surface-capabilities.ts",
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
describe("section-player names no capability for its section-scoped surface", () => {
	test("base element discovers overlay capabilities through the registry", () => {
		const source = readSource(BASE_ELEMENT_PATH);

		expect(source).toContain(
			'const SECTION_OVERLAY_SURFACE = "section-overlay";',
		);
		expect(source).toContain("getToolsBySurface?.(SECTION_OVERLAY_SURFACE)");
		// The grant check runs against each capability's own toolId rather than a
		// literal, and the module load and mount follow from the same list.
		expect(source).toContain("candidate.toolId === tool.toolId");
		expect(source).toContain(".ensureToolModuleLoaded(toolId)");
		// Through the registry rather than `tool.renderSurface` directly: the
		// registry owns the component-override map a capability resolves its element
		// tag against, so calling the registration straight from here left every
		// packaged surface capability unable to find its tag.
		expect(source).toContain("registry.renderForSurface(");
	});

	test("base element asks the feature question for region capabilities", () => {
		// The regression this guards: the surface was gated only on
		// `decideToolPolicy`, whose candidates are seeded from `tools.placement`, so
		// a capability that is only ever a region could not be granted here at all —
		// and placing it to compensate is a `tools.unplaceableActivation` error. The
		// mechanism worked for exactly the one capability that motivated it, which
		// also has a toolbar activation.
		const source = readCode(BASE_ELEMENT_PATH);

		expect(source).toContain('tool.activation === "region"');
		expect(source).toContain("coord.decideFeaturePolicy(supportId)");
		expect(source).toContain("coord.decideToolPolicy({");
	});

	test("both surfaces hand the capability a freshly built context", () => {
		// The regression this guards: `sync` took no argument, so a registration
		// closed over the context captured at mount and re-applied the values the
		// host already had. Reconciling by toolId instead of remounting exists so a
		// re-resolve reaches the mounted element; with a captured context it reached
		// nothing, and a learner whose signed language changed kept watching the
		// previous recording.
		expect(readCode(BASE_ELEMENT_PATH)).toContain(
			"mounted.sync?.(overlaySurfaceContext(granted, coord))",
		);
		expect(readCode(MEDIA_SPLIT_PATH)).toContain(
			"existing.sync?.(mediaSurfaceContext(entry))",
		);
	});

	test("base element names no capability id or element tag", () => {
		// The regression this guards: the gateway used to be named here three times
		// — the policy check, the module load and the element — so no host could
		// contribute a second section-scoped capability without a PR against this
		// repo. `check:player-tool-boundaries` already forbids the package name;
		// this covers the tool id and the tag.
		const source = readCode(BASE_ELEMENT_PATH);

		expect(source).not.toContain("annotationToolbar");
		expect(source).not.toContain("pie-tool-annotation-toolbar");
	});
});

describe("section-player names no capability for its card media surface", () => {
	test("the shared media region discovers capabilities through the registry", () => {
		const source = readSource(MEDIA_SPLIT_PATH);

		expect(source).toContain("getToolsBySurface?.(CONTENT_MEDIA_SURFACE)");
		// Eligibility against the capability's own support ids, and the content half
		// through its own declaration — so a host capability is gated by its own id
		// with no list here to extend. Both halves live in the module every card
		// surface shares, which is what keeps the rule from drifting between slots.
		expect(source).toContain("resolveSurfaceCapabilities({");
		const shared = readSource(SURFACE_CAPABILITIES_PATH);
		expect(shared).toContain("tool.pnpSupportIds");
		expect(shared).toContain("tool.requiresAuthoredContent.resolve({");
		// Through the registry, which owns the component-override map a capability
		// resolves its element tag against.
		expect(source).toContain("registry.renderForSurface(");
		// And after its module resolves, so a capability registered through the lazy
		// loader path renders instead of silently missing its element.
		expect(source).toContain(".ensureToolModuleLoaded(toolId)");
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
		// And the stack itself reaches capabilities the same way the media region
		// does, through the registry.
		const stack = readSource(SURFACE_STACK_PATH);
		expect(stack).toContain("getToolsBySurface?.(surface)");
		expect(stack).toContain("registry.renderForSurface(");
		expect(stack).toContain(".ensureToolModuleLoaded(toolId)");
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

		expect(source).toContain("mountedMediaCount > 0");
		expect(source).toContain("unmountMediaTool(toolId)");
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
