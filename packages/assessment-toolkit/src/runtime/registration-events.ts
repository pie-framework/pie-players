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
	element: HTMLElement;
}

export interface ItemSessionChangedDetail {
	itemId: string;
	canonicalItemId?: string;
	session: unknown;
	sourceRuntimeId?: string;
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
 * The one seam through which a timed-media section reaches media, and
 * deliberately the *only* one: the stimulus card dispatches this with a native
 * `<video>` adapter, and a host wrapping a third-party player dispatches the same
 * event with its own port. One code path, two producers — which is what keeps
 * "a host can supply its own media element without shipping a PIE element" true
 * rather than aspirational.
 *
 * `source` carries a live object, not serializable data. That is fine and
 * intended: this event never crosses a realm, exactly like the element reference
 * on `pie-register`.
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
	 * Load-bearing for precedence: the card re-runs its discovery whenever its
	 * content changes, so without this a host that supplied a third-party port would
	 * have it silently replaced by the native element mid-session — and the
	 * capabilities would flip back with it, which is exactly the "appears to enforce"
	 * failure this contract exists to prevent.
	 */
	origin?: "native-adapter" | "host";
}
