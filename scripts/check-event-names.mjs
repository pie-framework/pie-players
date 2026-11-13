#!/usr/bin/env bun
/**
 * Fails on a DOM event name outside the `pie-` namespace that a published
 * element's manifest declares.
 *
 * Event names share one flat namespace on the page: a listener on `document`
 * or on a host's wrapper sees `close`, `load-complete` and `session-changed`
 * from every library on it, and a generic name is the first one a host's own
 * code or another widget picks. New events are named `pie-<noun>-<change>`.
 *
 * The check reads each package's committed `custom-elements.json`, whose
 * events `check:custom-elements-manifest` ties to the `@fires` tags and to the
 * `dispatchEvent` calls in source, so a new event cannot reach this list
 * undocumented. The names in `LEGACY_EVENT_NAMES` shipped before the rule and
 * hosts listen to them; renaming one breaks those hosts, so they stay. The
 * list only shrinks: an entry whose event no manifest declares any more fails.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PACKAGES = join(ROOT, "packages");

const CLOSE = ["close"];

/** Package directory → event names declared before the `pie-` rule. */
export const LEGACY_EVENT_NAMES = {
	"assessment-player": [
		"assessment-controller-ready",
		"assessment-error",
		"assessment-navigation-requested",
		"assessment-progress-changed",
		"assessment-route-changed",
		"assessment-session-applied",
		"assessment-session-changed",
		"assessment-submission-state-changed",
		"framework-error",
	],
	"assessment-toolkit": [
		"composition-changed",
		"framework-error",
		"item-player-event",
		"item-session-changed",
		"runtime-inherited",
		"runtime-owned",
		"runtime-ready",
		"section-ready",
		"session-changed",
		"toolkit-ready",
	],
	"item-list": [
		"expanded-changed",
		"extension-error",
		"framework-error",
		"load-complete",
		"player-error",
	],
	"item-player": [
		"backend-content-released",
		"backend-content-saved",
		"backend-error",
		"backend-load-complete",
		"backend-model-complete",
		"backend-score-complete",
		"backend-session-saved",
		"bundle-retry-status",
		"close",
		"correct-responses-populated",
		"feature-decision-applied",
		"framework-error",
		"load-complete",
		"model-loaded",
		"model-updated",
		"player-error",
		"session-changed",
		"session-snapshot-available",
	],
	"section-player": [
		"composition-changed",
		"element-preload-error",
		"element-preload-retry",
		"framework-error",
		"item-player-event",
		"item-session-changed",
		"runtime-inherited",
		"runtime-owned",
		"runtime-ready",
		"section-ready",
		"session-changed",
		"toolkit-ready",
	],
	"section-player-tools-event-debugger": CLOSE,
	"section-player-tools-instrumentation-debugger": CLOSE,
	"section-player-tools-pnp-debugger": CLOSE,
	"section-player-tools-session-debugger": CLOSE,
	"section-player-tools-tts-settings": CLOSE,
};

export const isPieEventName = (name) => name.startsWith("pie-");

/** Every event a manifest declares, with the element that fires it. */
export function manifestEvents(manifest) {
	const events = [];
	for (const module of manifest.modules ?? []) {
		for (const declaration of module.declarations ?? []) {
			for (const event of declaration.events ?? []) {
				if (typeof event.name !== "string") continue;
				events.push({
					element: declaration.tagName ?? declaration.name ?? "",
					name: event.name,
				});
			}
		}
	}
	return events;
}

/**
 * Splits the events of `packages` — `{ directory, manifest }` entries — into
 * the ones outside the namespace that nothing allows, and the allowlist
 * entries no manifest declares.
 */
export function checkEventNames(packages, allowed = LEGACY_EVENT_NAMES) {
	const violations = [];
	const declared = new Map();
	let events = 0;
	for (const { directory, manifest } of packages) {
		const legacy = new Set(allowed[directory] ?? []);
		for (const { element, name } of manifestEvents(manifest)) {
			events += 1;
			if (!declared.has(directory)) declared.set(directory, new Set());
			declared.get(directory).add(name);
			if (isPieEventName(name) || legacy.has(name)) continue;
			violations.push({ directory, element, name });
		}
	}
	const stale = [];
	for (const [directory, names] of Object.entries(allowed)) {
		for (const name of names) {
			if (!declared.get(directory)?.has(name)) stale.push({ directory, name });
		}
	}
	return { events, violations, stale };
}

/** The committed manifest of every package that publishes one. */
export function readPackageManifests() {
	const packages = [];
	for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const directory = join(PACKAGES, entry.name);
		const pkgFile = join(directory, "package.json");
		if (!existsSync(pkgFile)) continue;
		const { customElements } = JSON.parse(readFileSync(pkgFile, "utf8"));
		if (typeof customElements !== "string") continue;
		const manifestFile = join(directory, customElements);
		if (!existsSync(manifestFile)) continue;
		packages.push({
			directory: entry.name,
			file: relative(ROOT, manifestFile),
			manifest: JSON.parse(readFileSync(manifestFile, "utf8")),
		});
	}
	return packages.sort((a, b) => a.directory.localeCompare(b.directory));
}

function main() {
	const packages = readPackageManifests();
	const { events, violations, stale } = checkEventNames(packages);
	if (violations.length > 0 || stale.length > 0) {
		if (violations.length > 0) {
			console.error(
				`[check-event-names] Found ${violations.length} event name(s) outside the pie- namespace`,
			);
			for (const { directory, element, name } of violations) {
				console.error(`- packages/${directory}: <${element}> fires "${name}"`);
			}
			console.error(
				"\nName a new event pie-<noun>-<change>. An event that shipped under another name stays in LEGACY_EVENT_NAMES.",
			);
		}
		if (stale.length > 0) {
			console.error(
				`[check-event-names] ${stale.length} LEGACY_EVENT_NAMES entr${stale.length === 1 ? "y" : "ies"} no manifest declares`,
			);
			for (const { directory, name } of stale) {
				console.error(`- packages/${directory}: "${name}"`);
			}
			console.error("\nRemove the entry from LEGACY_EVENT_NAMES.");
		}
		process.exit(1);
	}
	console.log(
		`[check-event-names] OK: ${events} event(s) in ${packages.length} manifest(s), every name in the pie- namespace or listed as shipped before it`,
	);
}

if (import.meta.main) main();
