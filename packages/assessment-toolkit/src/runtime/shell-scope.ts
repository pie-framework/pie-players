import {
	ContextProvider,
	type ContextType,
	type UnknownContext,
} from "@pie-players/pie-context";
import {
	type AssessmentToolkitHostRuntimeContext,
	type AssessmentToolkitRegionScopeContext,
	type AssessmentToolkitShellContext,
	assessmentToolkitRegionScopeContext,
	assessmentToolkitShellContext,
	type ShellContextKind,
} from "../context/assessment-toolkit-context.js";
import type { ItemSettings } from "@pie-players/pie-players-shared/types";
import {
	type CatalogSourceEntity,
	catalogSourceSignature,
} from "../services/catalog-owner.js";
import type { TTSHighlightTargetResolver } from "../services/tts/highlight-target-resolver.js";
import { PIE_INTERNAL_CONTENT_LOADED_EVENT } from "./registration-events.js";
import {
	createShellRegistrationDispatcher,
	type ShellRegistrationIdentity,
	type ShellRuntimeAddress,
	shellEventTarget,
} from "./shell-registration.js";
import {
	connectHostRuntimeContext,
	dispatchCrossBoundaryEvent,
} from "./tool-host-contract.js";

/** What a shell says about the content it holds. */
export interface ShellScopeState {
	/** The shell element: it provides the contexts and dispatches the registration. */
	host: HTMLElement;
	kind: ShellContextKind;
	itemId: string;
	canonicalItemId?: string;
	contentKind: string;
	regionPolicy?: string;
	/** The region the shell's tools act on; the shell itself when unset. */
	scopeElement?: HTMLElement | null;
	ttsHighlightTargetResolver?: TTSHighlightTargetResolver | null;
	item?: unknown;
	/** An item's policy settings, registered with the runtime alongside it. */
	settings?: ItemSettings | null;
}

export interface ShellScope {
	/**
	 * Publishes `state`, or withdraws the scope when there is none. A state that
	 * says nothing new publishes nothing.
	 */
	publish: (state: ShellScopeState | null) => void;
	/**
	 * Retires the runtime registration under the identity it was made with.
	 * Teardown only, after anything that still has to reach the runtime.
	 */
	retire: () => void;
	/** Stops providing the contexts, and drops the events `send` holds. */
	disconnect: () => void;
	/**
	 * Dispatches `type` from the shell host with the id of the runtime that
	 * answered the scope in its detail, so that runtime claims it by id. Once
	 * the host has left the document, as in a teardown, the event is dispatched
	 * on the runtime's element instead, which the scope captured when the
	 * runtime answered. Events sent before a runtime has answered, or while the
	 * runtime's element is out of the document and the host is in it, are held,
	 * the newest {@link MAX_HELD_SHELL_EVENTS}, and delivered in order to the
	 * runtime that answers next. `disconnect` and `publish(null)` drop them.
	 */
	send: (type: string, detail: object) => void;
}

/**
 * The newest events kept until a runtime answers; an older one is dropped. A
 * scope in plain mode sends only load and error events, a section shell its
 * session events too.
 */
const MAX_HELD_SHELL_EVENTS = 50;

type Provided<C extends UnknownContext> = {
	provider: ContextProvider<C>;
	value: ContextType<C>;
};

function provide<C extends UnknownContext>(
	host: HTMLElement,
	context: C,
	value: ContextType<C>,
): Provided<C> {
	const provider = new ContextProvider(host, { context, initialValue: value });
	provider.connect();
	return { provider, value };
}

function republish<C extends UnknownContext>(
	provided: Provided<C>,
	value: ContextType<C>,
	same: (a: ContextType<C>, b: ContextType<C>) => boolean,
): void {
	if (same(provided.value, value)) return;
	provided.value = value;
	provided.provider.setValue(value);
}

const sameItem = (
	a: unknown,
	b: unknown,
	kind: ShellContextKind,
): boolean => {
	if (a === b) return true;
	if (!a || !b) return false;
	if ((a as { id?: unknown }).id !== (b as { id?: unknown }).id) return false;
	const catalogs = catalogSourceSignature(a as CatalogSourceEntity, kind);
	return (
		catalogs !== null &&
		catalogs === catalogSourceSignature(b as CatalogSourceEntity, kind)
	);
};

const sameShellContext = (
	a: AssessmentToolkitShellContext,
	b: AssessmentToolkitShellContext,
): boolean =>
	a.kind === b.kind &&
	a.itemId === b.itemId &&
	a.canonicalItemId === b.canonicalItemId &&
	a.contentKind === b.contentKind &&
	a.regionPolicy === b.regionPolicy &&
	a.scopeElement === b.scopeElement &&
	sameItem(a.item, b.item, a.kind);

const sameRegionScope = (
	a: AssessmentToolkitRegionScopeContext,
	b: AssessmentToolkitRegionScopeContext,
): boolean =>
	a.scopeElement === b.scopeElement &&
	a.ttsHighlightTargetResolver === b.ttsHighlightTargetResolver;

const setAttributeIfChanged = (
	host: HTMLElement,
	name: string,
	value: string,
): void => {
	if (host.getAttribute(name) !== value) host.setAttribute(name, value);
};

/**
 * A shell's publication of its content: the identity, as the shell context the
 * tools inside it read, the region they act on, as the region scope, and the
 * content itself, registered with the runtime, which files its accessibility
 * catalogs under it. The section player's item and passage shells and
 * `<pie-item-scope>` all publish through this, so a tool resolves its target
 * and its catalogs the same way inside any of them.
 *
 * Content republished unchanged arrives as a new object, the composition being
 * deep reactive state, so items compare by id and catalogs, the measure the
 * registration applies.
 *
 * The registration waits for the runtime the shell sits in to answer through
 * `assessmentToolkitHostRuntimeContext`, and carries that runtime's id, which
 * the runtime claims it by. A shell mounted before its toolkit, which a host
 * composing the elements itself can do, would otherwise register with no one
 * listening, and nothing replays a registration. The document's context root
 * replays the request instead, once the toolkit's provider connects. A
 * different runtime answering later, a nearer toolkit taking over, moves the
 * registration: the old runtime is told to unregister by its id, and the new
 * one gets the registration and the content's last load, which only the old
 * one heard.
 */
export function createShellScope(): ShellScope {
	const registration = createShellRegistrationDispatcher();
	const contextVersion = Date.now();
	let host: HTMLElement | null = null;
	let shell: Provided<typeof assessmentToolkitShellContext> | null = null;
	let region: Provided<typeof assessmentToolkitRegionScopeContext> | null =
		null;
	let stopFindingRuntime: (() => void) | null = null;
	let runtime: ShellRuntimeAddress | null = null;
	let identity: ShellRegistrationIdentity | null = null;
	let held: Array<{ type: string; detail: object }> = [];
	let loaded: object | null = null;

	const syncRegistration = () => {
		if (runtime !== null) registration.sync(identity, runtime);
	};

	// A runtime element that left the document while the shell stays in it no
	// longer sits above the shell, so nothing would claim the shell's events.
	const runtimeDeparted = (
		shellHost: HTMLElement,
		address: ShellRuntimeAddress,
	): boolean =>
		shellHost.isConnected &&
		(address.eventTarget as Node).isConnected === false;

	function send(type: string, detail: object): void {
		if (type === PIE_INTERNAL_CONTENT_LOADED_EVENT) loaded = detail;
		if (host && runtime !== null && !runtimeDeparted(host, runtime)) {
			dispatchCrossBoundaryEvent(shellEventTarget(host, runtime), type, {
				...detail,
				runtimeId: runtime.runtimeId,
			});
			return;
		}
		held.push({ type, detail });
		if (held.length > MAX_HELD_SHELL_EVENTS) held.shift();
	}

	// The subscription re-answers whenever the runtime republishes its context:
	// under the same id it only delivers what the scope held meanwhile.
	function onRuntime(value: AssessmentToolkitHostRuntimeContext): void {
		const moved = runtime !== null && value.runtimeId !== runtime.runtimeId;
		if (value.runtimeId !== runtime?.runtimeId) {
			runtime = { runtimeId: value.runtimeId, eventTarget: value.eventTarget };
			syncRegistration();
		}
		const pending = held;
		held = [];
		for (const event of pending) send(event.type, event.detail);
		const replayed = pending.some(
			(event) => event.type === PIE_INTERNAL_CONTENT_LOADED_EVENT,
		);
		if (moved && loaded && !replayed) {
			send(PIE_INTERNAL_CONTENT_LOADED_EVENT, loaded);
		}
	}

	function disconnect(): void {
		for (const provided of [shell, region]) provided?.provider.disconnect();
		stopFindingRuntime?.();
		stopFindingRuntime = null;
		runtime = null;
		held = [];
		loaded = null;
		identity = null;
		shell = null;
		region = null;
		host = null;
	}

	function publish(state: ShellScopeState | null): void {
		if (!state) {
			registration.sync(null);
			disconnect();
			return;
		}
		if (state.host !== host) disconnect();
		host = state.host;
		const canonicalItemId = state.canonicalItemId || state.itemId;
		const regionPolicy = state.regionPolicy || "default";
		const scopeElement = state.scopeElement || state.host;

		const shellValue: AssessmentToolkitShellContext = {
			kind: state.kind,
			itemId: state.itemId,
			canonicalItemId,
			contentKind: state.contentKind,
			regionPolicy,
			scopeElement,
			item: state.item ?? null,
			contextVersion,
		};
		if (shell) republish(shell, shellValue, sameShellContext);
		else shell = provide(host, assessmentToolkitShellContext, shellValue);

		const regionValue: AssessmentToolkitRegionScopeContext = {
			scopeElement,
			ttsHighlightTargetResolver: state.ttsHighlightTargetResolver ?? null,
		};
		if (region) republish(region, regionValue, sameRegionScope);
		else
			region = provide(host, assessmentToolkitRegionScopeContext, regionValue);

		setAttributeIfChanged(host, "data-item-id", state.itemId);
		setAttributeIfChanged(host, "data-canonical-item-id", canonicalItemId);
		setAttributeIfChanged(host, "data-pie-shell-root", state.kind);
		setAttributeIfChanged(host, "data-region-policy", regionPolicy);

		const previousIdentity = identity;
		identity = state.itemId
			? {
					kind: state.kind,
					host,
					itemId: state.itemId,
					canonicalItemId,
					contentKind: state.contentKind,
					item: state.item ?? null,
					settings: state.settings ?? null,
				}
			: null;
		if (
			previousIdentity &&
			(previousIdentity.itemId !== identity?.itemId ||
				previousIdentity.canonicalItemId !== identity?.canonicalItemId)
		) {
			loaded = null;
		}
		// Answers at once when the runtime is already there.
		stopFindingRuntime ??= connectHostRuntimeContext(
			host,
			onRuntime,
		);
		syncRegistration();
	}

	return { publish, retire: registration.retire, disconnect, send };
}
