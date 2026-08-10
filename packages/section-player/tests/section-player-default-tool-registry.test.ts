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
const ITEM_MEDIA_PATH = resolve(
	__dirname,
	"../src/components/shared/section-item-media.ts",
);

function readSource(path: string): string {
	return readFileSync(path, "utf8");
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
		expect(source).toContain("registry.renderForSurface(tool.toolId, {");
	});

	test("base element names no capability id or element tag", () => {
		// The regression this guards: the gateway used to be named here three times
		// — the policy check, the module load and the element — so no host could
		// contribute a second section-scoped capability without a PR against this
		// repo. `check:player-tool-boundaries` already forbids the package name;
		// this covers the tool id and the tag.
		const source = readSource(BASE_ELEMENT_PATH);

		expect(source).not.toContain("annotationToolbar");
		expect(source).not.toContain("pie-tool-annotation-toolbar");
	});
});

describe("section-player names no capability for its item media surface", () => {
	test("the item card discovers media capabilities through the registry", () => {
		const source = readSource(ITEM_CARD_PATH);

		expect(source).toContain('const ITEM_MEDIA_SURFACE = "item-media";');
		expect(source).toContain("getToolsBySurface?.(ITEM_MEDIA_SURFACE)");
		// Eligibility against the capability's own support ids, and the content half
		// through its own declaration — so a host capability is gated by its own id
		// with no list here to extend.
		expect(source).toContain("tool.pnpSupportIds");
		expect(source).toContain("tool.requiresAuthoredContent.resolve({");
		// Through the registry, which owns the component-override map a capability
		// resolves its element tag against.
		expect(source).toContain("registry.renderForSurface(entry.toolId, {");
	});

	test("the item card and its sizing module name no capability, support id or tag", () => {
		// The regression this guards: signing used to be named here in six places —
		// the support id, the catalog refs walk, the resolver call, the requested
		// language, the region import and the element — so no host could contribute a
		// docked accommodation without a PR against this repo. PIE-886 removed all
		// six. `check:player-tool-boundaries` forbids the package name; this covers
		// the ids and the element tag.
		for (const sourcePath of [ITEM_CARD_PATH, ITEM_MEDIA_PATH]) {
			const source = readSource(sourcePath);

			expect(source).not.toContain("signLanguage");
			expect(source).not.toContain("signLang");
			expect(source).not.toContain("sign-language");
			expect(source).not.toContain("pie-tool-sign-language");
			expect(source).not.toContain("SectionItemMediaRegion");
		}
	});
});
