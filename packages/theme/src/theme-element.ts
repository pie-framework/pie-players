import { observePieColorSchemes, resolvePieTheme } from "./color-schemes.js";
import {
	observePieThemeProviders,
	resolveProviderVariables,
} from "./providers.js";
import {
	isThemeMode,
	isThemeScope,
	type ThemeMode,
	type ThemeScope,
	type ThemeVariables,
} from "./theme-types.js";

const HTMLElementBase =
	typeof HTMLElement === "undefined"
		? (class {} as unknown as typeof HTMLElement)
		: HTMLElement;

function defineThemeElementSafely(
	tagName: string,
	elementConstructor: CustomElementConstructor,
): void {
	if (customElements.get(tagName)) {
		return;
	}
	try {
		customElements.define(tagName, elementConstructor);
	} catch (error) {
		const isDuplicate =
			error instanceof DOMException && error.name === "NotSupportedError";
		if (!isDuplicate || !customElements.get(tagName)) {
			throw error;
		}
	}
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
	for (const [key, rawValue] of Object.entries(
		value as Record<string, unknown>,
	)) {
		if (!key.startsWith("--")) {
			continue;
		}

		if (typeof rawValue === "string" && rawValue.trim()) {
			output[key] = rawValue.trim();
		} else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
			output[key] = String(rawValue);
		}
	}
	return output;
}

type DocumentThemeState = Readonly<{
	dataTheme: string;
	dataColorScheme: string | null;
	colorScheme: "light" | "dark" | null;
	variables: Readonly<ThemeVariables>;
}>;

type DocumentThemeBaseline = {
	dataTheme: string | null;
	dataColorScheme: string | null;
	/** The host's own inline `color-scheme`, restored when no owner is left. */
	colorScheme: { value: string; priority: string } | null;
	variables: Map<string, { value: string; priority: string } | null>;
};

/**
 * `color-scheme` decides how UA-styled controls paint -- `input` and `select`
 * text, scrollbars, native form widgets -- and no amount of custom properties
 * reaches them. A scheme that replaces the palette without it leaves those
 * controls on the host theme's polarity, which under a dark accommodation on a
 * light host means dark-on-dark.
 *
 * `null` restores rather than removes. Clearing a scheme has to undo this
 * element's keyword, and the thing to return to is whatever the host declared --
 * removing outright would take a host's own `color-scheme` away the first time a
 * document-scoped element resolved without a scheme, which is most of the time.
 * A self-scoped target has no host declaration to preserve, so its caller passes
 * no baseline and `null` does remove.
 */
function applyColorScheme(
	target: HTMLElement,
	colorScheme: "light" | "dark" | null,
	baseline: { value: string; priority: string } | null,
): void {
	if (colorScheme) {
		target.style.setProperty("color-scheme", colorScheme);
	} else if (baseline) {
		target.style.setProperty(
			"color-scheme",
			baseline.value,
			baseline.priority,
		);
	} else {
		target.style.removeProperty("color-scheme");
	}
}

const documentThemeOwners = new Map<PieThemeElement, DocumentThemeState>();
let documentThemeBaseline: DocumentThemeBaseline | null = null;
let documentThemeAppliedKeys = new Set<string>();

function ensureDocumentThemeBaseline(
	target: HTMLElement,
	tokens: readonly string[],
): void {
	documentThemeBaseline ??= {
		dataTheme: target.getAttribute("data-theme"),
		dataColorScheme: target.getAttribute("data-color-scheme"),
		colorScheme: target.style.getPropertyValue("color-scheme")
			? {
					value: target.style.getPropertyValue("color-scheme"),
					priority: target.style.getPropertyPriority("color-scheme"),
				}
			: null,
		variables: new Map(),
	};
	for (const token of tokens) {
		if (documentThemeBaseline.variables.has(token)) continue;
		const value = target.style.getPropertyValue(token);
		documentThemeBaseline.variables.set(
			token,
			value
				? { value, priority: target.style.getPropertyPriority(token) }
				: null,
		);
	}
}

function restoreDocumentThemeVariables(target: HTMLElement): void {
	for (const token of documentThemeAppliedKeys) {
		target.style.removeProperty(token);
	}
	const baseline = documentThemeBaseline;
	if (!baseline) return;
	for (const [token, original] of baseline.variables) {
		if (original) {
			target.style.setProperty(token, original.value, original.priority);
		} else {
			target.style.removeProperty(token);
		}
	}
}

function applyDocumentThemeState(
	target: HTMLElement,
	state: DocumentThemeState,
): void {
	ensureDocumentThemeBaseline(target, Object.keys(state.variables));
	restoreDocumentThemeVariables(target);
	target.setAttribute("data-theme", state.dataTheme);
	if (state.dataColorScheme) {
		target.setAttribute("data-color-scheme", state.dataColorScheme);
	} else {
		target.removeAttribute("data-color-scheme");
	}
	applyColorScheme(
		target,
		state.colorScheme,
		documentThemeBaseline?.colorScheme ?? null,
	);
	for (const [token, value] of Object.entries(state.variables)) {
		target.style.setProperty(token, value);
	}
	documentThemeAppliedKeys = new Set(Object.keys(state.variables));
}

function restoreDocumentThemeBaseline(target: HTMLElement): void {
	const baseline = documentThemeBaseline;
	if (!baseline) return;
	if (baseline.dataTheme === null) target.removeAttribute("data-theme");
	else target.setAttribute("data-theme", baseline.dataTheme);
	if (baseline.dataColorScheme === null) {
		target.removeAttribute("data-color-scheme");
	} else {
		target.setAttribute("data-color-scheme", baseline.dataColorScheme);
	}
	if (baseline.colorScheme) {
		target.style.setProperty(
			"color-scheme",
			baseline.colorScheme.value,
			baseline.colorScheme.priority,
		);
	} else {
		target.style.removeProperty("color-scheme");
	}
	restoreDocumentThemeVariables(target);
	documentThemeBaseline = null;
	documentThemeAppliedKeys.clear();
}

export class PieThemeElement extends HTMLElementBase {
	static get observedAttributes() {
		return ["theme", "scope", "provider", "scheme", "variables"];
	}

	private mediaQuery: MediaQueryList | null = null;
	private readonly onMediaChange = () => this.applyTheme();
	private previousKeys = new Set<string>();
	private previousTarget: HTMLElement | null = null;
	private variablesOverride: ThemeVariables = {};
	private promoteDocumentOwnership = false;
	private stopObservingSchemes: (() => void) | null = null;
	private stopObservingProviders: (() => void) | null = null;

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
		this.stopObservingProviders ??= observePieThemeProviders(() =>
			this.applyTheme(),
		);
		this.stopObservingSchemes ??= observePieColorSchemes(() =>
			this.applyTheme(),
		);
	}

	disconnectedCallback() {
		if (this.mediaQuery) {
			this.mediaQuery.removeEventListener("change", this.onMediaChange);
		}
		this.mediaQuery = null;
		this.stopObservingSchemes?.();
		this.stopObservingSchemes = null;
		this.stopObservingProviders?.();
		this.stopObservingProviders = null;
		this.clearPreviousTarget();
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
		this.promoteDocumentOwnership = true;

		this.applyTheme();
	}

	protected getTarget(): HTMLElement {
		if (this.scope === "document") {
			return document.documentElement;
		}
		return this;
	}

	protected applyTheme() {
		if (
			!this.isConnected ||
			typeof document === "undefined" ||
			typeof window === "undefined"
		) {
			return;
		}

		const { effectiveTheme, dataTheme } = this.resolveThemeState();
		const target = this.getTarget();
		if (this.previousTarget && this.previousTarget !== target) {
			this.clearPreviousTarget();
		}

		const providerVariables = resolveProviderVariables({
			target,
			provider: this.provider,
		});
		const resolution = resolvePieTheme({
			baseTheme: effectiveTheme,
			providerVariables,
			requestedScheme: this.scheme,
			variables: this.variablesOverride,
		});

		const state: DocumentThemeState = Object.freeze({
			dataTheme,
			dataColorScheme: this.scheme === "default" ? null : this.scheme,
			colorScheme: resolution.colorScheme,
			variables: resolution.variables,
		});
		if (this.scope === "document") {
			if (this.promoteDocumentOwnership && documentThemeOwners.has(this)) {
				documentThemeOwners.delete(this);
			}
			// Observer-driven re-resolution updates state in place, while a direct
			// attribute/property mutation deliberately makes this the latest owner.
			documentThemeOwners.set(this, state);
			this.promoteDocumentOwnership = false;
			const activeOwner = [...documentThemeOwners.entries()].at(-1);
			if (activeOwner?.[0] === this) {
				applyDocumentThemeState(target, state);
			}
		} else {
			target.setAttribute("data-theme", dataTheme);
			if (state.dataColorScheme) {
				target.setAttribute("data-color-scheme", state.dataColorScheme);
			} else {
				target.removeAttribute("data-color-scheme");
			}
			applyColorScheme(target, state.colorScheme, null);
			this.clearPreviousKeys(target);
			for (const [key, value] of Object.entries(resolution.variables)) {
				target.style.setProperty(key, value);
			}
		}
		this.previousTarget = target;
		this.previousKeys = new Set(Object.keys(resolution.variables));
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
		// Non-standard ids (for example DaisyUI theme names) keep their provider
		// selector while resolving from PIE's light Base Theme.
		if (rawTheme) {
			return { effectiveTheme: "light", dataTheme: rawTheme };
		}
		return { effectiveTheme: "light", dataTheme: "light" };
	}

	private clearPreviousTarget() {
		if (!this.previousTarget) return;
		const target = this.previousTarget;
		if (target === document.documentElement && documentThemeOwners.has(this)) {
			documentThemeOwners.delete(this);
			const survivingOwner = [...documentThemeOwners.values()].at(-1);
			if (survivingOwner) applyDocumentThemeState(target, survivingOwner);
			else restoreDocumentThemeBaseline(target);
		} else {
			this.clearPreviousKeys(target);
			target.removeAttribute("data-theme");
			target.removeAttribute("data-color-scheme");
			// Self-scoped targets are the element itself, so anything written here
			// was written by this element -- no host baseline to preserve.
			target.style.removeProperty("color-scheme");
		}
		this.previousTarget = null;
		this.previousKeys.clear();
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
		if (!this.isConnected) {
			return;
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

	defineThemeElementSafely(tagName, PieThemeElement);
}
