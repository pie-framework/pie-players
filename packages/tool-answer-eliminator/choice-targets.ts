import type { ChoiceAdapter } from "./adapters/choice-adapter.js";
import { EBSRAdapter } from "./adapters/ebsr-adapter.js";
import { MultipleChoiceAdapter } from "./adapters/multiple-choice-adapter.js";

/** The AfA PNP 3.0 support term an element declares to take the eliminator. */
export const ANSWER_MASKING = "answer-masking";

const CHOICE_HOOK_ATTR = "data-pie-answer-eliminator-choice";
const LABEL_HOOK_ATTR = "data-pie-answer-eliminator-label";

/** One choice the eliminator can strike through or mask. */
export interface ChoiceTarget {
	/** Unique within its element and stable across renders: it is persisted. */
	id: string;
	/** The choice's accessible name, for the toggle's label. */
	label: string;
	/** Where the toggle goes, and what carries the eliminated state. */
	container: HTMLElement;
	/** The range the strategy strikes through or masks. */
	createRange(): Range | null;
	isSelected(): boolean;
	canEliminate(): boolean;
	/** Blocks or restores the learner's selection of the choice. */
	setEliminated(eliminated: boolean): void;
}

export interface FoundChoice {
	target: ChoiceTarget;
	/** The declaring element that supplied the choice, null for a legacy one. */
	owner: HTMLElement | null;
}

/** The terms an element's class declares, or null when it declares nothing. */
function declaredSupports(element: Element): readonly unknown[] | null {
	if (!element.localName.includes("-")) return null;
	try {
		const declared = (element.constructor as { pieSupports?: unknown })
			.pieSupports;
		return Array.isArray(declared) ? declared : null;
	} catch {
		return null;
	}
}

/**
 * The elements under `root`, `root` included, whose class declares supports.
 * The outermost declaring element owns its subtree, so a declaring part inside
 * a declaring element answers through that element.
 */
function declaringElements(root: HTMLElement): HTMLElement[] {
	const owners: HTMLElement[] = [];
	for (const element of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
		if (!declaredSupports(element)) continue;
		if (owners.some((owner) => owner.contains(element))) continue;
		owners.push(element);
	}
	return owners;
}

function guarded<T>(read: () => T, fallback: T, what: string): T {
	try {
		return read();
	} catch (error) {
		console.error(`[AnswerEliminator] ${what} threw:`, error);
		return fallback;
	}
}

/**
 * A choice an element returned from `pieSupportTargets('answer-masking')`,
 * with the element its range covers, or null when it is not shaped as the
 * README describes.
 */
function declaredTarget(
	candidate: unknown,
): { target: ChoiceTarget; content: Element } | null {
	if (!candidate || typeof candidate !== "object") return null;
	const declared = candidate as Record<string, unknown>;
	const { id, label, container, content } = declared;
	const { isSelected, isEliminable, setEliminated } = declared;
	if (typeof id !== "string" || !id || typeof label !== "string") return null;
	if (!(container instanceof HTMLElement) || !(content instanceof Element)) {
		return null;
	}
	// The strategies find the choice from its range, by walking up from it.
	if (!container.contains(content)) return null;
	if (
		typeof isSelected !== "function" ||
		typeof isEliminable !== "function" ||
		typeof setEliminated !== "function"
	) {
		return null;
	}
	const target: ChoiceTarget = {
		id,
		label: label.trim() || content.textContent?.trim() || "Unlabeled choice",
		container,
		createRange() {
			const range = document.createRange();
			range.selectNodeContents(content);
			return range;
		},
		isSelected: () =>
			guarded(() => isSelected.call(candidate) === true, false, "isSelected"),
		canEliminate: () =>
			guarded(
				() => isEliminable.call(candidate) === true,
				false,
				"isEliminable",
			),
		setEliminated: (eliminated) =>
			guarded(
				() => setEliminated.call(candidate, eliminated),
				undefined,
				"setEliminated",
			),
	};
	return { target, content };
}

function setHook(element: Element, name: string): void {
	if (element.getAttribute(name) !== "true") element.setAttribute(name, "true");
}

function declaredChoices(owner: HTMLElement): FoundChoice[] {
	if (!declaredSupports(owner)?.includes(ANSWER_MASKING)) return [];
	const supply = (owner as { pieSupportTargets?: unknown }).pieSupportTargets;
	if (typeof supply !== "function") {
		console.warn(
			`[AnswerEliminator] <${owner.localName}> declares ${ANSWER_MASKING} but has no pieSupportTargets()`,
		);
		return [];
	}
	const supplied = guarded(
		() => supply.call(owner, ANSWER_MASKING) as unknown,
		[],
		`<${owner.localName}>.pieSupportTargets`,
	);
	if (!Array.isArray(supplied)) return [];
	const found: FoundChoice[] = [];
	const ids = new Set<string>();
	for (const candidate of supplied) {
		const declared = declaredTarget(candidate);
		if (!declared || ids.has(declared.target.id)) {
			console.warn(
				`[AnswerEliminator] <${owner.localName}> supplied a choice that is malformed or repeats an id`,
				candidate,
			);
			continue;
		}
		const { target, content } = declared;
		ids.add(target.id);
		// The strategies style and announce through these. Unchanged hooks are
		// not rewritten: every write is a mutation the core observes.
		setHook(target.container, CHOICE_HOOK_ATTR);
		setHook(content, LABEL_HOOK_ATTR);
		found.push({ target, owner });
	}
	return found;
}

/**
 * pie-item contract compatibility: legacy pie-elements, and pie-elements-ng
 * releases from before elements declared their supports, render multiple-choice
 * and EBSR markup these adapters read. They run only on choices no declaring
 * element owns. EBSR goes first: its parts render multiple-choice markup, and
 * its ids carry the part.
 */
const LEGACY_ADAPTERS: readonly ChoiceAdapter[] = [
	new EBSRAdapter(),
	new MultipleChoiceAdapter(),
];

function legacyTarget(choice: HTMLElement, adapter: ChoiceAdapter): ChoiceTarget {
	return {
		id: adapter.getChoiceId(choice),
		label: adapter.getChoiceLabel(choice),
		container: choice,
		createRange: () => adapter.createChoiceRange(choice),
		isSelected: () => adapter.isSelected(choice),
		canEliminate: () => adapter.canEliminate(choice),
		setEliminated: (eliminated) => adapter.setSelectable(choice, !eliminated),
	};
}

function legacyChoices(
	root: HTMLElement,
	owners: readonly HTMLElement[],
	declared: readonly FoundChoice[],
): FoundChoice[] {
	const found: FoundChoice[] = [];
	// A declared container carries the choice hook the adapters also match.
	const seen = new Set<HTMLElement>(
		declared.map(({ target }) => target.container),
	);
	for (const adapter of LEGACY_ADAPTERS) {
		for (const choice of adapter.findChoices(root)) {
			if (seen.has(choice)) continue;
			seen.add(choice);
			if (owners.some((owner) => owner.contains(choice))) continue;
			found.push({ target: legacyTarget(choice, adapter), owner: null });
		}
	}
	return found;
}

/**
 * Every choice under `root`: those declaring elements supply, then the legacy
 * ones outside them. An element that declares supports without answer masking
 * contributes none, and keeps the legacy adapters out of its subtree.
 */
export function findChoiceTargets(root: HTMLElement): FoundChoice[] {
	const owners = declaringElements(root);
	const declared = owners.flatMap(declaredChoices);
	return [...declared, ...legacyChoices(root, owners, declared)];
}
