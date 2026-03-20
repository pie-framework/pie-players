<svelte:options
	customElement={{
		tag: "pie-item-player-session-debugger",
		shadow: "none",
		props: {
			itemName: { type: "String", attribute: "item-name" },
			itemId: { type: "String", attribute: "item-id" },
			config: { type: "Object", attribute: "config" },
			session: { type: "Object", attribute: "session" },
			env: { type: "Object", attribute: "env" },
			score: { type: "Object", attribute: "score" },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-theme/components.css";
	import {
		findOrAddSession,
		findPieController,
		makeUniqueTags,
	} from "@pie-players/pie-players-shared";
	import type { ConfigEntity, Env, PieModel } from "@pie-players/pie-players-shared";
	import { createEventDispatcher, onMount } from "svelte";

	type ItemConfigLike = {
		elements?: Record<string, string>;
		models?: PieModel[];
		markup?: string;
	};

	type ItemSessionContainerLike = {
		id?: string;
		data?: unknown[];
	};

	type ItemSessionSnapshot = {
		itemId: string | null;
		updatedAt: number | null;
		session: unknown;
		env: unknown;
		score: unknown;
	};

	type FloatingPanelState = {
		x: number;
		y: number;
		width: number;
		height: number;
	};

	const dispatch = createEventDispatcher<{ close: undefined }>();

	let {
		itemName = "",
		itemId = "",
		config = null,
		session = null,
		env = null,
		score = null,
	}: {
		itemName?: string;
		itemId?: string;
		config?: unknown;
		session?: unknown;
		env?: unknown;
		score?: unknown;
	} = $props();

	let isMinimized = $state(false);
	let windowX = $state(24);
	let windowY = $state(100);
	let windowWidth = $state(360);
	let windowHeight = $state(620);
	let activeTab = $state<"current" | "model">("current");
	let filteredModelSnapshot = $state<unknown>(null);
	let snapshot = $state<ItemSessionSnapshot>({
		itemId: null,
		updatedAt: null,
		session: null,
		env: null,
		score: null,
	});

	function cloneValue<T>(value: T): T {
		try {
			return structuredClone(value);
		} catch {
			try {
				return JSON.parse(JSON.stringify(value)) as T;
			} catch {
				return value;
			}
		}
	}

	function asItemConfig(value: unknown): ItemConfigLike | null {
		if (!value || typeof value !== "object") {
			return null;
		}
		return value as ItemConfigLike;
	}

	async function buildFilteredModels(
		nextConfig: unknown,
		nextSession: unknown,
		nextEnv: unknown,
	): Promise<unknown> {
		const rawConfig = asItemConfig(nextConfig);
		if (
			!rawConfig?.elements ||
			!Array.isArray(rawConfig.models) ||
			typeof rawConfig.markup !== "string"
		) {
			return null;
		}
		const normalizedConfig: ConfigEntity = {
			...cloneValue(rawConfig),
			elements: rawConfig.elements,
			models: rawConfig.models,
			markup: rawConfig.markup,
		};

		const transformed = makeUniqueTags({
			config: normalizedConfig,
		});
		const transformedConfig = transformed.config;
		const sessionContainer =
			nextSession && typeof nextSession === "object"
				? cloneValue(nextSession as ItemSessionContainerLike)
				: { id: "", data: [] };
		const sessionData = Array.isArray(sessionContainer.data) ? sessionContainer.data : [];
		const currentEnv =
			nextEnv && typeof nextEnv === "object"
				? cloneValue(nextEnv as Env)
				: ({ mode: "gather", role: "student" } satisfies Env);

		const filteredModels = await Promise.all(
			transformedConfig.models.map(async (model) => {
				const baseModel = cloneValue(model);
				const entrySession = cloneValue(
					findOrAddSession(
						sessionData as any[],
						String(baseModel.id || ""),
						typeof baseModel.element === "string" ? baseModel.element : undefined,
					),
				);
				const controller =
					typeof baseModel.element === "string"
						? findPieController(baseModel.element)
						: undefined;

				if (!controller?.model) {
					return baseModel;
				}

				try {
					const controllerResult = await (controller as any).model(
						baseModel,
						entrySession,
						currentEnv,
						(_id: string, _elementName: string, properties: Record<string, unknown>) => {
							Object.assign(entrySession, properties);
							return Promise.resolve();
						},
					);
					return {
						id: baseModel.id,
						element: baseModel.element,
						...(controllerResult || {}),
					};
				} catch {
					return baseModel;
				}
			}),
		);

		return filteredModels.length === 1 ? filteredModels[0] : filteredModels;
	}

	function computePanelSizeFromViewport(
		viewport: { width: number; height: number },
		sizing: {
			widthRatio: number;
			heightRatio: number;
			minWidth: number;
			maxWidth: number;
			minHeight: number;
			maxHeight: number;
			alignX: "left" | "center" | "right";
			alignY: "top" | "center" | "bottom";
			paddingX?: number;
			paddingY?: number;
		},
	): FloatingPanelState {
		const clamp = (value: number, min: number, max: number) =>
			Math.max(min, Math.min(value, max));
		const width = clamp(
			Math.round(viewport.width * sizing.widthRatio),
			sizing.minWidth,
			sizing.maxWidth,
		);
		const height = clamp(
			Math.round(viewport.height * sizing.heightRatio),
			sizing.minHeight,
			sizing.maxHeight,
		);
		const paddingX = sizing.paddingX ?? 16;
		const paddingY = sizing.paddingY ?? 16;
		const maxX = Math.max(paddingX, viewport.width - width - paddingX);
		const maxY = Math.max(paddingY, viewport.height - height - paddingY);
		const x =
			sizing.alignX === "left"
				? paddingX
				: sizing.alignX === "right"
					? maxX
					: Math.max(paddingX, Math.round((viewport.width - width) / 2));
		const y =
			sizing.alignY === "top"
				? paddingY
				: sizing.alignY === "bottom"
					? maxY
					: Math.max(paddingY, Math.round((viewport.height - height) / 2));
		return { x, y, width, height };
	}

	function createFloatingPanelPointerController(args: {
		getState: () => FloatingPanelState;
		setState: (next: FloatingPanelState) => void;
		minWidth: number;
		minHeight: number;
		padding?: number;
	}) {
		const padding = args.padding ?? 0;
		let isDragging = false;
		let isResizing = false;
		let dragStartX = 0;
		let dragStartY = 0;
		let dragStartPanelX = 0;
		let dragStartPanelY = 0;
		let resizeStartX = 0;
		let resizeStartY = 0;
		let resizeStartWidth = 0;
		let resizeStartHeight = 0;

		const onDrag = (event: MouseEvent) => {
			if (!isDragging) return;
			const state = args.getState();
			const deltaX = event.clientX - dragStartX;
			const deltaY = event.clientY - dragStartY;
			const maxX = Math.max(padding, window.innerWidth - state.width - padding);
			const maxY = Math.max(padding, window.innerHeight - 100 - padding);
			args.setState({
				...state,
				x: Math.max(padding, Math.min(dragStartPanelX + deltaX, maxX)),
				y: Math.max(padding, Math.min(dragStartPanelY + deltaY, maxY)),
			});
		};

		const onResize = (event: MouseEvent) => {
			if (!isResizing) return;
			const state = args.getState();
			const deltaX = event.clientX - resizeStartX;
			const deltaY = event.clientY - resizeStartY;
			const maxWidth = Math.max(args.minWidth, window.innerWidth - state.x - padding);
			const maxHeight = Math.max(args.minHeight, window.innerHeight - state.y - padding);
			args.setState({
				...state,
				width: Math.max(args.minWidth, Math.min(resizeStartWidth + deltaX, maxWidth)),
				height: Math.max(args.minHeight, Math.min(resizeStartHeight + deltaY, maxHeight)),
			});
		};

		const stopDrag = () => {
			isDragging = false;
			document.removeEventListener("mousemove", onDrag);
			document.removeEventListener("mouseup", stopDrag);
		};

		const stopResize = () => {
			isResizing = false;
			document.removeEventListener("mousemove", onResize);
			document.removeEventListener("mouseup", stopResize);
		};

		return {
			startDrag(event: MouseEvent) {
				isDragging = true;
				dragStartX = event.clientX;
				dragStartY = event.clientY;
				const state = args.getState();
				dragStartPanelX = state.x;
				dragStartPanelY = state.y;
				document.addEventListener("mousemove", onDrag);
				document.addEventListener("mouseup", stopDrag);
			},
			startResize(event: MouseEvent) {
				isResizing = true;
				resizeStartX = event.clientX;
				resizeStartY = event.clientY;
				const state = args.getState();
				resizeStartWidth = state.width;
				resizeStartHeight = state.height;
				document.addEventListener("mousemove", onResize);
				document.addEventListener("mouseup", stopResize);
				event.preventDefault();
				event.stopPropagation();
			},
			stop() {
				stopDrag();
				stopResize();
			},
		};
	}

	const pointerController = createFloatingPanelPointerController({
		getState: () => ({
			x: windowX,
			y: windowY,
			width: windowWidth,
			height: windowHeight,
		}),
		setState: (next: FloatingPanelState) => {
			windowX = next.x;
			windowY = next.y;
			windowWidth = next.width;
			windowHeight = next.height;
		},
		minWidth: 320,
		minHeight: 240,
	});

	$effect(() => {
		snapshot = {
			itemId: itemId || null,
			updatedAt: Date.now(),
			session: cloneValue(session),
			env: cloneValue(env),
			score: cloneValue(score),
		};
	});

	$effect(() => {
		const nextConfig = config;
		const nextSession = session;
		const nextEnv = env;
		let cancelled = false;
		void (async () => {
			const nextFilteredModel = await buildFilteredModels(
				nextConfig,
				nextSession,
				nextEnv,
			);
			if (!cancelled) {
				filteredModelSnapshot = nextFilteredModel;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	onMount(() => {
		const initial = computePanelSizeFromViewport(
			{ width: window.innerWidth, height: window.innerHeight },
			{
				widthRatio: 0.3,
				heightRatio: 0.72,
				minWidth: 320,
				maxWidth: 640,
				minHeight: 360,
				maxHeight: 860,
				alignX: "right",
				alignY: "center",
				paddingX: 16,
				paddingY: 16,
			},
		);
		windowX = initial.x;
		windowY = initial.y;
		windowWidth = initial.width;
		windowHeight = initial.height;
	});

	$effect(() => {
		return () => {
			pointerController.stop();
		};
	});

	const hasSessionEntries = $derived.by(() => {
		const currentSession =
			snapshot.session && typeof snapshot.session === "object"
				? (snapshot.session as ItemSessionContainerLike)
				: null;
		return Array.isArray(currentSession?.data) && currentSession.data.length > 0;
	});
</script>

<div
	class="pie-item-player-session-debugger"
	style="left: {windowX}px; top: {windowY}px; width: {windowWidth}px; {isMinimized ? 'height: auto;' : `height: ${windowHeight}px;`}"
>
	<div
		class="pie-item-player-session-debugger__header"
		onmousedown={(event: MouseEvent) => pointerController.startDrag(event)}
		role="button"
		tabindex="0"
		aria-label="Drag item session panel"
	>
		<div class="pie-item-player-session-debugger__header-title">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="pie-item-player-session-debugger__icon-sm"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
			<h3 class="pie-item-player-session-debugger__title">Session Data</h3>
		</div>
		<div class="pie-item-player-session-debugger__header-actions">
			<button
				class="pie-item-player-session-debugger__window-button"
				onclick={() => (isMinimized = !isMinimized)}
				title={isMinimized ? "Maximize" : "Minimize"}
				aria-label={isMinimized ? "Maximize panel" : "Minimize panel"}
			>
				{#if isMinimized}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="pie-item-player-session-debugger__window-icon"
						width="12"
						height="12"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="pie-item-player-session-debugger__window-icon"
						width="12"
						height="12"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</button>
			<button
				class="pie-item-player-session-debugger__window-button"
				onclick={() => dispatch("close")}
				title="Close"
				aria-label="Close panel"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="pie-item-player-session-debugger__window-icon"
					width="12"
					height="12"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	{#if !isMinimized}
		<div
			class="pie-item-player-session-debugger__content-shell"
			style="height: {windowHeight - 50}px;"
		>
			<div class="pie-item-player-session-debugger__content">
				<div class="pie-item-player-session-debugger__tabs" role="tablist" aria-label="Debugger tabs">
					<button
						class="pie-item-player-session-debugger__tab"
						class:pie-item-player-session-debugger__tab--active={activeTab === "current"}
						role="tab"
						aria-selected={activeTab === "current"}
						onclick={() => (activeTab = "current")}
					>
						Session
					</button>
					<button
						class="pie-item-player-session-debugger__tab"
						class:pie-item-player-session-debugger__tab--active={activeTab === "model"}
						role="tab"
						aria-selected={activeTab === "model"}
						onclick={() => (activeTab = "model")}
					>
						Filtered Model
					</button>
				</div>

				{#if activeTab === "current"}
					{#if !hasSessionEntries}
						<div class="pie-item-player-session-debugger__alert">
							No item session data yet. Interact with the item to see updates here.
						</div>
					{/if}

					<div class="pie-item-player-session-debugger__card">
						<div class="pie-item-player-session-debugger__card-title">Session Data</div>
						<div
							class="pie-item-player-session-debugger__card-region"
							role="textbox"
							aria-readonly="true"
							tabindex="0"
							aria-label="Session data JSON"
						>
							<pre class="pie-item-player-session-debugger__card-pre">{JSON.stringify(snapshot.session, null, 2)}</pre>
						</div>
					</div>

					<div class="pie-item-player-session-debugger__card">
						<div class="pie-item-player-session-debugger__card-title">Environment</div>
						<div
							class="pie-item-player-session-debugger__card-region"
							role="textbox"
							aria-readonly="true"
							tabindex="0"
							aria-label="Environment JSON"
						>
							<pre class="pie-item-player-session-debugger__card-pre">{JSON.stringify(snapshot.env, null, 2)}</pre>
						</div>
					</div>
				{:else}
					<div class="pie-item-player-session-debugger__card">
						<div class="pie-item-player-session-debugger__card-title">Filtered Model</div>
						<div
							class="pie-item-player-session-debugger__card-region"
							role="textbox"
							aria-readonly="true"
							tabindex="0"
							aria-label="Filtered model JSON"
						>
							<pre class="pie-item-player-session-debugger__card-pre">{JSON.stringify(filteredModelSnapshot, null, 2)}</pre>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if !isMinimized}
		<div
			class="pie-item-player-session-debugger__resize-handle"
			onmousedown={(event: MouseEvent) => pointerController.startResize(event)}
			role="button"
			tabindex="0"
			title="Resize window"
		>
			<svg
				class="pie-item-player-session-debugger__resize-icon"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M16 16V14H14V16H16Z" />
				<path d="M16 11V9H14V11H16Z" />
				<path d="M13 16V14H11V16H13Z" />
			</svg>
		</div>
	{/if}
</div>

<style>
	.pie-item-player-session-debugger {
		position: fixed;
		z-index: 9999;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #1f2937);
		border: 2px solid var(--color-base-300, #d1d5db);
		border-radius: 8px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		font-family: var(--pie-font-family, Inter, system-ui, sans-serif);
	}

	.pie-item-player-session-debugger__header {
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-base-200, #f3f4f6);
		cursor: move;
		user-select: none;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-item-player-session-debugger__header-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pie-item-player-session-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-item-player-session-debugger__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.pie-item-player-session-debugger__header-actions {
		display: flex;
		gap: 4px;
	}

	.pie-item-player-session-debugger__window-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.35rem;
		height: 1.35rem;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.7);
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.65);
		color: #334155;
		cursor: pointer;
	}

	.pie-item-player-session-debugger__window-button:hover {
		background: rgba(241, 245, 249, 0.95);
	}

	.pie-item-player-session-debugger__window-button:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}

	.pie-item-player-session-debugger__window-icon {
		display: block;
	}

	.pie-item-player-session-debugger__content-shell {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.pie-item-player-session-debugger__content {
		display: grid;
		gap: 0.9rem;
		height: 100%;
		padding: 0.95rem;
		overflow: auto;
	}

	.pie-item-player-session-debugger__tabs {
		display: flex;
		gap: 0.5rem;
	}

	.pie-item-player-session-debugger__tab {
		padding: 0.45rem 0.8rem;
		border-radius: 9999px;
		border: 1px solid var(--color-base-300, #d1d5db);
		background: var(--color-base-200, #f3f4f6);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
	}

	.pie-item-player-session-debugger__tab--active {
		background: var(--color-base-content, #1f2937);
		border-color: var(--color-base-content, #1f2937);
		color: var(--color-base-100, #fff);
	}

	.pie-item-player-session-debugger__alert {
		padding: 0.75rem 0.9rem;
		border-radius: 0.65rem;
		border: 1px solid color-mix(in srgb, var(--color-info) 30%, var(--color-base-300));
		background: color-mix(in srgb, var(--color-info) 10%, var(--color-base-100));
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.pie-item-player-session-debugger__card {
		display: grid;
		gap: 0.45rem;
		padding: 0.8rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-base-300, #d1d5db);
		background: color-mix(in srgb, var(--color-base-100) 88%, var(--color-base-200));
		min-height: 0;
	}

	.pie-item-player-session-debugger__card-title {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		opacity: 0.75;
	}

	.pie-item-player-session-debugger__card-pre {
		margin: 0;
		padding: 0.75rem;
		border-radius: 0.55rem;
		background: color-mix(in srgb, var(--color-base-300) 55%, var(--color-base-100));
		font-size: 0.72rem;
		line-height: 1.45;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.pie-item-player-session-debugger__card-region:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
		border-radius: 0.55rem;
	}

	.pie-item-player-session-debugger__resize-handle {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 1rem;
		height: 1rem;
		cursor: se-resize;
	}

	.pie-item-player-session-debugger__resize-icon {
		width: 100%;
		height: 100%;
		color: color-mix(in srgb, var(--color-base-content) 30%, transparent);
	}
</style>
