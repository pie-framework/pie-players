<script lang="ts">
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
	import "@pie-players/pie-assessment-player/components/assessment-player-default-element";
	import "@pie-players/pie-section-player-tools-event-debugger";
	import "@pie-players/pie-section-player-tools-session-debugger";
	import SessionDbPanel from "@pie-players/pie-section-player-tools-shared/SessionDbPanel.svelte";
	import AssessmentDemoMenuBar from "$lib/demo-runtime/components/AssessmentDemoMenuBar.svelte";
	import "@pie-players/pie-tool-text-to-speech";
	import {
		ASSESSMENT_PLAYER_PUBLIC_EVENTS,
		type AssessmentPlayerHooks,
		type AssessmentPlayerRuntimeHostContract,
		type AssessmentRouteChangedDetail,
	} from "@pie-players/pie-assessment-player";
	import {
		deleteSnapshotFromSessionDb,
		loadSessionDemoActivity,
		loadSnapshotFromSessionDb,
		saveSnapshotToSessionDb,
		type AssessmentSessionSnapshot,
	} from "$lib/demo-runtime/session-demo-db-client";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const ATTEMPT_STORAGE_KEY = "pie:assessment-demos:attempt-id";
	const ATTEMPT_QUERY_PARAM = "attemptId";
	const SECTION_LAYOUT_QUERY_PARAM = "sectionLayout";
	const DB_SUPPRESSION_WINDOW_MS = 1200;
	const DEMO_ASSESSMENT_ID = "assessment-session-db-demo-001";
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
				console.warn("[Assessment Session DB Demo] toolkit error:", context, error);
			},
		// In assessment demos, assessment-session persistence is the single source of truth.
		// Disable section controller default localStorage persistence to avoid competing stores.
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

	let attemptId = $state("");
	let sectionLayout = $state<"splitpane" | "vertical">("splitpane");
	let playerRef = $state<HTMLElement | null>(null);
	let playerInstanceKey = $state(0);
	let snapshot = $state<
		ReturnType<AssessmentPlayerRuntimeHostContract["getSnapshot"]> | null
	>(null);
	let activeSectionId = $state("");
	let showSessionPanel = $state(false);
	let showEventPanel = $state(false);
	let showDbPanel = $state(false);
	let sessionDebuggerElement = $state<any>(null);
	let eventDebuggerElement = $state<any>(null);
	let dbHydrateEnabled = $state(false);
	let dbErrorMessage = $state<string | null>(null);
	let dbBootstrapAt = $state<number | null>(null);
	let serverLoadedAssessment = $state<Record<string, unknown> | null>(null);
	let bootstrappedAttemptId = $state<string | null>(null);
	let lastPersistedSnapshotFingerprint = $state<string | null>(null);
	let isPersistingSession = $state(false);
	let suppressDbAutoPersist = $state(false);
	let suppressDbAutoPersistUntilMs = $state(0);
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

	function buildSnapshotFingerprint(payload: unknown): string {
		try {
			return JSON.stringify(payload || {});
		} catch {
			return String(Date.now());
		}
	}

	function isDbAutoPersistSuppressed(): boolean {
		return suppressDbAutoPersist || Date.now() < suppressDbAutoPersistUntilMs;
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
				"[Assessment Session DB Demo] Polly TTS unavailable, falling back to browser TTS:",
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

	async function bootstrapSessionDemoDb(reset = true) {
		const assessmentId = String(
			(data.demo.assessment?.identifier as string) || "assessment-session-db-demo-001",
		);
		const response = await loadSessionDemoActivity({
			assessmentId,
			attemptId,
			reset,
		});
		serverLoadedAssessment =
			(response.assessment as Record<string, unknown> | null) || data.demo.assessment;
		dbBootstrapAt = Date.now();
	}

	async function loadSnapshotFromDb() {
		const assessmentId = String(
			(data.demo.assessment?.identifier as string) || "assessment-session-db-demo-001",
		);
		return await loadSnapshotFromSessionDb({
			assessmentId,
			attemptId,
		});
	}

	async function saveSnapshotToDb(session: AssessmentSessionSnapshot | null) {
		const assessmentId = String(
			(data.demo.assessment?.identifier as string) || "assessment-session-db-demo-001",
		);
		await saveSnapshotToSessionDb({
			assessmentId,
			attemptId,
			snapshot: (session || null) as AssessmentSessionSnapshot | null,
		});
	}

	async function deleteSnapshotFromDb() {
		const assessmentId = String(
			(data.demo.assessment?.identifier as string) || "assessment-session-db-demo-001",
		);
		await deleteSnapshotFromSessionDb({
			assessmentId,
			attemptId,
		});
	}

	const hooks: AssessmentPlayerHooks = {
		onError: (error, context) => {
			console.error("[Assessment Demo] hook error:", context, error);
		},
		async createAssessmentSessionPersistence() {
			return {
				async loadSession() {
					if (!dbHydrateEnabled) return null;
					return await loadSnapshotFromDb();
				},
				async saveSession(_context, session) {
					if (!dbHydrateEnabled || isDbAutoPersistSuppressed()) return;
					await saveSnapshotToDb(
						(session as AssessmentSessionSnapshot | null | undefined) || null,
					);
				},
				async clearSession() {
					await deleteSnapshotFromDb();
				},
			};
		},
	};

	async function resetServerDb() {
		dbErrorMessage = null;
		suppressDbAutoPersist = true;
		suppressDbAutoPersistUntilMs = Date.now() + DB_SUPPRESSION_WINDOW_MS;
		try {
			bootstrappedAttemptId = null;
			await deleteSnapshotFromDb();
			await bootstrapSessionDemoDb(true);
			lastPersistedSnapshotFingerprint = null;
			playerInstanceKey += 1;
			activeSectionId = "";
			refreshSnapshot();
			sessionDebuggerElement?.refreshFromHost?.();
		} catch (error) {
			dbErrorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			setTimeout(() => {
				suppressDbAutoPersist = false;
			}, DB_SUPPRESSION_WINDOW_MS + 100);
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
		void attemptId;
		if (!attemptId) return;
		dbHydrateEnabled = true;
		dbErrorMessage = null;
		let cancelled = false;
		const shouldResetOnBootstrap = bootstrappedAttemptId !== attemptId;
		void bootstrapSessionDemoDb(shouldResetOnBootstrap)
			.then(() => {
				if (cancelled) return;
				bootstrappedAttemptId = attemptId;
			})
			.catch((error) => {
				if (cancelled) return;
				dbErrorMessage = error instanceof Error ? error.message : String(error);
			});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!playerRef) return;
		(playerRef as any).assessmentId = data.demo.assessment.identifier;
		(playerRef as any).attemptId = attemptId;
		(playerRef as any).assessment =
			serverLoadedAssessment || data.demo.assessment;
		(playerRef as any).sectionPlayerLayout = sectionLayout;
		(playerRef as any).showNavigation = true;
		(playerRef as any).hooks = hooks;
		(playerRef as any).coordinator = coordinator;
		void (playerRef as any).bootstrapController?.();
		const onRouteChanged = () => refreshSnapshot();
		const onSessionChanged = () => {
			refreshSnapshot();
			queueMicrotask(async () => {
				if (isDbAutoPersistSuppressed() || isPersistingSession) return;
				const host = playerRef as unknown as AssessmentPlayerRuntimeHostContract | null;
				const controller =
					(await host?.waitForAssessmentController?.(3000)) ||
					host?.getAssessmentController?.();
				if (!controller?.persist || !controller?.getSession) return;
				const nextFingerprint = buildSnapshotFingerprint(controller.getSession());
				if (nextFingerprint === lastPersistedSnapshotFingerprint) return;
				lastPersistedSnapshotFingerprint = nextFingerprint;
				isPersistingSession = true;
				try {
					await controller.persist();
				} finally {
					isPersistingSession = false;
				}
			});
		};
		playerRef.addEventListener(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
			onRouteChanged as EventListener,
		);
		playerRef.addEventListener(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionChanged,
			onSessionChanged as EventListener,
		);
		refreshSnapshot();
		return () => {
			playerRef?.removeEventListener(
				ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
				onRouteChanged as EventListener,
			);
			playerRef?.removeEventListener(
				ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionChanged,
				onSessionChanged as EventListener,
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
	<title>{data.demo.name} - Assessment Session DB Demo</title>
</svelte:head>

<main class="demo-page">
	<AssessmentDemoMenuBar
		{sectionLayout}
		{showSessionPanel}
		{showEventPanel}
		{showDbPanel}
		onSetSplitpaneLayout={() => {
			sectionLayout = "splitpane";
			syncUrl();
		}}
		onSetVerticalLayout={() => {
			sectionLayout = "vertical";
			syncUrl();
		}}
		onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
		onToggleEventPanel={() => (showEventPanel = !showEventPanel)}
		onToggleDbPanel={() => (showDbPanel = !showDbPanel)}
	/>

	<section class="demo-status">
		<p><strong>Attempt:</strong> <code>{attemptId}</code></p>
		<p><strong>Active Section:</strong> <code>{activeSectionId || "n/a"}</code></p>
		<p><strong>Hydrate:</strong> {dbHydrateEnabled ? "enabled" : "disabled"}</p>
		<p><strong>TTS backend:</strong> {ttsBackend}</p>
		<p>
			<strong>DB bootstrap:</strong>
			{dbBootstrapAt ? new Date(dbBootstrapAt).toLocaleTimeString() : "not yet"}
		</p>
		{#if dbErrorMessage}
			<p class="error"><strong>DB error:</strong> {dbErrorMessage}</p>
		{/if}
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
		{#key `${attemptId}:${playerInstanceKey}:${sectionLayout}`}
			<pie-assessment-player-default
				bind:this={playerRef}
				assessment-id={data.demo.assessment.identifier}
				attempt-id={attemptId}
				section-player-layout={sectionLayout}
				show-navigation="true"
				onassessment-route-changed={handleRouteChange}
			></pie-assessment-player-default>
		{/key}
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

	{#if showDbPanel}
		<SessionDbPanel
			mode="section"
			assessmentId={DEMO_ASSESSMENT_ID}
			sectionId={activeSectionId}
			attemptId={attemptId}
			onResetDb={() => void resetServerDb()}
			onClose={() => (showDbPanel = false)}
		/>
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

	.demo-status .error {
		color: #b91c1c;
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
