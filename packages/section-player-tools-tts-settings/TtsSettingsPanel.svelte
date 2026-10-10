<svelte:options
	customElement={{
		tag: "pie-section-player-tools-tts-settings",
		shadow: "none",
		// `toolkitCoordinator` and `customProviders` are set as properties only.
		props: {
			apiEndpoint: { type: "String", attribute: "api-endpoint" },
			storageKey: { type: "String", attribute: "storage-key" }
		}
	}}
/>

<script lang="ts">
	import {
		type AssessmentToolkitRuntimeContext,
		browserVoiceMatchesLanguage,
		connectToolRuntimeContext,
		findBrowserVoice,
		waitForBrowserVoices,
	} from "@pie-players/pie-assessment-toolkit/tools/registration";
	import {
		BrowserTTSProvider,
		PlaybackState,
		type TextToSpeechToolProviderConfig,
		type ToolkitCoordinatorApi,
		TTSService,
	} from "@pie-players/pie-assessment-toolkit";
	import { createFocusTrap } from "@pie-players/pie-players-shared";
	import {
		createPieLogger,
		isTtsDebugEnabled,
	} from "@pie-players/pie-players-shared/pie";
	import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";
	import {
		formatTTSSpeedOptionsAsText,
		normalizeTTSSpeedControlOptions,
		parseTTSSpeedOptionsFromText,
		resolveTTSRuntimeSettings,
		type TTSSpeedOption,
		type TTSLayoutMode,
	} from "@pie-players/pie-assessment-toolkit/tools/registration";
	import { onDestroy, onMount, untrack } from "svelte";
	import type {
		CustomProviderContext,
		CustomProviderDescriptor,
		CustomProviderPreviewResult,
		PreviewMode,
		PreviewSpeechMark,
		ProviderAvailabilityResult,
	} from "./types.js";

	type BuiltInBackendTab = "browser" | "polly" | "google";
	type BackendTab = BuiltInBackendTab | string;
	type PollyFormat = "mp3" | "ogg" | "pcm";
	type PollySpeechMarksMode = "word" | "word+sentence";
	const INLINE_SPEED_DEFAULT_RATES = [0.8, 1, 1.25];

	type DemoVoice = {
		id?: string;
		name?: string;
		languageCode?: string;
		/** A browser voice's `SpeechSynthesisVoice` identity and language. */
		voiceURI?: string;
		lang?: string;
		gender?: string;
		localService?: boolean;
		default?: boolean;
	};

	type AvailabilityState = {
		checked: boolean;
		loading: boolean;
		available: boolean;
		message: string | null;
		detail: string | null;
		voices: DemoVoice[];
	};

	type SynthesizeResponse = {
		audio: string;
		contentType?: string;
		speechMarks?: PreviewSpeechMark[];
	};

	const DEFAULT_API_ENDPOINT = "/api/tts";
	const DEFAULT_STORAGE_KEY = "pie:section-player-tools:tts-settings";
	const TTS_MODAL_Z_INDEX = 200000;

	let {
		toolkitCoordinator = null,
		apiEndpoint = DEFAULT_API_ENDPOINT,
		storageKey = DEFAULT_STORAGE_KEY,
		customProviders = []
	}: {
		toolkitCoordinator?: ToolkitCoordinatorApi | null;
		apiEndpoint?: string;
		storageKey?: string;
		customProviders?: CustomProviderDescriptor[];
	} = $props();

	/**
	 * The stored record: the config the tab applied, without the provider options
	 * it does not own, plus the panel's own fields, which never reach the
	 * coordinator.
	 */
	type PersistedTTSSettings = Record<string, unknown> & {
		/** The panel tab that applied these settings. */
		tab?: BackendTab;
		/** Google voice-list filters: the voices route reads them, the runtime does not. */
		googleVoiceType?: string;
		googleGender?: string;
	};

	let activeTab = $state<BackendTab>("browser");
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
	let customProviderAvailabilityById = $state<Record<string, AvailabilityState>>({});

	let browserVoice = $state("");
	let browserRate = $state(1);
	let browserPitch = $state(1);
	let layoutMode = $state<TTSLayoutMode>("left-aligned");
	let speedOptionsText = $state("");
	let preservedObjectSpeedOptions = $state<TTSSpeedOption[] | undefined>(undefined);
	let preservedObjectSpeedOptionsText = $state("");
	let mathTokenHighlighting = $state(true);

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
	/** Settles the preview audio that is playing; `stopPreview` calls it. */
	let settlePreviewAudio: (() => void) | null = null;
	let browserPreviewService: TTSService | null = null;
	let browserPreviewHost: HTMLElement | null = null;
	let previewPollingTimer: number | null = null;
	/** Bumped by every start and stop; a run whose id is stale changes nothing. */
	let previewRunId = 0;
	let dialogEl = $state<HTMLElement | null>(null);
	let closeButtonEl = $state<HTMLButtonElement | null>(null);
	let cleanupFocusTrap: (() => void) | null = null;

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
	const previewLogger = createPieLogger("pie-tts-preview", isTtsDebugEnabled);

	function debugPreview(event: string, payload?: Record<string, unknown>): void {
		if (payload) previewLogger.debug(event, payload);
		else previewLogger.debug(event);
	}

	function isRecommendedBrowserVoice(voice: DemoVoice, contentLanguage?: string): boolean {
		return Boolean(voice.localService && browserVoiceMatchesLanguage(voice, contentLanguage));
	}

	function browserVoiceLabel(voice: DemoVoice): string {
		const name =
			voice.name || voice.id || interfaceI18n.t("debug.tts.unnamedVoice");
		const metadata = [
			voice.lang || interfaceI18n.t("debug.tts.notAvailable"),
			interfaceI18n.t(voice.localService ? "debug.tts.voiceLocal" : "debug.tts.voiceRemote"),
			voice.default ? interfaceI18n.t("debug.tts.voiceBrowserDefault") : ""
		].filter(Boolean);
		return `${name} (${metadata.join(", ")})`;
	}

	function voiceIdentity(voice: DemoVoice): string {
		return voice.id || voice.name || "";
	}

	/** `selected` when the listed voices carry it; otherwise the server picks. */
	function knownVoice(selected: string, voices: DemoVoice[]): string | undefined {
		return selected && voices.some((voice) => voiceIdentity(voice) === selected)
			? selected
			: undefined;
	}

	function compareSpeechMarks(left: PreviewSpeechMark, right: PreviewSpeechMark): number {
		if (left.time !== right.time) return left.time - right.time;
		if (left.start !== right.start) return left.start - right.start;
		return left.end - right.end;
	}

	function resetInlineSpeedOptionsToDefaults(): void {
		speedOptionsText = formatTTSSpeedOptionsAsText(INLINE_SPEED_DEFAULT_RATES);
		preservedObjectSpeedOptions = undefined;
		preservedObjectSpeedOptionsText = "";
	}

	const getSpeedOptionRate = (option: TTSSpeedOption | { rate: number }): number =>
		typeof option === "number" ? option : option.rate;

	const hasObjectSpeedOptions = (value: unknown): boolean =>
		Array.isArray(value) &&
		value.some((option) => !!option && typeof option === "object" && !Array.isArray(option));

	function haveSameSpeedOptionRates(left: unknown, right: unknown): boolean {
		if (!Array.isArray(left) || !Array.isArray(right)) return false;
		const leftRates = normalizeTTSSpeedControlOptions(left).map(getSpeedOptionRate);
		const rightRates = normalizeTTSSpeedControlOptions(right).map(getSpeedOptionRate);
		return (
			leftRates.length === rightRates.length &&
			leftRates.every((rate, index) => rate === rightRates[index])
		);
	}

	function mergeStoredSettings(
		existing: Record<string, unknown>,
		stored: PersistedTTSSettings | null,
	): Record<string, unknown> {
		if (!stored) return existing;
		const source: Record<string, unknown> = { ...existing, ...stored };
		if (
			hasObjectSpeedOptions(existing.speedOptions) &&
			"speedOptions" in stored &&
			haveSameSpeedOptionRates(existing.speedOptions, stored.speedOptions)
		) {
			source.speedOptions = existing.speedOptions;
		}
		return source;
	}

	function resolveAppliedSpeedOptions(): TTSSpeedOption[] {
		if (
			preservedObjectSpeedOptions &&
			speedOptionsText === preservedObjectSpeedOptionsText
		) {
			return preservedObjectSpeedOptions;
		}
		return parseTTSSpeedOptionsFromText(speedOptionsText);
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

	const resolvedBrowserVoice = $derived.by(() =>
		findBrowserVoice(browserState.voices, browserVoice || undefined, contentLanguage)
	);
	const recommendedBrowserVoices = $derived.by(() =>
		browserState.voices.filter((voice) => {
			const identity = voiceIdentity(voice);
			return identity.length > 0 && isRecommendedBrowserVoice(voice, contentLanguage);
		})
	);
	const allBrowserVoices = $derived.by(() => {
		const recommended = new Set(recommendedBrowserVoices.map(voiceIdentity));
		return browserState.voices.filter((voice) => {
			const identity = voiceIdentity(voice);
			return identity.length > 0 && !recommended.has(identity);
		});
	});

	function requestClose(): void {
		$host().dispatchEvent(new CustomEvent("close"));
	}

	function createProviderContext(
		providerId: string,
		overrides: Partial<CustomProviderContext> = {}
	): CustomProviderContext {
		return {
			id: providerId,
			apiEndpoint: getDefaultApiEndpoint(),
			state: customProviderStateById[providerId] || {},
			...overrides
		};
	}

	function isBuiltInTab(tab: BackendTab): tab is BuiltInBackendTab {
		return tab === "browser" || tab === "polly" || tab === "google";
	}

	/** The tab that owns `source`: its stored `tab`, else the built-in tab its backend names. */
	function resolveSourceTab(source: Record<string, unknown>): BackendTab | null {
		if (typeof source.tab === "string" && source.tab.trim().length > 0) return source.tab;
		if (source.backend === "browser") return "browser";
		if (
			source.backend === "server" &&
			(source.serverProvider === "polly" || source.serverProvider === "google")
		) {
			return source.serverProvider;
		}
		return null;
	}

	function buildAvailabilityState(result?: ProviderAvailabilityResult | null): AvailabilityState {
		const available = result?.available === true;
		return {
			checked: true,
			loading: false,
			available,
			message: result?.message || (available ? interfaceI18n.t("debug.tts.providerAvailable") : interfaceI18n.t("debug.tts.providerUnavailable")),
			detail: result?.detail || null,
			voices: []
		};
	}

	function getCustomProviderOrThrow(providerId: string): CustomProviderDescriptor {
		const provider = normalizedCustomProviders.find((entry) => entry.id === providerId);
		if (!provider) {
			throw new Error(
				interfaceI18n.t("debug.tts.customProviderNotRegistered", { id: providerId })
			);
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
				[provider.id]: buildAvailabilityState(result || { available: true, message: interfaceI18n.t("debug.tts.providerAvailable") })
			};
		} catch (error) {
			customProviderAvailabilityById = {
				...customProviderAvailabilityById,
				[provider.id]: {
					checked: true,
					loading: false,
					available: false,
					message: interfaceI18n.t("debug.tts.providerCheckFailed"),
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
		const existing = toolkitCoordinator?.getToolConfig("textToSpeech") ?? {};
		const stored = readStoredSettings();
		const source = mergeStoredSettings(existing, stored);
		const resolvedDefaultApiEndpoint = getDefaultApiEndpoint();
		const sourceTab = resolveSourceTab(source);
		if (sourceTab) {
			activeTab = sourceTab;
		}

		const defaultVoice = typeof source?.defaultVoice === "string" ? source.defaultVoice : "";
		const defaultRate = normalizeRate(Number(source?.rate ?? 1));
		const defaultPitch = normalizePitch(Number(source?.pitch ?? 1));
		const defaultEndpoint =
			typeof source?.apiEndpoint === "string" && source.apiEndpoint.trim().length > 0
				? source.apiEndpoint
				: resolvedDefaultApiEndpoint;
		const defaultPollyEndpoint =
			sourceTab === "polly" ? defaultEndpoint : resolvedDefaultApiEndpoint;
		const defaultGoogleEndpoint =
			sourceTab === "google" ? defaultEndpoint : resolvedDefaultApiEndpoint;
		const defaultLanguage =
			typeof source?.language === "string" && source.language.trim().length > 0
				? source.language
				: "en-US";
		const defaultEngine = source?.engine === "standard" ? "standard" : "neural";
		const sourceProviderOptions = (source?.providerOptions || {}) as Record<string, unknown>;
		mathTokenHighlighting = source?.mathTokenHighlighting !== false;
		const runtimeForSpeed = resolveTTSRuntimeSettings(
			source && typeof source === "object" ? (source as Record<string, unknown>) : undefined,
		);
		layoutMode = runtimeForSpeed.layoutMode;
		preservedObjectSpeedOptions = undefined;
		preservedObjectSpeedOptionsText = "";
		if (runtimeForSpeed.speedOptions === undefined) {
			speedOptionsText = formatTTSSpeedOptionsAsText(INLINE_SPEED_DEFAULT_RATES);
		} else if (
			Array.isArray(runtimeForSpeed.speedOptions) &&
			runtimeForSpeed.speedOptions.length === 0
		) {
			speedOptionsText = "";
		} else {
			const normalizedSpeedOptions = normalizeTTSSpeedControlOptions(
				runtimeForSpeed.speedOptions,
			);
			const speedOptionRates = normalizedSpeedOptions.map(getSpeedOptionRate);
			speedOptionsText = formatTTSSpeedOptionsAsText(speedOptionRates);
			if (normalizedSpeedOptions.some((option) => typeof option !== "number")) {
				preservedObjectSpeedOptions = normalizedSpeedOptions;
				preservedObjectSpeedOptionsText = speedOptionsText;
			}
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

		browserVoice = sourceTab === "browser" ? defaultVoice : "";
		browserRate = defaultRate;
		browserPitch = defaultPitch;

		pollyApiEndpoint = defaultPollyEndpoint;
		pollyLanguage = defaultLanguage;
		pollyEngine = defaultEngine;
		pollySampleRate = defaultSampleRate;
		pollyFormat = defaultFormat;
		pollySpeechMarksMode = defaultSpeechMarksMode;
		pollyVoice = sourceTab === "polly" ? defaultVoice : "";
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
		googleVoice = sourceTab === "google" ? defaultVoice : "";
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
		if (!sameRecordEntries(customProviderStateById, nextState)) {
			customProviderStateById = nextState;
		}
		if (!sameRecordEntries(customProviderAvailabilityById, nextAvailability)) {
			customProviderAvailabilityById = nextAvailability;
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
				throw new Error(interfaceI18n.t("debug.tts.webSpeechUnavailable"));
			}

			const synth = window.speechSynthesis;
			let voices = synth.getVoices();
			if (!voices.length) {
				await waitForBrowserVoices(synth, 1200);
				voices = synth.getVoices();
			}

			const mappedVoices = voices.map((voice) => ({
				id: voice.voiceURI || voice.name,
				voiceURI: voice.voiceURI,
				name: voice.name,
				lang: voice.lang,
				localService: voice.localService,
				default: voice.default
			}));
			const configuredVoice = browserVoice
				? findBrowserVoice(mappedVoices, browserVoice)
				: null;
			if (configuredVoice) {
				browserVoice = voiceIdentity(configuredVoice);
			}
			browserState = {
				checked: true,
				loading: false,
				available: true,
				message: voices.length
					? (interfaceI18n.plural?.("debug.tts.browserAvailable", { count: voices.length }) ?? "")
					: interfaceI18n.t("debug.tts.browserNoVoices"),
				detail: null,
				voices: mappedVoices
			};
		} catch (error) {
			browserState = {
				checked: true,
				loading: false,
				available: false,
				message: interfaceI18n.t("debug.tts.browserUnavailable"),
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

	async function fetchServerVoices(url: URL): Promise<DemoVoice[]> {
		const response = await fetch(url.toString());
		const payload = await readJsonSafe(response);
		if (!response.ok) {
			throw new Error(
				interfaceI18n.t("debug.tts.httpError", {
					status: response.status,
					message:
						payload?.error || payload?.message || interfaceI18n.t("debug.tts.unknownError"),
				})
			);
		}
		return Array.isArray(payload?.voices) ? payload.voices : [];
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
			const voices = await fetchServerVoices(buildPollyVoicesUrl());
			pollyVoice = knownVoice(pollyVoice, voices) ?? "";
			pollyState = {
				checked: true,
				loading: false,
				available: true,
				message:
					interfaceI18n.plural?.("debug.tts.pollyAvailable", {
						count: voices.length,
						engine: interfaceI18n.t(
							pollyEngine === "standard" ? "debug.tts.standard" : "debug.tts.neural"
						),
					}) ?? "",
				detail: null,
				voices
			};
		} catch (error) {
			pollyState = {
				checked: true,
				loading: false,
				available: false,
				message: interfaceI18n.t("debug.tts.pollyUnavailable"),
				detail: error instanceof Error ? error.message : String(error),
				voices: []
			};
		}
	}

	async function checkGoogleAvailability() {
		googleState = { ...googleState, checked: true, loading: true, message: null, detail: null };
		try {
			const voices = await fetchServerVoices(buildGoogleVoicesUrl());
			googleVoice = knownVoice(googleVoice, voices) ?? "";
			googleState = {
				checked: true,
				loading: false,
				available: true,
				message:
					interfaceI18n.plural?.("debug.tts.googleAvailable", { count: voices.length }) ?? "",
				detail: null,
				voices
			};
		} catch (error) {
			googleState = {
				checked: true,
				loading: false,
				available: false,
				message: interfaceI18n.t("debug.tts.googleUnavailable"),
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
				message: interfaceI18n.t("debug.tts.providerNotChecked"),
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

	/** The voice a backend applies and previews; none leaves the choice to the server. */
	function resolveVoiceForBackend(backend: BuiltInBackendTab): string | undefined {
		if (backend === "browser") return browserVoice || undefined;
		if (backend === "polly") return knownVoice(pollyVoice, pollyState.voices);
		return knownVoice(googleVoice, googleState.voices);
	}

	function normalizeApiEndpoint(endpoint: string, fallback = DEFAULT_API_ENDPOINT): string {
		const trimmed = endpoint.trim();
		if (!trimmed) return fallback;
		return trimmed.replace(/\/synthesize\/?$/i, "");
	}

	function getDefaultApiEndpoint(): string {
		return normalizeApiEndpoint(apiEndpoint || DEFAULT_API_ENDPOINT);
	}

	/**
	 * Fallback sample when the preview box is empty.
	 *
	 * Deliberately not localized, and deliberately the same source the box is
	 * prefilled from: this text is handed to a TTS voice, so its language has to
	 * follow the voice being previewed, not the interface locale. Dutch chrome
	 * previewing an English Polly voice must still send English, or the preview
	 * measures the wrong thing.
	 */
	function getSampleText(tab: BackendTab): string {
		return DEFAULT_PREVIEW_TEXT[tab];
	}

	function stopPreviewPolling() {
		if (previewPollingTimer !== null && typeof window !== "undefined") {
			window.clearInterval(previewPollingTimer);
		}
		previewPollingTimer = null;
	}

	function clearPreviewTracking() {
		stopPreviewPolling();
		previewTrackIndex = -1;
		previewTrackLength = 0;
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
			// Sample text, unlocalized like `DEFAULT_PREVIEW_TEXT`: see `getSampleText`.
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
		setPreviewTextForCurrentTab();
	}

	function updateTrackingFromSpeechMarks(
		audio: HTMLAudioElement,
		speechMarks: PreviewSpeechMark[]
	) {
		stopPreviewPolling();
		const orderedMarks = [...speechMarks].sort(compareSpeechMarks);
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

	/** Ends the current preview run, which then settles without reporting an error. */
	function stopPreview() {
		previewRunId += 1;
		settlePreviewAudio?.();
		releaseBrowserPreview();
		clearPreviewTracking();
		previewError = null;
		previewNote = null;
		isPreviewing = false;
		previewBackend = null;
	}

	function normalizePreviewSpeechMarks(
		speechMarks: PreviewSpeechMark[],
		audioDurationSeconds: number
	): PreviewSpeechMark[] {
		if (speechMarks.length === 0) return speechMarks;
		const ordered = [...speechMarks].sort(compareSpeechMarks);
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
		const ordered = [...speechMarks].sort(compareSpeechMarks);
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

	/**
	 * Plays `audio` to its end, and fails when the audio does. `release` runs once
	 * the audio settles: on its end, its failure, or `stopPreview`, which settles
	 * it without an error.
	 */
	function playPreviewAudio(audio: HTMLAudioElement, release: () => void = () => {}): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let settled = false;
			const settle = (error?: Error) => {
				if (settled) return;
				settled = true;
				audio.onended = null;
				audio.onerror = null;
				audio.pause();
				stopPreviewPolling();
				if (settlePreviewAudio === stop) settlePreviewAudio = null;
				release();
				if (error) reject(error);
				else resolve();
			};
			const stop = () => settle();
			settlePreviewAudio = stop;
			audio.onended = stop;
			audio.onerror = () => settle(new Error(interfaceI18n.t("debug.tts.previewFailed")));
			audio.play().catch((error: unknown) => {
				settle(error instanceof Error ? error : new Error(String(error)));
			});
		});
	}

	/** Resolves once `audio` knows its duration, fails to load, or 1.2 s pass. */
	function waitForAudioMetadata(audio: HTMLAudioElement): Promise<void> {
		return new Promise<void>((resolve) => {
			if (Number.isFinite(audio.duration) && audio.duration > 0) {
				resolve();
				return;
			}
			const finish = () => {
				audio.removeEventListener("loadedmetadata", finish);
				audio.removeEventListener("error", finish);
				window.clearTimeout(timeout);
				resolve();
			};
			audio.addEventListener("loadedmetadata", finish);
			audio.addEventListener("error", finish);
			const timeout = window.setTimeout(finish, 1200);
		});
	}

	async function playPreviewAudioFromUrl(
		audioUrl: string,
		speechMarks: PreviewSpeechMark[],
		runId: number
	): Promise<void> {
		const audio = new Audio(audioUrl);
		if (speechMarks.length > 0) {
			await waitForAudioMetadata(audio);
			if (runId !== previewRunId) return;
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
		await playPreviewAudio(audio);
	}

	async function previewServerVoice(provider: "polly" | "google", runId: number) {
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
			voice: resolveVoiceForBackend(provider),
			includeSpeechMarks
		};
		if (provider === "polly") {
			requestBody.engine = pollyEngine;
			requestBody.sampleRate = normalizePollySampleRate(pollySampleRate);
			requestBody.format = pollyFormat;
			requestBody.speechMarkTypes = getPollySpeechMarkTypes();
		}
		const response = await fetch(`${endpoint}/synthesize`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(requestBody)
		});
		const payload = (await readJsonSafe(response)) as SynthesizeResponse;
		if (runId !== previewRunId) return;
		if (!response.ok) {
			const failure = payload as { message?: string; error?: string } | null;
			throw new Error(
				failure?.message ||
					failure?.error ||
					interfaceI18n.t("debug.tts.previewRequestFailed", { status: response.status })
			);
		}

		const audioBase64 = payload?.audio;
		const contentType = payload?.contentType || "audio/mpeg";
		if (!audioBase64 || typeof audioBase64 !== "string") {
			throw new Error(interfaceI18n.t("debug.tts.previewNoAudio"));
		}
		const byteChars = atob(audioBase64);
		const byteNumbers = new Array(byteChars.length);
		for (let i = 0; i < byteChars.length; i += 1) {
			byteNumbers[i] = byteChars.charCodeAt(i);
		}
		const blob = new Blob([new Uint8Array(byteNumbers)], { type: contentType });
		const objectUrl = URL.createObjectURL(blob);
		const audio = new Audio(objectUrl);
		const speechMarks = Array.isArray(payload?.speechMarks) ? payload.speechMarks : [];
		if (includeSpeechMarks && speechMarks.length > 0) {
			updateTrackingFromSpeechMarks(audio, speechMarks);
		}
		await playPreviewAudio(audio, () => URL.revokeObjectURL(objectUrl));
	}

	function releaseBrowserPreview() {
		browserPreviewService?.dispose();
		browserPreviewService = null;
		browserPreviewHost?.remove();
		browserPreviewHost = null;
	}

	// The preview's word highlight is the tracked span of the preview text.
	function trackPreviewWords(): Parameters<TTSService["setHighlightCoordinator"]>[0] {
		const ignore = () => {};
		return {
			highlightTTSWord: (ranges: Range[]) => {
				const range = ranges[0];
				if (!range) return;
				previewTrackIndex = range.startOffset;
				previewTrackLength = Math.max(1, range.endOffset - range.startOffset);
			},
			highlightTTSWordElement: ignore,
			highlightTTSSentence: ignore,
			highlightTTSSentenceElements: ignore,
			clearTTS: ignore,
			clearTTSWord: ignore,
		} as unknown as Parameters<TTSService["setHighlightCoordinator"]>[0];
	}

	/**
	 * Reads the preview text with the draft browser voice through a TTS service
	 * of its own. The browser has one speech queue, so the toolkit's read stops
	 * first through its own service.
	 */
	async function previewBrowserVoice(runId: number) {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) {
			throw new Error(interfaceI18n.t("debug.tts.browserSynthesisUnavailable"));
		}
		if (previewMode === "ssml") {
			throw new Error(interfaceI18n.t("debug.tts.ssmlPreviewUnsupported"));
		}
		const service = new TTSService();
		const host = document.createElement("div");
		host.setAttribute("style", "position:fixed;left:-10000px;top:0;width:20em;");
		host.textContent = previewText.trim() ? previewText : getSampleText("browser");
		document.body.append(host);
		browserPreviewService = service;
		browserPreviewHost = host;
		service.setHighlightCoordinator(trackPreviewWords());
		// Playback start highlights the first word, ahead of its first boundary.
		service.onStateChange((state) => {
			if (state !== PlaybackState.PLAYING || previewTrackIndex >= 0) return;
			const firstWord = /\S+/.exec(host.textContent || "");
			if (!firstWord) return;
			previewTrackIndex = firstWord.index;
			previewTrackLength = firstWord[0].length;
		});
		try {
			await service.initialize(new BrowserTTSProvider(), {
				voice: browserVoice || undefined,
				rate: normalizeRate(browserRate),
				pitch: normalizePitch(browserPitch),
				// The browser provider reports word boundaries only in word mode.
				providerOptions: { highlightMode: "word" },
			});
			if (runId !== previewRunId) return;
			debugPreview("browser:speak", { voice: browserVoice || "(default)" });
			await service.speak(host, { language: contentLanguage });
		} finally {
			if (browserPreviewService === service) releaseBrowserPreview();
		}
	}

	async function previewSelectedVoice() {
		if (isPreviewing && previewBackend === activeTab) {
			stopPreview();
			return;
		}
		previewError = null;
		previewNote = null;
		const activeState = getActiveState();
		if (!activeState.available) {
			previewError = interfaceI18n.t("debug.tts.previewUnavailable");
			return;
		}
		const activePreviewText = typeof previewText === "string" ? previewText : "";
		if (!activePreviewText.trim()) {
			if (isBuiltInTab(activeTab)) {
				previewError = interfaceI18n.t("debug.tts.previewEnterText");
				return;
			}
		}
		if (activeTab === "browser" && previewMode === "ssml") {
			previewError = interfaceI18n.t("debug.tts.ssmlPreviewUnsupported");
			return;
		}
		stopPreview();
		const runId = previewRunId;
		// The toolkit reader and the preview share one audio output: silence the
		// reader now, and end the preview when the reader starts again.
		const toolkitTts = toolkitCoordinator?.ttsService;
		toolkitTts?.stop();
		const unsubscribeToolkitTts = toolkitTts?.onStateChange((state) => {
			if (state !== PlaybackState.IDLE && runId === previewRunId) stopPreview();
		});
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
				if (runId !== previewRunId) return;
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
					await playPreviewAudioFromUrl(customResult.audioUrl, speechMarks, runId);
				}
			} else if (activeTab === "browser") {
				await previewBrowserVoice(runId);
			} else if (activeTab === "polly") {
				if (previewMode === "ssml") {
					previewNote =
						interfaceI18n.t("debug.tts.pollySsmlHint");
				}
				await previewServerVoice("polly", runId);
			} else {
				if (previewMode === "ssml") {
					previewNote =
						interfaceI18n.t("debug.tts.ssmlWordTrackingDisabled");
				}
				await previewServerVoice("google", runId);
			}
		} catch (error) {
			if (runId === previewRunId) {
				previewError = error instanceof Error ? error.message : String(error);
			}
		} finally {
			unsubscribeToolkitTts?.();
			if (runId === previewRunId) {
				clearPreviewTracking();
				isPreviewing = false;
				previewBackend = null;
			}
		}
	}

	// An apply replaces every backend field, because the coordinator merges a
	// config update shallowly over the one in place.
	const BACKEND_CONFIG_FIELDS = {
		serverProvider: undefined,
		apiEndpoint: undefined,
		transportMode: undefined,
		endpointMode: undefined,
		endpointValidationMode: undefined,
		includeAuthOnAssetFetch: undefined,
		cache: undefined,
		speedRate: undefined,
		lang_id: undefined,
		language: undefined,
		defaultVoice: undefined,
		rate: undefined,
		pitch: undefined,
		engine: undefined,
		sampleRate: undefined,
		format: undefined,
		speechMarksMode: undefined,
	};
	const BACKEND_PROVIDER_OPTIONS = [
		"engine",
		"sampleRate",
		"format",
		"speechMarkTypes",
		"cache",
		"speedRate",
		"lang_id",
	];

	/** The applied provider options a backend does not own, plus `own`. */
	function backendProviderOptions(
		own: Record<string, unknown> = {}
	): Record<string, unknown> {
		const current = toolkitCoordinator?.getToolConfig("textToSpeech")?.providerOptions;
		const shared = Object.fromEntries(
			Object.entries(current && typeof current === "object" ? current : {}).filter(
				([key]) => !BACKEND_PROVIDER_OPTIONS.includes(key)
			)
		);
		return { ...shared, ...own };
	}

	/** The config a tab owns, before backend resets and shared options. */
	async function buildTabConfig(tab: BackendTab): Promise<Record<string, unknown>> {
		if (tab === "browser") {
			return {
				backend: "browser",
				defaultVoice: resolveVoiceForBackend("browser"),
				rate: normalizeRate(browserRate),
				pitch: normalizePitch(browserPitch),
				transportMode: "pie",
			};
		}
		if (tab === "polly") {
			return {
				backend: "server",
				serverProvider: "polly",
				apiEndpoint: normalizeApiEndpoint(pollyApiEndpoint, getDefaultApiEndpoint()),
				transportMode: "pie",
				endpointMode: "synthesizePath",
				endpointValidationMode: "voices",
				defaultVoice: resolveVoiceForBackend("polly"),
				rate: normalizeRate(pollyRate),
				language: pollyLanguage || undefined,
				engine: pollyEngine,
				sampleRate: normalizePollySampleRate(pollySampleRate),
				format: pollyFormat,
				speechMarksMode: pollySpeechMarksMode,
				providerOptions: { speechMarkTypes: getPollySpeechMarkTypes() },
			};
		}
		if (tab === "google") {
			return {
				backend: "server",
				serverProvider: "google",
				apiEndpoint: normalizeApiEndpoint(googleApiEndpoint, getDefaultApiEndpoint()),
				transportMode: "pie",
				endpointMode: "synthesizePath",
				endpointValidationMode: "voices",
				defaultVoice: resolveVoiceForBackend("google"),
				rate: normalizeRate(googleRate),
				language: googleLanguage || undefined,
			};
		}
		const provider = getCustomProviderOrThrow(tab);
		const result = await provider.buildApplyConfig(createProviderContext(provider.id));
		if (!result?.config) {
			throw new Error(interfaceI18n.t("debug.tts.customProviderNoConfig", { id: provider.id }));
		}
		return result.config;
	}

	/**
	 * What applying `tab` sends the coordinator, and what the panel stores to
	 * restore it. The stored record leaves out provider options the tab does not
	 * own, and adds the panel-only Google voice-list filters.
	 */
	async function buildApplyPayload(tab: BackendTab): Promise<{
		applied: Partial<TextToSpeechToolProviderConfig>;
		persisted: PersistedTTSSettings;
	}> {
		const config = await buildTabConfig(tab);
		const shared = {
			layoutMode,
			speedOptions: resolveAppliedSpeedOptions(),
			mathTokenHighlighting,
		};
		const applied = {
			enabled: true,
			...BACKEND_CONFIG_FIELDS,
			...config,
			providerOptions: backendProviderOptions(
				config.providerOptions as Record<string, unknown> | undefined
			),
			...shared,
		} as Partial<TextToSpeechToolProviderConfig>;
		const persisted: PersistedTTSSettings = {
			...config,
			...shared,
			tab,
			...(tab === "google" ? { googleVoiceType, googleGender } : {}),
		};
		return { applied, persisted };
	}

	async function applySettings() {
		applyError = null;
		const activeState = getActiveState();
		if (!activeState.available) {
			applyError = interfaceI18n.t("debug.tts.applyUnavailable");
			return;
		}
		if (!toolkitCoordinator) {
			applyError = interfaceI18n.t("debug.tts.coordinatorUnavailable");
			return;
		}

		isApplying = true;
		try {
			const { applied, persisted } = await buildApplyPayload(activeTab);
			toolkitCoordinator.updateToolConfig("textToSpeech", applied);
			persistSettings(persisted);
			// The update reconfigures the reader without starting it; readiness
			// surfaces a backend that fails to start before the panel closes.
			await toolkitCoordinator.ensureTTSReady();
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
		cleanupFocusTrap = createFocusTrap(dialogEl, {
			initialFocus: closeButtonEl,
			onEscape: requestClose
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

	onDestroy(() => {
		cleanupFocusTrap?.();
		cleanupFocusTrap = null;
		stopPreview();
	});
	let contextAnchor = $state<HTMLDivElement | null>(null);
	let chromeRuntimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	// Interface locale, re-derived on every context republish.
	const interfaceI18n = $derived(resolveInterfaceI18n(chromeRuntimeContext));
	// The language browser voices are picked for, as the toolkit's reader picks them.
	const contentLanguage = $derived(chromeRuntimeContext?.contentLanguage);
	$effect(() => {
		if (!contextAnchor) return;
		return connectToolRuntimeContext(contextAnchor, (value) => {
			chromeRuntimeContext = value;
		});
	});

</script>

<!-- Context anchor: the panel resolves the toolkit runtime context from here,
     which is how it reaches the published interface-locale provider. -->
<div bind:this={contextAnchor} style="display: none;" aria-hidden="true"></div>

<div
	class="pie-tts-dialog-backdrop"
	style="z-index: {TTS_MODAL_Z_INDEX};"
	lang={interfaceI18n.getLocale()}
	dir={interfaceI18n.getDirection?.() ?? 'ltr'}
>
	<div
		class="pie-tts-dialog"
		bind:this={dialogEl}
		role="dialog"
		aria-modal="true"
		aria-labelledby="pie-tts-dialog-title"
		tabindex="-1"
	>
		<div class="pie-tts-dialog-header">
			<h3 id="pie-tts-dialog-title" class="pie-tts-dialog-title">{interfaceI18n.t("debug.tts.title")}</h3>
			<button
				class="btn btn-xs btn-ghost btn-circle"
				bind:this={closeButtonEl}
				type="button"
				onclick={requestClose}
				aria-label={interfaceI18n.t("debug.tts.closeA11y")}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="pie-tts-dialog-close-icon"
					width="12"
					height="12"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="pie-tts-fieldset fieldset bg-base-200 border border-base-300 rounded-box">
			<div class="pie-tts-field">
				<label class="pie-tts-label" for="tts-layout-mode">{interfaceI18n.t("debug.tts.toolbarLayoutMode")}</label>
				<select
					id="tts-layout-mode"
					class="select select-sm select-bordered w-full"
					bind:value={layoutMode}
				>
					<option value="reserved-row">{interfaceI18n.t("debug.tts.reservedRow")}</option>
					<option value="expanding-row">{interfaceI18n.t("debug.tts.expandingRow")}</option>
					<option value="floating-overlay">{interfaceI18n.t("debug.tts.floatingOverlay")}</option>
					<option value="left-aligned">{interfaceI18n.t("debug.tts.leftAlignedControls")}</option>
				</select>
				<div class="text-xs opacity-75">
					{interfaceI18n.t("debug.tts.headerRowReservation", {
						state: layoutModeReservesRow
							? interfaceI18n.t("common.enabled")
							: interfaceI18n.t("common.disabled"),
					})}
				</div>
			</div>
			<div class="pie-tts-field">
				<label class="pie-tts-label" for="tts-inline-speed-options">{interfaceI18n.t("debug.tts.inlineSpeedButtons")}</label>
				<input
					id="tts-inline-speed-options"
					class="input input-sm input-bordered w-full"
					bind:value={speedOptionsText}
					placeholder="0.8, 1, 1.25"
					autocomplete="off"
				/>
				<div class="mt-1 flex flex-wrap items-center gap-2">
					<span class="text-xs opacity-75">
						{interfaceI18n.t("debug.tts.speedOptionsHelp")}
					</span>
					<button
						type="button"
						class="btn btn-xs btn-ghost"
						onclick={resetInlineSpeedOptionsToDefaults}
					>
						{interfaceI18n.t("debug.tts.resetToDefaults")}
					</button>
				</div>
			</div>
			<div class="pie-tts-field">
				<label class="pie-tts-label" for="tts-math-token-highlighting">{interfaceI18n.t("debug.tts.mathHighlighting")}</label>
				<div class="pie-tts-toggle-row">
					<input
						id="tts-math-token-highlighting"
						type="checkbox"
						class="toggle toggle-sm"
						bind:checked={mathTokenHighlighting}
					/>
					<span class="text-xs opacity-75">
						{mathTokenHighlighting
							? interfaceI18n.t("debug.tts.mathHighlightParts")
							: interfaceI18n.t("debug.tts.mathHighlightBlock")}
					</span>
				</div>
			</div>
		</div>

		<div class="join pie-tts-tabs">
			{#each providerTabs as provider}
				<button
					class="btn btn-sm join-item"
					class:btn-active={activeTab === provider.id}
					aria-pressed={activeTab === provider.id}
					onclick={() => setActiveTab(provider.id)}
				>
					{provider.label}
				</button>
			{/each}
		</div>

		<div class="pie-tts-status">
			{#if getActiveState().loading}
				<span class="loading loading-spinner loading-xs"></span>
				<span>{interfaceI18n.t("debug.tts.checkingAvailability")}</span>
			{:else if getActiveState().checked}
				<span class={getActiveState().available ? "pie-tts-ok" : "pie-tts-error"}>
					{getActiveState().message}
				</span>
			{/if}
			<button class="btn btn-xs btn-outline" onclick={() => void checkActiveTabAvailability()}>
				{interfaceI18n.t("debug.tts.recheck")}
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
					<label class="pie-tts-label" for="tts-browser-voice">{interfaceI18n.t("debug.tts.voice")}</label>
					<select
						id="tts-browser-voice"
						class="select select-sm select-bordered w-full"
						bind:value={browserVoice}
						aria-describedby="tts-browser-auto-voice"
					>
						<option value="">{interfaceI18n.t("debug.tts.bestAvailableVoice")}</option>
						{#if recommendedBrowserVoices.length > 0}
							<optgroup label={interfaceI18n.t("debug.tts.recommendedVoices")}>
								{#each recommendedBrowserVoices as voice}
									<option value={voiceIdentity(voice)}>{browserVoiceLabel(voice)}</option>
								{/each}
							</optgroup>
						{/if}
						{#if allBrowserVoices.length > 0}
							<optgroup label={interfaceI18n.t("debug.tts.allVoices")}>
								{#each allBrowserVoices as voice}
									<option value={voiceIdentity(voice)}>{browserVoiceLabel(voice)}</option>
								{/each}
							</optgroup>
						{/if}
					</select>
					<div
						id="tts-browser-auto-voice"
						class="pie-tts-browser-auto-voice text-xs opacity-75"
						aria-live="polite"
					>
						{#if browserVoice}
							{interfaceI18n.t("debug.tts.usingSelectedVoice", {
								voice: resolvedBrowserVoice ? browserVoiceLabel(resolvedBrowserVoice) : browserVoice,
							})}
						{:else if resolvedBrowserVoice}
							{interfaceI18n.t("debug.tts.autoVoice", { voice: browserVoiceLabel(resolvedBrowserVoice) })}
						{:else}
							{interfaceI18n.t("debug.tts.autoVoiceWaiting")}
						{/if}
					</div>
				</div>
			</fieldset>
		{:else if activeTab === "polly"}
			<fieldset class="pie-tts-fieldset fieldset bg-base-200 border border-base-300 rounded-box" disabled={!pollyState.available}>
				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-polly-endpoint">{interfaceI18n.t("debug.tts.apiEndpoint")}</label>
					<input id="tts-polly-endpoint" class="input input-sm input-bordered w-full" bind:value={pollyApiEndpoint} placeholder="/api/tts" />
				</div>

				<div class="pie-tts-grid-3">
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-language">{interfaceI18n.t("common.language")}</label>
						<input
							id="tts-polly-language"
							class="input input-sm input-bordered w-full"
							bind:value={pollyLanguage}
							placeholder="en-US"
							onchange={refreshPollyVoices}
						/>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-gender">{interfaceI18n.t("debug.tts.gender")}</label>
						<select
							id="tts-polly-gender"
							class="select select-sm select-bordered w-full"
							bind:value={pollyGender}
							onchange={refreshPollyVoices}
						>
							<option value="">{interfaceI18n.t("debug.tts.any")}</option>
							<option value="male">{interfaceI18n.t("debug.tts.male")}</option>
							<option value="female">{interfaceI18n.t("debug.tts.female")}</option>
							<option value="neutral">{interfaceI18n.t("debug.tts.neutral")}</option>
						</select>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-engine">{interfaceI18n.t("debug.tts.engine")}</label>
						<select
							id="tts-polly-engine"
							class="select select-sm select-bordered w-full"
							bind:value={pollyEngine}
							onchange={refreshPollyVoices}
						>
							<option value="neural">{interfaceI18n.t("debug.tts.neural")}</option>
							<option value="standard">{interfaceI18n.t("debug.tts.standard")}</option>
						</select>
					</div>
				</div>

				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-polly-voice">{interfaceI18n.t("debug.tts.voice")}</label>
					<select id="tts-polly-voice" class="select select-sm select-bordered w-full" bind:value={pollyVoice}>
						<option value="">{interfaceI18n.t("debug.tts.providerDefault")}</option>
						{#each pollyState.voices as voice}
							<option value={voiceIdentity(voice)}>{voice.name || voice.id} ({voice.languageCode || interfaceI18n.t("debug.tts.notAvailable")})</option>
						{/each}
					</select>
				</div>

				<div class="pie-tts-grid-3">
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-format">{interfaceI18n.t("debug.tts.format")}</label>
						<select id="tts-polly-format" class="select select-sm select-bordered w-full" bind:value={pollyFormat}>
							<option value="mp3">MP3</option>
							<option value="ogg">OGG</option>
							<option value="pcm">PCM</option>
						</select>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-sample-rate">{interfaceI18n.t("debug.tts.sampleRate")}</label>
						<select id="tts-polly-sample-rate" class="select select-sm select-bordered w-full" bind:value={pollySampleRate}>
							<option value={8000}>8000 Hz</option>
							<option value={16000}>16000 Hz</option>
							<option value={22050}>22050 Hz</option>
							<option value={24000}>24000 Hz</option>
						</select>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-polly-speech-marks">{interfaceI18n.t("debug.tts.speechMarks")}</label>
						<select id="tts-polly-speech-marks" class="select select-sm select-bordered w-full" bind:value={pollySpeechMarksMode}>
							<option value="word">{interfaceI18n.t("debug.tts.word")}</option>
							<option value="word+sentence">{interfaceI18n.t("debug.tts.wordAndSentence")}</option>
						</select>
					</div>
				</div>
			</fieldset>
		{:else if activeTab === "google"}
			<fieldset class="pie-tts-fieldset fieldset bg-base-200 border border-base-300 rounded-box" disabled={!googleState.available}>
				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-google-endpoint">{interfaceI18n.t("debug.tts.apiEndpoint")}</label>
					<input id="tts-google-endpoint" class="input input-sm input-bordered w-full" bind:value={googleApiEndpoint} placeholder="/api/tts" />
				</div>

				<div class="pie-tts-grid-3">
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-google-language">{interfaceI18n.t("common.language")}</label>
						<input
							id="tts-google-language"
							class="input input-sm input-bordered w-full"
							bind:value={googleLanguage}
							placeholder="en-US"
							onchange={refreshGoogleVoices}
						/>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-google-gender">{interfaceI18n.t("debug.tts.gender")}</label>
						<select
							id="tts-google-gender"
							class="select select-sm select-bordered w-full"
							bind:value={googleGender}
							onchange={refreshGoogleVoices}
						>
							<option value="">{interfaceI18n.t("debug.tts.any")}</option>
							<option value="male">{interfaceI18n.t("debug.tts.male")}</option>
							<option value="female">{interfaceI18n.t("debug.tts.female")}</option>
							<option value="neutral">{interfaceI18n.t("debug.tts.neutral")}</option>
						</select>
					</div>
					<div class="pie-tts-field">
						<label class="pie-tts-label" for="tts-google-voice-type">{interfaceI18n.t("debug.tts.voiceType")}</label>
						<select
							id="tts-google-voice-type"
							class="select select-sm select-bordered w-full"
							bind:value={googleVoiceType}
							onchange={refreshGoogleVoices}
						>
							<option value="wavenet">{interfaceI18n.t("debug.tts.wavenetVoiceType")}</option>
							<option value="studio">{interfaceI18n.t("debug.tts.studioVoiceType")}</option>
							<option value="standard">{interfaceI18n.t("debug.tts.standard")}</option>
						</select>
					</div>
				</div>

				<div class="pie-tts-field">
					<label class="pie-tts-label" for="tts-google-voice">{interfaceI18n.t("debug.tts.voice")}</label>
					<select id="tts-google-voice" class="select select-sm select-bordered w-full" bind:value={googleVoice}>
						<option value="">{interfaceI18n.t("debug.tts.providerDefault")}</option>
						{#each googleState.voices as voice}
							<option value={voiceIdentity(voice)}>{voice.name || voice.id} ({voice.languageCode || interfaceI18n.t("debug.tts.notAvailable")})</option>
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
			</fieldset>
		{/if}

		<div class="pie-tts-fieldset pie-tts-preview-block fieldset bg-base-200 border border-base-300 rounded-box">
			<div class="pie-tts-preview-header">
				<h4 class="pie-tts-preview-title">{interfaceI18n.t("common.preview")}</h4>
				<div class="join">
					<button
						type="button"
						class="btn btn-xs join-item"
						class:btn-active={previewMode === "plain"}
						aria-pressed={previewMode === "plain"}
						onclick={() => onPreviewModeChange("plain")}
					>
						{interfaceI18n.t("debug.tts.plainText")}
					</button>
					<button
						type="button"
						class="btn btn-xs join-item"
						class:btn-active={previewMode === "ssml"}
						aria-pressed={previewMode === "ssml"}
						onclick={() => onPreviewModeChange("ssml")}
					>
						SSML
					</button>
				</div>
			</div>
			<label class="pie-tts-label" for="tts-preview-text">{interfaceI18n.t("debug.tts.sampleText")}</label>
			<textarea
				id="tts-preview-text"
				class="textarea textarea-sm textarea-bordered w-full pie-tts-preview-input"
				bind:value={previewText}
			></textarea>
			<div class="pie-tts-preview-row">
				<button type="button" class="btn btn-xs btn-outline" onclick={setPreviewTextForCurrentTab}>
					{interfaceI18n.t("debug.tts.resetSample")}
				</button>
				<span class="text-xs opacity-70">
					{#if activeTab === "browser" && previewMode === "ssml"}
						{interfaceI18n.t("debug.tts.previewHintBrowserSsml")}
					{:else if activeTab === "google" && previewMode === "ssml"}
						{interfaceI18n.t("debug.tts.previewHintGoogleSsml")}
					{:else if !isBuiltInTab(activeTab)}
						{interfaceI18n.t("debug.tts.previewHintCustom")}
					{:else}
						{interfaceI18n.t("debug.tts.previewHintTracking")}
					{/if}
				</span>
			</div>
			<div class="pie-tts-preview-track" aria-hidden="true">
				{#each getTrackingSegments(previewText) as segment}
					<span class:pie-tts-preview-active={segment.active}>{segment.text}</span>
				{/each}
			</div>
		</div>

		{#if applyError}
			<div class="alert alert-error text-xs" role="alert"><span>{applyError}</span></div>
		{/if}
		{#if previewError}
			<div class="alert alert-error text-xs" role="alert"><span>{previewError}</span></div>
		{/if}
		{#if previewNote}
			<div class="alert alert-info text-xs" role="status"><span>{previewNote}</span></div>
		{/if}

		<div class="pie-tts-actions">
			<button class="btn btn-sm btn-outline" onclick={requestClose}>{interfaceI18n.t("common.close")}</button>
			<button
				class="btn btn-sm btn-outline"
				disabled={!getActiveState().available || isApplying || !canPreviewActiveTab()}
				onclick={() => void previewSelectedVoice()}
			>
				{isPreviewing && previewBackend === activeTab ? interfaceI18n.t("debug.tts.stopPreview") : interfaceI18n.t("debug.tts.previewVoice")}
			</button>
			<button class="btn btn-sm btn-primary" disabled={isApplying || !getActiveState().available} onclick={() => void applySettings()}>
				{isApplying ? interfaceI18n.t("debug.tts.applying") : interfaceI18n.t("common.apply")}
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
		/* A modal surface has to be opaque, so the recessed pair rather than
		   `--pie-background`, which the light Base Theme leaves transparent. */
		background: var(--pie-background-dark, #ecedf1);
		color: var(--pie-text, #111827);
		border: 1px solid var(--pie-border, #8f8f8f);
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

	.pie-tts-dialog-close-icon {
		display: block;
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
		color: var(--pie-correct, #208537);
	}

	.pie-tts-error {
		color: var(--pie-incorrect, #a65f00);
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

	.pie-tts-toggle-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
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
		border: 1px dashed var(--pie-border, #8f8f8f);
		border-radius: 0.5rem;
		padding: 0.4rem 0.5rem;
		min-height: 2.6rem;
		white-space: pre-wrap;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	/*
	 * The spoken-word highlight. `--pie-missing` is the warning colour in this
	 * contract, and the share stays a mix so the ink underneath still shows through
	 * -- the highlight marks position, it does not carry the text.
	 */
	.pie-tts-preview-active {
		background: color-mix(in srgb, var(--pie-missing, #d32f2f) 40%, transparent);
		border-radius: 0.15rem;
	}
</style>
