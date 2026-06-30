<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { onMount, tick } from "svelte";
	import "@pie-players/pie-item-player";
	import BackendStatePanel from "$lib/components/BackendStatePanel.svelte";
	import BackendToolBar from "$lib/components/BackendToolBar.svelte";
	import BackendToolWindow from "$lib/components/BackendToolWindow.svelte";
	import BackendTrafficPanel from "$lib/components/BackendTrafficPanel.svelte";

	type BackendTrafficEntry = {
		id: number;
		at: string;
		operation: string;
		method: string;
		url: string;
		status?: number;
		durationMs?: number;
		request: unknown;
		response?: unknown;
		error?: string;
	};

	type DemoState = {
		dbPath?: string;
		items?: Array<{
			id: string;
			name: string;
			description: string;
			config: unknown;
		}>;
		sessions?: unknown[];
	};

	const defaultItemId = "backend-delivery-planets";
	const assignmentId = "backend-demo-assignment";
	const env = { mode: "gather", role: "student" };
	const toolIds = ["traffic", "session"] as const;
	type ToolId = (typeof toolIds)[number];

	let playerEl: any = $state(null);
	let selectedItemId = $state(defaultItemId);
	let sessionId = $state(`${defaultItemId}-session-1`);
	let demoState = $state<DemoState>({});
	let backendTrafficLog = $state<BackendTrafficEntry[]>([]);
	let clientSessionSnapshot = $state<unknown>(null);
	let serverSessionSnapshot = $state<unknown>(null);
	let serverScore = $state<unknown>(null);
	let busyMessage = $state("");
	let errorMessage = $state("");
	let showTrafficPanel = $state(false);
	let showSessionPanel = $state(false);
	let showInfoDialog = $state(false);
	const availableItems = $derived(demoState.items || []);
	const selectedItem = $derived(
		availableItems.find((item) => item.id === selectedItemId) || null,
	);

	function defaultSessionIdForItem(itemId: string): string {
		return `${itemId}-session-1`;
	}

	function normalizeToolParam(value: string | null): Set<ToolId> {
		const requested = new Set((value || "").split(","));
		return new Set(toolIds.filter((toolId) => requested.has(toolId)));
	}

	function updateSearchParams(mutator: (params: URLSearchParams) => void) {
		const url = new URL($page.url);
		mutator(url.searchParams);
		const query = url.searchParams.toString();
		return goto(query ? `${url.pathname}?${query}` : url.pathname, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	}

	function setSessionIdParam(nextSessionId: string) {
		return updateSearchParams((params) => {
			if (nextSessionId) {
				params.set("sessionId", nextSessionId);
			} else {
				params.delete("sessionId");
			}
		});
	}

	function setInfoDialog(open: boolean) {
		showInfoDialog = open;
		void updateSearchParams((params) => {
			if (open) {
				params.set("info", "1");
			} else {
				params.delete("info");
			}
		});
	}

	function setToolOpen(toolId: ToolId, open: boolean) {
		const tools = normalizeToolParam($page.url.searchParams.get("tools"));
		if (open) {
			tools.add(toolId);
		} else {
			tools.delete(toolId);
		}
		void updateSearchParams((params) => {
			const value = toolIds.filter((id) => tools.has(id)).join(",");
			if (value) {
				params.set("tools", value);
			} else {
				params.delete("tools");
			}
		});
	}

	function deliveryHrefForItem(itemId: string): string {
		const params = new URLSearchParams($page.url.searchParams);
		params.set("sessionId", defaultSessionIdForItem(itemId));
		const query = params.toString();
		return `/delivery/${encodeURIComponent(itemId)}${query ? `?${query}` : ""}`;
	}

	function clearDemoSnapshots() {
		clientSessionSnapshot = null;
		serverSessionSnapshot = null;
		serverScore = null;
	}

	let backendTrafficId = 0;

	async function recordBackendTraffic(
		operation: string,
		url: string,
		requestBody: Record<string, unknown>,
	): Promise<unknown> {
		const startedAt = performance.now();
		let response: Response;
		let responsePayload: unknown = null;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify(requestBody),
			});
			responsePayload = await response
				.clone()
				.json()
				.catch(async () => response.clone().text().catch(() => null));
		} catch (error) {
			backendTrafficLog = [
				{
					id: ++backendTrafficId,
					at: new Date().toLocaleTimeString(),
					operation,
					method: "POST",
					url,
					durationMs: Math.round(performance.now() - startedAt),
					request: requestBody,
					response: responsePayload,
					error: error instanceof Error ? error.message : String(error),
				},
				...backendTrafficLog,
			].slice(0, 30);
			throw error;
		}

		const errorMessage = response.ok
			? ""
			: `Backend ${operation} request failed with HTTP ${response.status}`;
		backendTrafficLog = [
			{
				id: ++backendTrafficId,
				at: new Date().toLocaleTimeString(),
				operation,
				method: "POST",
				url,
				status: response.status,
				durationMs: Math.round(performance.now() - startedAt),
				request: requestBody,
				response: responsePayload,
				error: errorMessage || undefined,
			},
			...backendTrafficLog,
		].slice(0, 30);
		if (errorMessage) {
			throw new Error(errorMessage);
		}
		return responsePayload;
	}

	function hasResponseValue(value: unknown): boolean {
		if (Array.isArray(value)) return value.some((entry) => hasResponseValue(entry));
		if (!value || typeof value !== "object") return false;
		return Object.entries(value as Record<string, unknown>).some(
			([key, nested]) => key === "value" || hasResponseValue(nested),
		);
	}

	async function refreshDemoState() {
		const response = await fetch("/api/player/state");
		demoState = await response.json().catch(() => ({}));
	}

	async function refreshServerSnapshot() {
		if (!sessionId) return;
		const response = await fetch(
			`/api/player/state?sessionId=${encodeURIComponent(sessionId)}`,
		);
		const payload = await response.json().catch(() => ({}));
		serverSessionSnapshot = payload.session ?? null;
		await refreshDemoState();
	}

	function sessionForModel(sessionEntries: unknown, model: Record<string, unknown>) {
		if (!Array.isArray(sessionEntries)) return null;
		return (
			sessionEntries.find(
				(entry) =>
					entry &&
					typeof entry === "object" &&
					(entry as Record<string, unknown>).id === model.id,
			) ?? null
		);
	}

	function findRenderedPieElement(root: Element, tagName: string, id: string) {
		return Array.from(root.querySelectorAll(tagName)).find(
			(element) => element.id === id,
		) as (HTMLElement & { _root?: unknown; model?: unknown; session?: unknown }) | undefined;
	}

	function responseValuesForSession(elementSession: unknown) {
		const value =
			elementSession && typeof elementSession === "object"
				? (elementSession as Record<string, unknown>).value
				: undefined;
		if (Array.isArray(value)) return new Set(value.map(String));
		if (typeof value === "string" || typeof value === "number") return new Set([String(value)]);
		return new Set<string>();
	}

	function syncRenderedChoiceInputs(root: HTMLElement, elementSession: unknown) {
		const selectedValues = responseValuesForSession(elementSession);
		for (const input of Array.from(
			root.querySelectorAll<HTMLInputElement>(
				'input[type="radio"], input[type="checkbox"]',
			),
		)) {
			input.checked = selectedValues.has(input.value);
			input.toggleAttribute("checked", input.checked);
		}
	}

	function repairEmptyPieElements(resetRendered = false) {
		if (!playerEl || typeof window === "undefined") return;
		const context = (window as any)._pieCurrentContext;
		const models = context?.config?.models;
		if (!Array.isArray(models)) return;
		const loadedSessionEntries =
			clientSessionSnapshot &&
			typeof clientSessionSnapshot === "object" &&
			Array.isArray((clientSessionSnapshot as Record<string, unknown>).data)
				? (clientSessionSnapshot as { data: unknown[] }).data
				: null;

		for (const model of models) {
			if (
				!model ||
				typeof model !== "object" ||
				typeof model.id !== "string" ||
				typeof model.element !== "string" ||
				!customElements.get(model.element)
			) {
				continue;
			}
			const current = findRenderedPieElement(playerEl, model.element, model.id);
			const elementSession =
				sessionForModel(loadedSessionEntries, model) ??
				sessionForModel(context?.session, model) ?? {
					id: model.id,
					element: model.element,
				};
			if (!current) continue;
			const hasRenderedContent = Boolean(current.textContent?.trim() || current._root);
			if (hasRenderedContent) {
				if (resetRendered) {
					syncRenderedChoiceInputs(current, elementSession);
				}
				continue;
			}
			if (resetRendered) continue;

			const replacement = document.createElement(model.element) as HTMLElement & {
				model?: unknown;
				session?: unknown;
			};
			for (const attribute of Array.from(current.attributes)) {
				replacement.setAttribute(attribute.name, attribute.value);
			}
			replacement.id = model.id;
			current.replaceWith(replacement);
			replacement.model = model;
			replacement.session = elementSession;
		}
	}

	function schedulePieElementRepair(resetRendered = false) {
		if (resetRendered) {
			repairEmptyPieElements(true);
			setTimeout(repairEmptyPieElements, 1000);
			return;
		}
		setTimeout(repairEmptyPieElements, 1000);
	}

	function scheduleRenderedInputSync() {
		queueMicrotask(() => {
			requestAnimationFrame(() => repairEmptyPieElements(true));
		});
	}

	function waitForAnimationFrame() {
		return new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
	}

	async function waitForAnimationFrames(count: number) {
		for (let index = 0; index < count; index += 1) {
			await waitForAnimationFrame();
		}
	}

	function waitForPlayerLoadComplete(timeoutMs = 2_000) {
		if (!playerEl) return Promise.resolve();
		return new Promise<void>((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				clearTimeout(timeoutId);
				playerEl?.removeEventListener("load-complete", finish);
				resolve();
			};
			const timeoutId = setTimeout(finish, timeoutMs);
			playerEl.addEventListener("load-complete", finish, { once: true });
		});
	}

	async function waitForPieElementsReady(timeoutMs = 2_000) {
		if (!playerEl || typeof window === "undefined") return;
		const startedAt = performance.now();
		while (performance.now() - startedAt < timeoutMs) {
			await tick();
			await waitForAnimationFrame();
			const context = (window as any)._pieCurrentContext;
			const models = context?.config?.models;
			if (!Array.isArray(models)) return;
			const ready = models.every((model) => {
				if (
					!model ||
					typeof model !== "object" ||
					typeof model.id !== "string" ||
					typeof model.element !== "string"
				) {
					return true;
				}
				const current = findRenderedPieElement(playerEl, model.element, model.id);
				return Boolean(current?._root && current.querySelector("input, button, select, textarea"));
			});
			if (ready) {
				await waitForAnimationFrame();
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
	}

	async function finalizeBackendPlayerLoad() {
		await waitForPieElementsReady();
		repairEmptyPieElements(true);
		await waitForAnimationFrames(3);
		setTimeout(repairEmptyPieElements, 1000);
	}

	function backendConfig() {
		return {
			delivery: {
				enabled: true,
				provider: "pie-api",
				itemId: selectedItemId,
				sessionId,
				assignmentId,
				autosave: {
					enabled: true,
					debounceMs: 250,
				},
				endpoints: {
					load: "/api/player/load",
					saveSession: "/api/player/save",
					model: "/api/player/model",
					score: "/api/player/score",
				},
				client: {
					load: (context: Record<string, unknown>) =>
						recordBackendTraffic("load", "/api/player/load", {
							itemId: context.itemId,
							sessionId: context.sessionId,
							assignmentId: context.assignmentId,
							env: context.env,
						}),
					model: (context: Record<string, unknown>) =>
						recordBackendTraffic("model", "/api/player/model", {
							itemId: context.itemId,
							sessionId: context.sessionId,
							assignmentId: context.assignmentId,
							session: context.session,
							env: context.env,
						}),
					saveSession: (context: Record<string, unknown>) => {
						const session = context.session as
							| { id?: string; data?: unknown[] }
							| undefined;
						return recordBackendTraffic("saveSession", "/api/player/save", {
							itemId: context.itemId,
							sessionId: session?.id || context.sessionId,
							data: Array.isArray(session?.data) ? session.data : [],
							env: context.env,
						});
					},
					score: (context: Record<string, unknown>) => {
						const session = context.session as
							| { id?: string; data?: unknown[] }
							| undefined;
						const options = context.options as
							| { disablePartialScoring?: boolean }
							| undefined;
						return recordBackendTraffic("score", "/api/player/score", {
							sessionId: session?.id || context.sessionId,
							data: Array.isArray(session?.data) ? session.data : [],
							env: context.env,
							disablePartialScoring: options?.disablePartialScoring,
						});
					},
				},
			},
		};
	}

	onMount(() => {
		void refreshDemoState();
	});

	$effect(() => {
		const routedItemId = $page.params.itemId || defaultItemId;
		const routedSessionId =
			$page.url.searchParams.get("sessionId") || defaultSessionIdForItem(routedItemId);
		const tools = normalizeToolParam($page.url.searchParams.get("tools"));

		if (selectedItemId !== routedItemId) {
			selectedItemId = routedItemId;
			clearDemoSnapshots();
		}
		if (sessionId !== routedSessionId) {
			sessionId = routedSessionId;
		}
		showTrafficPanel = tools.has("traffic");
		showSessionPanel = tools.has("session");
		showInfoDialog = $page.url.searchParams.get("info") === "1";
	});

	$effect(() => {
		if (!playerEl) return;
		playerEl.env = env;
		playerEl.strategy = "iife";
		playerEl.hosted = true;
		playerEl.loaderOptions = {
			bundleHost: "https://proxy.pie-api.com/bundles/",
			runtimeSupportCheck: "on",
		};
		playerEl.backend = backendConfig();
	});

	$effect(() => {
		if (!playerEl) return;
		const eventTypes = [
			"backend-load-complete",
			"backend-model-complete",
			"backend-session-saved",
			"backend-score-complete",
			"backend-error",
			"session-changed",
			"player-error",
		];
		const handlers = eventTypes.map((type) => {
			const handler = (event: Event) => {
				const detail = (event as CustomEvent).detail;
				if (type === "backend-load-complete") {
					const loadedSession = (detail as any)?.session;
					if (loadedSession?.id) {
						sessionId = loadedSession.id;
					}
					clientSessionSnapshot = loadedSession ?? null;
					void refreshServerSnapshot();
					void finalizeBackendPlayerLoad();
				}
				if (type === "backend-model-complete") {
					schedulePieElementRepair();
				}
				if (type === "session-changed") {
					const session = (detail as any)?.session;
					if (session && hasResponseValue(session)) {
						clientSessionSnapshot = session;
						scheduleRenderedInputSync();
					} else if (!session && hasResponseValue(detail)) {
						clientSessionSnapshot = detail;
						scheduleRenderedInputSync();
					}
				}
				if (type === "backend-session-saved") {
					serverSessionSnapshot = (detail as any)?.session ?? null;
					void refreshServerSnapshot();
				}
				if (type === "backend-score-complete") {
					serverScore = (detail as any)?.score ?? detail;
				}
				if (type === "backend-error" || type === "player-error") {
					errorMessage = JSON.stringify(detail, null, 2);
				}
			};
			playerEl.addEventListener(type, handler);
			return [type, handler] as const;
		});
		return () => {
			for (const [type, handler] of handlers) {
				playerEl?.removeEventListener(type, handler);
			}
		};
	});

	async function runAction(label: string, action: () => Promise<void>) {
		busyMessage = label;
		errorMessage = "";
		try {
			await action();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			busyMessage = "";
		}
	}

	async function reloadCurrentSession() {
		await runAction("Loading session from backend", async () => {
			const loadComplete = waitForPlayerLoadComplete();
			await playerEl?.loadFromBackend("delivery");
			await loadComplete;
			await finalizeBackendPlayerLoad();
			await refreshServerSnapshot();
		});
	}

	async function createFreshSession() {
		await runAction("Creating a fresh backend session", async () => {
			sessionId = `${selectedItemId}-session-${Date.now()}`;
			await setSessionIdParam(sessionId);
			clientSessionSnapshot = null;
			serverSessionSnapshot = null;
			serverScore = null;
			await tick();
			const loadComplete = waitForPlayerLoadComplete();
			await playerEl?.loadFromBackend("delivery");
			await loadComplete;
			await finalizeBackendPlayerLoad();
			await refreshServerSnapshot();
		});
	}

	async function loadSelectedItem(event: Event) {
		const target = event.target as HTMLSelectElement;
		await goto(deliveryHrefForItem(target.value), {
			noScroll: true,
			keepFocus: true,
		});
		await reloadCurrentSession();
	}

	function handleSessionIdChange(event: Event) {
		const target = event.target as HTMLInputElement;
		sessionId = target.value;
		void setSessionIdParam(sessionId);
	}

	async function saveExplicitly() {
		await runAction("Saving through backend.delivery", async () => {
			await playerEl?.saveSession();
			await refreshServerSnapshot();
		});
	}

	async function scoreOnServer() {
		await runAction("Scoring with backend controller outcome()", async () => {
			serverScore = await playerEl?.score();
			await refreshServerSnapshot();
		});
	}

</script>

<svelte:head>
	<title>PIE Backend Integration Demo</title>
</svelte:head>

<main class="bg-base-200">
	<div class="container mx-auto max-w-7xl px-4 py-10">
		<header class="mb-5 flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">
					Backend contract
				</p>
				<h1 class="text-3xl font-bold tracking-tight text-secondary md:text-4xl">
					Delivery backend integration
				</h1>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<a
					class="btn btn-sm btn-outline"
					href="/section/backend-section-basic"
					data-sveltekit-reload
				>
					Section demo
				</a>
				<button
					class="btn btn-sm btn-outline btn-square"
					class:btn-active={showInfoDialog}
					type="button"
					title="Demo info"
					aria-label="Toggle demo info dialog"
					aria-pressed={showInfoDialog}
					onclick={() => setInfoDialog(!showInfoDialog)}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<circle cx="12" cy="12" r="9" stroke-width="2"></circle>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10.5v6"></path>
						<circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"></circle>
					</svg>
				</button>
			</div>
		</header>

		<section
			class="card bg-base-100 shadow-xl"
			aria-label="Backend demo controls"
			aria-busy={busyMessage ? "true" : "false"}
		>
			<div class="card-body gap-4 p-4 md:p-5">
				<div class="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto] lg:items-end">
					<label class="form-control w-full">
						<span class="label py-1">
							<span class="label-text font-semibold">Demo item from SQLite</span>
						</span>
						<select class="select select-bordered select-sm w-full" value={selectedItemId} onchange={loadSelectedItem}>
							{#each availableItems as item}
								<option value={item.id}>{item.name}</option>
							{/each}
						</select>
					</label>
					<label class="form-control w-full">
						<span class="label py-1">
							<span class="label-text font-semibold">Session ID</span>
						</span>
						<input
							class="input input-bordered input-sm w-full"
							bind:value={sessionId}
							onchange={handleSessionIdChange}
						/>
					</label>

					<div class="flex flex-wrap gap-2 lg:justify-end">
						<button class="btn btn-primary btn-sm" type="button" onclick={reloadCurrentSession}>
							Load current session
						</button>
						<button class="btn btn-outline btn-sm" type="button" onclick={createFreshSession}>
							New session
						</button>
						<button class="btn btn-outline btn-sm" type="button" onclick={saveExplicitly}>
							saveSession()
						</button>
						<button class="btn btn-outline btn-sm" type="button" onclick={scoreOnServer}>
							server score()
						</button>
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-3">
					<BackendToolBar
						{showTrafficPanel}
						{showSessionPanel}
						onToggleTrafficPanel={() => setToolOpen("traffic", !showTrafficPanel)}
						onToggleSessionPanel={() => setToolOpen("session", !showSessionPanel)}
					/>
					<div class="badge badge-primary badge-outline">backend delivery</div>
				</div>

				{#if busyMessage}
					<div class="alert alert-info" role="status" aria-live="polite">
						<span>Working: {busyMessage}</span>
					</div>
				{/if}
				{#if errorMessage}
					<div class="alert alert-error" role="alert">
						<pre class="text-sm">{errorMessage}</pre>
					</div>
				{/if}
			</div>
		</section>

		<section class="card mt-6 min-h-96 bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="mb-2 flex items-center justify-between gap-4">
					<h2 class="card-title">Live item player</h2>
				</div>
				<pie-item-player class="block min-h-60" bind:this={playerEl}></pie-item-player>
			</div>
		</section>

		{#if showInfoDialog}
			<div class="fixed inset-0 z-120000 grid place-items-center p-4" role="presentation">
				<button
					type="button"
					class="absolute inset-0 cursor-pointer border-0 bg-neutral/60"
					aria-label="Close demo info dialog"
					onclick={() => setInfoDialog(false)}
				></button>
				<div
					class="card relative max-h-[calc(100vh-2rem)] w-[min(44rem,calc(100vw-2rem))] overflow-auto border border-base-300 bg-base-100 shadow-2xl"
					role="dialog"
					aria-modal="true"
					aria-labelledby="backend-demo-info-title"
				>
					<div class="card-body gap-4">
						<header class="flex items-start justify-between gap-4">
							<div>
								<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">
									Demo info
								</p>
								<h2 id="backend-demo-info-title" class="card-title text-2xl">
									What this backend demo proves
								</h2>
							</div>
							<button
								class="btn btn-sm btn-outline"
								type="button"
								aria-label="Close demo info dialog"
								onclick={() => setInfoDialog(false)}
							>
								Close
							</button>
						</header>
						<p class="text-base-content/80">
							This demo wires <code class="kbd kbd-sm">pie-item-player</code> to local
							<code class="kbd kbd-sm">/api/player/*</code> endpoints shaped like the
							delivery subset used by <code class="kbd kbd-sm">pie-api-player</code>.
							Auth, sanctioned versions, overrides, and PIE API release concerns are
							intentionally absent.
						</p>
						<p class="text-base-content/80">
							The backend stores raw item config, but delivery loads controller-processed
							models. For student delivery, that keeps correct-response data and scoring
							logic on the server: <code class="kbd kbd-sm">/api/player/model</code> runs
							controller <code class="kbd kbd-sm">model()</code>, and
							<code class="kbd kbd-sm">/api/player/score</code> runs controller
							<code class="kbd kbd-sm">outcome()</code>.
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if showTrafficPanel}
			<BackendToolWindow
				title="Backend traffic"
				ariaLabel="Backend traffic tool"
				offset={0}
				widthClass="w-[min(48rem,calc(100vw-2rem))]"
				onClose={() => setToolOpen("traffic", false)}
			>
				{#snippet icon()}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0l-3-3m3 3l-3 3M3 17h8m0 0l-3-3m3 3l-3 3M3 7h5m8 10h5" />
					</svg>
				{/snippet}
				<BackendTrafficPanel entries={backendTrafficLog} />
			</BackendToolWindow>
		{/if}

		{#if showSessionPanel}
			<BackendToolWindow
				title="Backend state"
				ariaLabel="Backend state tool"
				offset={1}
				widthClass="w-[min(48rem,calc(100vw-2rem))]"
				onClose={() => setToolOpen("session", false)}
			>
				{#snippet icon()}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
				{/snippet}
				<BackendStatePanel
					clientSession={clientSessionSnapshot}
					storedSession={serverSessionSnapshot}
					backendScore={serverScore}
				/>
			</BackendToolWindow>
		{/if}

	</div>
</main>
