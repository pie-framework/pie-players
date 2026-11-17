const SVG_NS = "http://www.w3.org/2000/svg";

/** A corner-to-corner X, or one horizontal line through the middle. */
export type StrikeMarkShape = "cross" | "line";

export interface StrikeMarkClasses {
	/** On the `<svg>`, which the theme sizes or positions. */
	mark: string;
	/** On each painted line. */
	line: string;
	/** On the wider line under each painted one; omitted, there is none. */
	casing?: string;
}

const SHAPES: Record<StrikeMarkShape, ReadonlyArray<Record<string, string>>> = {
	cross: [
		{ x1: "0", y1: "0", x2: "100", y2: "100" },
		{ x1: "0", y1: "100", x2: "100", y2: "0" },
	],
	line: [{ x1: "0", y1: "50", x2: "100", y2: "50" }],
};

/**
 * A decorative SVG mark stretched over whatever box the theme gives it:
 * `preserveAspectRatio="none"` fits the 100x100 viewBox to any aspect ratio,
 * and `vector-effect="non-scaling-stroke"` keeps every line an even width under
 * that stretch. SVG strokes survive forced colours, where the gradients the
 * maths cross used to be drawn with are dropped.
 */
export function createStrikeMark(
	shape: StrikeMarkShape,
	classes: StrikeMarkClasses,
): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
	svg.setAttribute("class", classes.mark);
	svg.setAttribute("viewBox", "0 0 100 100");
	svg.setAttribute("preserveAspectRatio", "none");
	// The eliminated state is announced on the content.
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("focusable", "false");

	// Casings first, so the painted lines lie unbroken on top of all of them.
	const layers = classes.casing ? [classes.casing, classes.line] : [classes.line];
	for (const className of layers) {
		for (const coordinates of SHAPES[shape]) {
			const line = document.createElementNS(SVG_NS, "line");
			line.setAttribute("class", className);
			for (const [name, value] of Object.entries(coordinates)) {
				line.setAttribute(name, value);
			}
			line.setAttribute("vector-effect", "non-scaling-stroke");
			svg.appendChild(line);
		}
	}
	return svg;
}
