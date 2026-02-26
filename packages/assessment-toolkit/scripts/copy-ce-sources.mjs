#!/usr/bin/env node

import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const srcComponents = path.join(packageRoot, "src", "components");
const distComponents = path.join(packageRoot, "dist", "components");

mkdirSync(distComponents, { recursive: true });

for (const fileName of ["ItemToolBar.svelte", "PieAssessmentToolkit.svelte"]) {
	cpSync(path.join(srcComponents, fileName), path.join(distComponents, fileName));
}

console.log("[copy-ce-sources] copied CE .svelte sources to dist/components");
