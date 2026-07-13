import { describe, expect, test } from "bun:test";
import {
	addRubricIfNeeded,
	assertPieConfigContract,
	elementForPackage,
	makeUniqueTags,
	validatePieConfigContract,
} from "../src/pie/config";
import type { ConfigContainerEntity } from "../src/types";

describe("elementForPackage", () => {
	test("throws when multiple element tags map to the same package name", () => {
		const config = {
			markup: "<div />",
			elements: {
				"pie-mc-a": "@pie-element/multiple-choice@1.0.0",
				"pie-mc-b": "@pie-element/multiple-choice@2.0.0",
			},
			models: [],
		};

		expect(() =>
			elementForPackage(config as any, "@pie-element/multiple-choice"),
		).toThrow("invalid item format: multiple elements for package.");
	});
});

describe("makeUniqueTags", () => {
	test("versions element tags, updates markup, and updates model.element", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup: "<pie-mc id='m1'></pie-mc>",
				elements: {
					"pie-mc": "@pie-element/multiple-choice@1.2.3",
				},
				models: [{ id: "m1", element: "pie-mc" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.elements).toEqual({
			"pie-mc--version-1-2-3": "@pie-element/multiple-choice@1.2.3",
		});
		expect(out.config.markup).toContain("<pie-mc--version-1-2-3");
		expect(out.config.markup).toContain("</pie-mc--version-1-2-3>");
		expect(out.config.models[0].element).toBe("pie-mc--version-1-2-3");
	});

	test("keeps tag unchanged when it already has the correct version", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup: "<pie-mc--version-1-2-3 id='m1'></pie-mc--version-1-2-3>",
				elements: {
					"pie-mc--version-1-2-3": "@pie-element/multiple-choice@1.2.3",
				},
				models: [{ id: "m1", element: "pie-mc--version-1-2-3" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.elements).toEqual(container.config.elements);
		expect(out.config.markup).toBe(container.config.markup);
		expect(out.config.models[0].element).toBe("pie-mc--version-1-2-3");
	});

	test("keeps prerelease tag unchanged when it already matches package version", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup:
					"<pie-mc--version-9-2-0-next-6 id='m1'></pie-mc--version-9-2-0-next-6>",
				elements: {
					"pie-mc--version-9-2-0-next-6":
						"@pie-element/multiple-choice@9.2.0-next.6",
				},
				models: [{ id: "m1", element: "pie-mc--version-9-2-0-next-6" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.elements).toEqual(container.config.elements);
		expect(out.config.markup).toBe(container.config.markup);
		expect(out.config.models[0].element).toBe("pie-mc--version-9-2-0-next-6");
	});

	test("normalizes a stale prerelease tag on the runtime copy", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup:
					"<pie-mc--version-9-2-0-next-6 id='m1'></pie-mc--version-9-2-0-next-6>",
				elements: {
					"pie-mc--version-9-2-0-next-6":
						"@pie-element/multiple-choice@9.2.0-next.7",
				},
				models: [{ id: "m1", element: "pie-mc--version-9-2-0-next-6" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.elements).toEqual({
			"pie-mc--version-9-2-0-next-7":
				"@pie-element/multiple-choice@9.2.0-next.7",
		});
		expect(out.config.markup).toContain("<pie-mc--version-9-2-0-next-7");
		expect(out.config.markup).toContain("</pie-mc--version-9-2-0-next-7>");
		expect(out.config.models[0].element).toBe("pie-mc--version-9-2-0-next-7");
		expect(container.config.markup).toContain("<pie-mc--version-9-2-0-next-6");
	});

	test("keeps build-metadata tag unchanged when it already matches package version", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup:
					"<pie-mc--version-1-2-3-build-5 id='m1'></pie-mc--version-1-2-3-build-5>",
				elements: {
					"pie-mc--version-1-2-3-build-5":
						"@pie-element/multiple-choice@1.2.3+build.5",
				},
				models: [{ id: "m1", element: "pie-mc--version-1-2-3-build-5" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.elements).toEqual(container.config.elements);
		expect(out.config.markup).toBe(container.config.markup);
		expect(out.config.models[0].element).toBe("pie-mc--version-1-2-3-build-5");
	});

	test("normalizes stale build metadata on the runtime copy", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup:
					"<pie-mc--version-1-2-3-build-5 id='m1'></pie-mc--version-1-2-3-build-5>",
				elements: {
					"pie-mc--version-1-2-3-build-5":
						"@pie-element/multiple-choice@1.2.3+build.6",
				},
				models: [{ id: "m1", element: "pie-mc--version-1-2-3-build-5" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.elements).toEqual({
			"pie-mc--version-1-2-3-build-6":
				"@pie-element/multiple-choice@1.2.3+build.6",
		});
		expect(out.config.markup).toContain("<pie-mc--version-1-2-3-build-6");
		expect(out.config.markup).toContain("</pie-mc--version-1-2-3-build-6>");
		expect(out.config.models[0].element).toBe("pie-mc--version-1-2-3-build-6");
		expect(container.config.markup).toContain("<pie-mc--version-1-2-3-build-5");
	});

	test("is idempotent for prerelease plus build versions", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup:
					"<pie-mc--version-1-2-3-rc-1-sha-9 id='m1'></pie-mc--version-1-2-3-rc-1-sha-9>",
				elements: {
					"pie-mc--version-1-2-3-rc-1-sha-9":
						"@pie-element/multiple-choice@1.2.3-rc.1+sha.9",
				},
				models: [{ id: "m1", element: "pie-mc--version-1-2-3-rc-1-sha-9" }],
			},
		};

		const once = makeUniqueTags(container);
		const twice = makeUniqueTags(once as ConfigContainerEntity);
		expect(twice).toEqual(once);
	});

	test("rewrites prefix tags independently and remains idempotent", () => {
		const container: ConfigContainerEntity = {
			id: "item-prefixes",
			config: {
				markup:
					'<pie-foo id="short"></pie-foo><pie-foo-bar id="long"></pie-foo-bar>',
				elements: {
					"pie-foo": "@pie-element/foo@1.2.3",
					"pie-foo-bar": "@pie-element/foo-bar@2.0.0",
				},
				models: [
					{ id: "short", element: "pie-foo" },
					{ id: "long", element: "pie-foo-bar" },
				],
			},
		};

		const once = makeUniqueTags(container);
		expect(once.config.markup).toBe(
			'<pie-foo--version-1-2-3 id="short"></pie-foo--version-1-2-3><pie-foo-bar--version-2-0-0 id="long"></pie-foo-bar--version-2-0-0>',
		);
		expect(once.config.models).toEqual([
			{ id: "short", element: "pie-foo--version-1-2-3" },
			{ id: "long", element: "pie-foo-bar--version-2-0-0" },
		]);
		expect(makeUniqueTags(once)).toEqual(once);
	});

	test("treats regexp-significant legal tag characters literally", () => {
		const container: ConfigContainerEntity = {
			id: "item-regexp-tags",
			config: {
				markup:
					'<pie-foo.bar id="dot"></pie-foo.bar><pie-foo-bar id="dash"></pie-foo-bar><pie-foo_bar id="underscore"></pie-foo_bar>',
				elements: {
					"pie-foo.bar": "@pie-element/foo-dot@1.0.0",
					"pie-foo-bar": "@pie-element/foo-dash@2.0.0",
					"pie-foo_bar": "@pie-element/foo-underscore@3.0.0",
				},
				models: [
					{ id: "dot", element: "pie-foo.bar" },
					{ id: "dash", element: "pie-foo-bar" },
					{ id: "underscore", element: "pie-foo_bar" },
				],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.markup).toBe(
			'<pie-foo.bar--version-1-0-0 id="dot"></pie-foo.bar--version-1-0-0><pie-foo-bar--version-2-0-0 id="dash"></pie-foo-bar--version-2-0-0><pie-foo_bar--version-3-0-0 id="underscore"></pie-foo_bar--version-3-0-0>',
		);
	});

	test("preserves the established empty version suffix for unversioned package specs", () => {
		const container: ConfigContainerEntity = {
			id: "item-unversioned",
			config: {
				markup: '<pie-foo id="m1"></pie-foo>',
				elements: { "pie-foo": "@pie-element/foo" },
				models: [{ id: "m1", element: "pie-foo" }],
			},
		};

		expect(makeUniqueTags(container)).toEqual({
			...container,
			config: {
				...container.config,
				markup: '<pie-foo--version- id="m1"></pie-foo--version->',
				elements: { "pie-foo--version-": "@pie-element/foo" },
				models: [{ id: "m1", element: "pie-foo--version-" }],
			},
		});
	});

	test("repairs one legacy base model reference without mutating the input", () => {
		const container: ConfigContainerEntity = {
			id: "item-base-model-reference",
			config: {
				markup: '<pie-foo--version-1-0-0 id="m1"></pie-foo--version-1-0-0>',
				elements: {
					"pie-foo--version-1-0-0": "@pie-element/foo@1.0.0",
				},
				models: [{ id: "m1", element: "pie-foo" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.models[0].element).toBe("pie-foo--version-1-0-0");
		expect(container.config.models[0].element).toBe("pie-foo");
	});

	test("does not guess a version for an ambiguous base model reference", () => {
		const container: ConfigContainerEntity = {
			id: "item-ambiguous-base-model-reference",
			config: {
				markup:
					'<pie-foo--version-1-0-0 id="m1"></pie-foo--version-1-0-0><pie-foo--version-2-0-0 id="m2"></pie-foo--version-2-0-0>',
				elements: {
					"pie-foo--version-1-0-0": "@pie-element/foo@1.0.0",
					"pie-foo--version-2-0-0": "@pie-element/foo@2.0.0",
				},
				models: [{ id: "m1", element: "pie-foo" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.models[0].element).toBe("pie-foo");
		expect(container.config.models[0].element).toBe("pie-foo");
	});
});

describe("addRubricIfNeeded", () => {
	test("adds rubric element markup when missing", () => {
		const config = {
			markup: "<pie-mc id='m1'></pie-mc>",
			elements: {
				"pie-mc": "@pie-element/multiple-choice@1.0.0",
				"pie-rubric": "@pie-element/rubric@1.0.0",
			},
			models: [
				{ id: "m1", element: "pie-mc" },
				{ id: "r1", element: "pie-rubric" },
			],
		};

		const out = addRubricIfNeeded(config as any);
		expect(out.markup).toContain("<pie-rubric id='r1'></pie-rubric>");
	});
});

describe("validatePieConfigContract", () => {
	test("accepts a minimal valid config", () => {
		const result = validatePieConfigContract({
			markup: '<pie-mc id="m1"></pie-mc>',
			elements: {
				"pie-mc": "@pie-element/multiple-choice@1.0.0",
			},
			models: [{ id: "m1", element: "pie-mc" }],
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("accepts a legacy package spec without an explicit version", () => {
		const result = validatePieConfigContract({
			markup: '<pie-mc id="m1"></pie-mc>',
			elements: {
				"pie-mc": "@pie-element/multiple-choice",
			},
			models: [{ id: "m1", element: "pie-mc" }],
		});

		expect(result).toEqual({ valid: true, errors: [], warnings: [] });
	});

	test("accepts a stale full tag for runtime-copy normalization", () => {
		const result = validatePieConfigContract({
			markup: '<pie-mc--version-1-2-3 id="m1"></pie-mc--version-1-2-3>',
			elements: {
				"pie-mc--version-1-2-3": "@pie-element/multiple-choice@1.2.4",
			},
			models: [{ id: "m1", element: "pie-mc--version-1-2-3" }],
		});

		expect(result).toEqual({ valid: true, errors: [], warnings: [] });
	});

	test("recognizes legal dot and underscore characters in markup tags", () => {
		const result = validatePieConfigContract({
			markup:
				'<pie-input.inline id="dot"></pie-input.inline><pie-input_value id="underscore"></pie-input_value>',
			elements: {
				"pie-input.inline": "@pie-element/input-inline@1.0.0",
				"pie-input_value": "@pie-element/input-value@1.0.0",
			},
			models: [
				{ id: "dot", element: "pie-input.inline" },
				{ id: "underscore", element: "pie-input_value" },
			],
		});

		expect(result).toEqual({ valid: true, errors: [], warnings: [] });
	});

	test("fails when model.element is not declared in elements", () => {
		const result = validatePieConfigContract({
			markup: '<pie-mc id="m1"></pie-mc>',
			elements: {
				"pie-mc": "@pie-element/multiple-choice@1.0.0",
			},
			models: [{ id: "m1", element: "pie-other" }],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.join(" | ")).toContain(
			'Model element "pie-other" is not declared in `elements`.',
		);
	});

	test("fails when custom tags in markup are not declared in elements", () => {
		const result = validatePieConfigContract({
			markup: '<pie-missing id="x"></pie-missing>',
			elements: {
				"pie-mc": "@pie-element/multiple-choice@1.0.0",
			},
			models: [{ id: "m1", element: "pie-mc" }],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.join(" | ")).toContain(
			'Markup tag "pie-missing" is not declared in `elements`.',
		);
	});

	test("warns when declared elements are not referenced by models or markup", () => {
		const result = validatePieConfigContract({
			markup: "<div>plain</div>",
			elements: {
				"pie-mc": "@pie-element/multiple-choice@1.0.0",
			},
			models: [],
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings.join(" | ")).toContain(
			'Element "pie-mc" is declared in `elements` but not referenced by models or markup.',
		);
	});

	test("accepts html-only config with empty elements/models", () => {
		const result = validatePieConfigContract({
			markup: "<div>Passage content</div>",
			elements: {},
			models: [],
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("assertPieConfigContract throws with consolidated message", () => {
		expect(() =>
			assertPieConfigContract({
				markup: "<div />",
				elements: {
					"pie-mc": "",
				},
				models: [],
			}),
		).toThrow("Invalid PIE config contract:");
	});

	test("assertPieConfigContract does not throw for warning-only contracts", () => {
		expect(() =>
			assertPieConfigContract({
				markup: "<div>plain</div>",
				elements: {
					"pie-mc": "@pie-element/multiple-choice@1.0.0",
				},
				models: [],
			}),
		).not.toThrow();
	});
});
