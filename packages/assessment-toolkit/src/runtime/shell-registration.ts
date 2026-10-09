import type { ItemSettings } from "@pie-players/pie-players-shared/types";
import {
	type CatalogSourceEntity,
	catalogSourceSignature,
} from "../services/catalog-owner.js";
import { structurallyEqual } from "../utils/structural-equality.js";
import {
	PIE_REGISTER_EVENT,
	PIE_UNREGISTER_EVENT,
	type RuntimeRegistrationDetail,
} from "./registration-events.js";
import { dispatchCrossBoundaryEvent } from "./tool-host-contract.js";

/**
 * Registration dispatch for the shells, through their shell scope.
 *
 * Registration is a statement of fact to the runtime, and the runtime takes it
 * literally: a `pie-register` makes the toolkit unregister and re-register the
 * content's accessibility catalogs, re-run `sectionBinding.register`, and
 * re-notify the section controller. Both shells used to dispatch it from the
 * same effect that attached their listeners, with `pie-unregister` in that
 * effect's cleanup — so every re-run announced a teardown and a rebuild of state
 * that had not moved, and between the two the content had no catalogs at all.
 *
 * Those effects re-run on prop changes, and a shell's props are re-applied
 * whenever its parent card's template updates. That made the dispatch the far
 * half of a cycle: a reader that re-renders in response to a catalog change
 * re-applies a shell's props, which re-registers, which changes catalogs again.
 * It shipped once at roughly a thousand rounds per item, ending in Svelte
 * abandoning the update at its depth limit with the DOM half-applied — and every
 * assertion about the rendered output passed while it was happening, because the
 * elements were all present.
 *
 * So the dispatcher keeps the last identity it announced and says nothing when
 * the next one matches.
 */
export type ShellRegistrationIdentity = {
	kind: "item" | "passage";
	host: HTMLElement;
	itemId: string;
	canonicalItemId: string;
	contentKind: string;
	item: unknown;
	/** The item's policy settings, compared structurally like its catalogs. */
	settings: ItemSettings | null;
};

/**
 * Everything a registration says except the item's catalogs.
 */
function sameOwner(
	a: ShellRegistrationIdentity,
	b: ShellRegistrationIdentity,
): boolean {
	return (
		a.kind === b.kind &&
		a.host === b.host &&
		a.itemId === b.itemId &&
		a.canonicalItemId === b.canonicalItemId &&
		a.contentKind === b.contentKind &&
		structurallyEqual(a.settings, b.settings)
	);
}

/**
 * The item's part of a registration is its catalogs, which is all the runtime
 * reads from it. Object identity is no guide: the toolkit and the layout kernel
 * hold the composition in deep reactive state, so every republish, each answer
 * included, hands a shell a new proxy of unchanged content.
 */
function catalogsOf(identity: ShellRegistrationIdentity): string | null {
	return catalogSourceSignature(
		identity.item as CatalogSourceEntity | null | undefined,
		identity.kind,
	);
}

/**
 * The runtime a registration is addressed to: its id, and the element it
 * listens on, which a shell whose host has left the document dispatches on.
 */
export type ShellRuntimeAddress = {
	runtimeId: string;
	eventTarget: EventTarget;
};

/**
 * Where a shell's event to `runtime` goes: from the shell host while it is in
 * the document, so the event bubbles through the tree like any other, and on
 * the runtime's own element once it is not.
 */
export function shellEventTarget(
	host: HTMLElement,
	runtime: ShellRuntimeAddress | undefined,
): EventTarget {
	return host.isConnected || !runtime ? host : runtime.eventTarget;
}

function dispatch(
	eventName: string,
	identity: ShellRegistrationIdentity,
	runtime: ShellRuntimeAddress | undefined,
): void {
	const detail: RuntimeRegistrationDetail = {
		kind: identity.kind,
		itemId: identity.itemId,
		canonicalItemId: identity.canonicalItemId,
		contentKind: identity.contentKind,
		item: identity.item,
		...(identity.settings ? { settings: identity.settings } : {}),
		element: identity.host,
		...(runtime ? { runtimeId: runtime.runtimeId } : {}),
	};
	dispatchCrossBoundaryEvent(
		shellEventTarget(identity.host, runtime),
		eventName,
		detail,
	);
}

export type ShellRegistrationDispatcher = {
	/**
	 * Announce `identity` if it says anything new, and retire the live
	 * registration when there is nothing left to describe — a shell without a host
	 * or an id no longer stands for content, and leaving its registration behind
	 * would strand it in the runtime.
	 *
	 * Never dispatches `pie-unregister` before a re-register to the same
	 * runtime: both registration paths in the toolkit are keyed by element and
	 * replace what is there, so the unregister only ever created the gap. A
	 * registration moving to a different runtime is retired first, addressed
	 * to the runtime that holds it.
	 */
	sync: (
		identity: ShellRegistrationIdentity | null,
		runtime?: ShellRuntimeAddress,
	) => void;
	/**
	 * Retire the live registration, replaying the identity and runtime it was
	 * made under rather than whatever the props say now — by the time a
	 * registration is retired the props may already describe its replacement,
	 * and unregistering under the new identity would leave the old one live.
	 * A host already out of the document retires on the runtime's element.
	 *
	 * Belongs in a teardown that runs on teardown only. Attaching it to an effect
	 * that re-runs on prop changes is what made the churn.
	 */
	retire: () => void;
};

export function createShellRegistrationDispatcher(): ShellRegistrationDispatcher {
	/**
	 * What the runtime was last told, and the catalogs it was told about.
	 * Deliberately not reactive: it is read to decide whether to dispatch, and
	 * making it reactive would put that decision inside the graph it exists to
	 * keep quiet.
	 */
	let dispatched: ShellRegistrationIdentity | null = null;
	let dispatchedCatalogs: string | null = null;
	let dispatchedRuntime: ShellRuntimeAddress | undefined;

	function retire(): void {
		const previous = dispatched;
		if (!previous) return;
		const previousRuntime = dispatchedRuntime;
		dispatched = null;
		dispatchedCatalogs = null;
		dispatchedRuntime = undefined;
		dispatch(PIE_UNREGISTER_EVENT, previous, previousRuntime);
	}

	function sync(
		identity: ShellRegistrationIdentity | null,
		runtime?: ShellRuntimeAddress,
	): void {
		if (!identity) {
			retire();
			return;
		}
		if (dispatched && dispatchedRuntime?.runtimeId !== runtime?.runtimeId) {
			retire();
		}
		if (dispatched && sameOwner(dispatched, identity)) {
			// A re-render re-applies the object last seen, so identity settles most
			// runs without serializing anything.
			if (dispatched.item === identity.item) return;
			const catalogs = catalogsOf(identity);
			if (catalogs !== null && catalogs === dispatchedCatalogs) {
				dispatched = identity;
				return;
			}
			dispatched = identity;
			dispatchedCatalogs = catalogs;
			dispatch(PIE_REGISTER_EVENT, identity, runtime);
			return;
		}
		dispatched = identity;
		dispatchedCatalogs = catalogsOf(identity);
		dispatchedRuntime = runtime;
		dispatch(PIE_REGISTER_EVENT, identity, runtime);
	}

	return { sync, retire };
}
