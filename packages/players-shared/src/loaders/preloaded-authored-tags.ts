/**
 * Authored tags for the `preloaded` strategy.
 *
 * An item's `config.elements` names the base tag of each element it renders,
 * and items choose it: one item renders `@pie-element/multiple-choice` as
 * `multiple-choice`, another as `pie-element-multiple-choice`. The IIFE and ESM
 * loaders define whichever tag an item names. A preloaded page registers each
 * package under the base tag its registration names, so before asserting, a
 * player defines every other versioned tag its content names for that package
 * from the registered element.
 */

import { defineCustomElementSafely } from "../pie/custom-element-define.js";
import { pieRegistry, writeRegistryEntry } from "../pie/registry.js";
import { type Entry, Status } from "../pie/types.js";
import { parseVersionedTagName } from "../pie/versioned-tag.js";
import type { ElementMap } from "./ElementLoader.js";

type Registration = {
	entry: Entry;
	elementClass: CustomElementConstructor;
};

/**
 * Define each tag of `elements` that `customElements` lacks and whose package
 * spec the page registered under another base tag, and record it in
 * `window.PIE_REGISTRY` with that registration's element, controller and
 * bundle type. Returns the tags it defined.
 *
 * `elements` is the map a player asserts: each versioned tag, with its view
 * suffix, to its package spec. A registration matches when it holds the same
 * spec under a tag that differs only in its base, and `customElements` holds
 * that tag; among several, one with a controller wins. A tag no registration
 * matches stays undefined, for `assertRegistered` to report. Every call reads
 * the page's registrations, so each player on a page can call it.
 */
export function defineAuthoredPreloadedTags(elements: ElementMap): string[] {
	if (typeof window === "undefined" || typeof customElements === "undefined") {
		return [];
	}

	const defined: string[] = [];
	for (const [tag, spec] of Object.entries(elements)) {
		if (customElements.get(tag)) continue;
		const registration = findRegistration(tag, spec);
		if (!registration) continue;

		const { entry, elementClass } = registration;
		defineCustomElementSafely(
			tag,
			class extends elementClass {},
			`preloaded element tag for ${spec}`,
		);
		writeRegistryEntry({ ...entry, tagName: tag });
		defined.push(tag);
	}
	return defined;
}

function findRegistration(
	tag: string,
	spec: string,
): Registration | undefined {
	const { existingEncodedVersion } = parseVersionedTagName(tag);
	if (!existingEncodedVersion) return undefined;

	let match: Registration | undefined;
	for (const entry of Object.values(pieRegistry())) {
		if (entry?.status !== Status.loaded || entry.package !== spec) continue;
		if (
			typeof entry.tagName !== "string" ||
			parseVersionedTagName(entry.tagName).existingEncodedVersion !==
				existingEncodedVersion
		) {
			continue;
		}
		const elementClass = customElements.get(entry.tagName);
		if (!elementClass) continue;
		if (!match || (!match.entry.controller && entry.controller)) {
			match = { entry, elementClass };
		}
	}
	return match;
}
