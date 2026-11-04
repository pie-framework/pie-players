/**
 * Where each part of `<pie-item-player>`'s public surface goes in a section.
 *
 * `tests/item-player-parity.test.ts` fails on any property, method or event in
 * the item player's custom-elements manifest that this record does not
 * classify, so an item-player capability added later is a decision for the
 * section player too.
 *
 * Properties:
 * - `host`: `runtime.player` sets it on every item player, and
 *   `runtime.player.resolveItemProps` per item.
 * - `section`: the section derives it from its content, session or toolkit. A
 *   host override through `runtime.player` wins where the note says so.
 * - `authoring`: configure-mode only; a section delivers.
 *
 * Methods:
 * - `{ controller }`: the section controller member of that name covers the
 *   capability for the section, in the section's own shape.
 * - `unsupported`: a section has no counterpart yet.
 * - `authoring`.
 *
 * Events:
 * - `relayed`: reaches the host as `item-player-event`, with the item's
 *   identity.
 * - `section`: the section consumes it and publishes its own event.
 * - `authoring`.
 */

import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";

export type ItemPlayerPropertyParity = "host" | "section" | "authoring";
export type ItemPlayerMethodParity =
	| { controller: keyof SectionControllerHandle }
	| "unsupported"
	| "authoring";
export type ItemPlayerEventParity = "relayed" | "section" | "authoring";

export const ITEM_PLAYER_PROPERTY_PARITY = {
	config: "section",
	session: "section",
	// `runtime.env`, narrowed per item to its content language and formative state.
	env: "section",
	// `runtime.playerType`.
	strategy: "section",
	// The toolkit's provider; `locale` would build a second one.
	i18n: "section",
	locale: "section",
	contentLanguage: "section",
	// Card heading context; `runtime.player` overrides it.
	baseHeadingLevel: "section",
	includeSrHeading: "section",
	// Passages render in passage cards.
	renderStimulus: "section",
	passageLayout: "section",
	passageContainerClass: "section",
	// `runtime.player.backend`, with each item's delivery identity derived.
	backend: "host",
	hosted: "host",
	loaderConfig: "host",
	loaderOptions: "host",
	addCorrectResponse: "host",
	idleSaveDelayMs: "host",
	sessionSnapshot: "host",
	showBottomBorder: "host",
	debug: "host",
	customClassName: "host",
	containerClass: "host",
	externalStyleUrls: "host",
	allowedStyleOrigins: "host",
	allowedResize: "host",
	autoplayAudioEnabled: "host",
	trustMarkup: "host",
	sanitizeMarkup: "host",
	mode: "authoring",
	configuration: "authoring",
	authoringBackend: "authoring",
	onInsertImage: "authoring",
	onDeleteImage: "authoring",
	onInsertSound: "authoring",
	onDeleteSound: "authoring",
} as const satisfies Record<string, ItemPlayerPropertyParity>;

export const ITEM_PLAYER_METHOD_PARITY = {
	provideScore: { controller: "score" },
	// Scores the item's session on its delivery backend; no section backend
	// scores a section session.
	score: "unsupported",
	// The section's own session, through its session persistence.
	saveSession: { controller: "persist" },
	commitPendingElementSessions: { controller: "commitPendingSessions" },
	// Commit, then read `getSession()`.
	getPendingSessionSnapshot: { controller: "commitPendingSessions" },
	// The section's items load from their derived delivery backend on their own.
	loadFromBackend: "authoring",
	saveContent: "authoring",
	releaseContent: "authoring",
	validateModels: "authoring",
} as const satisfies Record<string, ItemPlayerMethodParity>;

export const ITEM_PLAYER_EVENT_PARITY = {
	"load-complete": "relayed",
	"player-error": "relayed",
	"correct-responses-populated": "relayed",
	"bundle-retry-status": "relayed",
	"session-snapshot-available": "relayed",
	"backend-load-complete": "relayed",
	"backend-model-complete": "relayed",
	"backend-session-saved": "relayed",
	"backend-score-complete": "relayed",
	"backend-error": "relayed",
	// As `item-session-changed` and the section's `session-changed`.
	"session-changed": "section",
	// Claimed by the item scope's toolkit.
	"feature-decision-applied": "section",
	// Fired for a locale catalog the player loads; a section hands it the
	// toolkit's provider instead.
	"framework-error": "section",
	"model-updated": "authoring",
	"model-loaded": "authoring",
	"backend-content-saved": "authoring",
	"backend-content-released": "authoring",
} as const satisfies Record<string, ItemPlayerEventParity>;

