function coerceBooleanLike(
	value: boolean | string | null | undefined,
	fallback = false,
): boolean {
	if (value == null) return fallback;
	if (typeof value === "boolean") return value;
	const normalized = value.trim().toLowerCase();
	return normalized === "" || normalized === "true" || normalized === "1" || normalized === "yes";
}

export class AssessmentPlayerShellElement extends HTMLElement {
	static get observedAttributes() {
		return ["show-navigation"];
	}

	showNavigation: boolean | string | null | undefined = true;

	connectedCallback() {
		this.showNavigation = this.getAttribute("show-navigation") ?? this.showNavigation;
		this.render();
	}

	attributeChangedCallback(name: string, _oldValue: string | null, value: string | null) {
		if (name === "show-navigation") this.showNavigation = value;
		this.render();
	}

	private render() {
		const showNavigation = coerceBooleanLike(this.showNavigation, true);
		this.innerHTML = "";
		const style = document.createElement("style");
		style.textContent = `
			:host {
				display: block;
				height: 100%;
				min-height: 0;
			}
			.pie-assessment-player-shell {
				display: grid;
				grid-template-rows: auto minmax(0, 1fr);
				height: 100%;
				min-height: 0;
				gap: 0.5rem;
			}
			.pie-assessment-player-shell__body {
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
		this.appendChild(style);
		this.appendChild(root);
	}
}
