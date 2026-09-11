import type { CalculatorType } from "@pie-players/pie-calculator";
import { describe, expect, test } from "bun:test";
import {
	CortexCalculatorError,
	type CortexCalculatorErrorCode,
} from "../src/errors.js";
import { evaluateLatex } from "../src/evaluation-engine.js";
import { resolveCortexSettings } from "../src/settings.js";
import type { WorkerEvaluationSettings } from "../src/worker-protocol.js";

/*
 * The corpus suite: one arithmetic corpus, four properties.
 *
 * `calculator-cortex-scenarios.test.ts` asserts hand-picked values, which is how
 * a capability gets pinned but not how volume gets covered — 127 authored cases
 * cannot say what happens to the ten-thousandth expression nobody thought of. This
 * file runs a real corpus instead, and asserts properties rather than values,
 * because a fixture of individual expectations at this size fails in ways nobody
 * can act on.
 *
 * The corpus is GSM8K's inline calculator annotations (see
 * `scripts/build-expression-corpus.mjs`): expression/result pairs authored to be
 * executed by a calculator, over `0-9 + - * / . ( )` alone, which is exactly basic
 * mode's capability set. 300 entries are committed; `CORTEX_CORPUS` points at the
 * full 10772 for a deeper run.
 *
 * Only property 2 uses the annotation's own value. The other three would hold
 * against any corpus at all, labelled or not — they are claims about this
 * package's layering, not about arithmetic, which is the Compute Engine's to get
 * right and not ours to re-verify.
 */

const DECLARED_CODES: readonly CortexCalculatorErrorCode[] = [
	"invalid-expression",
	"unsupported-expression",
	"expression-too-complex",
	"evaluation-timeout",
	"invalid-state",
	"worker-unavailable",
];

interface CorpusEntry {
	readonly latex: string;
	readonly expects: string;
}

const committed = new URL(
	"./fixtures/gsm8k-arithmetic.json",
	import.meta.url,
).pathname;
const corpusPath = process.env.CORTEX_CORPUS ?? committed;
const corpus: { entries: CorpusEntry[] } = await Bun.file(corpusPath).json();
const ENTRIES = corpus.entries;

function workerSettings(mode: CalculatorType): WorkerEvaluationSettings {
	const settings = resolveCortexSettings(mode);
	return {
		angleMode: settings.angleMode,
		calculationPrecision: settings.calculationPrecision,
		displayPrecision: settings.displayPrecision,
		evaluationTimeLimitMs: settings.evaluationTimeLimitMs,
		allowedFunctions: [...settings.allowedFunctions],
	};
}

type Outcome =
	| { readonly ok: true; readonly formatted: string }
	| { readonly ok: false; readonly code: string };

async function evaluate(
	mode: CalculatorType,
	latex: string,
): Promise<Outcome> {
	try {
		const result = await evaluateLatex(mode, latex, workerSettings(mode));
		return { ok: true, formatted: result.formatted };
	} catch (error) {
		if (error instanceof CortexCalculatorError) {
			return { ok: false, code: error.code };
		}
		/*
		 * Deliberately not rethrown. An unhandled throw reaching the worker is
		 * serialized into a generic failure, so the learner sees the calculator
		 * break with no message it chose — which is the defect this property is
		 * looking for. Naming it here reports the expression that caused it.
		 */
		return {
			ok: false,
			code: `undeclared:${(error as Error)?.name ?? typeof error} ${
				(error as Error)?.message ?? ""
			}`,
		};
	}
}

/*
 * Every entry is evaluated once per mode up front. Bun's `test` bodies cannot
 * share async work otherwise, and re-evaluating 300 expressions in each of four
 * properties would quadruple a suite that already dominates this package's
 * runtime.
 */
const MODES: readonly CalculatorType[] = ["basic", "scientific", "graphing"];
const outcomes = new Map<CalculatorType, Outcome[]>();
for (const mode of MODES) {
	outcomes.set(
		mode,
		await Promise.all(ENTRIES.map((entry) => evaluate(mode, entry.latex))),
	);
}
const basic = outcomes.get("basic") as Outcome[];

/** The corpus is worthless if the fixture silently emptied. */
test("the corpus is populated", () => {
	expect(ENTRIES.length).toBeGreaterThanOrEqual(300);
});

describe("every outcome is one this package declares", () => {
	test("no expression produces an undeclared failure", () => {
		const undeclared = ENTRIES.flatMap((entry, index) => {
			const failures = MODES.map((mode) => {
				const outcome = (outcomes.get(mode) as Outcome[])[index] as Outcome;
				return outcome.ok || DECLARED_CODES.includes(
					outcome.code as CortexCalculatorErrorCode,
				)
					? null
					: `${mode}: ${entry.latex} -> ${outcome.code}`;
			});
			return failures.filter((value): value is string => value !== null);
		});
		expect(undeclared).toEqual([]);
	});
});

describe("answers agree with the annotation", () => {
	test("every accepted expression matches its authored result", () => {
		/*
		 * Numerically, never by string. The annotations carry their author's
		 * formatting — `720.00` for currency, `.75` with a bare leading point — so a
		 * string comparison would fail on GSM8K's presentation rather than on this
		 * calculator's arithmetic. The tolerance is relative, because the corpus
		 * spans single digits to the hundreds of thousands.
		 */
		const wrong = ENTRIES.flatMap((entry, index) => {
			const outcome = basic[index] as Outcome;
			if (!outcome.ok) return [];
			const ours = Number(outcome.formatted);
			const authored = Number(entry.expects);
			const tolerance = Math.abs(authored) * 1e-9 + 1e-9;
			return Math.abs(ours - authored) <= tolerance
				? []
				: [`${entry.latex} = ${entry.expects}, we answer ${outcome.formatted}`];
		});
		expect(wrong).toEqual([]);
	});

	test("basic mode accepts the whole corpus", () => {
		/*
		 * Not a tautology with the property above, which is silent about a refusal.
		 * The corpus is `+ - * / ( ) .` and decimals only, so a refusal here means
		 * basic mode has lost a capability the PRD grants it — which is the shape of
		 * the `InvisibleOperator` and `Delimiter` defects, both of which refused
		 * ordinary input while every hand-written test still passed.
		 */
		const refused = ENTRIES.flatMap((entry, index) => {
			const outcome = basic[index] as Outcome;
			return outcome.ok ? [] : [`${entry.latex} -> ${outcome.code}`];
		});
		expect(refused).toEqual([]);
	});
});

describe("capability sets nest", () => {
	test("what basic accepts, scientific and graphing accept identically", () => {
		/*
		 * Scientific is basic plus powers, roots, logarithms, trigonometry, absolute
		 * value and factorial; graphing is scientific plus one free variable. Both
		 * are supersets by construction, so a mode that refuses what basic accepts —
		 * or answers it differently — is a resolution-order bug in
		 * `resolveCortexSettings`, not a policy decision. This property needs no
		 * authored answers, and would hold against any corpus.
		 */
		const divergent = ENTRIES.flatMap((entry, index) => {
			const reference = basic[index] as Outcome;
			if (!reference.ok) return [];
			return (["scientific", "graphing"] as const).flatMap((mode) => {
				const outcome = (outcomes.get(mode) as Outcome[])[index] as Outcome;
				if (!outcome.ok) return [`${mode} refused ${entry.latex}: ${outcome.code}`];
				return outcome.formatted === reference.formatted
					? []
					: [
							`${mode} answers ${entry.latex} as ${outcome.formatted}, basic as ${reference.formatted}`,
						];
			});
		});
		expect(divergent).toEqual([]);
	});
});

/*
 * One re-evaluation per accepted entry, so this scales with the corpus while every
 * property above reuses the outcomes computed once at load. 300 committed entries
 * finish well inside the floor; the full 10770 need minutes, which is the price of
 * an opt-in run and not a reason to sample away the coverage.
 */
const ROUND_TRIP_TIMEOUT_MS = Math.max(30_000, ENTRIES.length * 40);

describe("the formatter is stable", () => {
	test(
		"re-entering a displayed answer answers itself",
		() => {
			/*
			 * A learner reads an answer and types it into the next calculation, so the
			 * formatter's output has to be input this calculator accepts and re-answers
			 * unchanged. This catches an exponential form the parser cannot read back
			 * and a precision that loses a digit on the round trip — the latter being how
			 * a padded mantissa (`1.234567890e+13`) first showed up.
			 */
			const answers = ENTRIES.map((_, index) => basic[index] as Outcome)
				.filter((outcome): outcome is { ok: true; formatted: string } => outcome.ok)
				.map((outcome) => outcome.formatted);
			return Promise.all(
				answers.map(async (formatted) => {
					const again = await evaluate("basic", formatted);
					expect(again.ok && again.formatted, `re-entering ${formatted}`).toBe(
						formatted,
					);
				}),
			);
		},
		ROUND_TRIP_TIMEOUT_MS,
	);
});
