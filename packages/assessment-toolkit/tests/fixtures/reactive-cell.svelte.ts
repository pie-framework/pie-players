/** A rune-backed value a test can read from inside a component's effects. */
export function reactiveCell<T>(initial: T): { value: T } {
	let value = $state(initial);
	return {
		get value() {
			return value;
		},
		set value(next: T) {
			value = next;
		},
	};
}
