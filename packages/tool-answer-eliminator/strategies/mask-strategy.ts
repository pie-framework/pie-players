import type {
	EliminationStrategy,
	EliminationTarget,
} from "./elimination-strategy.js";

const MASK_CLASS = "pie-answer-eliminator-masked";

/**
 * Dims and blurs the content. A class on the content does it, because a CSS
 * custom highlight honours neither `opacity` nor `filter`. The content stays in
 * the accessibility tree: the mask degrades the view, and the core announces
 * the eliminated state as it does for every strategy.
 */
export class MaskStrategy implements EliminationStrategy {
	readonly name = "mask";

	private masked = new Map<string, Element>();

	initialize(): void {}

	destroy(): void {
		this.clearAll();
	}

	apply(choiceId: string, { content }: EliminationTarget): void {
		this.remove(choiceId);
		content.classList.add(MASK_CLASS);
		this.masked.set(choiceId, content);
	}

	remove(choiceId: string): void {
		this.masked.get(choiceId)?.classList.remove(MASK_CLASS);
		this.masked.delete(choiceId);
	}

	isEliminated(choiceId: string): boolean {
		return this.masked.has(choiceId);
	}

	clearAll(): void {
		for (const choiceId of this.getEliminatedIds()) this.remove(choiceId);
	}

	getEliminatedIds(): string[] {
		return Array.from(this.masked.keys());
	}
}
