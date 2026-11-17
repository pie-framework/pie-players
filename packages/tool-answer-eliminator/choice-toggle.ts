import {
	applyNdsGlyphVariant,
	installFontAwesomeInShadow,
} from "@pie-players/pie-players-shared/ui/fontawesome";

export const TOGGLE_CLASS = "pie-answer-eliminator-toggle";
const ACTIVE_CLASS = "pie-answer-eliminator-toggle--active";
const PLAIN_CLASS = "pie-answer-eliminator-toggle--plain";
const NDS_CLASS = "pie-answer-eliminator-toggle--nds";
const ICON_CLASS = "pie-answer-eliminator-toggle-icon";
const NDS_TAG = "pie-nds-icon-button";
const SVG_NS = "http://www.w3.org/2000/svg";

/*
 * NDS palette bridge, the mapping tool-tts-inline and the assessment-toolkit
 * ItemToolBar declare (asserted by scripts/check-theme-tokens.mjs). The
 * vendored button paints from the NDS palette, which no PIE theme sets. It is
 * inline because the toggle mounts in whatever tree the item renders into.
 */
const NDS_IDLE_ACCENT = "var(--pie-button-color, var(--pie-text, #222))";
const NDS_ACTIVE_ACCENT =
	"var(--pie-tool-trigger-active-color, var(--pie-button-color, var(--pie-text, #222)))";
const NDS_PALETTE_BRIDGE = [
	"--color-interactive-blue: var(--pie-button-color, var(--pie-text, #222));",
	"--color-new-gray: var(--pie-background-dark, #f3f5f7);",
	"--color-primary-white: var(--pie-white, #ffffff);",
	"--color-primary-black: var(--pie-text, #000000);",
	"--color-focus-blue: var(--pie-button-focus-outline, #2b87ff);",
].join(" ");

/**
 * `reserved` hides the toggle and keeps its space, so selecting a choice does
 * not reflow it; `removed` takes it out of the layout.
 */
export type ToggleVisibility = "shown" | "reserved" | "removed";

export interface ToggleEvents {
	activate(): void;
	focus(): void;
	blur(): void;
}

/** One choice's toggle, a plain button or the NDS icon button. */
export interface ChoiceToggle {
	readonly element: HTMLElement;
	readonly nds: boolean;
	/** Appends the toggle as the container's last child. */
	mount(container: HTMLElement): void;
	setLabel(label: string, stamp: (element: Element) => void): void;
	setPressed(pressed: boolean): void;
	setVisibility(visibility: ToggleVisibility): void;
	focus(): void;
	destroy(): void;
}

/** Whether `<pie-nds-icon-button>` is registered, so a toggle can be one. */
export const ndsToggleAvailable = (): boolean =>
	typeof customElements !== "undefined" && !!customElements.get(NDS_TAG);

/**
 * Creates a toggle, the NDS icon button when asked for and registered. Created
 * before registration, the element would take every attribute literally.
 */
export function createChoiceToggle(
	nds: boolean,
	choiceId: string,
	events: ToggleEvents,
): ChoiceToggle {
	return nds && ndsToggleAvailable()
		? createNdsToggle(choiceId, events)
		: createPlainToggle(choiceId, events);
}

function setVisibility(element: HTMLElement, visibility: ToggleVisibility) {
	const display = visibility === "removed" ? "none" : "";
	const hidden = visibility === "reserved" ? "hidden" : "";
	// Unchanged values are not rewritten, so a refresh does not churn the DOM.
	if (element.style.display !== display) element.style.display = display;
	if (element.style.visibility !== hidden) element.style.visibility = hidden;
}

function activateOnClick(element: HTMLElement, events: ToggleEvents) {
	element.addEventListener("click", (event) => {
		// The toggle can sit inside the choice's label, which must not select it.
		event.preventDefault();
		event.stopPropagation();
		events.activate();
	});
}

/** A plus, which the theme turns 45° to read as × until pressed. */
function createIcon(): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
	svg.setAttribute("class", ICON_CLASS);
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("focusable", "false");
	const path = document.createElementNS(SVG_NS, "path");
	path.setAttribute("d", "M8 2.5v11M2.5 8h11");
	svg.appendChild(path);
	return svg;
}

function createPlainToggle(
	choiceId: string,
	events: ToggleEvents,
): ChoiceToggle {
	const button = document.createElement("button");
	button.type = "button";
	button.className = `${TOGGLE_CLASS} ${PLAIN_CLASS}`;
	button.setAttribute("aria-pressed", "false");
	button.setAttribute("data-choice-id", choiceId);
	button.appendChild(createIcon());
	activateOnClick(button, events);
	button.addEventListener("focus", events.focus);
	button.addEventListener("blur", events.blur);

	return {
		element: button,
		nds: false,
		mount: (container) => container.appendChild(button),
		setLabel(label, stamp) {
			button.setAttribute("aria-label", label);
			stamp(button);
		},
		setPressed(pressed) {
			button.classList.toggle(ACTIVE_CLASS, pressed);
			button.setAttribute("aria-pressed", String(pressed));
		},
		setVisibility: (visibility) => setVisibility(button, visibility),
		focus: () => button.focus({ preventScroll: true }),
		destroy: () => button.remove(),
	};
}

function createNdsToggle(choiceId: string, events: ToggleEvents): ChoiceToggle {
	// The literal tag lets check-theme-tokens find this mount and its bridge.
	const host = document.createElement("pie-nds-icon-button");
	host.className = `${TOGGLE_CLASS} ${NDS_CLASS}`;
	host.style.cssText = NDS_PALETTE_BRIDGE;
	host.setAttribute("type", "circle");
	host.setAttribute("size", "small");
	host.setAttribute("variant", "secondary");
	host.setAttribute("icon-name", "plus");
	host.setAttribute("data-choice-id", choiceId);
	activateOnClick(host, events);
	host.addEventListener("focusin", events.focus);
	host.addEventListener("focusout", events.blur);

	// The button exposes only `button-aria-label` on the inner <button>, which
	// Lit creates after the first update, so the pressed state is reflected
	// onto it whenever it renders.
	let pressed = false;
	const inner = () => host.querySelector("button");
	const reflectPressed = () => {
		const button = inner();
		if (button && button.getAttribute("aria-pressed") !== String(pressed)) {
			button.setAttribute("aria-pressed", String(pressed));
		}
	};
	const ariaObserver = new MutationObserver(reflectPressed);
	ariaObserver.observe(host, { childList: true, subtree: true });
	// Every glyph is FA Solid, which FA Free carries.
	const disconnectGlyph = applyNdsGlyphVariant(host, "fa-solid");

	return {
		element: host,
		nds: true,
		mount(container) {
			container.appendChild(host);
			installFontAwesomeInShadow(host);
			reflectPressed();
		},
		setLabel(label, stamp) {
			host.setAttribute("button-aria-label", label);
			stamp(host);
		},
		setPressed(next) {
			pressed = next;
			host.classList.toggle(ACTIVE_CLASS, next);
			host.style.setProperty(
				"--color-interactive-blue",
				next ? NDS_ACTIVE_ACCENT : NDS_IDLE_ACCENT,
			);
			reflectPressed();
		},
		setVisibility: (visibility) => setVisibility(host, visibility),
		focus: () => (inner() ?? host).focus({ preventScroll: true }),
		destroy() {
			ariaObserver.disconnect();
			disconnectGlyph();
			host.remove();
		},
	};
}
