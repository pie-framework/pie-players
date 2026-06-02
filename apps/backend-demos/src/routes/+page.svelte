<script lang="ts">
	import { onMount, tick } from "svelte";
	import "@pie-players/pie-item-player";
	import BackendModelFlowPanel from "$lib/components/BackendModelFlowPanel.svelte";
	import BackendStatePanel from "$lib/components/BackendStatePanel.svelte";
	import BackendToolBar from "$lib/components/BackendToolBar.svelte";
	import BackendToolWindow from "$lib/components/BackendToolWindow.svelte";
	import EventLogPanel from "$lib/components/EventLogPanel.svelte";

	type EventLogEntry = {
		at: string;
		type: string;
		detail: unknown;
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

	let playerEl: any = $state(null);
	let selectedItemId = $state(defaultItemId);
	let sessionId = $state(`${defaultItemId}-session-1`);
	let demoState = $state<DemoState>({});
	let eventLog = $state<EventLogEntry[]>([]);
	let clientSessionSnapshot = $state<unknown>(null);
	let serverSessionSnapshot = $state<unknown>(null);
	let backendModel = $state<unknown>(null);
	let serverScore = $state<unknown>(null);
	let busyMessage = $state("");
	let errorMessage = $state("");
	let showModelPanel = $state(false);
	let showSessionPanel = $state(false);
	let showEventsPanel = $state(false);
	const availableItems = $derived(demoState.items || []);
	const selectedItem = $derived(
		availableItems.find((item) => item.id === selectedItemId) || null,
	);
	const databaseMetadata = $derived({
		dbPath: demoState.dbPath,
		sessions: demoState.sessions,
	});

	function logEvent(type: string, detail: unknown) {
		eventLog = [
			{
				at: new Date().toLocaleTimeString(),
				type,
				detail,
			},
			...eventLog,
		].slice(0, 18);
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
			},
		};
	}

	onMount(() => {
		void refreshDemoState();
	});

	$effect(() => {
		if (!playerEl) return;
		playerEl.env = env;
		playerEl.strategy = "iife";
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
			"backend-session-saved",
			"backend-score-complete",
			"backend-error",
			"session-changed",
			"player-error",
		];
		const handlers = eventTypes.map((type) => {
			const handler = (event: Event) => {
				const detail = (event as CustomEvent).detail;
				logEvent(type, detail);
				if (type === "backend-load-complete") {
					const loadedSession = (detail as any)?.session;
					if (loadedSession?.id) {
						sessionId = loadedSession.id;
					}
					clientSessionSnapshot = loadedSession ?? null;
					void refreshServerSnapshot();
					void refreshBackendModelSnapshot();
				}
				if (type === "session-changed") {
					const session = (detail as any)?.session;
					if (session || hasResponseValue(detail)) {
						clientSessionSnapshot = session ?? detail;
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
			await playerEl?.loadFromBackend("delivery");
			await Promise.all([refreshServerSnapshot(), refreshBackendModelSnapshot()]);
		});
	}

	async function createFreshSession() {
		await runAction("Creating a fresh backend session", async () => {
			sessionId = `${selectedItemId}-session-${Date.now()}`;
			clientSessionSnapshot = null;
			serverSessionSnapshot = null;
			backendModel = null;
			serverScore = null;
			await tick();
			await playerEl?.loadFromBackend("delivery");
			await Promise.all([refreshServerSnapshot(), refreshBackendModelSnapshot()]);
		});
	}

	async function loadSelectedItem(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedItemId = target.value;
		sessionId = `${selectedItemId}-session-1`;
		clientSessionSnapshot = null;
		serverSessionSnapshot = null;
		backendModel = null;
		serverScore = null;
		await tick();
		await reloadCurrentSession();
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

	async function refreshBackendModelSnapshot() {
		const response = await fetch("/api/player/model", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				itemId: selectedItemId,
				env,
			}),
		});
		backendModel = await response.json();
	}
</script>

<svelte:head>
	<title>PIE Backend Integration Demo</title>
</svelte:head>

<main class="bg-base-200">
	<div class="container mx-auto max-w-7xl px-4 py-10">
		<div class="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start">
			<section class="card bg-base-100 shadow-xl">
				<div class="card-body gap-4">
					<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">
						Backend contract
					</p>
					<h1 class="text-4xl font-bold tracking-tight text-secondary md:text-5xl">
						Delivery backend integration
					</h1>
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
			</section>

			<section
				class="card bg-base-100 shadow-xl"
				aria-label="Backend demo controls"
				aria-busy={busyMessage ? "true" : "false"}
			>
				<div class="card-body gap-5">
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
						<label class="form-control w-full">
							<span class="label">
								<span class="label-text font-semibold">Demo item from SQLite</span>
							</span>
							<select class="select select-bordered w-full" value={selectedItemId} onchange={loadSelectedItem}>
								{#each availableItems as item}
									<option value={item.id}>{item.name}</option>
								{/each}
							</select>
						</label>
						<label class="form-control w-full">
							<span class="label">
								<span class="label-text font-semibold">Session ID</span>
							</span>
							<input class="input input-bordered w-full" bind:value={sessionId} />
						</label>
					</div>

					<div class="flex flex-wrap gap-2">
						<button class="btn btn-primary" type="button" onclick={reloadCurrentSession}>
							Load current session
						</button>
						<button class="btn btn-outline" type="button" onclick={createFreshSession}>
							New backend session
						</button>
						<button class="btn btn-outline" type="button" onclick={saveExplicitly}>
							saveSession()
						</button>
						<button class="btn btn-outline" type="button" onclick={scoreOnServer}>
							server score()
						</button>
					</div>

					<div class="divider my-0"></div>

					<BackendToolBar
						{showModelPanel}
						{showSessionPanel}
						{showEventsPanel}
						onToggleModelPanel={() => (showModelPanel = !showModelPanel)}
						onToggleSessionPanel={() => (showSessionPanel = !showSessionPanel)}
						onToggleEventsPanel={() => (showEventsPanel = !showEventsPanel)}
					/>

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
		</div>

		<section class="card mt-6 min-h-96 bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="mb-2 flex items-center justify-between gap-4">
					<h2 class="card-title">Live item player</h2>
					<div class="badge badge-primary badge-outline">backend delivery</div>
				</div>
				<pie-item-player class="block min-h-60" bind:this={playerEl}></pie-item-player>
			</div>
		</section>

		{#if showModelPanel}
			<BackendToolWindow
				title="Backend model flow"
				ariaLabel="Backend model flow tool"
				offset={0}
				widthClass="w-[min(48rem,calc(100vw-2rem))]"
				onClose={() => (showModelPanel = false)}
			>
				{#snippet icon()}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 6h6m-6 4h6m-7 4h8m-9 6h10a2 2 0 002-2V6.5L14.5 2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
					</svg>
				{/snippet}
				<BackendModelFlowPanel
					rawConfig={selectedItem?.config ?? null}
					processedModel={backendModel}
					{databaseMetadata}
				/>
			</BackendToolWindow>
		{/if}

		{#if showSessionPanel}
			<BackendToolWindow
				title="Backend state"
				ariaLabel="Backend state tool"
				offset={1}
				widthClass="w-[min(48rem,calc(100vw-2rem))]"
				onClose={() => (showSessionPanel = false)}
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

		{#if showEventsPanel}
			<BackendToolWindow
				title="Event stream"
				ariaLabel="Backend event stream tool"
				offset={2}
				widthClass="w-[min(48rem,calc(100vw-2rem))]"
				onClose={() => (showEventsPanel = false)}
			>
				{#snippet icon()}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0l-3-3m3 3l-3 3M3 17h8m0 0l-3-3m3 3l-3 3M3 7h5m8 10h5" />
					</svg>
				{/snippet}
				<EventLogPanel entries={eventLog} />
			</BackendToolWindow>
		{/if}
	</div>
</main>
