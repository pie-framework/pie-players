export function coerceBooleanLike(
	value: boolean | string | null | undefined,
	defaultValue = false,
): boolean {
	if (typeof value === "boolean") {
		return value;
	}
	if (value === null || value === undefined) {
		return defaultValue;
	}
	const normalizedValue = String(value).trim().toLowerCase();
	if (normalizedValue === "") {
		return defaultValue;
	}
	if (["false", "0", "off", "no"].includes(normalizedValue)) {
		return false;
	}
	if (["true", "1", "on", "yes"].includes(normalizedValue)) {
		return true;
	}
	return Boolean(normalizedValue);
}

/**
 * Reads a boolean attribute value: present is true and absent is false, as in
 * HTML, except that the words `coerceBooleanLike` reads as false stay false.
 */
export function coerceBooleanAttribute(value: string | null): boolean {
	return value !== null && coerceBooleanLike(value, true);
}

type SvelteElementInternals = {
	$$p_d?: Record<string, { attribute?: string; type?: string }>;
};

type AttributeChangedCallback = (
	name: string,
	oldValue: string | null,
	newValue: string | null,
) => void;

const isBooleanProp = (element: HTMLElement, attribute: string): boolean => {
	const definitions = (element as HTMLElement & SvelteElementInternals).$$p_d;
	if (!definitions) return false;
	return Object.entries(definitions).some(
		([prop, definition]) =>
			definition.type === "Boolean" &&
			(definition.attribute ?? prop.toLowerCase()) === attribute,
	);
};

/**
 * `customElement.extend` hook for a Svelte element with `type: "Boolean"`
 * props. Svelte reads those by presence, so `show-bottom-border="false"` sets
 * the prop to `true`; this passes Svelte a removed attribute whenever
 * `coerceBooleanAttribute` reads the value as false.
 */
export function coerceBooleanAttributes<Base extends CustomElementConstructor>(
	ElementClass: Base,
): Base {
	const baseCallback = (
		ElementClass.prototype as {
			attributeChangedCallback?: AttributeChangedCallback;
		}
	).attributeChangedCallback;
	return class extends ElementClass {
		attributeChangedCallback(
			name: string,
			oldValue: string | null,
			newValue: string | null,
		): void {
			const value =
				newValue !== null &&
				isBooleanProp(this, name) &&
				!coerceBooleanAttribute(newValue)
					? null
					: newValue;
			baseCallback?.call(this, name, oldValue, value);
		}
	};
}
