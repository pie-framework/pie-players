/**
 * Delivery cost of math-fact content in two pairs of shapes, under the
 * `esm` and `preloaded` strategies:
 *
 * - a run of questions as one-item sections (`sectionFromItem`): a fresh
 *   section player per question, with the host's coordinator or each player's
 *   own, against one long-lived player whose `section` the host replaces;
 * - a grid of 24 facts: 24 `math-inline` item players against one
 *   `math-templated` item with 24 response areas.
 *
 * The device is emulated, not real: Chromium at 4x CPU throttling with
 * Playwright's Galaxy Tab S4 viewport, scale factor and touch. Each case runs
 * `PERF_RUNS` times, each in a fresh browser context (cold HTTP cache) and then
 * on a second page of that context (warm cache). Heap and DOM counters are read
 * after a forced garbage collection. The report gives medians across runs and
 * goes to `test-results/delivery-cost/` beside the raw samples.
 *
 * `bun run perf:delivery-cost` builds and runs it; `-g` narrows the cases.
 * `PERF_RUNS`, `PERF_QUESTIONS` and `PERF_FACTS` change the sample sizes, and
 * `PERF_MATH_INLINE_VERSION` adds a remount case at that published version.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type BrowserContext,
	type CDPSession,
	devices,
	type Page,
	test,
} from "@playwright/test";

const RUNS = Number(process.env.PERF_RUNS || "5");
const QUESTIONS = Number(process.env.PERF_QUESTIONS || "20");
const FACTS = Number(process.env.PERF_FACTS || "24");
// A published math-inline version to measure beside the installed one (esm only).
const MATH_INLINE_VERSION = process.env.PERF_MATH_INLINE_VERSION;
const CPU_THROTTLE = 4;
const DEVICE = "Galaxy Tab S4";
const STRATEGIES = ["esm", "preloaded"] as const;
const RUN_SHAPES = ["remount", "remount-own", "replace"] as const;
const GRID_SHAPES = ["items", "templated"] as const;
const OUTPUT_DIR = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../test-results/delivery-cost",
);

const { defaultBrowserType: _browserType, ...TABLET } = devices[DEVICE];

type PerfWindow = Window & {
	__perf: {
		version: string;
		ready: Promise<number>;
		show(index: number): Promise<{ tti: number; at: number }>;
		teardown(): Promise<void>;
		responseSelector(index: number): string;
		keys(index: number): string;
		sessionChanges(): number;
		storageBytes(): number;
		interactive: Promise<number>;
		firstInteractive: Promise<number>;
	};
};

type Memory = { heap: number; nodes: number; listeners: number };

type Tally = {
	requests: number;
	network: number;
	transferred: number;
	decoded: number;
	failed: number;
	byOrigin: Record<string, { network: number; transferred: number }>;
};

type RequestRecord = {
	url: string;
	origin: string;
	fromCache: boolean;
	transferred: number;
	decoded: number;
	failed: boolean;
	done: boolean;
};

/** Every http(s) request of one page, in the order it was sent. */
class NetworkLog {
	private readonly records = new Map<string, RequestRecord>();
	private readonly order: string[] = [];

	static async attach(cdp: CDPSession): Promise<NetworkLog> {
		const log = new NetworkLog();
		const record = (id: string) => log.records.get(id);
		cdp.on("Network.requestWillBeSent", (event) => {
			const { url } = event.request;
			if (!/^https?:/.test(url) || log.records.has(event.requestId)) return;
			log.records.set(event.requestId, {
				url,
				origin: new URL(url).origin,
				fromCache: false,
				transferred: 0,
				decoded: 0,
				failed: false,
				done: false,
			});
			log.order.push(event.requestId);
		});
		cdp.on("Network.requestServedFromCache", (event) => {
			const entry = record(event.requestId);
			if (entry) entry.fromCache = true;
		});
		cdp.on("Network.responseReceived", (event) => {
			const entry = record(event.requestId);
			const { fromDiskCache, fromPrefetchCache, fromServiceWorker } =
				event.response;
			if (entry && (fromDiskCache || fromPrefetchCache || fromServiceWorker)) {
				entry.fromCache = true;
			}
		});
		cdp.on("Network.dataReceived", (event) => {
			const entry = record(event.requestId);
			if (entry) entry.decoded += event.dataLength;
		});
		cdp.on("Network.loadingFinished", (event) => {
			const entry = record(event.requestId);
			if (entry) {
				entry.transferred = event.encodedDataLength;
				entry.done = true;
			}
		});
		cdp.on("Network.loadingFailed", (event) => {
			const entry = record(event.requestId);
			if (entry) {
				entry.failed = true;
				entry.done = true;
			}
		});
		await cdp.send("Network.enable");
		return log;
	}

	mark(): number {
		return this.order.length;
	}

	/**
	 * Resolves once no request has been in flight for `quietMs`, so a tally
	 * counts what the page fetches as a consequence of a step (MathLive's fonts
	 * arrive after the field is interactive) rather than what had landed by then.
	 */
	async settled(quietMs = 1000, timeoutMs = 30_000): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		let quietSince = Date.now();
		while (Date.now() < deadline) {
			const busy = [...this.records.values()].some((entry) => !entry.done);
			if (busy) quietSince = Date.now();
			else if (Date.now() - quietSince >= quietMs) return;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	/** The requests that reached the network, largest first. */
	requests(from = 0, to = this.order.length): { url: string; transferred: number }[] {
		return this.order
			.slice(from, to)
			.map((id) => this.records.get(id) as RequestRecord)
			.filter((entry) => !entry.fromCache)
			.map(({ url, transferred }) => ({ url, transferred }))
			.sort((a, b) => b.transferred - a.transferred);
	}

	tally(from = 0, to = this.order.length): Tally {
		const tally: Tally = {
			requests: 0,
			network: 0,
			transferred: 0,
			decoded: 0,
			failed: 0,
			byOrigin: {},
		};
		for (const id of this.order.slice(from, to)) {
			const entry = this.records.get(id) as RequestRecord;
			tally.requests += 1;
			tally.decoded += entry.decoded;
			if (entry.failed) tally.failed += 1;
			if (entry.fromCache) continue;
			tally.network += 1;
			tally.transferred += entry.transferred;
			const origin = (tally.byOrigin[entry.origin] ??= {
				network: 0,
				transferred: 0,
			});
			origin.network += 1;
			origin.transferred += entry.transferred;
		}
		return tally;
	}
}

type Probe = {
	page: Page;
	cdp: CDPSession;
	network: NetworkLog;
	errors: string[];
};

async function openProbe(context: BrowserContext): Promise<Probe> {
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	const network = await NetworkLog.attach(cdp);
	await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	return { page, cdp, network, errors };
}

async function memory(cdp: CDPSession): Promise<Memory> {
	await cdp.send("HeapProfiler.collectGarbage");
	await cdp.send("HeapProfiler.collectGarbage");
	const { usedSize } = await cdp.send("Runtime.getHeapUsage");
	const { nodes, jsEventListeners } = await cdp.send("Memory.getDOMCounters");
	return { heap: usedSize, nodes, listeners: jsEventListeners };
}

type QuestionSample = Memory & { tti: number; answered: boolean };

type QuestionRunSample = {
	version: string;
	firstFromNavigation: number;
	questions: QuestionSample[];
	before: Memory;
	after: Memory;
	storageBytes: number;
	firstQuestion: Tally;
	firstQuestionRequests: { url: string; transferred: number }[];
	laterQuestions: Tally;
	errors: string[];
};

/** Types the fact's answer into question `index` and waits for its session change. */
async function answer(page: Page, index: number): Promise<boolean> {
	const { selector, keys, before } = await page.evaluate(
		(i) => ({
			selector: (window as PerfWindow).__perf.responseSelector(i),
			keys: (window as PerfWindow).__perf.keys(i),
			before: (window as PerfWindow).__perf.sessionChanges(),
		}),
		index,
	);
	const field = page.locator(selector);
	await field.click();
	try {
		// The editor takes focus a moment after the click; keys sent before it lands are lost.
		await field.evaluate(
			(element: HTMLElement & { hasFocus?(): boolean }) =>
				new Promise<void>((resolve, reject) => {
					const deadline = performance.now() + 15_000;
					const focused = () => {
						if (element.hasFocus) return element.hasFocus();
						let active = document.activeElement;
						while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
						return active !== null && element.contains(active);
					};
					const poll = () => {
						if (focused()) resolve();
						else if (performance.now() > deadline) reject(new Error("no focus"));
						else requestAnimationFrame(poll);
					};
					poll();
				}),
		);
		await field.pressSequentially(keys, { delay: 50 });
		await page.waitForFunction(
			(count) => (window as PerfWindow).__perf.sessionChanges() > count,
			before,
			{ timeout: 15_000 },
		);
		return true;
	} catch {
		return false;
	}
}

async function questionRun(
	probe: Probe,
	path: string,
): Promise<QuestionRunSample> {
	const { page, cdp, network } = probe;
	await page.goto(path, { waitUntil: "load" });
	await page.waitForFunction(() => Boolean((window as PerfWindow).__perf));
	const version = await page.evaluate(async () => {
		await (window as PerfWindow).__perf.ready;
		return (window as PerfWindow).__perf.version;
	});
	const before = await memory(cdp);
	const questions: QuestionSample[] = [];
	let firstFromNavigation = 0;
	let firstQuestionEnd = 0;
	for (let index = 0; index < QUESTIONS; index += 1) {
		const { tti, at } = await page.evaluate(
			(i) => (window as PerfWindow).__perf.show(i),
			index,
		);
		const answered = await answer(page, index);
		if (index === 0) {
			firstFromNavigation = at;
			await network.settled();
			firstQuestionEnd = network.mark();
		}
		questions.push({ tti, answered, ...(await memory(cdp)) });
	}
	const storageBytes = await page.evaluate(() =>
		(window as PerfWindow).__perf.storageBytes(),
	);
	await page.evaluate(() => (window as PerfWindow).__perf.teardown());
	const after = await memory(cdp);
	return {
		version,
		firstFromNavigation,
		questions,
		before,
		after,
		storageBytes,
		firstQuestion: network.tally(0, firstQuestionEnd),
		firstQuestionRequests: network.requests(0, firstQuestionEnd),
		laterQuestions: network.tally(firstQuestionEnd),
		errors: probe.errors,
	};
}

type GridSample = Memory & {
	version: string;
	firstFromNavigation: number;
	allFromNavigation: number;
	page: Tally;
	requests: { url: string; transferred: number }[];
	errors: string[];
};

async function gridRun(probe: Probe, path: string): Promise<GridSample> {
	const { page, cdp, network } = probe;
	await page.goto(path, { waitUntil: "load" });
	await page.waitForFunction(() => Boolean((window as PerfWindow).__perf));
	const timing = await page.evaluate(async () => {
		const perf = (window as PerfWindow).__perf;
		return {
			version: perf.version,
			firstFromNavigation: await perf.firstInteractive,
			allFromNavigation: await perf.interactive,
		};
	});
	await network.settled();
	return {
		...timing,
		...(await memory(cdp)),
		page: network.tally(),
		requests: network.requests(),
		errors: probe.errors,
	};
}

type Paired<T> = { run: number; cold: T; warm: T };

const results = {
	meta: {
		date: new Date().toISOString(),
		device: DEVICE,
		viewport: TABLET.viewport,
		cpuThrottle: CPU_THROTTLE,
		runs: RUNS,
		questions: QUESTIONS,
		facts: FACTS,
		browser: "",
		baseURL: "",
	},
	questionRun: {} as Record<string, Paired<QuestionRunSample>[]>,
	grid: {} as Record<string, Paired<GridSample>[]>,
};

/** Runs `measure` cold and then warm in each of `RUNS` fresh contexts. */
async function paired<T>(
	newContext: () => Promise<BrowserContext>,
	measure: (probe: Probe) => Promise<T>,
): Promise<Paired<T>[]> {
	const samples: Paired<T>[] = [];
	for (let run = 0; run < RUNS; run += 1) {
		const context = await newContext();
		const coldProbe = await openProbe(context);
		const cold = await measure(coldProbe);
		await coldProbe.page.close();
		const warm = await measure(await openProbe(context));
		await context.close();
		samples.push({ run, cold, warm });
	}
	return samples;
}

test.describe.configure({ mode: "serial" });

test.beforeEach(({ browser, baseURL }) => {
	results.meta.browser = `${browser.browserType().name()} ${browser.version()}`;
	results.meta.baseURL = baseURL ?? "";
});

if (MATH_INLINE_VERSION) {
	test(`question run: remount, esm, math-inline ${MATH_INLINE_VERSION}`, async ({
		browser,
		baseURL,
	}) => {
		const path = `/perf/question-run?player=esm&shape=remount&count=${QUESTIONS}&mathInlineVersion=${MATH_INLINE_VERSION}`;
		results.questionRun[`esm/remount, math-inline ${MATH_INLINE_VERSION}`] =
			await paired(
				() => browser.newContext({ ...TABLET, baseURL }),
				(probe) => questionRun(probe, path),
			);
	});
}

for (const strategy of STRATEGIES) {
	for (const shape of RUN_SHAPES) {
		test(`question run: ${shape}, ${strategy}`, async ({ browser, baseURL }) => {
			const path = `/perf/question-run?player=${strategy}&shape=${shape}&count=${QUESTIONS}`;
			results.questionRun[`${strategy}/${shape}`] = await paired(
				() => browser.newContext({ ...TABLET, baseURL }),
				(probe) => questionRun(probe, path),
			);
		});
	}
	for (const shape of GRID_SHAPES) {
		test(`fact grid: ${shape}, ${strategy}`, async ({ browser, baseURL }) => {
			const path = `/perf/fact-grid?player=${strategy}&shape=${shape}&count=${FACTS}`;
			results.grid[`${strategy}/${shape}`] = await paired(
				() => browser.newContext({ ...TABLET, baseURL }),
				(probe) => gridRun(probe, path),
			);
		});
	}
}

test.afterEach(() => {
	mkdirSync(OUTPUT_DIR, { recursive: true });
	writeFileSync(
		resolve(OUTPUT_DIR, "results.json"),
		`${JSON.stringify(results, null, 2)}\n`,
	);
	writeFileSync(resolve(OUTPUT_DIR, "report.md"), report());
});

test.afterAll(() => {
	console.log(`\n${report()}`);
});

function median(values: number[]): number {
	const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
	if (sorted.length === 0) return Number.NaN;
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2
		? sorted[middle]
		: (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Least-squares slope of `values` against their index. */
function slope(values: number[]): number {
	const n = values.length;
	if (n < 2) return Number.NaN;
	const meanX = (n - 1) / 2;
	const meanY = values.reduce((sum, value) => sum + value, 0) / n;
	let numerator = 0;
	let denominator = 0;
	values.forEach((value, x) => {
		numerator += (x - meanX) * (value - meanY);
		denominator += (x - meanX) ** 2;
	});
	return numerator / denominator;
}

const ms = (value: number) => `${Math.round(value)} ms`;
const s = (value: number) => `${(value / 1000).toFixed(2)} s`;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
const signedKb = (bytes: number) =>
	`${bytes >= 0 ? "+" : "−"}${Math.round(Math.abs(bytes) / 1024)} KB`;
const net = (requests: number, bytes: number) =>
	`${Math.round(requests)} / ${kb(bytes)}`;

function report(): string {
	const lines = [
		`# Delivery cost (${results.meta.date.slice(0, 10)})`,
		"",
		`${results.meta.browser}, ${CPU_THROTTLE}x CPU throttling, ${DEVICE} emulation (${TABLET.viewport.width}x${TABLET.viewport.height}, touch). Medians of ${RUNS} runs; heap and DOM counters after forced GC.`,
		"",
	];
	const runCases = Object.entries(results.questionRun);
	if (runCases.length > 0) {
		lines.push(
			`## Question run (${QUESTIONS} questions)`,
			"",
			"| Case | First question, from navigation | Later questions (median) | Heap after Q1 → last | Heap growth per question | Heap after teardown vs. Q1 | DOM nodes Q1 → last | Listeners Q1 → last | Answers registered |",
			"| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
		);
		for (const [name, samples] of runCases) {
			const cold = samples.map((sample) => sample.cold);
			const first = (sample: QuestionRunSample) => sample.questions[0];
			const last = (sample: QuestionRunSample) => sample.questions.at(-1) as QuestionSample;
			lines.push(
				`| ${name} | ${s(median(cold.map((x) => x.firstFromNavigation)))} | ${ms(median(cold.map((x) => median(x.questions.slice(1).map((q) => q.tti)))))} | ${mb(median(cold.map((x) => first(x).heap)))} → ${mb(median(cold.map((x) => last(x).heap)))} | ${signedKb(median(cold.map((x) => slope(x.questions.slice(1).map((q) => q.heap)))))} | ${signedKb(median(cold.map((x) => x.after.heap - first(x).heap)))} | ${Math.round(median(cold.map((x) => first(x).nodes)))} → ${Math.round(median(cold.map((x) => last(x).nodes)))} | ${Math.round(median(cold.map((x) => first(x).listeners)))} → ${Math.round(median(cold.map((x) => last(x).listeners)))} | ${median(cold.map((x) => x.questions.filter((q) => q.answered).length))}/${QUESTIONS} |`,
			);
		}
		lines.push(
			"",
			"Network, requests / transferred:",
			"",
			"| Case | First question, cold | Later questions, cold | First question, warm | Later questions, warm | Warm first question, later questions TTI | localStorage after run |",
			"| --- | --- | --- | --- | --- | --- | --- |",
		);
		for (const [name, samples] of runCases) {
			const cold = samples.map((sample) => sample.cold);
			const warm = samples.map((sample) => sample.warm);
			lines.push(
				`| ${name} | ${net(median(cold.map((x) => x.firstQuestion.network)), median(cold.map((x) => x.firstQuestion.transferred)))} | ${net(median(cold.map((x) => x.laterQuestions.network)), median(cold.map((x) => x.laterQuestions.transferred)))} | ${net(median(warm.map((x) => x.firstQuestion.network)), median(warm.map((x) => x.firstQuestion.transferred)))} | ${net(median(warm.map((x) => x.laterQuestions.network)), median(warm.map((x) => x.laterQuestions.transferred)))} | ${s(median(warm.map((x) => x.firstFromNavigation)))}, ${ms(median(warm.map((x) => median(x.questions.slice(1).map((q) => q.tti)))))} | ${kb(median(cold.map((x) => x.storageBytes)))} |`,
			);
		}
		lines.push("");
	}
	const gridCases = Object.entries(results.grid);
	if (gridCases.length > 0) {
		lines.push(
			`## Fact grid (${FACTS} facts)`,
			"",
			"| Case | First fact interactive | All facts interactive | Warm: all facts interactive | Heap | DOM nodes | Listeners | Cold: requests / transferred | Warm: requests / transferred |",
			"| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
		);
		for (const [name, samples] of gridCases) {
			const cold = samples.map((sample) => sample.cold);
			const warm = samples.map((sample) => sample.warm);
			lines.push(
				`| ${name} | ${s(median(cold.map((x) => x.firstFromNavigation)))} | ${s(median(cold.map((x) => x.allFromNavigation)))} | ${s(median(warm.map((x) => x.allFromNavigation)))} | ${mb(median(cold.map((x) => x.heap)))} | ${Math.round(median(cold.map((x) => x.nodes)))} | ${Math.round(median(cold.map((x) => x.listeners)))} | ${net(median(cold.map((x) => x.page.network)), median(cold.map((x) => x.page.transferred)))} | ${net(median(warm.map((x) => x.page.network)), median(warm.map((x) => x.page.transferred)))} |`,
			);
		}
		lines.push("");
	}
	const byOrigin: [string, Tally[]][] = [
		...runCases.map(
			([name, samples]) =>
				[`question run ${name}, first question`, samples.map((x) => x.cold.firstQuestion)] as [string, Tally[]],
		),
		...gridCases.map(
			([name, samples]) =>
				[`fact grid ${name}`, samples.map((x) => x.cold.page)] as [string, Tally[]],
		),
	];
	if (byOrigin.length > 0) {
		lines.push(
			"## Cold network by origin",
			"",
			"| Case | Origin | Requests / transferred |",
			"| --- | --- | --- |",
		);
		for (const [name, tallies] of byOrigin) {
			const origins = new Set(tallies.flatMap((tally) => Object.keys(tally.byOrigin)));
			for (const origin of origins) {
				const at = tallies.map((tally) => tally.byOrigin[origin] ?? { network: 0, transferred: 0 });
				const label = origin === new URL(String(results.meta.baseURL)).origin ? "page origin" : origin;
				lines.push(
					`| ${name} | ${label} | ${net(median(at.map((x) => x.network)), median(at.map((x) => x.transferred)))} |`,
				);
			}
		}
		lines.push("");
	}
	const versions = new Set(
		[...Object.values(results.questionRun), ...Object.values(results.grid)]
			.flat()
			.map((sample) => sample.cold.version),
	);
	lines.push(`Element versions: ${[...versions].join(", ")}.`, "");
	return `${lines.join("\n")}\n`;
}
