import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPathLeak, inspectBuildPaths } from "../check-portable-build-paths.mjs";

const fixtures = [];
afterEach(() => {
	for (const directory of fixtures.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function workspace() {
	const root = mkdtempSync(path.join(os.tmpdir(), "pie-portable-paths-"));
	fixtures.push(root);
	mkdirSync(path.join(root, "packages/public"), { recursive: true });
	writeFileSync(path.join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
	writeFileSync(path.join(root, "packages/public/package.json"), JSON.stringify({ name: "@pie-players/fixture" }));
	return root;
}

test("rejects the current checkout path even outside node_modules", () => {
	const root = workspace();
	expect(buildPathLeak(`export default ${JSON.stringify(`${root}/src/entry.ts`)};`, root)).toBe("checkout path");
});

test("rejects Unix, Windows and file-URL dependency paths", () => {
	const root = workspace();
	for (const source of [
		'import "/Users/build-agent/project/node_modules/example/index.js";',
		'export * from "/home/worker/project/node_modules/example/index.js";',
		'url("/private/var/tmp/job/node_modules/fonts/font.woff")',
		'{"sources":["/opt/node_modules/example/index.js"]}',
		'"/tmp/job/.bun/example/index.js"',
		'"file:///home/worker/project/node_modules/example/index.js"',
		`export default ${JSON.stringify("C:\\work\\node_modules\\example\\index.js")};`,
	]) expect(buildPathLeak(source, root)).toBe("absolute dependency path");
});

test("allows portable specifiers, relative sources and CDN URLs", () => {
	const root = workspace();
	for (const source of [
		'import "@pie-players/pie-context";',
		'import "./node_modules/example/index.js";',
		'{"sources":["../../src/index.ts"]}',
		'"https://cdn.example.test/home/worker/node_modules/example/index.js"',
		'"https://cdn.example.test/Users/build-agent/node_modules/example/index.js"',
	]) expect(buildPathLeak(source, root)).toBeNull();
});

test("requires actual build output instead of succeeding on zero files", () => {
	const root = workspace();
	expect(inspectBuildPaths(root).missingOutputs).toEqual(["@pie-players/fixture: no built artifacts; run bun run build first"]);
});

test("scans nested declarations, JavaScript, CSS and maps, ignoring binary assets", () => {
	const root = workspace();
	const dist = path.join(root, "packages/public/dist");
	mkdirSync(path.join(dist, "nested"), { recursive: true });
	writeFileSync(path.join(dist, "index.js"), "export {};");
	writeFileSync(path.join(dist, "nested/index.d.ts"), 'export * from "/home/worker/node_modules/example/index.js";');
	writeFileSync(path.join(dist, "style.css"), 'url("/tmp/job/node_modules/example/asset.png")');
	writeFileSync(path.join(dist, "index.js.map"), '{"sources":["../src/index.ts"]}');
	writeFileSync(path.join(dist, "image.png"), new Uint8Array([137, 80, 78, 71]));
	const result = inspectBuildPaths(root);
	expect(result.files).toBe(4);
	expect(result.missingOutputs).toEqual([]);
	expect(result.violations.map(({ file }) => file).sort()).toEqual([
		"packages/public/dist/nested/index.d.ts",
		"packages/public/dist/style.css",
	]);
});
