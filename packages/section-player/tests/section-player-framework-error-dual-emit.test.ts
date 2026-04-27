/**
 * `framework-error` dual-emit contract — layout CE host (M7 PR 7).
 *
 * **Why this test exists.** During the M7 migration window the layout
 * CE host (`<pie-section-player-vertical>`,
 * `<pie-section-player-split-pane>`, `<pie-section-player-tabbed>`) sees
 * two `framework-error` DOM events for one underlying error model:
 *
 *   1. The wrapped `<pie-assessment-toolkit>` dispatches its own
 *      `framework-error` with `bubbles: true, composed: true` (see
 *      `dispatchCrossBoundaryEvent` in
 *      `assessment-toolkit/src/runtime/tool-host-contract.ts`). That
 *      event bubbles through the section-player shell, base, and
 *      finally reaches the layout CE host as a normal cross-boundary
 *      `CustomEvent`.
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
 * Outside listeners on the layout CE host therefore see exactly **two**
 * `framework-error` events per error during the migration window. The
 * order is **engine-bridge first, bubbled toolkit second**: the kernel
 * listener fires mid-bubble at the inner base element and synchronously
 * dispatches the engine-bridge emit on the layout host before the
 * original event finishes bubbling up to the layout host.
 *
 * The `framework-error` bus, in contrast, fan-outs **once** per error:
 * the toolkit and the engine adapter share the same
 * `FrameworkErrorBus`, so the bus is the canonical single-fire surface.
 *
 * This test pins that contract — count, ordering, and detail equality —
 * so a future refactor that:
 *
 *   - silently collapses the bubbled toolkit emit (would drop legacy
 *     consumers that only listen on the inner toolkit), or
 *   - silently doubles the engine-bridge emit (would fan out three
 *     times), or
 *   - re-orders the two emits (some consumers rely on the engine-
 *     bridge emit arriving first to seed UI state before the bubbled
 *     emit triggers follow-up reads),
 *
 * fails the test with a clear, contract-shaped diff. When PR 8+
 * collapses the dual emit (likely via an idempotency latch on the
 * layout CE host), this test flips to assert the single canonical emit
 * — that flip is the documented exit criterion for the migration
 * window.
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
		source: "framework-error-dual-emit-test",
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

function bind(
	layoutHost: HTMLElement,
	bus: FrameworkErrorBus,
): Capture {
	const capture: Capture = { events: [], busHits: [] };
	layoutHost.addEventListener("framework-error", (event) => {
		const ce = event as CustomEvent<FrameworkErrorModel>;
		capture.events.push({
			detail: ce.detail,
			// `target` is the original dispatch source: the bubbled
			// toolkit emit reports the inner emitter; the engine-bridge
			// emit reports the layout CE host directly. We use this to
			// distinguish the two emits without relying on ordering
			// alone.
			targetIsLayoutHost: ce.target === layoutHost,
			// Cross-boundary semantics differ between the two emits:
			// the toolkit emit is `bubbles: true, composed: true`
			// (cross-shadow-DOM hop in production); the engine-bridge
			// emit is non-bubbling, non-composed because it is fired
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
 * intercepted *mid-bubble* at that inner element; the engine-bridge
 * emit is therefore synchronously dispatched on the layout CE host
 * before the original event finishes bubbling to the layout host.
 * Mirroring that placement here is what reproduces the canonical
 * "engine-bridge first, bubbled toolkit second" order.
 */
function attachKernelEquivalentListener(
	innerHost: HTMLElement,
	engine: SectionRuntimeEngine,
): () => void {
	function listener(event: Event) {
		const detail = (event as CustomEvent<FrameworkErrorModel>).detail;
		if (!detail) return;
		engine.dispatchInput({ kind: "framework-error", error: detail });
	}
	innerHost.addEventListener("framework-error", listener);
	return () => innerHost.removeEventListener("framework-error", listener);
}

describe("framework-error dual-emit contract on the layout CE host", () => {
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

		// Drain `initialize` outputs so the dual-emit assertion below
		// only counts `framework-error` emits.
		capture.events = [];
		capture.busHits = [];

		detachKernel = attachKernelEquivalentListener(baseEl, engine);
	});

	test("one framework-error model fan-outs as exactly two `framework-error` DOM events on the layout host", () => {
		const model = makeFrameworkError();

		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(2);
	});

	test("first emit observed on the layout host is the engine-bridge dispatch (target = layoutHost); second is the still-bubbling toolkit emit (target = toolkitHost)", () => {
		const model = makeFrameworkError();

		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events.map((e) => e.targetIsLayoutHost)).toEqual([
			true,
			false,
		]);
	});

	test("both emits carry the same FrameworkErrorModel reference", () => {
		const model = makeFrameworkError();

		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(2);
		expect(capture.events[0].detail).toBe(model);
		expect(capture.events[1].detail).toBe(model);
	});

	test("the framework-error bus fan-outs exactly once per error (canonical single-fire surface)", () => {
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

	test("two errors → four DOM emits (2 per error) and two bus hits — pairing is preserved across cohort lifetime", () => {
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

		expect(capture.events).toHaveLength(4);
		expect(capture.busHits).toHaveLength(2);
		expect(capture.events[0].detail).toBe(first);
		expect(capture.events[1].detail).toBe(first);
		expect(capture.events[2].detail).toBe(second);
		expect(capture.events[3].detail).toBe(second);
	});

	test("if the kernel listener detaches, only the bubbled toolkit emit reaches the layout host (engine bridge is no longer fed)", () => {
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
		expect(capture.events[0].targetIsLayoutHost).toBe(false);
		expect(capture.busHits).toHaveLength(0);
	});

	test("engine-bridge emit on the layout host is non-bubbling and non-composed; bubbled toolkit emit is bubbles/composed=true", () => {
		const model = makeFrameworkError();
		toolkitHost.dispatchEvent(
			new CustomEvent<FrameworkErrorModel>("framework-error", {
				detail: model,
				bubbles: true,
				composed: true,
				cancelable: false,
			}),
		);

		expect(capture.events).toHaveLength(2);
		// Order is engine-bridge first (target = layoutHost), bubbled
		// toolkit second (target = toolkitHost). The engine-bridge emit
		// is dispatched directly on the layout CE host with
		// `new CustomEvent("framework-error", { detail })` — no
		// `bubbles` or `composed` flags, defaults to `false`. The
		// toolkit emit propagates from inside the toolkit's shadow tree
		// and is therefore composed/bubbling.
		expect(capture.events[0]).toMatchObject({
			targetIsLayoutHost: true,
			bubbles: false,
			composed: false,
		});
		expect(capture.events[1]).toMatchObject({
			targetIsLayoutHost: false,
			bubbles: true,
			composed: true,
		});
	});

	test("kernel listener guards against an empty/undefined detail and does not feed the engine", () => {
		// `handleFrameworkError` short-circuits when `detail` is
		// missing (`if (!detail) return;`). Pin that early-return so
		// a future refactor that drops the guard fails this test
		// loudly — propagating an `undefined` model into the engine
		// would produce a malformed bus hit and a malformed second
		// DOM emit.
		toolkitHost.dispatchEvent(
			new CustomEvent("framework-error", {
				bubbles: true,
				composed: true,
				cancelable: false,
				// no `detail` → CustomEvent.detail === null
			}),
		);

		// The bubbled toolkit emit still reaches the layout host (1),
		// but the kernel's detail-guard prevents the second emit from
		// firing — so we see exactly one event and zero bus hits.
		expect(capture.events).toHaveLength(1);
		expect(capture.events[0].targetIsLayoutHost).toBe(false);
		expect(capture.busHits).toHaveLength(0);
	});
});

describe("framework-error dual-emit — engine lifecycle edge cases", () => {
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

	test("pre-`attachHost`: kernel re-feed via `engine.dispatchInput` is silently buffered and only the bubbled toolkit emit reaches the layout host", () => {
		// An engine whose host has not yet been attached cannot
		// dispatch DOM events — the engine queues outputs internally
		// (or no-ops, depending on implementation) until
		// `attachHost(...)` is called. This test pins that the
		// production layout host therefore observes exactly one
		// `framework-error` (the bubbled toolkit emit) before
		// attachHost.
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

		expect(capture.events).toHaveLength(1);
		expect(capture.events[0].targetIsLayoutHost).toBe(false);
		expect(capture.busHits).toHaveLength(0);

		detach();
	});

	test("post-`dispose`: the engine no longer fans out to the bus and no engine-bridge DOM emit fires; the bubbled toolkit emit is unaffected", () => {
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

		// After dispose: the engine ignores `dispatchInput`, so the
		// engine-bridge emit does not fire. The bubbled toolkit emit
		// is unrelated to the engine and still reaches the layout
		// host. The bus is also no longer populated.
		expect(capture.events).toHaveLength(1);
		expect(capture.events[0].targetIsLayoutHost).toBe(false);
		expect(capture.busHits).toHaveLength(0);

		detach();
	});
});

describe("framework-error dual-emit — kernel-source mirror", () => {
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

	test("kernel binds `handleFrameworkError` to the inner section-player-base scaffold, not directly to the layout CE host", () => {
		// The kernel passes `handleFrameworkError` to
		// `SectionPlayerLayoutScaffold` via the
		// `onFrameworkErrorEvent` prop; the scaffold then attaches the
		// listener to `<pie-section-player-base>` via Svelte's
		// `onframework-error={…}` syntax. Pinning this binding here
		// is what guarantees the replay topology
		// (layoutHost ▸ baseEl ▸ toolkitHost) matches reality and
		// preserves the canonical engine-bridge-first / bubbled-
		// second order.
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
