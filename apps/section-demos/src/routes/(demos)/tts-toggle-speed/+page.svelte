<script lang="ts">
	import { browser } from "$app/environment";
	import { afterNavigate, replaceState } from "$app/navigation";
	import {
		createDefaultPersonalNeedsProfile,
		createToolsConfig,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks,
	} from "@pie-players/pie-assessment-toolkit";
	import "@pie-players/pie-section-player/components/section-player-splitpane-element";
	import "@pie-players/pie-section-player/components/section-player-vertical-element";
	import "@pie-players/pie-tool-theme";
	import DemoRuntimeChrome from "$lib/demo-runtime/components/DemoRuntimeChrome.svelte";
	import { createToggleSpeedTtsToolRegistry } from "$lib/demo-runtime/custom-tools/tts-toggle-speed";
	import {
		applyDaisyTheme,
		applyToolkitScheme,
		ATTEMPT_QUERY_PARAM,
		ATTEMPT_STORAGE_KEY,
		createAttemptId,
		DAISY_THEME_STORAGE_KEY,
		DEFAULT_DAISY_THEME,
		DEMO_ASSESSMENT_ID,
		getOrCreateAttemptId,
		getUrlEnumParam,
		LAYOUT_OPTIONS,
		MODE_OPTIONS,
		PLAYER_OPTIONS,
	} from "$lib/demo-runtime/demo-page-helpers";
	import { SECTION_DEMOS_DEFAULT_TTS_TOOL_PROVIDER } from "$lib/demo-runtime/section-demos-default-tts";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const toolRegistry = createToggleSpeedTtsToolRegistry();

	const toolsConfigResult = createToolsConfig({
		source: "section-demos.tts-toggle-speed",
		strictness: "error",
		toolRegistry,
		tools: {
			providers: {
				textToSpeech: SECTION_DEMOS_DEFAULT_TTS_TOOL_PROVIDER,
			},
			placement: {
				section: ["theme"],
				item: ["textToSpeech"],
				passage: ["textToSpeech"],
			},
		},
	});
	const toolkitToolsConfig = toolsConfigResult.config;
	if (toolsConfigResult.diagnostics.length > 0) {
		console.warn(
			"[tts-toggle-speed demo] tools config diagnostics:",
			toolsConfigResult.diagnostics,
		);
	}

	const coordinator = new ToolkitCoordinator({
		assessmentId: DEMO_ASSESSMENT_ID,
		toolRegistry,
		toolConfigStrictness: "error",
		tools: toolkitToolsConfig,
	});
	coordinator.setHooks({
		onFrameworkError: (model) => {
			console.error("[TtsToggleSpeedDemo] Toolkit framework error:", model);
		},
	} satisfies ToolkitCoordinatorHooks);

	let selectedPlayerType = $state(getUrlEnumParam("player", PLAYER_OPTIONS, "iife"));
	let roleType = $state<"candidate" | "scorer">(
		getUrlEnumParam("mode", MODE_OPTIONS, "candidate"),
	);
	let layoutType = $state<"splitpane" | "vertical">(
		getUrlEnumParam("layout", LAYOUT_OPTIONS, "splitpane"),
	);
	let selectedDaisyTheme = $state<string>(DEFAULT_DAISY_THEME);
	let attemptId = $state(getOrCreateAttemptId());
	let routerReady = $state(false);
	afterNavigate(() => {
		routerReady = true;
	});

	let showSessionPanel = $state(false);
	let showEventPanel = $state(false);
	let showInstrumentationPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
	let showTtsPanel = $state(false);
	let showSessionDbPanel = $state(false);
	let sessionDebuggerElement: any = $state(null);
	let eventDebuggerElement: any = $state(null);
	let instrumentationDebuggerElement: any = $state(null);
	let pnpDebuggerElement: any = $state(null);

	const DEMO_PERSISTENCE_STORAGE_PREFIX = `pie:section-controller:v1:${DEMO_ASSESSMENT_ID}:`;
	const sectionPlayerConfig = {
		loaderConfig: {
			trackPageActions: false,
		},
	};

	const resolvedSectionForPlayer = $derived.by(() => {
		const section = data.section as any;
		if (!section) return section;
		const hasExplicitPnp = Boolean(
			section?.personalNeedsProfile || section?.settings?.personalNeedsProfile,
		);
		if (hasExplicitPnp) return section;
		return {
			...section,
			personalNeedsProfile: createDefaultPersonalNeedsProfile(),
		};
	});
	const sessionPanelSectionId = $derived(
		String(
			(resolvedSectionForPlayer as any)?.identifier ||
				`section-${String((data?.demo as any)?.id || "default")}`,
		),
	);
	const sourcePanelJson = $derived(JSON.stringify(resolvedSectionForPlayer, null, 2));
	const pieEnv = $derived<{
		mode: "gather" | "view" | "evaluate";
		role: "student" | "instructor";
	}>({
		mode: roleType === "candidate" ? "gather" : "evaluate",
		role: roleType === "candidate" ? "student" : "instructor",
	});

	function handleDaisyThemeSelection(theme: string) {
		if (!browser) return;
		applyDaisyTheme(theme, (nextTheme) => {
			selectedDaisyTheme = nextTheme;
		});
		applyToolkitScheme("default");
	}

	async function resetSessions() {
		try {
			await coordinator.disposeSectionController?.({
				sectionId: sessionPanelSectionId,
				attemptId,
				clearPersistence: true,
				persistBeforeDispose: false,
			});
		} catch (error) {
			console.warn(
				"[TtsToggleSpeedDemo] Failed to clear section-controller persistence during reset:",
				error,
			);
		}
		if (!browser) return;
		const keysToRemove: string[] = [];
		for (let index = 0; index < window.localStorage.length; index += 1) {
			const key = window.localStorage.key(index);
			if (key?.startsWith(DEMO_PERSISTENCE_STORAGE_PREFIX)) {
				keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) window.localStorage.removeItem(key);
		window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
		const nextAttemptId = createAttemptId();
		window.localStorage.setItem(ATTEMPT_STORAGE_KEY, nextAttemptId);
		attemptId = nextAttemptId;
		window.location.reload();
	}

	$effect(() => {
		if (!browser || !routerReady || !attemptId) return;
		const url = new URL(window.location.href);
		const existingAttemptId = url.searchParams.get(ATTEMPT_QUERY_PARAM);
		const existingLayout = url.searchParams.get("layout");
		if (existingAttemptId === attemptId && existingLayout === layoutType) return;
		url.searchParams.set(ATTEMPT_QUERY_PARAM, attemptId);
		url.searchParams.set("layout", layoutType);
		replaceState(url, {});
	});

	$effect(() => {
		if (!browser) return;
		const storedDaisyTheme =
			window.localStorage.getItem(DAISY_THEME_STORAGE_KEY) || DEFAULT_DAISY_THEME;
		applyDaisyTheme(storedDaisyTheme, (nextTheme) => {
			selectedDaisyTheme = nextTheme;
		});
	});

	$effect(() => {
		if (!sessionDebuggerElement) return;
		sessionDebuggerElement.toolkitCoordinator = coordinator;
		sessionDebuggerElement.sectionId = sessionPanelSectionId;
		sessionDebuggerElement.attemptId = attemptId;
	});

	$effect(() => {
		if (!pnpDebuggerElement) return;
		pnpDebuggerElement.sectionData = resolvedSectionForPlayer;
		pnpDebuggerElement.roleType = roleType;
		pnpDebuggerElement.toolkitCoordinator = coordinator;
	});
</script>

<svelte:head>
	<title>{data.demo?.name || "Demo"} - TTS Toggle Speed Customization</title>
</svelte:head>

<DemoRuntimeChrome
	{data}
	{roleType}
	{layoutType}
	{selectedPlayerType}
	{attemptId}
	{selectedDaisyTheme}
	sectionId={sessionPanelSectionId}
	{sourcePanelJson}
	toolkitCoordinator={coordinator}
	onReset={() => void resetSessions()}
	onSetSplitpaneLayout={() => (layoutType = "splitpane")}
	onSetVerticalLayout={() => (layoutType = "vertical")}
	onSelectDaisyTheme={handleDaisyThemeSelection}
	bind:showSessionPanel
	bind:showEventPanel
	bind:showInstrumentationPanel
	bind:showSourcePanel
	bind:showPnpPanel
	bind:showTtsPanel
	bind:showSessionDbPanel
	bind:sessionDebuggerElement
	bind:eventDebuggerElement
	bind:instrumentationDebuggerElement
	bind:pnpDebuggerElement
>
	{#if layoutType === "vertical"}
		<pie-section-player-vertical
			assessment-id={DEMO_ASSESSMENT_ID}
			section-id={sessionPanelSectionId}
			attempt-id={attemptId}
			runtime={ {
				playerType: selectedPlayerType,
				lazyInit: true,
				tools: toolkitToolsConfig,
				player: sectionPlayerConfig,
				env: pieEnv,
				coordinator
			} }
			section={resolvedSectionForPlayer}
			toolbar-position="right"
			show-toolbar={true}
			{toolRegistry}
		></pie-section-player-vertical>
	{:else}
		<pie-section-player-splitpane
			assessment-id={DEMO_ASSESSMENT_ID}
			section-id={sessionPanelSectionId}
			attempt-id={attemptId}
			runtime={ {
				playerType: selectedPlayerType,
				lazyInit: true,
				tools: toolkitToolsConfig,
				player: sectionPlayerConfig,
				env: pieEnv,
				coordinator
			} }
			section={resolvedSectionForPlayer}
			toolbar-position="right"
			show-toolbar={true}
			{toolRegistry}
		></pie-section-player-splitpane>
	{/if}
</DemoRuntimeChrome>

<style>
	:global(pie-section-player-splitpane),
	:global(pie-section-player-vertical) {
		display: flex;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: var(--pie-background-dark, #ecedf1);
	}
</style>
