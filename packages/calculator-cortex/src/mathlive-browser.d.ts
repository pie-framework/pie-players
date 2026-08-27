export {};

declare module "mathlive" {
	export interface VirtualKeyboardLayout {
		id?: string;
		label?: string;
		displayEditToolbar?: boolean;
		rows?: Array<Array<string | Record<string, unknown>>>;
	}

	export class MathfieldElement extends HTMLElement {
		static fontsDirectory: string | null;
		static soundsDirectory: string | null;
		static computeEngine: unknown | null;
		static locale: string;
		static decimalSeparator: "." | ",";

		value: string;
		menuItems: readonly unknown[];
		mathVirtualKeyboardPolicy: "auto" | "manual" | "sandboxed";
		smartMode: boolean;
		smartFence: boolean;
		popoverPolicy: "auto" | "off";
		environmentPopoverPolicy: "auto" | "off" | "on";
		// This declaration shadows the one mathlive re-exports through `export *`,
		// so anything the package calls has to be named here. `executeCommand` is
		// how the keypad writes into the field: it goes through MathLive's own edit
		// pipeline, which fires `input` and lets `MathFieldInput`'s existing handler
		// stay the single writer to the controller.
		executeCommand(command: string | [string, ...unknown[]]): boolean;
		insert(latex: string, options?: Record<string, unknown>): boolean;
	}
}

declare global {
	interface Window {
		mathVirtualKeyboard?: {
			layouts: readonly (string | import("mathlive").VirtualKeyboardLayout)[];
			editToolbar: "none" | "default";
			show(options?: { animate: boolean }): void;
			hide(options?: { animate: boolean }): void;
			visible: boolean;
		};
	}
}
