#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "svelte/compiler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const srcComponents = path.join(packageRoot, "src", "components");
const distComponents = path.join(packageRoot, "dist", "components");

mkdirSync(distComponents, { recursive: true });

const entries = [
	{
		source: path.join(srcComponents, "ItemToolBar.svelte"),
		output: path.join(distComponents, "ItemToolBar.custom-element.js"),
	},
	{
		source: path.join(srcComponents, "PieAssessmentToolkit.svelte"),
		output: path.join(distComponents, "PieAssessmentToolkit.custom-element.js"),
	},
];

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
	const sanitizedCode = compiled.js.code.replace(
		/set\s+([A-Za-z_$][\w$]*)\(\s*\$\$value\s*=\s*[^)]+\)/g,
		(_, setterName) => `set ${setterName}($$value)`,
	);

	writeFileSync(entry.output, `// @ts-nocheck\n${sanitizedCode}`, "utf8");
}

// Remove stale copied Svelte sources from older build strategy.
for (const staleFile of ["ItemToolBar.svelte", "PieAssessmentToolkit.svelte"]) {
	const stalePath = path.join(distComponents, staleFile);
	if (existsSync(stalePath)) {
		rmSync(stalePath);
	}
}

console.log("[build-ce-components] built toolkit custom elements to dist/components");
