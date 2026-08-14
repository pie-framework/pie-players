import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { mapDaisyThemeToPieVariables } from "../dist/index.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const bridgeCss = readFileSync(
	resolve(currentDir, "..", "src", "bridge.css"),
	"utf8",
);

/** Whitespace in a `color-mix()` is formatting, not meaning. */
function normalizeExpression(value) {
	return value
		.replace(/\s+/g, " ")
		.replace(/\(\s+/g, "(")
		.replace(/\s+\)/g, ")")
		.replace(/\s*,\s*/g, ", ")
		.trim();
}

function declarationsFromCss(content) {
	const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
	const declarations = {};
	for (const match of withoutComments.matchAll(
		/(--pie-[a-z0-9-]+):\s*([^;]+);/gi,
	)) {
		declarations[match[1]] = normalizeExpression(match[2]);
	}
	return declarations;
}

/**
 * bridge.css cannot import the mapping table, so it is checked against it. Both
 * sides describe the same thing: every `--pie-*` token, the DaisyUI slot it comes
 * from, and the correction applied on the way. Comparing the whole expression
 * rather than the token names is deliberate — the names already matched while
 * `--pie-missing` pointed at `--color-error` in one copy and `--color-warning` in
 * another.
 */
test("bridge.css matches the shared DaisyUI mapping table", () => {
	// No caller-supplied tokens, so every value comes out as a `var()` reference
	// to DaisyUI's own variable: the same shape bridge.css is written in.
	const fromTable = Object.fromEntries(
		Object.entries(mapDaisyThemeToPieVariables({})).map(([token, value]) => [
			token,
			normalizeExpression(value),
		]),
	);
	const fromCss = declarationsFromCss(bridgeCss);

	assert.deepEqual(
		Object.keys(fromCss).sort(),
		Object.keys(fromTable).sort(),
		"bridge.css and the mapping table declare different tokens",
	);
	for (const [token, expected] of Object.entries(fromTable)) {
		assert.equal(
			fromCss[token],
			expected,
			`bridge.css derives ${token} differently from the mapping table`,
		);
	}
});

test("every feedback state resolves to a slot of its own", () => {
	// An unanswered question sharing a colour with a wrong one is the defect this
	// locks out; it survived because nothing compared the two states.
	const variables = mapDaisyThemeToPieVariables({});
	assert.notEqual(variables["--pie-missing"], variables["--pie-incorrect"]);
	assert.notEqual(variables["--pie-missing"], variables["--pie-correct"]);
	assert.notEqual(variables["--pie-incorrect"], variables["--pie-correct"]);
});
