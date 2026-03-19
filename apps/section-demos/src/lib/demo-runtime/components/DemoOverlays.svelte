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
				config: {
					backend: "demo-custom-provider",
					transportMode: "custom",
					apiEndpoint,
					defaultVoice: typeof state?.voice === "string" ? state.voice : undefined,
					providerOptions: {
						source: "section-demos",
						...state
					}
				},
				message: "Applied Demo Custom provider settings."
			})
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
