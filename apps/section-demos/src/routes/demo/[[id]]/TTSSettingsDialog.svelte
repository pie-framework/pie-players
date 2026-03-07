<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	type BackendTab = 'browser' | 'polly' | 'google';
	type PreviewMode = 'plain' | 'ssml';
	type PollyFormat = 'mp3' | 'ogg' | 'pcm';
	type PollySpeechMarksMode = 'word' | 'word+sentence';

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

	interface Props {
		toolkitCoordinator: any;
		onClose?: () => void;
	}

	let { toolkitCoordinator, onClose = () => {} }: Props = $props();

	const DEFAULT_API_ENDPOINT = '/api/tts';
	const TTS_SETTINGS_STORAGE_KEY = 'pie:section-demos:tts-settings';

	type PersistedTTSSettings = {
		backend?: BackendTab;
		apiEndpoint?: string;
		defaultVoice?: string;
		rate?: number;
		pitch?: number;
		language?: string;
		engine?: 'standard' | 'neural';
		sampleRate?: number;
		format?: PollyFormat;
		speechMarksMode?: PollySpeechMarksMode;
		googleVoiceType?: string;
		googleGender?: string;
	};

	let activeTab = $state<BackendTab>('browser');
	let applyMessage = $state<string | null>(null);
	let applyError = $state<string | null>(null);
	let isApplying = $state(false);
	let isPreviewing = $state(false);
	let previewError = $state<string | null>(null);
	let previewBackend = $state<BackendTab | null>(null);
	let previewMode = $state<PreviewMode>('plain');
	let previewText = $state('');
	let previewNote = $state<string | null>(null);
	let previewTrackIndex = $state<number>(-1);
	let previewTrackLength = $state<number>(0);

	let browserVoice = $state('');
	let browserRate = $state(1);
	let browserPitch = $state(1);

	let pollyApiEndpoint = $state(DEFAULT_API_ENDPOINT);
	let pollyLanguage = $state('en-US');
	let pollyGender = $state('');
	let pollyEngine = $state<'standard' | 'neural'>('neural');
	let pollySampleRate = $state(24000);
	let pollyFormat = $state<PollyFormat>('mp3');
	let pollySpeechMarksMode = $state<PollySpeechMarksMode>('word');
	let pollyVoice = $state('');
	let pollyRate = $state(1);

	let googleApiEndpoint = $state(DEFAULT_API_ENDPOINT);
	let googleLanguage = $state('en-US');
	let googleGender = $state('');
	let googleVoiceType = $state('wavenet');
	let googleVoice = $state('');
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

	const DEFAULT_PREVIEW_TEXT: Record<BackendTab, string> = {
		browser:
			'This is a browser voice sample. You should hear clear playback and see tracking updates.',
		polly: 'This is an AWS Polly voice sample. You should hear this text and see tracking updates.',
		google:
			'This is a Google Cloud TTS voice sample. You should hear this text and see tracking updates.'
	};

	const DEFAULT_PREVIEW_SSML: Record<Exclude<BackendTab, 'browser'>, string> = {
		polly:
			'<speak>This is an AWS Polly SSML sample. <break time="300ms"/> The voice should honor this markup.</speak>',
		google:
			'<speak>This is a <prosody rate="95%">Google Cloud SSML sample</prosody>. <break time="250ms"/> The preview preserves authored SSML.</speak>'
	};

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

	function getPollySpeechMarkTypes(): Array<'word' | 'sentence'> {
		return pollySpeechMarksMode === 'word+sentence' ? ['word', 'sentence'] : ['word'];
	}

	function initializeFromCoordinator() {
		const existing = toolkitCoordinator?.getToolConfig?.('tts') || {};
		const stored = readStoredSettings();
		const source = stored ? { ...existing, ...stored } : existing;
		const backend = source?.backend;
		if (backend === 'browser' || backend === 'polly' || backend === 'google') {
			activeTab = backend;
		}

		const defaultVoice = typeof source?.defaultVoice === 'string' ? source.defaultVoice : '';
		const defaultRate = normalizeRate(Number(source?.rate ?? 1));
		const defaultPitch = normalizePitch(Number(source?.pitch ?? 1));
		const defaultEndpoint =
			typeof source?.apiEndpoint === 'string' && source.apiEndpoint.trim().length > 0
				? source.apiEndpoint
				: DEFAULT_API_ENDPOINT;
		const defaultLanguage =
			typeof source?.language === 'string' && source.language.trim().length > 0
				? source.language
				: 'en-US';
		const defaultEngine =
			source?.engine === 'standard'
				? 'standard'
				: source?.engine === 'neural'
					? 'neural'
					: source?.quality === 'standard'
						? 'standard'
						: 'neural';
		const sourceProviderOptions = (source?.providerOptions || {}) as Record<string, unknown>;
		const defaultSampleRate = normalizePollySampleRate(
			Number(source?.sampleRate ?? sourceProviderOptions.sampleRate ?? 24000)
		);
		const defaultFormat =
			source?.format === 'ogg' || source?.format === 'pcm' || source?.format === 'mp3'
				? source.format
				: sourceProviderOptions.format === 'ogg' ||
					  sourceProviderOptions.format === 'pcm' ||
					  sourceProviderOptions.format === 'mp3'
					? (sourceProviderOptions.format as PollyFormat)
					: 'mp3';
		const sourceSpeechMarkTypes = Array.isArray(sourceProviderOptions.speechMarkTypes)
			? sourceProviderOptions.speechMarkTypes
			: [];
		const defaultSpeechMarksMode: PollySpeechMarksMode = sourceSpeechMarkTypes.includes('sentence')
			? 'word+sentence'
			: source?.speechMarksMode === 'word+sentence'
				? 'word+sentence'
				: 'word';

		browserVoice = backend === 'browser' ? defaultVoice : '';
		browserRate = defaultRate;
		browserPitch = defaultPitch;

		pollyApiEndpoint = defaultEndpoint;
		pollyLanguage = defaultLanguage;
		pollyEngine = defaultEngine;
		pollySampleRate = defaultSampleRate;
		pollyFormat = defaultFormat;
		pollySpeechMarksMode = defaultSpeechMarksMode;
		pollyVoice = backend === 'polly' ? defaultVoice : '';
		pollyRate = defaultRate;

		googleApiEndpoint = defaultEndpoint;
		googleLanguage = defaultLanguage;
		googleGender = typeof source?.googleGender === 'string' ? source.googleGender : '';
		googleVoiceType =
			source?.googleVoiceType === 'standard' ||
			source?.googleVoiceType === 'studio' ||
			source?.googleVoiceType === 'wavenet'
				? source.googleVoiceType
				: 'wavenet';
		googleVoice = backend === 'google' ? defaultVoice : '';
		googleRate = defaultRate;
		previewText = DEFAULT_PREVIEW_TEXT[activeTab];
	}

	function readStoredSettings(): PersistedTTSSettings | null {
		if (typeof window === 'undefined') return null;
		try {
			const raw = window.localStorage.getItem(TTS_SETTINGS_STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as PersistedTTSSettings;
			if (!parsed || typeof parsed !== 'object') return null;
			return parsed;
		} catch {
			return null;
		}
	}

	function persistSettings(settings: PersistedTTSSettings): void {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(TTS_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		} catch {
			// Ignore persistence errors (e.g., private mode or storage quota).
		}
	}

	async function checkBrowserAvailability() {
		browserState = { ...browserState, checked: true, loading: true, message: null, detail: null };
		try {
			if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
				throw new Error('Web Speech API is not available in this browser.');
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
						'voiceschanged',
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
				const hasVoice = mappedVoices.some((voice) => (voice.name || '') === browserVoice);
				if (!hasVoice) {
					browserVoice = '';
				}
			}

			browserState = {
				checked: true,
				loading: false,
				available: true,
				message: voices.length
					? `Browser TTS available (${voices.length} voices detected).`
					: 'Browser TTS is available, but no voices were returned yet.',
				detail: null,
				voices: mappedVoices
			};
		} catch (error) {
			browserState = {
				checked: true,
				loading: false,
				available: false,
				message: 'Browser TTS is not available.',
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
		const url = new URL('/api/tts/polly/voices', window.location.origin);
		if (pollyLanguage) url.searchParams.set('language', pollyLanguage);
		if (pollyGender) url.searchParams.set('gender', pollyGender);
		if (pollyEngine) url.searchParams.set('engine', pollyEngine);
		return url;
	}

	function buildGoogleVoicesUrl() {
		const baseUrl = new URL(normalizeApiEndpoint(googleApiEndpoint), window.location.origin);
		baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/google/voices`;
		const url = baseUrl;
		if (googleLanguage) url.searchParams.set('language', googleLanguage);
		if (googleGender) url.searchParams.set('gender', googleGender);
		if (googleVoiceType) url.searchParams.set('voiceType', googleVoiceType);
		return url;
	}

	async function checkPollyAvailability() {
		pollyState = { ...pollyState, checked: true, loading: true, message: null, detail: null };
		try {
			const response = await fetch(buildPollyVoicesUrl().toString());
			const payload = await readJsonSafe(response);
			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${payload?.error || payload?.message || 'Unknown error'}`
				);
			}
			const voices = Array.isArray(payload?.voices) ? payload.voices : [];
			if (pollyVoice) {
				const hasVoice = voices.some(
					(voice: DemoVoice) => (voice.id || voice.name || '') === pollyVoice
				);
				if (!hasVoice) {
					pollyVoice = '';
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
				message: 'AWS Polly is not available from the demo API.',
				detail: error instanceof Error ? error.message : String(error),
				voices: []
			};
		}
	}

	async function checkGoogleAvailability() {
		googleState = { ...googleState, checked: true, loading: true, message: null, detail: null };
		try {
			const response = await fetch(buildGoogleVoicesUrl().toString());
			const payload = await readJsonSafe(response);
			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${payload?.error || payload?.message || 'Unknown error'}`
				);
			}
			const voices = Array.isArray(payload?.voices) ? payload.voices : [];
			if (googleVoice) {
				const hasVoice = voices.some(
					(voice: DemoVoice) => (voice.id || voice.name || '') === googleVoice
				);
				if (!hasVoice) {
					googleVoice = '';
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
				message: 'Google Cloud TTS is not available from the demo API.',
				detail: error instanceof Error ? error.message : String(error),
				voices: []
			};
		}
	}

	async function checkActiveTabAvailability() {
		if (activeTab === 'browser') {
			await checkBrowserAvailability();
			return;
		}
		if (activeTab === 'polly') {
			await checkPollyAvailability();
			return;
		}
		await checkGoogleAvailability();
	}

function refreshPollyVoices() {
	if (activeTab !== 'polly') return;
	void checkPollyAvailability();
}

function refreshGoogleVoices() {
	if (activeTab !== 'google') return;
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
		if (activeTab === 'browser') return browserState;
		if (activeTab === 'polly') return pollyState;
		return googleState;
	}

	function resolveVoiceForBackend(backend: BackendTab): string | undefined {
		if (backend === 'browser') {
			return browserVoice || undefined;
		}
		if (backend === 'polly') {
			if (!pollyVoice) return undefined;
			const isKnown = pollyState.voices.some(
				(voice) => (voice.id || voice.name || '') === pollyVoice
			);
			return isKnown ? pollyVoice : undefined;
		}
		if (googleVoice) {
			const isKnown = googleState.voices.some(
				(voice) => (voice.id || voice.name || '') === googleVoice
			);
			if (isKnown) return googleVoice;
		}
		const firstMatching = googleState.voices[0];
		return firstMatching ? firstMatching.id || firstMatching.name || undefined : undefined;
	}

	function normalizeApiEndpoint(endpoint: string): string {
		const trimmed = endpoint.trim();
		if (!trimmed) return DEFAULT_API_ENDPOINT;
		return trimmed.replace(/\/synthesize\/?$/i, '');
	}

	function getSampleText(tab: BackendTab): string {
		if (tab === 'browser') return 'This is a browser voice sample.';
		if (tab === 'polly') return 'This is an AWS Polly voice sample.';
		return 'This is a Google Cloud TTS voice sample.';
	}

	function clearPreviewTracking() {
		if (previewPollingTimer !== null && typeof window !== 'undefined') {
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
		if (!text.length) return [{ text: '', active: false }];
		if (previewTrackIndex < 0 || previewTrackLength <= 0) {
			return [{ text, active: false }];
		}
		const start = Math.max(0, Math.min(previewTrackIndex, text.length));
		const end = Math.max(start, Math.min(start + previewTrackLength, text.length));
		return [
			{ text: text.slice(0, start), active: false },
			{ text: text.slice(start, end), active: true },
			{ text: text.slice(end), active: false }
		].filter((segment) => segment.text.length > 0);
	}

	function setPreviewTextForCurrentTab() {
		if (previewMode === 'ssml') {
			if (activeTab === 'browser') {
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
		let lastIndex = -1;
		previewPollingTimer = window.setInterval(() => {
			const currentMs = audio.currentTime * 1000;
			for (let index = speechMarks.length - 1; index >= 0; index -= 1) {
				const mark = speechMarks[index];
				if (currentMs >= mark.time) {
					if (index !== lastIndex) {
						lastIndex = index;
						previewTrackIndex = mark.start;
						previewTrackLength = Math.max(1, mark.end - mark.start);
					}
					return;
				}
			}
		}, 40);
	}

	function stopPreview() {
		clearPreviewTracking();
		// Returning to idle should clear transient preview messaging.
		previewError = null;
		previewNote = null;
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			window.speechSynthesis.cancel();
		}
		if (currentPreviewAudio) {
			currentPreviewAudio.pause();
			currentPreviewAudio.src = '';
			currentPreviewAudio = null;
		}
		isPreviewing = false;
		previewBackend = null;
	}

	async function previewServerVoice(provider: 'polly' | 'google') {
		const apiEndpoint = normalizeApiEndpoint(
			provider === 'polly' ? pollyApiEndpoint : googleApiEndpoint
		);
		const includeSpeechMarks = !(provider === 'google' && previewMode === 'ssml');
		const requestBody: Record<string, unknown> = {
			text: previewText.trim() || getSampleText(provider),
			provider,
			rate: normalizeRate(provider === 'polly' ? pollyRate : googleRate),
			language: provider === 'polly' ? pollyLanguage || undefined : googleLanguage || undefined,
			voice:
				provider === 'polly'
					? resolveVoiceForBackend('polly')
					: resolveVoiceForBackend('google'),
			includeSpeechMarks
		};
		if (provider === 'polly') {
			requestBody.engine = pollyEngine;
			requestBody.sampleRate = normalizePollySampleRate(pollySampleRate);
			requestBody.format = pollyFormat;
			requestBody.speechMarkTypes = getPollySpeechMarkTypes();
		}
		const response = await fetch(`${apiEndpoint}/synthesize`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody)
		});
		const payload = await readJsonSafe(response);
		if (!response.ok) {
			throw new Error(
				payload?.message || payload?.error || `Preview request failed (${response.status})`
			);
		}
		const audioBase64 = payload?.audio;
		const contentType = payload?.contentType || 'audio/mpeg';
		if (!audioBase64 || typeof audioBase64 !== 'string') {
			throw new Error('Preview response did not include audio content.');
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
				reject(new Error('Failed to play preview audio.'));
			};
			void audio.play().catch(reject);
		});
		currentPreviewAudio = null;
	}

	async function previewBrowserVoice() {
		if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
			throw new Error('Browser speech synthesis is unavailable.');
		}
		if (previewMode === 'ssml') {
			throw new Error('SSML preview is not supported in the Browser backend.');
		}
		const synth = window.speechSynthesis;
		const utterance = new SpeechSynthesisUtterance(previewText.trim() || getSampleText('browser'));
		utterance.rate = normalizeRate(browserRate);
		utterance.pitch = normalizePitch(browserPitch);
		if (browserVoice) {
			const voice = synth.getVoices().find((entry) => entry.name === browserVoice);
			if (voice) utterance.voice = voice;
		}
		utterance.onboundary = (event) => {
			if ((event as any).name !== 'word') return;
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
			utterance.onerror = () => reject(new Error('Failed to play browser voice preview.'));
			synth.speak(utterance);
		});
	}

	async function previewSelectedVoice() {
		previewError = null;
		previewNote = null;
		const activeState = getActiveState();
		if (!activeState.available) {
			previewError = 'Cannot preview while this TTS service is unavailable.';
			return;
		}
		if (isPreviewing && previewBackend === activeTab) {
			previewRunId += 1;
			stopPreview();
			return;
		}
		if (!previewText.trim()) {
			previewError = 'Enter preview text before starting playback.';
			return;
		}
		if (activeTab === 'browser' && previewMode === 'ssml') {
			previewError = 'SSML preview is not supported in the Browser backend.';
			return;
		}
		stopPreview();
		const runId = ++previewRunId;
		isPreviewing = true;
		previewBackend = activeTab;
		try {
			if (activeTab === 'browser') {
				await previewBrowserVoice();
			} else if (activeTab === 'polly') {
				if (previewMode === 'ssml') {
					previewNote =
						'Some Polly neural voices reject certain SSML tags (for example emphasis). Use basic SSML tags if preview fails.';
				}
				await previewServerVoice('polly');
			} else {
				if (previewMode === 'ssml') {
					previewNote =
						'Google SSML preview preserves authored SSML, so word tracking is disabled.';
				}
				await previewServerVoice('google');
			}
		} catch (error) {
			// Ignore errors from intentionally cancelled previews.
			if (runId === previewRunId) {
				previewError = error instanceof Error ? error.message : String(error);
			}
		} finally {
			if (runId === previewRunId) {
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
			applyError = 'Cannot apply settings while this TTS service is unavailable.';
			return;
		}
		if (!toolkitCoordinator?.updateToolConfig) {
			applyError = 'Toolkit coordinator is not available for TTS updates.';
			return;
		}

		isApplying = true;
		try {
			if (activeTab === 'browser') {
				const next = {
					backend: 'browser' as const,
					defaultVoice: resolveVoiceForBackend('browser'),
					rate: normalizeRate(browserRate),
					pitch: normalizePitch(browserPitch)
				};
				toolkitCoordinator.updateToolConfig('tts', {
					enabled: true,
					...next
				});
				persistSettings(next);
			} else if (activeTab === 'polly') {
				const next = {
					backend: 'polly' as const,
					apiEndpoint: normalizeApiEndpoint(pollyApiEndpoint),
					defaultVoice: resolveVoiceForBackend('polly'),
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
					}
				};
				toolkitCoordinator.updateToolConfig('tts', {
					enabled: true,
					...next
				});
				persistSettings(next);
			} else {
				const next = {
					backend: 'google' as const,
					apiEndpoint: normalizeApiEndpoint(googleApiEndpoint),
					defaultVoice: resolveVoiceForBackend('google'),
					rate: normalizeRate(googleRate),
					language: googleLanguage || undefined,
					googleVoiceType,
					googleGender
				};
				toolkitCoordinator.updateToolConfig('tts', {
					enabled: true,
					...next
				});
				persistSettings(next);
			}
			await toolkitCoordinator?.ensureTTSReady?.(toolkitCoordinator?.getToolConfig?.('tts'));
			applyMessage = `Applied ${activeTab} TTS settings.`;
			onClose();
		} catch (error) {
			applyError = error instanceof Error ? error.message : String(error);
		} finally {
			isApplying = false;
		}
	}

	onMount(() => {
		initializeFromCoordinator();
		void checkActiveTabAvailability();
	});

	onDestroy(() => {
		stopPreview();
	});
</script>

<div class="pie-tts-dialog-backdrop">
	<div class="pie-tts-dialog">
		<div class="pie-tts-dialog-header">
			<h3 class="pie-tts-dialog-title">TTS settings</h3>
			<button class="btn btn-xs btn-ghost btn-circle" onclick={onClose} aria-label="Close TTS settings">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="join pie-tts-tabs">
			<button class="btn btn-sm join-item" class:btn-active={activeTab === 'browser'} onclick={() => setActiveTab('browser')}>
				Browser
			</button>
			<button class="btn btn-sm join-item" class:btn-active={activeTab === 'polly'} onclick={() => setActiveTab('polly')}>
				Polly
			</button>
			<button class="btn btn-sm join-item" class:btn-active={activeTab === 'google'} onclick={() => setActiveTab('google')}>
				Google
			</button>
		</div>

		<div class="pie-tts-status">
			{#if getActiveState().loading}
				<span class="loading loading-spinner loading-xs"></span>
				<span>Checking availability...</span>
			{:else if getActiveState().checked}
				<span class={getActiveState().available ? 'pie-tts-ok' : 'pie-tts-error'}>
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

		{#if activeTab === 'browser'}
			<fieldset class="fieldset bg-base-200 border border-base-300 p-3 rounded-box" disabled={!browserState.available}>
				<label class="label" for="tts-browser-voice">Voice</label>
				<select id="tts-browser-voice" class="select select-sm select-bordered w-full" bind:value={browserVoice}>
					<option value="">Default browser voice</option>
					{#each browserState.voices as voice}
						<option value={voice.name || ''}>{voice.name} ({voice.languageCode || 'n/a'})</option>
					{/each}
				</select>

				<label class="label" for="tts-browser-rate">Rate</label>
				<input id="tts-browser-rate" class="range range-primary" type="range" min="0.25" max="4" step="0.05" bind:value={browserRate} />
				<div class="text-xs opacity-70">{Number(browserRate).toFixed(2)}x</div>

				<label class="label" for="tts-browser-pitch">Pitch</label>
				<input id="tts-browser-pitch" class="range range-secondary" type="range" min="0" max="2" step="0.05" bind:value={browserPitch} />
				<div class="text-xs opacity-70">{Number(browserPitch).toFixed(2)}</div>
			</fieldset>
		{:else if activeTab === 'polly'}
			<fieldset class="fieldset bg-base-200 border border-base-300 p-3 rounded-box" disabled={!pollyState.available}>
				<label class="label" for="tts-polly-endpoint">API endpoint</label>
				<input id="tts-polly-endpoint" class="input input-sm input-bordered w-full" bind:value={pollyApiEndpoint} placeholder="/api/tts" />

				<div class="grid grid-cols-3 gap-2">
					<div>
						<label class="label" for="tts-polly-language">Language</label>
						<input
							id="tts-polly-language"
							class="input input-sm input-bordered w-full"
							bind:value={pollyLanguage}
							placeholder="en-US"
							onchange={refreshPollyVoices}
						/>
					</div>
					<div>
						<label class="label" for="tts-polly-gender">Gender filter</label>
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
					<div>
						<label class="label" for="tts-polly-engine">Engine</label>
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

				<label class="label" for="tts-polly-voice">Voice</label>
				<select id="tts-polly-voice" class="select select-sm select-bordered w-full" bind:value={pollyVoice}>
					<option value="">Provider default</option>
					{#each pollyState.voices as voice}
						<option value={voice.id || voice.name || ''}>{voice.name || voice.id} ({voice.languageCode || 'n/a'})</option>
					{/each}
				</select>

				<label class="label" for="tts-polly-rate">Rate</label>
				<input id="tts-polly-rate" class="range range-primary" type="range" min="0.25" max="4" step="0.05" bind:value={pollyRate} />
				<div class="text-xs opacity-70">{Number(pollyRate).toFixed(2)}x</div>

				<div class="grid grid-cols-3 gap-2">
					<div>
						<label class="label" for="tts-polly-format">Output format</label>
						<select id="tts-polly-format" class="select select-sm select-bordered w-full" bind:value={pollyFormat}>
							<option value="mp3">MP3</option>
							<option value="ogg">OGG</option>
							<option value="pcm">PCM</option>
						</select>
					</div>
					<div>
						<label class="label" for="tts-polly-sample-rate">Sample rate</label>
						<select id="tts-polly-sample-rate" class="select select-sm select-bordered w-full" bind:value={pollySampleRate}>
							<option value={8000}>8000 Hz</option>
							<option value={16000}>16000 Hz</option>
							<option value={22050}>22050 Hz</option>
							<option value={24000}>24000 Hz</option>
						</select>
					</div>
					<div>
						<label class="label" for="tts-polly-speech-marks">Speech marks</label>
						<select id="tts-polly-speech-marks" class="select select-sm select-bordered w-full" bind:value={pollySpeechMarksMode}>
							<option value="word">Word</option>
							<option value="word+sentence">Word + sentence</option>
						</select>
					</div>
				</div>
			</fieldset>
		{:else}
			<fieldset class="fieldset bg-base-200 border border-base-300 p-3 rounded-box" disabled={!googleState.available}>
				<label class="label" for="tts-google-endpoint">API endpoint</label>
				<input id="tts-google-endpoint" class="input input-sm input-bordered w-full" bind:value={googleApiEndpoint} placeholder="/api/tts" />

				<div class="grid grid-cols-3 gap-2">
					<div>
						<label class="label" for="tts-google-language">Language</label>
						<input
							id="tts-google-language"
							class="input input-sm input-bordered w-full"
							bind:value={googleLanguage}
							placeholder="en-US"
							onchange={refreshGoogleVoices}
						/>
					</div>
					<div>
						<label class="label" for="tts-google-gender">Gender filter</label>
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
					<div>
						<label class="label" for="tts-google-voice-type">Voice type filter</label>
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

				<label class="label" for="tts-google-voice">Voice</label>
				<select id="tts-google-voice" class="select select-sm select-bordered w-full" bind:value={googleVoice}>
					<option value="">Provider default</option>
					{#each googleState.voices as voice}
						<option value={voice.id || voice.name || ''}>{voice.name || voice.id} ({voice.languageCode || 'n/a'})</option>
					{/each}
				</select>

				<label class="label" for="tts-google-rate">Rate</label>
				<input id="tts-google-rate" class="range range-primary" type="range" min="0.25" max="4" step="0.05" bind:value={googleRate} />
				<div class="text-xs opacity-70">{Number(googleRate).toFixed(2)}x</div>
			</fieldset>
		{/if}

		<div class="fieldset bg-base-200 border border-base-300 p-3 rounded-box">
			<div class="pie-tts-preview-header">
				<h4 class="pie-tts-preview-title">Preview</h4>
				<div class="join">
					<button
						type="button"
						class="btn btn-xs join-item"
						class:btn-active={previewMode === 'plain'}
						onclick={() => onPreviewModeChange('plain')}
					>
						Plain text
					</button>
					<button
						type="button"
						class="btn btn-xs join-item"
						class:btn-active={previewMode === 'ssml'}
						onclick={() => onPreviewModeChange('ssml')}
					>
						SSML
					</button>
				</div>
			</div>
			<label class="label" for="tts-preview-text">Sample text</label>
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
					{#if activeTab === 'browser' && previewMode === 'ssml'}
						SSML is unsupported in Browser preview.
					{:else if activeTab === 'google' && previewMode === 'ssml'}
						SSML preserved. Tracking disabled.
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
			<button class="btn btn-sm btn-outline" onclick={onClose}>Close</button>
			<button
				class="btn btn-sm btn-outline"
				disabled={!getActiveState().available || isApplying}
				onclick={() => void previewSelectedVoice()}
			>
				{isPreviewing && previewBackend === activeTab ? 'Stop preview' : 'Preview voice'}
			</button>
			<button class="btn btn-sm btn-primary" disabled={isApplying || !getActiveState().available} onclick={() => void applySettings()}>
				{isApplying ? 'Applying...' : 'Apply'}
			</button>
		</div>
	</div>
</div>

<style>
	.pie-tts-dialog-backdrop {
		position: fixed;
		inset: 0;
		z-index: 120;
		background: color-mix(in srgb, #000 30%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.pie-tts-dialog {
		width: min(780px, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow: auto;
		background: var(--color-base-100);
		border: 1px solid var(--color-base-300);
		border-radius: 0.75rem;
		box-shadow: 0 24px 48px rgba(0, 0, 0, 0.22);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
		width: fit-content;
	}

	.pie-tts-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: space-between;
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
		min-height: 6rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
	}

	.pie-tts-preview-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pie-tts-preview-track {
		margin-top: 0.35rem;
		border: 1px dashed var(--color-base-300);
		border-radius: 0.5rem;
		padding: 0.5rem;
		min-height: 3.2rem;
		white-space: pre-wrap;
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.pie-tts-preview-active {
		background: color-mix(in srgb, var(--color-warning) 40%, transparent);
		border-radius: 0.15rem;
	}
</style>
