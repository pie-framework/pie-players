import {
	ContextProvider,
	FEATURE_DECISION_APPLIED_EVENT,
	type FeatureDecisionAppliedDetail,
	type ItemFeatureDecision,
	type ItemFeatureDecisions,
	itemFeatureDecisionsContext,
} from "@pie-players/pie-context";
import type { ToolScope } from "../policy/core/decision-types.js";
import type { ToolkitCoordinatorApi } from "../services/interfaces.js";

/** The feature ids an item player applies to its item's models. */
export const ITEM_PLAYER_FEATURE_IDS = ["autoplayAudio"] as const;

const NO_DECISIONS: ItemFeatureDecisions = Object.freeze({
	features: Object.freeze({}),
});

type DecidingCoordinator = Pick<
	ToolkitCoordinatorApi,
	"decideFeaturePolicy" | "onPolicyChange" | "reportFeatureDecisionApplied"
>;

/** The item a scope asks feature policy for. */
export interface ItemFeatureScopeIdentity {
	itemId: string;
	canonicalItemId?: string;
}

/**
 * The scope an item's feature decisions are asked with, which brings in the
 * item's registered settings; the same scope an item's content surfaces ask
 * with.
 */
export function itemFeatureScope(
	identity: ItemFeatureScopeIdentity,
): ToolScope {
	const canonicalItemId = identity.canonicalItemId || identity.itemId;
	return {
		level: "item",
		scopeId: canonicalItemId,
		itemId: identity.itemId,
		canonicalItemId,
	};
}

/**
 * The decisions an item player applies, leaving out each id no rule names. No
 * coordinator, or one predating feature decisions, decides nothing.
 */
export function resolveItemFeatureDecisions(
	coordinator: Pick<ToolkitCoordinatorApi, "decideFeaturePolicy"> | null,
	scope: ToolScope | null,
): ItemFeatureDecisions {
	if (!scope || typeof coordinator?.decideFeaturePolicy !== "function") {
		return NO_DECISIONS;
	}
	const features: Record<string, ItemFeatureDecision> = {};
	for (const featureId of ITEM_PLAYER_FEATURE_IDS) {
		const decision = coordinator.decideFeaturePolicy(featureId, scope);
		if (decision.rule === "none") continue;
		features[featureId] = { granted: decision.granted, rule: decision.rule };
	}
	return { features };
}

export interface ItemFeatureDecisionsProvider {
	/**
	 * The coordinator the scope's toolkit answered with; `null` until one has.
	 * The provider follows its policy changes, an item's settings registering
	 * among them.
	 */
	setCoordinator(coordinator: DecidingCoordinator | null): void;
	/** The scope's item; `null` while it has no item id. */
	setItem(identity: ItemFeatureScopeIdentity | null): void;
	disconnect(): void;
}

/**
 * Answers `itemFeatureDecisionsContext` for the item player under `host`, and
 * relays the player's `feature-decision-applied` to the coordinator.
 *
 * It answers with no decision until both a coordinator and an item are set, so
 * an item player under a scope no toolkit has answered keeps its own setting.
 * A value is republished only when a decision changed, since every new value
 * remounts the item.
 */
export function provideItemFeatureDecisions(
	host: HTMLElement,
): ItemFeatureDecisionsProvider {
	const provider = new ContextProvider(host, {
		context: itemFeatureDecisionsContext,
		initialValue: NO_DECISIONS,
	});
	provider.connect();
	let signature = JSON.stringify(NO_DECISIONS.features);
	let coordinator: DecidingCoordinator | null = null;
	let scope: ToolScope | null = null;
	let stopFollowingPolicy: (() => void) | null = null;

	const refresh = () => {
		const next = resolveItemFeatureDecisions(coordinator, scope);
		const nextSignature = JSON.stringify(next.features);
		if (nextSignature === signature) return;
		signature = nextSignature;
		provider.setValue(next);
	};

	const stopFollowing = () => {
		const stop = stopFollowingPolicy;
		stopFollowingPolicy = null;
		try {
			stop?.();
		} catch {
			// The coordinator may already have been disposed.
		}
	};

	const onApplied = (event: Event) => {
		const detail = (event as CustomEvent<FeatureDecisionAppliedDetail>).detail;
		if (!detail || !scope) return;
		coordinator?.reportFeatureDecisionApplied?.(detail, scope);
	};
	host.addEventListener(FEATURE_DECISION_APPLIED_EVENT, onApplied);

	return {
		setCoordinator(next) {
			if (next === coordinator) return;
			stopFollowing();
			coordinator = next;
			if (next && typeof next.onPolicyChange === "function") {
				stopFollowingPolicy = next.onPolicyChange((event) => {
					if (event.reason === "disposed") {
						stopFollowing();
						coordinator = null;
					}
					refresh();
				});
			}
			refresh();
		},
		setItem(identity) {
			const next = identity?.itemId ? itemFeatureScope(identity) : null;
			if (next?.scopeId === scope?.scopeId && next?.itemId === scope?.itemId) {
				return;
			}
			scope = next;
			refresh();
		},
		disconnect() {
			host.removeEventListener(FEATURE_DECISION_APPLIED_EVENT, onApplied);
			stopFollowing();
			coordinator = null;
			scope = null;
			provider.disconnect();
		},
	};
}
