import { resolvePieColorSchemeVariables } from "./color-schemes.js";
import { DARK_THEME_VARS, LIGHT_THEME_VARS } from "./theme-defaults.js";
import { resolveProviderVariables } from "./providers.js";
import { isThemeMode, isThemeScope, type ThemeMode, type ThemeScope, type ThemeVariables } from "./theme-types.js";

const HTMLElementBase =
	typeof HTMLElement === "undefined"
		? (class {} as unknown as typeof HTMLElement)
		: HTMLElement;

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
	for (const [key, rawValue] of Object.entries(
		value as Record<string, unknown>,
	)) {
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
		return ["theme", "scope", "provider", "scheme", "variables"];
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

	get provider(): string {
		return this.getAttribute("provider")?.trim() || "auto";
	}

	set provider(value: string) {
		this.setAttribute("provider", value || "auto");
	}

	get scheme(): string {
		return this.getAttribute("scheme")?.trim() || "default";
	}

	set scheme(value: string) {
		this.setAttribute("scheme", value || "default");
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
			this.removeAttribute("data-color-scheme");
		}
	}

	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null,
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

		const { effectiveTheme, dataTheme } = this.resolveThemeState();
		const target = this.getTarget();
		target.setAttribute("data-theme", dataTheme);
		if (this.scheme && this.scheme !== "default") {
			target.setAttribute("data-color-scheme", this.scheme);
		} else {
			target.removeAttribute("data-color-scheme");
		}

		const themeVars =
			effectiveTheme === "dark" ? DARK_THEME_VARS : LIGHT_THEME_VARS;
		const providerVars = resolveProviderVariables({
			target,
			provider: this.provider,
		});
		const schemeVars = resolvePieColorSchemeVariables(this.scheme);
		const vars = {
			...themeVars,
			...providerVars,
			...schemeVars,
			...this.variablesOverride,
		};

		this.clearPreviousKeys(target);
		for (const [key, value] of Object.entries(vars)) {
			target.style.setProperty(key, value);
		}
		this.previousKeys = new Set(Object.keys(vars));
	}

	private resolveThemeState(): {
		effectiveTheme: "light" | "dark";
		dataTheme: string;
	} {
		const rawTheme = this.getAttribute("theme")?.trim();
		if (rawTheme === "auto") {
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			const effectiveTheme = prefersDark ? "dark" : "light";
			return { effectiveTheme, dataTheme: effectiveTheme };
		}
		if (rawTheme === "dark" || rawTheme === "light") {
			return { effectiveTheme: rawTheme, dataTheme: rawTheme };
		}
		// Non-standard theme ids (for example DaisyUI theme names) map to
		// light base defaults while still driving provider resolution.
		if (rawTheme) {
			return { effectiveTheme: "light", dataTheme: rawTheme };
		}
		return { effectiveTheme: "light", dataTheme: "light" };
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

		if (this.getAttribute("theme")?.trim() === "auto") {
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
