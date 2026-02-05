/**
 * Markup Processing
 *
 * Handles parsing and transforming HTML markup to replace interactive element tags
 * with print-specific tags.
 *
 * Ported from pie-print-support/src/pie-print.ts
 */

import type { PkgResolution, Item, Model, Elements, NodeResult } from './types.js';

/**
 * Create an item with print-specific tags for floater elements (not in markup)
 *
 * @param models - Element models
 * @param resolutions - Package resolutions
 * @param elements - Element package map
 * @returns Item with markup containing floater elements
 */
export const mkItem = (models: Model[], resolutions: PkgResolution[], elements: Elements): Item => {
  const f = document.createDocumentFragment();

  models.forEach((o) => {
    const res = resolutions.find((r) => r.tagName === o.element || r.printTagName === o.element);
    if (res) {
      o.element = res.printTagName!;
      const node = document.createElement(res.printTagName!);
      node.setAttribute('id', o.id);
      f.appendChild(node);
    }
  });

  const root = document.createElement('div');
  root.appendChild(f);
  return { markup: root.innerHTML, models, elements };
};

/**
 * Parse the markup and replace default element tags with print element tags
 *
 * @param markup - Original HTML markup
 * @param resolutions - Package resolutions with print tag names
 * @returns Transformed HTML and list of found nodes
 */
export const processMarkup = (
  markup: string,
  resolutions: PkgResolution[]
): { html: string; nodes: NodeResult[] } => {
  const p = new DOMParser();

  try {
    const doc = p.parseFromString(markup, 'text/html');
    const results: NodeResult[] = [];

    resolutions.forEach((r) => {
      const nl = doc.body.querySelectorAll(r.tagName);
      nl.forEach((n) => {
        if (!r.printTagName) {
          throw new Error('Missing a printTagName');
        }
        const id = n.getAttribute('id');
        const pieId = n.getAttribute('pie-id') || id;
        const originalTag = n.tagName.toLowerCase();

        if (id) {
          const newEl = document.createElement(r.printTagName);
          newEl.setAttribute('id', id || '');
          newEl.setAttribute('pie-id', pieId || '');
          newEl.setAttribute('data-original-tag', originalTag);
          n.parentNode?.replaceChild(newEl, n);
          results.push({ id, pieId, originalTag });
        }
      });
    });

    return { html: doc.body.innerHTML, nodes: results };
  } catch (e) {
    throw new Error(`Failed to parse the markup - is it valid html: ${markup}`);
  }
};

/**
 * Create a print item and separate floater elements
 *
 * Embedded elements (in markup) go into the main item.
 * Floater elements (not in markup, like rubrics) are separated.
 *
 * @param item - Original item configuration
 * @param resolutions - Package resolutions
 * @returns Transformed print item and floater item
 */
export const printItemAndFloaters = (
  item: Item,
  resolutions: PkgResolution[]
): { item: Item; floaters: Model[] } => {
  const r = processMarkup(item.markup, resolutions);

  const { embedded, floaters } = item.models.reduce(
    (acc, m) => {
      const inMarkup = r.nodes.some((n) => n.id === m.id);
      if (inMarkup) {
        acc.embedded.push(m);
      } else {
        acc.floaters.push(m);
      }
      return acc;
    },
    { embedded: [] as Model[], floaters: [] as Model[] }
  );

  return {
    item: {
      markup: r.html,
      elements: Object.entries(item.elements).reduce<Elements>((acc, [key, value]) => {
        const res = resolutions.find((r) => r.tagName === key);
        if (!res || !res.printTagName) {
          throw new Error(`cant find resolution for element: ${key}`);
        }
        acc[res.printTagName] = value;
        return acc;
      }, {}),
      models: embedded.map((m) => {
        const res = resolutions.find((r) => r.tagName === m.element);
        if (!res || !res.printTagName) {
          throw new Error(`cant find resolution for element: ${m.element}`);
        }
        return { ...m, element: res?.printTagName };
      }),
    },
    floaters,
  };
};
