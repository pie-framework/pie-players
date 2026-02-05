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

import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { define, whenDefined } from './ce-registry.js';
import { defaultResolve, defaultLoadResolution, hashCode } from './element-resolver.js';
import { printItemAndFloaters, mkItem } from './markup-processor.js';

import type {
  Config,
  Item,
  PkgResolution,
  ResolverFn,
  LoadResolutionFn,
  MissingElFn,
} from './types.js';

/**
 * Default missing element placeholder
 *
 * Creates a custom element that displays an error message for failed loads
 */
const defaultMissingElement: MissingElFn = (pkg: PkgResolution, message?: string): any =>
  class extends HTMLElement {
    connectedCallback() {
      this.innerHTML = `<div style="border: solid 1px darkred; margin: 10px; padding: 10px;">
        <div style="color: red">Cannot load ${pkg.tagName}</div>
        <br/>
        <div style="font-size:0.8em; color: darkred;">${message || 'Unknown error'}</div>
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
@customElement('pie-print')
export class PiePrint extends LitElement {
  static styles = css`
    :host {
      display: block;
      border: solid 1px gray;
      padding: 16px;
      max-width: 800px;
    }
  `;

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
  private _config: Config = { item: { markup: '', elements: {}, models: [] } };
  private _resolutions: PkgResolution[] = [];
  private _printItem: Item = { markup: '', elements: {}, models: [] };
  private _floatItem: Item = { markup: '', elements: {}, models: [] };

  /**
   * Custom resolver function for determining element URLs
   */
  public set resolve(fn: ResolverFn) {
    this._resolve = fn;
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
        console.log('[pie-print] Resolving tagName:', tagName, 'pkg', pkg);
        return this._resolve(tagName, pkg).then((res) => {
          if (!res.printTagName) {
            res.printTagName = `${res.tagName}-print-${hashCode(res.url)}`;
          }
          return res;
        });
      })
    ).then((resolutions) => {
      this._resolutions = resolutions;

      // Transform markup and separate embedded/floater elements
      const pif = printItemAndFloaters(this._config.item, this._resolutions);
      this._printItem = pif.item;
      this._floatItem = mkItem(pif.floaters, this._resolutions, pif.item.elements);

      this.requestUpdate('config', oldValue);
    });
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

      // Set options - convert role to mode for backwards compatibility
      el.options = { ...this.config.options, mode: this.config.options?.role };
      el.model = m;
    });
  }

  async updated(changedProperties: PropertyValues) {
    if (changedProperties.has('config') && this.config.item.elements) {
      try {
        // Load all print modules
        const results = await Promise.all(this._resolutions.map((r) => this._loadResolutions(r)));

        // Register missing element placeholders for failed loads
        const failed = results.filter((r) => !r.success);
        await Promise.all(
          failed.map((f) => {
            define(f.pkg.printTagName!, this.missingElement(f.pkg, f.message));
            return whenDefined(f.pkg.printTagName!);
          })
        );

        // Apply data to all elements
        this._applyData(this._printItem);

        if (this._floatItem && this._floatItem.markup) {
          this._applyData(this._floatItem);
        }
      } catch (e) {
        console.error('[pie-print] Error during update', e);
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
    'pie-print': PiePrint;
  }
}
