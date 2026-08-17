export type ThemeMode = "light" | "dark" | "auto";
export type ThemeScope = "self" | "document";
export type ThemeTokenName = `--pie-${string}`;
export type ThemeVariables = Record<string, string>;

export type PieThemeResolutionStatus =
	| "default"
	| "built-in"
	| "custom"
	| "unavailable";

export type PieColorSchemePreview = Readonly<{
	bg: string;
	text: string;
	primary: string;
}>;

export type PieColorSchemeDescriptor = Readonly<{
	id: string;
	name: string;
	description?: string;
	kind: "default" | "built-in" | "custom";
	preview: PieColorSchemePreview;
}>;

export type ColorSchemeSnapshot = Readonly<{
	generation: number;
	schemes: readonly PieColorSchemeDescriptor[];
}>;

export type PieThemeObserver = (snapshot: ColorSchemeSnapshot) => void;

export type PieThemeDiagnosticCode =
	| "unknown-scheme"
	| "invalid-registration"
	| "invalid-scheme-id"
	| "reserved-scheme-id"
	| "empty-scheme"
	| "invalid-token-name"
	| "excluded-token"
	| "invalid-token-value"
	| "custom-scheme-replaced"
	| "contrast-too-low"
	| "contrast-unmeasurable"
	| "observer-error";

export type PieThemeDiagnostic = Readonly<{
	code: PieThemeDiagnosticCode;
	severity: "warning" | "error";
	message: string;
	index?: number;
	schemeId?: string;
	token?: string;
}>;

export type ResolvePieThemeInput = Readonly<{
	baseTheme?: "light" | "dark";
	requestedScheme?: string | null;
	providerVariables?: Readonly<ThemeVariables>;
	variables?: Readonly<ThemeVariables>;
}>;

export type ThemeResolution = Readonly<{
	baseTheme: "light" | "dark";
	requestedScheme: string;
	resolvedScheme: PieColorSchemeDescriptor | null;
	status: PieThemeResolutionStatus;
	variables: Readonly<ThemeVariables>;
	/**
	 * The CSS `color-scheme` keyword this resolution implies, or `null` when the
	 * host keeps ownership of it -- which is every resolution without a scheme.
	 */
	colorScheme: "light" | "dark" | null;
	diagnostics: readonly PieThemeDiagnostic[];
}>;

export type RegisteredPieColorScheme = Readonly<{
	id: string;
	name?: string;
	description?: string;
	variables: Readonly<Record<string, string | number>>;
}>;

export type RegistrationReceipt = Readonly<{
	acceptedSchemeIds: readonly string[];
	diagnostics: readonly PieThemeDiagnostic[];
	unregister(): void;
}>;

export type Unsubscribe = () => void;

export function isThemeMode(value: string | null): value is ThemeMode {
	return value === "light" || value === "dark" || value === "auto";
}

export function isThemeScope(value: string | null): value is ThemeScope {
	return value === "self" || value === "document";
}

export function normalizePieThemeVariables(value: unknown): ThemeVariables {
	if (!value || typeof value !== "object") {
		return {};
	}

	const output: ThemeVariables = {};
	for (const [key, rawValue] of Object.entries(
		value as Record<string, unknown>,
	)) {
		if (!key.startsWith("--pie-")) {
			continue;
		}
		if (typeof rawValue === "string") {
			const trimmed = rawValue.trim();
			if (trimmed) {
				output[key] = trimmed;
			}
		} else if (typeof rawValue === "number") {
			output[key] = String(rawValue);
		}
	}
	return output;
}
