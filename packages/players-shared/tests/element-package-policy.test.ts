import { describe, expect, test } from "bun:test";

import {
	assertElementPackagesAllowed,
	ElementPackagePolicyError,
} from "../src/loaders/element-package-policy.js";

describe("element package policy", () => {
	test("is a no-op when omitted", () => {
		expect(() =>
			assertElementPackagesAllowed({
				"pie-example--version-latest": "attacker-controlled-package@latest",
			}),
		).not.toThrow();
	});

	test("allows exact package names and versions", () => {
		for (const version of ["1.2.3", "1.2.3-alpha.1"]) {
			expect(() =>
				assertElementPackagesAllowed(
					{
						"pie-example--version-policy": `@pie-element/example/browser@${version}`,
					},
					{ allowedPackages: ["@pie-element/example/browser"] },
				),
			).not.toThrow();
		}
	});

	test("rejects build metadata when policy is enabled", () => {
		expect(() =>
			assertElementPackagesAllowed(
				{
					"pie-example--version-policy":
						"@pie-element/example@1.2.3+attacker-package",
				},
				{ allowedPackages: ["@pie-element/example"] },
			),
		).toThrow(ElementPackagePolicyError);
	});

	test("can pin one allowed package version", () => {
		expect(() =>
			assertElementPackagesAllowed(
				{
					"pie-example--version-1-2-4": "@pie-element/example@1.2.4",
				},
				{ allowedPackages: ["@pie-element/example@1.2.3"] },
			),
		).toThrow(ElementPackagePolicyError);
	});

	test.each([
		"latest",
		"^1.2.3",
		"~1.2.3",
		"1.2",
		"01.2.3",
	])("rejects non-exact version %s by default", (version) => {
		expect(() =>
			assertElementPackagesAllowed(
				{
					"pie-example--version-policy": `@pie-element/example@${version}`,
				},
				{ allowedPackages: ["@pie-element/example"] },
			),
		).toThrow(ElementPackagePolicyError);
	});

	test("can explicitly permit a non-exact spec", () => {
		expect(() =>
			assertElementPackagesAllowed(
				{
					"pie-example--version-latest": "@pie-element/example@latest",
				},
				{
					allowedPackages: ["@pie-element/example"],
					requireExactVersions: false,
				},
			),
		).not.toThrow();
	});
});
