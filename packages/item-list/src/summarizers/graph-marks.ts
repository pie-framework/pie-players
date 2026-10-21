import { isRecord, num, records } from "./shared.js";

interface Point {
	x: number;
	y: number;
}

function point(value: unknown): Point | undefined {
	if (!isRecord(value)) return undefined;
	const x = Number(value.x);
	const y = Number(value.y);
	return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

const pair = ({ x, y }: Point) => `(${num(x)},${num(y)})`;

/** `y = mx + b`, or `x = c` for a vertical line, through two points. */
export function lineEquation(from: Point, to: Point): string {
	if (from.x === to.x) return `x=${num(from.x)}`;
	const slope = (to.y - from.y) / (to.x - from.x);
	const intercept = from.y - slope * from.x;
	const term = slope === 0 ? "" : `${slope === 1 ? "" : slope === -1 ? "-" : num(slope)}x`;
	const constant = intercept === 0 && term ? "" : `${intercept < 0 || !term ? "" : "+"}${num(intercept)}`;
	return `y=${term}${constant}`;
}

/** `(x-h)` with the sign folded in. */
function shifted(variable: string, by: number): string {
	if (by === 0) return variable;
	return `(${variable}${by < 0 ? "+" : "-"}${num(Math.abs(by))})`;
}

function plus(value: number): string {
	return value === 0 ? "" : `${value < 0 ? "-" : "+"}${num(Math.abs(value))}`;
}

/**
 * A graph mark in TeX: an equation for lines and curves defined by a root and an edge point,
 * coordinates for points, segments, rays, vectors and polygons.
 */
export function describeMark(mark: Record<string, unknown>): string | undefined {
	const from = point(mark.from);
	const to = point(mark.to);
	const root = point(mark.root);
	const edge = point(mark.edge);
	switch (mark.type) {
		case "point": {
			const at = point(mark);
			return at && pair(at);
		}
		case "line":
			return from && to && lineEquation(from, to);
		case "segment":
			return from && to && `\\overline{${pair(from)}\\,${pair(to)}}`;
		case "ray":
			return from && to && `\\overrightarrow{${pair(from)}\\,${pair(to)}}`;
		case "vector":
			return from && to && `${pair(from)}\\to${pair(to)}`;
		case "circle": {
			if (!root || !edge) return undefined;
			const square = (edge.x - root.x) ** 2 + (edge.y - root.y) ** 2;
			return `${shifted("x", root.x)}^2+${shifted("y", root.y)}^2=${num(square)}`;
		}
		case "parabola": {
			if (!root || !edge || edge.x === root.x) return undefined;
			const a = (edge.y - root.y) / (edge.x - root.x) ** 2;
			return `y=${a === 1 ? "" : a === -1 ? "-" : num(a)}${shifted("x", root.x)}^2${plus(root.y)}`;
		}
		case "absolute": {
			if (!root || !edge || edge.x === root.x) return undefined;
			const a = (edge.y - root.y) / Math.abs(edge.x - root.x);
			return `y=${a === 1 ? "" : a === -1 ? "-" : num(a)}\\left|${root.x === 0 ? "x" : shifted("x", root.x).slice(1, -1)}\\right|${plus(root.y)}`;
		}
		case "sine":
		case "exponential":
			return root && edge && `${pair(root)},\\ ${pair(edge)}`;
		case "polygon": {
			const points = records(mark.points).flatMap((entry) => point(entry) ?? []);
			return points.length > 0 ? points.map(pair).join(",\\ ") : undefined;
		}
		default:
			return undefined;
	}
}
