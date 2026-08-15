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
 * Policy answers in three states rather than two, because a host gate is not the
 * absence of a grant: `resolvesWithoutGrant` lets a capability answer from the
 * content when nobody was granted anything, and a host that switched the
 * capability off must not be read as nobody having spoken. Resolution order is
 * denial, then grant, then the content exception.
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

/** What policy answered about one feature id. */
export type ContentCapabilityPolicy =
	| {
			outcome: "granted";
			/** The support id that was granted — a capability may declare several. */
			featureId: string;
			/** Feature parameters carried by the decision, if any. */
			parameters?: unknown;
	  }
	/**
	 * No source granted it and none denied it. A capability declaring
	 * {@link ToolRegistration.resolvesWithoutGrant} may still answer from the
	 * content: silence is what an authored-presentation alternate looks like,
	 * since no profile speaks for one either way.
	 */
	| { outcome: "silent" }
	/**
	 * A host gate denied it — the off switch, not the absence of a grant. It
	 * outranks `resolvesWithoutGrant`, because a host saying a capability has no
	 * place in this delivery is a statement authored content cannot overrule.
	 */
	| { outcome: "denied" };

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
	 * Policy's answer about one feature id, in three states.
	 *
	 * Granting requires a documented need, so an unconfigured feature is
	 * `"silent"`, never granted. What the third state buys is the distinction
	 * `"silent"` cannot carry: a host that switched the capability off said
	 * something, and a capability allowed to answer from content alone must not
	 * treat that as nobody having spoken.
	 */
	policyFor: (featureId: string) => ContentCapabilityPolicy;
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

type Grant = Extract<ContentCapabilityPolicy, { outcome: "granted" }>;

/**
 * Everything policy has to say about one capability: a grant, an off switch, or
 * nothing.
 *
 * Denial is checked ahead of a grant on each id rather than after the scan,
 * because the two can only disagree when a host blocked one of a capability's ids
 * while a profile granted another, and there the off switch is the later, more
 * specific statement about this delivery.
 *
 * A host gate names *capabilities*, so the tool id is probed too when it is not
 * already a declared support id — otherwise a capability whose id differs from
 * its support ids would slip a host block. That probe is gate-only: a grant on
 * the tool id is ignored, or blocking would double as a second way to switch a
 * capability on.
 */
function policyForCapability(
	registration: ToolRegistration,
	args: ResolveContentCapabilitiesArgs,
): { grant: Grant | null; denied: boolean } {
	const supportIds = supportIdsOf(registration);
	for (const supportId of supportIds) {
		const answer = args.policyFor(supportId);
		if (answer.outcome === "denied") return { grant: null, denied: true };
		if (answer.outcome === "granted") return { grant: answer, denied: false };
	}
	if (supportIds.includes(registration.toolId)) {
		return { grant: null, denied: false };
	}
	return {
		grant: null,
		denied: args.policyFor(registration.toolId).outcome === "denied",
	};
}

function resolveOne(
	registration: ToolRegistration,
	args: ResolveContentCapabilitiesArgs,
): ResolvedContentCapability | null {
	let grant: Grant | null = null;
	try {
		const answer = policyForCapability(registration, args);
		// Nothing reopens a host denial — not a grant it outranked, and not the
		// content exception below.
		if (answer.denied) return null;
		grant = answer.grant;
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
