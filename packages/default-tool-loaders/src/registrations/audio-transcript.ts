/**
 * Audio transcript: the text of an audio prompt, shown to the learners entitled
 * to it.
 *
 * Two kinds of content wear the same shape here, and the card says which:
 *
 *   - `visibility: "always"` is authored presentation. The item family was
 *     designed to be delivered with its transcript on screen — Star Early
 *     Literacy sentence items, for instance — so no profile grants it and none
 *     revokes it.
 *   - anything else, `"onGrant"` included, is the accommodation. Policy decides,
 *     against the `transcript` support id, and silence means no. For the three
 *     Star families a visible transcript turns into a reading task, that gate is
 *     the whole point.
 *
 * This is a marker capability rather than a region one: the element that owns the
 * audio control also renders the transcript and points its `aria-describedby` at
 * it, so a player-rendered copy would put that association in two places and read
 * the text out twice. What the element cannot know is whether this learner should
 * see it. So the capability answers with a class name and the host puts it on the
 * container above the content — `rli-with-audio-transcript`, Learnosity's own
 * contract, which `mc-populated-blank` already honours and which the print path
 * and every non-toolkit host can keep applying by hand.
 *
 * It ships in the packaged set, unlike signing, because its presentation half has
 * to work with no host opt-in: an item authored to show its transcript must show
 * it in every player, and a deployment that forgot an import would silently
 * deliver a designed-for reading support as nothing. The accommodation half is
 * still policy-gated exactly as signing is, and `transcript` is deliberately
 * absent from the universal preset — a content-dependent support never belongs in
 * a wholesale grant.
 */

import type {
	ToolContentDependencyContext,
	ToolContentMarkerContext,
	ToolRegistration,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { collectEntityCatalogRegistrations } from "@pie-players/pie-assessment-toolkit";

/** QTI 3.0 / AfA support id gating an audio transcript. */
export const AUDIO_TRANSCRIPT_FEATURE_ID = "transcript";

/** Catalog type carrying the transcript text. */
export const AUDIO_TRANSCRIPT_CATALOG_TYPE = "transcript";

/**
 * Class the host puts on the content container.
 *
 * Learnosity's, not ours. Keeping their token means an imported item behaves the
 * same in PIE as it did in the source runtime, and a host that already applies it
 * — the print path does — needs no change.
 */
export const AUDIO_TRANSCRIPT_CONTENT_CLASS = "rli-with-audio-transcript";

/** Card value that makes a transcript authored presentation. */
const ALWAYS_VISIBLE = "always";

/** What the capability needs to know about the transcript it found. */
export interface ResolvedAudioTranscript {
	catalogId: string;
	/** True when the card declares itself authored presentation. */
	always: boolean;
}

interface TranscriptCardLike {
	catalog?: unknown;
	visibility?: unknown;
}

const isTranscriptCard = (
	card: TranscriptCardLike | null | undefined,
): boolean => !!card && card.catalog === AUDIO_TRANSCRIPT_CATALOG_TYPE;

/**
 * Whether a card declares itself authored presentation.
 *
 * Absent reads as the accommodation, which is the same fail-closed reading the
 * policy engine takes of a silent profile: a card that says nothing about
 * presentation has not claimed to be presentation.
 */
const isAlwaysVisible = (card: TranscriptCardLike): boolean =>
	typeof card.visibility === "string" &&
	card.visibility.trim().toLowerCase() === ALWAYS_VISIBLE;

/**
 * The transcript an entity carries, or `null`.
 *
 * Read from the catalogs the entity puts in play, by the same walk the runtime
 * uses to register them, so a card can only be found in a scope registration
 * actually files under. The card's text is not read: the element renders it from
 * its own model, and this capability only decides whether it is shown.
 */
export function resolveAudioTranscript(
	context: ToolContentDependencyContext,
): ResolvedAudioTranscript | null {
	const entity = context.item;
	if (!entity) return null;

	const registrations = collectEntityCatalogRegistrations(entity as never, {
		kind: "item",
		itemId: (entity as { id?: string }).id ?? "",
	});

	let firstOnGrant: ResolvedAudioTranscript | null = null;
	for (const registration of registrations) {
		for (const catalog of registration.catalogs) {
			if (!Array.isArray(catalog?.cards)) continue;
			for (const card of catalog.cards as TranscriptCardLike[]) {
				if (!isTranscriptCard(card)) continue;
				// An `always` card answers whether or not policy granted anything, so it
				// wins over an accommodation card found earlier.
				if (isAlwaysVisible(card)) {
					return { catalogId: catalog.identifier, always: true };
				}
				firstOnGrant ??= { catalogId: catalog.identifier, always: false };
			}
		}
	}

	if (!firstOnGrant) return null;
	// The accommodation half: without a grant this learner is not entitled to it,
	// and being asked anyway is the price of also serving the authored case.
	return context.granted ? firstOnGrant : null;
}

/**
 * Host surface this capability marks: the container above a card's content.
 *
 * Item cards and passage cards open the same surface, so declaring it once
 * reaches both — a passage can carry an audio prompt as an item can.
 */
export const CONTENT_MARKER_SURFACE = "content-marker";

export const audioTranscriptRegistration: ToolRegistration = {
	toolId: AUDIO_TRANSCRIPT_FEATURE_ID,
	name: "Audio Transcript",
	description:
		"Text of an audio prompt, shown beside the content it transcribes",

	supportedLevels: ["item", "passage"],

	pnpSupportIds: [AUDIO_TRANSCRIPT_FEATURE_ID],

	// No button to press: a transcript is either authored-visible, or granted and
	// present, or absent. `region` is the activation for a capability with no
	// toolbar presence, and tools-config validation reports a `tools.placement`
	// entry naming it as unplaceable rather than silently doing nothing.
	activation: "region",
	surfaces: [CONTENT_MARKER_SURFACE],

	// The resource half of the AfA pair, and the only reader of the card.
	requiresAuthoredContent: {
		resolve(context: ToolContentDependencyContext) {
			return resolveAudioTranscript(context);
		},
		description:
			"An accessibility catalog card of type `transcript` on the item or passage",
	},

	// Authored presentation is not a grant, so the content has to be consulted even
	// when policy granted nothing; `resolveAudioTranscript` returns null for an
	// accommodation card in that case.
	resolvesWithoutGrant: true,

	markContent: {
		resolve(context: ToolContentMarkerContext) {
			const transcript = context.content as ResolvedAudioTranscript | null;
			if (!transcript) return null;
			if (!transcript.always && !context.granted) return null;
			return [AUDIO_TRANSCRIPT_CONTENT_CLASS];
		},
		description:
			"Adds Learnosity's `rli-with-audio-transcript` class, which the element reveals on",
	},
};
