import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

import { generateHash, parseElementsInput, readElementSet } from "./fixed-static.js";

const writeConfig = async (name: string, content: unknown): Promise<string> => {
	const dir = await mkdtemp(join(os.tmpdir(), "pie-preloaded-static-"));
	const file = join(dir, name);
	await writeFile(file, JSON.stringify(content));
	return file;
};

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
				elements: [
					{ package: "@pie-element/multiple-choice", version: "11.4.3" },
				],
			}),
		);
		const parsed = await parseElementsInput(file, undefined);
		expect(parsed).toEqual([
			{ package: "@pie-element/multiple-choice", version: "11.4.3" },
		]);
	});

	test("readElementSet names the set after its config file and publishes under that name", async () => {
		const file = await writeConfig("knowledge-checks.json", [
			{ package: "@pie-element/passage", version: "5.3.3" },
		]);
		expect(await readElementSet(file)).toEqual({
			name: "knowledge-checks",
			distTag: "knowledge-checks",
		});
	});

	test("readElementSet publishes the config marked latest under latest", async () => {
		const file = await writeConfig("star-0326.json", {
			latest: true,
			elements: [{ package: "@pie-element/multiple-choice", version: "13.4.4" }],
		});
		expect(await readElementSet(file)).toEqual({ name: "star-0326", distTag: "latest" });
	});

	test("readElementSet rejects a file name that cannot be a prerelease identifier", async () => {
		const file = await writeConfig("Star_0326.json", []);
		await expect(readElementSet(file)).rejects.toThrow("not a valid element-set name");
	});
});
