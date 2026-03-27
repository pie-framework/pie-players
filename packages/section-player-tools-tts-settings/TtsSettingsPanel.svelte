<svelte:options
	customElement={{
		tag: "pie-section-player-tools-tts-settings",
		shadow: "none",
		props: {
			toolkitCoordinator: { type: "Object", attribute: "toolkit-coordinator" },
			apiEndpoint: { type: "String", attribute: "api-endpoint" },
			storageKey: { type: "String", attribute: "storage-key" },
			adapters: { type: "Object", attribute: "adapters" },
			customProviders: { type: "Object", attribute: "custom-providers" }
		}
	}}
/>

<script lang="ts">
	import "@pie-players/pie-theme/components.css";
	import {
		DEFAULT_TTS_SPEED_OPTIONS,
		formatTTSSpeedOptionsAsText,
		normalizeTTSSpeedOptions,
		parseTTSSpeedOptionsFromText,
		resolveTTSRuntimeSettings,
		type TTSLayoutMode,
	} from "@pie-players/pie-assessment-toolkit";
	import { createEventDispatcher, onDestroy, onMount, untrack } from "svelte";

	type BuiltInBackendTab = "browser" | "polly" | "google";
	type BackendTab = BuiltInBackendTab | string;
	type PreviewMode = "plain" | "ssml";
	type PollyFormat = "mp3" | "ogg" | "pcm";
	type PollySpeechMarksMode = "word" | "word+sentence";

	type DemoVoice = {
		id?: string;
		name?: string;
		languageCode?: string;
		gender?: string;
		quality?: string;
	};

	type AvailabilityState = {
		checked: boolean;
		loading: boolean;
		available: boolean;
		message: string | null;
		detail: string | null;
		voices: DemoVoice[];
	};

	type SynthesizeProbeResponse = {
		audio: string;
		contentType?: string;
		speechMarks?: Array<{ time: number; start: number; end: number }>;
	};
type PreviewSpeechMark = { time: number; start: number; end: number; value?: string };
	type CustomProviderPreviewResult = {
		note?: string;
		audioUrl?: string;
		speechMarks?: PreviewSpeechMark[];
		trackingText?: string;
	};

	type TtsSettingsAdapters = {
		fetchPollyVoices?: (args: {
			endpoint: string;
			language: string;
			gender: string;
			engine: "standard" | "neural";
			url: URL;
		}) => Promise<DemoVoice[]>;
		fetchGoogleVoices?: (args: {
			endpoint: string;
			language: string;
			gender: string;
			voiceType: string;
			url: URL;
		}) => Promise<DemoVoice[]>;
		synthesizeProbe?: (args: {
			endpoint: string;
			provider: "polly" | "google";
			body: Record<string, unknown>;
		}) => Promise<SynthesizeProbeResponse>;
	};

	type ProviderAvailabilityResult = {
		available: boolean;
		message?: string | null;
		detail?: string | null;
	};

	type ProviderApplyResult = {
		config: Record<string, unknown>;
		message?: string;
	};

	type CustomProviderContext = {
		id: string;
		toolkitCoordinator: any;
		apiEndpoint: string;
		state: Record<string, unknown>;
		previewText?: string;
		previewMode?: PreviewMode;
	};

	type CustomProviderAdapter = {
		id: string;
		label: string;
		description?: string;
		mode: "adapter";
		checkAvailability?: (
			context: CustomProviderContext
		) => ProviderAvailabilityResult | Promise<ProviderAvailabilityResult>;
		buildApplyConfig: (
			context: CustomProviderContext
		) => ProviderApplyResult | Promise<ProviderApplyResult>;
		preview?: (context: CustomProviderContext) => Promise<void | CustomProviderPreviewResult>;
		initialState?: Record<string, unknown>;
	};

	type CustomProviderComponent = {
		id: string;
		label: string;
		description?: string;
		mode: "component";
		tagName: string;
		componentProps?: Record<string, unknown>;
		checkAvailability?: (
			context: CustomProviderContext
		) => ProviderAvailabilityResult | Promise<ProviderAvailabilityResult>;
		buildApplyConfig?: (
			context: CustomProviderContext
		) => ProviderApplyResult | Promise<ProviderApplyResult>;
		preview?: (context: CustomProviderContext) => Promise<void | CustomProviderPreviewResult>;
		initialState?: Record<string, unknown>;
	};

	type CustomProviderDescriptor = CustomProviderAdapter | CustomProviderComponent;

	const dispatch = createEventDispatcher<{ close: undefined }>();
	const DEFAULT_API_ENDPOINT = "/api/tts";
	const DEFAULT_STORAGE_KEY = "pie:section-player-tools:tts-settings";
	const TTS_MODAL_Z_INDEX = 200000;

	let {
		toolkitCoordinator = null,
		apiEndpoint = "/api/tts",
		storageKey = DEFAULT_STORAGE_KEY,
		adapters = {},
		customProviders = []
	}: {
		toolkitCoordinator?: any;
		apiEndpoint?: string;
		storageKey?: string;
		adapters?: TtsSettingsAdapters;
		customProviders?: CustomProviderDescriptor[];
	} = $props();

	type PersistedTTSSettings = {
		backend?: string;
		apiEndpoint?: string;
		defaultVoice?: string;
		rate?: number;
		pitch?: number;
		language?: string;
		transportMode?: "pie" | "custom";
		endpointMode?: "synthesizePath" | "rootPost";
		endpointValidationMode?: "voices" | "endpoint" | "none";
		engine?: "standard" | "neural";
		sampleRate?: number;
		format?: PollyFormat;
		speechMarksMode?: PollySpeechMarksMode;
		googleVoiceType?: string;
		googleGender?: string;
		providerOptions?: Record<string, unknown>;
		layoutMode?: TTSLayoutMode;
		/** Inline toolbar speed multipliers; `[]` hides speed buttons. */
		speedOptions?: number[];
		[key: string]: unknown;
	};

	let activeTab = $state<BackendTab>("browser");
	let applyMessage = $state<string | null>(null);
	let applyError = $state<string | null>(null);
	let isApplying = $state(false);
	let isPreviewing = $state(false);
	let previewError = $state<string | null>(null);
	let previewBackend = $state<BackendTab | null>(null);
	let previewMode = $state<PreviewMode>("plain");
	let previewText = $state("");
	let previewNote = $state<string | null>(null);
	let previewTrackIndex = $state<number>(-1);
	let previewTrackLength = $state<number>(0);
	let customProviderStateById = $state<Record<string, Record<string, unknown>>>({});
	let customProviderApplyRequestById = $state<Record<string, ProviderApplyResult | undefined>>({});
	let customProviderAvailabilityById = $state<Record<string, AvailabilityState>>({});

	let browserVoice = $state("");
	let browserRate = $state(1);
	let browserPitch = $state(1);
	let layoutMode = $state<TTSLayoutMode>("left-aligned");
	let speedOptionsText = $state("");

	let pollyApiEndpoint = $state("");
	let pollyLanguage = $state("en-US");
	let pollyGender = $state("");
	let pollyEngine = $state<"standard" | "neural">("neural");
	let pollySampleRate = $state(24000);
	let pollyFormat = $state<PollyFormat>("mp3");
	let pollySpeechMarksMode = $state<PollySpeechMarksMode>("word");
	let pollyVoice = $state("");
	let pollyRate = $state(1);

	let googleApiEndpoint = $state("");
	let googleLanguage = $state("en-US");
	let googleGender = $state("");
	let googleVoiceType = $state("wavenet");
	let googleVoice = $state("");
	let googleRate = $state(1);

	let browserState = $state<AvailabilityState>({
		checked: false,
		loading: false,
		available: false,
		message: null,
		detail: null,
		voices: []
	});
	let pollyState = $state<AvailabilityState>({
		checked: false,
		loading: false,
		available: false,
		message: null,
		detail: null,
		voices: []
	});
	let googleState = $state<AvailabilityState>({
		checked: false,
		loading: false,
		available: false,
		message: null,
		detail: null,
		voices: []
	});
	let currentPreviewAudio: HTMLAudioElement | null = null;
	let previewPollingTimer: number | null = null;
	let previewRunId = 0;
	let activeCustomProviderElement = $state<Element | null>(null);
	let dialogEl = $state<HTMLElement | null>(null);
	let closeButtonEl = $state<HTMLButtonElement | null>(null);
	let cleanupFocusTrap: (() => void) | null = null;

	function createLocalFocusTrap(
		container: HTMLElement,
		options: { initialFocus?: HTMLElement | null; onEscape?: () => void } = {}
	): () => void {
		const focusable = () =>
			Array.from(
				container.querySelectorAll<HTMLElement>(
					"button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
				),
			).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
		const previous = document.activeElement as HTMLElement | null;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				options.onEscape?.();
				return;
			}
			if (event.key !== "Tab") return;
			const nodes = focusable();
			if (!nodes.length) return;
			const current = document.activeElement as HTMLElement | null;
			const currentIndex = nodes.indexOf(current || nodes[0]);
			if (event.shiftKey && currentIndex <= 0) {
				event.preventDefault();
				nodes[nodes.length - 1].focus();
			} else if (!event.shiftKey && currentIndex === nodes.length - 1) {
				event.preventDefault();
				nodes[0].focus();
			}
		};
		container.addEventListener("keydown", onKeyDown);
		queueMicrotask(() => {
			(options.initialFocus || focusable()[0] || container)?.focus?.();
		});
		return () => {
			container.removeEventListener("keydown", onKeyDown);
			previous?.focus?.();
		};
	}

	const DEFAULT_PREVIEW_TEXT: Record<BackendTab, string> = {
		browser:
			"This is a browser voice sample. You should hear clear playback and see tracking updates.",
		polly: "This is an AWS Polly voice sample. You should hear this text and see tracking updates.",
		google:
			"This is a Google Cloud TTS voice sample. You should hear this text and see tracking updates."
	};

	const DEFAULT_PREVIEW_SSML: Record<Exclude<BackendTab, "browser">, string> = {
		polly:
			'<speak>This is an AWS Polly SSML sample. <break time="300ms"/> The voice should honor this markup.</speak>',
		google:
			'<speak>This is a <prosody rate="95%">Google Cloud SSML sample</prosody>. <break time="250ms"/> The preview preserves authored SSML.</speak>'
	};
	const BUILT_IN_TABS: BuiltInBackendTab[] = ["browser", "polly", "google"];
const PREVIEW_DEBUG_PREFIX = "[pie-tts-preview]";
const TTS_LAYOUT_MODES: readonly TTSLayoutMode[] = [
	"reserved-row",
	"expanding-row",
	"floating-overlay",
	"left-aligned",
];

function debugPreview(event: string, payload?: Record<string, unknown>): void {
	if (typeof console === "undefined") return;
	if (payload) {
		console.debug(`${PREVIEW_DEBUG_PREFIX} ${event}`, payload);
		return;
	}
	console.debug(`${PREVIEW_DEBUG_PREFIX} ${event}`);
}

	function normalizeLayoutMode(value: unknown): TTSLayoutMode {
		return TTS_LAYOUT_MODES.includes(value as TTSLayoutMode)
			? (value as TTSLayoutMode)
			: "left-aligned";
	}

	function resetInlineSpeedOptionsToDefaults(): void {
		speedOptionsText = formatTTSSpeedOptionsAsText([...DEFAULT_TTS_SPEED_OPTIONS]);
	}

	const normalizedCustomProviders = $derived.by(() => {
		const reserved = new Set<string>(BUILT_IN_TABS);
		const deduped: CustomProviderDescriptor[] = [];
		const seen = new Set<string>();
		for (const provider of customProviders || []) {
			if (!provider || typeof provider !== "object") continue;
			const id = String(provider.id || "").trim();
			if (!id || reserved.has(id) || seen.has(id)) continue;
			seen.add(id);
			deduped.push(provider);
		}
		return deduped;
	});

	const providerTabs = $derived.by(() => [
		{ id: "browser", label: "Browser" },
		{ id: "polly", label: "Polly" },
		{ id: "google", label: "Google" },
		...normalizedCustomProviders.map((provider) => ({
			id: provider.id,
			label: provider.label
		}))
	]);

	const activeCustomProvider = $derived.by(
		() => normalizedCustomProviders.find((provider) => provider.id === activeTab) || null
	);

	function requestClose(): void {
		dispatch("close");
	}

	function createProviderContext(
		providerId: string,
		overrides: Partial<CustomProviderContext> = {}
	): CustomProviderContext {
		return {
			id: providerId,
			toolkitCoordinator,
			apiEndpoint: getDefaultApiEndpoint(),
			state: customProviderStateById[providerId] || {},
			...overrides
		};
	}

	function isBuiltInTab(tab: BackendTab): tab is BuiltInBackendTab {
		return tab === "browser" || tab === "polly" || tab === "google";
	}

	function buildAvailabilityState(result?: ProviderAvailabilityResult | null): AvailabilityState {
		const available = result?.available === true;
		return {
			checked: true,
			loading: false,
			available,
			message: result?.message || (available ? "Provider available." : "Provider unavailable."),
			detail: result?.detail || null,
			voices: []
		};
	}

	function getCustomProviderOrThrow(providerId: string): CustomProviderDescriptor {
		const provider = normalizedCustomProviders.find((entry) => entry.id === providerId);
		if (!provider) {
			throw new Error(`Custom provider '${providerId}' is not registered.`);
		}
		return provider;
	}

	async function checkCustomProviderAvailability(providerId: string): Promise<void> {
		const provider = getCustomProviderOrThrow(providerId);
		const loading: AvailabilityState = {
			checked: true,
			loading: true,
			available: false,
			message: null,
			detail: null,
			voices: []
		};
		customProviderAvailabilityById = { ...customProviderAvailabilityById, [provider.id]: loading };
		try {
			const result = await provider.checkAvailability?.(createProviderContext(provider.id));
			customProviderAvailabilityById = {
				...customProviderAvailabilityById,
				[provider.id]: buildAvailabilityState(result || { available: true, message: "Provider available." })
			};
		} catch (error) {
			customProviderAvailabilityById = {
				...customProviderAvailabilityById,
				[provider.id]: {
					checked: true,
					loading: false,
					available: false,
					message: "Provider availability check failed.",
					detail: error instanceof Error ? error.message : String(error),
					voices: []
				}
			};
		}
	}

	function updateCustomProviderState(providerId: string, patch: Record<string, unknown>): void {
		const previous = customProviderStateById[providerId] || {};
		customProviderStateById = {
			...customProviderStateById,
			[providerId]: { ...previous, ...patch }
		};
	}

	function onCustomProviderChange(providerId: string, event: CustomEvent): void {
		const payload = (event?.detail || {}) as { state?: Record<string, unknown> };
		if (!payload.state || typeof payload.state !== "object") return;
		updateCustomProviderState(providerId, payload.state);
	}

	function onCustomProviderAvailability(providerId: string, event: CustomEvent): void {
		const payload = (event?.detail || {}) as ProviderAvailabilityResult;
		customProviderAvailabilityById = {
			...customProviderAvailabilityById,
			[providerId]: buildAvailabilityState(payload)
		};
	}

	function resolveComponentProps(provider: CustomProviderComponent): Record<string, unknown> {
		return {
			toolkitCoordinator,
			apiEndpoint: getDefaultApiEndpoint(),
			state: customProviderStateById[provider.id] || {},
			...(provider.componentProps || {})
		};
	}

	async function onCustomProviderApplyRequest(providerId: string, event: CustomEvent): Promise<void> {
		const payload = (event?.detail || {}) as ProviderApplyResult;
		if (!payload || typeof payload !== "object" || !payload.config) return;
		customProviderApplyRequestById = {
			...customProviderApplyRequestById,
			[providerId]: payload
		};
		await applySettings();
	}

	async function onCustomProviderPreviewRequest(providerId: string): Promise<void> {
		if (activeTab !== providerId) {
			setActiveTab(providerId);
		}
		await previewSelectedVoice();
	}

	function normalizeRate(value: number): number {
		const next = Number(value);
		if (!Number.isFinite(next)) return 1;
		return Math.max(0.25, Math.min(4, next));
	}

	function normalizePitch(value: number): number {
		const next = Number(value);
		if (!Number.isFinite(next)) return 1;
		return Math.max(0, Math.min(2, next));
	}

	function normalizePollySampleRate(value: number): number {
		const allowed = [8000, 16000, 22050, 24000];
		const next = Number(value);
		if (!Number.isFinite(next)) return 24000;
		return allowed.includes(next) ? next : 24000;
	}

	function getPollySpeechMarkTypes(): Array<"word" | "sentence"> {
		return pollySpeechMarksMode === "word+sentence" ? ["word", "sentence"] : ["word"];
	}

	function getStorageKey(): string {
		const trimmed = String(storageKey || "").trim();
		return trimmed || DEFAULT_STORAGE_KEY;
	}

	function initializeFromCoordinator() {
		const existing = toolkitCoordinator?.getToolConfig?.("textToSpeech") || {};
		const stored = readStoredSettings();
		const source = stored ? { ...existing, ...stored } : existing;
		const resolvedDefaultApiEndpoint = getDefaultApiEndpoint();
		const backend = source?.backend;
		if (typeof backend === "string" && backend.trim().length > 0) {
			activeTab = backend;
		}

		const defaultVoice = typeof source?.defaultVoice === "string" ? source.defaultVoice : "";
		const defaultRate = normalizeRate(Number(source?.rate ?? 1));
		const defaultPitch = normalizePitch(Number(source?.pitch ?? 1));
		const defaultEndpoint =
			typeof source?.apiEndpoint === "string" && source.apiEndpoint.trim().length > 0
				? source.apiEndpoint
				: resolvedDefaultApiEndpoint;
		const defaultPollyEndpoint =
			backend === "polly" ? defaultEndpoint : resolvedDefaultApiEndpoint;
		const defaultGoogleEndpoint =
			backend === "google" ? defaultEndpoint : resolvedDefaultApiEndpoint;
		const defaultLanguage =
			typeof source?.language === "string" && source.language.trim().length > 0
				? source.language
				: "en-US";
		const defaultEngine =
			source?.engine === "standard"
				? "standard"
				: source?.engine === "neural"
					? "neural"
					: source?.quality === "standard"
						? "standard"
						: "neural";
		const sourceProviderOptions = (source?.providerOptions || {}) as Record<string, unknown>;
		layoutMode = normalizeLayoutMode(source?.layoutMode);
		const runtimeForSpeed = resolveTTSRuntimeSettings(
			source && typeof source === "object" ? (source as Record<string, unknown>) : undefined,
		);
		if (runtimeForSpeed.speedOptions === undefined) {
			speedOptionsText = formatTTSSpeedOptionsAsText([...DEFAULT_TTS_SPEED_OPTIONS]);
		} else if (
			Array.isArray(runtimeForSpeed.speedOptions) &&
			runtimeForSpeed.speedOptions.length === 0
		) {
			speedOptionsText = "";
		} else {
			speedOptionsText = formatTTSSpeedOptionsAsText(
				normalizeTTSSpeedOptions(runtimeForSpeed.speedOptions),
			);
		}
		const defaultSampleRate = normalizePollySampleRate(
			Number(source?.sampleRate ?? sourceProviderOptions.sampleRate ?? 24000)
		);
		const defaultFormat =
			source?.format === "ogg" || source?.format === "pcm" || source?.format === "mp3"
				? source.format
				: sourceProviderOptions.format === "ogg" ||
					  sourceProviderOptions.format === "pcm" ||
					  sourceProviderOptions.format === "mp3"
					? (sourceProviderOptions.format as PollyFormat)
					: "mp3";
		const sourceSpeechMarkTypes = Array.isArray(sourceProviderOptions.speechMarkTypes)
			? sourceProviderOptions.speechMarkTypes
			: [];
		const defaultSpeechMarksMode: PollySpeechMarksMode = sourceSpeechMarkTypes.includes(
			"sentence"
		)
			? "word+sentence"
			: source?.speechMarksMode === "word+sentence"
				? "word+sentence"
				: "word";

		browserVoice = backend === "browser" ? defaultVoice : "";
		browserRate = defaultRate;
		browserPitch = defaultPitch;

		pollyApiEndpoint = defaultPollyEndpoint;
		pollyLanguage = defaultLanguage;
		pollyEngine = defaultEngine;
		pollySampleRate = defaultSampleRate;
		pollyFormat = defaultFormat;
		pollySpeechMarksMode = defaultSpeechMarksMode;
		pollyVoice = backend === "polly" ? defaultVoice : "";
		pollyRate = defaultRate;

		googleApiEndpoint = defaultGoogleEndpoint;
		googleLanguage = defaultLanguage;
		googleGender = typeof source?.googleGender === "string" ? source.googleGender : "";
		googleVoiceType =
			source?.googleVoiceType === "standard" ||
			source?.googleVoiceType === "studio" ||
			source?.googleVoiceType === "wavenet"
				? source.googleVoiceType
				: "wavenet";
		googleVoice = backend === "google" ? defaultVoice : "";
		googleRate = defaultRate;
		if (!isBuiltInTab(activeTab)) {
			const persistedCustomState =
				sourceProviderOptions && typeof sourceProviderOptions === "object"
					? sourceProviderOptions
					: {};
			if (Object.keys(persistedCustomState).length > 0) {
				updateCustomProviderState(activeTab, persistedCustomState);
			}
		}
		setPreviewTextForCurrentTab();
	}

	const layoutModeReservesRow = $derived(layoutMode === "reserved-row");

	function sameRecordEntries<T>(left: Record<string, T>, right: Record<string, T>): boolean {
		const leftKeys = Object.keys(left);
		const rightKeys = Object.keys(right);
		if (leftKeys.length !== rightKeys.length) return false;
		for (const key of leftKeys) {
			if (!(key in right)) return false;
			if (left[key] !== right[key]) return false;
		}
		return true;
	}

	function syncCustomProvidersState(): void {
		const nextState: Record<string, Record<string, unknown>> = {};
		const nextAvailability: Record<string, AvailabilityState> = {};
		for (const provider of normalizedCustomProviders) {
			nextState[provider.id] = customProviderStateById[provider.id] || provider.initialState || {};
			nextAvailability[provider.id] =
				customProviderAvailabilityById[provider.id] || {
					checked: false,
					loading: false,
					available: false,
					message: null,
					detail: null,
					voices: []
				};
		}
		const nextApplyRequests = Object.fromEntries(
			Object.entries(customProviderApplyRequestById).filter(([id]) => Boolean(nextState[id]))
		);
		if (!sameRecordEntries(customProviderStateById, nextState)) {
			customProviderStateById = nextState;
		}
		if (!sameRecordEntries(customProviderAvailabilityById, nextAvailability)) {
			customProviderAvailabilityById = nextAvailability;
		}
		if (!sameRecordEntries(customProviderApplyRequestById, nextApplyRequests)) {
			customProviderApplyRequestById = nextApplyRequests;
		}
		if (!isBuiltInTab(activeTab) && !nextState[activeTab]) {
			activeTab = "browser";
		}
	}

	function readStoredSettings(): PersistedTTSSettings | null {
		if (typeof window === "undefined") return null;
		try {
			const raw = window.localStorage.getItem(getStorageKey());
			if (!raw) return null;
			const parsed = JSON.parse(raw) as PersistedTTSSettings;
			if (!parsed || typeof parsed !== "object") return null;
			return parsed;
		} catch {
			return null;
		}
	}

	function persistSettings(settings: PersistedTTSSettings): void {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(getStorageKey(), JSON.stringify(settings));
		} catch {
			// Ignore persistence errors (e.g., private mode or storage quota).
		}
	}

	async function checkBrowserAvailability() {
		browserState = { ...browserState, checked: true, loading: true, message: null, detail: null };
		try {
			if (typeof window === "undefined" || !("speechSynthesis" in window)) {
				throw new Error("Web Speech API is not available in this browser.");
			}

			const synth = window.speechSynthesis;
			let voices = synth.getVoices();
			if (!voices.length) {
				await new Promise<void>((resolve) => {
					let settled = false;
					const finish = () => {
						if (settled) return;
						settled = true;
						resolve();
					};
					const timeout = window.setTimeout(finish, 1200);
					synth.addEventListener(
						"voiceschanged",
						() => {
							window.clearTimeout(timeout);
							finish();
						},
						{ once: true }
					);
				});
				voices = synth.getVoices();
			}

			const mappedVoices = voices.map((voice) => ({
				id: voice.voiceURI || voice.name,
				name: voice.name,
				languageCode: voice.lang
			}));
			if (browserVoice) {
				const hasVoice = mappedVoices.some((voice) => (voice.name || "") === browserVoice);
				if (!hasVoice) {
					browserVoice = "";
				}
			}

			browserState = {
				checked: true,
				loading: false,
				available: true,
				message: voices.length
					? `Browser TTS available (${voices.length} voices detected).`
					: "Browser TTS is available, but no voices were returned yet.",
				detail: null,
				voices: mappedVoices
			};
		} catch (error) {
			browserState = {
				checked: true,
				loading: false,
				available: false,
				message: "Browser TTS is not available.",
				detail: error instanceof Error ? error.message : String(error),
				voices: []
			};
		}
	}

	async function readJsonSafe(response: Response): Promise<any> {
		try {
			return await response.json();
		} catch {
			return {};
		}
	}

	function buildPollyVoicesUrl() {
		const baseUrl = new URL(
			normalizeApiEndpoint(pollyApiEndpoint, getDefaultApiEndpoint()),
			window.location.origin
		);
		baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/polly/voices`;
		const url = baseUrl;
		if (pollyLanguage) url.searchParams.set("language", pollyLanguage);
		if (pollyGender) url.searchParams.set("gender", pollyGender);
		if (pollyEngine) url.searchParams.set("engine", pollyEngine);
		return url;
	}

	function buildGoogleVoicesUrl() {
		const baseUrl = new URL(
			normalizeApiEndpoint(googleApiEndpoint, getDefaultApiEndpoint()),
			window.location.origin
		);
		baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/google/voices`;
		const url = baseUrl;
		if (googleLanguage) url.searchParams.set("language", googleLanguage);
		if (googleGender) url.searchParams.set("gender", googleGender);
		if (googleVoiceType) url.searchParams.set("voiceType", googleVoiceType);
		return url;
	}

	async function checkPollyAvailability() {
		pollyState = { ...pollyState, checked: true, loading: true, message: null, detail: null };
		try {
			const url = buildPollyVoicesUrl();
			const adapterVoices = await adapters.fetchPollyVoices?.({
				endpoint: normalizeApiEndpoint(pollyApiEndpoint, getDefaultApiEndpoint()),
				language: pollyLanguage,
				gender: pollyGender,
				engine: pollyEngine,
				url
			});
			const voices = Array.isArray(adapterVoices)
				? adapterVoices
				: await (async () => {
						const response = await fetch(url.toString());
						const payload = await readJsonSafe(response);
						if (!response.ok) {
							throw new Error(
								`HTTP ${response.status}: ${payload?.error || payload?.message || "Unknown error"}`
							);
						}
						return Array.isArray(payload?.voices) ? payload.voices : [];
					})();

			if (pollyVoice) {
				const hasVoice = voices.some(
					(voice: DemoVoice) => (voice.id || voice.name || "") === pollyVoice
				);
				if (!hasVoice) {
					pollyVoice = "";
				}
			}
			pollyState = {
				checked: true,
				loading: false,
				available: true,
				message: `AWS Polly available (${voices.length} matching voices, ${pollyEngine} engine).`,
				detail: null,
				voices
			};
		} catch (error) {
			pollyState = {
				checked: true,
				loading: false,
				available: false,
				message: "AWS Polly is not available from the configured API.",
				detail: error instanceof Error ? error.message : String(error),
				voices: []
			};
		}
	}

	async function checkGoogleAvailability() {
		googleState = { ...googleState, checked: true, loading: true, message: null, detail: null };
		try {
			const url = buildGoogleVoicesUrl();
			const adapterVoices = await adapters.fetchGoogleVoices?.({
				endpoint: normalizeApiEndpoint(googleApiEndpoint, getDefaultApiEndpoint()),
				language: googleLanguage,
				gender: googleGender,
				voiceType: googleVoiceType,
				url
			});
			const voices = Array.isArray(adapterVoices)
				? adapterVoices
				: await (async () => {
						const response = await fetch(url.toString());
						const payload = await readJsonSafe(response);
						if (!response.ok) {
							throw new Error(
								`HTTP ${response.status}: ${payload?.error || payload?.message || "Unknown error"}`
							);
						}
						return Array.isArray(payload?.voices) ? payload.voices : [];
					})();

			if (googleVoice) {
				const hasVoice = voices.some(
					(voice: DemoVoice) => (voice.id || voice.name || "") === googleVoice
				);
				if (!hasVoice) {
					googleVoice = "";
				}
			}
			googleState = {
				checked: true,
				loading: false,
				available: true,
				message: `Google Cloud TTS available (${voices.length} matching voices).`,
				detail: null,
				voices
			};
		} catch (error) {
			googleState = {
				checked: true,
				loading: false,
				available: false,
				message: "Google Cloud TTS is not available from the configured API.",
				detail: error instanceof Error ? error.message : String(error),
				voices: []
			};
		}
	}

	async function checkActiveTabAvailability() {
		if (activeTab === "browser") {
			await checkBrowserAvailability();
			return;
		}
		if (activeTab === "polly") {
			await checkPollyAvailability();
			return;
		}
		if (activeTab === "google") {
			await checkGoogleAvailability();
			return;
		}
		await checkCustomProviderAvailability(activeTab);
	}

	function refreshPollyVoices() {
		if (activeTab !== "polly") return;
		void checkPollyAvailability();
	}

	function refreshGoogleVoices() {
		if (activeTab !== "google") return;
		void checkGoogleAvailability();
	}

	function setActiveTab(nextTab: BackendTab) {
		if (activeTab === nextTab) return;
		stopPreview();
		activeTab = nextTab;
		setPreviewTextForCurrentTab();
		void checkActiveTabAvailability();
	}

	function getActiveState(): AvailabilityState {
		if (activeTab === "browser") return browserState;
		if (activeTab === "polly") return pollyState;
		if (activeTab === "google") return googleState;
		return (
			customProviderAvailabilityById[activeTab] || {
				checked: false,
				loading: false,
				available: false,
				message: "Provider availability has not been checked yet.",
				detail: null,
				voices: []
			}
		);
	}

	function canPreviewActiveTab(): boolean {
		if (isBuiltInTab(activeTab)) return true;
		if (!activeCustomProvider) return false;
		return typeof activeCustomProvider.preview === "function";
	}

	function resolveVoiceForBackend(backend: BackendTab): string | undefined {
		if (backend === "browser") {
			return browserVoice || undefined;
		}
		if (backend === "polly") {
			if (!pollyVoice) return undefined;
			const isKnown = pollyState.voices.some(
				(voice) => (voice.id || voice.name || "") === pollyVoice
			);
			return isKnown ? pollyVoice : undefined;
		}
		if (googleVoice) {
			const isKnown = googleState.voices.some(
				(voice) => (voice.id || voice.name || "") === googleVoice
			);
			if (isKnown) return googleVoice;
		}
		const firstMatching = googleState.voices[0];
		return firstMatching ? firstMatching.id || firstMatching.name || undefined : undefined;
	}

	function normalizeApiEndpoint(endpoint: string, fallback = DEFAULT_API_ENDPOINT): string {
		const trimmed = endpoint.trim();
		if (!trimmed) return fallback;
		return trimmed.replace(/\/synthesize\/?$/i, "");
	}

	function getDefaultApiEndpoint(): string {
		return normalizeApiEndpoint(apiEndpoint || DEFAULT_API_ENDPOINT);
	}

	function getSampleText(tab: BackendTab): string {
		if (tab === "browser") return "This is a browser voice sample.";
		if (tab === "polly") return "This is an AWS Polly voice sample.";
		return "This is a Google Cloud TTS voice sample.";
	}

	function clearPreviewTracking() {
		if (previewPollingTimer !== null && typeof window !== "undefined") {
			window.clearInterval(previewPollingTimer);
		}
		previewPollingTimer = null;
		previewTrackIndex = -1;
		previewTrackLength = 0;
	}

	function tokenizePreviewText(text: string): Array<{ start: number; end: number }> {
		const tokens: Array<{ start: number; end: number }> = [];
		const matcher = /\S+/g;
		let match: RegExpExecArray | null;
		while ((match = matcher.exec(text)) !== null) {
			tokens.push({
				start: match.index,
				end: match.index + match[0].length
			});
		}
		return tokens;
	}

	function getTrackingSegments(text: string): Array<{ text: string; active: boolean }> {
		const safeText = typeof text === "string" ? text : "";
		if (!safeText.length) return [{ text: "", active: false }];
		if (previewTrackIndex < 0 || previewTrackLength <= 0) {
			return [{ text: safeText, active: false }];
		}
		const start = Math.max(0, Math.min(previewTrackIndex, safeText.length));
		const end = Math.max(start, Math.min(start + previewTrackLength, safeText.length));
		return [
			{ text: safeText.slice(0, start), active: false },
			{ text: safeText.slice(start, end), active: true },
			{ text: safeText.slice(end), active: false }
		].filter((segment) => segment.text.length > 0);
	}

	function setPreviewTextForCurrentTab() {
		if (!isBuiltInTab(activeTab)) {
			const customLabel = activeCustomProvider?.label || "custom";
			const customSample = `This is a ${customLabel} TTS provider sample.`;
			if (previewMode === "ssml") {
				previewText = `<speak>${customSample}</speak>`;
			} else {
				previewText = customSample;
			}
			return;
		}
		if (previewMode === "ssml") {
			if (activeTab === "browser") {
				previewText = DEFAULT_PREVIEW_TEXT.browser;
				return;
			}
			previewText = DEFAULT_PREVIEW_SSML[activeTab];
			return;
		}
		previewText = DEFAULT_PREVIEW_TEXT[activeTab];
	}

	function onPreviewModeChange(mode: PreviewMode) {
		if (previewMode === mode) return;
		stopPreview();
		previewMode = mode;
		previewError = null;
		previewNote = null;
		setPreviewTextForCurrentTab();
	}

	function updateTrackingFromSpeechMarks(
		audio: HTMLAudioElement,
		speechMarks: Array<{ time: number; start: number; end: number }>
	) {
		if (previewPollingTimer !== null) {
			window.clearInterval(previewPollingTimer);
		}
		const orderedMarks = [...speechMarks].sort((left, right) => {
			if (left.time !== right.time) return left.time - right.time;
			if (left.start !== right.start) return left.start - right.start;
			return left.end - right.end;
		});
		if (orderedMarks.length === 0) return;
	const firstMark = orderedMarks[0];
	debugPreview("tracking:init", {
		audioCurrentMs: Math.round(audio.currentTime * 1000),
		marks: orderedMarks.length,
		firstMark,
		firstSlice: previewText.slice(
			Math.max(0, firstMark.start),
			Math.max(firstMark.start, firstMark.end)
		)
	});
		// Ensure preview starts on the first spoken word instead of waiting for the first poll tick.
	previewTrackIndex = firstMark.start;
	previewTrackLength = Math.max(1, firstMark.end - firstMark.start);
		let lastIndex = 0;
	let emittedTransitions = 0;
		previewPollingTimer = window.setInterval(() => {
			const currentMs = audio.currentTime * 1000;
			let nextIndex = lastIndex;
			while (
				nextIndex + 1 < orderedMarks.length &&
				currentMs >= orderedMarks[nextIndex + 1].time
			) {
				nextIndex += 1;
			}
			if (nextIndex !== lastIndex) {
				lastIndex = nextIndex;
				const mark = orderedMarks[lastIndex];
				previewTrackIndex = mark.start;
				previewTrackLength = Math.max(1, mark.end - mark.start);
			if (emittedTransitions < 12) {
				emittedTransitions += 1;
				debugPreview("tracking:step", {
					audioCurrentMs: Math.round(currentMs),
					index: lastIndex,
					mark,
					slice: previewText.slice(Math.max(0, mark.start), Math.max(mark.start, mark.end))
				});
			}
			}
		}, 40);
	}

	function stopPreview() {
		clearPreviewTracking();
		previewError = null;
		previewNote = null;
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
		}
		if (currentPreviewAudio) {
			currentPreviewAudio.pause();
			currentPreviewAudio.src = "";
			currentPreviewAudio = null;
		}
		isPreviewing = false;
		previewBackend = null;
	}

	function normalizePreviewSpeechMarks(
		speechMarks: PreviewSpeechMark[],
		audioDurationSeconds: number
	): PreviewSpeechMark[] {
		if (speechMarks.length === 0) return speechMarks;
		const ordered = [...speechMarks].sort((left, right) => {
			if (left.time !== right.time) return left.time - right.time;
			if (left.start !== right.start) return left.start - right.start;
			return left.end - right.end;
		});
		const times = ordered.map((mark) => Number(mark.time) || 0).filter((value) => value >= 0);
		const maxTime = times.length ? Math.max(...times) : 0;
		const deltas: number[] = [];
		for (let index = 1; index < times.length; index += 1) {
			const delta = times[index] - times[index - 1];
			if (Number.isFinite(delta) && delta > 0) deltas.push(delta);
		}
		const medianDelta =
			deltas.length > 0
				? [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)]
				: 0;
		const durationSuggestsSeconds =
			Number.isFinite(audioDurationSeconds) &&
			audioDurationSeconds > 0 &&
			maxTime > 0 &&
			maxTime <= audioDurationSeconds * 1.5;
		// SC marks are commonly seconds; when metadata is unavailable, use time-shape heuristics.
		const shapeSuggestsSeconds =
			(maxTime > 0 && maxTime < 100 && ordered.length > 3) || (medianDelta > 0 && medianDelta < 10);
		const shouldConvertSecondsToMs = durationSuggestsSeconds || shapeSuggestsSeconds;
		if (!shouldConvertSecondsToMs) return ordered;
		return ordered.map((mark) => ({ ...mark, time: Number(mark.time) * 1000 }));
	}

function normalizePreviewSpeechMarkOffsets(
	speechMarks: PreviewSpeechMark[],
	trackingText: string
): PreviewSpeechMark[] {
	if (speechMarks.length === 0) return speechMarks;
	const ordered = [...speechMarks].sort((left, right) => {
		if (left.time !== right.time) return left.time - right.time;
		if (left.start !== right.start) return left.start - right.start;
		return left.end - right.end;
	});
	const safeText = typeof trackingText === "string" ? trackingText : "";
	const textLength = safeText.length;
	if (!textLength) return ordered;
	const maxEnd = Math.max(...ordered.map((mark) => Number(mark.end) || 0));
	const firstMark = ordered[0];
	const firstWord =
		typeof firstMark.value === "string" ? firstMark.value.trim() : "";
	const firstWordIndex = firstWord
		? safeText.toLowerCase().indexOf(firstWord.toLowerCase())
		: -1;
	const anchoredShift =
		firstWordIndex >= 0 ? Number(firstMark.start || 0) - firstWordIndex : 0;
	const fallbackShift = Number(firstMark.start || 0);
	const shouldRebase = maxEnd > textLength + 2 && (anchoredShift > 0 || fallbackShift > 0);
	if (!shouldRebase) return ordered;
	const shift = anchoredShift > 0 ? anchoredShift : fallbackShift;
	const rebased = ordered.map((mark) => {
		const start = Math.max(0, Number(mark.start || 0) - shift);
		const end = Math.max(start + 1, Number(mark.end || 0) - shift);
		return { ...mark, start, end };
	});
	debugPreview("marks:offset-rebase", {
		textLength,
		firstWord,
		firstWordIndex,
		shift,
		firstBefore: firstMark,
		firstAfter: rebased[0],
		lastAfter: rebased[rebased.length - 1]
	});
	return rebased;
}

	async function playPreviewAudioFromUrl(
		audioUrl: string,
		speechMarks: PreviewSpeechMark[] = []
	): Promise<void> {
		const audio = new Audio(audioUrl);
		currentPreviewAudio = audio;
		if (speechMarks.length > 0) {
			await new Promise<void>((resolve) => {
				if (Number.isFinite(audio.duration) && audio.duration > 0) {
					resolve();
					return;
				}
				let settled = false;
				const finish = () => {
					if (settled) return;
					settled = true;
					audio.removeEventListener("loadedmetadata", finish);
					audio.removeEventListener("error", finish);
					resolve();
				};
				audio.addEventListener("loadedmetadata", finish, { once: true });
				audio.addEventListener("error", finish, { once: true });
				if (typeof window !== "undefined") {
					window.setTimeout(finish, 1200);
				}
			});
		const audioDurationSeconds = Number(audio.duration);
		const normalizedMarks = normalizePreviewSpeechMarks(speechMarks, audioDurationSeconds);
		const offsetNormalizedMarks = normalizePreviewSpeechMarkOffsets(normalizedMarks, previewText);
		const rawMaxTime = Math.max(...speechMarks.map((mark) => Number(mark.time) || 0));
		const normalizedMaxTime = Math.max(...offsetNormalizedMarks.map((mark) => Number(mark.time) || 0));
		debugPreview("marks:normalize", {
			audioDurationSeconds,
			rawCount: speechMarks.length,
			normalizedCount: offsetNormalizedMarks.length,
			rawMaxTime,
			normalizedMaxTime,
			rawFirst: speechMarks[0],
			normalizedFirst: offsetNormalizedMarks[0],
			rawLast: speechMarks[speechMarks.length - 1],
			normalizedLast: offsetNormalizedMarks[offsetNormalizedMarks.length - 1]
		});
		updateTrackingFromSpeechMarks(audio, offsetNormalizedMarks);
	} else {
		debugPreview("marks:missing", { audioUrl });
		}
		await new Promise<void>((resolve, reject) => {
			audio.onended = () => {
				if (previewPollingTimer !== null) {
					window.clearInterval(previewPollingTimer);
					previewPollingTimer = null;
				}
				resolve();
			};
			audio.onerror = () => {
				if (previewPollingTimer !== null) {
					window.clearInterval(previewPollingTimer);
					previewPollingTimer = null;
				}
				reject(new Error("Failed to play preview audio."));
			};
			void audio.play().catch(reject);
		});
		currentPreviewAudio = null;
	}

	async function previewServerVoice(provider: "polly" | "google") {
		const endpoint = normalizeApiEndpoint(
			provider === "polly" ? pollyApiEndpoint : googleApiEndpoint,
			getDefaultApiEndpoint()
		);
		const includeSpeechMarks = !(provider === "google" && previewMode === "ssml");
		const requestBody: Record<string, unknown> = {
			text: previewText.trim() || getSampleText(provider),
			provider,
			rate: normalizeRate(provider === "polly" ? pollyRate : googleRate),
			language: provider === "polly" ? pollyLanguage || undefined : googleLanguage || undefined,
			voice:
				provider === "polly"
					? resolveVoiceForBackend("polly")
					: resolveVoiceForBackend("google"),
			includeSpeechMarks
		};
		if (provider === "polly") {
			requestBody.engine = pollyEngine;
			requestBody.sampleRate = normalizePollySampleRate(pollySampleRate);
			requestBody.format = pollyFormat;
			requestBody.speechMarkTypes = getPollySpeechMarkTypes();
		}
		const payload = adapters.synthesizeProbe
			? await adapters.synthesizeProbe({ endpoint, provider, body: requestBody })
			: await (async () => {
					const response = await fetch(`${endpoint}/synthesize`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(requestBody)
					});
					const nextPayload = await readJsonSafe(response);
					if (!response.ok) {
						throw new Error(
							nextPayload?.message ||
								nextPayload?.error ||
								`Preview request failed (${response.status})`
						);
					}
					return nextPayload as SynthesizeProbeResponse;
				})();

		const audioBase64 = payload?.audio;
		const contentType = payload?.contentType || "audio/mpeg";
		if (!audioBase64 || typeof audioBase64 !== "string") {
			throw new Error("Preview response did not include audio content.");
		}
		const byteChars = atob(audioBase64);
		const byteNumbers = new Array(byteChars.length);
		for (let i = 0; i < byteChars.length; i += 1) {
			byteNumbers[i] = byteChars.charCodeAt(i);
		}
		const blob = new Blob([new Uint8Array(byteNumbers)], { type: contentType });
		const objectUrl = URL.createObjectURL(blob);
		const audio = new Audio(objectUrl);
		currentPreviewAudio = audio;
		const speechMarks = Array.isArray(payload?.speechMarks) ? payload.speechMarks : [];
		if (includeSpeechMarks && speechMarks.length > 0) {
			updateTrackingFromSpeechMarks(audio, speechMarks);
		}
		await new Promise<void>((resolve, reject) => {
			audio.onended = () => {
				if (previewPollingTimer !== null) {
					window.clearInterval(previewPollingTimer);
					previewPollingTimer = null;
				}
				URL.revokeObjectURL(objectUrl);
				resolve();
			};
			audio.onerror = () => {
				if (previewPollingTimer !== null) {
					window.clearInterval(previewPollingTimer);
					previewPollingTimer = null;
				}
				URL.revokeObjectURL(objectUrl);
				reject(new Error("Failed to play preview audio."));
			};
			void audio.play().catch(reject);
		});
		currentPreviewAudio = null;
	}

	async function previewBrowserVoice() {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) {
			throw new Error("Browser speech synthesis is unavailable.");
		}
		if (previewMode === "ssml") {
			throw new Error("SSML preview is not supported in the Browser backend.");
		}
		const synth = window.speechSynthesis;
		const utterance = new SpeechSynthesisUtterance(previewText.trim() || getSampleText("browser"));
		utterance.rate = normalizeRate(browserRate);
		utterance.pitch = normalizePitch(browserPitch);
		if (browserVoice) {
			const voice = synth.getVoices().find((entry) => entry.name === browserVoice);
			if (voice) utterance.voice = voice;
		}
		utterance.onboundary = (event) => {
			if ((event as any).name !== "word") return;
			const charIndex = Number((event as any).charIndex || 0);
			const token = tokenizePreviewText(previewText).find(
				(entry) => charIndex >= entry.start && charIndex < entry.end
			);
			if (token) {
				previewTrackIndex = token.start;
				previewTrackLength = Math.max(1, token.end - token.start);
			}
		};
		await new Promise<void>((resolve, reject) => {
			utterance.onend = () => resolve();
			utterance.onerror = () => reject(new Error("Failed to play browser voice preview."));
			synth.speak(utterance);
		});
	}

	async function previewSelectedVoice() {
		previewError = null;
		previewNote = null;
		const activeState = getActiveState();
		if (!activeState.available) {
			previewError = "Cannot preview while this TTS service is unavailable.";
			return;
		}
		if (isPreviewing && previewBackend === activeTab) {
			previewRunId += 1;
			stopPreview();
			return;
		}
		const activePreviewText = typeof previewText === "string" ? previewText : "";
		if (!activePreviewText.trim()) {
			if (isBuiltInTab(activeTab)) {
				previewError = "Enter preview text before starting playback.";
				return;
			}
		}
		if (activeTab === "browser" && previewMode === "ssml") {
			previewError = "SSML preview is not supported in the Browser backend.";
			return;
		}
		stopPreview();
		const runId = ++previewRunId;
		isPreviewing = true;
		previewBackend = activeTab;
		try {
			if (!isBuiltInTab(activeTab)) {
				const provider = getCustomProviderOrThrow(activeTab);
				const result = await provider.preview?.(
					createProviderContext(provider.id, {
						previewText,
						previewMode
					})
				);
				const customResult = (result || null) as CustomProviderPreviewResult | null;
				if (customResult?.audioUrl && typeof customResult.audioUrl === "string") {
					const speechMarks = Array.isArray(customResult.speechMarks)
						? customResult.speechMarks
						: [];
					const trackingText =
						typeof customResult.trackingText === "string"
							? customResult.trackingText
							: null;
					if (trackingText) {
						previewText = trackingText;
					}
					await playPreviewAudioFromUrl(customResult.audioUrl, speechMarks);
				}
				previewNote = result?.note || null;
			} else if (activeTab === "browser") {
				await previewBrowserVoice();
			} else if (activeTab === "polly") {
				if (previewMode === "ssml") {
					previewNote =
						"Some Polly neural voices reject certain SSML tags (for example emphasis). Use basic SSML tags if preview fails.";
				}
				await previewServerVoice("polly");
			} else {
				if (previewMode === "ssml") {
					previewNote =
						"Google SSML preview preserves authored SSML, so word tracking is disabled.";
				}
				await previewServerVoice("google");
			}
		} catch (error) {
			if (runId === previewRunId) {
				previewError = error instanceof Error ? error.message : String(error);
			}
		} finally {
			if (runId === previewRunId) {
				clearPreviewTracking();
				isPreviewing = false;
				previewBackend = null;
			}
		}
	}

	async function applySettings() {
		applyMessage = null;
		applyError = null;
		const activeState = getActiveState();
		if (!activeState.available) {
			applyError = "Cannot apply settings while this TTS service is unavailable.";
			return;
		}
		if (!toolkitCoordinator?.updateToolConfig) {
			applyError = "Toolkit coordinator is not available for TTS updates.";
			return;
		}

		isApplying = true;
		try {
			const appliedSpeedOptions = parseTTSSpeedOptionsFromText(speedOptionsText);
			if (!isBuiltInTab(activeTab)) {
				const provider = getCustomProviderOrThrow(activeTab);
				let next: ProviderApplyResult | undefined;
				if (provider.buildApplyConfig) {
					next = await provider.buildApplyConfig(createProviderContext(provider.id));
				}
				if (!next?.config) {
					next = customProviderApplyRequestById[provider.id];
				}
				if (!next?.config) {
					throw new Error(
						`Custom provider '${provider.id}' did not return apply config.`
					);
				}
				toolkitCoordinator.updateToolConfig("textToSpeech", {
					enabled: true,
					...next.config,
					layoutMode,
					speedOptions: appliedSpeedOptions,
				});
				persistSettings({
					backend: provider.id,
					...(next.config || {}),
					layoutMode,
					speedOptions: appliedSpeedOptions,
				});
				applyMessage = next.message || `Applied ${provider.label} TTS settings.`;
			} else if (activeTab === "browser") {
				const next = {
					backend: "browser" as const,
					serverProvider: undefined,
					provider: undefined,
					defaultVoice: resolveVoiceForBackend("browser"),
					rate: normalizeRate(browserRate),
					pitch: normalizePitch(browserPitch),
					transportMode: "pie" as const,
					layoutMode,
					speedOptions: appliedSpeedOptions,
				};
				toolkitCoordinator.updateToolConfig("textToSpeech", {
					enabled: true,
					...next
				});
				persistSettings(next);
			} else if (activeTab === "polly") {
				const next = {
					backend: "polly" as const,
					serverProvider: "polly" as const,
					apiEndpoint: normalizeApiEndpoint(pollyApiEndpoint, getDefaultApiEndpoint()),
					transportMode: "pie" as const,
					endpointMode: "synthesizePath" as const,
					endpointValidationMode: "voices" as const,
					defaultVoice: resolveVoiceForBackend("polly"),
					rate: normalizeRate(pollyRate),
					language: pollyLanguage || undefined,
					engine: pollyEngine,
					sampleRate: normalizePollySampleRate(pollySampleRate),
					format: pollyFormat,
					speechMarksMode: pollySpeechMarksMode,
					providerOptions: {
						engine: pollyEngine,
						sampleRate: normalizePollySampleRate(pollySampleRate),
						format: pollyFormat,
						speechMarkTypes: getPollySpeechMarkTypes()
					},
					layoutMode,
					speedOptions: appliedSpeedOptions,
				};
				toolkitCoordinator.updateToolConfig("textToSpeech", {
					enabled: true,
					...next
				});
				persistSettings(next);
			} else {
				const next = {
					backend: "google" as const,
					serverProvider: "google" as const,
					apiEndpoint: normalizeApiEndpoint(googleApiEndpoint, getDefaultApiEndpoint()),
					transportMode: "pie" as const,
					endpointMode: "synthesizePath" as const,
					endpointValidationMode: "voices" as const,
					defaultVoice: resolveVoiceForBackend("google"),
					rate: normalizeRate(googleRate),
					language: googleLanguage || undefined,
					googleVoiceType,
					googleGender,
					layoutMode,
					speedOptions: appliedSpeedOptions,
				};
				toolkitCoordinator.updateToolConfig("textToSpeech", {
					enabled: true,
					...next
				});
				persistSettings(next);
			}
			await toolkitCoordinator?.ensureTTSReady?.(
				toolkitCoordinator?.getToolConfig?.("textToSpeech"),
			);
			if (isBuiltInTab(activeTab)) {
				applyMessage = `Applied ${activeTab} TTS settings.`;
			}
			requestClose();
		} catch (error) {
			applyError = error instanceof Error ? error.message : String(error);
		} finally {
			isApplying = false;
		}
	}

	onMount(() => {
		initializeFromCoordinator();
		syncCustomProvidersState();
		void checkActiveTabAvailability();
	});

	$effect(() => {
		if (!dialogEl) return;
		cleanupFocusTrap?.();
		cleanupFocusTrap = createLocalFocusTrap(dialogEl, {
			initialFocus: closeButtonEl,
			onEscape: requestClose
		});
		queueMicrotask(() => {
			closeButtonEl?.focus?.();
		});
		return () => {
			cleanupFocusTrap?.();
			cleanupFocusTrap = null;
		};
	});

	$effect(() => {
		void normalizedCustomProviders;
		untrack(() => {
			syncCustomProvidersState();
		});
	});

	$effect(() => {
		void activeCustomProvider;
		const provider = activeCustomProvider;
		const target = activeCustomProviderElement;
		if (!provider || provider.mode !== "component" || !target) return;
		const onAvailability = (event: Event) =>
			onCustomProviderAvailability(provider.id, event as CustomEvent);
		const onApplyRequest = (event: Event) =>
			void onCustomProviderApplyRequest(provider.id, event as CustomEvent);
		const onPreviewRequest = () => void onCustomProviderPreviewRequest(provider.id);

		target.addEventListener("availability", onAvailability as EventListener);
		target.addEventListener("apply-request", onApplyRequest as EventListener);
		target.addEventListener("preview-request", onPreviewRequest as EventListener);
		return () => {
			target.removeEventListener("availability", onAvailability as EventListener);
			target.removeEventListener("apply-request", onApplyRequest as EventListener);
			target.removeEventListener("preview-request", onPreviewRequest as EventListener);
		};
	});

	onDestroy(() => {
		cleanupFocusTrap?.();
		cleanupFocusTrap = null;
		stopPreview();
	});
</script>

<div class="pie-tts-dialog-backdrop" style="z-index: {TTS_MODAL_Z_INDEX};">
	<div
		class="pie-tts-dialog"
		bind:this={dialogEl}
		role="dialog"
		aria-modal="true"
		aria-labelledby="pie-tts-dialog-title"
		tabindex="-1"
	>
		<div class="pie-tts-dialog-header">
			<h3 id="pie-tts-dialog-title" class="pie-tts-dialog-title">TTS settings</h3>
			<button
				class="btn btn-xs btn-ghost btn-circle"
				bind:this={closeButtonEl}
				type="button"
				onclick={requestClose}
				aria-label="Close TTS settings"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="pie-tts-fieldset fieldset bg-base-200 border border-base-300 rounded-box">
			<div class="pie-tts-field">
				<label class="pie-tts-label" for="tts-layout-mode">Toolbar layout mode</label>
				<select
					id="tts-layout-mode"
					class="select select-sm select-bordered w-full"
					bind:value={layoutMode}
				>
					<option value="reserved-row">Reserved row</option>
					<option value="expanding-row">Expanding row</option>
					<option value="floating-overlay">Floating overlay</option>
					<option value="left-aligned">Left-aligned controls</option>
				</select>
				<div class="text-xs opacity-75">
					Item header row reservation: {layoutModeReservesRow ? "Enabled" : "Disabled"}
				</div>
			</div>
			<div class="pie-tts-field">
				<label class="pie-tts-label" for="tts-inline-speed-options">Inline speed buttons</label>
				<input
					id="tts-inline-speed-options"
					class="input input-sm input-bordered w-full"
					bind:value={speedOptionsText}
					placeholder="0.8, 1.25"
					autocomplete="off"
				/>
				<div class="mt-1 flex flex-wrap items-center gap-2">
					<span class="text-xs opacity-75">
						Comma or semicolon-separated multipliers (1× is not shown as a button). Leave empty to
						hide speed buttons.
					</span>
					<button
						type="button"
						class="btn btn-xs btn-ghost"
						onclick={resetInlineSpeedOptionsToDefaults}
					>
						Reset to defaults
					</button>
				</div>
			</div>
		</div>

		<div class="join pie-tts-tabs">
			{#each providerTabs as provider}
				<button
					class="btn btn-sm join-item"
					class:btn-active={activeTab === provider.id}
					onclick={() => setActiveTab(provider.id)}
				>
					{provider.label}
				</button>
			{/each}
		</div>

		<div class="pie-tts-status">
			{#if getActiveState().loading}
				<span class="loading loading-spinner loading-xs"></span>
				<span>Checking availability...</span>
			{:else if getActiveState().checked}
				<span class={getActiveState().available ? "pie-tts-ok" : "pie-tts-error"}>
					{getActiveState().message}
				</span>
			{/if}
			<button class="btn btn-xs btn-outline" onclick={() => void checkActiveTabAvailability()}>
				Recheck
			</button>
		</div>

		{#if getActiveState().detail}
			<div class="alert alert-warning text-xs">
				<span>{getActiveState().detail}</span>
			</div>
		{/if}

		{#if activeTab === "browser"}
			<fieldset class="pie-tts-fieldset fieldset bg-base-200 border border-base-300 rounded-box" disabled={!browserState.available}>
				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-browser-voice">Voice</label>
					<select id="tts-browser-voice" class="select select-sm select-bordered w-full" bind:value={browserVoice}>
						<option value="">Default browser voice</option>
						{#each browserState.voices as voice}
							<option value={voice.name || ""}>{voice.name} ({voice.languageCode || "n/a"})</option>
						{/each}
					</select>
				</div>
			</fieldset>
		{:else if activeTab === "polly"}
			<fieldset class="pie-tts-fieldset fieldset bg-base-200 border border-base-300 rounded-box" disabled={!pollyState.available}>
				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-polly-endpoint">API endpoint</label>
					<input id="tts-polly-endpoint" class="input input-sm input-bordered w-full" bind:value={pollyApiEndpoint} placeholder="/api/tts" />
				</div>

				<div class="pie-tts-grid-3">
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-language">Language</label>
						<input
							id="tts-polly-language"
							class="input input-sm input-bordered w-full"
							bind:value={pollyLanguage}
							placeholder="en-US"
							onchange={refreshPollyVoices}
						/>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-gender">Gender</label>
						<select
							id="tts-polly-gender"
							class="select select-sm select-bordered w-full"
							bind:value={pollyGender}
							onchange={refreshPollyVoices}
						>
							<option value="">Any</option>
							<option value="male">Male</option>
							<option value="female">Female</option>
							<option value="neutral">Neutral</option>
						</select>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-engine">Engine</label>
						<select
							id="tts-polly-engine"
							class="select select-sm select-bordered w-full"
							bind:value={pollyEngine}
							onchange={refreshPollyVoices}
						>
							<option value="neural">Neural</option>
							<option value="standard">Standard</option>
						</select>
					</div>
				</div>

				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-polly-voice">Voice</label>
					<select id="tts-polly-voice" class="select select-sm select-bordered w-full" bind:value={pollyVoice}>
						<option value="">Provider default</option>
						{#each pollyState.voices as voice}
							<option value={voice.id || voice.name || ""}>{voice.name || voice.id} ({voice.languageCode || "n/a"})</option>
						{/each}
					</select>
				</div>

				<div class="pie-tts-grid-3">
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-format">Format</label>
						<select id="tts-polly-format" class="select select-sm select-bordered w-full" bind:value={pollyFormat}>
							<option value="mp3">MP3</option>
							<option value="ogg">OGG</option>
							<option value="pcm">PCM</option>
						</select>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-sample-rate">Sample rate</label>
						<select id="tts-polly-sample-rate" class="select select-sm select-bordered w-full" bind:value={pollySampleRate}>
							<option value={8000}>8000 Hz</option>
							<option value={16000}>16000 Hz</option>
							<option value={22050}>22050 Hz</option>
							<option value={24000}>24000 Hz</option>
						</select>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-speech-marks">Speech marks</label>
						<select id="tts-polly-speech-marks" class="select select-sm select-bordered w-full" bind:value={pollySpeechMarksMode}>
							<option value="word">Word</option>
							<option value="word+sentence">Word + sentence</option>
						</select>
					</div>
				</div>
			</fieldset>
		{:else if activeTab === "google"}
			<fieldset class="pie-tts-fieldset fieldset bg-base-200 border border-base-300 rounded-box" disabled={!googleState.available}>
				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-google-endpoint">API endpoint</label>
					<input id="tts-google-endpoint" class="input input-sm input-bordered w-full" bind:value={googleApiEndpoint} placeholder="/api/tts" />
				</div>

				<div class="pie-tts-grid-3">
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-google-language">Language</label>
						<input
							id="tts-google-language"
							class="input input-sm input-bordered w-full"
							bind:value={googleLanguage}
							placeholder="en-US"
							onchange={refreshGoogleVoices}
						/>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-google-gender">Gender</label>
						<select
							id="tts-google-gender"
							class="select select-sm select-bordered w-full"
							bind:value={googleGender}
							onchange={refreshGoogleVoices}
						>
							<option value="">Any</option>
							<option value="male">Male</option>
							<option value="female">Female</option>
							<option value="neutral">Neutral</option>
						</select>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-google-voice-type">Voice type</label>
						<select
							id="tts-google-voice-type"
							class="select select-sm select-bordered w-full"
							bind:value={googleVoiceType}
							onchange={refreshGoogleVoices}
						>
							<option value="wavenet">WaveNet</option>
							<option value="studio">Studio</option>
							<option value="standard">Standard</option>
						</select>
					</div>
				</div>

				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-google-voice">Voice</label>
					<select id="tts-google-voice" class="select select-sm select-bordered w-full" bind:value={googleVoice}>
						<option value="">Provider default</option>
						{#each googleState.voices as voice}
							<option value={voice.id || voice.name || ""}>{voice.name || voice.id} ({voice.languageCode || "n/a"})</option>
						{/each}
					</select>
				</div>
			</fieldset>
		{:else if activeCustomProvider}
			<fieldset class="pie-tts-fieldset fieldset bg-base-200 border border-base-300 rounded-box" disabled={!getActiveState().available}>
				<div class="pie-tts-custom-provider-header">
					<div class="text-sm font-semibold">{activeCustomProvider.label}</div>
					{#if activeCustomProvider.description}
						<div class="text-xs opacity-75">{activeCustomProvider.description}</div>
					{/if}
				</div>
				{#if activeCustomProvider.mode === "component"}
					<svelte:element
						this={activeCustomProvider.tagName}
						class="pie-tts-custom-provider-element"
						bind:this={activeCustomProviderElement}
						{...resolveComponentProps(activeCustomProvider)}
						onchange={(event: Event) =>
							onCustomProviderChange(activeCustomProvider.id, event as unknown as CustomEvent)}
					/>
				{:else}
					<div class="text-xs opacity-75">
						This provider uses adapter mode. Configure provider state from your host app via
						`customProviders`.
					</div>
				{/if}
			</fieldset>
		{/if}

		<div class="pie-tts-fieldset pie-tts-preview-block fieldset bg-base-200 border border-base-300 rounded-box">
			<div class="pie-tts-preview-header">
				<h4 class="pie-tts-preview-title">Preview</h4>
				<div class="join">
					<button
						type="button"
						class="btn btn-xs join-item"
						class:btn-active={previewMode === "plain"}
						onclick={() => onPreviewModeChange("plain")}
					>
						Plain text
					</button>
					<button
						type="button"
						class="btn btn-xs join-item"
						class:btn-active={previewMode === "ssml"}
						onclick={() => onPreviewModeChange("ssml")}
					>
						SSML
					</button>
				</div>
			</div>
			<label class="pie-tts-label" for="tts-preview-text">Sample text</label>
			<textarea
				id="tts-preview-text"
				class="textarea textarea-sm textarea-bordered w-full pie-tts-preview-input"
				bind:value={previewText}
			></textarea>
			<div class="pie-tts-preview-row">
				<button type="button" class="btn btn-xs btn-outline" onclick={setPreviewTextForCurrentTab}>
					Reset sample
				</button>
				<span class="text-xs opacity-70">
					{#if activeTab === "browser" && previewMode === "ssml"}
						SSML is unsupported in Browser preview.
					{:else if activeTab === "google" && previewMode === "ssml"}
						SSML preserved. Tracking disabled.
					{:else if !isBuiltInTab(activeTab)}
						Tracking enabled when provider returns speech marks.
					{:else}
						Tracking enabled while preview plays.
					{/if}
				</span>
			</div>
			<div class="pie-tts-preview-track" aria-live="polite">
				{#each getTrackingSegments(previewText) as segment}
					<span class:pie-tts-preview-active={segment.active}>{segment.text}</span>
				{/each}
			</div>
		</div>

		{#if applyMessage}
			<div class="alert alert-success text-xs"><span>{applyMessage}</span></div>
		{/if}
		{#if applyError}
			<div class="alert alert-error text-xs"><span>{applyError}</span></div>
		{/if}
		{#if previewError}
			<div class="alert alert-error text-xs"><span>{previewError}</span></div>
		{/if}
		{#if previewNote}
			<div class="alert alert-info text-xs"><span>{previewNote}</span></div>
		{/if}

		<div class="pie-tts-actions">
			<button class="btn btn-sm btn-outline" onclick={requestClose}>Close</button>
			<button
				class="btn btn-sm btn-outline"
				disabled={!getActiveState().available || isApplying || !canPreviewActiveTab()}
				onclick={() => void previewSelectedVoice()}
			>
				{isPreviewing && previewBackend === activeTab ? "Stop preview" : "Preview voice"}
			</button>
			<button class="btn btn-sm btn-primary" disabled={isApplying || !getActiveState().available} onclick={() => void applySettings()}>
				{isApplying ? "Applying..." : "Apply"}
			</button>
		</div>
	</div>
</div>

<style>
	.pie-tts-dialog-backdrop {
		position: fixed;
		inset: 0;
		background: color-mix(in srgb, #000 30%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.pie-tts-dialog {
		width: min(720px, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow: auto;
		background: var(--color-base-100);
		border: 1px solid var(--color-base-300);
		border-radius: 0.75rem;
		box-shadow: 0 24px 48px rgba(0, 0, 0, 0.22);
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pie-tts-dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.pie-tts-dialog-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.pie-tts-tabs {
		width: 100%;
		max-width: 100%;
		flex-wrap: wrap;
		row-gap: 0.25rem;
	}

	.pie-tts-status {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		justify-content: space-between;
	}

	.pie-tts-status > span:not(.loading) {
		flex: 1;
		min-width: 0;
		font-size: 0.75rem;
		line-height: 1.35;
	}

	.pie-tts-ok {
		color: var(--color-success);
	}

	.pie-tts-error {
		color: var(--color-error);
	}

	.pie-tts-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.pie-tts-fieldset {
		padding: 0.5rem 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.pie-tts-field {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.pie-tts-label {
		display: block;
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.2;
		opacity: 0.85;
		padding: 0;
	}

	.pie-tts-grid-3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.45rem 0.65rem;
		align-items: end;
	}

	@media (max-width: 32rem) {
		.pie-tts-grid-3 {
			grid-template-columns: 1fr;
		}
	}

	.pie-tts-range {
		--range-thumb-size: 0.85rem;
		height: 1.35rem;
		min-height: 1.35rem;
	}

	.pie-tts-range-value {
		font-size: 0.65rem;
		line-height: 1.2;
		opacity: 0.7;
		margin-top: -0.1rem;
	}

	.pie-tts-preview-block {
		gap: 0.35rem;
	}

	.pie-tts-custom-provider-header {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin-bottom: 0.25rem;
	}

	.pie-tts-custom-provider-element {
		display: block;
		width: 100%;
	}

	.pie-tts-preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pie-tts-preview-title {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.pie-tts-preview-input {
		min-height: 4.25rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
			"Courier New", monospace;
	}

	.pie-tts-preview-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pie-tts-preview-track {
		margin-top: 0.15rem;
		border: 1px dashed var(--color-base-300);
		border-radius: 0.5rem;
		padding: 0.4rem 0.5rem;
		min-height: 2.6rem;
		white-space: pre-wrap;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.pie-tts-preview-active {
		background: color-mix(in srgb, var(--color-warning) 40%, transparent);
		border-radius: 0.15rem;
	}
</style>
