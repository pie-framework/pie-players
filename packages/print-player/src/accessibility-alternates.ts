/**
 * Accessibility catalogs, resolved for one print job.
 *
 * An alternate representation — a transcript today, braille and
 * simplified-language next — arrives as an accessibility catalog card and is
 * gated by the learner's profile. Print used to reach none of them: it renders
 * from the item model alone, so an alternate reached paper only where some
 * element happened to render it from a legacy model field.
 *
 * A print job is one learner with one profile, decided once. There is no
 * coordinator, nothing to toggle, and no re-resolve: what print needs is the same
 * question the section player asks continuously, asked once — given this item and
 * this profile, which alternates are in play. So the policy engine, the catalog
 * resolver and `resolveContentCapabilities` are the same ones delivery uses, and
 * the only thing print owns is which host slot it opens.
 *
 * Print opens {@link CONTENT_LEAD_SURFACE} and not the docked-media slot beside
 * it. That is a property of paper, not a preference: a signed alternate is a
 * video, and on paper a video is a blank rectangle. Every alternate that can be
 * read in order reaches print by declaring the slot, without a change here.
 *
 * Nothing in this module names a capability, a support id, or a catalog type.
 */

import {
	resolveContentCapabilities,
	ToolRegistry,
	type ToolRegistration,
	type ToolSurfaceRenderResult,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { ToolPolicyEngine } from "@pie-players/pie-assessment-toolkit/policy/engine";
import { AccessibilityCatalogResolver } from "@pie-players/pie-assessment-toolkit/services/AccessibilityCatalogResolver";
import { CONTENT_ALTERNATE_REGISTRATIONS } from "@pie-players/pie-default-tool-loaders";
import type {
	AccessibilityCatalog,
	AssessmentSettings,
	ItemSettings,
	PersonalNeedsProfile,
} from "@pie-players/pie-players-shared/types";

import type { Item } from "./types.js";

/**
 * Host slot for an alternate that has to be read in order with the content.
 *
 * The name is the section player's, deliberately: the two renderers open the same
 * slot for the same reason — full width, above the content body, in flow — and a
 * capability declares it once to reach both. Diverging here would mean an
 * alternate reaching the screen and not paper because of a spelling.
 */
export const CONTENT_LEAD_SURFACE = "content-lead";

/**
 * Class hook for the block print fills with the alternates in play.
 *
 * The element is always rendered and usually empty — most items carry no
 * alternate — which costs nothing on paper: an empty block with no styles of its
 * own occupies no space. Rendering it unconditionally is what lets the template
 * own the node and this module own only its children.
 */
export const ALTERNATES_CLASS = "pie-print-alternates";

/**
 * Who this print job is for.
 *
 * The same policy inputs delivery reads, minus everything that only exists while
 * a learner is working: no section, no attempt, no toggles. All optional — an
 * item authored to be delivered with its alternate on screen prints it with no
 * profile at all, which is why print resolves even when this is absent.
 */
export interface PrintAccessibilityConfig {
	/** The learner's PNP: which supports they are entitled to. */
	personalNeedsProfile?: PersonalNeedsProfile;
	/** Program policy refining it: district blocks, test-administration overrides. */
	settings?: AssessmentSettings;
	/** This item's required and restricted supports. */
	itemSettings?: ItemSettings;
	/**
	 * Capabilities to consider, defaulting to the packaged authored-alternate set.
	 *
	 * A deployment that composes its own capability set passes it here, so print
	 * and delivery agree about what exists. What print must never do is name the
	 * alternates itself.
	 */
	registrations?: readonly ToolRegistration[];
}

/** One mounted print job's alternates, for teardown before the next resolve. */
export interface MountedAlternates {
	destroy(): void;
}

/**
 * Catalog owner id for the one entity a print job renders.
 *
 * Scope keys only have to be internally consistent for a single resolution —
 * print registers one owner and reads it back, with nothing to disambiguate it
 * from — and the authored id is not something `<pie-print>`'s config carries.
 *
 * `kind: "item"` covers a printed passage too. The owner kind exists to keep one
 * mounted entity's cards from reaching another's, which cannot arise with one
 * owner, and print cannot tell an item's config from a passage's anyway: both
 * arrive as markup, elements and models.
 */
const PRINT_OWNER_ID = "pie-print-owner";

/** Policy scope id for the one item this print job decides for. */
const PRINT_POLICY_SCOPE_ID = "pie-print";

/**
 * The entity shape the catalog resolver traverses, from what print is given.
 *
 * `<pie-print>` takes the PIE config rather than the item entity that wraps it,
 * so the model-owned catalogs the content transform writes arrive already, and
 * entity-root and extractor-generated catalogs are the two that have to be
 * carried explicitly.
 */
const catalogSourceEntity = (item: Item) => ({
	accessibilityCatalogs: item.accessibilityCatalogs,
	config: {
		extractedCatalogs: item.extractedCatalogs,
		models: item.models as Array<{
			id?: string;
			accessibilityCatalogs?: AccessibilityCatalog[];
		}>,
	},
});

/**
 * A visible label for an alternate, wired as the region's accessible name.
 *
 * The capability names its region for the accessibility tree, and paper has no
 * accessibility tree — an unlabelled block of prose above an item reads as part
 * of the item. So the name is rendered, once, and pointed at rather than
 * duplicated, since the print output is a document before it is a page.
 *
 * Not a heading: this is a fragment inside a host's page and has no standing to
 * claim a level in its outline.
 */
function labelFor(toolId: string, text: string): HTMLElement {
	const label = document.createElement("p");
	label.className = `${ALTERNATES_CLASS}__label`;
	label.id = `${ALTERNATES_CLASS}-${toolId}-label`;
	const emphasis = document.createElement("strong");
	emphasis.textContent = text;
	label.appendChild(emphasis);
	return label;
}

/**
 * Resolve the item's alternates against the profile and mount the ones in play.
 *
 * Unconditional once resolved: on paper there is nothing to reveal, no control to
 * press, and no later signal that could change the answer.
 */
export function mountItemAlternates(args: {
	anchor: HTMLElement;
	item: Item;
	accessibility?: PrintAccessibilityConfig;
}): MountedAlternates {
	const { anchor, item, accessibility } = args;

	const registry = new ToolRegistry();
	for (const registration of accessibility?.registrations ??
		CONTENT_ALTERNATE_REGISTRATIONS) {
		registry.register(registration);
	}

	const resolver = new AccessibilityCatalogResolver();
	resolver.registerOwner({
		owner: { kind: "item", itemId: PRINT_OWNER_ID },
		entity: catalogSourceEntity(item),
	});

	// An assessment is bound only when there is policy material to read from one.
	// Fabricating an empty one would report a profile that was consulted and said
	// nothing, where in fact none was supplied.
	const hasPolicyMaterial = Boolean(
		accessibility?.personalNeedsProfile || accessibility?.settings,
	);
	const engine = new ToolPolicyEngine({
		toolRegistry: registry,
		contextId: "pie-print",
		inputs: {
			assessment: hasPolicyMaterial
				? {
						id: PRINT_POLICY_SCOPE_ID,
						personalNeedsProfile: accessibility?.personalNeedsProfile,
						settings: accessibility?.settings,
					}
				: null,
			currentItemRef: accessibility?.itemSettings
				? {
						identifier: PRINT_POLICY_SCOPE_ID,
						settings: accessibility.itemSettings,
					}
				: null,
		},
	});

	const mounted: ToolSurfaceRenderResult[] = [];
	const appended: HTMLElement[] = [];

	try {
		const resolved = resolveContentCapabilities({
			registrations: registry.getToolsBySurface(CONTENT_LEAD_SURFACE),
			catalogs: resolver
				.forOwner({ ownerKind: "itemModel", itemId: PRINT_OWNER_ID })
				.snapshot(),
			grantFor: (supportId) => {
				const decision = engine.decideFeature(supportId);
				if (!decision.granted) return null;
				return { featureId: supportId, parameters: decision.parameters };
			},
			onError: (registration, phase, error) => {
				console.warn(
					`[pie-print] Tool "${registration.toolId}" failed ${phase} resolution; its alternate was omitted.`,
					error,
				);
			},
		});

		for (const entry of resolved) {
			const toolId = entry.registration.toolId;
			let rendered: ToolSurfaceRenderResult | null = null;
			try {
				rendered = registry.renderForSurface(toolId, {
					toolId,
					featureId: entry.featureId,
					surface: CONTENT_LEAD_SURFACE,
					parameters: entry.parameters,
					content: entry.content,
					services: {
						toolkitCoordinator: null,
						ttsService: null,
						catalogResolver: resolver,
					},
				});
			} catch (error) {
				console.warn(
					`[pie-print] Tool "${toolId}" failed to render for print; its alternate was omitted.`,
					error,
				);
				continue;
			}
			if (!rendered?.element) continue;

			if (rendered.ariaLabel) {
				const label = labelFor(toolId, rendered.ariaLabel);
				anchor.appendChild(label);
				appended.push(label);
				rendered.element.setAttribute("aria-labelledby", label.id);
			}
			anchor.appendChild(rendered.element);
			appended.push(rendered.element);
			mounted.push(rendered);
		}
	} finally {
		// Nothing observes policy or catalogs after this: a print job's answer cannot
		// change, so the engine's subscriber bus has no reader to serve.
		engine.dispose();
	}

	return {
		destroy(): void {
			for (const entry of mounted) {
				try {
					entry.destroy?.();
				} catch (error) {
					console.warn(
						"[pie-print] A print alternate failed teardown; its element was removed anyway.",
						error,
					);
				}
			}
			mounted.length = 0;
			for (const node of appended) node.remove();
			appended.length = 0;
		},
	};
}
