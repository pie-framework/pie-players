<script lang="ts">
	import { onMount, tick } from "svelte";
	import "@pie-players/pie-item-player";

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
	let selectedStrategy = $state<"iife" | "esm">("iife");
	let demoState = $state<DemoState>({});
	let eventLog = $state<EventLogEntry[]>([]);
	let clientSessionSnapshot = $state<unknown>(null);
	let serverSessionSnapshot = $state<unknown>(null);
	let backendModel = $state<unknown>(null);
	let serverScore = $state<unknown>(null);
	let localScore = $state<unknown>(null);
	let busyMessage = $state("");
	let errorMessage = $state("");
	const availableItems = $derived(demoState.items || []);
	const selectedItem = $derived(
		availableItems.find((item) => item.id === selectedItemId) || null,
	);

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
		playerEl.strategy = selectedStrategy;
		playerEl.loaderOptions =
			selectedStrategy === "esm"
				? {
						esmCdnUrl: "https://cdn.jsdelivr.net/npm",
						runtimeSupportCheck: "on",
					}
				: {
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
			await refreshServerSnapshot();
		});
	}

	async function createFreshSession() {
		await runAction("Creating a fresh backend session", async () => {
			sessionId = `${selectedItemId}-session-${Date.now()}`;
			clientSessionSnapshot = null;
			serverSessionSnapshot = null;
			backendModel = null;
			serverScore = null;
			localScore = null;
			await tick();
			await playerEl?.loadFromBackend("delivery");
			await refreshServerSnapshot();
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
		localScore = null;
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

	async function refreshBackendModel() {
		await runAction("Loading backend controller model()", async () => {
			const response = await fetch("/api/player/model", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					itemId: selectedItemId,
					sessionId,
					env,
				}),
			});
			backendModel = await response.json();
		});
	}

	async function scoreLocally() {
		await runAction("Scoring locally through provideScore()", async () => {
			localScore = await playerEl?.provideScore();
		});
	}
</script>

<svelte:head>
	<title>PIE Backend Integration Demo</title>
</svelte:head>

<main class="backend-demo-shell">
	<section class="hero-panel">
		<p class="eyebrow">PIE backend contract lab</p>
		<h1>Delivery backend integration</h1>
		<p class="lede">
			This demo wires <code>pie-item-player</code> to local
			<code>/api/player/*</code> endpoints shaped like the delivery subset used by
			legacy <code>pie-api-player</code>. Auth, sanctioned versions, overrides, and
			PIE API release concerns are intentionally absent.
		</p>
		<p class="lede">
			The backend stores raw item config, but delivery loads controller-processed
			models. For student delivery, that keeps correct-response data and scoring
			logic on the server: <code>/api/player/model</code> runs controller
			<code>model()</code>, and <code>/api/player/score</code> runs controller
			<code>outcome()</code>.
		</p>
	</section>

	<section
		class="control-rack"
		aria-label="Backend demo controls"
		aria-busy={busyMessage ? "true" : "false"}
	>
		<label>
			Demo item from SQLite
			<select value={selectedItemId} onchange={loadSelectedItem}>
				{#each availableItems as item}
					<option value={item.id}>{item.name}</option>
				{/each}
			</select>
		</label>
		<label>
			Session ID
			<input bind:value={sessionId} />
		</label>
		<label>
			Loader strategy
			<select bind:value={selectedStrategy}>
				<option value="iife">iife</option>
				<option value="esm">esm</option>
			</select>
		</label>
		<div class="button-row">
			<button type="button" onclick={reloadCurrentSession}>Load current session</button>
			<button type="button" onclick={createFreshSession}>New backend session</button>
			<button type="button" onclick={saveExplicitly}>saveSession()</button>
			<button type="button" onclick={refreshBackendModel}>backend model()</button>
			<button type="button" onclick={scoreOnServer}>server score()</button>
			<button type="button" onclick={scoreLocally}>local provideScore()</button>
		</div>
		{#if busyMessage}
			<p class="status" role="status" aria-live="polite">Working: {busyMessage}</p>
		{/if}
		{#if errorMessage}
			<pre class="error-box" role="alert">{errorMessage}</pre>
		{/if}
	</section>

	<section class="concept-panel" aria-label="Backend model and scoring boundary">
		<article>
			<h2>Raw database config</h2>
			<p>
				SQLite keeps the authored model, including correct-response fields that
				should not be sent directly to student clients.
			</p>
			<pre>{JSON.stringify(selectedItem?.config ?? null, null, 2)}</pre>
		</article>
		<article>
			<h2>Controller-processed model</h2>
			<p>
				<code>/api/player/model</code> loads the right controller and returns the
				model after <code>model()</code> has filtered it for <code>env</code>.
			</p>
			<pre>{JSON.stringify(backendModel, null, 2)}</pre>
		</article>
		<article>
			<h2>SQLite metadata</h2>
			<p>
				The demo database lives on disk so reloads can hydrate saved sessions.
			</p>
			<pre>{JSON.stringify({ dbPath: demoState.dbPath, sessions: demoState.sessions }, null, 2)}</pre>
		</article>
	</section>

	<section class="workbench">
		<div class="player-card">
			<div class="card-heading">
				<span>Live item player</span>
				<code>{selectedStrategy}</code>
			</div>
			<pie-item-player bind:this={playerEl}></pie-item-player>
		</div>

		<div class="telemetry-grid">
			<article>
				<h2>Client session</h2>
				<pre data-testid="client-session">{JSON.stringify(clientSessionSnapshot, null, 2)}</pre>
			</article>
			<article>
				<h2>Stored backend session</h2>
				<pre data-testid="stored-session">{JSON.stringify(serverSessionSnapshot, null, 2)}</pre>
			</article>
			<article>
				<h2>Backend outcome</h2>
				<pre data-testid="backend-outcome">{JSON.stringify(serverScore, null, 2)}</pre>
			</article>
			<article>
				<h2>Local score</h2>
				<pre>{JSON.stringify(localScore, null, 2)}</pre>
			</article>
		</div>
	</section>

	<section class="event-log" aria-label="Backend event log">
		<h2>Event stream</h2>
		{#each eventLog as entry}
			<article>
				<header>
					<time>{entry.at}</time>
					<strong>{entry.type}</strong>
				</header>
				<pre>{JSON.stringify(entry.detail, null, 2)}</pre>
			</article>
		{/each}
	</section>
</main>

<style>
	.backend-demo-shell {
		min-height: 100vh;
		padding: 32px;
		background:
			linear-gradient(90deg, rgba(23, 32, 42, 0.05) 1px, transparent 1px),
			linear-gradient(rgba(23, 32, 42, 0.05) 1px, transparent 1px),
			#f4f1ea;
		background-size: 28px 28px;
	}

	.hero-panel,
	.concept-panel article,
	.control-rack,
	.player-card,
	.telemetry-grid article,
	.event-log {
		border: 2px solid #17202a;
		background: rgba(255, 252, 244, 0.94);
		box-shadow: 8px 8px 0 #17202a;
	}

	.hero-panel {
		max-width: 1060px;
		padding: 28px;
		margin-bottom: 28px;
	}

	.eyebrow {
		margin: 0 0 8px;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.8rem;
		color: #a13d20;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 12px;
		font-size: clamp(2.25rem, 6vw, 5rem);
		line-height: 0.9;
		letter-spacing: -0.08em;
	}

	.lede {
		max-width: 850px;
		margin-bottom: 14px;
		font-size: 1rem;
		line-height: 1.6;
	}

	.lede:last-child {
		margin-bottom: 0;
	}

	code {
		padding: 2px 6px;
		background: #17202a;
		color: #f9d65c;
	}

	.control-rack {
		display: grid;
		gap: 16px;
		padding: 20px;
		margin-bottom: 28px;
	}

	label {
		display: grid;
		gap: 6px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	input,
	select {
		width: min(100%, 460px);
		padding: 10px 12px;
		border: 2px solid #17202a;
		background: #fff;
		font: inherit;
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	button {
		padding: 10px 14px;
		border: 2px solid #17202a;
		background: #f9d65c;
		color: #17202a;
		font-weight: 800;
		cursor: pointer;
		box-shadow: 3px 3px 0 #17202a;
	}

	button:hover {
		transform: translate(1px, 1px);
		box-shadow: 2px 2px 0 #17202a;
	}

	.status {
		margin: 0;
		font-weight: 700;
	}

	.error-box {
		padding: 12px;
		border: 2px solid #a13d20;
		background: #ffe4dc;
	}

	.workbench {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
		gap: 28px;
		align-items: start;
	}

	.concept-panel {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		margin-bottom: 28px;
	}

	.concept-panel article {
		padding: 16px;
	}

	.player-card {
		padding: 20px;
		min-height: 360px;
	}

	.card-heading {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	pie-item-player {
		display: block;
		min-height: 240px;
	}

	.telemetry-grid {
		display: grid;
		gap: 18px;
	}

	.telemetry-grid article,
	.event-log {
		padding: 16px;
	}

	.concept-panel h2,
	.telemetry-grid h2,
	.event-log h2 {
		margin-bottom: 10px;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.concept-panel p {
		min-height: 66px;
		margin-bottom: 10px;
		line-height: 1.45;
	}

	.concept-panel pre,
	.telemetry-grid pre,
	.event-log pre {
		max-height: 220px;
		overflow: auto;
		padding: 12px;
		background: #17202a;
		color: #d5ffe4;
		font-size: 0.78rem;
	}

	.event-log {
		margin-top: 28px;
	}

	.event-log article {
		border-top: 1px solid rgba(23, 32, 42, 0.25);
		padding: 12px 0;
	}

	.event-log header {
		display: flex;
		gap: 12px;
		align-items: baseline;
		margin-bottom: 8px;
	}

	.event-log time {
		color: #a13d20;
	}

	@media (max-width: 980px) {
		.backend-demo-shell {
			padding: 18px;
		}

		.workbench {
			grid-template-columns: 1fr;
		}

		.concept-panel {
			grid-template-columns: 1fr;
		}
	}
</style>
