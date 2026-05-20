<script lang="ts">
	import { tick } from "svelte";
	import { onMount } from "svelte";
	import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
	import {
		ASSESSMENT_PLAYER_PUBLIC_EVENTS,
		type AssessmentPlayerHooks,
		type AssessmentPlayerRuntimeHostContract,
	} from "@pie-players/pie-assessment-player";
	import "@pie-players/pie-assessment-player/components/assessment-player-default-element";
	import { ltiDemoAssessment } from "$lib/content/lti-assessment";
	import {
		deleteAssessmentSessionSnapshot,
		loadAssessmentSessionSnapshot,
		loadVerifiedLaunchContext,
		saveAssessmentSessionSnapshot,
	} from "$lib/lti-demo/client";
	import type {
		AssessmentSessionSnapshot,
		VerifiedLtiLaunchContext,
	} from "$lib/lti-demo/types";

	let launchContext = $state<VerifiedLtiLaunchContext | null>(null);
	let playerRef = $state<HTMLElement | null>(null);
	let playerKey = $state(0);
	let activeSectionId = $state("");
	let loadStatus = $state<"loading" | "ready" | "error">("loading");
	let saveStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
	let errorMessage = $state<string | null>(null);
	let snapshot = $state<
		ReturnType<AssessmentPlayerRuntimeHostContract["getSnapshot"]> | null
	>(null);

	let coordinator: ToolkitCoordinator | null = null;
	let detachPlayerListeners: (() => void) | null = null;
	let lastPersistedFingerprint = "";
	let isPersisting = false;
	let persistAgainAfterCurrent = false;
	let persistenceSuppressed = false;

	function createCoordinator(assessmentId: string): ToolkitCoordinator {
		return new ToolkitCoordinator({
			assessmentId,
			hooks: {
				onFrameworkError: (model) => {
					console.warn("[LTI demo] toolkit framework error:", model);
				},
				async createSectionSessionPersistence() {
					return {
						async loadSession() {
							return null;
						},
						async saveSession() {},
						async clearSession() {},
					};
				},
			},
		});
	}

	function createAssessmentHooks(
		context: VerifiedLtiLaunchContext,
	): AssessmentPlayerHooks {
		return {
			onError: (error, details) => {
				console.error("[LTI demo] assessment-player hook error:", details, error);
			},
			async createAssessmentSessionPersistence() {
				return {
					async loadSession() {
						return await loadAssessmentSessionSnapshot({
							assessmentId: context.assessmentId,
							attemptId: context.attemptId,
						});
					},
					async saveSession(_persistenceContext, session) {
						await saveAssessmentSessionSnapshot({
							assessmentId: context.assessmentId,
							attemptId: context.attemptId,
							snapshot:
								(session as AssessmentSessionSnapshot | null | undefined) || null,
						});
					},
					async clearSession() {
						await deleteAssessmentSessionSnapshot({
							assessmentId: context.assessmentId,
							attemptId: context.attemptId,
						});
					},
				};
			},
		};
	}

	function roleFromLaunch(context: VerifiedLtiLaunchContext): "student" | "instructor" {
		const roleText = context.roles.join(" ").toLowerCase();
		return roleText.includes("instructor") || roleText.includes("teacher")
			? "instructor"
			: "student";
	}

	function refreshSnapshot() {
		const host = playerRef as unknown as AssessmentPlayerRuntimeHostContract | null;
		const nextSnapshot = host?.getSnapshot?.() ?? null;
		snapshot = nextSnapshot;
		const currentSectionId = String(nextSnapshot?.navigation.currentSectionId || "");
		if (currentSectionId) {
			activeSectionId = currentSectionId;
		}
	}

	function fingerprint(payload: unknown): string {
		try {
			return JSON.stringify(payload || {});
		} catch {
			return String(Date.now());
		}
	}

	async function persistCurrentSession() {
		if (persistenceSuppressed || !launchContext || !playerRef) return;
		if (isPersisting) {
			persistAgainAfterCurrent = true;
			return;
		}

		isPersisting = true;
		try {
			do {
				persistAgainAfterCurrent = false;
				const context: VerifiedLtiLaunchContext = launchContext;
				const host = playerRef as unknown as AssessmentPlayerRuntimeHostContract;
				const controller =
					(await host.waitForAssessmentController?.(3000)) ||
					host.getAssessmentController?.();
				if (!controller?.getSession) return;

				const currentSession = controller.getSession();
				const nextFingerprint = fingerprint(currentSession);
				if (nextFingerprint === lastPersistedFingerprint) continue;

				saveStatus = "saving";
				await saveAssessmentSessionSnapshot({
					assessmentId: context.assessmentId,
					attemptId: context.attemptId,
					snapshot: currentSession as AssessmentSessionSnapshot,
				});
				if (launchContext?.attemptId === context.attemptId) {
					lastPersistedFingerprint = nextFingerprint;
					saveStatus = "saved";
				}
			} while (persistAgainAfterCurrent && !persistenceSuppressed);
		} catch (error) {
			console.error("[LTI demo] failed to persist assessment session:", error);
			saveStatus = "error";
		} finally {
			isPersisting = false;
		}
	}

	function configurePlayer() {
		if (!launchContext || !playerRef || !coordinator) return;
		detachPlayerListeners?.();
		const host = playerRef as any;
		host.assessmentId = launchContext.assessmentId;
		host.attemptId = launchContext.attemptId;
		host.assessment = ltiDemoAssessment;
		host.env = {
			mode: "gather",
			role: roleFromLaunch(launchContext),
		};
		host.sectionPlayerLayout = "splitpane";
		host.showNavigation = true;
		host.hooks = createAssessmentHooks(launchContext);
		host.coordinator = coordinator;
		void host.bootstrapController?.();

		const onRouteChanged = () => {
			refreshSnapshot();
			queueMicrotask(() => {
				void persistCurrentSession();
			});
		};
		const onSessionChanged = () => {
			refreshSnapshot();
			queueMicrotask(() => {
				void persistCurrentSession();
			});
		};
		playerRef.addEventListener(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
			onRouteChanged,
		);
		playerRef.addEventListener(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionChanged,
			onSessionChanged,
		);
		detachPlayerListeners = () => {
			playerRef?.removeEventListener(
				ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
				onRouteChanged,
			);
			playerRef?.removeEventListener(
				ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionChanged,
				onSessionChanged,
			);
		};
		refreshSnapshot();
	}

	async function loadLaunch(newAttempt = false) {
		loadStatus = "loading";
		errorMessage = null;
		saveStatus = "idle";
		persistenceSuppressed = true;
		detachPlayerListeners?.();
		detachPlayerListeners = null;
		try {
			await waitForPersistIdle();
			const context = await loadVerifiedLaunchContext({ newAttempt });
			launchContext = context;
			activeSectionId = "";
			snapshot = null;
			lastPersistedFingerprint = "";
			coordinator = createCoordinator(context.assessmentId);
			playerKey += 1;
			await tick();
			configurePlayer();
			loadStatus = "ready";
			persistenceSuppressed = false;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			loadStatus = "error";
			persistenceSuppressed = false;
		}
	}

	async function waitForPersistIdle() {
		while (isPersisting) {
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
	}

	async function clearServerSnapshot() {
		if (!launchContext) return;
		saveStatus = "saving";
		persistenceSuppressed = true;
		try {
			await waitForPersistIdle();
			await deleteAssessmentSessionSnapshot({
				assessmentId: launchContext.assessmentId,
				attemptId: launchContext.attemptId,
			});
			lastPersistedFingerprint = "";
			playerKey += 1;
			await tick();
			configurePlayer();
			saveStatus = "idle";
			persistenceSuppressed = false;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			saveStatus = "error";
			persistenceSuppressed = false;
		}
	}

	onMount(() => {
		void loadLaunch();
		return () => {
			detachPlayerListeners?.();
		};
	});
</script>

<svelte:head>
	<title>PIE LTI Launch Demo</title>
</svelte:head>

<main class="lti-demo-page">
	<section class="lti-demo-intro">
		<div>
			<p class="lti-demo-eyebrow">Mock verified LTI launch</p>
			<h1>PIE Players From An LTI Tool Host</h1>
			<p>
				This page starts after protocol validation. The host maps launch context to
				player props, then persists assessment sessions through a server API.
			</p>
		</div>
		<div class="lti-demo-actions">
			<button type="button" onclick={() => void loadLaunch(true)}>
				New Mock Attempt
			</button>
			<button type="button" class="secondary" onclick={() => void clearServerSnapshot()}>
				Clear Server Snapshot
			</button>
		</div>
	</section>

	{#if loadStatus === "error"}
		<section class="lti-demo-alert">
			<strong>Launch failed:</strong> {errorMessage}
		</section>
	{:else if !launchContext}
		<section class="lti-demo-card">Loading mock LTI launch...</section>
	{:else}
		<section class="lti-demo-grid" aria-label="Launch mapping">
			<div class="lti-demo-card">
				<h2>Verified Launch Context</h2>
				<dl>
					<div>
						<dt>Platform</dt>
						<dd>{launchContext.platformIssuer}</dd>
					</div>
					<div>
						<dt>Deployment</dt>
						<dd>{launchContext.deploymentId}</dd>
					</div>
					<div>
						<dt>Course Context</dt>
						<dd>{launchContext.contextTitle} ({launchContext.contextId})</dd>
					</div>
					<div>
						<dt>Resource Link</dt>
						<dd>{launchContext.resourceTitle}</dd>
					</div>
					<div>
						<dt>User</dt>
						<dd>{launchContext.userDisplayName} ({launchContext.roles.join(", ")})</dd>
					</div>
				</dl>
			</div>

			<div class="lti-demo-card">
				<h2>Mapped Player Inputs</h2>
				<dl>
					<div>
						<dt>assessment-id</dt>
						<dd><code>{launchContext.assessmentId}</code></dd>
					</div>
					<div>
						<dt>attempt-id</dt>
						<dd><code>{launchContext.attemptId}</code></dd>
					</div>
					<div>
						<dt>env</dt>
						<dd><code>mode: gather, role: {roleFromLaunch(launchContext)}</code></dd>
					</div>
					<div>
						<dt>Active section</dt>
						<dd><code>{activeSectionId || "not mounted"}</code></dd>
					</div>
					<div>
						<dt>Persistence</dt>
						<dd>{saveStatus === "idle" ? "server API ready" : saveStatus}</dd>
					</div>
				</dl>
			</div>
		</section>

		<section class="lti-demo-player-card">
			<header>
				<div>
					<h2>{ltiDemoAssessment.title}</h2>
					<p>
						Reload the page after answering to verify the host API hydrates the
						assessment session for the same mock launch.
					</p>
				</div>
				{#if snapshot}
					<p class="lti-demo-position">
						Section {snapshot.navigation.currentIndex + 1} / {snapshot.navigation.totalSections}
					</p>
				{/if}
			</header>

			<div class="lti-demo-player-shell">
				{#key `${launchContext.attemptId}:${playerKey}`}
					<pie-assessment-player-default
						bind:this={playerRef}
						assessment-id={launchContext.assessmentId}
						attempt-id={launchContext.attemptId}
						section-player-layout="splitpane"
						show-navigation="true"
					></pie-assessment-player-default>
				{/key}
			</div>
		</section>
	{/if}
</main>

<style>
	.lti-demo-page {
		display: grid;
		gap: 1rem;
		max-width: 1180px;
		min-height: 100vh;
		margin: 0 auto;
		padding: 1rem;
		box-sizing: border-box;
	}

	.lti-demo-intro,
	.lti-demo-card,
	.lti-demo-player-card,
	.lti-demo-alert {
		border: 1px solid #dbe3ef;
		border-radius: 0.75rem;
		background: #fff;
		box-shadow: 0 8px 24px rgba(20, 32, 52, 0.08);
	}

	.lti-demo-intro {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem;
	}

	.lti-demo-eyebrow {
		margin: 0 0 0.35rem;
		color: #0f766e;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0.5rem;
		font-size: clamp(1.8rem, 4vw, 2.7rem);
	}

	h2 {
		margin-bottom: 0.75rem;
		font-size: 1.1rem;
	}

	.lti-demo-actions {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 0.5rem;
	}

	button {
		border: 1px solid #0f766e;
		border-radius: 0.5rem;
		padding: 0.55rem 0.85rem;
		background: #0f766e;
		color: #fff;
		cursor: pointer;
	}

	button.secondary {
		background: #fff;
		color: #0f766e;
	}

	.lti-demo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}

	.lti-demo-card {
		padding: 1rem;
	}

	dl {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}

	dt {
		color: #526179;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	dd {
		margin: 0.15rem 0 0;
		word-break: break-word;
	}

	.lti-demo-alert {
		padding: 1rem;
		border-color: #fecaca;
		background: #fff1f2;
		color: #991b1b;
	}

	.lti-demo-player-card {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 680px;
		overflow: hidden;
	}

	.lti-demo-player-card header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.lti-demo-position {
		margin: 0;
		color: #526179;
		white-space: nowrap;
	}

	.lti-demo-player-shell {
		min-height: 0;
		overflow: hidden;
		padding: 0.75rem;
	}

	:global(pie-assessment-player-default) {
		display: block;
		height: 100%;
		min-height: 0;
	}

	@media (max-width: 720px) {
		.lti-demo-intro,
		.lti-demo-player-card header {
			display: grid;
		}
	}
</style>
