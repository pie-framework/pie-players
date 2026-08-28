#!/usr/bin/env bun
/**
 * Builds the arithmetic corpus the property tests run against.
 *
 * The source is GSM8K (openai/grade-school-math, MIT). Its worked solutions carry
 * inline calculator annotations -- `<<48/2=24>>` -- authored so that a calculator
 * could execute the step, which makes them expression/result pairs rather than
 * word problems. 7473 problems yield 23716 annotations, 10772 of them distinct,
 * over the charset `0-9 + - * / . ( )` alone: arithmetic squarely inside basic
 * mode's capability set.
 *
 * The annotations are ground truth only up to the author's own formatting. Many
 * are written as currency (`720.00`) or with a bare leading point (`.75`), so the
 * tests compare numerically and never by string.
 *
 * Two outputs, because a corpus large enough to be interesting is too large to
 * review:
 *
 *   bun scripts/build-expression-corpus.mjs
 *       Rewrites the committed sample, `tests/fixtures/gsm8k-arithmetic.json`.
 *       Deterministic -- an evenly spaced stride over the sorted distinct
 *       annotations, no seed involved -- so regenerating it produces no diff
 *       unless the upstream data changed.
 *
 *   bun scripts/build-expression-corpus.mjs --full --out <path>
 *       Writes all 10772. Opt-in, never committed, and read by the tests only
 *       when CORTEX_CORPUS names it.
 */

const SOURCE =
	"https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/train.jsonl";
const SAMPLE_SIZE = 300;
const SAMPLE_PATH = new URL(
	"../tests/fixtures/gsm8k-arithmetic.json",
	import.meta.url,
);

const args = process.argv.slice(2);
const full = args.includes("--full");
const outFlag = args.indexOf("--out");
if (full && outFlag < 0) {
	console.error("--full requires --out <path>");
	process.exit(1);
}

process.stderr.write(`fetching ${SOURCE}\n`);
const response = await fetch(SOURCE);
if (!response.ok) {
	console.error(`fetch failed: ${response.status} ${response.statusText}`);
	process.exit(1);
}
const body = await response.text();

/** `<<expression=result>>`, rejecting any nested `<`, `>` or second `=`. */
const ANNOTATION = /<<([^<>=]+)=([^<>]*)>>/g;
/** Everything the corpus is allowed to contain. Anything else is a data change. */
const ALLOWED = /^[-0-9+*/(). ]+$/;
const DECIMAL = /^-?[0-9]*\.?[0-9]+$/;

/*
 * Some annotations are simply mistyped -- `180//3` and `560//10` are in the data
 * -- and a malformed expression tests the error path, not the arithmetic the
 * corpus exists to check. `*` and `/` are binary only, so each needs an operand
 * on both sides; `+` and `-` are left alone because unary forms of both are valid
 * and present (`+7`, `(-17)+43`, `2--3`).
 */
function wellFormed(source) {
	const compact = source.replace(/\s+/g, "");
	if (/[*/]{2,}/.test(compact)) return false;
	if (/(^|[-+*/(])[*/]/.test(compact)) return false;
	if (/[*/]([-+*/)]*$|[*/)])/.test(compact)) return false;
	let depth = 0;
	for (const character of compact) {
		if (character === "(") depth += 1;
		else if (character === ")" && --depth < 0) return false;
	}
	return depth === 0;
}

const distinct = new Map();
let total = 0;
let rejected = 0;
for (const line of body.split("\n")) {
	if (!line.trim()) continue;
	const { answer } = JSON.parse(line);
	for (const [, rawExpression, rawResult] of answer.matchAll(ANNOTATION)) {
		total += 1;
		const source = rawExpression.trim();
		const expects = rawResult.trim();
		if (!ALLOWED.test(source) || !DECIMAL.test(expects) || !wellFormed(source)) {
			rejected += 1;
			continue;
		}
		if (!distinct.has(source)) distinct.set(source, expects);
	}
}

/*
 * `*` becomes `\times` and `/` becomes `\div`, which is what this package's own
 * keypad emits. A learner typing `/` gets `\frac{a}{b}` from MathLive instead;
 * that path is covered by the typing sequences in the end-to-end suite, and
 * reproducing it here would mean parsing the infix expression to nest the
 * fractions correctly.
 */
const toLatex = (source) =>
	source.replace(/\*/g, "\\times ").replace(/\//g, "\\div ").trim();

const sorted = [...distinct.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
const chosen = full
	? sorted
	: Array.from({ length: Math.min(SAMPLE_SIZE, sorted.length) }, (_, index) => {
			const stride = sorted.length / Math.min(SAMPLE_SIZE, sorted.length);
			return sorted[Math.floor(index * stride)];
		});

const corpus = {
	source: SOURCE,
	license: "MIT (openai/grade-school-math)",
	annotations: total,
	distinct: sorted.length,
	entries: chosen.map(([source, expects]) => ({
		latex: toLatex(source),
		expects,
	})),
};

const target = full ? args[outFlag + 1] : SAMPLE_PATH;
await Bun.write(target, `${JSON.stringify(corpus, null, "\t")}\n`);
process.stderr.write(
	`${total} annotations, ${sorted.length} distinct, ${rejected} malformed or off-charset\n` +
		`wrote ${corpus.entries.length} entries to ${target}\n`,
);
