/**
 * Placement of a tool overlay the learner moves and turns: the ruler and the
 * protractor. One controller holds where the tool sits and is the only writer of
 * its `style.transform`, so a drag, an arrow key and a tap control always agree
 * about where the tool is.
 */

import {
	clampOffsetOverlappingBlock,
	type Point,
	resolveContainingBlockRect,
	rotatedExtent,
	rotationCentreShift,
	type Size,
	uprightDockCentre,
} from "./overlay-containment.js";
import { createPointerDragController } from "./pointer-drag.js";
import { createPointerGesture } from "./pointer-gesture.js";
import { createPointerRotateController } from "./pointer-rotate.js";

/** An offset from the tool's centred position, and its turn about its pivot. */
export interface OverlayPlacement {
	x: number;
	y: number;
	rotation: number;
}

/** Pixels an arrow key or move button shifts the tool. */
export const OVERLAY_PLACEMENT_MOVE_STEP = 10;
/** Degrees Shift+arrow turns the tool. */
export const OVERLAY_PLACEMENT_ROTATE_STEP = 5;
/** Degrees Page Up/Down turns the tool. */
export const OVERLAY_PLACEMENT_FINE_ROTATE_STEP = 1;

/** Each move, with its tap control's glyph and label and its announcement. */
export const OVERLAY_PLACEMENT_NUDGES = {
	left: {
		dx: -1,
		dy: 0,
		glyph: "←",
		labelKey: "toolkit.window.moveLeftA11y",
		announceKey: "toolkit.announce.movedLeft",
	},
	up: {
		dx: 0,
		dy: -1,
		glyph: "↑",
		labelKey: "toolkit.window.moveUpA11y",
		announceKey: "toolkit.announce.movedUp",
	},
	down: {
		dx: 0,
		dy: 1,
		glyph: "↓",
		labelKey: "toolkit.window.moveDownA11y",
		announceKey: "toolkit.announce.movedDown",
	},
	right: {
		dx: 1,
		dy: 0,
		glyph: "→",
		labelKey: "toolkit.window.moveRightA11y",
		announceKey: "toolkit.announce.movedRight",
	},
} as const;

export type OverlayPlacementNudge = keyof typeof OVERLAY_PLACEMENT_NUDGES;

/** The interface-catalog keys a move or turn is announced with. */
export type OverlayPlacementAnnouncement =
	| (typeof OVERLAY_PLACEMENT_NUDGES)[OverlayPlacementNudge]["announceKey"]
	| "toolkit.announce.rotatedTo";

/** The tap controls' rotations, the keyboard's two steps each way. */
export const OVERLAY_PLACEMENT_ROTATIONS = [
	-OVERLAY_PLACEMENT_ROTATE_STEP,
	-OVERLAY_PLACEMENT_FINE_ROTATE_STEP,
	OVERLAY_PLACEMENT_FINE_ROTATE_STEP,
	OVERLAY_PLACEMENT_ROTATE_STEP,
] as const;

const ARROW_KEYS: Record<string, OverlayPlacementNudge> = {
	ArrowLeft: "left",
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowRight: "right",
};

/** Pixels of the tool kept inside its containing block on each axis. */
const MIN_VISIBLE = 100;
/** Space between the tool's bottom edge and its tap controls. */
const CONTROLS_GAP = 8;

export interface OverlayPlacementOptions {
	/** The tool's positioned element, which receives the transform. */
	getElement: () => HTMLElement | undefined;
	/** The tap controls, docked level past the tool's bottom edge. */
	getControls: () => HTMLElement | undefined;
	/**
	 * The point the tool turns about, from its top-left corner at no turn.
	 * Defaults to its centre, and must match the stylesheet's `transform-origin`.
	 */
	pivot?: (size: Size) => Point;
	/**
	 * That pivot on screen when a pointer rotation starts, or `undefined` to
	 * decline it. Defaults to the centre of the tool's bounding box, which a turn
	 * about the centre leaves in place.
	 */
	getScreenPivot?: () => Point | undefined;
	/** Raises the tool above its peers when a gesture starts or it is shown. */
	bringToFront?: (element: HTMLElement) => void;
	/** Speaks a move or turn; the tool resolves the key in its interface catalog. */
	announce: (
		key: OverlayPlacementAnnouncement,
		params: Record<string, number>,
	) => void;
}

export interface OverlayPlacementController {
	readonly placement: OverlayPlacement;
	/**
	 * Writes `next` to `style.transform`, first keeping part of the turned tool
	 * inside the box it is positioned against. The bound lets the tool overhang:
	 * an item card is barely wider than a ruler, and full containment would pin
	 * its zero mark to the card's edge. The card clips what overhangs, and 100px
	 * stays in view to grab it back.
	 */
	apply: (next: OverlayPlacement) => void;
	/** Raises the tool and re-applies its placement, as a fresh reveal does. */
	show: () => void;
	/** Ends any gesture and returns the tool to its centred, upright position. */
	reset: () => void;
	/** Starts a drag from a press on the tool. */
	startDrag: (event: PointerEvent) => void;
	/** Starts a turn from a press on `handle`, which must not also start a drag. */
	startRotate: (event: PointerEvent, handle: HTMLElement) => void;
	/** Moves the tool one step, as an arrow key or a move button does. */
	nudge: (direction: OverlayPlacementNudge) => void;
	/** Turns the tool by `degrees`, clockwise when positive, to a whole degree. */
	rotateBy: (degrees: number) => void;
	/**
	 * Arrows move, Shift+arrows turn 5°, Page Up/Down turn 1°. Returns whether
	 * it handled the key, having prevented its default.
	 */
	handleKeyDown: (event: KeyboardEvent) => boolean;
	/**
	 * Re-applies the placement on window resize, which can leave the tool outside
	 * its shrunken containing block. Returns a cleanup that also ends any gesture.
	 */
	connect: () => () => void;
}

export function createOverlayPlacement(
	options: OverlayPlacementOptions,
): OverlayPlacementController {
	let placement: OverlayPlacement = { x: 0, y: 0, rotation: 0 };

	const sizeOf = (element: HTMLElement): Size => ({
		width: element.offsetWidth,
		height: element.offsetHeight,
	});

	function dockControls(element: HTMLElement) {
		const controls = options.getControls();
		if (!controls) return;
		// Counter-rotated, so each arrow points the way its button moves the tool.
		const centre = uprightDockCentre(
			sizeOf(element),
			sizeOf(controls),
			placement.rotation,
			CONTROLS_GAP,
		);
		controls.style.transform = `translate(${centre.x}px, ${centre.y}px) translate(-50%, -50%) rotate(${-placement.rotation}deg)`;
	}

	function apply(next: OverlayPlacement) {
		const element = options.getElement();
		if (!element) return;
		const block = resolveContainingBlockRect(element);
		const size = sizeOf(element);
		// A tool turning off its centre has its turned extent centred off its
		// translate offset by this shift; the clamp bounds that centre.
		const shift = options.pivot
			? rotationCentreShift(size, options.pivot(size), next.rotation)
			: { x: 0, y: 0 };
		const centre = { x: next.x + shift.x, y: next.y + shift.y };
		const bounded = block
			? clampOffsetOverlappingBlock(
					centre,
					rotatedExtent(size, next.rotation),
					block,
					MIN_VISIBLE,
				)
			: centre;
		placement = {
			x: bounded.x - shift.x,
			y: bounded.y - shift.y,
			rotation: next.rotation,
		};
		element.style.transform = `translate(-50%, -50%) translate(${placement.x}px, ${placement.y}px) rotate(${placement.rotation}deg)`;
		dockControls(element);
	}

	const dragController = createPointerDragController({
		getPosition: () => ({ x: placement.x, y: placement.y }),
		setPosition: (next) => apply({ ...placement, ...next }),
	});
	const rotateController = createPointerRotateController({
		getRotation: () => placement.rotation,
		setRotation: (rotation) => apply({ ...placement, rotation }),
	});
	const gesture = createPointerGesture({
		onMove: (event) => {
			dragController.handlePointerMove(event);
			rotateController.handlePointerMove(event);
		},
		onEnd: () => {
			dragController.endDragging();
			rotateController.endRotating();
		},
	});

	/**
	 * Claims a press for a drag or turn. The claim's `preventDefault` suppresses
	 * the press's default focus, so focus the tool here: the arrow-key
	 * alternatives act on it.
	 */
	function claim(
		event: PointerEvent,
		element: HTMLElement,
		target: HTMLElement,
	) {
		if (!gesture.begin(event, target)) return false;
		element.focus({ preventScroll: true });
		return true;
	}

	const screenPivot = (): Point | undefined => {
		if (options.getScreenPivot) return options.getScreenPivot();
		const rect = options.getElement()?.getBoundingClientRect();
		return (
			rect && { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
		);
	};

	function nudge(direction: OverlayPlacementNudge) {
		const { dx, dy, announceKey } = OVERLAY_PLACEMENT_NUDGES[direction];
		apply({
			x: placement.x + dx * OVERLAY_PLACEMENT_MOVE_STEP,
			y: placement.y + dy * OVERLAY_PLACEMENT_MOVE_STEP,
			rotation: placement.rotation,
		});
		options.announce(announceKey, {
			position: Math.round(dx ? placement.x : placement.y),
		});
	}

	function rotateBy(degrees: number) {
		const rotation =
			(((Math.round(placement.rotation) + degrees) % 360) + 360) % 360;
		apply({ ...placement, rotation });
		options.announce("toolkit.announce.rotatedTo", { degrees: rotation });
	}

	const reapply = () => apply(placement);

	return {
		get placement() {
			return placement;
		},
		apply,
		show() {
			const element = options.getElement();
			if (!element) return;
			options.bringToFront?.(element);
			reapply();
		},
		reset() {
			gesture.release();
			placement = { x: 0, y: 0, rotation: 0 };
		},
		startDrag(event) {
			const element = options.getElement();
			if (!element) return;
			options.bringToFront?.(element);
			if (!claim(event, element, element)) return;
			dragController.startDragging(event, element);
		},
		startRotate(event, handle) {
			event.stopPropagation();
			const element = options.getElement();
			const pivot = screenPivot();
			if (!element || !pivot) return;
			options.bringToFront?.(element);
			if (!claim(event, element, handle)) return;
			rotateController.startRotating(event, handle, pivot);
		},
		nudge,
		rotateBy,
		handleKeyDown(event) {
			const direction = ARROW_KEYS[event.key];
			if (direction && event.shiftKey) {
				rotateBy(
					direction === "up" || direction === "left"
						? -OVERLAY_PLACEMENT_ROTATE_STEP
						: OVERLAY_PLACEMENT_ROTATE_STEP,
				);
			} else if (direction) {
				nudge(direction);
			} else if (event.key === "PageUp") {
				rotateBy(-OVERLAY_PLACEMENT_FINE_ROTATE_STEP);
			} else if (event.key === "PageDown") {
				rotateBy(OVERLAY_PLACEMENT_FINE_ROTATE_STEP);
			} else {
				return false;
			}
			event.preventDefault();
			return true;
		},
		connect() {
			window.addEventListener("resize", reapply);
			return () => {
				gesture.release();
				window.removeEventListener("resize", reapply);
			};
		},
	};
}
