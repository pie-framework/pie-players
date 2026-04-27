/**
 * Section runtime engine — public facade (M7 — Variant C, layered).
 *
 * The facade is the narrow, stable entry point hosts use to mount,
 * drive, and dispose a section runtime. It composes three layers
 * introduced in earlier M7 PRs:
 *
 *   - the **registry** (`RuntimeRegistry`) — registered item/passage
 *     shells in document order, used for canonical-id lookup;
 *   - the **adapter** (`SectionEngineAdapter`) — single I/O seam over
 *     the pure FSM core, fanning outputs to the DOM, framework-error
 *     bus, legacy events, instrumentation hook, and host subscribers;
 *   - the **resolver** (`resolveSectionEngineRuntimeState`) — the
 *     toolkit-side resolution helper that produces the effective
 *     runtime + tools snapshot a host feeds to the FSM core.
 *
 * **Two callsite generations.** During the M7 migration window the
 * facade carries two surface generations side-by-side:
 *
 *   1. The **engine-side** surface (`attachHost`, `dispatchInput`,
 *      `subscribe`, `getState`, `getEffectiveRuntime`,
 *      `setInstrumentationHook`). This is what the kernel and the
 *      `pie-assessment-toolkit` CE will switch onto in M7 PR 5 and
 *      PR 6. Construction is lazy: `attachHost(...)` builds the
 *      adapter on first call, with the supplied host element,
 *      framework-error bus, and (optional) coordinator. After
 *      construction, host re-attachments (e.g. cohort change with a
 *      new layout shell) update the adapter's host element via
 *      `setHost(...)`.
 *
 *   2. The **legacy controller-side** surface (`initialize`,
 *      `register`, `unregister`, `handleContent*`, `updateItemSession`,
 *      `navigateToItem`, `persist`, `hydrate`, `dispose`). The
 *      `PieAssessmentToolkit.svelte` CE still drives the seed via this
 *      surface in PR 3 — observable behavior is identical to pre-PR 3.
 *      PR 6 deletes the toolkit's reliance on this surface; PR 7
 *      removes the methods that the engine FSM has fully absorbed.
 *
 * The two surfaces share `RuntimeRegistry` (the only piece both
 * generations consult) and the resolved `SectionControllerHandle` the
 * legacy generation holds inline. The adapter holds its own
 * `coordinator-bridge` independently — the legacy `initialize(...)` and
 * the engine-side `dispatchInput({ kind: "initialize" })` do **not**
 * fight over the coordinator because PR 3 only activates one of them
 * per host (legacy from the toolkit CE, engine-side from the PR 5+
 * tests and the kernel/toolkit switches).
 *
 * **Why the legacy surface stays.** The plan's PR-3 acceptance criterion
 * is "existing toolkit tests still pass; no section-player or toolkit
 * CE code changes yet" — so PR 3 cannot delete the controller-side
 * methods. PR 6 (toolkit switch) and PR 7 (rip-out) will remove them
 * once the engine surface is the only consumer.
 */

import type { ToolkitCoordinator } from "../services/ToolkitCoordinator.js";
import type { FrameworkErrorReporter } from "../services/framework-error-bus.js";
import type {
	SectionControllerEvent,
	SectionControllerHandle,
} from "../services/section-controller-types.js";
import {
	SectionEngineAdapter,
	type SectionEngineAdapterOptions,
} from "./adapter/SectionEngineAdapter.js";
import type { InstrumentationHook } from "./adapter/instrumentation-bridge.js";
import type { EngineOutputListener } from "./adapter/subscriber-fanout.js";
import type { SectionEngineInput } from "./core/engine-input.js";
import type { SectionEngineOutput } from "./core/engine-output.js";
import {
	resolveSectionEngineRuntimeState,
	type EffectiveRuntime,
	type RuntimeInputs,
} from "./core/engine-resolver.js";
import {
	createInitialEngineState,
	type SectionEngineState,
} from "./core/engine-state.js";
import type { RuntimeRegistrationDetail } from "./registration-events.js";
import { RuntimeRegistry } from "./RuntimeRegistry.js";
import { createRuntimeId } from "./runtime-id.js";

/**
 * Structural view of the resolved section controller, widened with the
 * extra methods the toolkit's runtime CE calls directly. Optional so
 * stub controllers used in tests do not need every entry point.
 */
interface RuntimeController extends SectionControllerHandle {
	getCompositionModel?: () => unknown;
	getCanonicalItemId?: (itemId: string) => string;
	handleContentLoaded?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
		timestamp?: number;
	}) => void;
	handleContentRegistered?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}) => void;
	handleContentUnregistered?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}) => void;
	handleItemPlayerError?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
		timestamp?: number;
	}) => void;
	reportSectionError?: (args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}) => void;
	updateItemSession?: (
		itemId: string,
		sessionDetail: unknown,
	) => { eventDetail?: unknown } | null;
	subscribe?: (listener: (event: SectionControllerEvent) => void) => () => void;
	navigateToItem?: (index: number) => unknown;
}

/**
 * Legacy initialize args. Pre-PR 6 callers (the toolkit CE) drive the
 * coordinator + section controller through this method. PR 6 will
 * delete this in favor of the engine-side `attachHost` +
 * `dispatchInput({ kind: "initialize" })` flow.
 */
interface EngineInitArgs {
	coordinator: ToolkitCoordinator;
	section: unknown;
	sectionId: string;
	assessmentId: string;
	view: string;
	attemptId?: string;
	createDefaultController: () => Promise<RuntimeController> | RuntimeController;
	onCompositionChanged?: (composition: unknown) => void;
}

/**
 * Engine-side `attachHost` args. The host element, framework-error bus,
 * and `sourceCe` together let the adapter dispatch DOM events and bus
 * fan-outs identically to the legacy kernel emit chain.
 */
export interface SectionRuntimeEngineHostArgs {
	host: EventTarget;
	sourceCe: string;
	frameworkErrorBus: FrameworkErrorReporter;
	coordinator?: SectionEngineAdapterOptions["coordinator"];
	instrumentationHook?: InstrumentationHook;
	now?: () => string;
}

export class SectionRuntimeEngine {
	private readonly registry = new RuntimeRegistry();
	private readonly runtimeId = createRuntimeId("section-engine");

	// Engine-side state (PR 3+).
	private adapter: SectionEngineAdapter | null = null;

	// Legacy controller-side state (until PR 6).
	private controller: RuntimeController | null = null;
	private coordinator: ToolkitCoordinator | null = null;
	private sectionId = "";
	private attemptId: string | undefined;
	private unsubscribeController: (() => void) | null = null;
	private activeInitToken = 0;

	// ============================================================
	// Engine-side surface (PR 3+; driven by the kernel from PR 5,
	// by the toolkit CE from PR 6, and by the facade smoke test today).
	// ============================================================

	/**
	 * Attach the host element + framework-error bus + sourceCe so the
	 * adapter can dispatch DOM events and bus errors. Required before
	 * `dispatchInput` / `subscribe` produce observable effects.
	 *
	 * Constructs the adapter on the first call. Subsequent calls keep
	 * the adapter and update its host element / instrumentation hook
	 * (used by layout-shell rollovers and instrumentation reconfig).
	 */
	attachHost(args: SectionRuntimeEngineHostArgs): void {
		if (this.adapter) {
			this.adapter.setHost(args.host);
			if (args.instrumentationHook !== undefined) {
				this.adapter.setInstrumentationHook(args.instrumentationHook);
			}
			return;
		}
		this.adapter = new SectionEngineAdapter({
			host: args.host,
			runtimeId: this.runtimeId,
			sourceCe: args.sourceCe,
			frameworkErrorBus: args.frameworkErrorBus,
			coordinator: args.coordinator,
			instrumentationHook: args.instrumentationHook,
			now: args.now,
		});
	}

	/**
	 * Forward a host-constructed input to the FSM core via the adapter.
	 * Returns the outputs the transition produced (subscribers and the
	 * DOM/legacy/framework-error/instrumentation bridges have already
	 * received them).
	 *
	 * No-op (returns `[]`) before `attachHost(...)` so callers that
	 * dispatch optimistically during teardown do not throw.
	 */
	dispatchInput(input: SectionEngineInput): readonly SectionEngineOutput[] {
		return this.adapter?.dispatchInput(input) ?? [];
	}

	/**
	 * Subscribe to batched engine outputs (one batch per
	 * `dispatchInput`). Returns an idempotent disposer. Pre-`attachHost`
	 * subscriptions return a no-op disposer so callers can wire
	 * subscriptions early without lifecycle-ordering hazards.
	 */
	subscribe(listener: EngineOutputListener): () => void {
		return this.adapter?.subscribe(listener) ?? noopDispose;
	}

	/**
	 * Read-only snapshot of the FSM state. Returns the initial idle
	 * state before `attachHost` so callers can probe state without
	 * special-casing the pre-attach phase.
	 */
	getState(): Readonly<SectionEngineState> {
		return this.adapter?.getState() ?? createInitialEngineState();
	}

	/**
	 * Resolve the effective runtime + tools snapshot for the given
	 * two-tier inputs. This is a pure function over the resolver — it
	 * does not depend on adapter state — so callers can use it both
	 * pre- and post-`attachHost`. The kernel uses it to seed
	 * `dispatchInput({ kind: "initialize", effectiveRuntime, ... })`.
	 */
	getEffectiveRuntime<P>(
		args: RuntimeInputs,
		deps: {
			resolvePlayerRuntime: (resolverArgs: {
				effectiveRuntime: Record<string, unknown>;
				playerType: string;
				env: Record<string, unknown> | null;
			}) => P;
		},
	): EffectiveRuntime {
		return resolveSectionEngineRuntimeState(args, deps).effectiveRuntime;
	}

	/**
	 * Update the adapter's instrumentation hook. No-op pre-attach.
	 * Hosts that always want a hook should pass it via `attachHost`.
	 */
	setInstrumentationHook(hook: InstrumentationHook | undefined): void {
		this.adapter?.setInstrumentationHook(hook);
	}

	/**
	 * Stable per-engine runtime id used to scope DOM-event details and
	 * registry telemetry. Exposed so tests and instrumentation can pin
	 * the value the bridges emit.
	 */
	getRuntimeId(): string {
		return this.runtimeId;
	}

	// ============================================================
	// Legacy controller-side surface (kept until PR 6; behavior
	// identical to pre-PR 3).
	// ============================================================

	async initialize(args: EngineInitArgs): Promise<void> {
		this.activeInitToken += 1;
		const token = this.activeInitToken;
		this.coordinator = args.coordinator;
		this.sectionId = args.sectionId;
		this.attemptId = args.attemptId;

		const resolved = (await args.coordinator.getOrCreateSectionController({
			sectionId: args.sectionId,
			attemptId: args.attemptId,
			input: {
				section: args.section,
				sectionId: args.sectionId,
				assessmentId: args.assessmentId,
				view: args.view,
			},
			updateExisting: true,
			createDefaultController: args.createDefaultController,
		})) as RuntimeController;

		if (token !== this.activeInitToken) return;
		this.unsubscribeController?.();
		this.controller = resolved;
		args.onCompositionChanged?.(resolved.getCompositionModel?.());
		this.unsubscribeController =
			resolved.subscribe?.(() => {
				args.onCompositionChanged?.(resolved.getCompositionModel?.());
			}) || null;
	}

	register(detail: RuntimeRegistrationDetail): boolean {
		return this.registry.register(detail);
	}

	unregister(element: HTMLElement): boolean {
		return this.registry.unregister(element);
	}

	getCompositionModel(): unknown {
		return this.controller?.getCompositionModel?.() ?? null;
	}

	getCanonicalItemId(itemId: string): string {
		const map = this.registry.getCanonicalIdMap();
		return map[itemId] || this.controller?.getCanonicalItemId?.(itemId) || itemId;
	}

	handleContentRegistered(detail: RuntimeRegistrationDetail): void {
		this.controller?.handleContentRegistered?.({
			itemId: detail.itemId,
			canonicalItemId: detail.canonicalItemId || detail.itemId,
			contentKind: detail.contentKind || detail.kind,
		});
	}

	handleContentUnregistered(detail: RuntimeRegistrationDetail): void {
		this.controller?.handleContentUnregistered?.({
			itemId: detail.itemId,
			canonicalItemId: detail.canonicalItemId || detail.itemId,
			contentKind: detail.contentKind || detail.kind,
		});
	}

	handleContentLoaded(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
		timestamp?: number;
	}): void {
		this.controller?.handleContentLoaded?.(args);
	}

	handleItemPlayerError(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
		timestamp?: number;
	}): void {
		this.controller?.handleItemPlayerError?.(args);
	}

	reportSectionError(args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}): void {
		this.controller?.reportSectionError?.(args);
	}

	updateItemSession(itemId: string, session: unknown): unknown {
		const canonicalId = this.getCanonicalItemId(itemId);
		return this.controller?.updateItemSession?.(canonicalId, session) ?? null;
	}

	navigateToItem(index: number): unknown {
		return this.controller?.navigateToItem?.(index) ?? null;
	}

	async persist(): Promise<void> {
		await this.controller?.persist?.();
	}

	async hydrate(): Promise<void> {
		await this.controller?.hydrate?.();
	}

	getRegistry(): RuntimeRegistry {
		return this.registry;
	}

	async dispose(): Promise<void> {
		this.activeInitToken += 1;
		this.unsubscribeController?.();
		this.unsubscribeController = null;
		if (this.coordinator && this.sectionId) {
			await this.coordinator.disposeSectionController({
				sectionId: this.sectionId,
				attemptId: this.attemptId,
			});
		}
		this.registry.clear();
		this.controller = null;
		this.coordinator = null;
		// Tear down the engine-side adapter (if attached) last so any
		// `dispose` FSM input flows through the bridges before they
		// detach. Adapter disposal is idempotent and safe even when
		// nothing is attached.
		if (this.adapter) {
			const adapter = this.adapter;
			this.adapter = null;
			await adapter.dispose();
		}
	}
}

const noopDispose = (): void => {};
