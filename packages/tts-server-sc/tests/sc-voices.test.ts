import { describe, expect, it } from "vitest";

import {
	defaultVoiceForSchoolCityLanguage,
	isSupportedSchoolCityLanguage,
	SCHOOLCITY_DEFAULT_VOICES,
	schoolCityVoices,
} from "../src/sc-voices.js";
import { SchoolCityServerProvider } from "../src/SchoolCityServerProvider.js";

const initialized = async (): Promise<SchoolCityServerProvider> => {
	const provider = new SchoolCityServerProvider();
	await provider.initialize({
		baseUrl: "https://tts.example.test",
		apiKey: "test-secret",
		issuer: "pie-api",
		// No request is made by `getVoices`; a throwing fetch proves that.
		fetchImpl: () => {
			throw new Error("getVoices must not reach the network");
		},
	});
	return provider;
};

describe("the transcribed SchoolCity roster", () => {
	it("carries the 29 locales the service's voice map defines", () => {
		expect(SCHOOLCITY_DEFAULT_VOICES).toHaveLength(29);
	});

	it("names one voice per locale, with no duplicate locale", () => {
		const codes = SCHOOLCITY_DEFAULT_VOICES.map((v) => v.languageCode);
		expect(new Set(codes).size).toBe(codes.length);
	});

	it("shares one voice between the two locales upstream points at it from", () => {
		// `Aditi` is bilingual, and the service's map lists it for both — so a voice
		// id is not a unique key even though a locale is.
		expect(defaultVoiceForSchoolCityLanguage("en-IN")).toBe("Aditi");
		expect(defaultVoiceForSchoolCityLanguage("hi-IN")).toBe("Aditi");
	});

	it("keeps gender unset where the upstream map records none", () => {
		const withoutGender = SCHOOLCITY_DEFAULT_VOICES.filter(
			(v) => !v.gender,
		).map((v) => v.languageCode);
		expect(withoutGender).toEqual(["arb", "cmn-CN"]);
	});
});

describe("locale support checks", () => {
	it("accepts a served locale however it is cased or separated", () => {
		expect(isSupportedSchoolCityLanguage("es-MX")).toBe(true);
		expect(isSupportedSchoolCityLanguage("es_mx")).toBe(true);
		expect(isSupportedSchoolCityLanguage(" ES-MX ")).toBe(true);
	});

	it("rejects a locale the service would silently answer in English", () => {
		// The upstream handler rewrites an unrecognized `lang_id` to `en-US` instead
		// of failing, which is the whole reason a caller needs this check.
		expect(isSupportedSchoolCityLanguage("es-419")).toBe(false);
		expect(isSupportedSchoolCityLanguage("en")).toBe(false);
		expect(defaultVoiceForSchoolCityLanguage("es-419")).toBeUndefined();
	});
});

describe("voice lookup", () => {
	it("reports every locale as a standard SSML-capable voice", () => {
		const voices = schoolCityVoices();
		expect(voices).toHaveLength(29);
		expect(voices.every((v) => v.quality === "standard")).toBe(true);
		expect(voices.every((v) => v.supportedFeatures.ssml)).toBe(true);
	});

	it("identifies a voice by the id the service accepts back", () => {
		const [enUS] = schoolCityVoices({ language: "en-US" });
		expect(enUS).toMatchObject({
			id: "Salli",
			languageCode: "en-US",
			gender: "female",
		});
	});

	it("treats a bare primary subtag as reaching every locale under it", () => {
		expect(
			schoolCityVoices({ language: "en" }).map((v) => v.languageCode),
		).toEqual(["en-AU", "en-GB", "en-IN", "en-US", "en-GB-WLS"]);
	});

	it("matches a region range down to its variants, per RFC 4647", () => {
		expect(
			schoolCityVoices({ language: "en-GB" }).map((v) => v.languageCode),
		).toEqual(["en-GB", "en-GB-WLS"]);
	});

	it("does not match a partial subtag", () => {
		expect(schoolCityVoices({ language: "en-G" })).toEqual([]);
	});

	it("filters by gender, and excludes the entries with no recorded gender", () => {
		const male = schoolCityVoices({ gender: "male" }).map(
			(v) => v.languageCode,
		);
		expect(male).toEqual(["en-GB-WLS", "fr-FR", "es-US"]);
		const female = schoolCityVoices({ gender: "female" }).map(
			(v) => v.languageCode,
		);
		expect(female).not.toContain("arb");
		expect(female).not.toContain("cmn-CN");
	});

	it("returns nothing for a quality the service cannot produce", () => {
		// No `Engine` is sent upstream, so every voice is a Polly standard voice.
		expect(schoolCityVoices({ quality: "neural" })).toEqual([]);
		expect(schoolCityVoices({ quality: "premium" })).toEqual([]);
		expect(schoolCityVoices({ quality: "standard" })).toHaveLength(29);
	});

	it("combines filters", () => {
		expect(
			schoolCityVoices({ language: "es", gender: "male" }).map((v) => v.id),
		).toEqual(["Miguel"]);
	});
});

describe("the provider's voice discovery", () => {
	it("serves the roster without a network call", async () => {
		const provider = await initialized();
		const voices = await provider.getVoices();
		expect(voices).toHaveLength(29);
	});

	it("passes filters through", async () => {
		const provider = await initialized();
		expect(await provider.getVoices({ language: "cy-GB" })).toEqual([
			expect.objectContaining({ id: "Gwyneth", language: "Welsh" }),
		]);
	});

	it("still refuses discovery before initialization", async () => {
		const provider = new SchoolCityServerProvider();
		await expect(provider.getVoices()).rejects.toThrow();
	});
});
