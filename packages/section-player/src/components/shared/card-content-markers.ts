/**
 * Classes a capability asks a content card to put on the container above its
 * content, and the two-halves check that decides whether it may.
 *
 * A host slot like `content-media`, not a capability: this module names no
 * capability, no support id and no catalog type, and reaches whatever registered
 * on the surface below through `getToolsBySurface`. What it adds over the media
 * surface is that nothing is mounted — the content is already rendered by the
 * item or passage player, and the only thing a host can do for content it does
 * not own is mark the box around it.
 *
 * Availability is the same pair as a docked alternate: policy granted a support
 * id *and* the capability found authored content. The one difference is that a
 * capability may declare `resolvesWithoutGrant`, which lets it answer from
 * content alone — for content authored as presentation, which no profile grants
 * and none revokes. Such a capability is still asked about the grant and still
 * decides for itself; the host learns only which classes to apply.
 *
 * Data-only so it can be unit-tested without a DOM; the cards own the reactive
 * wiring and the `class` attribute.
 */

import type {
	AccessibilityCatalogResolverApi,
	CatalogOwnerContext,
	ToolContentMarkerContext,
	ToolRegistration,
} from "@pie-players/pie-assessment-toolkit";

/**
 * What this module reads from a policy answer.
 *
 * Structural rather than the coordinator's own decision type, which is not part
 * of the toolkit's public surface — the same reason the media surface types its
 * decision through `ReturnType`.
 */
export interface ContentMarkerFeatureDecision {
	granted?: boolean;
	parameters?: unknown;
}

/**
 * Host slot for classes applied to a card's content container.
 *
 * Named for the relationship rather than for one card kind, because item cards
 * and passage cards open the same slot, exactly as they do for docked media.
 */
export const CONTENT_MARKER_SURFACE = "content-marker";

/**
 * Upper bound on classes one capability may contribute, so a bug in a capability
 * cannot grow the container's `class` attribute without limit.
 */
const MAX_MARKER_CLASSES_PER_CAPABILITY = 8;

export interface ContentMarkerArgs {
	/** Capabilities registered on {@link CONTENT_MARKER_SURFACE}. */
	tools: readonly ToolRegistration[];
	/** Policy answer for a support id, or `null` when there is no coordinator. */
	decideFeature: (supportId: string) => ContentMarkerFeatureDecision | null;
	catalogResolver: AccessibilityCatalogResolverApi | null;
	/** Owner scope for the catalog lookup, without `modelId`. */
	ownerContext: CatalogOwnerContext;
	/** The entity a capability resolves its authored content against. */
	entity: unknown;
}

/**
 * A single CSS class token.
 *
 * A value carrying whitespace is dropped rather than split: `classList.add`
 * throws on it, and a capability that means two classes should return two.
 */
const isClassToken = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0 && !/\s/.test(value);

/**
 * Classes to apply to the content container, deduplicated and ordered.
 *
 * Sorted rather than left in registration order so the result is a stable
 * signature: the cards compare it against the previous answer to decide whether
 * anything moved, and registration order is not something they control.
 */
export function resolveContentMarkerClasses(args: ContentMarkerArgs): string[] {
	const classes = new Set<string>();

	for (const tool of args.tools) {
		const marker = tool.markContent;
		if (!marker || typeof marker.resolve !== "function") continue;

		// A capability declares which support ids grant it; any one is enough.
		const supportIds = tool.pnpSupportIds?.length
			? tool.pnpSupportIds
			: [tool.toolId];
		let decision: ContentMarkerFeatureDecision | null = null;
		let featureId = "";
		for (const supportId of supportIds) {
			const candidate = args.decideFeature(supportId);
			if (candidate?.granted === true) {
				decision = candidate;
				featureId = supportId;
				break;
			}
		}
		const granted = decision !== null;
		// No grant ends it, unless the capability asked to be consulted anyway —
		// see `resolvesWithoutGrant`.
		if (!granted && !tool.resolvesWithoutGrant) continue;

		let content: unknown = null;
		if (tool.requiresAuthoredContent) {
			try {
				content = tool.requiresAuthoredContent.resolve({
					featureId,
					parameters: decision?.parameters,
					catalogResolver: args.catalogResolver,
					ownerContext: args.ownerContext,
					// Typed as an item by the contract, and a passage card passes its
					// passage: both are entities carrying content nodes, which is what a
					// capability resolves against.
					item: args.entity as ContentMarkerArgs["entity"] as never,
					granted,
				});
			} catch {
				// A capability that throws while looking for its content is absent, not
				// fatal to the card.
				content = null;
			}
			if (content === null || content === undefined) continue;
		} else if (!granted) {
			// Nothing to consult and nothing granted: there is no question left to
			// answer in the capability's favour.
			continue;
		}

		const context: ToolContentMarkerContext = {
			toolId: tool.toolId,
			featureId,
			surface: CONTENT_MARKER_SURFACE,
			parameters: decision?.parameters,
			content,
			granted,
		};
		let resolved: string[] | null = null;
		try {
			resolved = marker.resolve(context);
		} catch {
			// Same rule as content resolution: a throwing capability contributes
			// nothing rather than breaking the card.
			resolved = null;
		}
		if (!Array.isArray(resolved)) continue;
		for (const value of resolved.slice(0, MAX_MARKER_CLASSES_PER_CAPABILITY)) {
			if (isClassToken(value)) classes.add(value);
		}
	}

	return [...classes].sort();
}
