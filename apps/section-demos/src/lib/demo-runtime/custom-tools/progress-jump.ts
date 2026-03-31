import {
	createScopedToolId,
	type ToolContext,
	type ToolRegistration,
	type ToolToolbarButtonDefinition,
	type ToolToolbarRenderResult,
	type ToolbarContext,
} from "@pie-players/pie-assessment-toolkit";

type SectionPlayerLike = HTMLElement & {
	selectComposition?: () => { itemsCount?: number; passagesCount?: number };
};

const SECTION_META_ICON = `
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
	<rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
	<line x1="7" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
	<line x1="7" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
	<circle cx="17" cy="14.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
</svg>
`;

function resolveSectionPlayer(scopeElement: HTMLElement | null): SectionPlayerLike | null {
	const localHost = scopeElement?.closest<SectionPlayerLike>(
		"pie-section-player-splitpane, pie-section-player-vertical, pie-section-player-kernel-host",
	);
	if (localHost) return localHost;
	return (
		document.querySelector<SectionPlayerLike>("pie-section-player-splitpane") ||
		document.querySelector<SectionPlayerLike>("pie-section-player-vertical") ||
		document.querySelector<SectionPlayerLike>("pie-section-player-kernel-host")
	);
}

function createPanelElement(): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "pie-demo-section-meta";
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
		<div class="pie-demo-section-meta__intro" style="margin-bottom: 0.75rem; color: var(--pie-text-light, #6b7280);">
			Read-only demo metadata for this section session.
		</div>
		<div class="pie-demo-section-meta__rows" data-meta-rows></div>
	`;
	return panel;
}

function readPlayerMeta(player: SectionPlayerLike | null): {
	playerType: string;
	modeRole: string;
	totalItems: string;
	totalPassages: string;
} {
	if (!player) {
		return {
			playerType: "n/a",
			modeRole: "n/a",
			totalItems: "n/a",
			totalPassages: "n/a",
		};
	}
	const composition = player.selectComposition?.() || {};
	const mode = player.getAttribute("mode") || player.getAttribute("data-pie-mode") || "n/a";
	const role = player.getAttribute("role") || player.getAttribute("data-pie-role") || "n/a";
	return {
		playerType: player.getAttribute("player-type") || "n/a",
		modeRole: `${mode}/${role}`,
		totalItems: String(composition.itemsCount ?? "n/a"),
		totalPassages: String(composition.passagesCount ?? "n/a"),
	};
}

function setMetadataRows(panel: HTMLElement, rows: Array<[string, string]>): void {
	const container = panel.querySelector<HTMLElement>("[data-meta-rows]");
	if (!container) return;
	container.innerHTML = "";
	for (const [label, value] of rows) {
		const row = document.createElement("div");
		row.style.display = "grid";
		row.style.gridTemplateColumns = "minmax(7rem, 40%) 1fr";
		row.style.gap = "0.5rem";
		row.style.padding = "0.3rem 0";
		row.style.borderBottom = "1px solid var(--pie-border-light, #e5e7eb)";

		const labelNode = document.createElement("span");
		labelNode.style.fontWeight = "600";
		labelNode.style.color = "var(--pie-text, #111827)";
		labelNode.textContent = label;

		const valueNode = document.createElement("span");
		valueNode.style.wordBreak = "break-word";
		valueNode.textContent = value || "n/a";

		row.appendChild(labelNode);
		row.appendChild(valueNode);
		container.appendChild(row);
	}
}

export const sectionMetaInfoToolRegistration: ToolRegistration = {
	toolId: "sectionMetaInfo",
	name: "Section Meta",
	description: "Show read-only metadata for the section and assessment session",
	icon: SECTION_META_ICON,
	supportedLevels: ["section"],
	isVisibleInContext(_context: ToolContext): boolean {
		return true;
	},
	renderToolbar(
		_context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		const panel = createPanelElement();
		const createdAt = new Date().toISOString();
		const resolvePlayer = () => resolveSectionPlayer(toolbarContext.getScopeElement?.() || null);
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(_context) : this.icon,
			ariaLabel: "Open section metadata panel",
			tooltip: "Open section metadata panel",
			disabled: false,
			active: toolbarContext.isToolVisible(fullToolId),
			onClick: () => {
				toolbarContext.toggleTool(this.toolId);
			},
		};
		const sync = () => {
			const isActive = toolbarContext.isToolVisible(fullToolId);
			const playerMeta = readPlayerMeta(resolvePlayer());
			panel.style.display = isActive ? "block" : "none";
			button.active = isActive;
			button.ariaLabel = isActive
				? "Close section metadata panel"
				: "Open section metadata panel";
			button.tooltip = isActive
				? "Close section metadata panel"
				: "Open section metadata panel";
			setMetadataRows(panel, [
				["Assessment ID", String(toolbarContext.scope.assessmentId || "n/a")],
				["Section ID", String(toolbarContext.scope.sectionId || "n/a")],
				["Total items", playerMeta.totalItems],
				["Total passages", playerMeta.totalPassages],
				["Player type", playerMeta.playerType],
				["Mode/role", playerMeta.modeRole],
				["Session stamp", createdAt],
			]);
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
						initialWidth: 360,
						initialHeight: 280,
						minWidth: 300,
						minHeight: 220,
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
