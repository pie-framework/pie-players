import {
	applyTokens,
	getBaseTokens,
	mergeTokens,
	resolveThemeMode,
	type PieThemeMode,
	type PieThemeScope,
} from "@pie-players/pie-players-shared/theming";

type VariableMap = Record<string, string>;

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

export class PieThemeElement extends HTMLElementBase {
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

	set theme(value: PieThemeMode) {
		this.setAttribute("theme", value);
	}

	get scope(): PieThemeScope {
		const value = this.getAttribute("scope") ?? this.getAttribute("data-scope");
		return isScope(value) ? value : "self";
	}

	set scope(value: PieThemeScope) {
		this.setAttribute("scope", value);
	}

	get variables(): VariableMap {
		return { ...this.variablesOverride };
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

		if (this.scope === "self") {
			for (const key of this.previousKeys) {
				this.style.removeProperty(key);
			}
			this.removeAttribute("data-theme");
		}
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

	protected resolveDataTheme(themeName: "light" | "dark"): string {
		return themeName;
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
		target.setAttribute("data-theme", this.resolveDataTheme(effectiveTheme));
		this.previousKeys = applyTokens(target, tokens, this.previousKeys);
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

export function definePieTheme() {
	if (typeof customElements === "undefined") return;
	if (!customElements.get("pie-theme")) {
		customElements.define("pie-theme", PieThemeElement);
	}
}

definePieTheme();

