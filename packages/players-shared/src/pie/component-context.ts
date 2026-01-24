/**
 * Component context stack for PIE mini-players.
 *
 * Used to attribute resource load failures (fonts/images/etc.) to the currently
 * active mini-player component.
 */

export type ComponentContext = {
	componentName: string;
	elementType?: string;
	itemId?: string;
	timestamp: number;
};

// Track active components (stack-based for nested components)
const activeComponents: ComponentContext[] = [];

/**
 * Register a component as active (call when component mounts).
 * Returns a cleanup function to call when the component unmounts.
 */
export function registerActiveComponent(context: ComponentContext): () => void {
	activeComponents.push(context);

	return () => {
		const index = activeComponents.indexOf(context);
		if (index > -1) {
			activeComponents.splice(index, 1);
		}
	};
}

/**
 * Get the current active component context (top of the stack).
 */
export function getCurrentComponentContext(): ComponentContext | null {
	return activeComponents.length > 0
		? activeComponents[activeComponents.length - 1]
		: null;
}
