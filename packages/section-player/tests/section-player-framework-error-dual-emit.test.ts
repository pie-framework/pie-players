/**
 * `framework-error` single-emit contract — layout CE host.
 *
 * **Why this test exists.** Historically, the layout CE host
 * (`<pie-section-player-vertical>`, `<pie-section-player-split-pane>`,
 * `<pie-section-player-tabbed>`) saw **two** `framework-error` DOM
 * events for one underlying error model:
 *
 *   1. The wrapped `<pie-assessment-toolkit>` dispatches its own
 *      `framework-error` with `bubbles: true, composed: true` (see
 *      `dispatchCrossBoundaryEvent` in
 *      `assessment-toolkit/src/runtime/tool-host-contract.ts`). That
 *      event used to bubble through the section-player shell and
 *      base, finally reaching the layout CE host as a normal
 *      cross-boundary `CustomEvent`.
 *   2. The kernel's `handleFrameworkError` listener (attached on
 *      `<pie-section-player-base>` inside the layout's shadow tree —
 *      see `SectionPlayerLayoutScaffold.svelte` `onframework-error=…`)
 *      catches the bubbled event mid-bubble and re-feeds it into the
 *      section runtime engine via
 *      `engine.dispatchInput({ kind: "framework-error", error })`.
 *      The engine's `dom-event-bridge` then dispatches its own
 *      (non-bubbling) `framework-error` directly on the layout CE
 *      host. See
 *      `packages/section-player/src/components/shared/SectionPlayerLayoutKernel.svelte`
 *      `function handleFrameworkError(event: Event)` for the kernel
 *      side, and
 *      `packages/assessment-toolkit/src/runtime/adapter/dom-event-bridge.ts`
 *      `dispatchFrameworkError(...)` for the engine-bridge side.
 *
 * The dual-emit was removed in the broad architecture review compat
 * sweep. The kernel listener now calls `event.stopPropagation()` after
 * re-feeding the engine, so the bubbled toolkit emit no longer reaches
 * the layout CE host. The engine bridge's non-bubbling emit on the
 * layout host is the canonical, single-fire surface.
 *
 * Direct consumers of the toolkit's own emit (listeners attached to
 * `<pie-assessment-toolkit>` itself, or to elements between the
 * toolkit host and `<pie-section-player-base>`) are unaffected — the
 * toolkit dispatch reaches them before the kernel listener runs and
 * stops propagation.
 *
 * The `framework-error` bus also fan-outs **once** per error: the
 * toolkit and the engine adapter share the same `FrameworkErrorBus`,
 * so the bus is the canonical single-fire programmatic surface and
 * the layout-host DOM event is the canonical single-fire DOM surface.
 *
 * This test pins that contract — count, target, and detail equality —
 * so a future refactor that:
 *
 *   - silently re-introduces the bubbled toolkit emit on the layout
 *     host (would re-double the public DOM surface), or
 *   - silently doubles the engine-bridge emit (would fan out three
 *     times), or
 *   - drops the engine-bridge emit (would silence the canonical
 *     surface for hosts that listen for `framework-error`)
 *
 * fails the test with a clear, contract-shaped diff.
 *
 * The test does not mount a Svelte kernel; it replays the kernel's
 * exact `handleFrameworkError` logic against a real
 * `SectionRuntimeEngine` so a regression in either the kernel handler
 * or the engine's DOM-event bridge fails the same test. Behavioral
 * coverage of the engine + DOM-event bridge layer in isolation is in
 * `packages/assessment-toolkit/tests/runtime/SectionRuntimeEngine.test.ts`
 * and `packages/assessment-toolkit/tests/runtime/adapter/dom-event-bridge.test.ts`.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FrameworkErrorModel } from "@pie-players/pie-assessment-toolkit";
import { SectionRuntimeEngine } from "@pie-players/pie-assessment-toolkit/runtime/engine";
import { FrameworkErrorBus } from "@pie-players/pie-assessment-toolkit/runtime/internal";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const COHORT = { sectionId: "section-A", attemptId: "attempt-1" };
const STUB_RUNTIME = {
	onStageChange: undefined,
	onLoadingComplete: undefined,
} as never;
const STUB_TOOLS = { placement: {} } as never;

function makeFrameworkError(
	overrides: Partial<FrameworkErrorModel> = {},
): FrameworkErrorModel {
	return {
		kind: "tool-config",
		severity: "error",
		source: "framework-error-single-emit-test",
		message: "boom",
		details: [],
		recoverable: false,
		...overrides,
	};
}

interface CapturedEvent {
	detail: FrameworkErrorModel;
	targetIsLayoutHost: boolean;
	bubbles: boolean;
	composed: boolean;
}

interface Capture {
	events: CapturedEvent[];
	busHits: FrameworkErrorModel[];
}

function bind(layoutHost: HTMLElement, bus: FrameworkErrorBus): Capture {
	const capture: Capture = { events: [], busHits: [] };
	layoutHost.addEventListener("framework-error", (event) => {
		const ce = event as CustomEvent<FrameworkErrorModel>;
		capture.events.push({
			detail: ce.detail,
			// `target` is the original dispatch source: the engine-
			// bridge emit reports the layout CE host directly. After
			// the dual-emit collapse, this is the only emit observed
			// here — the bubbled toolkit emit is stopped at the
			// kernel listener and never reaches the layout host.
			targetIsLayoutHost: ce.target === layoutHost,
			// Cross-boundary semantics: the engine-bridge emit is
			// non-bubbling, non-composed because it is fired
			// directly on the layout CE host. Capturing both flags
			// pins the contract — a future change that flips either
			// value would silently change the consumer surface.
			bubbles: event.bubbles,
			composed: event.composed,
		});
	});
	bus.subscribeFrameworkErrors((model) => {
		capture.busHits.push(model);
	});
	return capture;
}

/**
 * Replay of `handleFrameworkError(event: Event)` from
 * `SectionPlayerLayoutKernel.svelte`. Kept here as a verbatim mirror
 * (no business-logic divergence) so a behavioral regression in the
 * kernel fails this test; the source-level assertion below pins the
 * mirror.
 *
 * In the real component the listener is attached on
 * `<pie-section-player-base>` (inside the layout CE's shadow tree) via
 * Svelte's `onframework-error={handleFrameworkError}` syntax in
 * `SectionPlayerLayoutScaffold.svelte`. The bubbled toolkit event is
 * intercepted *mid-bubble* at that inner element; the listener calls
 * `event.stopPropagation()` so the bubble does not continue to the
 * layout CE host. The engine-bridge emit is then synchronously
 * dispatched on the layout CE host as the single canonical emit.
 */
function attachKernelEquivalentListener(
	innerHost: HTMLElement,
	engine: SectionRuntimeEngine,
): () => void {
	function listener(event: Event) {
		const detail = (event as CustomEvent<FrameworkErrorModel>).detail;
		if (!detail) return;
		event.stopPropagation();
		engine.dispatchInput({ kind: "framework-error", error: detail });
	}
	innerHost.addEventListener("framework-error", listener);
	return () => innerHost.removeEventListener("framework-error", listener);
}

describe("framework-error single-emit contract on the layout CE host", () => {
	let layoutHost: HTMLElement;
	let baseEl: HTMLElement;
	let toolkitHost: HTMLElement;
	let engine: SectionRuntimeEngine;
	let bus: FrameworkErrorBus;
	let capture: Capture;
	let detachKernel: () => void;

	beforeEach(() => {
		// Topology mirrors the runtime DOM tree:
		//   layoutHost  ← `<pie-section-player-vertical>` (layout CE)
		//     └── baseEl       ← `<pie-section-player-base>` (kernel
		//                          attaches `framework-error` listener
		//                          here; see
		//                          `SectionPlayerLayoutScaffold.svelte`
		//                          `onframework-error=…`)
		//         └── toolkitHost  ← `<pie-assessment-toolkit>`
		//                            (dispatches the bubbled emit)
		layoutHost = document.createElement("div");
		layoutHost.setAttribute("data-role", "layout-ce-host");
		baseEl = document.createElement("div");
		baseEl.setAttribute("data-role", "section-player-base");
		toolkitHost = document.createElement("div");
		toolkitHost.setAttribute("data-role", "toolkit-host");
		baseEl.appendChild(toolkitHost);
		layoutHost.appendChild(baseEl);
		document.body.appendChild(layoutHost);

		engine = new SectionRuntimeEngine();
		bus = new FrameworkErrorBus();
		capture = bind(layoutHost, bus);

		engine.attachHost({
			host: layoutHost,
			sourceCe: "pie-section-player-vertical",
			frameworkErrorBus: bus,
		});
		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});

		// Drain `initialize` outputs so the assertion only counts
		// `framework-error` emits.
		capture.events = [];
		capture.busHits = [];

		detachKernel = attachKernelEquivalentListener(baseEl, engine);
	});

	test("one framework-error model fan-outs as exactly one `framework-error` DOM event on the layout host (engine-bridge emit; bubbled toolkit emit is stopped at the kernel listener)", () => {
		const model = makeFrameworkError();

		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(1);
		expect(capture.events[0].targetIsLayoutHost).toBe(true);
		expect(capture.events[0].detail).toBe(model);
	});

	test("the layout-host emit is non-bubbling and non-composed (it is the engine-bridge dispatch fired directly on the layout host)", () => {
		const model = makeFrameworkError();

		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(1);
		expect(capture.events[0]).toMatchObject({
			targetIsLayoutHost: true,
			bubbles: false,
			composed: false,
		});
	});

	test("the framework-error bus fan-outs exactly once per error (canonical single-fire programmatic surface)", () => {
		const model = makeFrameworkError();

		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.busHits).toHaveLength(1);
		expect(capture.busHits[0]).toBe(model);
	});

	test("two errors → two DOM emits and two bus hits (one per error, never doubled)", () => {
		const first = makeFrameworkError({ message: "first" });
		const second = makeFrameworkError({ message: "second" });

		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: first,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);
		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: second,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(2);
		expect(capture.busHits).toHaveLength(2);
		expect(capture.events[0].detail).toBe(first);
		expect(capture.events[1].detail).toBe(second);
		// Both emits target the layout host directly — the bubbled
		// toolkit emit is stopped at the kernel listener, never
		// reaching the layout host.
		expect(capture.events.map((e) => e.targetIsLayoutHost)).toEqual([
			true,
			true,
		]);
	});

	test("if the kernel listener detaches, the bubbled toolkit emit reaches the layout host (no propagation stop, no engine re-feed) and the bus is silent", () => {
		detachKernel();

		const model = makeFrameworkError();
		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(1);
		// The bubbled toolkit emit reaches the layout host; its
		// `target` is the toolkit host, not the layout host.
		expect(capture.events[0].targetIsLayoutHost).toBe(false);
		expect(capture.busHits).toHaveLength(0);
	});

	test("direct listeners on the toolkit host still see the toolkit's own emit (the kernel's `stopPropagation` only halts further bubbling)", () => {
		const toolkitDirect: CapturedEvent[] = [];
		toolkitHost.addEventListener("framework-error", (event) => {
			const ce = event as CustomEvent<FrameworkErrorModel>;
			toolkitDirect.push({
				detail: ce.detail,
				targetIsLayoutHost: ce.target === layoutHost,
				bubbles: event.bubbles,
				composed: event.composed,
			});
		});

		const model = makeFrameworkError();
		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(toolkitDirect).toHaveLength(1);
		expect(toolkitDirect[0].targetIsLayoutHost).toBe(false);
		expect(toolkitDirect[0].detail).toBe(model);
	});

	test("kernel listener guards against an empty/undefined detail and does not feed the engine (and does not stop propagation, so the bubbled emit still reaches the layout host)", () => {
		// `handleFrameworkError` short-circuits when `detail` is
		// missing (`if (!detail) return;`). Pin that early-return so
		// a future refactor that drops the guard fails this test
		// loudly — propagating an `undefined` model into the engine
		// would produce a malformed bus hit and a malformed second
		// DOM emit. With no detail, the kernel does not call
		// `stopPropagation`, so the bubbled toolkit emit still
		// reaches the layout host (and the test has 0 bus hits, as
		// the engine was never fed).
		toolkitHost.dispatchEvent(
			new CustomEvent("framework-error", {
				bubbles: true,
				composed: true,
				cancelable: false,
				// no `detail` → CustomEvent.detail === null
			}),
		);

		expect(capture.events).toHaveLength(1);
		expect(capture.events[0].targetIsLayoutHost).toBe(false);
		expect(capture.busHits).toHaveLength(0);
	});
});

describe("framework-error single-emit — engine lifecycle edge cases", () => {
	let layoutHost: HTMLElement;
	let baseEl: HTMLElement;
	let toolkitHost: HTMLElement;
	let bus: FrameworkErrorBus;
	let capture: Capture;

	beforeEach(() => {
		layoutHost = document.createElement("div");
		baseEl = document.createElement("div");
		toolkitHost = document.createElement("div");
		baseEl.appendChild(toolkitHost);
		layoutHost.appendChild(baseEl);
		document.body.appendChild(layoutHost);
		bus = new FrameworkErrorBus();
		capture = bind(layoutHost, bus);
	});

	test("pre-`attachHost`: kernel re-feed via `engine.dispatchInput` is silently buffered; the bubbled toolkit emit is stopped at the kernel listener so the layout host sees zero emits and zero bus hits", () => {
		// An engine whose host has not yet been attached cannot
		// dispatch DOM events — the engine queues outputs internally
		// (or no-ops, depending on implementation) until
		// `attachHost(...)` is called. The kernel listener still calls
		// `stopPropagation` on the bubbled toolkit emit, so the layout
		// host sees nothing while the engine is not yet attached.
		const engine = new SectionRuntimeEngine();
		const detach = attachKernelEquivalentListener(baseEl, engine);

		const model = makeFrameworkError({ message: "pre-attach" });
		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(0);
		expect(capture.busHits).toHaveLength(0);

		detach();
	});

	test("post-`dispose`: the engine no longer fans out to the bus and no engine-bridge DOM emit fires; the kernel listener still stops the bubbled emit so the layout host sees zero emits", () => {
		const engine = new SectionRuntimeEngine();
		engine.attachHost({
			host: layoutHost,
			sourceCe: "pie-section-player-vertical",
			frameworkErrorBus: bus,
		});
		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		const detach = attachKernelEquivalentListener(baseEl, engine);

		// Drain `initialize` outputs so the assertion only counts the
		// post-dispose `framework-error` round-trip.
		capture.events = [];
		capture.busHits = [];

		engine.dispose();

		const model = makeFrameworkError({ message: "post-dispose" });
		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(0);
		expect(capture.busHits).toHaveLength(0);

		detach();
	});
});

describe("framework-error single-emit — kernel-source mirror", () => {
	const KERNEL_PATH = resolve(
		__dirname,
		"../src/components/shared/SectionPlayerLayoutKernel.svelte",
	);

	test("kernel `handleFrameworkError` re-feeds the bubbled detail into the engine via `engine.dispatchInput`", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		// Mirror invariants for the listener replayed in
		// `attachKernelEquivalentListener`. If the kernel grows extra
		// pre-dispatch logic (filtering, throttling, transformation)
		// the replay above would diverge silently — this guard fails
		// loudly so the replay is updated alongside the kernel.
		expect(source).toMatch(/function\s+handleFrameworkError\s*\(/);
		expect(source).toContain(
			'engine.dispatchInput({ kind: "framework-error", error: detail });',
		);
	});

	test("kernel `handleFrameworkError` calls `event.stopPropagation()` to collapse the layout-host dual-emit to a single canonical engine-bridge emit", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		// Pin the propagation-stop so a future refactor that drops it
		// (and silently re-introduces the dual-emit) fails this
		// guard. The exact line is intentional — it must run on the
		// guarded path (after the `!detail` early return) so the
		// kernel does not stop propagation for malformed events.
		expect(source).toContain("event.stopPropagation();");
	});

	test("kernel binds `handleFrameworkError` to the inner section-player-base scaffold, not directly to the layout CE host", () => {
		// The kernel passes `handleFrameworkError` to
		// `SectionPlayerLayoutScaffold` via the
		// `onFrameworkErrorEvent` prop; the scaffold then attaches the
		// listener to `<pie-section-player-base>` via Svelte's
		// `onframework-error={…}` syntax. Pinning this binding here
		// is what guarantees the replay topology
		// (layoutHost ▸ baseEl ▸ toolkitHost) matches reality and
		// preserves the kernel-listener interception point.
		const source = readFileSync(KERNEL_PATH, "utf8");
		expect(source).toMatch(
			/onFrameworkErrorEvent\s*=\s*\{\s*handleFrameworkError\s*\}/,
		);
		const scaffoldPath = resolve(
			__dirname,
			"../src/components/shared/SectionPlayerLayoutScaffold.svelte",
		);
		const scaffold = readFileSync(scaffoldPath, "utf8");
		expect(scaffold).toMatch(
			/onframework-error\s*=\s*\{\s*handleFrameworkError\s*\}/,
		);
	});
});
