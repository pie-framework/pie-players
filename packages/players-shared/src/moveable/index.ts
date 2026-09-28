/**
 * Moveable, bundled once for every PIE tool that drags or rotates.
 *
 * The build bundles `moveable` and its dependencies into this module's `dist`
 * file (see `scripts/bundle-vendored-modules.mjs`), so hosts install nothing for it and
 * the ruler and protractor share one copy. `moveable` imports `framework-utils`
 * without declaring it, which strict installs (pnpm `hoist: false`, Yarn PnP)
 * cannot resolve from the host's `node_modules`.
 *
 * The types describe the slice of Moveable's surface the tools use, so the
 * published declarations reference no `moveable` types.
 */
import Moveable from "moveable";

export interface MoveableBounds {
	left: number;
	top: number;
	right: number;
	bottom: number;
	position?: "css" | "client";
}

export interface MoveableOptions {
	target: HTMLElement;
	draggable?: boolean;
	rotatable?: boolean;
	snappable?: boolean;
	originDraggable?: boolean;
	originRelative?: boolean;
	/** Transform origin as fractions of the target's width and height. */
	origin?: [number, number];
	hideDefaultLines?: boolean;
	keepRatio?: boolean;
	bounds?: MoveableBounds;
}

export interface MoveableTransformEvent {
	target: HTMLElement;
	transform: string;
}

export interface MoveableInstance {
	bounds: MoveableBounds;
	destroy(): void;
	updateRect(): void;
	getControlBoxElement(): HTMLElement;
	on(
		event: "drag" | "rotate",
		handler: (payload: MoveableTransformEvent) => void,
	): void;
}

/**
 * `moveable` publishes CJS with ESM-shaped declarations and no `exports` map,
 * so under `moduleResolution: NodeNext` TypeScript types the default import as
 * the module namespace. The bundled ESM build's default export is the class.
 */
const MoveableCtor = Moveable as unknown as new (
	container: HTMLElement,
	options: MoveableOptions,
) => MoveableInstance;

/** Attaches Moveable's controls for `options.target` to `container`. */
export function createMoveable(
	container: HTMLElement,
	options: MoveableOptions,
): MoveableInstance {
	return new MoveableCtor(container, options);
}
