declare module '@pie-players/pie-item-player/components/item-session-debugger-element' {
	export interface PieItemSessionDebuggerElement extends HTMLElement {
		itemName?: string;
		itemId?: string;
		config?: unknown;
		session?: unknown;
		env?: unknown;
		score?: unknown;
	}
}
