import type {
	ToolContext,
	ToolRegistration,
	ToolToolbarRenderResult,
	ToolbarContext,
	ToolRegistry,
} from "@pie-players/pie-assessment-toolkit";
import { createSectionDemoToolRegistry } from "../default-tool-registry";

type ToggleSpeedOption = {
	rate: number;
	label: string;
	ariaLabel: string;
};

const TOGGLE_SPEED_OPTIONS: ToggleSpeedOption[] = [
	{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed" },
	{ rate: 1.25, label: "Fast", ariaLabel: "Fast speed" },
];

const resolveReadingTarget = (
	toolbarContext: ToolbarContext,
): HTMLElement | null => {
	const scope = toolbarContext.getScopeElement?.() || null;
	if (!scope) return null;
	const card = scope.closest<HTMLElement>(
		"[data-section-item-card], [data-section-passage-card]",
	);
	if (!card) return scope;
	return (
		card.querySelector<HTMLElement>(".pie-section-player-content-card-body") ||
		card
	);
};

const setPlaybackRate = async (
	toolbarContext: ToolbarContext,
	rate: number,
): Promise<void> => {
	const ttsService = toolbarContext.ttsService;
	if (!ttsService) return;
	if (typeof ttsService.setPlaybackRate === "function") {
		await ttsService.setPlaybackRate(rate);
		return;
	}
	await ttsService.updateSettings({ rate });
};

const createToggleSpeedElement = (
	toolbarContext: ToolbarContext,
): HTMLElement => {
	const root = document.createElement("div");
	root.className = "pie-tool-tts-inline pie-demo-tts-toggle-speed";
	root.setAttribute("data-demo-tts-toggle-speed", "true");

	let controlsVisible = false;
	let speaking = false;
	let paused = false;
	let playbackRate = 1;

	const playIcon = `<svg viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"></path></svg>`;
	const pauseIcon = `<svg viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true" focusable="false"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>`;

	const updateTriggerState = () => {
		const trigger = root.querySelector<HTMLButtonElement>(
			".pie-tool-tts-inline__trigger",
		);
		if (!trigger) return;
		trigger.classList.toggle(
			"pie-tool-tts-inline__trigger--active",
			controlsVisible,
		);
		trigger.setAttribute("aria-expanded", String(controlsVisible));
		const panel = root.querySelector<HTMLElement>("[data-demo-tts-panel]");
		const panelId = panel?.id || undefined;
		if (controlsVisible && panelId) {
			trigger.setAttribute("aria-controls", panelId);
		} else {
			trigger.removeAttribute("aria-controls");
		}
		trigger.setAttribute(
			"aria-label",
			speaking && !paused
				? "Pause reading"
				: paused
					? "Resume reading"
					: "Play reading",
		);
		trigger.innerHTML = speaking && !paused ? pauseIcon : playIcon;
	};

	const updateSpeedPressedState = () => {
		for (const button of root.querySelectorAll<HTMLButtonElement>(
			"[data-demo-tts-speed-rate]",
		)) {
			const rate = Number(button.dataset.demoTtsSpeedRate);
			button.setAttribute("aria-pressed", String(playbackRate === rate));
			button.classList.toggle(
				"pie-tool-tts-inline__control--speed-active",
				playbackRate === rate,
			);
		}
	};

	const setControlsVisible = (visible: boolean) => {
		controlsVisible = visible;
		root.dataset.active = String(visible);
		const panel = root.querySelector<HTMLElement>("[data-demo-tts-panel]");
		if (panel) panel.hidden = !visible;
		updateTriggerState();
	};

	const applyRate = async (nextRate: number) => {
		playbackRate = nextRate;
		updateSpeedPressedState();
		await setPlaybackRate(toolbarContext, nextRate);
	};

	const startReading = async () => {
		const ttsService = toolbarContext.ttsService;
		if (!ttsService) return;
		await toolbarContext.toolkitCoordinator?.ensureTTSReady?.();
		await setPlaybackRate(toolbarContext, playbackRate);
		const target = resolveReadingTarget(toolbarContext);
		const text = target?.textContent || "";
		if (!target || !text.trim()) return;
		setControlsVisible(true);
		speaking = true;
		paused = false;
		updateTriggerState();
		await ttsService.speak(text, {
			catalogId: toolbarContext.catalogId || undefined,
			language: toolbarContext.language || "en-US",
			contentElement: target,
		} as any);
	};

	const pauseReading = () => {
		toolbarContext.ttsService?.pause?.();
		paused = true;
		updateTriggerState();
	};

	const resumeReading = () => {
		toolbarContext.ttsService?.resume?.();
		paused = false;
		speaking = true;
		setControlsVisible(true);
		updateTriggerState();
	};

	const stopReading = () => {
		toolbarContext.ttsService?.stop?.();
		speaking = false;
		paused = false;
		setControlsVisible(false);
	};

	const panelId = `pie-demo-tts-toggle-speed-${Math.random().toString(36).slice(2)}-controls`;
	root.innerHTML = `
		<div
			id="${panelId}"
			data-demo-tts-panel
			class="pie-tool-tts-inline__panel pie-tool-tts-inline__panel--left-aligned-inline"
			role="toolbar"
			aria-label="Reading controls"
			tabindex="-1"
			hidden
		>
			<div class="pie-tool-tts-inline__speed-group">
				${TOGGLE_SPEED_OPTIONS.map(
					(option) => `
						<button
							type="button"
							data-pie-tts-control
							class="pie-tool-tts-inline__control pie-tool-tts-inline__control--speed"
							data-demo-tts-speed-rate="${option.rate}"
							aria-label="${option.ariaLabel}"
							aria-pressed="false"
						><span class="pie-tool-tts-inline__speed-label" aria-hidden="true">${option.label}</span></button>
					`,
				).join("")}
			</div>
			<button type="button" data-pie-tts-control class="pie-tool-tts-inline__control" aria-label="Rewind">
				<svg viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true" focusable="false">
					<path d="M20 18V6l-8.5 6L20 18zM10.5 18V6L2 12l8.5 6z"></path>
				</svg>
			</button>
			<button type="button" data-pie-tts-control class="pie-tool-tts-inline__control" aria-label="Fast-forward">
				<svg viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true" focusable="false">
					<path d="M4 18l8.5-6L4 6v12zm9.5 0L22 12l-8.5-6v12z"></path>
				</svg>
			</button>
			<button type="button" data-pie-tts-control class="pie-tool-tts-inline__control" aria-label="Stop reading">
				<svg viewBox="0 0 24 24" class="pie-tool-tts-inline__icon" aria-hidden="true" focusable="false">
					<path d="M6 6h12v12H6z"></path>
				</svg>
			</button>
		</div>
		<button
			type="button"
			class="pie-tool-tts-inline__trigger pie-tool-tts-inline__trigger--md"
			aria-label="Play reading"
			aria-expanded="false"
		>
			${playIcon}
		</button>
	`;

	const style = document.createElement("style");
	style.textContent = `
		.pie-tool-tts-inline {
			position: relative;
			display: inline-flex;
			align-items: center;
		}
		.pie-tool-tts-inline__trigger {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			border: 1px solid var(--pie-button-border-color, var(--pie-button-border, var(--pie-border, #c6c6c6)));
			background-color: var(--pie-button-background-color, var(--pie-button-bg, var(--pie-background, #fff)));
			color: var(--pie-button-color, var(--pie-text, #333));
			border-radius: 0.25rem;
			cursor: pointer;
			transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
		}
		.pie-tool-tts-inline__trigger:hover:not(:disabled),
		.pie-tool-tts-inline__control:hover:not(:disabled) {
			background-color: var(--pie-button-hover-background-color, var(--pie-button-hover-bg, var(--pie-secondary-background, #f2f4f8)));
			transform: translateY(-1px);
			box-shadow: 0 2px 6px color-mix(in srgb, var(--pie-shadow, #000) 14%, transparent);
		}
		.pie-tool-tts-inline__trigger:active:not(:disabled),
		.pie-tool-tts-inline__control:active:not(:disabled) {
			transform: translateY(0);
			box-shadow: none;
		}
		.pie-tool-tts-inline__trigger:focus-visible,
		.pie-tool-tts-inline__control:focus-visible {
			outline: 2px solid var(--pie-focus-outline, var(--pie-button-focus-outline, var(--pie-primary, #0066cc)));
			outline-offset: 2px;
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--pie-primary, #0066cc) 22%, transparent);
		}
		.pie-tool-tts-inline__trigger--active {
			border-color: var(--pie-tool-trigger-active-border-color, var(--pie-primary, #1565c0));
			background-color: var(
				--pie-tool-trigger-active-background,
				color-mix(in srgb, var(--pie-primary, #1565c0) 10%, var(--pie-background, #fff))
			);
			color: var(--pie-tool-trigger-active-color, var(--pie-button-color, var(--pie-text, #333)));
		}
		.pie-tool-tts-inline__trigger--active:hover:not(:disabled) {
			border-color: var(--pie-tool-trigger-active-border-color, var(--pie-primary, #1565c0));
			background-color: var(
				--pie-tool-trigger-active-background,
				color-mix(in srgb, var(--pie-primary, #1565c0) 10%, var(--pie-background, #fff))
			);
			color: var(--pie-tool-trigger-active-color, var(--pie-button-color, var(--pie-text, #333)));
		}
		.pie-tool-tts-inline__panel {
			display: inline-flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: flex-end;
			gap: 0.25rem;
			box-sizing: border-box;
			min-height: var(--pie-tts-controls-row-height, 2.875rem);
			max-width: min(100vw - 1rem, 32rem);
			padding: 0.25rem 0.5rem;
			background: var(--pie-surface, var(--pie-background, #fff));
			border: 1px solid var(--pie-border, #d0d0d0);
			border-radius: 0.5rem;
		}
		.pie-tool-tts-inline__panel[hidden] {
			display: none;
		}
		.pie-tool-tts-inline__panel--left-aligned-inline {
			position: static;
			margin-right: 0.5rem;
		}
		.pie-tool-tts-inline__control {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			border: 1px solid var(--pie-button-border-color, var(--pie-button-border, var(--pie-border, #c6c6c6)));
			border-radius: 0.25rem;
			background: var(--pie-button-background-color, var(--pie-button-bg, var(--pie-background, #fff)));
			color: var(--pie-button-color, var(--pie-text, #222));
			cursor: pointer;
			transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
		}
		.pie-tool-tts-inline__speed-group {
			display: inline-flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.25rem;
		}
		.pie-tool-tts-inline__control--speed {
			width: auto;
			min-width: 2.75rem;
			height: 2rem;
			padding: 0 0.625rem;
			font-size: 0.75rem;
			font-weight: 500;
			letter-spacing: 0;
			white-space: nowrap;
		}
		.pie-tool-tts-inline__control--speed-active {
			border-color: var(--pie-primary, #1565c0);
			background: color-mix(in srgb, var(--pie-primary, #1565c0) 14%, var(--pie-background, #fff));
			color: var(--pie-primary, #1565c0);
			font-weight: 600;
		}
		.pie-tool-tts-inline__speed-label {
			line-height: 1.2;
		}
		.pie-tool-tts-inline__trigger:disabled,
		.pie-tool-tts-inline__control:disabled {
			cursor: not-allowed;
			opacity: 0.6;
		}
		.pie-tool-tts-inline__trigger--md {
			width: 2rem;
			height: 2rem;
		}
		.pie-tool-tts-inline__trigger--md .pie-tool-tts-inline__icon,
		.pie-tool-tts-inline__icon {
			width: 1.25rem;
			height: 1.25rem;
			fill: currentColor;
			color: currentColor;
		}
		@media (prefers-reduced-motion: reduce) {
			.pie-tool-tts-inline__trigger,
			.pie-tool-tts-inline__control {
				transition: none !important;
			}
		}
	`;
	root.appendChild(style);

	root
		.querySelector<HTMLButtonElement>(".pie-tool-tts-inline__trigger")
		?.addEventListener("click", () => {
			if (speaking && !paused) {
				pauseReading();
				return;
			}
			if (paused) {
				resumeReading();
				return;
			}
			void startReading();
		});

	root
		.querySelector<HTMLButtonElement>('[aria-label="Rewind"]')
		?.addEventListener("click", () => {
			void toolbarContext.ttsService?.seekBackward?.();
		});

	root
		.querySelector<HTMLButtonElement>('[aria-label="Fast-forward"]')
		?.addEventListener("click", () => {
			void toolbarContext.ttsService?.seekForward?.();
		});

	root
		.querySelector<HTMLButtonElement>('[aria-label="Stop reading"]')
		?.addEventListener("click", stopReading);

	for (const button of root.querySelectorAll<HTMLButtonElement>(
		"[data-demo-tts-speed-rate]",
	)) {
		button.addEventListener("click", () => {
			const rate = Number(button.dataset.demoTtsSpeedRate);
			const nextRate = playbackRate === rate ? 1 : rate;
			void applyRate(nextRate);
		});
	}

	return root;
};

export function createToggleSpeedTtsToolRegistry(): ToolRegistry {
	const toolRegistry = createSectionDemoToolRegistry();
	const baseRegistration = toolRegistry.get("textToSpeech");
	if (!baseRegistration) {
		throw new Error("Packaged textToSpeech tool registration is unavailable");
	}

	const toggleSpeedRegistration: ToolRegistration = {
		...baseRegistration,
		description:
			"Demo-local TTS controls that preserve old speed-toggle behavior",
		renderToolbar(
			context: ToolContext,
			toolbarContext: ToolbarContext,
		): ToolToolbarRenderResult | null {
			if (!baseRegistration.isVisibleInContext(context)) return null;
			return {
				toolId: this.toolId,
				button: null,
				elements: [
					{
						element: createToggleSpeedElement(toolbarContext),
						mount: "before-buttons",
						layoutHints: {
							controlsRow: {
								reserveSpace: false,
								showWhenToolActive: false,
							},
						},
					},
				],
			};
		},
	};
	toolRegistry.override(toggleSpeedRegistration);
	return toolRegistry;
}
