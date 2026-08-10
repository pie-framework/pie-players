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

function readSource(path: string): string {
	return readFileSync(path, "utf8");
}

describe("section-player default tool registry boundary", () => {
	test("base and layout kernel create a synchronous default-loader-backed registry", () => {
		for (const sourcePath of [BASE_ELEMENT_PATH, KERNEL_PATH]) {
			const source = readSource(sourcePath);

			expect(source).toContain(
				'import { DEFAULT_TOOL_MODULE_LOADERS } from "@pie-players/pie-default-tool-loaders";',
			);
			expect(source).toContain(
				"const defaultToolRegistry = createPackagedToolRegistry({",
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
		expect(source).toContain("tool.renderSurface?.({");
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
