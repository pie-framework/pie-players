/**
 * Signing as a capability the host contributes, with no id of ours in the
 * player.
 *
 * This is the first registration to live outside the composition package, and it
 * exists to prove the shape works from outside: it is authored against
 * `@pie-players/pie-assessment-toolkit/tools/internal`, the same entry point our
 * own registrations use, and section-player reaches it only through
 * `getToolsBySurface("item-media")`. Nothing in the player names signing, the
 * `signLanguage` support id, the `sign-language` catalog type or this package.
 *
 * `activation: "region"` rather than a toolbar activation: there is no button to
 * press. A signed alternate is either present and granted, in which case it
 * shows, or it is not. Placement configuration cannot reach it, and
 * tools-config validation reports a `tools.placement` entry naming it as
 * unplaceable rather than silently doing nothing.
 *
 * It is deliberately **not** in `createPackagedToolRegistry`. Signing is an
 * accommodation with an authored-content dependency, so a deployment opts in by
 * importing this package and registering it; a default that granted it would
 * hand the accommodation to every learner whose item happened to carry a card.
 */

import {
	resolveToolTag,
	type ToolComponentOverrides,
	type ToolContentDependencyContext,
	type ToolRegistration,
	type ToolSurfaceRenderContext,
	type ToolSurfaceRenderResult,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	resolveSignLanguageContent,
	SIGN_LANGUAGE_FEATURE_ID,
	type ResolvedSignLanguageAlternate,
} from "./sign-language-content.js";

/** Host surface this capability docks into: media beside an item's content. */
export const ITEM_MEDIA_SURFACE = "item-media";

/** Element tag this package registers. A host may substitute its own. */
export const SIGN_LANGUAGE_ELEMENT_TAG = "pie-tool-sign-language";

export const signLanguageRegistration: ToolRegistration = {
	toolId: SIGN_LANGUAGE_FEATURE_ID,
	name: "Sign Language",
	description: "Signed translation of the item, docked beside its content",

	// Item-scoped only. A signed alternate is authored per item, so there is no
	// section- or passage-level answer to give.
	supportedLevels: ["item"],

	pnpSupportIds: [SIGN_LANGUAGE_FEATURE_ID],

	activation: "region",
	surfaces: [ITEM_MEDIA_SURFACE],

	/**
	 * The resource half of the AfA pair. The host asks this after policy grants
	 * the feature and mounts only if it returns something.
	 */
	requiresAuthoredContent: {
		resolve(context: ToolContentDependencyContext) {
			return resolveSignLanguageContent(context);
		},
	},

	renderSurface(context: ToolSurfaceRenderContext): ToolSurfaceRenderResult | null {
		const media = context.content as ResolvedSignLanguageAlternate | null;
		// No content means the host asked before resolving, or resolved to nothing.
		// Declining is the honest answer; an empty player is not.
		if (!media) return null;

		const componentOverrides =
			(context.componentOverrides as ToolComponentOverrides | undefined) ?? {};
		// This package registers its own element, so it supplies its own mapping
		// rather than requiring the host to install one — but a host override still
		// wins, which is how a deployment substitutes its own region component.
		const tagName = resolveToolTag(context.toolId, {
			...componentOverrides,
			toolTagMap: {
				[SIGN_LANGUAGE_FEATURE_ID]: SIGN_LANGUAGE_ELEMENT_TAG,
				...componentOverrides.toolTagMap,
			},
		});
		if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
			// Importing this package registers the element, so reaching here means a
			// host mapped the id to an element it never defined.
			return null;
		}

		const element = document.createElement(tagName) as HTMLElement & {
			media?: ResolvedSignLanguageAlternate | null;
			ttsService?: unknown;
		};
		const applyProps = () => {
			element.media = context.content as ResolvedSignLanguageAlternate | null;
			// Signing playback and read-aloud must not run at once; the region needs
			// the service to pause the other one.
			element.ttsService = context.services.ttsService;
		};
		applyProps();
		return {
			element,
			// Names the language, not the medium: "video" tells a learner nothing.
			ariaLabel: media.label || undefined,
			sync: applyProps,
		};
	},
};
