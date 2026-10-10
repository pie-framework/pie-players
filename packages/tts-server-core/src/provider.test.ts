import { describe, expect, it } from "vitest";

import { BaseTTSProvider } from "./provider.js";
import type {
	GetVoicesOptions,
	ServerProviderCapabilities,
	SynthesizeRequest,
	SynthesizeResponse,
	TTSServerConfig,
	Voice,
} from "./types.js";

class TestProvider extends BaseTTSProvider {
	readonly providerId = "test";
	readonly providerName = "Test";
	readonly version = "0.0.0";

	async initialize(_config: TTSServerConfig): Promise<void> {
		this.initialized = true;
	}

	async synthesize(_request: SynthesizeRequest): Promise<SynthesizeResponse> {
		throw new Error("not implemented");
	}

	async getVoices(_options?: GetVoicesOptions): Promise<Voice[]> {
		return [];
	}

	getCapabilities(): ServerProviderCapabilities {
		throw new Error("not implemented");
	}

	// Expose the protected helpers under test.
	buildProsodyAttrsPublic(request: SynthesizeRequest): string {
		return this.buildProsodyAttrs(request);
	}

	applyProsodyPublic(text: string, request: SynthesizeRequest, extraSsmlTags: string[] = []) {
		return this.applyProsody(text, request, extraSsmlTags);
	}

	escapeSSMLPublic(text: string): string {
		return this.escapeSSML(text);
	}

	validateRequestPublic(request: SynthesizeRequest): void {
		this.validateRequest(request, {
			standard: {
				supportsSSML: true,
				supportsPitch: true,
				supportsRate: true,
				supportsVolume: false,
				supportsMultipleVoices: true,
				maxTextLength: 3000,
			},
			extensions: {
				supportsSpeechMarks: false,
				supportedFormats: ["mp3"],
				supportsSampleRate: false,
			},
		});
	}
}

describe("BaseTTSProvider prosody helpers", () => {
	const provider = new TestProvider();

	it("builds no prosody attrs when rate and pitch are unset or default", () => {
		expect(provider.buildProsodyAttrsPublic({ text: "hi" })).toBe("");
		expect(provider.buildProsodyAttrsPublic({ text: "hi", rate: 1, pitch: 1 })).toBe(
			"",
		);
	});

	it("maps rate directly to an SSML percentage", () => {
		expect(provider.buildProsodyAttrsPublic({ text: "hi", rate: 1.5 })).toBe(
			'rate="150%"',
		);
		expect(provider.buildProsodyAttrsPublic({ text: "hi", rate: 0.5 })).toBe(
			'rate="50%"',
		);
	});

	it("maps a pitch multiplier to a relative SSML percentage", () => {
		expect(provider.buildProsodyAttrsPublic({ text: "hi", pitch: 1.2 })).toBe(
			'pitch="+20%"',
		);
		expect(provider.buildProsodyAttrsPublic({ text: "hi", pitch: 0.8 })).toBe(
			'pitch="-20%"',
		);
	});

	it("maps the ends of the pitch range to -100% and +100%", () => {
		expect(provider.buildProsodyAttrsPublic({ text: "hi", pitch: 0 })).toBe(
			'pitch="-100%"',
		);
		expect(provider.buildProsodyAttrsPublic({ text: "hi", pitch: 2 })).toBe(
			'pitch="+100%"',
		);
	});

	it("combines rate and pitch into one prosody attribute string", () => {
		expect(
			provider.buildProsodyAttrsPublic({ text: "hi", rate: 1.5, pitch: 1.2 }),
		).toBe('rate="150%" pitch="+20%"');
	});

	it("wraps plain text in <speak><prosody> when rate/pitch are set", () => {
		const result = provider.applyProsodyPublic("hello & <world>", {
			text: "hello & <world>",
			rate: 2,
		});
		expect(result.isSsml).toBe(true);
		expect(result.text).toBe(
			'<speak><prosody rate="200%">hello &amp; &lt;world&gt;</prosody></speak>',
		);
	});

	it("leaves plain text untouched when no rate/pitch is requested", () => {
		const result = provider.applyProsodyPublic("hello", { text: "hello" });
		expect(result).toEqual({ text: "hello", isSsml: false });
	});

	it("does not attempt to inject prosody into already-SSML input", () => {
		const request: SynthesizeRequest = {
			text: "<speak>hi</speak>",
			rate: 2,
		};
		const result = provider.applyProsodyPublic(request.text, request);
		expect(result).toEqual({ text: "<speak>hi</speak>", isSsml: true });
	});
});

describe("BaseTTSProvider request validation", () => {
	const provider = new TestProvider();
	const validate = (pitch: number) => () =>
		provider.validateRequestPublic({ text: "hi", pitch });

	it("accepts a pitch multiplier from 0 to 2 inclusive", () => {
		for (const pitch of [0, 0.5, 1, 1.5, 2]) {
			expect(validate(pitch)).not.toThrow();
		}
	});

	it("rejects a pitch outside 0 to 2, semitone values included", () => {
		for (const pitch of [-0.01, 2.01, -5, 5, -20, 20]) {
			expect(validate(pitch)).toThrow("Pitch must be between 0 and 2");
		}
	});
});

const voice = (id: string, languageCode: string): Voice => ({
	id,
	name: id,
	language: languageCode,
	languageCode,
	quality: "neural",
	supportedFeatures: { ssml: true, emotions: false, styles: false },
});

class ListingProvider extends TestProvider {
	listings = 0;
	failNext = false;
	voices = [
		voice("Joanna", "en-US"),
		voice("Lupe", "es-US"),
		voice("Lucia", "es-ES"),
		voice("Lea", "fr-FR"),
		voice("Remi", "fr-FR"),
	];

	override async getVoices(): Promise<Voice[]> {
		this.listings += 1;
		if (this.failNext) {
			this.failNext = false;
			throw new Error("listing failed");
		}
		return this.voices;
	}

	resolve(request: Omit<SynthesizeRequest, "text">, prefer?: (v: Voice) => boolean) {
		return this.resolveRequestVoice({ text: "hi", ...request }, "Joanna", prefer);
	}
}

describe("BaseTTSProvider voice resolution", () => {
	it("reads a named voice whatever the language", async () => {
		const provider = new ListingProvider();
		expect(await provider.resolve({ voice: "Lea", language: "es-ES" })).toBe("Lea");
		expect(provider.listings).toBe(0);
	});

	it("picks a voice for a language the request names without a voice", async () => {
		const provider = new ListingProvider();
		expect(await provider.resolve({ language: "es-ES" })).toBe("Lucia");
		expect(await provider.resolve({ language: "es" })).toBe("Lupe");
		expect(
			await provider.resolve({ language: "fr-FR" }, (v) => v.id === "Remi"),
		).toBe("Remi");
		expect(provider.listings).toBe(1);
	});

	it("keeps the default voice when it speaks the language, or when none does", async () => {
		const provider = new ListingProvider();
		expect(await provider.resolve({ language: "en-US" })).toBe("Joanna");
		expect(await provider.resolve({ language: "nl-NL" })).toBe("Joanna");
		expect(await provider.resolve({})).toBe("Joanna");
	});

	it("reads in the default voice when the listing fails, and lists again next time", async () => {
		const provider = new ListingProvider();
		provider.failNext = true;
		expect(await provider.resolve({ language: "es-ES" })).toBe("Joanna");
		expect(await provider.resolve({ language: "es-ES" })).toBe("Lucia");
		expect(provider.listings).toBe(2);
	});
});
