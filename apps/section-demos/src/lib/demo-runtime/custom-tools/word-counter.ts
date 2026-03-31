import {
	createScopedToolId,
	hasReadableText,
	type ToolContext,
	type ToolRegistration,
	type ToolToolbarButtonDefinition,
	type ToolToolbarRenderResult,
	type ToolbarContext,
} from "@pie-players/pie-assessment-toolkit";

const WORD_COUNTER_ICON = `
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
	<path d="M4 6.5h16M4 11h9M4 15.5h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
	<rect x="15.5" y="12.5" width="5.5" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
	<path d="M17 17h2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>
`;

function resolveTextRoot(toolbarContext: ToolbarContext): HTMLElement | null {
	const scope = toolbarContext.getScopeElement?.() || null;
	if (!scope) return null;
	const card = scope.closest<HTMLElement>("[data-section-item-card], [data-section-passage-card]");
	if (card) {
		return card.querySelector<HTMLElement>(".pie-section-player-content-card-body") || card;
	}
	return scope;
}

function normalizeText(input: string): string {
	return input.replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
	if (!text) return 0;
	return text.split(" ").filter(Boolean).length;
}

function createPanelElement(): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "pie-demo-word-counter";
	panel.style.display = "none";
	panel.style.padding = "0.85rem";
	panel.style.fontFamily = "system-ui, sans-serif";
	panel.style.fontSize = "0.875rem";
	panel.style.lineHeight = "1.4";
	panel.style.background = "var(--pie-background, #fff)";
	panel.style.color = "var(--pie-text, #111827)";
	panel.style.height = "100%";
	panel.style.boxSizing = "border-box";
	panel.style.overflow = "auto";
	panel.innerHTML = `
		<div class="pie-demo-word-counter__stat" style="margin-bottom: 0.5rem;">
			<strong data-count-words>0</strong> words
		</div>
		<div class="pie-demo-word-counter__stat" style="margin-bottom: 0.75rem;">
			<strong data-count-characters>0</strong> non-space characters
		</div>
		<div style="font-size: 0.8rem; color: var(--pie-text-light, #6b7280);">
			Counts come from visible text in the current item/passage card.
		</div>
	`;
	return panel;
}

function updatePanel(panel: HTMLElement, text: string): void {
	const wordsNode = panel.querySelector<HTMLElement>("[data-count-words]");
	const charactersNode = panel.querySelector<HTMLElement>("[data-count-characters]");
	if (!wordsNode || !charactersNode) return;
	const normalized = normalizeText(text);
	const words = countWords(normalized);
	const characters = normalized.replace(/\s+/g, "").length;
	wordsNode.textContent = String(words);
	charactersNode.textContent = String(characters);
}

export const wordCounterToolRegistration: ToolRegistration = {
	toolId: "wordCounter",
	name: "Word Counter",
	description: "Show word and character counts for current item or passage text",
	icon: WORD_COUNTER_ICON,
	supportedLevels: ["item", "passage"],
	isVisibleInContext(context: ToolContext): boolean {
		return hasReadableText(context);
	},
	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		const panel = createPanelElement();
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			ariaLabel: "Open word counter panel",
			tooltip: "Open word counter panel",
			disabled: false,
			active: toolbarContext.isToolVisible(fullToolId),
			onClick: () => {
				toolbarContext.toggleTool(this.toolId);
			},
		};
		const sync = () => {
			const isActive = toolbarContext.isToolVisible(fullToolId);
			const textRoot = resolveTextRoot(toolbarContext);
			const text = textRoot?.textContent || "";
			panel.style.display = isActive ? "block" : "none";
			button.active = isActive;
			button.ariaLabel = isActive ? "Close word counter panel" : "Open word counter panel";
			button.tooltip = isActive ? "Close word counter panel" : "Open word counter panel";
			updatePanel(panel, text);
		};

		return {
			toolId: this.toolId,
			button,
			elements: [
				{
					element: panel,
					mount: "after-buttons",
					shell: {
						title: this.name,
						draggable: true,
						resizable: true,
						closeable: true,
						initialWidth: 340,
						initialHeight: 220,
						minWidth: 280,
						minHeight: 180,
					},
				},
			],
			sync,
			subscribeActive: (callback: (active: boolean) => void) => {
				if (!toolbarContext.subscribeVisibility) return () => {};
				return toolbarContext.subscribeVisibility(() => {
					const active = toolbarContext.isToolVisible(fullToolId);
					sync();
					callback(active);
				});
			},
		};
	},
};
