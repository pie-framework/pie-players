import { describe, expect, test } from "bun:test";
import {
	normalizeToolsConfig,
	parseToolList,
} from "../src/services/tools-config-normalizer";

describe("tools-config-normalizer", () => {
	test("normalizes ids and removes duplicates", () => {
		expect(
			parseToolList("calculator, textToSpeech, textToSpeech, graph"),
		).toEqual(["calculator", "textToSpeech", "graph"]);
	});

	test("normalizes policy and placement independently", () => {
		const config = normalizeToolsConfig({
			policy: {
				allowed: ["calculator", "textToSpeech", "graph"],
				blocked: ["graph"],
			},
			placement: {
				item: ["calculator", "textToSpeech", "graph", "periodicTable"],
			},
		});

		expect(config.policy.allowed).toEqual([
			"calculator",
			"textToSpeech",
			"graph",
		]);
		expect(config.policy.blocked).toEqual(["graph"]);
		expect(config.placement.item).toEqual([
			"calculator",
			"textToSpeech",
			"graph",
			"periodicTable",
		]);
	});

	test("fills missing placement levels with opt-in defaults", () => {
		const config = normalizeToolsConfig({
			placement: {
				section: ["graph"],
			},
		});

		expect(config.placement.section).toEqual(["graph"]);
		expect(config.placement.item).toEqual([]);
		expect(config.placement.passage).toEqual([]);
	});

	test("normalizes pnpEnforcement", () => {
		expect(normalizeToolsConfig({ pnpEnforcement: "off" }).pnpEnforcement).toBe(
			"off",
		);
	});

	test("allows string runtime provider selectors for textToSpeech", () => {
		const config = normalizeToolsConfig({
			providers: {
				textToSpeech: {
					enabled: true,
					provider: "polly",
				},
			},
		});

		expect(config.providers.textToSpeech).toMatchObject({
			enabled: true,
			provider: "polly",
		});
	});

	test("rejects string provider selectors for non-TTS tools", () => {
		expect(() =>
			normalizeToolsConfig({
				providers: {
					calculator: {
						provider: "polly",
					},
				},
			}),
		).toThrow(
			'Invalid tools config at "providers.calculator.provider": expected an object.',
		);
	});
});
