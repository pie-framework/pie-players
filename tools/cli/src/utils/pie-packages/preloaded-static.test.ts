import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

import { generateHash, parseElementsInput } from "./fixed-static.js";

describe("preloaded static utilities", () => {
	test("generateHash is order independent", () => {
		const a = [
			"@pie-element/multiple-choice@11.4.3",
			"@pie-element/passage@5.3.3",
		];
		const b = [...a].reverse();
		expect(generateHash(a)).toBe(generateHash(b));
	});

	test("parseElementsInput supports object with elements", async () => {
		const dir = await mkdtemp(join(os.tmpdir(), "pie-preloaded-static-"));
		const file = join(dir, "elements.json");
		await writeFile(
			file,
			JSON.stringify({
				elements: [{ package: "@pie-element/multiple-choice", version: "11.4.3" }],
			}),
		);
		const parsed = await parseElementsInput(file, undefined);
		expect(parsed).toEqual([
			{ package: "@pie-element/multiple-choice", version: "11.4.3" },
		]);
	});
});
