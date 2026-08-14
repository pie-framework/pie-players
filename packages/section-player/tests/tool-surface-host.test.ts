import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	AccessibilityCatalogResolver,
	ToolRegistry,
	type AccessibilityCatalogResolverApi,
	type FrameworkErrorModel,
	type ToolkitCoordinatorApi,
	type ToolRegistration,
	type ToolSurfaceRenderContext,
} from "@pie-players/pie-assessment-toolkit";
import {
	createToolSurfaceHost,
	type ToolSurfaceHostInput,
	type ToolSurfaceHostSnapshot,
} from "../src/components/shared/tool-surface-host.js";

beforeAll(() => {
	GlobalRegistrator.register();
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

async function flush(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve = () => undefined;
	const promise = new Promise<void>((next) => {
		resolve = next;
	});
	return { promise, resolve };
}

function createCoordinator() {
	const grants = new Map<string, { granted: boolean; parameters?: unknown }>();
	const visibleTools = new Map<string, unknown>();
	const policyListeners = new Set<() => void>();
	const catalogResolver = new AccessibilityCatalogResolver();
	let catalogRevision = 0;
	const errors: FrameworkErrorModel[] = [];
	const coordinator = {
		decideFeaturePolicy: (featureId: string) =>
			grants.get(featureId) ?? { granted: false },
		decideToolPolicy: () => ({
			visibleTools: [...visibleTools].map(([toolId, settings]) => ({
				toolId,
				settings,
			})),
		}),
		onPolicyChange: (listener: () => void) => {
			policyListeners.add(listener);
			return () => policyListeners.delete(listener);
		},
		onCatalogsChange: (listener: () => void) =>
			catalogResolver.onCatalogsChange(listener),
		reportFrameworkError: (model: FrameworkErrorModel) => errors.push(model),
		ttsService: null,
		catalogResolver,
	} as unknown as ToolkitCoordinatorApi;

	return {
		coordinator,
		grants,
		visibleTools,
		errors,
		emitPolicy: () => {
			for (const listener of policyListeners) listener();
		},
		emitCatalogs: () => {
			catalogRevision += 1;
			catalogResolver.registerCatalogs(
				{ ownerKind: "itemModel", itemId: "item-1" },
				[{ identifier: `revision-${catalogRevision}`, cards: [] }],
			);
		},
		policyListenerCount: () => policyListeners.size,
	};
}

function regionTool(
	toolId: string,
	overrides: Partial<ToolRegistration> = {},
): ToolRegistration {
	return {
		toolId,
		name: toolId,
		description: `${toolId} surface tool`,
		supportedLevels: ["item"],
		activation: "region",
		surfaces: ["content-lead"],
		pnpSupportIds: [toolId],
		renderSurface: () => ({ element: document.createElement("div") }),
		...overrides,
	};
}

function contentInput(
	registry: ToolRegistry,
	coordinator: ToolkitCoordinatorApi,
	anchor: HTMLElement | null,
	overrides: Partial<ToolSurfaceHostInput> = {},
): ToolSurfaceHostInput {
	return {
		anchor,
		surface: "content-lead",
		registry,
		services: {
			toolkitCoordinator: coordinator,
			ttsService: null,
			catalogResolver: coordinator.catalogResolver,
		},
		scope: {
			kind: "content",
			ownerContext: { ownerKind: "itemModel", itemId: "item-1" },
		},
		...overrides,
	};
}

describe("Tool Surface Host", () => {
	test("live registry mutations mount, override, unregister, and clear without a host rerender", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		runtime.grants.set("first", { granted: true });
		runtime.grants.set("second", { granted: true });
		const anchor = document.createElement("div");
		const snapshots: ToolSurfaceHostSnapshot[] = [];
		const destroyed: string[] = [];
		const host = createToolSurfaceHost((value) => snapshots.push(value));
		host.update(contentInput(registry, runtime.coordinator, anchor));

		const firstElement = document.createElement("div");
		firstElement.dataset.version = "one";
		registry.register(
			regionTool("first", {
				renderSurface: () => ({
					element: firstElement,
					destroy: () => destroyed.push("one"),
				}),
			}),
		);
		await flush();
		expect(anchor.children).toHaveLength(1);
		expect(anchor.firstElementChild).toBe(firstElement);

		const replacement = document.createElement("div");
		replacement.dataset.version = "two";
		registry.override(
			regionTool("first", {
				renderSurface: () => ({
					element: replacement,
					destroy: () => destroyed.push("two"),
				}),
			}),
		);
		await flush();
		expect(destroyed).toEqual(["one"]);
		expect(anchor.firstElementChild).toBe(replacement);

		registry.register(regionTool("second"));
		await flush();
		expect(anchor.children).toHaveLength(2);
		registry.unregister("first");
		expect(destroyed).toEqual(["one", "two"]);
		expect(anchor.children).toHaveLength(1);
		registry.clear();
		expect(anchor.children).toHaveLength(0);
		expect(snapshots.at(-1)).toEqual({ mountable: false, occupied: false });
		host.destroy();
	});

	test("preserves registry order when lazy modules resolve out of order", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		const firstLoad = deferred();
		const secondLoad = deferred();
		registry.setToolModuleLoaders({
			first: () => firstLoad.promise,
			second: () => secondLoad.promise,
		});
		for (const id of ["first", "second"]) {
			runtime.grants.set(id, { granted: true });
			registry.register(
				regionTool(id, {
					renderSurface: () => {
						const element = document.createElement("div");
						element.dataset.toolId = id;
						return { element };
					},
				}),
			);
		}
		const anchor = document.createElement("div");
		const host = createToolSurfaceHost(() => undefined);
		host.update(contentInput(registry, runtime.coordinator, anchor));

		secondLoad.resolve();
		await flush();
		expect(
			[...anchor.children].map(
				(child) => (child as HTMLElement).dataset.toolId,
			),
		).toEqual(["second"]);
		firstLoad.resolve();
		await flush();
		expect(
			[...anchor.children].map(
				(child) => (child as HTMLElement).dataset.toolId,
			),
		).toEqual(["first", "second"]);
		host.destroy();
	});

	test("synchronizes current content without replacing the mounted element", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		runtime.grants.set("alternate", {
			granted: true,
			parameters: { language: "ase" },
		});
		let content: { label: string; fragment?: string } = {
			label: "first",
			fragment: undefined,
		};
		const contexts: ToolSurfaceRenderContext[] = [];
		const element = document.createElement("div");
		registry.register(
			regionTool("alternate", {
				requiresAuthoredContent: { resolve: () => content },
				renderSurface: (context) => ({
					element,
					sync: (next) => contexts.push(next),
				}),
			}),
		);
		const anchor = document.createElement("div");
		const host = createToolSurfaceHost(() => undefined);
		host.update(contentInput(registry, runtime.coordinator, anchor));
		await flush();
		runtime.emitCatalogs();
		expect(contexts).toHaveLength(0);
		content = { label: "second" };
		runtime.emitCatalogs();

		expect(anchor.firstElementChild).toBe(element);
		expect(contexts.at(-1)?.content).toEqual({ label: "second" });
		expect(contexts.at(-1)?.parameters).toEqual({ language: "ase" });
		host.destroy();
	});

	test("keeps mountable separate from occupied when rendering legitimately returns null", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		runtime.grants.set("empty", { granted: true });
		registry.register(regionTool("empty", { renderSurface: () => null }));
		const anchor = document.createElement("div");
		const snapshots: ToolSurfaceHostSnapshot[] = [];
		const host = createToolSurfaceHost((value) => snapshots.push(value));
		host.update(contentInput(registry, runtime.coordinator, anchor));
		await flush();

		expect(snapshots.at(-1)).toEqual({ mountable: true, occupied: false });
		expect(runtime.errors).toEqual([]);
		host.destroy();
	});

	test("isolates owner snapshot failure while mounting catalog-independent content", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		for (const id of ["catalog-dependent", "independent"]) {
			runtime.grants.set(id, { granted: true });
		}
		registry.register(
			regionTool("catalog-dependent", {
				requiresAuthoredContent: { resolve: ({ catalogs }) => catalogs },
			}),
		);
		const independent = document.createElement("div");
		registry.register(
			regionTool("independent", {
				renderSurface: () => ({ element: independent }),
			}),
		);
		const failingResolver = {
			forOwner: () => ({
				snapshot: () => {
					throw new Error("snapshot exploded");
				},
				onChange: () => () => undefined,
			}),
		} as unknown as AccessibilityCatalogResolverApi;
		const anchor = document.createElement("div");
		const input = contentInput(registry, runtime.coordinator, anchor);
		input.services = { ...input.services, catalogResolver: failingResolver };
		const host = createToolSurfaceHost(() => undefined);
		host.update(input);
		await flush();

		expect(anchor.firstElementChild).toBe(independent);
		expect(runtime.errors).toHaveLength(1);
		expect(runtime.errors[0]?.details).toContain("toolId=catalog-owner");
		expect(runtime.errors[0]?.recoverable).toBe(true);
		host.destroy();
	});

	test("isolates an invalid DOM mount result without blocking another capability", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		for (const id of ["invalid-dom", "working-dom"]) {
			runtime.grants.set(id, { granted: true });
		}
		const anchor = document.createElement("div");
		registry.register(
			regionTool("invalid-dom", {
				renderSurface: () => ({ element: anchor }),
			}),
		);
		const working = document.createElement("div");
		registry.register(
			regionTool("working-dom", {
				renderSurface: () => ({ element: working }),
			}),
		);
		const host = createToolSurfaceHost(() => undefined);
		host.update(contentInput(registry, runtime.coordinator, anchor));
		await flush();

		expect(anchor.firstElementChild).toBe(working);
		expect(runtime.errors).toHaveLength(1);
		expect(runtime.errors[0]?.details).toContain("phase=render");
		host.destroy();
	});

	test("isolates render, sync, and destroy failures while preserving working content", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		for (const id of ["broken", "working"]) {
			runtime.grants.set(id, { granted: true });
		}
		registry.register(
			regionTool("broken", {
				renderSurface: () => {
					throw new Error("render exploded");
				},
			}),
		);
		const working = document.createElement("div");
		registry.register(
			regionTool("working", {
				renderSurface: () => ({
					element: working,
					sync: () => {
						throw new Error("sync exploded");
					},
					destroy: () => {
						throw new Error("destroy exploded");
					},
				}),
			}),
		);
		const anchor = document.createElement("div");
		const host = createToolSurfaceHost(() => undefined);
		host.update(contentInput(registry, runtime.coordinator, anchor));
		await flush();
		runtime.grants.set("working", {
			granted: true,
			parameters: { changed: true },
		});
		runtime.emitPolicy();

		expect(anchor.firstElementChild).toBe(working);
		expect(runtime.errors.map((error) => error.details.at(-1))).toEqual([
			"phase=render",
			"phase=render",
			"phase=sync",
		]);
		registry.unregister("working");
		expect(working.parentElement).toBeNull();
		expect(
			runtime.errors.some((error) => error.details.includes("phase=destroy")),
		).toBe(true);
		host.destroy();
	});

	test("rejects invalid content and section content dependencies as recoverable warnings", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		runtime.grants.set("cyclic", { granted: true });
		runtime.grants.set("function-content", { granted: true });
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		registry.register(
			regionTool("cyclic", {
				requiresAuthoredContent: { resolve: () => cyclic },
			}),
		);
		registry.register(
			regionTool("function-content", {
				requiresAuthoredContent: {
					resolve: () => ({ callback: () => undefined }),
				},
			}),
		);
		const host = createToolSurfaceHost(() => undefined);
		host.update(
			contentInput(
				registry,
				runtime.coordinator,
				document.createElement("div"),
			),
		);
		await flush();
		expect(runtime.errors).toHaveLength(2);
		expect(runtime.errors[0]).toMatchObject({
			severity: "warning",
			recoverable: true,
			kind: "tool-surface",
		});

		registry.unregister("cyclic");
		registry.unregister("function-content");
		registry.register(
			regionTool("section-content", {
				surfaces: ["section-overlay"],
				requiresAuthoredContent: { resolve: () => ({ value: true }) },
			}),
		);
		host.update({
			...contentInput(
				registry,
				runtime.coordinator,
				document.createElement("div"),
			),
			surface: "section-overlay",
			scope: { kind: "section", assessmentId: "a", sectionId: "s" },
		});
		expect(runtime.errors.at(-1)?.message).toContain("cannot resolve");
		host.destroy();
	});

	test("late loader configuration retries an unoccupied capability", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		runtime.grants.set("late", { granted: true });
		let ready = false;
		registry.register(
			regionTool("late", {
				renderSurface: () =>
					ready ? { element: document.createElement("div") } : null,
			}),
		);
		const anchor = document.createElement("div");
		const host = createToolSurfaceHost(() => undefined);
		host.update(contentInput(registry, runtime.coordinator, anchor));
		await flush();
		expect(anchor.children).toHaveLength(0);

		registry.setToolModuleLoaders({
			late: async () => {
				ready = true;
			},
		});
		await flush();
		expect(anchor.children).toHaveLength(1);
		host.destroy();
	});

	test("component override changes remount through the registry rendering path", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		runtime.grants.set("overrideable", { granted: true });
		let destroys = 0;
		registry.register(
			regionTool("overrideable", {
				renderSurface: (context) => {
					const element = document.createElement("div");
					element.dataset.tag =
						context.componentOverrides?.toolTagMap?.overrideable ?? "default";
					return { element, destroy: () => (destroys += 1) };
				},
			}),
		);
		const anchor = document.createElement("div");
		const host = createToolSurfaceHost(() => undefined);
		host.update(contentInput(registry, runtime.coordinator, anchor));
		await flush();
		expect((anchor.firstElementChild as HTMLElement).dataset.tag).toBe(
			"default",
		);

		registry.setComponentOverrides({
			toolTagMap: { overrideable: "pie-tool-overrideable" },
		});
		await flush();
		expect(destroys).toBe(1);
		expect((anchor.firstElementChild as HTMLElement).dataset.tag).toBe(
			"pie-tool-overrideable",
		);
		host.destroy();
	});

	test("section scope uses feature policy for regions and placement policy for toolbar activations", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		runtime.grants.set("region-support", {
			granted: true,
			parameters: { region: true },
		});
		runtime.visibleTools.set("toolbar-surface", { toolbar: true });
		registry.register(
			regionTool("region-surface", {
				supportedLevels: ["section"],
				surfaces: ["section-overlay"],
				pnpSupportIds: ["region-support"],
				renderSurface: (context) => {
					const element = document.createElement("div");
					element.dataset.parameters = JSON.stringify(context.parameters);
					return { element };
				},
			}),
		);
		registry.register({
			toolId: "toolbar-surface",
			name: "Toolbar surface",
			description: "Toolbar activation with a section surface",
			icon: "tool",
			supportedLevels: ["section"],
			activation: "toolbar-toggle",
			surfaces: ["section-overlay"],
			pnpSupportIds: ["toolbar-support"],
			isVisibleInContext: () => true,
			renderToolbar: () => null,
			renderSurface: (context) => {
				const element = document.createElement("div");
				element.dataset.parameters = JSON.stringify(context.parameters);
				return { element };
			},
		});
		const anchor = document.createElement("div");
		const host = createToolSurfaceHost(() => undefined);
		host.update({
			...contentInput(registry, runtime.coordinator, anchor),
			surface: "section-overlay",
			scope: { kind: "section", assessmentId: "a", sectionId: "s" },
		});
		await flush();

		expect(
			[...anchor.children].map(
				(child) => (child as HTMLElement).dataset.parameters,
			),
		).toEqual(['{"region":true}', '{"toolbar":true}']);
		host.destroy();
	});

	test("ignores a lazy result after teardown and detaches coordinator listeners", async () => {
		const registry = new ToolRegistry();
		const runtime = createCoordinator();
		const load = deferred();
		runtime.grants.set("slow", { granted: true });
		registry.setToolModuleLoaders({ slow: () => load.promise });
		registry.register(regionTool("slow"));
		const anchor = document.createElement("div");
		const host = createToolSurfaceHost(() => undefined);
		host.update(contentInput(registry, runtime.coordinator, anchor));
		expect(runtime.policyListenerCount()).toBe(1);
		host.destroy();
		expect(runtime.policyListenerCount()).toBe(0);
		load.resolve();
		await flush();
		expect(anchor.children).toHaveLength(0);
	});
});
