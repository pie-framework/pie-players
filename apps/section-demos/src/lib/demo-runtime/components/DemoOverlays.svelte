<script lang="ts">
	import { onMount } from "svelte";
	import SourcePanel from './SourcePanel.svelte';
	import SessionDbPanel from './SessionDbPanel.svelte';

	interface Props {
		toolkitCoordinator: any;
		sectionId: string;
		attemptId: string;
		showSessionPanel: boolean;
		showEventPanel: boolean;
		showInstrumentationPanel: boolean;
		showSourcePanel: boolean;
		showPnpPanel: boolean;
		showTtsPanel: boolean;
		showSessionDbPanel: boolean;
		sourcePanelJson: string;
		isSessionHydrateDbDemo: boolean;
		onCloseSourcePanel: () => void;
		onCloseTtsPanel: () => void;
		onCloseSessionDbPanel: () => void;
		onResetDb: () => void | Promise<void>;
		panelPersistenceScope?: string;
		eventPanelPersistenceId?: string;
		instrumentationPanelPersistenceId?: string;
		eventPanelMaxEvents?: number;
		eventPanelMaxEventsByLevel?: Partial<Record<"item" | "section", number>>;
		instrumentationPanelMaxRecords?: number;
		instrumentationPanelMaxRecordsByKind?: Partial<
			Record<"event" | "error" | "metric" | "user-context" | "global-attributes", number>
		>;
		sessionDebuggerElement?: any;
		eventDebuggerElement?: any;
		instrumentationDebuggerElement?: any;
		pnpDebuggerElement?: any;
	}

	let {
		toolkitCoordinator,
		sectionId,
		attemptId,
		showSessionPanel,
		showEventPanel,
		showInstrumentationPanel,
		showSourcePanel,
		showPnpPanel,
		showTtsPanel,
		showSessionDbPanel,
		sourcePanelJson,
		isSessionHydrateDbDemo,
		onCloseSourcePanel,
		onCloseTtsPanel,
		onCloseSessionDbPanel,
		onResetDb,
		panelPersistenceScope = "",
		eventPanelPersistenceId = "controller-events",
		instrumentationPanelPersistenceId = "instrumentation-events",
		eventPanelMaxEvents = 200,
		eventPanelMaxEventsByLevel = {},
		instrumentationPanelMaxRecords = 250,
		instrumentationPanelMaxRecordsByKind = {},
		sessionDebuggerElement = $bindable(null),
		eventDebuggerElement = $bindable(null),
		instrumentationDebuggerElement = $bindable(null),
		pnpDebuggerElement = $bindable(null)
	}: Props = $props();

	function buildDemoCustomProviderConfig(args: {
		apiEndpoint: string;
		state: Record<string, unknown>;
	}) {
		const { apiEndpoint, state } = args;
		const baseEndpoint = String(apiEndpoint || "").trim() || "/api/tts";
		const normalizedBaseEndpoint = baseEndpoint.replace(/\/+$/, "").replace(/\/synthesize\/?$/i, "");
		const customEndpoint = normalizedBaseEndpoint.endsWith("/sc")
			? normalizedBaseEndpoint
			: `${normalizedBaseEndpoint}/sc`;
		return {
			backend: "server",
			serverProvider: "custom",
			transportMode: "custom",
			endpointMode: "rootPost",
			endpointValidationMode: "none",
			apiEndpoint: customEndpoint,
			lang_id: "en-US",
			speedRate: "medium",
			cache: true,
			includeAuthOnAssetFetch: false,
			providerOptions: {
				source: "section-demos",
				...state
			}
		};
	}

type PreviewMark = { time: number; start: number; end: number; value?: string };
const CUSTOM_TTS_DEBUG_PREFIX = "[pie-tts-custom-provider]";

function debugCustomProvider(event: string, payload?: Record<string, unknown>): void {
	if (typeof console === "undefined") return;
	if (payload) {
		console.debug(`${CUSTOM_TTS_DEBUG_PREFIX} ${event}`, payload);
		return;
	}
	console.debug(`${CUSTOM_TTS_DEBUG_PREFIX} ${event}`);
}

	function parseWordMarksJsonl(input: string): PreviewMark[] {
		const lines = input.split(/\r?\n/);
		const marks: PreviewMark[] = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const parsed = JSON.parse(trimmed) as Record<string, unknown>;
				if (parsed.type && parsed.type !== "word") continue;
				const time = Number(parsed.time);
				const start = Number(parsed.start);
				const end = Number(parsed.end);
				const value = typeof parsed.value === "string" ? parsed.value : undefined;
				if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(end)) {
					continue;
				}
				marks.push({ time, start, end, value });
			} catch {
				// Ignore malformed rows and keep parsing.
			}
		}
	const ordered = marks.sort((left, right) => {
			if (left.time !== right.time) return left.time - right.time;
			if (left.start !== right.start) return left.start - right.start;
			return left.end - right.end;
		});
	debugCustomProvider("marks:parsed", {
		lines: lines.length,
		parsed: ordered.length,
		first: ordered[0],
		last: ordered[ordered.length - 1]
	});
	return ordered;
	}

	function normalizeInlineSpeechMarks(input: unknown): PreviewMark[] {
		if (!Array.isArray(input)) return [];
		const marks: PreviewMark[] = [];
		for (const entry of input) {
			if (!entry || typeof entry !== "object") continue;
			const record = entry as Record<string, unknown>;
			const time = Number(record.time);
			const start = Number(record.start);
			const end = Number(record.end);
			if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(end)) continue;
			const value = typeof record.value === "string" ? record.value : undefined;
			marks.push({ time, start, end, value });
		}
		return marks.sort((left, right) => {
			if (left.time !== right.time) return left.time - right.time;
			if (left.start !== right.start) return left.start - right.start;
			return left.end - right.end;
		});
	}

	const demoCustomTtsProviders = [
		{
			id: "demo-custom-provider",
			label: "Demo Custom",
			description: "Example custom provider tab wired through adapter mode.",
			mode: "adapter",
			initialState: {
				voice: "demo-voice-a"
			},
			checkAvailability: () => ({
				available: true,
				message: "Demo custom provider available."
			}),
			buildApplyConfig: ({ apiEndpoint, state }: { apiEndpoint: string; state: Record<string, unknown> }) => ({
				config: buildDemoCustomProviderConfig({ apiEndpoint, state }),
				message: "Applied Demo Custom provider settings."
			}),
			preview: async ({ apiEndpoint, state, previewText }: { apiEndpoint: string; state: Record<string, unknown>; previewText?: string }) => {
				const config = buildDemoCustomProviderConfig({ apiEndpoint, state }) as Record<string, unknown>;
				const endpoint = String(config.apiEndpoint || "/api/tts/sc");
				const text = String(previewText || "").trim() || "This is a demo custom provider preview.";
				debugCustomProvider("preview:request", {
					endpoint,
					textLength: text.length,
					text
				});
				const response = await fetch(endpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						text,
						speedRate: config.speedRate || "medium",
						lang_id: config.lang_id || "en-US",
						cache: config.cache ?? true
					})
				});
				let payload: Record<string, unknown> = {};
				try {
					payload = (await response.json()) as Record<string, unknown>;
				} catch {
					// handled below
				}
				if (!response.ok) {
					throw new Error(
						String(payload?.message || payload?.error || `Preview request failed (${response.status})`)
					);
				}
				const audioUrl = payload.audioContent;
				const wordMarksUrl = payload.word;
				if (typeof audioUrl !== "string" || typeof wordMarksUrl !== "string") {
					throw new Error("Preview response did not include required SC audio and word URLs.");
				}
				const inlineSpeechMarks = normalizeInlineSpeechMarks(payload.speechMarks);
				let speechMarks = inlineSpeechMarks;
				if (speechMarks.length === 0) {
					const marksResponse = await fetch(wordMarksUrl);
					const marksText = await marksResponse.text();
					speechMarks = parseWordMarksJsonl(marksText);
				}
				debugCustomProvider("preview:response", {
					audioUrl,
					wordMarksUrl,
					inlineMarksCount: inlineSpeechMarks.length,
					marksCount: speechMarks.length,
					firstMark: speechMarks[0]
				});
				return {
					audioUrl,
					speechMarks,
					trackingText: text
				};
			}
		}
	];

	const legacyTtsStorageKey = "pie:section-demos:tts-settings";

	function getScopedTtsStorageKey(): string {
		return `pie:debug-panels:v1:${panelPersistenceScope}:tts-settings`;
	}

	onMount(() => {
		if (typeof window === "undefined") return;
		const scopedKey = getScopedTtsStorageKey();
		if (scopedKey === legacyTtsStorageKey) return;
		const scopedValue = window.localStorage.getItem(scopedKey);
		if (scopedValue !== null) return;
		const legacyValue = window.localStorage.getItem(legacyTtsStorageKey);
		if (legacyValue === null) return;
		window.localStorage.setItem(scopedKey, legacyValue);
	});
</script>

{#if showSessionPanel}
	<pie-section-player-tools-session-debugger
		bind:this={sessionDebuggerElement}
		toolkitCoordinator={toolkitCoordinator}
		sectionId={sectionId}
		attemptId={attemptId}
	>
	</pie-section-player-tools-session-debugger>
{/if}

{#if showEventPanel}
	<pie-section-player-tools-event-debugger
		bind:this={eventDebuggerElement}
		toolkitCoordinator={toolkitCoordinator}
		sectionId={sectionId}
		attemptId={attemptId}
		maxEvents={eventPanelMaxEvents}
		maxEventsByLevel={eventPanelMaxEventsByLevel}
		persistenceScope={panelPersistenceScope}
		persistencePanelId={eventPanelPersistenceId}
	>
	</pie-section-player-tools-event-debugger>
{/if}

{#if showInstrumentationPanel}
	<pie-section-player-tools-instrumentation-debugger
		bind:this={instrumentationDebuggerElement}
		maxRecords={instrumentationPanelMaxRecords}
		maxRecordsByKind={instrumentationPanelMaxRecordsByKind}
		persistenceScope={panelPersistenceScope}
		persistencePanelId={instrumentationPanelPersistenceId}
	>
	</pie-section-player-tools-instrumentation-debugger>
{/if}

{#if showSourcePanel}
	<SourcePanel editedSourceJson={sourcePanelJson} onClose={onCloseSourcePanel} />
{/if}

{#if showPnpPanel}
	<pie-section-player-tools-pnp-debugger bind:this={pnpDebuggerElement}>
	</pie-section-player-tools-pnp-debugger>
{/if}

{#if showTtsPanel}
	<pie-section-player-tools-tts-settings
		toolkitCoordinator={toolkitCoordinator}
		storageKey={getScopedTtsStorageKey()}
		customProviders={demoCustomTtsProviders}
		onclose={onCloseTtsPanel}
	>
	</pie-section-player-tools-tts-settings>
{/if}

{#if isSessionHydrateDbDemo && showSessionDbPanel}
	<SessionDbPanel
		assessmentId="section-demos-assessment"
		{sectionId}
		{attemptId}
		{onResetDb}
		onClose={onCloseSessionDbPanel}
	/>
{/if}
