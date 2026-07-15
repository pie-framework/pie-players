/**
 * Type surface for the vendored `<nds-icon-button>` bundle.
 *
 * Consumers import this module for its side effect (it registers the
 * `nds-icon-button` custom element on evaluation). The named export is
 * provided only so tooling can reference the constructor; the tag is what
 * consumers actually use, via markup or `document.createElement`.
 */
export declare class NdsIconButton extends HTMLElement {
	variant: string;
	size: string;
	/** Shape of the button; also mirrored by the `shape` accessor. */
	type: string;
	shape: string;
	state: string;
	iconName: string;
	disabled: boolean;
	buttonAriaLabel: string;
}
