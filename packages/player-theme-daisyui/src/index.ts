import {
	applyTokens,
	getBaseTokens,
	mergeTokens,
	resolveThemeMode,
	type PieThemeMode,
	type PieThemeScope,
} from "@pie-players/pie-players-shared/theming";

type VariableMap = Record<string, string>;
type DaisyMapping = Record<`--${string}`, string>;

const DAISY_TOKEN_MAPPING: DaisyMapping = {
	"--pie-text": "hsl(var(--bc))",
	"--pie-background": "hsl(var(--b1))",
	"--pie-background-dark": "hsl(var(--b2))",
	"--pie-secondary-background": "hsl(var(--b2))",
	"--pie-dropdown-background": "hsl(var(--b3))",
	"--pie-text-secondary": "hsl(var(--bc) / 0.75)",
	"--pie-primary": "hsl(var(--p))",
	"--pie-primary-light": "hsl(var(--p) / 0.7)",
	"--pie-primary-dark": "hsl(var(--p) / 0.85)",
	"--pie-faded-primary": "hsl(var(--p) / 0.15)",
	"--pie-secondary": "hsl(var(--s))",
	"--pie-secondary-light": "hsl(var(--s) / 0.7)",
	"--pie-secondary-dark": "hsl(var(--s) / 0.85)",
	"--pie-tertiary": "hsl(var(--a))",
	"--pie-tertiary-light": "hsl(var(--a) / 0.2)",
	"--pie-correct": "hsl(var(--su))",
	"--pie-correct-secondary": "hsl(var(--su) / 0.12)",
	"--pie-correct-tertiary": "hsl(var(--su) / 0.85)",
	"--pie-correct-icon": "hsl(var(--su) / 0.75)",
	"--pie-incorrect": "hsl(var(--er))",
	"--pie-incorrect-secondary": "hsl(var(--er) / 0.12)",
	"--pie-incorrect-icon": "hsl(var(--er) / 0.75)",
	"--pie-missing": "hsl(var(--wa))",
	"--pie-missing-icon": "hsl(var(--wa) / 0.75)",
	"--pie-disabled": "hsl(var(--n))",
	"--pie-disabled-secondary": "hsl(var(--n) / 0.7)",
	"--pie-border": "hsl(var(--bc) / 0.3)",
	"--pie-border-light": "hsl(var(--bc) / 0.2)",
	"--pie-border-dark": "hsl(var(--bc) / 0.5)",
	"--pie-border-gray": "hsl(var(--n))",
	"--pie-focus-checked": "hsl(var(--p) / 0.2)",
	"--pie-focus-checked-border": "hsl(var(--p) / 0.8)",
	"--pie-focus-unchecked": "hsl(var(--n) / 0.2)",
	"--pie-focus-unchecked-border": "hsl(var(--n))",
	"--pie-blue-grey-100": "hsl(var(--bc) / 0.08)",
	"--pie-blue-grey-300": "hsl(var(--bc) / 0.2)",
	"--pie-blue-grey-600": "hsl(var(--bc) / 0.45)",
	"--pie-blue-grey-900": "hsl(var(--bc) / 0.8)",
	"--pie-black": "#000000",
	"--pie-white": "#ffffff",
	"--pie-primary-text": "hsl(var(--bc))",
	"--choice-input-color": "hsl(var(--bc))",
	"--choice-input-selected-color": "hsl(var(--p))",
	"--choice-input-disabled-color": "hsl(var(--n))",
	"--feedback-correct-bg-color": "hsl(var(--su) / 0.12)",
	"--feedback-incorrect-bg-color": "hsl(var(--er) / 0.12)",
	"--before-right": "100%",
	"--before-top": "5px",
	"--before-border-width": "7px",
	"--before-border-color": "hsl(var(--su) / 0.6)",
	"--arrow-color": "hsl(var(--er))",
	"--tick-color": "hsl(var(--bc) / 0.55)",
	"--line-stroke": "hsl(var(--bc) / 0.4)",
	"--point-fill": "hsl(var(--p))",
	"--point-stroke": "hsl(var(--b1))",
	"--correct-answer-toggle-label-color": "hsl(var(--bc))",
};

const HTMLElementBase =
	typeof HTMLElement === "undefined"
		? (class {} as unknown as typeof HTMLElement)
		: HTMLElement;

function isThemeMode(value: string | null): value is PieThemeMode {
	return value === "light" || value === "dark" || value === "auto";
}

function isScope(value: string | null): value is PieThemeScope {
	return value === "self" || value === "document";
}

function parseVariableOverrides(value: unknown): VariableMap {
	if (!value) return {};
	if (typeof value === "string") {
		try {
			return parseVariableOverrides(JSON.parse(value) as unknown);
		} catch {
			return {};
		}
	}
	if (typeof value !== "object") return {};
	const out: VariableMap = {};
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		if (typeof key !== "string" || !key.startsWith("--")) continue;
		if (typeof raw === "string") out[key] = raw;
		else if (typeof raw === "number") out[key] = String(raw);
	}
	return out;
}

export class PieThemeDaisyUiElement extends HTMLElementBase {
	static get observedAttributes() {
		return ["theme", "scope", "variables"];
	}

	private mediaQuery: MediaQueryList | null = null;
	private readonly onMediaChange = () => this.applyTheme();
	private previousKeys = new Set<string>();
	private variablesOverride: VariableMap = {};

	get theme(): PieThemeMode {
		const value = this.getAttribute("theme");
		return isThemeMode(value) ? value : "light";
	}

	get scope(): PieThemeScope {
		const value = this.getAttribute("scope") ?? this.getAttribute("data-scope");
		return isScope(value) ? value : "self";
	}

	set variables(value: VariableMap) {
		this.variablesOverride = parseVariableOverrides(value);
		this.setAttribute("variables", JSON.stringify(this.variablesOverride));
		this.applyTheme();
	}

	connectedCallback() {
		this.setupAutoThemeListener();
		this.applyTheme();
	}

	disconnectedCallback() {
		if (this.mediaQuery) {
			this.mediaQuery.removeEventListener("change", this.onMediaChange);
		}
		this.mediaQuery = null;
	}

	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null,
	) {
		if (oldValue === newValue) return;
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
		const target = this.getTarget();
		const effectiveTheme = resolveThemeMode(this.theme);
		const tokens = mergeTokens(getBaseTokens(effectiveTheme), this.variablesOverride);
		target.setAttribute("data-theme", effectiveTheme);
		this.previousKeys = applyTokens(target, tokens, this.previousKeys);
		for (const [token, mappedValue] of Object.entries(DAISY_TOKEN_MAPPING)) {
			if (this.variablesOverride[token]) continue;
			target.style.setProperty(token, mappedValue);
		}
	}

	private setupAutoThemeListener() {
		if (this.mediaQuery) {
			this.mediaQuery.removeEventListener("change", this.onMediaChange);
			this.mediaQuery = null;
		}
		if (this.theme === "auto" && typeof window !== "undefined") {
			this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			this.mediaQuery.addEventListener("change", this.onMediaChange);
		}
	}
}

export function definePieThemeDaisyUi() {
	if (typeof customElements === "undefined") return;
	if (!customElements.get("pie-theme-daisyui")) {
		customElements.define("pie-theme-daisyui", PieThemeDaisyUiElement);
	}
}

definePieThemeDaisyUi();

