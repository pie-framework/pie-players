export interface PointerGestureArgs {
	/** Receives every move of the pointer that began the gesture. */
	onMove: (event: PointerEvent) => void;
	/** Called once when the gesture ends, however it ends. */
	onEnd: () => void;
}

export interface PointerGesture {
	isActive: () => boolean;
	/**
	 * Claims a pointerdown for a gesture on `target`, returning whether it did.
	 * Declines a non-primary button, and any pointer while another gesture is
	 * active, so a second finger landing mid-drag neither moves nor pinches.
	 * The caller starts its drag or rotate controller after a claim, which
	 * takes the pointer capture this listens on.
	 */
	begin: (event: PointerEvent, target: HTMLElement) => boolean;
	/** Ends the active gesture, if any, and releases its pointer capture. */
	release: () => void;
}

/**
 * The lifecycle of one pointer gesture on a tool overlay: which pointer drives
 * it, the listeners on the element that captured it, and every way it can end.
 * `pointercancel` and `lostpointercapture` end it as well as `pointerup`,
 * because iPadOS cancels a touch it takes over for a system gesture, and a
 * gesture that waited for `pointerup` would stay stuck to the next touch.
 *
 * The claim calls `preventDefault`, which keeps a touch from scrolling or
 * zooming the page and a mouse press from selecting text, and also suppresses
 * the press's default focus: a caller whose keyboard alternatives act on a
 * focused element focuses it itself.
 */
export function createPointerGesture(args: PointerGestureArgs): PointerGesture {
	let pointerId: number | null = null;
	let target: HTMLElement | null = null;

	const handleMove = (event: PointerEvent) => {
		if (event.pointerId === pointerId) args.onMove(event);
	};
	const handleEnd = (event: PointerEvent) => {
		if (event.pointerId === pointerId) release();
	};

	function release() {
		const releasedTarget = target;
		const releasedPointerId = pointerId;
		pointerId = null;
		target = null;
		if (!releasedTarget || releasedPointerId === null) return;
		releasedTarget.removeEventListener("pointermove", handleMove);
		releasedTarget.removeEventListener("pointerup", handleEnd);
		releasedTarget.removeEventListener("pointercancel", handleEnd);
		releasedTarget.removeEventListener("lostpointercapture", handleEnd);
		if (releasedTarget.hasPointerCapture(releasedPointerId)) {
			releasedTarget.releasePointerCapture(releasedPointerId);
		}
		args.onEnd();
	}

	return {
		isActive: () => pointerId !== null,
		begin(event, nextTarget) {
			if (event.button !== 0 || pointerId !== null) return false;
			pointerId = event.pointerId;
			target = nextTarget;
			nextTarget.addEventListener("pointermove", handleMove);
			nextTarget.addEventListener("pointerup", handleEnd);
			nextTarget.addEventListener("pointercancel", handleEnd);
			nextTarget.addEventListener("lostpointercapture", handleEnd);
			event.preventDefault();
			return true;
		},
		release,
	};
}
