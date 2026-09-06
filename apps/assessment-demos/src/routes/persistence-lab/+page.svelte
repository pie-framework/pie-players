<script lang="ts">
	import { onMount } from "svelte";
	import { afterNavigate, replaceState } from "$app/navigation";
	import "@pie-players/pie-assessment-player/components/assessment-player-default-element";
	import type { AssessmentControllerHandle, AssessmentPlayerRuntimeHostContract, AssessmentPlayerHooks } from "@pie-players/pie-assessment-player";
	import type { LabBehavior, readLab } from "$lib/server/persistence-lab";
	import { getAssessmentDemoById } from "$lib/content/assessments";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	type LabState = ReturnType<typeof readLab>;
	type Operation = { id: number; kind: "Save" | "Submit"; result: "pending" | "resolved" | "rejected" };
	let target: HTMLDivElement;
	let controller: AssessmentControllerHandle | null = null;
	let ready = $state(false);
	let sectionIndex = $state(0);
	let submitted = $state(false);
	let submissionEvents = $state(0);
	let nextBehavior = $state<LabBehavior>("save");
	let operations = $state<Operation[]>([]);
	let errors = $state<string[]>([]);
	let server = $state<LabState>({ snapshot: null, writes: [] });
	let serverError = $state("");
	let closed = false;
	const endpoint = $derived(`/api/persistence-lab/${encodeURIComponent(data.attemptId)}`);

	async function refresh() {
		try {
			const response = await fetch(endpoint, { cache: "no-store" });
			if (!response.ok) throw new Error(`Server inspection failed (${response.status})`);
			const value: LabState = await response.json();
			if (!closed) { server = value; serverError = ""; }
		} catch (error) {
			if (!closed) serverError = String(error);
		}
	}

	function readController() {
		const state = controller?.getRuntimeState();
		sectionIndex = state?.currentSectionIndex ?? 0;
		submitted = state?.submitted ?? false;
	}

	async function run(kind: "Save" | "Submit") {
		const current = controller;
		if (!current) return;
		const id = operations.length + 1;
		operations = [...operations, { id, kind, result: "pending" }];
		let result: Operation["result"];
		try {
			await (kind === "Save" ? current.persist() : current.submit());
			result = "resolved";
		} catch {
			result = "rejected";
		}
		if (closed) return;
		operations = operations.map(operation => operation.id === id ? { ...operation, result } : operation);
		readController();
		await refresh();
	}

	async function release(id: number, commit: boolean) {
		const response = await fetch(endpoint, {
			method: "POST", headers: { "content-type": "application/json" },
			body: JSON.stringify({ id, commit }),
		});
		if (!response.ok) serverError = `Write control failed (${response.status})`;
		await refresh();
	}

	function navigate(offset: number) {
		controller?.navigateTo(sectionIndex + offset);
		readController();
	}

	afterNavigate(() => {
		replaceState(`/persistence-lab?attempt=${encodeURIComponent(data.attemptId)}`, {});
	});

	onMount(() => {
		const host = document.createElement("pie-assessment-player-default") as HTMLElement & AssessmentPlayerRuntimeHostContract;
		const assessment = structuredClone(getAssessmentDemoById("three-section-assessment")!.assessment);
		assessment.identifier = "assessment-persistence-lab";
		const hooks: AssessmentPlayerHooks = {
			createAssessmentSessionPersistence() {
				return {
					async loadSession() {
						const response = await fetch(endpoint, { cache: "no-store" });
						if (!response.ok) throw new Error(`Load failed (${response.status})`);
						return ((await response.json()) as LabState).snapshot;
					},
					async saveSession(_context, snapshot) {
						const behavior = nextBehavior;
						nextBehavior = "save";
						const response = await fetch(endpoint, {
							method: "PUT", headers: { "content-type": "application/json" },
							body: JSON.stringify({ snapshot, behavior }),
						});
						if (!response.ok) throw new Error((await response.json()).error);
					},
				};
			},
			onError(error) { if (!closed) errors = [...errors, error.message]; },
		};
		Object.assign(host, {
			assessmentId: assessment.identifier, attemptId: data.attemptId,
			assessment, hooks, showNavigation: false, sectionPlayerLayout: "vertical",
			env: { mode: "gather", role: "student", partialScoring: false },
		});
		target.append(host);
		let unsubscribe: (() => void) | undefined;
		void host.waitForAssessmentController(10_000).then(value => {
			if (closed) return;
			controller = value;
			ready = Boolean(value);
			if (!value) { errors = [...errors, "Assessment did not become ready."]; return; }
			readController();
			unsubscribe = value.subscribe(event => {
				if (event.type === "assessment-submission-state-changed" && event.submitted) submissionEvents += 1;
				readController();
			});
		});
		let timer: ReturnType<typeof setTimeout>;
		async function poll() {
			await refresh();
			if (!closed) timer = setTimeout(poll, 300);
		}
		void poll();
		return () => { closed = true; clearTimeout(timer); unsubscribe?.(); host.remove(); controller = null; };
	});
</script>

<svelte:head><title>Assessment persistence lab</title></svelte:head>

<div class="pie-persistence-lab">
	<h1>Assessment persistence lab</h1>
	<p>A local test host for R2. Saves cross HTTP and store complete assessment snapshots in SQLite. Held writes expire after 60 seconds. Reload this URL to read the stored attempt.</p>
	<p>Navigation captures answers in memory. Save explicitly to control request ordering. “Submitted” below is the controller’s report; this lab has no backend finalization service.</p>
	<p class="pie-lab-attempt">Attempt: <code>{data.attemptId}</code></p>
	<div class="pie-lab-controls">
		<label for="next-write">Next write behavior</label>
		<select id="next-write" bind:value={nextBehavior}>
			<option value="save">Commit and acknowledge</option>
			<option value="hold">Hold until released</option>
			<option value="reject">Reject before commit</option>
			<option value="lose-ack">Commit, then fail acknowledgement</option>
		</select>
		<button type="button" disabled={!ready} onclick={() => run("Save")}>Save snapshot</button>
		<button type="button" disabled={!ready} onclick={() => run("Submit")}>Submit attempt</button>
		<a href="/persistence-lab" data-sveltekit-reload>Start a new attempt</a>
	</div>
	<div class="pie-lab-controls">
		<button type="button" disabled={!ready || sectionIndex === 0} onclick={() => navigate(-1)}>Previous section</button>
		<button type="button" disabled={!ready || sectionIndex === 2} onclick={() => navigate(1)}>Next section</button>
		<p role="status">{ready ? `Ready. Section ${sectionIndex + 1} of 3.` : "Loading assessment…"}</p>
	</div>
	<p data-testid="submission-state">Controller submitted: {String(submitted)}. Successful submission events: {submissionEvents}.</p>
	{#if errors.length}<p role="alert">Persistence hook: {errors.at(-1)}</p>{/if}
	{#if serverError}<p role="alert">{serverError}</p>{/if}
	<div class="pie-lab-player" bind:this={target}></div>
	<section aria-labelledby="operations-title">
		<h2 id="operations-title">Caller results</h2>
		<ul aria-live="polite">{#each operations as operation (operation.id)}<li>{operation.id}: {operation.kind} {operation.result}</li>{/each}</ul>
	</section>
	<section aria-labelledby="writes-title">
		<h2 id="writes-title">Server writes</h2>
		<p>Stored section: {server.snapshot ? server.snapshot.navigationState.currentSectionIndex + 1 : "none"}</p>
		<ol>{#each server.writes as write (write.id)}
			<li class="pie-lab-write">Write {write.id}: section {write.sectionIndex + 1}, {write.phase}{write.committedOrder ? `, commit ${write.committedOrder}` : ""}.
				{#if write.phase === "pending" && write.behavior === "hold"}
					<button type="button" onclick={() => release(write.id, true)}>Release write {write.id}</button>
					<button type="button" onclick={() => release(write.id, false)}>Reject write {write.id}</button>
				{/if}
			</li>
		{/each}</ol>
	</section>
	<details><summary>Inspect host and server JSON</summary><pre data-testid="lab-state">{JSON.stringify({ server, operations, submitted, submissionEvents, errors }, null, 2)}</pre></details>
</div>

<style>
	.pie-persistence-lab { max-width: 80rem; margin: auto; padding: 1rem; color: var(--pie-text); }
	h1 { font-size: 1.8rem; font-weight: 700; } h2 { font-size: 1.3rem; font-weight: 650; margin-block: 1rem 0.5rem; }
	p { margin-block: 0.6rem; } .pie-lab-attempt { overflow-wrap: anywhere; }
	.pie-lab-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-block: 0.75rem; }
	button, select, a { min-height: 2.75rem; max-width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--pie-border); border-radius: 0.25rem; background: var(--pie-background); color: var(--pie-text); }
	button { cursor: pointer; } button:disabled { opacity: 0.6; cursor: default; }
	button:focus-visible, select:focus-visible, a:focus-visible, summary:focus-visible { outline: 3px solid var(--pie-button-focus-outline, #2563eb); outline-offset: 3px; }
	.pie-lab-player { height: 36rem; min-height: 0; min-width: 0; }
	.pie-lab-write { margin-block: 0.75rem; } ol, ul { padding-left: 1.5rem; }
	pre { overflow: auto; max-height: 28rem; padding: 0.5rem; border: 1px solid var(--pie-border); }
	[role="alert"] { border-left: 0.25rem solid var(--pie-text); padding: 0.5rem; }
</style>
