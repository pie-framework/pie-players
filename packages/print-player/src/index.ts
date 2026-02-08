/**
 * PIE Print Player
 *
 * A web component that dynamically loads and renders PIE elements in print mode.
 *
 * @packageDocumentation
 */

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
