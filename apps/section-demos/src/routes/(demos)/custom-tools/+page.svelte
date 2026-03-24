<script lang="ts">
	import { browser } from "$app/environment";
	import {
		createDefaultPersonalNeedsProfile,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks,
	} from "@pie-players/pie-assessment-toolkit";
	import "@pie-players/pie-section-player/components/section-player-splitpane-element";
	import "@pie-players/pie-section-player/components/section-player-vertical-element";
	import "@pie-players/pie-tool-calculator-desmos";
	import "@pie-players/pie-tool-text-to-speech";
	import "@pie-players/pie-tool-theme";
	import DemoRuntimeChrome from "$lib/demo-runtime/components/DemoRuntimeChrome.svelte";
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
	import { createDemoCustomToolsIntegration } from "$lib/demo-runtime/custom-tools";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const customTools = createDemoCustomToolsIntegration();

	const toolkitToolsConfig = {
		providers: {
			tts: SECTION_DEMOS_DEFAULT_TTS_TOOL_PROVIDER,
			calculator: {
				authFetcher: fetchDesmosAuthConfig,
			},
		},
		placement: {
			section: ["sectionMetaInfo", "theme"],
			item: ["wordCounter", "calculator"],
			passage: ["wordCounter", "textToSpeech"],
		},
	};
	const sectionToolbarTools = "sectionMetaInfo,theme";
	const coordinator = new ToolkitCoordinator({
		assessmentId: DEMO_ASSESSMENT_ID,
		tools: toolkitToolsConfig,
	});

	let selectedPlayerType = $state(getUrlEnumParam("player", PLAYER_OPTIONS, "iife"));
	let roleType = $state<"candidate" | "scorer">(
		getUrlEnumParam("mode", MODE_OPTIONS, "candidate"),
	);
	let layoutType = $state<"splitpane" | "vertical">(
		getUrlEnumParam("layout", LAYOUT_OPTIONS, "splitpane"),
	);
	let selectedDaisyTheme = $state<string>(DEFAULT_DAISY_THEME);
	let attemptId = $state(getOrCreateAttemptId());
	let playerHostElement: HTMLElement | null = $state(null);

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

	coordinator.setHooks({
		onError: (error, context) => {
			console.error("[CustomToolsDemo] Toolkit hook error:", context, error);
		},
	} satisfies ToolkitCoordinatorHooks);

	function handleDaisyThemeSelection(theme: string) {
		if (!browser) return;
		applyDaisyTheme(theme, (nextTheme) => {
			selectedDaisyTheme = nextTheme;
		});
		applyToolkitScheme("default");
	}

	$effect(() => {
		if (!browser || !attemptId) return;
		const url = new URL(window.location.href);
		const existingAttemptId = url.searchParams.get(ATTEMPT_QUERY_PARAM);
		const existingLayout = url.searchParams.get("layout");
		if (existingAttemptId === attemptId && existingLayout === layoutType) return;
		url.searchParams.set(ATTEMPT_QUERY_PARAM, attemptId);
		url.searchParams.set("layout", layoutType);
		window.history.replaceState({}, "", url.toString());
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

	async function fetchDesmosAuthConfig() {
		const response = await fetch("/api/tools/desmos/auth");
		if (!response.ok) {
			throw new Error(`Desmos auth request failed (${response.status})`);
		}
		const payload = await response.json();
		return payload?.apiKey ? { apiKey: payload.apiKey } : {};
	}

	async function resetSessions() {
		try {
			await coordinator?.disposeSectionController?.({
				sectionId: sessionPanelSectionId,
				attemptId,
				clearPersistence: true,
				persistBeforeDispose: false,
			});
		} catch (error) {
			console.warn(
				"[CustomToolsDemo] Failed to clear section-controller persistence during reset:",
				error,
			);
		}
		if (browser) {
			const keysToRemove: string[] = [];
			for (let index = 0; index < window.localStorage.length; index += 1) {
				const key = window.localStorage.key(index);
				if (!key) continue;
				if (key.startsWith(DEMO_PERSISTENCE_STORAGE_PREFIX)) {
					keysToRemove.push(key);
				}
			}
			for (const key of keysToRemove) {
				window.localStorage.removeItem(key);
			}
			window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
			const nextAttemptId = createAttemptId();
			window.localStorage.setItem(ATTEMPT_STORAGE_KEY, nextAttemptId);
			attemptId = nextAttemptId;
			window.location.reload();
		}
	}
</script>

<svelte:head>
	<title>{data.demo?.name || "Demo"} - Custom Tools</title>
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
			bind:this={playerHostElement}
			assessment-id={DEMO_ASSESSMENT_ID}
			section-id={sessionPanelSectionId}
			attempt-id={attemptId}
			player-type={selectedPlayerType}
			lazy-init={true}
			tools={toolkitToolsConfig}
			player={sectionPlayerConfig}
			section={resolvedSectionForPlayer}
			env={pieEnv}
			coordinator={coordinator}
			toolbar-position="right"
			show-toolbar={true}
			enabled-tools={sectionToolbarTools}
			toolRegistry={customTools.toolRegistry}
			sectionHostButtons={customTools.sectionHostButtons}
			itemHostButtons={customTools.itemHostButtons}
			passageHostButtons={customTools.passageHostButtons}
		></pie-section-player-vertical>
	{:else}
		<pie-section-player-splitpane
			bind:this={playerHostElement}
			assessment-id={DEMO_ASSESSMENT_ID}
			section-id={sessionPanelSectionId}
			attempt-id={attemptId}
			player-type={selectedPlayerType}
			lazy-init={true}
			tools={toolkitToolsConfig}
			player={sectionPlayerConfig}
			section={resolvedSectionForPlayer}
			env={pieEnv}
			coordinator={coordinator}
			toolbar-position="right"
			show-toolbar={true}
			enabled-tools={sectionToolbarTools}
			toolRegistry={customTools.toolRegistry}
			sectionHostButtons={customTools.sectionHostButtons}
			itemHostButtons={customTools.itemHostButtons}
			passageHostButtons={customTools.passageHostButtons}
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
