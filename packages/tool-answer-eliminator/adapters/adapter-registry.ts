import type { ChoiceAdapter } from "./choice-adapter";
import { EBSRAdapter } from "./ebsr-adapter";
import { InlineDropdownAdapter } from "./inline-dropdown-adapter";
import { MultipleChoiceAdapter } from "./multiple-choice-adapter";

export interface ChoiceWithAdapter {
	choice: HTMLElement;
	adapter: ChoiceAdapter;
}

/**
 * Registry for choice adapters
 * Automatically detects which adapter to use for different PIE elements
 */
export class AdapterRegistry {
	private adapters: ChoiceAdapter[];

	constructor() {
		// Register adapters in priority order (higher priority first)
		this.adapters = [
			new MultipleChoiceAdapter(),
			new EBSRAdapter(),
			new InlineDropdownAdapter(),
		].sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Find the appropriate adapter for an element
	 */
	findAdapter(element: HTMLElement): ChoiceAdapter | null {
		return this.adapters.find((adapter) => adapter.canHandle(element)) || null;
	}

	/**
	 * Find all choices with their adapters within a root element
	 */
	findAllChoicesWithAdapters(root: HTMLElement): ChoiceWithAdapter[] {
		const results: ChoiceWithAdapter[] = [];
		const processedChoices = new Set<HTMLElement>();

		// Try each adapter
		for (const adapter of this.adapters) {
			const choices = adapter.findChoices(root);

			for (const choice of choices) {
				// Avoid duplicates (in case adapters overlap)
				if (processedChoices.has(choice)) continue;

				processedChoices.add(choice);
				results.push({ choice, adapter });
			}
		}

		return results;
	}

	/**
	 * Register a custom adapter
	 */
	registerAdapter(adapter: ChoiceAdapter): void {
		this.adapters.push(adapter);
		this.adapters.sort((a, b) => b.priority - a.priority);
	}
}
