export type DaisyThemeTokens = {
	base100?: string;
	base200?: string;
	base300?: string;
	baseContent?: string;
	primary?: string;
	primaryContent?: string;
	secondary?: string;
	secondaryContent?: string;
	accent?: string;
	accentContent?: string;
	neutral?: string;
	neutralContent?: string;
	info?: string;
	success?: string;
	warning?: string;
	error?: string;
};

export function mapDaisyThemeToPieVariables(
	tokens: DaisyThemeTokens
): Record<string, string> {
	return {
		"--pie-background": tokens.base100 ?? "var(--color-base-100)",
		"--pie-background-dark": tokens.base200 ?? "var(--color-base-200)",
		"--pie-secondary-background": tokens.base200 ?? "var(--color-base-200)",
		"--pie-dropdown-background": tokens.base300 ?? "var(--color-base-300)",
		"--pie-text": tokens.baseContent ?? "var(--color-base-content)",
		"--pie-primary": tokens.primary ?? "var(--color-primary)",
		"--pie-primary-light": tokens.primary ?? "var(--color-primary)",
		"--pie-primary-dark": tokens.primary ?? "var(--color-primary)",
		"--pie-secondary": tokens.secondary ?? "var(--color-secondary)",
		"--pie-secondary-light": tokens.secondary ?? "var(--color-secondary)",
		"--pie-secondary-dark": tokens.secondary ?? "var(--color-secondary)",
		"--pie-tertiary": tokens.accent ?? "var(--color-accent)",
		"--pie-tertiary-light": tokens.accent ?? "var(--color-accent)",
		"--pie-border": tokens.base300 ?? "var(--color-base-300)",
		"--pie-border-light": tokens.base200 ?? "var(--color-base-200)",
		"--pie-border-dark": tokens.neutral ?? "var(--color-neutral)",
		"--pie-correct": tokens.success ?? "var(--color-success)",
		"--pie-incorrect": tokens.error ?? "var(--color-error)",
		"--pie-missing": tokens.warning ?? "var(--color-warning)"
	};
}

export function applyDaisyThemeToElement(
	element: HTMLElement,
	tokens: DaisyThemeTokens
) {
	const variables = mapDaisyThemeToPieVariables(tokens);
	for (const [key, value] of Object.entries(variables)) {
		element.style.setProperty(key, value);
	}
}
