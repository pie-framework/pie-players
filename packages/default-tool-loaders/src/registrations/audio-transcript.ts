/**
 * Audio transcript: the text of an audio prompt, rendered for the learners
 * entitled to it.
 *
 * Two kinds of content wear the same shape, and the card says which:
 *
 *   - `visibility: "always"` is authored presentation. The item family was
 *     designed to be delivered with its transcript on screen — Star Early
 *     Literacy sentence items, for instance — so no profile grants it and none
 *     revokes it.
 *   - anything else, `"onGrant"` included, is the accommodation. Policy decides
 *     against the `transcript` support id, and silence means no. For the three
 *     Star families where a visible transcript turns the item into a reading
 *     task, that gate is the whole point.
 *
 * The toolkit renders the text, not the element. Before this, the transcript rode
 * on `model.audioTranscript` and `mc-populated-blank` revealed its own copy when
 * an ancestor carried `.rli-with-audio-transcript` — which made delivering an
 * accommodation the host's job, required every element carrying audio to
 * reimplement the reveal, and put an element-specific CSS class in the contract.
 * Rendering here is the same shape signing already has, and it is what makes one
 * mechanism serve braille, simplified-language and the rest.
 *
 * No `aria-describedby` back to the element's audio control, deliberately. A
 * description is announced as a flat string when a control takes focus, so
 * pointing one at a multi-sentence transcript is worse to listen to than reading
 * order: this renders a labelled region immediately before the content, where a
 * screen-reader user meets it on the way to the control it belongs to.
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
	ToolRegistration,
	ToolSurfaceRenderContext,
	ToolSurfaceRenderResult,
} from "@pie-players/pie-assessment-toolkit/tools/internal";

/** QTI 3.0 / AfA support id gating an audio transcript. */
export const AUDIO_TRANSCRIPT_FEATURE_ID = "transcript";

/** Catalog type carrying the transcript text. */
export const AUDIO_TRANSCRIPT_CATALOG_TYPE = "transcript";

/** Accessible name of the rendered region, and its class hook for themes. */
export const AUDIO_TRANSCRIPT_REGION_LABEL = "Transcript";
export const AUDIO_TRANSCRIPT_REGION_CLASS = "pie-tool-audio-transcript";

/** Card value that makes a transcript authored presentation. */
const ALWAYS_VISIBLE = "always";

/** The transcript to render, and why it is being rendered. */
export interface ResolvedAudioTranscript {
	catalogId: string;
	text: string;
	language?: string;
	/** True when the card declares itself authored presentation. */
	always: boolean;
}

interface TranscriptCardLike {
	catalog?: unknown;
	content?: unknown;
	language?: unknown;
	visibility?: unknown;
}

const isTranscriptCard = (
	card: TranscriptCardLike | null | undefined,
): boolean => !!card && card.catalog === AUDIO_TRANSCRIPT_CATALOG_TYPE;

/**
 * Whether a card declares itself authored presentation.
 *
 * Absent reads as the accommodation, the same fail-closed reading the policy
 * engine takes of a silent profile: a card that says nothing about presentation
 * has not claimed to be presentation.
 */
const isAlwaysVisible = (card: TranscriptCardLike): boolean =>
	typeof card.visibility === "string" &&
	card.visibility.trim().toLowerCase() === ALWAYS_VISIBLE;

const cardText = (card: TranscriptCardLike): string =>
	typeof card.content === "string" ? card.content.trim() : "";

/**
 * The transcript an entity carries, or `null`.
 *
 * Read from the owner snapshot the resolver produced. Item/passage/model
 * traversal and registration precedence have already been applied, so this
 * capability owns only transcript interpretation.
 *
 * The cards are read directly rather than through `AccessibilityCatalogResolver`,
 * which flattens a card to type/language/content and so cannot carry
 * `visibility` — the one attribute this decision turns on. Nothing is lost by it:
 * the resolver's value is choosing between languages of the same alternate, and a
 * transcript is in the language of the audio it transcribes, one per prompt.
 */
export function resolveAudioTranscript(
	context: ToolContentDependencyContext,
): ResolvedAudioTranscript | null {
	if (!context.catalogs) return null;

	let firstOnGrant: ResolvedAudioTranscript | null = null;
	for (const { catalogId, card } of context.catalogs.cards) {
		if (!isTranscriptCard(card)) continue;
		const text = cardText(card);
		// A card with no text is not a transcript; rendering an empty region
		// would announce an alternate that is not there.
		if (!text) continue;
		const resolved: ResolvedAudioTranscript = {
			catalogId,
			text,
			language: typeof card.language === "string" ? card.language : undefined,
			always: isAlwaysVisible(card),
		};
		// An `always` card answers whether or not policy granted anything, so it
		// wins over an accommodation card found earlier.
		if (resolved.always) return resolved;
		firstOnGrant ??= resolved;
	}

	if (!firstOnGrant) return null;
	// The accommodation half: without a grant this learner is not entitled to it,
	// and being asked anyway is the price of also serving the authored case.
	return context.granted ? firstOnGrant : null;
}

/**
 * Host surface this capability fills: the full-width slot above a card's content.
 *
 * Item cards and passage cards open the same surface, so declaring it once
 * reaches both — a passage can carry an audio prompt as an item can.
 */
export const CONTENT_LEAD_SURFACE = "content-lead";

/**
 * A labelled region holding the transcript text.
 *
 * Plain DOM rather than a custom element: there is no state, no lifecycle and
 * nothing to load, so a package and a registration ceremony would buy nothing.
 * `renderSurface` promises an `HTMLElement`, not a custom one.
 */
function buildTranscriptRegion(): HTMLElement {
	const region = document.createElement("section");
	region.className = AUDIO_TRANSCRIPT_REGION_CLASS;
	// A region rather than a bare paragraph so it is reachable as a landmark and
	// announces its purpose before its content.
	region.setAttribute("role", "region");
	const text = document.createElement("p");
	text.className = `${AUDIO_TRANSCRIPT_REGION_CLASS}__text`;
	region.appendChild(text);
	return region;
}

const applyTranscript = (
	region: HTMLElement,
	transcript: ResolvedAudioTranscript | null,
): void => {
	const text = region.querySelector(`.${AUDIO_TRANSCRIPT_REGION_CLASS}__text`);
	if (!text) return;
	text.textContent = transcript?.text ?? "";
	if (transcript?.language) {
		region.setAttribute("lang", transcript.language);
	} else {
		region.removeAttribute("lang");
	}
	// Which half put it on screen, for a policy debugger and for hosts that theme
	// authored presentation differently from an accommodation.
	region.dataset.transcriptVisibility = transcript?.always
		? "always"
		: "onGrant";
};

export const audioTranscriptRegistration: ToolRegistration = {
	toolId: AUDIO_TRANSCRIPT_FEATURE_ID,
	name: "Audio Transcript",
	description:
		"Text of an audio prompt, read before the content it transcribes",

	supportedLevels: ["item", "passage"],

	pnpSupportIds: [AUDIO_TRANSCRIPT_FEATURE_ID],

	// No button to press: a transcript is either authored-visible, or granted and
	// present, or absent. `region` is the activation for a capability with no
	// toolbar presence, and tools-config validation reports a `tools.placement`
	// entry naming it as unplaceable rather than silently doing nothing.
	activation: "region",
	surfaces: [CONTENT_LEAD_SURFACE],

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

	renderSurface(
		context: ToolSurfaceRenderContext,
	): ToolSurfaceRenderResult | null {
		const transcript = context.content as ResolvedAudioTranscript | null;
		// No content means the host asked before resolving, or resolved to nothing.
		// Declining is the honest answer; an empty region is not.
		if (!transcript) return null;

		const region = buildTranscriptRegion();
		applyTranscript(region, transcript);
		return {
			element: region,
			ariaLabel: AUDIO_TRANSCRIPT_REGION_LABEL,
			// Reads the context it is handed, never the one captured above: on a
			// re-resolve the host's context carries the current card, and a learner must
			// not keep reading the previous item's transcript.
			sync: (current) =>
				applyTranscript(
					region,
					current.content as ResolvedAudioTranscript | null,
				),
		};
	},
};
