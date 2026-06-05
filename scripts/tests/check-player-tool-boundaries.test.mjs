import { describe, expect, test } from "bun:test";
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkPlayerToolBoundaries } from "../check-player-tool-boundaries.mjs";

function write(root, relPath, content) {
	const absPath = path.join(root, relPath);
	mkdirSync(path.dirname(absPath), { recursive: true });
	writeFileSync(absPath, content);
}

function createFixtureRoot() {
	const root = mkdtempSync(path.join(tmpdir(), "pie-tool-boundary-"));

	write(
		root,
		"packages/section-player/src/index.ts",
		'import { DEFAULT_TOOL_MODULE_LOADERS } from "@pie-players/pie-default-tool-loaders";\n',
	);
	write(root, "packages/assessment-toolkit/src/index.ts", "export {};\n");
	write(
		root,
		"packages/default-tool-loaders/src/index.ts",
		'import "@pie-players/pie-tool-calculator-desmos";\n',
	);
	write(
		root,
		"packages/section-player/dist/pie-section-player.js",
		'import { DEFAULT_TOOL_MODULE_LOADERS } from "@pie-players/pie-default-tool-loaders";\nconst tag = "pie-tool-calculator";\n',
	);
	write(
		root,
		"packages/assessment-toolkit/dist/index.js",
		'const tag = "pie-tool-tts-inline";\n',
	);
	write(
		root,
		"packages/section-player/package.json",
		JSON.stringify({
			name: "@pie-players/pie-section-player",
			dependencies: {
				"@pie-players/pie-default-tool-loaders": "workspace:*",
			},
		}),
	);
	write(
		root,
		"packages/assessment-toolkit/package.json",
		JSON.stringify({
			name: "@pie-players/pie-assessment-toolkit",
			dependencies: {},
		}),
	);
	write(
		root,
		"packages/assessment-toolkit/tsconfig.json",
		JSON.stringify({
			compilerOptions: {
				paths: {
					"@pie-players/pie-assessment-toolkit": ["./src/index.ts"],
				},
			},
		}),
	);
	write(
		root,
		"packages/section-player/tsconfig.json",
		JSON.stringify({
			compilerOptions: {
				paths: {
					"@pie-players/pie-section-player": ["./src/index.ts"],
				},
			},
		}),
	);
	write(
		root,
		"packages/section-player/tsconfig.svelte-check.json",
		JSON.stringify({
			extends: "./tsconfig.json",
		}),
	);
	write(
		root,
		"packages/section-player/vite.config.ts",
		'export default { build: { rollupOptions: { external: ["@pie-players/pie-default-tool-loaders"] } } };\n',
	);

	return root;
}

describe("check-player-tool-boundaries", () => {
	test("allows concrete tool imports only in the default-loader package", () => {
		const root = createFixtureRoot();

		expect(checkPlayerToolBoundaries(root)).toEqual([]);
	});

	test("rejects concrete tool imports from section-player and assessment-toolkit source", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/assessment-toolkit/src/tools/default-tool-module-loaders.ts",
			'import("@pie-players/pie-tool-tts-inline");\n',
		);

		const failures = checkPlayerToolBoundaries(root);

		expect(failures.join("\n")).toContain(
			"packages/assessment-toolkit/src/tools/default-tool-module-loaders.ts imports @pie-players/pie-tool-tts-inline",
		);
	});

	test("rejects concrete tool dependencies in player and toolkit manifests", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/section-player/package.json",
			JSON.stringify({
				name: "@pie-players/pie-section-player",
				dependencies: {
					"@pie-players/pie-tool-calculator-desmos": "workspace:*",
				},
			}),
		);

		const failures = checkPlayerToolBoundaries(root);

		expect(failures.join("\n")).toContain(
			"packages/section-player/package.json declares @pie-players/pie-tool-calculator-desmos in dependencies",
		);
	});

	test("rejects concrete package imports and chunks in section-player dist", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/section-player/dist/pie-section-player.js",
			'import "@pie-players/pie-tool-calculator-desmos";\n',
		);
		write(
			root,
			"packages/section-player/dist/chunks/pie-tool-calculator-abcd.js",
			"export {};\n",
		);

		const failures = checkPlayerToolBoundaries(root).join("\n");

		expect(failures).toContain(
			"packages/section-player/dist/pie-section-player.js imports concrete tool package @pie-players/pie-tool-calculator-desmos",
		);
		expect(failures).toContain(
			"player/toolkit dist includes concrete tool chunk: packages/section-player/dist/chunks/pie-tool-calculator-abcd.js",
		);
	});

	test("rejects bundled calculator internals in player/toolkit dist even when chunk names are opaque", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/section-player/dist/chunks/chunk-7QG4W9.js",
			'const bundled = "@pie-lib/math-rendering-module";\n',
		);
		write(
			root,
			"packages/assessment-toolkit/dist/chunks/chunk-8RZ5H1.js",
			'const bundled = "@pie-lib/math-rendering-module";\n',
		);

		const failures = checkPlayerToolBoundaries(root).join("\n");

		expect(failures).toContain(
			"packages/section-player/dist/chunks/chunk-7QG4W9.js includes @pie-lib/math-rendering-module",
		);
		expect(failures).toContain(
			"packages/assessment-toolkit/dist/chunks/chunk-8RZ5H1.js includes @pie-lib/math-rendering-module",
		);
	});

	test("rejects concrete tool externals and player/toolkit tsconfig path mappings", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/section-player/vite.config.ts",
			'export default { build: { rollupOptions: { external: ["@pie-players/pie-tool-tts-inline"] } } };\n',
		);
		write(
			root,
			"packages/assessment-toolkit/tsconfig.json",
			JSON.stringify({
				compilerOptions: {
					paths: {
						"@pie-players/pie-tool-tts-inline": [
							"../tool-tts-inline/dist/index.d.ts",
						],
					},
				},
			}),
		);
		write(
			root,
			"packages/section-player/tsconfig.svelte-check.json",
			JSON.stringify({
				compilerOptions: {
					paths: {
						"@pie-players/pie-tool-calculator-desmos": [
							"../tool-calculator-desmos/dist/index.d.ts",
						],
					},
				},
			}),
		);

		const failures = checkPlayerToolBoundaries(root).join("\n");

		expect(failures).toContain(
			"packages/section-player/vite.config.ts names concrete tool package @pie-players/pie-tool-tts-inline",
		);
		expect(failures).toContain(
			"packages/assessment-toolkit/tsconfig.json maps concrete tool package @pie-players/pie-tool-tts-inline",
		);
		expect(failures).toContain(
			"packages/section-player/tsconfig.svelte-check.json maps concrete tool package @pie-players/pie-tool-calculator-desmos",
		);
	});
});
