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
