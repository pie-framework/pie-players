/**
 * PIE Print Player
 *
 * Web component that dynamically loads and renders PIE elements in print mode.
 *
 * Based on @pie-framework/pie-print but modernized with:
 * - Lit 3.x
 * - TypeScript
 * - Modern ESM architecture
 * - Support for pie-elements-ng packages
 */

import { html, LitElement, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import type { ItemMarkupSanitizer } from "@pie-players/pie-players-shared/security";

import { define, whenDefined } from "./ce-registry.js";
import {
	defaultLoadResolution,
	defaultResolve,
	hashCode,
} from "./element-resolver.js";
import { toPrintHashedTag, validateCustomElementTag } from "./tag-names.js";
import { mkItem, printItemAndFloaters } from "./markup-processor.js";

import type {
	Config,
	Item,
	LoadResolutionFn,
	MissingElFn,
	PkgResolution,
	ResolverFn,
} from "./types.js";

/**
 * Default missing element placeholder
 *
 * Creates a custom element that displays an error message for failed loads
 */
const defaultMissingElement: MissingElFn = (
	pkg: PkgResolution,
	message?: string,
): any =>
	class extends HTMLElement {
		connectedCallback() {
			this.innerHTML = `<div style="border: solid 1px darkred; margin: 10px; padding: 10px;">
        <div style="color: red">Cannot load ${pkg.tagName}</div>
        <br/>
        <div style="font-size:0.8em; color: darkred;">${message || "Unknown error"}</div>
      </div>`;
		}
	};

/**
 * PIE Print Web Component
 *
 * Usage:
 * ```html
 * <pie-print></pie-print>
 * <script>
 *   const player = document.querySelector('pie-print');
 *   player.config = {
 *     item: {
 *       markup: '<multiple-choice id="1"></multiple-choice>',
 *       elements: { 'multiple-choice': '@pie-element/multiple-choice@12.0.0' },
 *       models: [{ id: '1', element: 'multiple-choice', ... }]
 *     },
 *     options: { role: 'student' }
 *   };
 * </script>
 * ```
 */
@customElement("pie-print")
export class PiePrint extends LitElement {
	// No `static styles` here: `createRenderRoot()` below returns `this` for
	// light-DOM rendering, which skips Lit's `adoptStyles` call, so static
	// styles would never be applied.

	constructor() {
		super();
		this._resolve = defaultResolve;
		this._loadResolutions = defaultLoadResolution;
		this._missingElement = defaultMissingElement;
	}

	// No shadow DOM - print elements render in light DOM
	createRenderRoot() {
		return this;
	}

	// Private properties
	private _resolve: ResolverFn;
	private _loadResolutions: LoadResolutionFn;
	private _missingElement: MissingElFn;
	private _config: Config = { item: { markup: "", elements: {}, models: [] } };
	private _resolutions: PkgResolution[] = [];
	private _printItem: Item = { markup: "", elements: {}, models: [] };
	private _floatItem: Item = { markup: "", elements: {}, models: [] };
	private _trustMarkup = false;
	private _sanitizeMarkup: ItemMarkupSanitizer | null = null;

	/**
	 * Custom resolver function for determining element URLs
	 */
	public set resolve(fn: ResolverFn) {
		this._resolve = fn;
	}

	/**
	 * Render authored markup without sanitizing it.
	 *
	 * Off by default: authored item markup is treated as untrusted and passed
	 * through the shared sanitizer. Only set this when the host has already
	 * validated the markup.
	 */
	@property({ type: Boolean, attribute: "trust-markup" })
	get trustMarkup(): boolean {
		return this._trustMarkup;
	}

	set trustMarkup(value: boolean) {
		const oldValue = this._trustMarkup;
		if (oldValue === value) return;
		this._trustMarkup = value;
		this._rebuildPrintItems();
		this.requestUpdate("trustMarkup", oldValue);
	}

	/**
	 * Custom sanitizer, used instead of the default one. Ignored when
	 * `trustMarkup` is set.
	 */
	public set sanitizeMarkup(fn: ItemMarkupSanitizer | null) {
		this._sanitizeMarkup = fn;
		this._rebuildPrintItems();
		this.requestUpdate();
	}

	public get sanitizeMarkup(): ItemMarkupSanitizer | null {
		return this._sanitizeMarkup;
	}

	/**
	 * Custom missing element factory function
	 */
	public set missingElement(c: MissingElFn) {
		this._missingElement = c;
	}

	public get missingElement() {
		return this._missingElement;
	}

	/**
	 * Item configuration with elements and models
	 */
	@property({ type: Object })
	get config(): Config {
		return this._config;
	}

	set config(value: Config) {
		const oldValue = this._config;
		this._config = value;

		// Resolve all element packages to URLs and print tag names
		Promise.all(
			Object.entries(this.config.item.elements).map(([tagName, pkg]) => {
				const validatedTag = validateCustomElementTag(
					tagName,
					`item element tag for ${pkg}`,
				);
				console.log("[pie-print] Resolving tagName:", tagName, "pkg", pkg);
				return this._resolve(validatedTag, pkg).then((res) => {
					if (!res.printTagName) {
						res.printTagName = toPrintHashedTag(res.tagName, res.url, hashCode);
					}
					return res;
				});
			}),
		).then((resolutions) => {
			this._resolutions = resolutions;
			this._rebuildPrintItems();
			this.requestUpdate("config", oldValue);
		});
	}

	/**
	 * Transform markup and separate embedded/floater elements.
	 *
	 * Re-runnable so the markup-handling properties (`trustMarkup`,
	 * `sanitizeMarkup`) still take effect when a host sets them *after* `config`
	 * — otherwise an explicit opt-out would be silently ignored depending on
	 * assignment order. No-ops until the resolutions have landed; the `config`
	 * setter calls it once they have.
	 */
	private _rebuildPrintItems() {
		if (this._resolutions.length === 0) return;

		const pif = printItemAndFloaters(this._config.item, this._resolutions, {
			trustMarkup: this._trustMarkup,
			sanitize: this._sanitizeMarkup ?? undefined,
		});
		this._printItem = pif.item;
		this._floatItem = mkItem(
			pif.floaters,
			this._resolutions,
			pif.item.elements,
		);
	}

	/**
	 * Apply model data to rendered elements
	 */
	private _applyData(item: Item) {
		item.models.forEach((m) => {
			const el: any = this.querySelector(`${m.element}[id="${m.id}"]`);
			if (!el) {
				console.warn(`[pie-print] Missing element: ${m.element}[id="${m.id}"]`);
				return;
			}

			el.options = this.config.options;
			el.model = m;
		});
	}

	async updated(changedProperties: PropertyValues) {
		if (changedProperties.has("config") && this.config.item.elements) {
			try {
				// Load all print modules
				const results = await Promise.all(
					this._resolutions.map((r) => this._loadResolutions(r)),
				);

				// Register missing element placeholders for failed loads
				const failed = results.filter((r) => !r.success);
				await Promise.all(
					failed.map((f) => {
						define(f.pkg.printTagName!, this.missingElement(f.pkg, f.message));
						return whenDefined(f.pkg.printTagName!);
					}),
				);

				// Apply data to all elements
				this._applyData(this._printItem);

				if (this._floatItem && this._floatItem.markup) {
					this._applyData(this._floatItem);
				}
			} catch (e) {
				console.error("[pie-print] Error during update", e);
			}
		}
	}

	render() {
		return html`
      <div>
        ${unsafeHTML(this._printItem.markup)}
        <br />
        ${unsafeHTML(this._floatItem.markup)}
      </div>
    `;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"pie-print": PiePrint;
	}
}
