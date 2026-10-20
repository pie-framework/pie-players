import type { SummarizeFn } from "@pie-element/shared-types";
import { packageName } from "./label.js";
import type { SummaryResolver } from "./summarize-item.js";

let bundled: Promise<Readonly<Record<string, SummarizeFn>>> | undefined;

/**
 * The bundled summarizer set, keyed by package name and loaded once per page. It ignores the
 * version, so legacy models read through the current summarizers.
 */
export const bundledSummaries: SummaryResolver = async (_tagName, pkg) => {
	bundled ??= import("../summarizers/index.js").then(
		(module) => module.summarizers,
		(error: unknown) => {
			// A later row retries rather than inheriting one failed chunk load.
			bundled = undefined;
			throw error;
		},
	);
	return (await bundled)[packageName(pkg)] ?? null;
};
