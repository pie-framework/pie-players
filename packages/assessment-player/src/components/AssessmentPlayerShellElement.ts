import { coerceBooleanLike } from "@pie-players/pie-players-shared";

/**
 * Layout scaffold for a host-composed assessment: host navigation above a body
 * that fills the remaining height. The scaffold renders in an open shadow root
 * and the host's children stay in its light DOM, where document styles reach
 * them, projecting into the slots.
 *
 * @slot navigation - Assessment navigation above the body; not rendered while
 *   `show-navigation` is false.
 * @slot - The body: the host's section player and any other assessment UI.
 */
export class AssessmentPlayerShellElement extends HTMLElement {
	static get observedAttributes() {
		return ["show-navigation"];
	}

	showNavigation: boolean | string | null | undefined = true;

	constructor() {
		super();
		this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.showNavigation =
			this.getAttribute("show-navigation") ?? this.showNavigation;
		this.render();
	}

	attributeChangedCallback(
		name: string,
		_oldValue: string | null,
		value: string | null,
	) {
		if (name === "show-navigation") this.showNavigation = value;
		this.render();
	}

	private render() {
		const showNavigation = coerceBooleanLike(this.showNavigation, true);
		const style = document.createElement("style");
		style.textContent = `
			:host {
				display: block;
				height: 100%;
				min-height: 0;
			}
			.pie-assessment-player-shell {
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 0;
				gap: 0.5rem;
			}
			.pie-assessment-player-shell__body {
				flex: 1 1 0;
				min-height: 0;
				overflow: hidden;
			}
		`;
		const root = document.createElement("div");
		root.className = "pie-assessment-player-shell";
		if (showNavigation) {
			const navSlot = document.createElement("slot");
			navSlot.name = "navigation";
			root.appendChild(navSlot);
		}
		const body = document.createElement("div");
		body.className = "pie-assessment-player-shell__body";
		const defaultSlot = document.createElement("slot");
		body.appendChild(defaultSlot);
		root.appendChild(body);
		this.shadowRoot?.replaceChildren(style, root);
	}
}
