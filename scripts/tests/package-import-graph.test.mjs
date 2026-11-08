import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	analyzePackage,
	scanDeclarationImports,
	scanScriptImports,
	scanStylesheetImports,
} from "../lib/package-import-graph.mjs";

function createPackage(files) {
	const dir = mkdtempSync(path.join(tmpdir(), "pie-import-graph-"));
	for (const [relPath, content] of Object.entries(files)) {
		const absPath = path.join(dir, relPath);
		mkdirSync(path.dirname(absPath), { recursive: true });
		writeFileSync(absPath, content);
	}
	return dir;
}

const codes = (findings) => findings.map((finding) => finding.code).sort();

describe("scanScriptImports", () => {
	test("finds static, dynamic and required specifiers", () => {
		const specifiers = scanScriptImports(
			[
				'import a from "static-dep";',
				'import "side-effect";',
				'export * from "./local.js";',
				'export { x } from "re-export";',
				'const lazy = () => import("lazy-dep");',
				'const c = require("cjs-dep");',
			].join("\n"),
		);
		expect(specifiers).toEqual([
			{ specifier: "static-dep", kind: "static" },
			{ specifier: "side-effect", kind: "static" },
			{ specifier: "./local.js", kind: "static" },
			{ specifier: "re-export", kind: "static" },
			{ specifier: "lazy-dep", kind: "dynamic" },
			{ specifier: "cjs-dep", kind: "require" },
		]);
	});

	test("ignores specifiers in comments, strings and template literals", () => {
		const specifiers = scanScriptImports(
			[
				'// import "in-comment";',
				'/* import("in-block") */',
				'const s = \'import("in-string")\';',
				"const t = `import x from \"${url}\"`;",
				'import real from "real-dep";',
				"import(`${base}/chunk.js`);",
			].join("\n"),
		);
		expect(specifiers.map((entry) => entry.specifier)).toEqual(["real-dep"]);
	});
});

describe("scanDeclarationImports", () => {
	test("keeps type-only imports and import types", () => {
		const specifiers = scanDeclarationImports(
			[
				'/// <reference types="node" />',
				'import type { A } from "type-only";',
				'import { type B, C } from "mixed";',
				'export type { D } from "type-reexport";',
				'export * from "./sub.js";',
				'type T = import("import-type").Bar;',
				'// import "in-comment";',
			].join("\n"),
		);
		expect(specifiers).toEqual([
			{ specifier: "type-only", kind: "type" },
			{ specifier: "mixed", kind: "type" },
			{ specifier: "type-reexport", kind: "type" },
			{ specifier: "./sub.js", kind: "type" },
			{ specifier: "import-type", kind: "type" },
			{ specifier: "node", kind: "reference-types" },
		]);
	});
});

describe("scanStylesheetImports", () => {
	test("reads @import and skips commented ones", () => {
		expect(
			scanStylesheetImports(
				'@import "css-dep/tokens.css";\n/* @import "old.css"; */\n@import url("other.css");',
			).map((entry) => entry.specifier),
		).toEqual(["css-dep/tokens.css", "other.css"]);
	});
});

const MANIFEST = {
	name: "@pie-players/fixture",
	exports: {
		".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
		"./browser": {
			types: "./dist/browser.d.ts",
			import: "./dist/browser/entry.js",
		},
	},
};

const FILES = {
	"dist/index.js":
		'import "used-dep";\nexport * from "./chunk.js";\nexport const lazy = () => import("lazy-dep");\n',
	"dist/chunk.js": 'import { x } from "peer-dep";\nexport const y = x;\n',
	"dist/index.d.ts":
		'import type { T } from "types-dep";\nexport type { T };\nexport * from "./chunk.js";\n',
	"dist/chunk.d.ts": "export declare const y: number;\n",
	"dist/browser.d.ts": "export {};\n",
	"dist/browser/entry.js": "export const bundled = 1;\n",
};

const DEPENDENCIES = {
	"used-dep": "^1.0.0",
	"lazy-dep": "^1.0.0",
	"types-dep": "^1.0.0",
};

describe("analyzePackage", () => {
	test("accepts a package whose imports are all declared and reachable", () => {
		const dir = createPackage(FILES);
		expect(
			analyzePackage({
				dir,
				pkg: {
					...MANIFEST,
					dependencies: DEPENDENCIES,
					peerDependencies: { "peer-dep": "^1.0.0" },
				},
				allowed: { typeOnly: ["types-dep"] },
			}),
		).toEqual([]);
	});

	test("catches a phantom import in a chunk and in a dynamic import", () => {
		const dir = createPackage({
			...FILES,
			"dist/chunk.js":
				'import { x } from "peer-dep";\nimport("ghost-dep/deep");\nexport const y = x;\n',
		});
		const findings = analyzePackage({
			dir,
			pkg: {
				...MANIFEST,
				dependencies: DEPENDENCIES,
				peerDependencies: { "peer-dep": "^1.0.0" },
			},
			allowed: { typeOnly: ["types-dep"] },
		});
		expect(codes(findings)).toEqual(["phantom-import"]);
		expect(findings[0].message).toContain('"ghost-dep/deep"');
	});

	test("does not read a phantom import from a comment or a string", () => {
		const dir = createPackage({
			...FILES,
			"dist/chunk.js":
				'// import "ghost-dep";\nconst hint = \'import("ghost-dep")\';\nexport const y = hint;\n',
		});
		expect(
			analyzePackage({
				dir,
				pkg: {
					...MANIFEST,
					dependencies: DEPENDENCIES,
				},
				allowed: { typeOnly: ["types-dep"] },
			}),
		).toEqual([]);
	});

	test("reports a dependency only the declarations name apart from one nothing names", () => {
		const dir = createPackage(FILES);
		const findings = analyzePackage({
			dir,
			pkg: {
				...MANIFEST,
				dependencies: { ...DEPENDENCIES, "orphan-dep": "^1.0.0" },
				peerDependencies: { "peer-dep": "^1.0.0" },
			},
		});
		expect(codes(findings)).toEqual([
			"type-only-dependency",
			"unreachable-dependency",
		]);
		expect(
			findings.find((finding) => finding.code === "type-only-dependency")
				.message,
		).toContain('"types-dep"');
		expect(
			findings.find((finding) => finding.code === "unreachable-dependency")
				.message,
		).toContain('"orphan-dep"');
	});

	test("excuses a listed type-only or unreachable dependency", () => {
		const dir = createPackage(FILES);
		expect(
			analyzePackage({
				dir,
				pkg: {
					...MANIFEST,
					dependencies: { ...DEPENDENCIES, "orphan-dep": "^1.0.0" },
					peerDependencies: { "peer-dep": "^1.0.0" },
				},
				allowed: { typeOnly: ["types-dep"], unreachable: ["orphan-dep"] },
			}),
		).toEqual([]);
	});

	test("fails an allowance that excuses nothing", () => {
		const dir = createPackage(FILES);
		const findings = analyzePackage({
			dir,
			pkg: {
				...MANIFEST,
				dependencies: DEPENDENCIES,
				peerDependencies: { "peer-dep": "^1.0.0" },
			},
			allowed: {
				// "used-dep" is imported by a script, so it is no longer type-only.
				typeOnly: ["types-dep", "used-dep"],
				unreachable: ["lazy-dep"],
				undeclaredNpm: ["https://esm.run/lib"],
			},
		});
		expect(codes(findings)).toEqual([
			"stale-allowance",
			"stale-allowance",
			"stale-allowance",
		]);
		expect(findings.map((finding) => finding.message).join("\n")).toContain(
			'"https://esm.run/lib" in allowedUndeclaredRuntimeImports.npm',
		);
	});

	test("counts only files reachable from the manifest", () => {
		const dir = createPackage({
			...FILES,
			"dist/unlisted.js": 'import "ghost-dep";\nimport "orphan-dep";\n',
		});
		const findings = analyzePackage({
			dir,
			pkg: {
				...MANIFEST,
				dependencies: { ...DEPENDENCIES, "orphan-dep": "^1.0.0" },
				peerDependencies: { "peer-dep": "^1.0.0" },
			},
			allowed: { typeOnly: ["types-dep"] },
		});
		expect(codes(findings)).toEqual(["unreachable-dependency"]);
	});

	test("satisfies a type import with its @types package", () => {
		const dir = createPackage({
			...FILES,
			"dist/index.d.ts": 'import type { T } from "types-dep";\nexport type { T };\n',
		});
		const findings = analyzePackage({
			dir,
			pkg: {
				...MANIFEST,
				dependencies: {
					"used-dep": "^1.0.0",
					"lazy-dep": "^1.0.0",
					"@types/types-dep": "^1.0.0",
				},
				peerDependencies: { "peer-dep": "^1.0.0" },
			},
		});
		expect(codes(findings)).toEqual([]);
	});

	test("reports a declaration naming a package the manifest does not declare", () => {
		const dir = createPackage({
			...FILES,
			"dist/index.d.ts": 'import type { T } from "ghost-types";\nexport type { T };\n',
		});
		const findings = analyzePackage({
			dir,
			pkg: {
				...MANIFEST,
				dependencies: { "used-dep": "^1.0.0", "lazy-dep": "^1.0.0" },
				peerDependencies: { "peer-dep": "^1.0.0" },
			},
		});
		expect(codes(findings)).toEqual(["phantom-type-import"]);
	});

	test("holds the browser build to no bare imports, declared or not", () => {
		const dir = createPackage({
			...FILES,
			"dist/browser/entry.js":
				'import "used-dep";\nimport("https://esm.run/lib");\nexport const bundled = 1;\n',
		});
		const pkg = {
			...MANIFEST,
			dependencies: DEPENDENCIES,
			peerDependencies: { "peer-dep": "^1.0.0" },
		};
		const strict = analyzePackage({
			dir,
			pkg,
			allowed: { typeOnly: ["types-dep"] },
		});
		expect(codes(strict)).toEqual(["browser-bare-import", "browser-bare-import"]);
		expect(
			analyzePackage({
				dir,
				pkg,
				allowed: {
					typeOnly: ["types-dep"],
					undeclaredBrowser: ["used-dep", "https://esm.run/lib"],
				},
			}),
		).toEqual([]);
	});

	test("takes the npm and browser allowlists separately", () => {
		const dir = createPackage({
			...FILES,
			"dist/chunk.js":
				'import { x } from "peer-dep";\nimport("https://esm.run/lib");\nexport const y = x;\n',
		});
		const pkg = {
			...MANIFEST,
			dependencies: DEPENDENCIES,
			peerDependencies: { "peer-dep": "^1.0.0" },
		};
		expect(
			codes(
				analyzePackage({
					dir,
					pkg,
					allowed: {
						typeOnly: ["types-dep"],
						undeclaredBrowser: ["https://esm.run/lib"],
					},
				}),
			),
		).toEqual(["phantom-import"]);
		expect(
			analyzePackage({
				dir,
				pkg,
				allowed: {
					typeOnly: ["types-dep"],
					undeclaredNpm: ["https://esm.run/lib"],
				},
			}),
		).toEqual([]);
	});

	test("follows a declaration's .js specifier to the .d.ts, not the script beside it", () => {
		const dir = createPackage({
			...FILES,
			"dist/chunk.d.ts":
				'import type { P } from "peer-dep";\nexport declare const y: P;\n',
			"dist/chunk.js": "export const y = 1;\n",
		});
		const findings = analyzePackage({
			dir,
			pkg: {
				...MANIFEST,
				dependencies: { ...DEPENDENCIES, "peer-dep": "^1.0.0" },
			},
			allowed: { typeOnly: ["types-dep"] },
		});
		expect(codes(findings)).toEqual(["type-only-dependency"]);
	});

	test("reports a relative import that resolves to no shipped file", () => {
		const dir = createPackage({
			...FILES,
			"dist/chunk.js": 'import { x } from "peer-dep";\nexport * from "./gone.js";\n',
		});
		const findings = analyzePackage({
			dir,
			pkg: {
				...MANIFEST,
				dependencies: DEPENDENCIES,
				peerDependencies: { "peer-dep": "^1.0.0" },
			},
			allowed: { typeOnly: ["types-dep"] },
		});
		expect(codes(findings)).toEqual(["dangling-import"]);
	});
});
