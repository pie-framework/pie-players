import { afterAll, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chunkFileNamesFromSource } from "../chunk-file-names.js";

const scratch = realpathSync(mkdtempSync(join(tmpdir(), "pie-chunk-names-")));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const checkout = (name: string) => {
	const root = join(scratch, name);
	mkdirSync(root);
	return root;
};

const moduleShim = (root: string) => ({
	name: "module-shim",
	moduleIds: [`${root}/packages/players-shared/dist/loaders/module-shim.js`],
});

describe("chunkFileNamesFromSource", () => {
	test("names a sibling package's dist module the same from any checkout", () => {
		const main = checkout("main");
		const worktree = checkout("worktree");

		expect(chunkFileNamesFromSource(main)(moduleShim(main))).toBe(
			"chunks/module-shim-58659a86.js",
		);
		expect(chunkFileNamesFromSource(worktree)(moduleShim(worktree))).toBe(
			"chunks/module-shim-58659a86.js",
		);
	});

	test("matches module ids against the real path of a symlinked root", () => {
		const real = checkout("real");
		const link = join(scratch, "link");
		symlinkSync(real, link);

		expect(chunkFileNamesFromSource(link)(moduleShim(real))).toBe(
			"chunks/module-shim-58659a86.js",
		);
	});

	test("keys modules under node_modules or src by the path below it", () => {
		const names = chunkFileNamesFromSource(checkout("any"));

		expect(
			names({
				name: "index",
				facadeModuleId:
					"/elsewhere/node_modules/.bun/mathjax@4.1.3/node_modules/mathjax/index.js",
			}),
		).toBe("chunks/index-96b1fb94.js");
		expect(
			names({
				name: "thing",
				moduleIds: ["/elsewhere/packages/foo/src/lib/thing.ts"],
			}),
		).toBe("chunks/thing-5aea3ace.js");
	});
});
