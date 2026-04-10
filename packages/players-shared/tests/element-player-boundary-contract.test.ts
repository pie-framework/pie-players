import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("element-player boundary contract", () => {
	test("pie-elements-ng element-player does not rely on retry-success bridge events", () => {
		const boundaryFile = join(
			import.meta.dir,
			"../../../../pie-elements-ng/packages/element-player/src/players/PieElementPlayer.svelte",
		);
		if (!existsSync(boundaryFile)) {
			return;
		}
		const source = readFileSync(boundaryFile, "utf8");
		expect(source.includes("pie-resource-retry-success")).toBe(false);
	});
});
