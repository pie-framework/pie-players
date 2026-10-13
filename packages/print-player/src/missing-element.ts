import type { MissingElFn, PkgResolution } from "./types.js";

/**
 * Default missing element placeholder
 *
 * Creates a custom element that displays an error message for failed loads.
 * The message is set as text: it can carry a resolver's or loader's error text.
 */
export const defaultMissingElement: MissingElFn = (
	pkg: PkgResolution,
	message?: string,
): any =>
	class extends HTMLElement {
		connectedCallback() {
			// The error frame follows the theme's incorrect family: bare `red` on
			// white measures 4:1 and fails SC 1.4.3, and print output is the one
			// surface where nobody notices until it is on paper.
			const frame = document.createElement("div");
			frame.style.cssText =
				"border: solid 1px var(--pie-incorrect, darkred); margin: 10px; padding: 10px;";
			const title = document.createElement("div");
			title.style.cssText = "color: var(--pie-incorrect, #b00000)";
			title.textContent = `Cannot load ${pkg.tagName}`;
			const detail = document.createElement("div");
			detail.style.cssText =
				"font-size:0.8em; color: var(--pie-incorrect, darkred);";
			detail.textContent = message || "Unknown error";
			frame.append(title, document.createElement("br"), detail);
			this.replaceChildren(frame);
		}
	};
