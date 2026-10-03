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
import { svelteRootDir } from "../svelte-root-dir.js";

const scratch = realpathSync(mkdtempSync(join(tmpdir(), "pie-svelte-root-")));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("svelteRootDir", () => {
	test("is the real workspace root of a package reached through a symlink", () => {
		const workspace = join(scratch, "workspace");
		mkdirSync(join(workspace, "packages", "tool"), { recursive: true });
		const link = join(scratch, "link");
		symlinkSync(workspace, link);

		expect(svelteRootDir(join(link, "packages", "tool"))).toBe(workspace);
	});
});
