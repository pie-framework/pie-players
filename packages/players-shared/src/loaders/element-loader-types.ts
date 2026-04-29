/**
 * Shared types for the ElementLoader primitive and its backend adapters.
 *
 * Keeping types in their own module breaks the import cycle that would
 * otherwise form between the primitive (which dispatches to adapters) and
 * the adapters (which implement the backend interface).
 */

import type { ElementMap } from "./ElementLoader.js";

export type ElementTag = string;

export type { ElementMap };

/**
 * Structured reason for why a specific tag failed to register.
 *
 * The primitive prefers adapter-supplied reasons (rich, diagnostic) over the
 * generic `timeout` reason it synthesizes from its own verification pass.
 */
export type RegistrationFailureReason =
	| { kind: "timeout"; tag: ElementTag; timeoutMs: number }
	| { kind: "not-a-constructor"; tag: ElementTag; packageName?: string }
	| {
			kind: "package-not-in-bundle";
			tag: ElementTag;
			packageName: string;
			availablePackages: string[];
	  }
	| {
			kind: "module-load-failed";
			tag: ElementTag;
			specifier: string;
			cause: string;
	  }
	| {
			kind: "bundle-load-failed";
			tag: ElementTag;
			url: string;
			cause: string;
	  }
	| { kind: "define-failed"; tag: ElementTag; cause: string }
	| { kind: "backend-rejected"; tag: ElementTag; cause: string }
	| { kind: "no-element-class"; tag: ElementTag; packageName: string };

/**
 * Thrown by an adapter when it has structured, per-tag knowledge of which
 * registrations failed and why. The primitive unpacks the `reasons` map
 * and merges it into its own `ElementLoaderError.reasons`.
 *
 * Generic `Error` thrown from an adapter is treated as catastrophic: the
 * primitive assigns a blanket `backend-rejected` reason to every requested
 * tag that is still missing after verification.
 */
export class AdapterFailure extends Error {
	override readonly name = "AdapterFailure";
	readonly reasons: Map<ElementTag, RegistrationFailureReason>;

	constructor(reasons: Map<ElementTag, RegistrationFailureReason>) {
		const tags = [...reasons.keys()];
		super(
			`Backend adapter failure for ${reasons.size} tag(s): ${tags.join(", ")}`,
		);
		this.reasons = reasons;
	}
}

/**
 * Context the primitive hands to the adapter for each load.
 *
 * The adapter is free to use `whenDefinedTimeoutMs` for its own internal
 * waits, but the primitive always enforces an independent
 * `customElements.whenDefined` verification after the adapter returns — so
 * an adapter cannot silently under-register tags even if it ignores this
 * context.
 */
export type BackendContext = {
	doc: Document;
	whenDefinedTimeoutMs: number;
};

/**
 * Backend adapter contract.
 *
 * Resolve only if every requested tag was attempted and the adapter
 * believes every tag is registered. On partial failure, throw
 * `AdapterFailure` with a `reasons` map. On catastrophic failure, throw a
 * generic Error.
 */
export type ElementLoaderBackend = {
	load(elements: ElementMap, context: BackendContext): Promise<void>;
};
