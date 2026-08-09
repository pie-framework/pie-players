import {
	PIE_REGISTER_EVENT,
	PIE_UNREGISTER_EVENT,
	dispatchCrossBoundaryEvent,
	type RuntimeRegistrationDetail,
} from "@pie-players/pie-assessment-toolkit";

/**
 * Registration dispatch for the item and passage shells.
 *
 * Registration is a statement of fact to the runtime, and the runtime takes it
 * literally: a `pie-register` makes the toolkit unregister and re-register the
 * content's accessibility catalogs, re-run `sectionEngine.register`, and
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
};

/**
 * `item` by identity rather than by content. The churn being guarded against
 * re-applies the same object, which identity catches; a genuinely new item
 * object means content whose catalogs may differ, which has to register again.
 * Deep-comparing an item on every parent render would cost more than the
 * registration it saves.
 */
function sameIdentity(
	a: ShellRegistrationIdentity,
	b: ShellRegistrationIdentity,
): boolean {
	return (
		a.kind === b.kind &&
		a.host === b.host &&
		a.itemId === b.itemId &&
		a.canonicalItemId === b.canonicalItemId &&
		a.contentKind === b.contentKind &&
		a.item === b.item
	);
}

function dispatch(
	eventName: string,
	identity: ShellRegistrationIdentity,
): void {
	const detail: RuntimeRegistrationDetail = {
		kind: identity.kind,
		itemId: identity.itemId,
		canonicalItemId: identity.canonicalItemId,
		contentKind: identity.contentKind,
		item: identity.item,
		element: identity.host,
	};
	dispatchCrossBoundaryEvent(identity.host, eventName, detail);
}

export type ShellRegistrationDispatcher = {
	/**
	 * Announce `identity` if it says anything new, and retire the live
	 * registration when there is nothing left to describe — a shell without a host
	 * or an id no longer stands for content, and leaving its registration behind
	 * would strand it in the runtime.
	 *
	 * Never dispatches `pie-unregister` before a re-register: both registration
	 * paths in the toolkit are keyed by element and replace what is there, so the
	 * unregister only ever created the gap.
	 */
	sync: (identity: ShellRegistrationIdentity | null) => void;
	/**
	 * Retire the live registration, replaying the identity it was made under
	 * rather than whatever the props say now — by the time a registration is
	 * retired the props may already describe its replacement, and unregistering
	 * under the new identity would leave the old one live.
	 *
	 * Belongs in a teardown that runs on teardown only. Attaching it to an effect
	 * that re-runs on prop changes is what made the churn.
	 */
	retire: () => void;
};

export function createShellRegistrationDispatcher(): ShellRegistrationDispatcher {
	/**
	 * What the runtime was last told. Deliberately not reactive: it is read to
	 * decide whether to dispatch, and making it reactive would put that decision
	 * inside the graph it exists to keep quiet.
	 */
	let dispatched: ShellRegistrationIdentity | null = null;

	function retire(): void {
		const previous = dispatched;
		if (!previous) return;
		dispatched = null;
		dispatch(PIE_UNREGISTER_EVENT, previous);
	}

	function sync(identity: ShellRegistrationIdentity | null): void {
		if (!identity) {
			retire();
			return;
		}
		if (dispatched && sameIdentity(dispatched, identity)) return;
		dispatched = identity;
		dispatch(PIE_REGISTER_EVENT, identity);
	}

	return { sync, retire };
}
