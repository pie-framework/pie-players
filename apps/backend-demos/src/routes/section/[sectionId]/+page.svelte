<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { tick, untrack } from "svelte";
	import "@pie-players/pie-section-player/components/section-player-splitpane-element";
	import "@pie-players/pie-section-player/components/section-player-vertical-element";
	import BackendToolBar from "$lib/components/BackendToolBar.svelte";
	import BackendToolWindow from "$lib/components/BackendToolWindow.svelte";
	import BackendTrafficPanel from "$lib/components/BackendTrafficPanel.svelte";
	import JsonInspectPanel from "$lib/components/JsonInspectPanel.svelte";

	type DemoItemId =
		| "backend-delivery-planets"
		| "backend-delivery-arithmetic";
	type LayoutId = "vertical" | "splitpane";
	type ToolId = (typeof toolIds)[number];
	type BackendCallEntry = {
		at: string;
		itemId: string | null;
		sessionId: string | null;
		assignmentId: string | null;
		metadata: unknown;
		session: unknown;
	};
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
	type SectionPlayerElement = HTMLElement & {
		waitForSectionController?: (
			timeoutMs?: number,
		) => Promise<{
			applySession?: (
				session: unknown,
				options?: { mode?: "replace" | "merge" },
			) => Promise<void>;
		} | null>;
	};

	const defaultSectionId = "backend-section-basic";
	const defaultAttemptId = "backend-section-attempt-1";
	const assessmentId = "backend-demo-assessment";
	const backendItemIds: DemoItemId[] = [
		"backend-delivery-planets",
		"backend-delivery-arithmetic",
	];
	const toolIds = ["traffic", "session"] as const;
	const env = { mode: "gather", role: "student" };

	let sectionPlayerEl: SectionPlayerElement | null = $state(null);
	let sectionEventHost: HTMLDivElement | null = $state(null);
	let sectionId = $state(defaultSectionId);
	let attemptId = $state(defaultAttemptId);
	let layout = $state<LayoutId>("vertical");
	let showTrafficPanel = $state(false);
	let showSessionPanel = $state(false);
	let showInfoDialog = $state(false);
	let backendDeliveryEnabled = $state(false);
	let hydrationStatus = $state("Preparing deterministic section sessions");
	let errorMessage = $state("");
	let backendCalls = $state<BackendCallEntry[]>([]);
	let backendTrafficLog = $state<BackendTrafficEntry[]>([]);
	let lastInfoFocusTarget: HTMLElement | null = null;
	let infoButtonEl: HTMLButtonElement | null = $state(null);
	let infoDialogEl: HTMLDivElement | null = $state(null);
	let infoCloseButtonEl: HTMLButtonElement | null = $state(null);
	let hydrationRequestKey = "";

	const demoSection = $derived(createDemoSection(sectionId));
	const sectionSession = $derived(createSectionSession(attemptId));
	const sectionSeedJson = $derived(JSON.stringify(demoSection, null, 2));
	const safeModelsById = $derived(createSafeModelsById(demoSection));
	const runtime = $derived({
		playerType: "iife",
		env,
		player: {
			hosted: true,
			backend: createBackendConfig(backendDeliveryEnabled),
		},
	});
	const sectionHydrationKey = $derived(
		`${sectionId}:${attemptId}:${layout}`,
	);

	function createSafeModel(args: {
		id: string;
		prompt: string;
		choicePrefix: "letters" | "numbers";
		choices: Array<{ value: string; label: string }>;
	}) {
		return {
			id: args.id,
			element: "multiple-choice",
			choiceMode: "radio",
			choicePrefix: args.choicePrefix,
			choices: args.choices,
			prompt: args.prompt,
			promptEnabled: true,
			toolbarEditorPosition: "bottom",
		};
	}

	function createDemoItem(itemId: DemoItemId) {
		if (itemId === "backend-delivery-arithmetic") {
			return {
				id: itemId,
				baseId: itemId,
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					id: itemId,
					markup: '<multiple-choice id="sum-choice"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						createSafeModel({
							id: "sum-choice",
							prompt: "<p>Backend demo: what is 3 + 5?</p>",
							choicePrefix: "numbers",
							choices: [
								{ value: "7", label: "7" },
								{ value: "8", label: "8" },
								{ value: "9", label: "9" },
								{ value: "10", label: "10" },
							],
						}),
					],
				},
			};
		}
		return {
			id: itemId,
			baseId: itemId,
			version: { major: 1, minor: 0, patch: 0 },
			config: {
				id: itemId,
				markup: '<multiple-choice id="planet-choice"></multiple-choice>',
				elements: {
					"multiple-choice": "@pie-element/multiple-choice@latest",
				},
				models: [
					createSafeModel({
						id: "planet-choice",
						prompt:
							"<p>Backend demo: which is the largest planet in our solar system?</p>",
						choicePrefix: "letters",
						choices: [
							{ value: "mercury", label: "Mercury" },
							{ value: "jupiter", label: "Jupiter" },
							{ value: "earth", label: "Earth" },
							{ value: "mars", label: "Mars" },
						],
					}),
				],
			},
		};
	}

	function createDemoSection(identifier: string) {
		return {
			identifier,
			title: "Backend Delivery Section",
			keepTogether: true,
			rubricBlocks: [],
			assessmentItemRefs: backendItemIds.map((itemId) => ({
				identifier: itemId,
				required: true,
				item: createDemoItem(itemId),
			})),
		};
	}

	function createSafeModelsById(section: ReturnType<typeof createDemoSection>) {
		const entries = section.assessmentItemRefs.flatMap((itemRef) =>
			(itemRef.item.config.models || []).map((model) => [model.id, model] as const),
		);
		return Object.fromEntries(entries);
	}

	function createSectionSession(currentAttemptId: string) {
		return {
			currentItemIndex: 0,
			visitedItemIdentifiers: [],
			itemSessions: Object.fromEntries(
				backendItemIds.map((itemId) => [
					itemId,
					{
						id: `${currentAttemptId}-${itemId}`,
						data: [],
					},
				]),
			),
		};
	}

	function createBackendConfig(enabled: boolean) {
		return {
			delivery: {
				enabled,
				provider: "pie-api",
				assignmentId: attemptId,
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

	function normalizeToolParam(value: string | null): Set<ToolId> {
		const requested = new Set((value || "").split(","));
		return new Set(toolIds.filter((toolId) => requested.has(toolId)));
	}

	function normalizeLayout(value: string | null): LayoutId {
		return value === "splitpane" ? "splitpane" : "vertical";
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

	function setLayout(nextLayout: LayoutId) {
		layout = nextLayout;
		void updateSearchParams((params) => {
			params.set("layout", nextLayout);
		});
	}

	function setAttemptId(nextAttemptId: string) {
		attemptId = nextAttemptId || defaultAttemptId;
		void updateSearchParams((params) => {
			params.set("attemptId", attemptId);
		});
	}

	function openInfoDialog() {
		lastInfoFocusTarget =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		showInfoDialog = true;
		void updateSearchParams((params) => {
			params.set("info", "1");
		});
	}

	function closeInfoDialog() {
		showInfoDialog = false;
		void updateSearchParams((params) => {
			params.delete("info");
		});
		void tick().then(() => {
			(lastInfoFocusTarget || infoButtonEl)?.focus();
			lastInfoFocusTarget = null;
		});
	}

	function handleInfoKeydown(event: KeyboardEvent) {
		if (!showInfoDialog || event.key !== "Escape") return;
		event.preventDefault();
		closeInfoDialog();
		event.stopPropagation();
		event.stopImmediatePropagation();
	}

	function focusInfoDialog() {
		void tick().then(() => {
			requestAnimationFrame(() => {
				(infoCloseButtonEl || infoDialogEl)?.focus();
				setTimeout(() => {
					(infoCloseButtonEl || infoDialogEl)?.focus();
				}, 0);
			});
		});
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

		const requestErrorMessage = response.ok
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
				error: requestErrorMessage || undefined,
			},
			...backendTrafficLog,
		].slice(0, 30);
		if (requestErrorMessage) {
			throw new Error(requestErrorMessage);
		}
		return responsePayload;
	}

	function handleBackendLoadComplete(event: Event) {
		const detail = (event as CustomEvent).detail as Record<string, unknown>;
		const metadata = (detail?.metadata || {}) as Record<string, unknown>;
		const session = (detail?.session || {}) as Record<string, unknown>;
		const entry = {
			at: new Date().toLocaleTimeString(),
			itemId: typeof metadata.dbItemId === "string" ? metadata.dbItemId : null,
			sessionId: typeof session.id === "string" ? session.id : null,
			assignmentId:
				typeof metadata.assignmentId === "string"
					? metadata.assignmentId
					: null,
			metadata,
			session,
		};
		backendCalls = [entry, ...backendCalls].slice(0, 12);
		scheduleSectionPieElementRepair();
	}

	function handleSectionError(event: Event) {
		errorMessage = JSON.stringify((event as CustomEvent).detail ?? {}, null, 2);
	}

	async function hydrateSectionSessionForBackend(key: string) {
		const player = sectionPlayerEl;
		if (!player) return;
		hydrationStatus = "Preparing deterministic section sessions";
		errorMessage = "";
		backendDeliveryEnabled = false;
		backendCalls = [];
		backendTrafficLog = [];
		await tick();
		try {
			const controller = await player.waitForSectionController?.(5000);
			if (!controller?.applySession || hydrationRequestKey !== key) return;
			await controller.applySession(sectionSession, { mode: "replace" });
			if (hydrationRequestKey !== key) return;
			backendDeliveryEnabled = true;
			hydrationStatus = "";
			scheduleSectionPieElementRepair();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			hydrationStatus = "";
		}
	}

	function findRenderedPieElement(modelId: string) {
		return Array.from(document.querySelectorAll(`[id="${CSS.escape(modelId)}"]`)).find(
			(element) =>
				element.localName.includes("multiple-choice") &&
				customElements.get(element.localName),
		) as (HTMLElement & { _root?: unknown }) | undefined;
	}

	function repairEmptySectionPieElements(force = false) {
		if (typeof document === "undefined") return;
		for (const [modelId, model] of Object.entries(safeModelsById)) {
			const current = findRenderedPieElement(modelId);
			if (!current) continue;
			if (!force && (current.textContent?.trim() || current._root)) continue;
			const replacement = document.createElement(current.localName) as HTMLElement & {
				model?: unknown;
				session?: unknown;
			};
			for (const attribute of Array.from(current.attributes)) {
				replacement.setAttribute(attribute.name, attribute.value);
			}
			replacement.id = modelId;
			current.replaceWith(replacement);
			replacement.model = {
				...model,
				element: current.localName,
			};
			replacement.session = {
				id: modelId,
				element: current.localName,
			};
		}
	}

	function scheduleSectionPieElementRepair() {
		setTimeout(() => repairEmptySectionPieElements(true), 0);
		setTimeout(() => repairEmptySectionPieElements(true), 250);
		setTimeout(repairEmptySectionPieElements, 1000);
	}

	$effect(() => {
		const routedSectionId = $page.params.sectionId || defaultSectionId;
		const routedAttemptId =
			$page.url.searchParams.get("attemptId") || defaultAttemptId;
		const routedLayout = normalizeLayout($page.url.searchParams.get("layout"));
		const tools = normalizeToolParam($page.url.searchParams.get("tools"));
		const infoOpen = $page.url.searchParams.get("info") === "1";

		untrack(() => {
			sectionId = routedSectionId;
			if (attemptId !== routedAttemptId || layout !== routedLayout) {
				backendDeliveryEnabled = false;
				backendCalls = [];
				backendTrafficLog = [];
			}
			attemptId = routedAttemptId;
			layout = routedLayout;
			showTrafficPanel = tools.has("traffic");
			showSessionPanel = tools.has("session");
			showInfoDialog = infoOpen;
		});
	});

	$effect(() => {
		const shouldFocus = showInfoDialog;
		untrack(() => {
			if (!shouldFocus) return;
			focusInfoDialog();
		});
	});

	$effect(() => {
		const key = sectionHydrationKey;
		const player = sectionPlayerEl;
		untrack(() => {
			if (!player) return;
			hydrationRequestKey = key;
			void hydrateSectionSessionForBackend(key);
		});
	});

	$effect(() => {
		const host = sectionEventHost;
		if (!host) return;
		host.addEventListener("backend-load-complete", handleBackendLoadComplete);
		host.addEventListener("backend-error", handleSectionError);
		host.addEventListener("player-error", handleSectionError);
		return () => {
			host.removeEventListener("backend-load-complete", handleBackendLoadComplete);
			host.removeEventListener("backend-error", handleSectionError);
			host.removeEventListener("player-error", handleSectionError);
		};
	});
</script>

<svelte:head>
	<title>PIE Section Backend Demo</title>
</svelte:head>

<svelte:window onkeydown={handleInfoKeydown} />

<main class="bg-base-200">
	<div class="container mx-auto max-w-7xl px-4 py-10">
		<header class="mb-5 flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">
					Backend contract
				</p>
				<h1 class="text-3xl font-bold tracking-tight text-secondary md:text-4xl">
					Section backend integration
				</h1>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<a
					class="btn btn-sm btn-outline"
					href="/delivery/backend-delivery-planets"
					data-sveltekit-reload
				>
					Item demo
				</a>
				<button
					bind:this={infoButtonEl}
					class="btn btn-sm btn-outline btn-square"
					class:btn-active={showInfoDialog}
					type="button"
					title="Section demo info"
					aria-label="Toggle section demo info dialog"
					aria-pressed={showInfoDialog}
					onclick={openInfoDialog}
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
			aria-label="Section backend demo controls"
			aria-busy={hydrationStatus ? "true" : "false"}
		>
			<div class="card-body gap-4 p-4 md:p-5">
				<div class="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_minmax(10rem,14rem)_auto] lg:items-end">
					<label class="form-control w-full">
						<span class="label py-1">
							<span class="label-text font-semibold">Attempt ID</span>
						</span>
						<input
							class="input input-bordered input-sm w-full"
							value={attemptId}
							onchange={(event) =>
								setAttemptId((event.currentTarget as HTMLInputElement).value)}
						/>
					</label>
					<label class="form-control w-full">
						<span class="label py-1">
							<span class="label-text font-semibold">Layout</span>
						</span>
						<select
							class="select select-bordered select-sm w-full"
							value={layout}
							onchange={(event) =>
								setLayout((event.currentTarget as HTMLSelectElement).value as LayoutId)}
						>
							<option value="vertical">Vertical</option>
							<option value="splitpane">Split pane</option>
						</select>
					</label>

					<div class="flex flex-wrap gap-2 lg:justify-end">
						<a
							class="btn btn-outline btn-sm"
							href="/delivery/backend-delivery-planets"
							data-sveltekit-reload
						>
							Direct item demo
						</a>
						<span class="badge badge-primary badge-outline">section backend</span>
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-3">
					<BackendToolBar
						{showTrafficPanel}
						{showSessionPanel}
						onToggleTrafficPanel={() => setToolOpen("traffic", !showTrafficPanel)}
						onToggleSessionPanel={() => setToolOpen("session", !showSessionPanel)}
					/>
					<p class="text-sm text-base-content/70">
						One shared <code class="kbd kbd-sm">runtime.player.backend.delivery</code>
						config, two derived item calls.
					</p>
				</div>

				{#if hydrationStatus}
					<div class="alert alert-info" role="status" aria-live="polite">
						<span>{hydrationStatus}</span>
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
				<div class="mb-2 flex flex-wrap items-center justify-between gap-4">
					<h2 class="card-title">Live section player</h2>
					<span class="badge badge-outline">
						backend {backendDeliveryEnabled ? "enabled" : "preparing"}
					</span>
				</div>
				<div bind:this={sectionEventHost}>
					{#if layout === "splitpane"}
						<pie-section-player-splitpane
							bind:this={sectionPlayerEl}
							assessment-id={assessmentId}
							section-id={sectionId}
							attempt-id={attemptId}
							section={demoSection}
							{runtime}
							show-toolbar={false}
						></pie-section-player-splitpane>
					{:else}
						<pie-section-player-vertical
							bind:this={sectionPlayerEl}
							assessment-id={assessmentId}
							section-id={sectionId}
							attempt-id={attemptId}
							section={demoSection}
							{runtime}
							show-toolbar={false}
						></pie-section-player-vertical>
					{/if}
				</div>
			</div>
		</section>

		<pre class="sr-only" data-testid="section-seed">{sectionSeedJson}</pre>

		{#if showInfoDialog}
			<div class="fixed inset-0 z-120000 grid place-items-center p-4" role="presentation">
				<button
					type="button"
					class="absolute inset-0 cursor-pointer border-0 bg-neutral/60"
					aria-label="Close section demo info dialog"
					onclick={closeInfoDialog}
				></button>
				<div
					bind:this={infoDialogEl}
					class="card relative max-h-[calc(100vh-2rem)] w-[min(46rem,calc(100vw-2rem))] overflow-auto border border-base-300 bg-base-100 shadow-2xl"
					role="dialog"
					tabindex="-1"
					aria-modal="true"
					aria-labelledby="section-backend-demo-info-title"
				>
					<div class="card-body gap-4">
						<header class="flex items-start justify-between gap-4">
							<div>
								<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">
									Demo info
								</p>
								<h2 id="section-backend-demo-info-title" class="card-title text-2xl">
									What this section backend demo proves
								</h2>
							</div>
							<button
								bind:this={infoCloseButtonEl}
								class="btn btn-sm btn-outline"
								type="button"
								aria-label="Close section demo info dialog"
								onclick={closeInfoDialog}
							>
								Close
							</button>
						</header>
						<p class="text-base-content/80">
							This demo configures delivery backend support once on
							<code class="kbd kbd-sm">pie-section-player</code>. The section-player
							derives each nested item player's backend <code class="kbd kbd-sm">itemId</code>
							and <code class="kbd kbd-sm">sessionId</code> from canonical section item
							IDs and route-owned item sessions.
						</p>
						<p class="text-base-content/80">
							The section seed is intentionally student-safe: it includes IDs, markup,
							element package mapping, and display-only model fields. Correct-response
							and feedback data stay in the local backend and are only processed through
							<code class="kbd kbd-sm">/api/player/*</code> controller endpoints.
						</p>
					</div>
				</div>
			</div>
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
				<JsonInspectPanel
					value={{
						sectionSession,
						backendCalls,
					}}
					testId="section-backend-calls"
					description="Route-owned section session and backend load completions keyed by item ID."
				/>
			</BackendToolWindow>
		{/if}

		{#if showTrafficPanel}
			<BackendToolWindow
				title="Backend traffic"
				ariaLabel="Section backend traffic tool"
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
	</div>
</main>
