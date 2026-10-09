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
	(supportId: string): ContentCapabilityPolicy =>
		supportIds.includes(supportId) ? { outcome: "granted" } : SILENT;

const grantsNothing = (): ContentCapabilityPolicy => SILENT;

/** Host gate on the named ids; everything else unconfigured. */
const denying =
	(...deniedIds: string[]) =>
	(supportId: string): ContentCapabilityPolicy =>
		deniedIds.includes(supportId) ? DENIED : SILENT;

describe("resolveContentCapabilities", () => {
	it("resolves a granted capability whose content is present", () => {
		const resolved = resolveContentCapabilities({
			registrations: [withContent(() => ({ text: "here" }))],
			catalogs,
			policyFor: granting("alternate"),
		});

		expect(resolved).toHaveLength(1);
		expect(resolved[0]?.content).toEqual({ text: "here" });
		expect(resolved[0]?.granted).toBe(true);
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
		expect(resolved[0]?.granted).toBe(false);
		// How the capability tells authored presentation from an accommodation.
		expect(seen[0]?.granted).toBe(false);
		expect(seen[0]?.catalogs).toBe(catalogs);
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
			policyFor: (supportId) => {
				if (supportId === "first") throw new Error("policy exploded");
				return { outcome: "granted" };
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

	it("asks policy once, by tool id", () => {
		const asked: string[] = [];
		resolveContentCapabilities({
			registrations: [withContent(() => ({ text: "here" }))],
			catalogs,
			policyFor: (supportId) => {
				asked.push(supportId);
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
