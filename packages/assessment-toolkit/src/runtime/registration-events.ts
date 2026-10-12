import type { SessionCommitReason } from "@pie-players/pie-players-shared/pie";
import type { ItemSettings } from "@pie-players/pie-players-shared/types";
import type { MediaTimeSource } from "@pie-players/pie-players-shared/timed-media";

export const PIE_REGISTER_EVENT = "pie-register";
export const PIE_UNREGISTER_EVENT = "pie-unregister";
export const PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT =
	"pie-item-session-changed";
export const PIE_ITEM_SESSION_CHANGED_EVENT = "item-session-changed";
export const PIE_INTERNAL_CONTENT_LOADED_EVENT = "pie-content-loaded";
export const PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT = "pie-item-player-error";
export const PIE_INTERNAL_FORMATIVE_ACTION_EVENT = "pie-formative-action";
export const PIE_INTERNAL_MEDIA_TIME_SOURCE_EVENT = "pie-media-time-source";

export type RuntimeRegistrationKind = "item" | "passage";

export interface RuntimeRegistrationDetail {
	kind: RuntimeRegistrationKind;
	itemId: string;
	canonicalItemId?: string;
	contentKind?: string;
	item?: unknown;
	/**
	 * An item's policy settings, which govern decisions scoped to the item; see
	 * `ToolkitCoordinatorApi.registerItemSettings`.
	 */
	settings?: ItemSettings;
	element: HTMLElement;
	/**
	 * The runtime the shell found through `assessmentToolkitHostRuntimeContext`.
	 * A toolkit claims an event carrying it only when the id is its own.
	 */
	runtimeId?: string;
}

export interface ItemSessionChangedDetail {
	itemId: string;
	canonicalItemId?: string;
	session: unknown;
	sourceRuntimeId?: string;
	/** Set when the change is a commit at a teardown, navigation or page-hidden seam. */
	sessionCommitReason?: SessionCommitReason;
}

export interface InternalItemSessionChangedDetail {
	itemId: string;
	session: unknown;
}

export interface InternalContentLoadedDetail {
	itemId: string;
	canonicalItemId?: string;
	contentKind?: string;
	detail?: unknown;
}

export interface InternalItemPlayerErrorDetail {
	itemId: string;
	canonicalItemId?: string;
	contentKind?: string;
	error: unknown;
}

/**
 * A learner's formative action, dispatched by the component that owns the
 * control and the item player node — the only place that can call
 * `provideScore()`. It reports outcomes rather than interpreting them; the
 * section controller derives correctness and owns the state.
 *
 * `outcomes` is the array `pie-item-player.provideScore()` returned, verbatim,
 * including the `undefined` slots it leaves for models with no element or
 * controller.
 */
export interface InternalFormativeActionDetail {
	itemId: string;
	canonicalItemId?: string;
	action: "check" | "retry";
	outcomes?: unknown[];
}

/**
 * A Media Time Source becoming available or going away.
 *
 * The only seam through which a timed-media section reaches media: the stimulus
 * card dispatches it with a native `<video>` adapter, and a host wrapping a
 * third-party player dispatches it with its own port. One code path with two
 * producers is what lets a host supply its own media element without shipping a
 * PIE element.
 *
 * `source` is a live object. The event never crosses a realm, like the element
 * reference on `pie-register`.
 */
export interface InternalMediaTimeSourceDetail {
	/** The renderable that owns the media, for matching against `stimulusRef`. */
	renderableId: string;
	action: "attach" | "detach";
	source?: MediaTimeSource;
	/**
	 * Which producer this came from. `"native-adapter"` is the stimulus card
	 * wrapping a media element it found in its own subtree; anything else is a host
	 * wiring its own player, and omitting the field reads as `"host"` because a
	 * caller constructing this event by hand is one.
	 *
	 * Precedence depends on it: the card re-runs its discovery whenever its content
	 * changes, and without the field the native element would replace a host's
	 * third-party port mid-session, flipping the capabilities back with it, so a
	 * policy would read as enforced while it is not.
	 */
	origin?: "native-adapter" | "host";
}
