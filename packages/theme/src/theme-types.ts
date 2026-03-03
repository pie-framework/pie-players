export type ThemeMode = "light" | "dark" | "auto";
export type ThemeScope = "self" | "document";
export type ThemeVariables = Record<string, string>;

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
	for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
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

