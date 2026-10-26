/** The legacy `keyCode` a browser reports for a keydown the IME consumes. */
const IME_PROCESS_KEY_CODE = 229;

/**
 * Whether a keydown belongs to an IME composition, so it must not act as a
 * shortcut. Safari reports `isComposing` false on the Enter that commits a
 * composition and marks it only with `keyCode` 229.
 */
export function isComposingKeyEvent(
	event: Pick<KeyboardEvent, "isComposing" | "keyCode">,
): boolean {
	return event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE;
}
