import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(currentDir, "..", "src");

function extractPieKeysFromCss(content) {
	return new Set(
		[...content.matchAll(/(--pie-[a-z0-9-]+)\s*:/gi)].map((match) => match[1]),
	);
}

function extractFunctionContent(source, functionName) {
	const start = source.indexOf(`export function ${functionName}`);
	if (start === -1) {
		throw new Error(`Function not found: ${functionName}`);
	}
	const nextExport = source.indexOf("\nexport function ", start + 1);
	return source.slice(start, nextExport === -1 ? undefined : nextExport);
}

function extractPieKeysFromMapperFunction(source, functionName) {
	const functionContent = extractFunctionContent(source, functionName);
	return new Set(
		[...functionContent.matchAll(/"--pie-[a-z0-9-]+"/gi)].map((match) =>
			match[0].slice(1, -1),
		),
	);
}

function sortSet(set) {
	return [...set].sort();
}

test("bridge.css and JS mappers expose the same PIE key set", () => {
	const bridgeCss = readFileSync(resolve(srcDir, "bridge.css"), "utf8");
	const indexTs = readFileSync(resolve(srcDir, "index.ts"), "utf8");

	const cssKeys = extractPieKeysFromCss(bridgeCss);
	const mapDaisyKeys = extractPieKeysFromMapperFunction(
		indexTs,
		"mapDaisyThemeToPieVariables",
	);
	const mapResolvedKeys = extractPieKeysFromMapperFunction(
		indexTs,
		"mapResolvedDaisyThemeToPieVariables",
	);

	assert.deepEqual(sortSet(mapDaisyKeys), sortSet(mapResolvedKeys));
	assert.deepEqual(sortSet(cssKeys), sortSet(mapDaisyKeys));
});
