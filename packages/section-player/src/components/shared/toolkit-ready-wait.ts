/**
 * The section controller lookups behind `waitForSectionController`.
 *
 * The toolkit emits `toolkit-ready` once each section's controller has
 * resolved, and the event bubbles, composed, through every element around it.
 * A wait listens for it on `target` and looks the controller up again each time
 * it arrives, then once more at the timeout.
 */

/** The longest delay `setTimeout` holds; a longer one fires at once. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Resolves with the first controller `lookup` returns after a `toolkit-ready`
 * reaches `target`, or with what it returns at `timeoutMs`. A `timeoutMs` that
 * is not finite, or too long for a timer, waits for the event alone.
 */
export function waitForToolkitReady<Controller>(
	target: EventTarget | null,
	lookup: (event?: Event) => Controller | null,
	timeoutMs: number,
): Promise<Controller | null> {
	return new Promise((resolve) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = (controller: Controller | null) => {
			if (timer !== undefined) clearTimeout(timer);
			target?.removeEventListener("toolkit-ready", onToolkitReady);
			resolve(controller);
		};
		const onToolkitReady = (event: Event) => {
			const controller = lookup(event);
			if (controller) finish(controller);
		};
		target?.addEventListener("toolkit-ready", onToolkitReady);
		if (timeoutMs >= 0 && timeoutMs <= MAX_TIMER_MS) {
			timer = setTimeout(() => finish(lookup()), timeoutMs);
		}
	});
}
