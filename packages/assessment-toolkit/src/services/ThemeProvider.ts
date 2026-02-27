/**
 * ThemeProvider
 *
 * Applies consistent accessibility theming across items and tools.
 * Uses CSS custom properties and classes for framework-agnostic theming.
 *
 * Features:
 * - High contrast mode
 * - Font size scaling (small, normal, large, xlarge)
 * - Color customization (background, foreground, accent)
 * - Consistent theming across shadow DOM boundaries
 * - No framework dependencies
 *
 * Part of PIE Assessment Toolkit.
 */

import type { IThemeProvider } from "./interfaces.js";

/**
 * Font size options
 */
export type FontSize = "small" | "normal" | "large" | "xlarge";

/**
 * Theme configuration
 */
export interface ThemeConfig {
	highContrast?: boolean;
	fontSize?: FontSize;
	backgroundColor?: string;
	foregroundColor?: string;
	accentColor?: string;
	linkColor?: string;
	errorColor?: string;
	successColor?: string;
	warningColor?: string;
}

/**
 * Font size scale (in rem units)
 */
const FONT_SIZE_SCALE: Record<FontSize, number> = {
	small: 0.875, // 14px at 16px base
	normal: 1.0, // 16px at 16px base
	large: 1.25, // 20px at 16px base
	xlarge: 1.5, // 24px at 16px base
};

/**
 * Default theme values
 */
const DEFAULT_THEME: Required<ThemeConfig> = {
	highContrast: false,
	fontSize: "normal",
	backgroundColor: "#ffffff",
	foregroundColor: "#333333",
	accentColor: "#007bff",
	linkColor: "#007bff",
	errorColor: "#dc3545",
	successColor: "#28a745",
	warningColor: "#ffc107",
};

/**
 * High contrast theme overrides
 */
const HIGH_CONTRAST_THEME: Partial<ThemeConfig> = {
	backgroundColor: "#000000",
	foregroundColor: "#ffffff",
	accentColor: "#ffff00",
	linkColor: "#00ffff",
	errorColor: "#ff0000",
	successColor: "#00ff00",
	warningColor: "#ffff00",
};

export class ThemeProvider implements IThemeProvider {
	private currentTheme: Required<ThemeConfig> = { ...DEFAULT_THEME };
	private styleElement: HTMLStyleElement | null = null;
	private rootElement: HTMLElement | null;
	private styleContainer: ShadowRoot | HTMLHeadElement | null = null;

	constructor(
		rootElement: HTMLElement | null = typeof document !== "undefined"
			? document.documentElement
			: null,
	) {
		this.rootElement = rootElement;

		// SSR guard
		if (typeof document === "undefined") {
			console.warn("ThemeProvider: document not available (SSR context)");
			return;
		}

		this.initializeStyles();
	}

	/**
	 * Initialize theme styles
	 */
	private initializeStyles(): void {
		if (!this.rootElement) return;

		const rootNode = this.rootElement.getRootNode();
		if (rootNode instanceof ShadowRoot) {
			this.styleContainer = rootNode;
			this.styleElement = rootNode.querySelector(
				'style[data-pie-theme-styles="true"]',
			) as HTMLStyleElement | null;
		} else {
			this.styleContainer = document.head;
			this.styleElement = document.getElementById(
				"pie-theme-styles",
			) as HTMLStyleElement | null;
		}

		if (!this.styleElement) {
			this.styleElement = document.createElement("style");
			if (this.styleContainer instanceof ShadowRoot) {
				this.styleElement.setAttribute("data-pie-theme-styles", "true");
				this.styleContainer.appendChild(this.styleElement);
			} else {
				this.styleElement.id = "pie-theme-styles";
				document.head.appendChild(this.styleElement);
			}
		}

		// Apply default theme
		this.applyTheme({});
	}

	/**
	 * Apply theme configuration
	 *
	 * @param config Partial theme configuration (merged with current theme)
	 */
	applyTheme(config: ThemeConfig): void {
		if (!this.rootElement) return;

		// Merge with current theme
		const newTheme = {
			...this.currentTheme,
			...config,
		};

		// Apply high contrast overrides if enabled
		if (newTheme.highContrast) {
			Object.assign(newTheme, HIGH_CONTRAST_THEME);
		}

		this.currentTheme = newTheme;

		// Apply CSS custom properties
		this.applyCSSVariables();

		// Apply CSS classes
		this.applyCSSClasses();

		// Update global styles
		this.updateGlobalStyles();
	}

	/**
	 * Apply CSS custom properties to root element
	 */
	private applyCSSVariables(): void {
		if (!this.rootElement) return;

		const {
			fontSize,
			backgroundColor,
			foregroundColor,
			accentColor,
			linkColor,
			errorColor,
			successColor,
			warningColor,
		} = this.currentTheme;

		// Font sizing
		this.rootElement.style.setProperty("--pie-font-scale", String(FONT_SIZE_SCALE[fontSize]));

		// Canonical PIE variables
		this.rootElement.style.setProperty("--pie-background", backgroundColor);
		this.rootElement.style.setProperty("--pie-text", foregroundColor);
		this.rootElement.style.setProperty("--pie-primary", accentColor);
		this.rootElement.style.setProperty("--pie-tertiary", linkColor);
		this.rootElement.style.setProperty("--pie-incorrect", errorColor);
		this.rootElement.style.setProperty("--pie-correct", successColor);
		this.rootElement.style.setProperty("--pie-missing", warningColor);

		// Derived surface tokens
		this.rootElement.style.setProperty("--pie-background-dark", this.adjustOpacity(backgroundColor, 0.95));
		this.rootElement.style.setProperty("--pie-secondary-background", this.adjustOpacity(backgroundColor, 0.92));
		this.rootElement.style.setProperty("--pie-border", this.adjustOpacity(foregroundColor, 0.25));
		this.rootElement.style.setProperty("--pie-border-light", this.adjustOpacity(foregroundColor, 0.16));
		this.rootElement.style.setProperty("--pie-border-dark", this.adjustOpacity(foregroundColor, 0.4));
		this.rootElement.style.setProperty("--pie-focus-checked", this.adjustOpacity(accentColor, 0.18));
		this.rootElement.style.setProperty("--pie-focus-checked-border", accentColor);

		// Button tokens used by toolkit controls
		this.rootElement.style.setProperty("--pie-button-bg", backgroundColor);
		this.rootElement.style.setProperty("--pie-button-border", this.adjustOpacity(foregroundColor, 0.2));
		this.rootElement.style.setProperty("--pie-button-color", foregroundColor);
		this.rootElement.style.setProperty("--pie-button-hover-bg", this.adjustOpacity(accentColor, 0.1));
		this.rootElement.style.setProperty("--pie-button-hover-border", this.adjustOpacity(accentColor, 0.5));
		this.rootElement.style.setProperty("--pie-button-hover-color", foregroundColor);
		this.rootElement.style.setProperty("--pie-button-active-bg", this.adjustOpacity(accentColor, 0.16));
		this.rootElement.style.setProperty("--pie-button-focus-outline", accentColor);
	}

	/**
	 * Apply CSS classes to root element
	 */
	private applyCSSClasses(): void {
		if (!this.rootElement) return;

		const { highContrast, fontSize } = this.currentTheme;

		// High contrast class
		this.rootElement.classList.toggle("pie-high-contrast", highContrast);

		// Font size classes
		this.rootElement.classList.remove(
			"pie-font-small",
			"pie-font-normal",
			"pie-font-large",
			"pie-font-xlarge",
		);
		this.rootElement.classList.add(`pie-font-${fontSize}`);
	}

	/**
	 * Update global theme styles
	 */
	private updateGlobalStyles(): void {
		if (!this.styleElement) return;

		this.styleElement.textContent = `
      /* PIE Assessment Toolkit - Theme Styles */

      /* Font scaling */
      .pie-themed,
      .pie-themed * {
        font-size: calc(1rem * var(--pie-font-scale, 1));
      }

      /* Color theming */
      .pie-themed {
        background-color: var(--pie-background);
        color: var(--pie-text);
      }

      .pie-themed a {
        color: var(--pie-tertiary);
      }

      .pie-themed a:hover {
        opacity: 0.8;
      }

      /* High contrast mode */
      .pie-high-contrast .pie-themed {
        border: 2px solid var(--pie-text);
      }

      .pie-high-contrast .pie-themed a {
        text-decoration: underline;
        font-weight: bold;
      }

      .pie-high-contrast .pie-themed button {
        border: 2px solid var(--pie-text);
        background-color: var(--pie-background);
        color: var(--pie-text);
      }

      .pie-high-contrast .pie-themed button:hover {
        background-color: var(--pie-text);
        color: var(--pie-background);
      }

      /* Error/Success/Warning states */
      .pie-themed .pie-error {
        color: var(--pie-incorrect);
      }

      .pie-themed .pie-success {
        color: var(--pie-correct);
      }

      .pie-themed .pie-warning {
        color: var(--pie-missing);
      }

      /* Focus indicators (accessibility) */
      .pie-themed *:focus-visible {
        outline: 3px solid var(--pie-focus-checked-border);
        outline-offset: 2px;
      }

      .pie-high-contrast *:focus-visible {
        outline-width: 4px;
      }

      /* Responsive font scaling */
      @media (max-width: 768px) {
        .pie-themed,
        .pie-themed * {
          font-size: calc(var(--pie-font-size-base) * var(--pie-font-size-scale, 1) * 0.9);
        }
      }
    `;
	}

	/**
	 * Set high contrast mode
	 */
	setHighContrast(enabled: boolean): void {
		this.applyTheme({ highContrast: enabled });
	}

	/**
	 * Set font size
	 */
	setFontSize(size: FontSize): void {
		this.applyTheme({ fontSize: size });
	}

	/**
	 * Set color scheme
	 */
	setColors(colors: {
		backgroundColor?: string;
		foregroundColor?: string;
		accentColor?: string;
	}): void {
		this.applyTheme(colors);
	}

	/**
	 * Get current theme configuration
	 */
	getCurrentTheme(): Required<ThemeConfig> {
		return { ...this.currentTheme };
	}

	/**
	 * Reset to default theme
	 */
	reset(): void {
		this.currentTheme = { ...DEFAULT_THEME };
		this.applyTheme({});
	}

	/**
	 * Adjust color opacity (helper)
	 */
	private adjustOpacity(color: string, opacity: number): string {
		// Simple hex to rgba conversion
		if (color.startsWith("#")) {
			const r = parseInt(color.slice(1, 3), 16);
			const g = parseInt(color.slice(3, 5), 16);
			const b = parseInt(color.slice(5, 7), 16);
			return `rgba(${r}, ${g}, ${b}, ${opacity})`;
		}

		// If already rgba/rgb, just return as-is (simplified)
		return color;
	}

	/**
	 * Cleanup - remove theme styles
	 */
	destroy(): void {
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = null;
		}
		this.styleContainer = null;

		if (!this.rootElement) return;

		// Remove CSS classes
		this.rootElement.classList.remove(
			"pie-high-contrast",
			"pie-font-small",
			"pie-font-normal",
			"pie-font-large",
			"pie-font-xlarge",
		);

		// Remove CSS custom properties
		this.rootElement.style.removeProperty("--pie-font-scale");
		this.rootElement.style.removeProperty("--pie-background");
		this.rootElement.style.removeProperty("--pie-text");
		this.rootElement.style.removeProperty("--pie-primary");
		this.rootElement.style.removeProperty("--pie-tertiary");
		this.rootElement.style.removeProperty("--pie-incorrect");
		this.rootElement.style.removeProperty("--pie-correct");
		this.rootElement.style.removeProperty("--pie-missing");
		this.rootElement.style.removeProperty("--pie-background-dark");
		this.rootElement.style.removeProperty("--pie-secondary-background");
		this.rootElement.style.removeProperty("--pie-border");
		this.rootElement.style.removeProperty("--pie-border-light");
		this.rootElement.style.removeProperty("--pie-border-dark");
		this.rootElement.style.removeProperty("--pie-focus-checked");
		this.rootElement.style.removeProperty("--pie-focus-checked-border");
		this.rootElement.style.removeProperty("--pie-button-bg");
		this.rootElement.style.removeProperty("--pie-button-border");
		this.rootElement.style.removeProperty("--pie-button-color");
		this.rootElement.style.removeProperty("--pie-button-hover-bg");
		this.rootElement.style.removeProperty("--pie-button-hover-border");
		this.rootElement.style.removeProperty("--pie-button-hover-color");
		this.rootElement.style.removeProperty("--pie-button-active-bg");
		this.rootElement.style.removeProperty("--pie-button-focus-outline");
	}
}
