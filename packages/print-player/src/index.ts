/**
 * PIE Print Player
 *
 * A web component that dynamically loads and renders PIE elements in print mode.
 *
 * @packageDocumentation
 */

// Imported from the narrow `ui/content-styles` subpath rather than the package
// root: `@pie-players/pie-players-shared` sets `sideEffects: true` and this
// package externalizes nothing, so pulling the root barrel in would bundle all
// of players-shared into print-player.js.
import {
	installContentStyles,
	auditContentStyles,
} from "@pie-players/pie-players-shared/ui/content-styles";
// Inlined as text at build time, so the stylesheet travels with the bundle and
// hosts do not have to import it. See installContentStyles for why the player
// owns this.
//
// `?raw`, not `?inline`: both yield a string, but `?inline` also routes the file
// through Vite's CSS pipeline, which emits an unreferenced sibling .css asset in
// library mode — dead weight in the package that a host could mistake for
// something it needs to link. `?raw` reads the authored stylesheet verbatim.
import contentStyles from "@pie-players/pie-theme/components.css?raw";

// Installed at import time, alongside the element registration that
// `./pie-print.js` performs, so the stylesheet is in the document before any
// instance renders — no unstyled first paint. A host that sets
// <html data-pie-content-styles="host"> owns the stylesheet instead, and gets
// warned if it then ships nothing, or ships a second copy.
//
// `@media print { .noprint, .kds-noprint { display: none } }` lives in this
// stylesheet, so for the print player a missing copy does not merely render
// authored content unstyled — it prints content the author marked as
// non-printing.
installContentStyles(contentStyles, "pie-print-player");
auditContentStyles("pie-print-player");

export { define, status, whenDefined } from "./ce-registry.js";
export {
	defaultLoadResolution,
	defaultResolve,
	hashCode,
} from "./element-resolver.js";
export {
	mkItem,
	printItemAndFloaters,
	processMarkup,
} from "./markup-processor.js";
export { PiePrint } from "./pie-print.js";

export type {
	Config,
	Elements,
	Item,
	LoadResolutionFn,
	LoadResolutionResult,
	MissingElFn,
	Model,
	NodeResult,
	PkgResolution,
	ResolverFn,
} from "./types.js";
