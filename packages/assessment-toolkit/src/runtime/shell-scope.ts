import {
	ContextProvider,
	ContextRoot,
	type ContextType,
	type UnknownContext,
} from "@pie-players/pie-context";
import {
	type AssessmentToolkitRegionScopeContext,
	type AssessmentToolkitShellContext,
	assessmentToolkitRegionScopeContext,
	assessmentToolkitShellContext,
	type ShellContextKind,
} from "../context/assessment-toolkit-context.js";
import { connectAssessmentToolkitHostRuntimeContext } from "../context/runtime-context-consumer.js";
import {
	type CatalogSourceEntity,
	catalogSourceSignature,
} from "../services/catalog-owner.js";
import type { TTSHighlightTargetResolver } from "../services/tts/highlight-target-resolver.js";
import {
	createShellRegistrationDispatcher,
	type ShellRegistrationIdentity,
} from "./shell-registration.js";

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
	/** Stops providing the contexts. */
	disconnect: () => void;
}

type Provided<C extends UnknownContext> = {
	provider: ContextProvider<C>;
	root: ContextRoot;
	value: ContextType<C>;
};

function provide<C extends UnknownContext>(
	host: HTMLElement,
	context: C,
	value: ContextType<C>,
): Provided<C> {
	const provider = new ContextProvider(host, { context, initialValue: value });
	provider.connect();
	const root = new ContextRoot(host);
	root.attach();
	return { provider, root, value };
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
 * `assessmentToolkitHostRuntimeContext`, the context the runtime claims a
 * registration by. A shell mounted before its toolkit, which a host composing
 * the elements itself can do, would otherwise register with no one listening,
 * and nothing replays a registration.
 */
export function createShellScope(): ShellScope {
	const registration = createShellRegistrationDispatcher();
	const contextVersion = Date.now();
	let host: HTMLElement | null = null;
	let shell: Provided<typeof assessmentToolkitShellContext> | null = null;
	let region: Provided<typeof assessmentToolkitRegionScopeContext> | null =
		null;
	let stopFindingRuntime: (() => void) | null = null;
	let runtimeFound = false;
	let identity: ShellRegistrationIdentity | null = null;

	const syncRegistration = () => {
		if (runtimeFound) registration.sync(identity);
	};

	function disconnect(): void {
		for (const provided of [shell, region]) {
			provided?.root.detach();
			provided?.provider.disconnect();
		}
		stopFindingRuntime?.();
		stopFindingRuntime = null;
		runtimeFound = false;
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

		identity = state.itemId
			? {
					kind: state.kind,
					host,
					itemId: state.itemId,
					canonicalItemId,
					contentKind: state.contentKind,
					item: state.item ?? null,
				}
			: null;
		// Answers at once when the runtime is already there.
		stopFindingRuntime ??= connectAssessmentToolkitHostRuntimeContext(
			host,
			() => {
				if (runtimeFound) return;
				runtimeFound = true;
				syncRegistration();
			},
		);
		syncRegistration();
	}

	return { publish, retire: registration.retire, disconnect };
}
