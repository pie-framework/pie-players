type ThemeMode = "light" | "dark" | "auto";
type ThemeScope = "self" | "document";
type ThemeVariables = Record<string, string>;

const HTMLElementBase =
	typeof HTMLElement === "undefined"
		? (class {} as unknown as typeof HTMLElement)
		: HTMLElement;

const LIGHT_THEME_VARS: ThemeVariables = {
	"--pie-text": "black",
	"--pie-disabled": "grey",
	"--pie-disabled-secondary": "#ababab",
	"--pie-correct": "#4caf50",
	"--pie-correct-secondary": "#e8f5e9",
	"--pie-correct-tertiary": "#0ea449",
	"--pie-correct-icon": "#087d38",
	"--pie-incorrect": "#ff9800",
	"--pie-incorrect-secondary": "#ffebee",
	"--pie-incorrect-icon": "#bf0d00",
	"--pie-missing": "#d32f2f",
	"--pie-missing-icon": "#6a78a1",
	"--pie-primary": "#3f51b5",
	"--pie-primary-light": "#9fa8da",
	"--pie-primary-dark": "#283593",
	"--pie-faded-primary": "#dcdafb",
	"--pie-secondary": "#f50057",
	"--pie-secondary-light": "#f48fb1",
	"--pie-secondary-dark": "#880e4f",
	"--pie-tertiary": "#146eb3",
	"--pie-tertiary-light": "#d0e2f0",
	"--pie-background": "rgba(255, 255, 255, 0)",
	"--pie-background-dark": "#ecedf1",
	"--pie-secondary-background": "rgba(241, 241, 241, 1)",
	"--pie-dropdown-background": "#e0e1e6",
	"--pie-border": "#9a9a9a",
	"--pie-border-light": "#d1d1d1",
	"--pie-border-dark": "#646464",
	"--pie-border-gray": "#7e8494",
	"--pie-black": "#000000",
	"--pie-white": "#ffffff",
	"--pie-focus-checked": "#bbdefb",
	"--pie-focus-checked-border": "#1565c0",
	"--pie-focus-unchecked": "#e0e0e0",
	"--pie-focus-unchecked-border": "#757575",
	"--pie-blue-grey-100": "#f3f5f7",
	"--pie-blue-grey-300": "#c0c3cf",
	"--pie-blue-grey-600": "#7e8494",
	"--pie-blue-grey-900": "#152452"
};

const DARK_THEME_VARS: ThemeVariables = {
	"--pie-text": "#ffffff",
	"--pie-disabled": "#999999",
	"--pie-disabled-secondary": "#777777",
	"--pie-correct": "#00ff00",
	"--pie-correct-secondary": "#003300",
	"--pie-correct-tertiary": "#00cc00",
	"--pie-correct-icon": "#00ff00",
	"--pie-incorrect": "#ff3333",
	"--pie-incorrect-secondary": "#330000",
	"--pie-incorrect-icon": "#ff0000",
	"--pie-missing": "#ff6666",
	"--pie-missing-icon": "#6666ff",
	"--pie-primary": "#ffff00",
	"--pie-primary-light": "#ffff99",
	"--pie-primary-dark": "#cccc00",
	"--pie-faded-primary": "#666600",
	"--pie-secondary": "#ff00ff",
	"--pie-secondary-light": "#ff99ff",
	"--pie-secondary-dark": "#cc00cc",
	"--pie-tertiary": "#00ffff",
	"--pie-tertiary-light": "#99ffff",
	"--pie-background": "#000000",
	"--pie-background-dark": "#1a1a1a",
	"--pie-secondary-background": "#222222",
	"--pie-dropdown-background": "#2a2a2a",
	"--pie-border": "#ffffff",
	"--pie-border-light": "#cccccc",
	"--pie-border-dark": "#ffffff",
	"--pie-border-gray": "#aaaaaa",
	"--pie-black": "#ffffff",
	"--pie-white": "#000000",
	"--pie-focus-checked": "#ffff00",
	"--pie-focus-checked-border": "#ffff00",
	"--pie-focus-unchecked": "#666666",
	"--pie-focus-unchecked-border": "#ffffff",
	"--pie-blue-grey-100": "#2a2a2a",
	"--pie-blue-grey-300": "#555555",
	"--pie-blue-grey-600": "#999999",
	"--pie-blue-grey-900": "#ffffff"
};

function isThemeMode(value: string | null): value is ThemeMode {
	return value === "light" || value === "dark" || value === "auto";
}

function isThemeScope(value: string | null): value is ThemeScope {
	return value === "self" || value === "document";
}

function parseVariableOverrides(value: unknown): ThemeVariables {
	if (!value) {
		return {};
	}

	if (typeof value === "string") {
		try {
			return parseVariableOverrides(JSON.parse(value) as unknown);
		} catch {
			return {};
		}
	}

	if (typeof value !== "object") {
		return {};
	}

	const output: ThemeVariables = {};
	for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
		if (!key.startsWith("--")) {
			continue;
		}

		if (typeof rawValue === "string") {
			output[key] = rawValue;
		} else if (typeof rawValue === "number") {
			output[key] = String(rawValue);
		}
	}
	return output;
}

export class PieThemeElement extends HTMLElementBase {
	static get observedAttributes() {
		return ["theme", "scope", "variables"];
	}

	private mediaQuery: MediaQueryList | null = null;
	private readonly onMediaChange = () => this.applyTheme();
	private previousKeys = new Set<string>();
	private variablesOverride: ThemeVariables = {};

	get theme(): ThemeMode {
		const value = this.getAttribute("theme");
		return isThemeMode(value) ? value : "light";
	}

	set theme(value: ThemeMode) {
		this.setAttribute("theme", value);
	}

	get scope(): ThemeScope {
		const value = this.getAttribute("scope");
		return isThemeScope(value) ? value : "self";
	}

	set scope(value: ThemeScope) {
		this.setAttribute("scope", value);
	}

	get variables(): ThemeVariables {
		return { ...this.variablesOverride };
	}

	set variables(value: ThemeVariables) {
		this.variablesOverride = parseVariableOverrides(value);
		this.setAttribute("variables", JSON.stringify(this.variablesOverride));
		this.applyTheme();
	}

	connectedCallback() {
		if (!this.style.display) {
			this.style.display = "contents";
		}
		this.setupAutoThemeListener();
		this.applyTheme();
	}

	disconnectedCallback() {
		if (this.mediaQuery) {
			this.mediaQuery.removeEventListener("change", this.onMediaChange);
		}
		this.mediaQuery = null;

		if (this.scope === "self") {
			this.clearPreviousKeys(this);
			this.removeAttribute("data-theme");
		}
	}

	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null
	) {
		if (oldValue === newValue) {
			return;
		}

		if (name === "variables") {
			this.variablesOverride = parseVariableOverrides(newValue);
		}

		if (name === "theme") {
			this.setupAutoThemeListener();
		}

		this.applyTheme();
	}

	protected getTarget(): HTMLElement {
		if (this.scope === "document") {
			return document.documentElement;
		}
		return this;
	}

	protected applyTheme() {
		if (typeof document === "undefined" || typeof window === "undefined") {
			return;
		}

		const effectiveTheme = this.resolveEffectiveTheme();
		const target = this.getTarget();
		const themeVars = effectiveTheme === "dark" ? DARK_THEME_VARS : LIGHT_THEME_VARS;
		const vars = {
			...themeVars,
			...this.variablesOverride
		};

		target.setAttribute("data-theme", effectiveTheme);
		this.clearPreviousKeys(target);
		for (const [key, value] of Object.entries(vars)) {
			target.style.setProperty(key, value);
		}
		this.previousKeys = new Set(Object.keys(vars));
	}

	private resolveEffectiveTheme(): "light" | "dark" {
		if (this.theme === "auto") {
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			return prefersDark ? "dark" : "light";
		}
		return this.theme;
	}

	private clearPreviousKeys(target: HTMLElement) {
		for (const key of this.previousKeys) {
			target.style.removeProperty(key);
		}
	}

	private setupAutoThemeListener() {
		if (typeof window === "undefined") {
			return;
		}

		if (this.mediaQuery) {
			this.mediaQuery.removeEventListener("change", this.onMediaChange);
			this.mediaQuery = null;
		}

		if (this.theme === "auto") {
			this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			this.mediaQuery.addEventListener("change", this.onMediaChange);
		}
	}
}

export function definePieTheme(tagName = "pie-theme") {
	if (typeof customElements === "undefined") {
		return;
	}

	if (!customElements.get(tagName)) {
		customElements.define(tagName, PieThemeElement);
	}
}
