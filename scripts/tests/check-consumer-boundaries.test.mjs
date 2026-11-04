import { describe, expect, test } from "bun:test";

import { collectImportSpecifiers } from "../check-consumer-boundaries.mjs";

describe("check-consumer-boundaries import collection", () => {
	test("collects static, side-effect, dynamic and re-export specifiers", () => {
		const source = `
			import { a } from "static-package";
			import "@pie-players/pie-section-player/components/Layout.svelte?customElement";
			import'@pie-players/pie-item-player/src/index.ts';
			const lazy = await import("dynamic-package");
			export { b } from "re-exported-package";
		`;

		expect([...collectImportSpecifiers(source)].sort()).toEqual([
			"@pie-players/pie-item-player/src/index.ts",
			"@pie-players/pie-section-player/components/Layout.svelte?customElement",
			"dynamic-package",
			"re-exported-package",
			"static-package",
		]);
	});
});
