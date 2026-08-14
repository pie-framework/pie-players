import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import registry from "../src/token-registry.json" with { type: "json" };

const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const mode = process.argv.includes("--write") ? "write" : "check";

function renderParticipationSource(): string {
	const values = Object.fromEntries(
		registry.map((entry) => [entry.name, entry.schemeParticipation]),
	);
	const renderedValues = JSON.stringify(values, null, "\t").replace(
		/\n}$/,
		",\n}",
	);
	return `/* Generated from token-registry.json by scripts/generate-theme-css.ts. */

import type { PieThemeSchemeParticipation } from "./token-registry-types.js";
import type { ThemeTokenName } from "./theme-types.js";

export const PIE_THEME_SCHEME_PARTICIPATION = ${renderedValues} as const satisfies Readonly<
	Record<ThemeTokenName, PieThemeSchemeParticipation>
>;
`;
}

async function updateOrCheck(relativePath: string, expected: string) {
	const absolutePath = path.join(packageRoot, relativePath);
	let actual = "";
	try {
		actual = await readFile(absolutePath, "utf8");
	} catch {
		// A missing generated artifact is the same kind of staleness as old bytes.
	}
	if (actual === expected) return true;
	if (mode === "write") {
		await writeFile(absolutePath, expected);
		console.log(`[pie-theme] wrote ${relativePath}`);
		return true;
	}
	console.error(
		`[pie-theme] ${relativePath} is stale; run \`bun run generate:css\`.`,
	);
	return false;
}

const participationCurrent = await updateOrCheck(
	"src/scheme-participation.ts",
	renderParticipationSource(),
);

// In write mode the participation module has been updated before this import,
// so built-in completeness validation reads the same metadata as the JSON.
if (!participationCurrent) process.exitCode = 1;
else {
	const { renderPieThemeCss } = await import("../src/theme-css.js");
	const rendered = renderPieThemeCss();
	const results = await Promise.all([
		updateOrCheck("src/tokens.css", rendered.tokensCss),
		updateOrCheck("src/color-schemes.css", rendered.colorSchemesCss),
	]);
	if (results.some((result) => !result)) process.exitCode = 1;
}
