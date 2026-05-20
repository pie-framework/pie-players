#!/usr/bin/env node

import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "svelte/compiler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const srcComponents = path.join(packageRoot, "src", "components");
const distComponents = path.join(packageRoot, "dist", "components");

mkdirSync(distComponents, { recursive: true });
rmSync(path.join(distComponents, ".generated"), {
	recursive: true,
	force: true,
});

// Mirror non-TS asset directories (e.g. vendored 3rd-party CE bundles) from
// src/components into dist/components so relative imports emitted by
// Svelte resolve at bundle time. tsc only emits TypeScript; static JS
// vendor bundles need to be copied explicitly.
//
// At copy time we also rewrite raw `customElements.define(...)` calls
// inside vendored files into idempotent guards. The vendor bundles get
// inlined into multiple toolkit CE artifacts (ItemToolBar / SectionToolBar
// / PieAssessmentToolkit) and a host page can load more than one of them,
// so the second register would otherwise throw NotSupportedError. This
// matches the same guarantee the SAFE_DEFINE_HELPER below provides for
// Svelte-compiled CEs, applied via source rewrite because we don't own
// the upstream code.
const guardVendorDefineCalls = (source) =>
	source.replace(
		/customElements\.define\((\w+),\s*(\w+)\)/g,
		"customElements.get($1) || customElements.define($1, $2)",
	);
const vendorSrc = path.join(srcComponents, "vendor");
const vendorDist = path.join(distComponents, "vendor");
if (existsSync(vendorSrc)) {
	rmSync(vendorDist, { recursive: true, force: true });
	cpSync(vendorSrc, vendorDist, { recursive: true });
	const walkAndPatch = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const absPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walkAndPatch(absPath);
				continue;
			}
			if (!entry.name.endsWith(".js")) continue;
			const original = readFileSync(absPath, "utf8");
			const patched = guardVendorDefineCalls(original);
			if (patched !== original) {
				writeFileSync(absPath, patched, "utf8");
			}
		}
	};
	walkAndPatch(vendorDist);
}

const entries = [
	{
		source: path.join(srcComponents, "ItemToolBar.svelte"),
		output: path.join(distComponents, "ItemToolBar.custom-element.js"),
		generated: path.join(
			distComponents,
			".ItemToolBar.custom-element.unbundled.js",
		),
	},
	{
		source: path.join(srcComponents, "PieAssessmentToolkit.svelte"),
		output: path.join(distComponents, "PieAssessmentToolkit.custom-element.js"),
		generated: path.join(
			distComponents,
			".PieAssessmentToolkit.custom-element.unbundled.js",
		),
	},
	{
		source: path.join(srcComponents, "SectionToolBar.svelte"),
		output: path.join(distComponents, "SectionToolBar.custom-element.js"),
		generated: path.join(
			distComponents,
			".SectionToolBar.custom-element.unbundled.js",
		),
	},
];

const SAFE_DEFINE_HELPER = `
const __pieDefineSafely = (tagName, ctor) => {
	if (customElements.get(tagName)) return;
	try {
		customElements.define(tagName, ctor);
	} catch (error) {
		const duplicate =
			(error instanceof DOMException && error.name === "NotSupportedError") ||
			(error && typeof error === "object" && error.name === "NotSupportedError");
		if (!duplicate || !customElements.get(tagName)) {
			throw error;
		}
	}
};
`;

for (const entry of entries) {
	const source = readFileSync(entry.source, "utf8");
	const compiled = compile(source, {
		filename: entry.source,
		generate: "client",
		customElement: true,
		css: "injected",
		dev: false,
	});

	// Svelte CE output can include setter parameters with default values, which
	// are not valid in plain JS class setters and break svelte-check consumers.
	let sanitizedCode = compiled.js.code.replace(
		/set\s+([A-Za-z_$][\w$]*)\(\s*\$\$value\s*=\s*[^)]+\)/g,
		(_, setterName) => `set ${setterName}($$value)`,
	);
	sanitizedCode = sanitizedCode.replace(
		/customElements\.define\s*\(/g,
		"__pieDefineSafely(",
	);
	sanitizedCode = `${SAFE_DEFINE_HELPER}\n${sanitizedCode}`;

	writeFileSync(entry.generated, `// @ts-nocheck\n${sanitizedCode}`, "utf8");
	execFileSync(
		process.execPath,
		[
			"build",
			entry.generated,
			"--target=browser",
			"--format=esm",
			"--external=@pie-players/*",
			`--outfile=${entry.output}`,
		],
		{
			cwd: packageRoot,
			stdio: "pipe",
		},
	);
	rmSync(entry.generated, { force: true });
}

// Remove stale copied Svelte sources from older build strategy.
for (const staleFile of [
	"ItemToolBar.svelte",
	"PieAssessmentToolkit.svelte",
	"SectionToolBar.svelte",
]) {
	const stalePath = path.join(distComponents, staleFile);
	if (existsSync(stalePath)) {
		rmSync(stalePath);
	}
}

console.log(
	"[build-ce-components] built toolkit custom elements to dist/components",
);
