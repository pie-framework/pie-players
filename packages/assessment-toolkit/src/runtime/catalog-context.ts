import { requestContext } from "@pie-players/pie-context";
import {
	type AssessmentToolkitShellContext,
	assessmentToolkitShellContext,
} from "../context/assessment-toolkit-context.js";
import type { CatalogLookupContext } from "../services/AccessibilityCatalogResolver.js";
import { catalogOwnerContextFor } from "../services/catalog-owner.js";
import { composedParentElement } from "../services/tts/flat-tree.js";

/** Where a shell's owner registered its catalogs, from the toolkit runtime context. */
export interface CatalogRuntimeScope {
	assessmentId?: string;
	sectionId?: string;
}

/**
 * The catalog lookup context for content in `shell`: the cards its owner
 * registered, then the assessment's.
 */
export const catalogContextForShell = (
	shell: AssessmentToolkitShellContext,
	runtime?: CatalogRuntimeScope | null,
): CatalogLookupContext =>
	catalogOwnerContextFor({
		kind: shell.kind,
		assessmentId: runtime?.assessmentId,
		sectionId: runtime?.sectionId,
		itemId: shell.itemId,
		canonicalItemId: shell.canonicalItemId || shell.itemId,
	});

/**
 * The catalog lookup context for the shell scope holding `node`, asked of that
 * shell's context provider at the time of the call, or undefined outside every
 * shell scope. For a tool that serves several shells and so has no shell
 * context of its own, such as the section-wide annotation toolbar.
 */
export const catalogContextHolding = (
	node: Node,
	runtime?: CatalogRuntimeScope | null,
): CatalogLookupContext | undefined => {
	const element =
		node.nodeType === 1 ? (node as Element) : composedParentElement(node);
	const shell = element
		? requestContext(element, assessmentToolkitShellContext)
		: undefined;
	return shell ? catalogContextForShell(shell, runtime) : undefined;
};
