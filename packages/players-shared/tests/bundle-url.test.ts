/**
 * Build-service bundle path encoding.
 *
 * `config.elements` is authored content and its values land in a URL path, so
 * these tests pin both halves of the encoding rule: a legitimate scoped spec
 * survives byte-for-byte (`/` and `@` literal, `+` literal between specs), and
 * anything that could restructure the URL is percent-escaped.
 */

import { describe, expect, test } from "bun:test";

import {
	encodeElementPackageSpec,
	encodeElementPackageSpecs,
	getPieElementBundlesUrl,
} from "../src/pie/utils.js";
import { BundleType } from "../src/pie/types.js";
import type { ConfigEntity } from "../src/types/index.js";

const bundlesUrlFor = (elements: Record<string, string>): string =>
	getPieElementBundlesUrl({ elements } as unknown as ConfigEntity, {
		buildServiceBase: "https://proxy.pie-api.com/bundles",
		bundleType: BundleType.player,
	});

describe("encodeElementPackageSpec", () => {
	test("leaves a scoped package spec literal", () => {
		expect(
			encodeElementPackageSpec("@pie-element/multiple-choice@9.9.1"),
		).toBe("@pie-element/multiple-choice@9.9.1");
	});

	test("leaves an unscoped spec with a subpath and a prerelease literal", () => {
		expect(encodeElementPackageSpec("lodash/get@4.4.2-beta.1")).toBe(
			"lodash/get@4.4.2-beta.1",
		);
	});

	test("escapes `#` so the URL cannot truncate at a fragment", () => {
		expect(encodeElementPackageSpec("@pie-element/mc@1.0.0#frag")).toBe(
			"@pie-element/mc@1.0.0%23frag",
		);
	});

	test("escapes `?` so the rest of the path cannot become a query string", () => {
		expect(encodeElementPackageSpec("@pie-element/mc@1.0.0?a=b")).toBe(
			"@pie-element/mc@1.0.0%3Fa%3Db",
		);
	});

	test("escapes an in-spec `+` so it cannot forge a package boundary", () => {
		expect(encodeElementPackageSpec("@pie-element/mc@1.0.0+build.5")).toBe(
			"@pie-element/mc@1.0.0%2Bbuild.5",
		);
	});

	test("escapes `%` so an authored escape cannot be decoded downstream", () => {
		expect(encodeElementPackageSpec("@pie-element/mc%2F..%2Fx@1.0.0")).toBe(
			"@pie-element/mc%252F..%252Fx@1.0.0",
		);
	});

	test("escapes `\\`, which the URL parser would normalize to `/`", () => {
		expect(encodeElementPackageSpec("@pie-element\\..\\x@1.0.0")).toBe(
			"@pie-element%5C..%5Cx@1.0.0",
		);
	});

	test("escapes every `/` in a spec carrying a `.` or `..` segment", () => {
		expect(encodeElementPackageSpec("@pie-element/../../evil@1.0.0")).toBe(
			"@pie-element%2F..%2F..%2Fevil@1.0.0",
		);
		expect(encodeElementPackageSpec("@pie-element/./evil@1.0.0")).toBe(
			"@pie-element%2F.%2Fevil@1.0.0",
		);
	});

	test("leaves a dot inside a segment alone", () => {
		expect(encodeElementPackageSpec("@pie-element/a.b@1.0.0")).toBe(
			"@pie-element/a.b@1.0.0",
		);
		expect(encodeElementPackageSpec("@pie-element/...@1.0.0")).toBe(
			"@pie-element/...@1.0.0",
		);
	});
});

describe("encodeElementPackageSpecs", () => {
	test("joins encoded specs with a literal `+` separator", () => {
		expect(
			encodeElementPackageSpecs([
				"@pie-element/multiple-choice@9.9.1",
				"@pie-element/hotspot@9.1.0",
			]),
		).toBe("@pie-element/multiple-choice@9.9.1+@pie-element/hotspot@9.1.0");
	});

	test("encodes each spec independently, keeping the separator literal", () => {
		expect(
			encodeElementPackageSpecs([
				"@pie-element/mc@1.0.0#frag",
				"@pie-element/hotspot@9.1.0",
			]),
		).toBe("@pie-element/mc@1.0.0%23frag+@pie-element/hotspot@9.1.0");
	});
});

describe("getPieElementBundlesUrl", () => {
	test("keeps a scoped spec's `/` and `@` literal in the path", () => {
		expect(
			bundlesUrlFor({
				"pie-mc--version-9-9-1": "@pie-element/multiple-choice@9.9.1",
			}),
		).toBe(
			"https://proxy.pie-api.com/bundles/@pie-element/multiple-choice@9.9.1/player.js",
		);
	});

	test("joins a multi-element list with a literal `+`", () => {
		const url = bundlesUrlFor({
			"pie-mc--version-9-9-1": "@pie-element/multiple-choice@9.9.1",
			"pie-hotspot--version-9-1-0": "@pie-element/hotspot@9.1.0",
		});

		expect(url).toBe(
			"https://proxy.pie-api.com/bundles/@pie-element/multiple-choice@9.9.1+@pie-element/hotspot@9.1.0/player.js",
		);
		expect(new URL(url).pathname.endsWith("/player.js")).toBe(true);
	});

	test("a `#` in a spec no longer truncates the path at a fragment", () => {
		const url = bundlesUrlFor({
			"pie-mc--version-1-0-0": "@pie-element/mc@1.0.0#/../../evil",
		});

		expect(url).toBe(
			"https://proxy.pie-api.com/bundles/@pie-element%2Fmc@1.0.0%23%2F..%2F..%2Fevil/player.js",
		);
		expect(new URL(url).hash).toBe("");
		expect(new URL(url).pathname).toBe(
			"/bundles/@pie-element%2Fmc@1.0.0%23%2F..%2F..%2Fevil/player.js",
		);
	});

	test("a `?` in a spec no longer turns the path into a query string", () => {
		const url = bundlesUrlFor({
			"pie-mc--version-1-0-0": "@pie-element/mc@1.0.0?x=1",
		});

		expect(url).toBe(
			"https://proxy.pie-api.com/bundles/@pie-element/mc@1.0.0%3Fx%3D1/player.js",
		);
		expect(new URL(url).search).toBe("");
	});

	test("a `..` spec segment no longer escapes the bundles route", () => {
		const url = bundlesUrlFor({
			"pie-mc--version-1-0-0": "@pie-element/../../evil@1.0.0",
		});

		expect(new URL(url).pathname).toBe(
			"/bundles/@pie-element%2F..%2F..%2Fevil@1.0.0/player.js",
		);
	});
});
