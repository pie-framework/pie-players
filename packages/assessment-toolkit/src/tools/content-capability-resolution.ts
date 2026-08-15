/**
 * Whether a content capability has anything to show, for one entity and one
 * profile.
 *
 * Two independent halves, and a capability is in play only when both answer yes:
 * policy granted one of its support ids, and its own `requiresAuthoredContent`
 * found the resource in this entity's catalogs. Neither implies the other — a
 * learner with an accommodation still sees nothing on an item carrying no
 * resource, and an item carrying one shows nothing to a learner without the
 * grant.
 *
 * It lives here, data-only and DOM-free, because two renderers ask it. The
 * section player asks continuously: policy and catalogs both change under a
 * mounted card, and it re-resolves to reconcile what is on screen. Print asks
 * once — one learner, one profile, decided before the page exists, with nothing
 * to toggle. A second implementation for the one-shot case would be two
 * renderers disagreeing about the same card, which is the failure this exists to
 * prevent.
 *
 * Capability-neutral, and gated as such: nothing here names a support id, a
 * catalog type, or a surface. The caller passes the registrations and the slot,
 * a capability interprets its own cards, and the resolution owns only the
 * two-halves rule and its one documented exception.
 */

import type {
	ToolContentDependencyContext,
	ToolRegistration,
} from "../services/ToolRegistry.js";
import type { CatalogOwnerSnapshot } from "../services/AccessibilityCatalogResolver.js";

/** What policy answered for one support id. */
export interface ContentCapabilityGrant {
	/** The support id that was granted — the capability may declare several. */
	featureId: string;
	/** Feature parameters carried by the decision, if any. */
	parameters?: unknown;
}

/** Which half of a capability's resolution failed. */
export type ContentCapabilityPhase = "policy" | "content";

/** A capability that is in play, and everything its renderer needs to mount it. */
export interface ResolvedContentCapability {
	registration: ToolRegistration;
	/**
	 * The granted support id, or `""` when the capability resolved without a
	 * grant. Passed through to the render context unchanged, so a capability that
	 * serves both an authored-presentation case and an accommodation can still
	 * tell them apart at render time.
	 */
	featureId: string;
	parameters?: unknown;
	/** Whatever the capability's own `resolve` returned; never inspected here. */
	content: unknown;
}

export interface ResolveContentCapabilitiesArgs {
	/**
	 * The capabilities to consider. A caller with a registry passes
	 * `getToolsBySurface(surface)`, which is what keeps a renderer from naming
	 * one.
	 */
	registrations: readonly ToolRegistration[];
	/** The entity's cards, or `null` when no resolver is available. */
	catalogs: CatalogOwnerSnapshot | null;
	/**
	 * Policy's answer for one support id: the grant, or `null` for anything else.
	 * Silence is a denial — an accommodation requires a documented need.
	 */
	grantFor: (supportId: string) => ContentCapabilityGrant | null;
	/**
	 * Report a capability that threw. It is dropped either way; this is how a
	 * caller surfaces it as its own recoverable warning rather than letting one
	 * capability's defect reach the learner's content.
	 */
	onError?: (
		registration: ToolRegistration,
		phase: ContentCapabilityPhase,
		error: unknown,
	) => void;
}

/** The support ids a capability answers to, defaulting to its own id. */
const supportIdsOf = (registration: ToolRegistration): string[] =>
	registration.pnpSupportIds?.length
		? registration.pnpSupportIds
		: [registration.toolId];

function resolveOne(
	registration: ToolRegistration,
	args: ResolveContentCapabilitiesArgs,
): ResolvedContentCapability | null {
	let grant: ContentCapabilityGrant | null = null;
	try {
		for (const supportId of supportIdsOf(registration)) {
			grant = args.grantFor(supportId);
			if (grant) break;
		}
	} catch (error) {
		args.onError?.(registration, "policy", error);
		return null;
	}

	// The exception, and the only one: a capability whose content can declare
	// itself authored presentation is consulted even when policy granted nothing,
	// because an item family designed to be delivered with its alternate on screen
	// is not an accommodation and no profile grants or revokes it. The capability
	// still decides — `granted` is how it tells the two cases apart.
	if (!grant && !registration.resolvesWithoutGrant) return null;

	if (!registration.requiresAuthoredContent) {
		// Nothing to look for in the content, so the grant is the whole answer. A
		// capability reaching here without one has no second half to supply it.
		if (!grant) return null;
		return {
			registration,
			featureId: grant.featureId,
			parameters: grant.parameters,
			content: null,
		};
	}

	const context: ToolContentDependencyContext = {
		featureId: grant?.featureId ?? "",
		parameters: grant?.parameters,
		catalogs: args.catalogs,
		granted: Boolean(grant),
	};

	let content: unknown;
	try {
		content = registration.requiresAuthoredContent.resolve(context);
	} catch (error) {
		args.onError?.(registration, "content", error);
		return null;
	}
	// Absent content is the honest answer to "is there anything to show", not a
	// failure: the item carries no resource for this capability.
	if (content === null || content === undefined) return null;

	return {
		registration,
		featureId: context.featureId,
		parameters: context.parameters,
		content,
	};
}

/**
 * The capabilities in play, in the order the caller offered them.
 *
 * Registry order is preserved so a renderer's slot ordering stays a property of
 * the registry rather than of resolution timing.
 */
export function resolveContentCapabilities(
	args: ResolveContentCapabilitiesArgs,
): ResolvedContentCapability[] {
	return args.registrations.flatMap((registration) => {
		const resolved = resolveOne(registration, args);
		return resolved ? [resolved] : [];
	});
}
