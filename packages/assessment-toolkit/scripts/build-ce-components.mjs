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

// Copy vendor bundles from their canonical source in @pie-players/pie-players-shared
// into dist/components/vendor/ so that the local import path the bundler sees
// (after the string rewrite below) resolves at bun-bundle time.
// @pie-players/pie-players-shared is marked --external in the bun build call, so
// we can't let the import of that package make it into the final bundle as-is;
// rewriting it to a local path before bundling ensures the file gets inlined.
const vendorDist = path.join(distComponents, "vendor", "nds");
const sharedVendorSrc = path.resolve(
	packageRoot,
	"node_modules/@pie-players/pie-players-shared/dist/vendor/nds/nds-icon-button.js",
);
mkdirSync(vendorDist, { recursive: true });
cpSync(sharedVendorSrc, path.join(vendorDist, "nds-icon-button.js"));

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
	// Rewrite the players-shared vendor import to a local path so bun inlines
	// it despite --external=@pie-players/*. The file was copied above.
	sanitizedCode = sanitizedCode.replace(
		/import\s+['"]@pie-players\/pie-players-shared\/vendor\/nds\/nds-icon-button['"]\s*;?/g,
		"import './vendor/nds/nds-icon-button.js';",
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
