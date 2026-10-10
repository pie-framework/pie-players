import { TTSError, TTSErrorCode } from "@pie-players/tts-server-core";
import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import {
	type SchoolCityProviderConfig,
	SchoolCityServerProvider,
} from "../src/SchoolCityServerProvider.js";

const BASE_URL = "https://tts.example.com";
const API_KEY = "test-secret";
const ISSUER = "pie-api";
const AUDIO_URL = "https://tts.example.com/audio/a.mp3";
const MARKS_URL = "https://tts.example.com/marks/a.jsonl";
const MARKS = [
	{ time: 0, type: "word", start: 0, end: 5, value: "Hello" },
	{ time: 400, type: "word", start: 6, end: 11, value: "world" },
]
	.map((mark) => JSON.stringify(mark))
	.join("\n");

type Call = { url: string; init?: RequestInit };
type Route = (call: Call) => Response;

/**
 * A fake SchoolCity: `POST` to the base URL answers with the asset URLs in
 * `synthesis`, and every other URL is answered from `routes`. An unrouted URL
 * fails the test, so a request the guard should have stopped cannot pass
 * silently.
 */
const fakeSchoolCity = (
	synthesis: Record<string, unknown> | Response,
	routes: Record<string, Route> = {},
	baseUrl = BASE_URL,
) => {
	const calls: Call[] = [];
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const call = { url: String(input), init };
		calls.push(call);
		if (call.url === baseUrl && init?.method === "POST") {
			return synthesis instanceof Response
				? synthesis
				: Response.json(synthesis);
		}
		const route = routes[call.url];
		if (!route) throw new Error(`unexpected fetch: ${call.url}`);
		return route(call);
	}) as typeof fetch;
	return { calls, fetchImpl };
};

const assets = (audioContent: string, word = MARKS_URL) => ({
	audioContent,
	word,
});

const okRoutes: Record<string, Route> = {
	[MARKS_URL]: () => new Response(MARKS),
	[AUDIO_URL]: () =>
		new Response(new Uint8Array([1, 2, 3]), {
			headers: { "content-type": "audio/mpeg" },
		}),
};

const provider = async (
	fetchImpl: typeof fetch,
	config: Partial<SchoolCityProviderConfig> = {},
): Promise<SchoolCityServerProvider> => {
	const instance = new SchoolCityServerProvider();
	await instance.initialize({
		baseUrl: BASE_URL,
		apiKey: API_KEY,
		issuer: ISSUER,
		fetchImpl,
		...config,
	});
	return instance;
};

const rejection = async (promise: Promise<unknown>): Promise<TTSError> => {
	const error = await promise.then(
		() => null,
		(caught: unknown) => caught,
	);
	expect(error).toBeInstanceOf(TTSError);
	return error as TTSError;
};

const redirect = (location: string): Route => () =>
	new Response(null, { status: 302, headers: { location } });

describe("SchoolCity synthesis", () => {
	it("posts a signed request and returns the audio and anchored marks", async () => {
		const { calls, fetchImpl } = fakeSchoolCity(assets(AUDIO_URL), okRoutes);
		const response = await (await provider(fetchImpl)).synthesize({
			text: "<speak>Hello world</speak>",
			voice: "Joanna",
			rate: 0.5,
			language: "en-GB",
		});

		const post = calls[0];
		expect(post.url).toBe(BASE_URL);
		expect(JSON.parse(String(post.init?.body))).toEqual({
			text: "Hello world",
			speedRate: "slow",
			lang_id: "en-GB",
			cache: true,
			voice: "Joanna",
		});
		const authorization = new Headers(post.init?.headers).get("authorization");
		const token = authorization?.replace(/^Bearer /, "") ?? "";
		const { payload, protectedHeader } = await jwtVerify(
			token,
			new TextEncoder().encode(API_KEY),
			{ issuer: ISSUER },
		);
		expect(protectedHeader.alg).toBe("HS256");
		expect(payload.exp).toBeGreaterThan(payload.iat ?? 0);

		expect(calls.map((call) => call.url)).toEqual([
			BASE_URL,
			MARKS_URL,
			AUDIO_URL,
		]);
		expect(calls.slice(1).map((call) => call.init?.redirect)).toEqual([
			"manual",
			"manual",
		]);
		expect([...response.audio]).toEqual([1, 2, 3]);
		expect(response.contentType).toBe("audio/mpeg");
		expect(response.speechMarks.map((mark) => mark.value)).toEqual([
			"Hello",
			"world",
		]);
	});

	it("lets providerOptions override the speed, language and cache flag", async () => {
		const { calls, fetchImpl } = fakeSchoolCity(assets(AUDIO_URL), okRoutes);
		await (await provider(fetchImpl)).synthesizeWithAssets({
			text: "Hello world",
			rate: 0.5,
			language: "en-GB",
			providerOptions: { speedRate: "fast", lang_id: "es-ES", cache: false },
		});
		expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
			speedRate: "fast",
			lang_id: "es-ES",
			cache: false,
		});
	});

	it("skips the marks fetch when speech marks are not requested", async () => {
		const { calls, fetchImpl } = fakeSchoolCity(assets(AUDIO_URL), okRoutes);
		const response = await (await provider(fetchImpl)).synthesize({
			text: "Hello world",
			includeSpeechMarks: false,
		});
		expect(calls.map((call) => call.url)).toEqual([BASE_URL, AUDIO_URL]);
		expect(response.speechMarks).toEqual([]);
	});

	it.each([
		[401, TTSErrorCode.AUTHENTICATION_ERROR],
		[429, TTSErrorCode.RATE_LIMIT_EXCEEDED],
		[400, TTSErrorCode.INVALID_REQUEST],
		[503, TTSErrorCode.PROVIDER_ERROR],
	])("maps an upstream %i to %s with the upstream message", async (status, code) => {
		const { fetchImpl } = fakeSchoolCity(
			Response.json({ message: "upstream says no" }, { status }),
		);
		const error = await rejection(
			(await provider(fetchImpl)).synthesize({ text: "Hello" }),
		);
		expect(error.code).toBe(code);
		expect(error.message).toBe("upstream says no");
	});

	it("names the missing asset when a 200 lacks one", async () => {
		const { fetchImpl } = fakeSchoolCity({ audioContent: AUDIO_URL });
		const error = await rejection(
			(await provider(fetchImpl)).synthesize({ text: "Hello" }),
		);
		expect(error.code).toBe(TTSErrorCode.PROVIDER_ERROR);
		expect(error.message).toContain("missing word");
	});

	it("wraps a transport failure as a provider error", async () => {
		const fetchImpl = (async () => {
			throw new Error("socket hang up");
		}) as typeof fetch;
		const error = await rejection(
			(await provider(fetchImpl)).synthesize({ text: "Hello" }),
		);
		expect(error.code).toBe(TTSErrorCode.PROVIDER_ERROR);
		expect(error.message).toBe("SchoolCity synthesis failed: socket hang up");
	});

	it.each([
		["baseUrl", { baseUrl: " " }],
		["apiKey", { apiKey: "" }],
		["issuer", { issuer: "" }],
	])("refuses to initialize without %s", async (field, override) => {
		const error = await rejection(
			provider(fakeSchoolCity({}).fetchImpl, override),
		);
		expect(error.code).toBe(TTSErrorCode.INITIALIZATION_ERROR);
		expect(error.message).toBe(`SchoolCity ${field} is required`);
	});
});

describe("SchoolCity asset URL guard", () => {
	const audioRejection = async (
		audioContent: string,
		config: Partial<SchoolCityProviderConfig> = {},
		routes: Record<string, Route> = okRoutes,
	) => {
		const { calls, fetchImpl } = fakeSchoolCity(assets(audioContent), routes);
		const error = await rejection(
			(await provider(fetchImpl, config)).synthesize({ text: "Hello world" }),
		);
		return { calls, error };
	};

	it.each([
		"http://169.254.169.254/latest/meta-data/",
		"http://metadata.google.internal/computeMetadata/v1/",
		"http://metadata.azure.internal/",
		"http://[fd00:ec2::254]/latest/",
		"http://[::ffff:169.254.169.254]/",
		"http://[0:0:0:0:0:ffff:a9fe:a9fe]/",
		"http://2852039166/",
	])("blocks the cloud metadata endpoint %s even with the private-host guard off", async (url) => {
		const { calls, error } = await audioRejection(url, {
			blockPrivateAssetHosts: false,
			assetOrigins: [BASE_URL, new URL(url).origin],
		});
		expect(error.message).toBe(
			"SchoolCity asset URL resolves to a cloud metadata endpoint",
		);
		expect(calls.map((call) => call.url)).not.toContain(url);
	});

	it.each([
		"http://localhost/a.mp3",
		"http://127.0.0.1/a.mp3",
		"http://2130706433/a.mp3",
		"http://0x7f000001/a.mp3",
		"http://10.1.2.3/a.mp3",
		"http://172.16.0.1/a.mp3",
		"http://192.168.1.1/a.mp3",
		"http://169.254.10.10/a.mp3",
		"http://[::1]/a.mp3",
		"http://[::ffff:127.0.0.1]/a.mp3",
		"http://[::ffff:a01:203]/a.mp3",
		"http://[fe80::1]/a.mp3",
		"http://[fd12:3456::1]/a.mp3",
	])("blocks the private host %s by default", async (url) => {
		const { error } = await audioRejection(url, {
			assetOrigins: [BASE_URL, new URL(url).origin],
		});
		expect(error.message).toBe(
			"SchoolCity asset URL resolves to a private/internal host",
		);
	});

	it("allows an allow-listed private host once the private-host guard is off", async () => {
		const privateAudio = "http://10.1.2.3/a.mp3";
		const { calls, fetchImpl } = fakeSchoolCity(assets(privateAudio), {
			...okRoutes,
			[privateAudio]: () => new Response(new Uint8Array([9])),
		});
		const response = await (
			await provider(fetchImpl, {
				blockPrivateAssetHosts: false,
				assetOrigins: [BASE_URL, "http://10.1.2.3"],
			})
		).synthesize({ text: "Hello world" });
		expect([...response.audio]).toEqual([9]);
		expect(calls.at(-1)?.url).toBe(privateAudio);
	});

	it.each([
		"file:///etc/passwd",
		"ftp://tts.example.com/a.mp3",
		"data:audio/mpeg;base64,AAAA",
	])("rejects the non-http asset URL %s", async (url) => {
		const { error } = await audioRejection(url);
		expect(error.message).toMatch(
			/^SchoolCity asset URL uses unsupported protocol: /,
		);
	});

	it("rejects a malformed asset URL", async () => {
		const { error } = await audioRejection("not a url");
		expect(error.message).toBe("SchoolCity returned a malformed asset URL");
	});

	it("guards the marks URL before fetching it", async () => {
		const { calls, fetchImpl } = fakeSchoolCity(
			assets(AUDIO_URL, "http://169.254.169.254/marks"),
			okRoutes,
		);
		const error = await rejection(
			(await provider(fetchImpl)).synthesize({ text: "Hello world" }),
		);
		expect(error.message).toBe(
			"SchoolCity asset URL resolves to a cloud metadata endpoint",
		);
		expect(calls).toHaveLength(1);
	});

	describe("origin policy", () => {
		const allowedAudio = async (
			audioContent: string,
			config: Partial<SchoolCityProviderConfig> = {},
		) => {
			const { calls, fetchImpl } = fakeSchoolCity(assets(audioContent), {
				...okRoutes,
				[audioContent]: () => new Response(new Uint8Array([7])),
			});
			await (await provider(fetchImpl, config)).synthesize({
				text: "Hello world",
			});
			return calls.at(-1)?.url;
		};

		it("allows another host on the base URL's registrable domain by default", async () => {
			expect(await allowedAudio("https://cdn.example.com/a.mp3")).toBe(
				"https://cdn.example.com/a.mp3",
			);
		});

		it("rejects a host on another registrable domain by default", async () => {
			const { error } = await audioRejection("https://cdn.example.org/a.mp3");
			expect(error.message).toBe(
				"SchoolCity asset URL origin is not allow-listed: https://cdn.example.org",
			);
			expect(error.details?.allowed).toEqual([BASE_URL, "*.example.com"]);
		});

		it("matches an explicit allow-list exactly, with no registrable-domain fallback", async () => {
			const config = { assetOrigins: [BASE_URL, "https://cdn.example.org"] };
			expect(await allowedAudio("https://cdn.example.org/a.mp3", config)).toBe(
				"https://cdn.example.org/a.mp3",
			);
			const { error } = await audioRejection(
				"https://cdn.example.com/a.mp3",
				config,
			);
			expect(error.message).toMatch(/not allow-listed/);
			const port = await audioRejection(
				"https://cdn.example.org:8443/a.mp3",
				config,
			);
			expect(port.error.message).toMatch(/not allow-listed/);
		});

		it("allows only the base URL's own origin when it has no registrable domain", async () => {
			const ipBase = "https://203.0.113.10";
			const ipMarks = `${ipBase}/a.jsonl`;
			const synthesizeFrom = async (audioContent: string) => {
				const { fetchImpl } = fakeSchoolCity(
					assets(audioContent, ipMarks),
					{
						[ipMarks]: () => new Response(MARKS),
						[audioContent]: () => new Response(new Uint8Array([5])),
					},
					ipBase,
				);
				return (await provider(fetchImpl, { baseUrl: ipBase })).synthesize({
					text: "Hello world",
				});
			};
			expect([...(await synthesizeFrom(`${ipBase}/a.mp3`)).audio]).toEqual([5]);
			const neighbour = await rejection(
				synthesizeFrom("https://203.0.113.11/a.mp3"),
			);
			expect(neighbour.message).toBe(
				"SchoolCity asset URL origin is not allow-listed: https://203.0.113.11",
			);
		});
	});

	describe("redirects", () => {
		it("follows a redirect that stays inside the policy", async () => {
			const hop = "https://cdn.example.com/hop.mp3";
			const { calls, fetchImpl } = fakeSchoolCity(assets(hop), {
				...okRoutes,
				[hop]: redirect(AUDIO_URL),
			});
			const response = await (await provider(fetchImpl)).synthesize({
				text: "Hello world",
			});
			expect([...response.audio]).toEqual([1, 2, 3]);
			expect(calls.slice(-2).map((call) => call.url)).toEqual([hop, AUDIO_URL]);
		});

		it("resolves a relative Location against the current hop", async () => {
			const hop = "https://tts.example.com/audio/hop.mp3";
			const { calls, fetchImpl } = fakeSchoolCity(assets(hop), {
				...okRoutes,
				[hop]: redirect("a.mp3"),
			});
			await (await provider(fetchImpl)).synthesize({ text: "Hello world" });
			expect(calls.at(-1)?.url).toBe(AUDIO_URL);
		});

		it.each([
			["a cloud metadata endpoint", "http://169.254.169.254/latest/", /cloud metadata/],
			["a private host", "http://127.0.0.1/a.mp3", /private\/internal host/],
			["an origin outside the policy", "https://evil.example.org/a.mp3", /not allow-listed/],
			["a non-http scheme", "file:///etc/passwd", /unsupported protocol/],
		])("stops a redirect to %s before fetching it", async (_, target, message) => {
			const { calls, error } = await audioRejection(
				AUDIO_URL,
				{},
				{ ...okRoutes, [AUDIO_URL]: redirect(target) },
			);
			expect(error.message).toMatch(message);
			expect(calls.map((call) => call.url)).not.toContain(target);
		});

		it("gives up after maxAssetRedirects hops", async () => {
			const hops = [1, 2, 3].map(
				(n) => `https://tts.example.com/audio/hop-${n}.mp3`,
			);
			const { error } = await audioRejection(
				hops[0],
				{ maxAssetRedirects: 1 },
				{
					...okRoutes,
					[hops[0]]: redirect(hops[1]),
					[hops[1]]: redirect(hops[2]),
				},
			);
			expect(error.message).toBe(
				"SchoolCity asset redirect chain exceeded limit",
			);
			expect(error.details).toEqual({ limit: 1, lastUrl: hops[1] });
		});

		it("refuses every redirect when maxAssetRedirects is 0", async () => {
			const { error } = await audioRejection(
				AUDIO_URL,
				{ maxAssetRedirects: 0 },
				{ ...okRoutes, [AUDIO_URL]: redirect(MARKS_URL) },
			);
			expect(error.message).toBe(
				"SchoolCity asset redirect chain exceeded limit",
			);
		});
	});
});
