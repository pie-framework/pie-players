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
			expect(source).toContain("toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS");
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
		expect(source).not.toContain("passageToolbarTools={passageToolbarTools}\n\t\t\t\t{toolRegistry}");
		expect(source).not.toContain("itemToolbarTools={itemToolbarTools}\n\t\t\t{toolRegistry}");
	});
});
