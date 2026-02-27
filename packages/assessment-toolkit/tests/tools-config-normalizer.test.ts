import { describe, expect, test } from "bun:test";
import {
	normalizeToolsConfig,
	parseToolList,
	resolveToolsForLevel,
} from "../src/services/tools-config-normalizer";

describe("tools-config-normalizer", () => {
	test("normalizes aliases and removes duplicates", () => {
		expect(parseToolList("calculator, tts, tts, graph")).toEqual([
			"calculator",
			"textToSpeech",
			"graph",
		]);
	});

	test("applies policy allow/block to placement", () => {
		const config = normalizeToolsConfig({
			policy: {
				allowed: ["calculator", "textToSpeech", "graph"],
				blocked: ["graph"],
			},
			placement: {
				item: ["calculator", "textToSpeech", "graph", "periodicTable"],
			},
		});

		expect(resolveToolsForLevel(config, "item")).toEqual([
			"calculator",
			"textToSpeech",
		]);
	});

	test("fills missing placement levels with defaults", () => {
		const config = normalizeToolsConfig({
			placement: {
				section: ["graph"],
			},
		});

		expect(config.placement.section).toEqual(["graph"]);
		expect(config.placement.item.length).toBeGreaterThan(0);
		expect(config.placement.passage.length).toBeGreaterThan(0);
	});
});
