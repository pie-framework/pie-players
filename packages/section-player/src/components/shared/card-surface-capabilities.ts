/**
 * Which capabilities may fill a host surface on a content card, and what each of
 * them resolved.
 *
 * The two-halves check, in one place for every surface: policy granted one of the
 * capability's own support ids **and** its `requiresAuthoredContent` found
 * something on this entity. Neither half implies the other and neither is a
 * default, so a learner with an accommodation still sees nothing on the vast
 * majority of items.
 *
 * One capability kind is exempt from the first half. A capability declaring
 * `resolvesWithoutGrant` is consulted even when policy granted nothing, because
 * its content may declare itself *presentation* — authored to be delivered to
 * everyone, which no profile grants and none revokes. It still decides for
 * itself: `granted` on the dependency context is how it tells the two apart, and
 * it returns nothing for accommodation content with no grant.
 *
 * This module names no capability, no support id and no catalog type. Callers
 * hand it whatever `getToolsBySurface` returned.
 *
 * Data-only so it can be unit-tested without a DOM; the components own mounting
 * and the reactive wiring.
 */

import type {
	AccessibilityCatalogResolverApi,
	CatalogOwnerContext,
	ToolRegistration,
} from "@pie-players/pie-assessment-toolkit";

/**
 * What this module reads from a policy answer.
 *
 * Structural rather than the coordinator's own decision type, which is not part
 * of the toolkit's public surface.
 */
export interface SurfaceFeatureDecision {
	granted?: boolean;
	parameters?: unknown;
}

/** A capability cleared to render, with what it resolved. */
export interface GrantedSurfaceCapability {
	toolId: string;
	/** Support id policy granted, or `""` when the content stands alone. */
	featureId: string;
	parameters?: unknown;
	content: unknown;
}

export interface SurfaceCapabilityArgs {
	/** Capabilities registered on the surface being filled. */
	tools: readonly ToolRegistration[];
	/** Policy answer for a support id, or `null` when there is no coordinator. */
	decideFeature: (supportId: string) => SurfaceFeatureDecision | null;
	catalogResolver: AccessibilityCatalogResolverApi | null;
	/** Owner scope for catalog lookups, without `modelId`. */
	ownerContext: CatalogOwnerContext;
	/** The entity a capability resolves its authored content against. */
	entity: unknown;
}

export function resolveSurfaceCapabilities(
	args: SurfaceCapabilityArgs,
): GrantedSurfaceCapability[] {
	const granted: GrantedSurfaceCapability[] = [];

	for (const tool of args.tools) {
		// A capability declares which support ids grant it; any one is enough.
		const supportIds = tool.pnpSupportIds?.length
			? tool.pnpSupportIds
			: [tool.toolId];
		let decision: SurfaceFeatureDecision | null = null;
		let featureId = "";
		for (const supportId of supportIds) {
			const candidate = args.decideFeature(supportId);
			if (candidate?.granted === true) {
				decision = candidate;
				featureId = supportId;
				break;
			}
		}
		const isGranted = decision !== null;
		if (!isGranted && !tool.resolvesWithoutGrant) continue;

		// A capability with no content dependency needs only the grant.
		let content: unknown = null;
		if (tool.requiresAuthoredContent) {
			try {
				content = tool.requiresAuthoredContent.resolve({
					featureId,
					parameters: decision?.parameters,
					catalogResolver: args.catalogResolver,
					ownerContext: args.ownerContext,
					// Typed as an item by the contract; a passage card passes its passage.
					// Both are entities carrying content nodes, which is what a capability
					// resolves against.
					item: args.entity as never,
					granted: isGranted,
				});
			} catch {
				// A capability that throws while looking for its content is absent, not
				// fatal to the card.
				content = null;
			}
			if (content === null || content === undefined) continue;
		} else if (!isGranted) {
			// Nothing to consult and nothing granted: no question left to answer in
			// the capability's favour.
			continue;
		}

		granted.push({
			toolId: tool.toolId,
			featureId,
			parameters: decision?.parameters,
			content,
		});
	}

	return granted;
}
