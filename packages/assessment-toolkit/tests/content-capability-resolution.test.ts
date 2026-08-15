/**
 * The grant-AND-content rule, independent of who is rendering.
 *
 * Both halves and their one exception are pinned here rather than in either
 * renderer's tests, because the point of the module is that the section player
 * and print cannot answer this differently. The registrations are local
 * fakes — nothing here should hold for a capability and not for its neighbour.
 */

import { describe, expect, it } from "bun:test";
import type {
	ToolContentDependencyContext,
	ToolRegistration,
} from "../src/services/ToolRegistry.js";
import type { CatalogOwnerSnapshot } from "../src/services/AccessibilityCatalogResolver.js";
import {
	resolveContentCapabilities,
	type ContentCapabilityPolicy,
} from "../src/tools/content-capability-resolution.js";

const catalogs: CatalogOwnerSnapshot = {
	cards: [{ catalogId: "c1", card: { catalog: "example" } as never }],
};

const capability = (
	overrides: Partial<ToolRegistration> = {},
): ToolRegistration =>
	({
		toolId: "alternate",
		name: "Alternate",
		description: "An authored alternate",
		supportedLevels: ["item"],
		activation: "region",
		surfaces: ["content-lead"],
		renderSurface: () => null,
		...overrides,
	}) as ToolRegistration;

const withContent = (
	resolve: (context: ToolContentDependencyContext) => unknown,
	overrides: Partial<ToolRegistration> = {},
) => capability({ requiresAuthoredContent: { resolve }, ...overrides });

const SILENT: ContentCapabilityPolicy = { outcome: "silent" };
const DENIED: ContentCapabilityPolicy = { outcome: "denied" };

const granting =
	(...supportIds: string[]) =>
	(featureId: string): ContentCapabilityPolicy =>
		supportIds.includes(featureId)
			? { outcome: "granted", featureId }
			: SILENT;

const grantsNothing = (): ContentCapabilityPolicy => SILENT;

/** Host gate on the named ids; everything else unconfigured. */
const denying =
	(...deniedIds: string[]) =>
	(featureId: string): ContentCapabilityPolicy =>
		deniedIds.includes(featureId) ? DENIED : SILENT;

describe("resolveContentCapabilities", () => {
	it("resolves a granted capability whose content is present", () => {
		const resolved = resolveContentCapabilities({
			registrations: [withContent(() => ({ text: "here" }))],
			catalogs,
			policyFor: granting("alternate"),
		});

		expect(resolved).toHaveLength(1);
		expect(resolved[0]?.content).toEqual({ text: "here" });
		expect(resolved[0]?.featureId).toBe("alternate");
	});

	it("drops a granted capability whose content is absent", () => {
		const resolved = resolveContentCapabilities({
			registrations: [withContent(() => null)],
			catalogs,
			policyFor: granting("alternate"),
		});

		expect(resolved).toHaveLength(0);
	});

	it("does not consult content when nothing was granted", () => {
		let asked = false;
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(() => {
					asked = true;
					return { text: "here" };
				}),
			],
			catalogs,
			policyFor: grantsNothing,
		});

		expect(resolved).toHaveLength(0);
		expect(asked).toBe(false);
	});

	it("consults content without a grant when the capability asks to be", () => {
		const seen: ToolContentDependencyContext[] = [];
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(
					(context) => {
						seen.push(context);
						return { text: "authored presentation" };
					},
					{ resolvesWithoutGrant: true },
				),
			],
			catalogs,
			policyFor: grantsNothing,
		});

		expect(resolved).toHaveLength(1);
		// How the capability tells authored presentation from an accommodation.
		expect(seen[0]?.granted).toBe(false);
		expect(seen[0]?.featureId).toBe("");
		expect(seen[0]?.catalogs).toBe(catalogs);
	});

	it("takes the first granted support id a capability declares", () => {
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(() => ({ text: "here" }), {
					pnpSupportIds: ["primary", "secondary"],
				}),
			],
			catalogs,
			policyFor: granting("secondary"),
		});

		expect(resolved[0]?.featureId).toBe("secondary");
	});

	it("needs only a grant when a capability declares no content dependency", () => {
		const resolved = resolveContentCapabilities({
			registrations: [capability()],
			catalogs,
			policyFor: granting("alternate"),
		});

		expect(resolved).toHaveLength(1);
		expect(resolved[0]?.content).toBeNull();
	});

	it("drops a capability whose own resolution threw, and names the half", () => {
		const failures: string[] = [];
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(() => {
					throw new Error("bad card");
				}),
			],
			catalogs,
			policyFor: granting("alternate"),
			onError: (registration, phase) =>
				failures.push(`${registration.toolId}:${phase}`),
		});

		expect(resolved).toHaveLength(0);
		expect(failures).toEqual(["alternate:content"]);
	});

	it("drops a capability whose policy lookup threw, and keeps the others", () => {
		const failures: string[] = [];
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(() => ({ text: "first" }), { toolId: "first" }),
				withContent(() => ({ text: "second" }), { toolId: "second" }),
			],
			catalogs,
			policyFor: (featureId) => {
				if (featureId === "first") throw new Error("policy exploded");
				return { outcome: "granted", featureId };
			},
			onError: (registration, phase) =>
				failures.push(`${registration.toolId}:${phase}`),
		});

		expect(resolved.map((entry) => entry.registration.toolId)).toEqual([
			"second",
		]);
		expect(failures).toEqual(["first:policy"]);
	});

	it("does not consult content when a host denied the capability", () => {
		let asked = false;
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(
					() => {
						asked = true;
						return { text: "authored presentation" };
					},
					{ resolvesWithoutGrant: true },
				),
			],
			catalogs,
			policyFor: denying("alternate"),
		});

		// The whole point of the third state: `resolvesWithoutGrant` reads silence as
		// permission to answer from the content, and an off switch is not silence.
		expect(resolved).toHaveLength(0);
		expect(asked).toBe(false);
	});

	it("lets a denial on one declared support id switch the capability off", () => {
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(() => ({ text: "here" }), {
					pnpSupportIds: ["primary", "secondary"],
					resolvesWithoutGrant: true,
				}),
			],
			catalogs,
			policyFor: (featureId) =>
				featureId === "primary" ? DENIED : { outcome: "granted", featureId },
		});

		expect(resolved).toHaveLength(0);
	});

	it("honours a host denial named against the tool id, not a support id", () => {
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(() => ({ text: "here" }), {
					toolId: "alternate",
					pnpSupportIds: ["someOtherSupportId"],
					resolvesWithoutGrant: true,
				}),
			],
			catalogs,
			// A host gate names capabilities, so the tool id has to be probed even
			// though the capability answers policy through a different support id.
			policyFor: denying("alternate"),
		});

		expect(resolved).toHaveLength(0);
	});

	it("ignores a grant on the tool id that is not a declared support id", () => {
		const asked: string[] = [];
		const resolved = resolveContentCapabilities({
			registrations: [
				capability({ toolId: "alternate", pnpSupportIds: ["declared"] }),
			],
			catalogs,
			policyFor: (featureId) => {
				asked.push(featureId);
				return featureId === "alternate"
					? { outcome: "granted", featureId }
					: SILENT;
			},
		});

		// The tool-id probe is a gate, never a second way to switch a capability on.
		expect(resolved).toHaveLength(0);
		expect(asked).toEqual(["declared", "alternate"]);
	});

	it("does not probe the tool id when it is already a declared support id", () => {
		const asked: string[] = [];
		resolveContentCapabilities({
			registrations: [withContent(() => ({ text: "here" }))],
			catalogs,
			policyFor: (featureId) => {
				asked.push(featureId);
				return SILENT;
			},
		});

		expect(asked).toEqual(["alternate"]);
	});

	it("preserves the order it was offered", () => {
		const resolved = resolveContentCapabilities({
			registrations: [
				withContent(() => ({ n: 1 }), { toolId: "a" }),
				withContent(() => null, { toolId: "b" }),
				withContent(() => ({ n: 3 }), { toolId: "c" }),
			],
			catalogs,
			policyFor: granting("a", "b", "c"),
		});

		expect(resolved.map((entry) => entry.registration.toolId)).toEqual([
			"a",
			"c",
		]);
	});
});
