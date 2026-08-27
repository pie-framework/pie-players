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
