export type PointerDragPosition = { x: number; y: number };

export interface PointerDragControllerArgs {
	getPosition: () => PointerDragPosition;
	setPosition: (next: PointerDragPosition) => void;
	/** Called once a drag starts, before the first move — e.g. to bring the element to front. */
	onDragStart?: (container: Element) => void;
}

export interface PointerDragController {
	isDragging: () => boolean;
	/**
	 * Begin tracking a drag from a pointerdown. Callers own pointer-capture
	 * release and event-listener attach/detach — this only tracks the
	 * position math, since a caller may also need the same pointer-capture
	 * session for an unrelated interaction (e.g. a resize handle).
	 */
	startDragging: (event: PointerEvent, container: Element) => void;
	/** No-ops when a drag isn't in progress, so callers can route every pointermove through this unconditionally. */
	handlePointerMove: (event: PointerEvent) => void;
	endDragging: () => void;
}

/**
 * Tracks a pointer-capture-based drag: the position delta between where the
 * pointer went down (relative to the element's current position) and where
 * it currently is. Shared by every floating tool overlay that repositions
 * itself by dragging its own chrome.
 */
export function createPointerDragController(
	args: PointerDragControllerArgs,
): PointerDragController {
	let dragging = false;
	let dragStart: PointerDragPosition = { x: 0, y: 0 };

	return {
		isDragging: () => dragging,
		startDragging(event, container) {
			container.setPointerCapture(event.pointerId);
			dragging = true;
			const position = args.getPosition();
			dragStart = {
				x: event.clientX - position.x,
				y: event.clientY - position.y,
			};
			args.onDragStart?.(container);
		},
		handlePointerMove(event) {
			if (!dragging) return;
			args.setPosition({
				x: event.clientX - dragStart.x,
				y: event.clientY - dragStart.y,
			});
		},
		endDragging() {
			dragging = false;
		},
	};
}
