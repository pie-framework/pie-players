import type { PointerDragPosition } from "./pointer-drag.js";

export interface PointerRotateControllerArgs {
	/** Current rotation in degrees. */
	getRotation: () => number;
	/** Receives the next rotation in degrees, normalised to `[0, 360)`. */
	setRotation: (degrees: number) => void;
}

export interface PointerRotateController {
	isRotating: () => boolean;
	/**
	 * Begin tracking a rotation from a pointerdown on a rotation handle. `pivot`
	 * is the point the element turns about, in client coordinates. As with
	 * `createPointerDragController`, callers own pointer-capture release and
	 * listener attach/detach.
	 */
	startRotating: (
		event: PointerEvent,
		container: Element,
		pivot: PointerDragPosition,
	) => void;
	/** No-ops when a rotation isn't in progress. */
	handlePointerMove: (event: PointerEvent) => void;
	endRotating: () => void;
}

/** Normalises an angle in degrees to `[0, 360)`. */
export function normalizeDegrees(degrees: number): number {
	const turned = degrees % 360;
	return turned < 0 ? turned + 360 : turned;
}

function angleDegrees(pivot: PointerDragPosition, x: number, y: number): number {
	return (Math.atan2(y - pivot.y, x - pivot.x) * 180) / Math.PI;
}

/**
 * Tracks a pointer-capture-based rotation about a fixed pivot: the element
 * turns by the angle the pointer sweeps around the pivot since the press, so
 * grabbing the handle anywhere on its hit area causes no initial jump. The
 * rotation counterpart of `createPointerDragController`.
 */
export function createPointerRotateController(
	args: PointerRotateControllerArgs,
): PointerRotateController {
	let rotating = false;
	let pivot: PointerDragPosition = { x: 0, y: 0 };
	let startAngle = 0;
	let startRotation = 0;

	return {
		isRotating: () => rotating,
		startRotating(event, container, nextPivot) {
			container.setPointerCapture(event.pointerId);
			rotating = true;
			pivot = nextPivot;
			startAngle = angleDegrees(pivot, event.clientX, event.clientY);
			startRotation = args.getRotation();
		},
		handlePointerMove(event) {
			if (!rotating) return;
			const swept = angleDegrees(pivot, event.clientX, event.clientY) - startAngle;
			args.setRotation(normalizeDegrees(startRotation + swept));
		},
		endRotating() {
			rotating = false;
		},
	};
}
