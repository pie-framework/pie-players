import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RELAYED_ITEM_PLAYER_EVENTS } from "@pie-players/pie-assessment-toolkit";
import {
	ITEM_PLAYER_EVENT_PARITY,
	ITEM_PLAYER_METHOD_PARITY,
	ITEM_PLAYER_PROPERTY_PARITY,
} from "../src/contracts/item-player-parity.js";
import type { SectionPlayerItemPlayerProps } from "../src/components/shared/section-player-backend-delivery.js";
import { SectionController } from "../src/controllers/SectionController.js";

/**
 * Every part of `<pie-item-player>`'s public surface is classified in
 * `src/contracts/item-player-parity.ts`, and each classification holds in the
 * section player's own surface.
 */

const PACKAGES_ROOT = resolve(__dirname, "../..");

const LAYOUT_TAGS = [
	"pie-section-player-splitpane",
	"pie-section-player-vertical",
	"pie-section-player-tabbed",
	"pie-section-player-kernel-host",
] as const;

type ManifestMember = { kind: string; name: string };
type ManifestDeclaration = {
	tagName?: string;
	members?: ManifestMember[];
	events?: Array<{ name: string }>;
};

function declaration(packageDir: string, tagName: string): ManifestDeclaration {
	const manifest = JSON.parse(
		readFileSync(resolve(PACKAGES_ROOT, packageDir, "custom-elements.json"), "utf8"),
	) as { modules: Array<{ declarations?: ManifestDeclaration[] }> };
	const found = manifest.modules
		.flatMap((module) => module.declarations ?? [])
		.find((entry) => entry.tagName === tagName);
	if (!found) throw new Error(`${tagName} is not in ${packageDir}'s manifest`);
	return found;
}

function memberNames(entry: ManifestDeclaration, kind: string): string[] {
	return (entry.members ?? [])
		.filter((member) => member.kind === kind)
		.map((member) => member.name)
		.sort();
}

const itemPlayer = declaration("item-player", "pie-item-player");

// The `host` properties are the typed `runtime.player` props, less the two
// that override a section default.
type HostProperty = {
	[K in keyof typeof ITEM_PLAYER_PROPERTY_PARITY]: (typeof ITEM_PLAYER_PROPERTY_PARITY)[K] extends "host"
		? K
		: never;
}[keyof typeof ITEM_PLAYER_PROPERTY_PARITY];
type SameKeys<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const HOST_PROPERTIES_ARE_TYPED: SameKeys<
	HostProperty,
	Exclude<keyof SectionPlayerItemPlayerProps, "baseHeadingLevel" | "includeSrHeading">
> = true;
void HOST_PROPERTIES_ARE_TYPED;

describe("item player parity", () => {
	test("classifies every item player property", () => {
		expect(Object.keys(ITEM_PLAYER_PROPERTY_PARITY).sort()).toEqual(
			memberNames(itemPlayer, "field"),
		);
	});

	test("classifies every item player method", () => {
		expect(Object.keys(ITEM_PLAYER_METHOD_PARITY).sort()).toEqual(
			memberNames(itemPlayer, "method"),
		);
	});

	test("classifies every item player event", () => {
		expect(Object.keys(ITEM_PLAYER_EVENT_PARITY).sort()).toEqual(
			(itemPlayer.events ?? []).map((event) => event.name).sort(),
		);
	});

	test("relays exactly the events classified as relayed", () => {
		const relayed = Object.entries(ITEM_PLAYER_EVENT_PARITY)
			.filter(([, parity]) => parity === "relayed")
			.map(([name]) => name)
			.sort();
		expect<string[]>([...RELAYED_ITEM_PLAYER_EVENTS].sort()).toEqual(relayed);
	});

	test("the section controller has every member a method maps to", () => {
		const members = Object.values(ITEM_PLAYER_METHOD_PARITY).flatMap((parity) =>
			typeof parity === "object" ? [parity.controller] : [],
		);
		for (const name of members) {
			expect(typeof SectionController.prototype[name]).toBe("function");
		}
	});

	for (const tagName of LAYOUT_TAGS) {
		test(`${tagName} fires item-player-event`, () => {
			const events = (declaration("section-player", tagName).events ?? []).map(
				(event) => event.name,
			);
			expect(events).toContain("item-player-event");
		});
	}
});
