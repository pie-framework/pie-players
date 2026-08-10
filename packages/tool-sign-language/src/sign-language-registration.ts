/**
 * Signing as a capability the host contributes, with no id of ours in the
 * player.
 *
 * This is the first registration to live outside the composition package, and it
 * exists to prove the shape works from outside: it is authored against
 * `@pie-players/pie-assessment-toolkit/tools/internal`, the same entry point our
 * own registrations use, and section-player reaches it only through
 * `getToolsBySurface("content-media")`. Nothing in the player names signing, the
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

/**
 * Host surface this capability docks into: media beside a card's content.
 *
 * Item cards and passage cards open the same surface, so declaring it once
 * reaches both. A signed alternate is authored against a content node, and a
 * passage owns content nodes as an item does.
 */
export const CONTENT_MEDIA_SURFACE = "content-media";

/** Element tag this package registers. A host may substitute its own. */
export const SIGN_LANGUAGE_ELEMENT_TAG = "pie-tool-sign-language";

export const signLanguageRegistration: ToolRegistration = {
	toolId: SIGN_LANGUAGE_FEATURE_ID,
	name: "Sign Language",
	description: "Signed translation, docked beside the content it interprets",

	// Item and passage, because an alternate docks to a content node and both
	// carry content nodes. No section-level answer: a section is a container, and
	// its shared content is a passage or a rubric block that answers for itself.
	supportedLevels: ["item", "passage"],

	pnpSupportIds: [SIGN_LANGUAGE_FEATURE_ID],

	activation: "region",
	surfaces: [CONTENT_MEDIA_SURFACE],

	/**
	 * The resource half of the AfA pair. The host asks this after policy grants
	 * the feature and mounts only if it returns something.
	 */
	requiresAuthoredContent: {
		resolve(context: ToolContentDependencyContext) {
			return resolveSignLanguageContent(context);
		},
	},

	renderSurface(
		context: ToolSurfaceRenderContext,
	): ToolSurfaceRenderResult | null {
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
		// Reads the context it is handed, never the one captured above: on a re-sync
		// the host's context carries the freshly resolved card, and a learner who
		// switched signed language must not keep watching the previous recording.
		const applyProps = (current: ToolSurfaceRenderContext) => {
			element.media = current.content as ResolvedSignLanguageAlternate | null;
			// Signing playback and read-aloud must not run at once; the region needs
			// the service to pause the other one.
			element.ttsService = current.services.ttsService;
		};
		applyProps(context);
		return {
			element,
			// Names the language, not the medium: "video" tells a learner nothing.
			ariaLabel: media.label || undefined,
			sync: applyProps,
		};
	},
};
