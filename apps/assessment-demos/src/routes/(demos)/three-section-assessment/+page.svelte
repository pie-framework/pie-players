<script lang="ts">
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
import {
	CompositeInstrumentationProvider,
	DebugPanelInstrumentationProvider,
	NewRelicInstrumentationProvider,
} from "@pie-players/pie-players-shared";
	import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
	import "@pie-players/pie-assessment-player/components/assessment-player-default-element";
	import "@pie-players/pie-section-player-tools-event-debugger";
import "@pie-players/pie-section-player-tools-instrumentation-debugger";
	import "@pie-players/pie-section-player-tools-session-debugger";
	import "@pie-players/pie-tool-text-to-speech";
	import AssessmentDemoMenuBar from "$lib/demo-runtime/components/AssessmentDemoMenuBar.svelte";
	import {
		ASSESSMENT_PLAYER_PUBLIC_EVENTS,
		type AssessmentRouteChangedDetail,
		type AssessmentPlayerRuntimeHostContract,
	} from "@pie-players/pie-assessment-player";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const ATTEMPT_STORAGE_KEY = "pie:assessment-demos:attempt-id";
	const ATTEMPT_QUERY_PARAM = "attemptId";
	const SECTION_LAYOUT_QUERY_PARAM = "sectionLayout";
	const DEMO_ASSESSMENT_ID = "assessment-demo-001";
	const toolkitToolsConfig = {
		providers: {
			tts: {
				enabled: true,
				backend: "polly",
				serverProvider: "polly",
				apiEndpoint: "/api/tts",
				transportMode: "pie",
				endpointMode: "synthesizePath",
				endpointValidationMode: "voices",
				defaultVoice: "Joanna",
				language: "en-US",
				rate: 1,
				engine: "neural",
				sampleRate: 24000,
				format: "mp3",
				speechMarksMode: "word",
			},
		},
		placement: {
			item: ["textToSpeech"],
			passage: ["textToSpeech"],
		},
	} as any;

	const coordinator = new ToolkitCoordinator({
		assessmentId: DEMO_ASSESSMENT_ID,
		tools: toolkitToolsConfig,
		hooks: {
			onError: (error, context) => {
				console.warn("[Assessment Demo] toolkit error:", context, error);
			},
		// Assessment session persistence should own state in assessment demos.
		async createSectionSessionPersistence() {
			return {
				async loadSession() {
					return null;
				},
				async saveSession() {},
				async clearSession() {},
			};
		},
		},
	});
const sectionInstrumentationProvider = new CompositeInstrumentationProvider([
	new NewRelicInstrumentationProvider(),
	new DebugPanelInstrumentationProvider(),
]);
void sectionInstrumentationProvider
	.initialize()
	.then(() => {
		sectionInstrumentationProvider.trackMetric("demo.instrumentation.bootstrap", 1, {
			app: "assessment-demos",
			demo: "three-section-assessment",
			category: "demo",
		});
	})
	.catch(() => {});
const sectionPlayerRuntimeConfig = {
	player: {
		loaderConfig: {
			trackPageActions: true,
			instrumentationProvider: sectionInstrumentationProvider,
		},
	},
};

	let attemptId = $state("");
	let sectionLayout = $state<"splitpane" | "vertical">("splitpane");
	let playerRef = $state<HTMLElement | null>(null);
	let snapshot = $state<ReturnType<AssessmentPlayerRuntimeHostContract["getSnapshot"]> | null>(null);
	let activeSectionId = $state("");
	let showSessionPanel = $state(false);
	let showEventPanel = $state(false);
let showInstrumentationPanel = $state(false);
	let sessionDebuggerElement = $state<any>(null);
	let eventDebuggerElement = $state<any>(null);
let instrumentationDebuggerElement = $state<any>(null);
	let ttsBackend = $state<"polly" | "browser">("polly");

	function getInitialSectionId(): string {
		const testParts = (data.demo.assessment as any)?.testParts;
		if (!Array.isArray(testParts) || !testParts.length) return "";
		const firstPart = testParts[0];
		const sections = Array.isArray(firstPart?.sections) ? firstPart.sections : [];
		const firstSection = sections[0];
		return String(firstSection?.identifier || "");
	}

	function createAttemptId() {
		return `assessment-attempt-${Date.now().toString(36)}`;
	}

	function getOrCreateAttemptId() {
		if (!browser) return "assessment-attempt-server";
		const existing = window.localStorage.getItem(ATTEMPT_STORAGE_KEY);
		if (existing) return existing;
		const created = createAttemptId();
		window.localStorage.setItem(ATTEMPT_STORAGE_KEY, created);
		return created;
	}

	function resetAttempt() {
		if (!browser) return;
		const nextAttempt = createAttemptId();
		window.localStorage.setItem(ATTEMPT_STORAGE_KEY, nextAttempt);
		attemptId = nextAttempt;
		activeSectionId = "";
		refreshSnapshot();
		syncUrl();
	}

	function syncUrl() {
		if (!browser) return;
		const url = new URL(window.location.href);
		url.searchParams.set(ATTEMPT_QUERY_PARAM, attemptId);
		url.searchParams.set(SECTION_LAYOUT_QUERY_PARAM, sectionLayout);
		window.history.replaceState({}, "", url.toString());
	}

	function refreshSnapshot() {
		const host = playerRef as unknown as AssessmentPlayerRuntimeHostContract | null;
		const nextSnapshot = host?.getSnapshot?.() ?? null;
		snapshot = nextSnapshot;
		const currentSectionId = String(nextSnapshot?.navigation?.currentSectionId || "");
		if (currentSectionId) {
			activeSectionId = currentSectionId;
		}
	}

	function wireCloseListener(target: any, onClose: () => void) {
		if (!target) return;
		target.addEventListener("close", onClose as EventListener);
		return () => {
			target.removeEventListener("close", onClose as EventListener);
		};
	}

	async function ensureTtsReadyWithFallback() {
		const waitForTtsReady = async (timeoutMs = 3000): Promise<boolean> => {
			const startedAt = Date.now();
			while (Date.now() - startedAt < timeoutMs) {
				if (coordinator.getInitStatus().tts) return true;
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
			return false;
		};

		const probePollyAvailability = async (): Promise<void> => {
			const response = await fetch("/api/tts/voices", { cache: "no-store" });
			if (!response.ok) {
				throw new Error(`Polly voices endpoint failed (${response.status})`);
			}
		};

		try {
			await coordinator.ensureTTSReady(
				coordinator.getToolConfig("tts") as Record<string, unknown>,
			);
			await probePollyAvailability();
			ttsBackend = "polly";
		} catch (error) {
			console.warn(
				"[Assessment Demo] Polly TTS unavailable, falling back to browser TTS:",
				error,
			);
			coordinator.updateToolConfig("tts", {
				backend: "browser",
				provider: undefined,
				serverProvider: undefined,
			});
			const ready = await waitForTtsReady();
			if (!ready) {
				throw new Error("Timed out while reinitializing TTS in browser mode");
			}
			ttsBackend = "browser";
		}
	}

	onMount(() => {
		if (!browser) return;
		attemptId = getOrCreateAttemptId();
		activeSectionId = getInitialSectionId();
		const url = new URL(window.location.href);
		const requestedLayout = url.searchParams.get(SECTION_LAYOUT_QUERY_PARAM);
		if (requestedLayout === "vertical" || requestedLayout === "splitpane") {
			sectionLayout = requestedLayout;
		}
		void ensureTtsReadyWithFallback();
		syncUrl();
	});

	$effect(() => {
		if (!playerRef) return;
		(playerRef as any).assessmentId = data.demo.assessment.identifier;
		(playerRef as any).attemptId = attemptId;
		(playerRef as any).assessment = data.demo.assessment;
		(playerRef as any).sectionPlayerLayout = sectionLayout;
		(playerRef as any).sectionPlayerRuntime = sectionPlayerRuntimeConfig;
		(playerRef as any).showNavigation = true;
		(playerRef as any).coordinator = coordinator;
		void (playerRef as any).bootstrapController?.();
		const onRouteChanged = () => refreshSnapshot();
		playerRef.addEventListener(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
			onRouteChanged as EventListener,
		);
		playerRef.addEventListener(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionChanged,
			onRouteChanged as EventListener,
		);
		refreshSnapshot();
		return () => {
			playerRef?.removeEventListener(
				ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
				onRouteChanged as EventListener,
			);
			playerRef?.removeEventListener(
				ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionChanged,
				onRouteChanged as EventListener,
			);
		};
	});

	$effect(() => {
		if (!sessionDebuggerElement) return;
		return wireCloseListener(sessionDebuggerElement, () => {
			showSessionPanel = false;
		});
	});

	$effect(() => {
		if (!eventDebuggerElement) return;
		return wireCloseListener(eventDebuggerElement, () => {
			showEventPanel = false;
		});
	});

	$effect(() => {
		if (!instrumentationDebuggerElement) return;
		return wireCloseListener(instrumentationDebuggerElement, () => {
			showInstrumentationPanel = false;
		});
	});

	function handleRouteChange(event: Event) {
		const detail = (event as CustomEvent<AssessmentRouteChangedDetail>).detail;
		snapshot = {
			...(snapshot || {
				readiness: { phase: "ready" },
				navigation: {
					currentIndex: 0,
					totalSections: 0,
					canNext: false,
					canPrevious: false,
				},
				progress: { visitedSections: 0, totalSections: 0 },
			}),
			navigation: {
				currentIndex: detail.currentSectionIndex,
				totalSections: detail.totalSections,
				canNext: detail.canNext,
				canPrevious: detail.canPrevious,
				currentSectionId: detail.currentSectionId,
			},
		};
	}
</script>

<svelte:head>
	<title>{data.demo.name} - Assessment Demo</title>
</svelte:head>

<main class="demo-page">
	<AssessmentDemoMenuBar
		{sectionLayout}
		{showSessionPanel}
		{showEventPanel}
		{showInstrumentationPanel}
		onSetSplitpaneLayout={() => {
			sectionLayout = "splitpane";
			syncUrl();
		}}
		onSetVerticalLayout={() => {
			sectionLayout = "vertical";
			syncUrl();
		}}
		onResetAttempt={resetAttempt}
		onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
		onToggleEventPanel={() => (showEventPanel = !showEventPanel)}
		onToggleInstrumentationPanel={() =>
			(showInstrumentationPanel = !showInstrumentationPanel)}
	/>

	<section class="demo-status">
		<p><strong>Attempt:</strong> <code>{attemptId}</code></p>
		<p><strong>Active Section:</strong> <code>{activeSectionId || "n/a"}</code></p>
		<p><strong>TTS backend:</strong> {ttsBackend}</p>
		{#if snapshot}
			<p>
				<strong>Position:</strong>
				{snapshot.navigation.currentIndex + 1} / {snapshot.navigation.totalSections}
			</p>
			<p>
				<strong>Can Prev/Next:</strong>
				{snapshot.navigation.canPrevious ? "yes" : "no"} / {snapshot.navigation.canNext ? "yes" : "no"}
			</p>
			<p>
				<strong>Visited:</strong>
				{snapshot.progress.visitedSections} / {snapshot.progress.totalSections}
			</p>
		{/if}
	</section>

	<section class="demo-player">
		<pie-assessment-player-default
			bind:this={playerRef}
			assessment-id={data.demo.assessment.identifier}
			attempt-id={attemptId}
			section-player-layout={sectionLayout}
			show-navigation="true"
			onassessment-route-changed={handleRouteChange}
		></pie-assessment-player-default>
	</section>

	{#if showSessionPanel}
		<pie-section-player-tools-session-debugger
			bind:this={sessionDebuggerElement}
			toolkitCoordinator={coordinator}
			sectionId={activeSectionId}
			attemptId={attemptId}
		></pie-section-player-tools-session-debugger>
	{/if}

	{#if showEventPanel}
		<pie-section-player-tools-event-debugger
			bind:this={eventDebuggerElement}
			toolkitCoordinator={coordinator}
			sectionId={activeSectionId}
			attemptId={attemptId}
		></pie-section-player-tools-event-debugger>
	{/if}

	{#if showInstrumentationPanel}
		<pie-section-player-tools-instrumentation-debugger
			bind:this={instrumentationDebuggerElement}
		></pie-section-player-tools-instrumentation-debugger>
	{/if}
</main>

<style>
	.demo-page {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		height: 100%;
		min-height: 0;
		box-sizing: border-box;
		gap: 0.75rem;
	}

	.demo-status {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 0.5rem 1rem;
		margin: 0 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.4rem;
		background: #fff;
	}

	.demo-status p {
		margin: 0;
		font-size: 0.9rem;
	}

	.demo-player {
		min-height: 0;
		overflow: hidden;
		border: 1px solid #e5e7eb;
		border-radius: 0.4rem;
		background: #fff;
		padding: 0.5rem;
		margin: 0 1rem 1rem;
		box-sizing: border-box;
	}

	:global(pie-assessment-player-default) {
		display: block;
		height: 100%;
		min-height: 0;
	}
</style>
