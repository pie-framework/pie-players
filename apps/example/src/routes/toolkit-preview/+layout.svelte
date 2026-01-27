<script lang="ts">
	
	import { setContext } from "svelte";
import { writable } from "svelte/store";
	import { base } from "$app/paths";
	import type { ProfileConfig } from "./profile-templates";
	import { DEFAULT_PROFILE } from "./profile-templates";

	// Create stores for shared state
	export const profileStore = writable<ProfileConfig>(DEFAULT_PROFILE);
	export const eventLogStore = writable<any[]>([]);
	export const showProfileEditor = writable(false);
	export const showDebugPanel = writable(false);

	// Provide context to child routes
	setContext("profileStore", profileStore);
	setContext("eventLogStore", eventLogStore);
	setContext("showProfileEditor", showProfileEditor);
	setContext("showDebugPanel", showDebugPanel);

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey) {
			switch (event.key) {
				case "e":
					event.preventDefault();
					showProfileEditor.update((v) => !v);
					break;
				case "d":
					event.preventDefault();
					showDebugPanel.update((v) => !v);
					break;
			}
		}
	}

	function goBack() {
		window.history.back();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex flex-col h-screen">
	<!-- Header -->
	<div class="bg-base-300 px-4 py-2 border-b border-base-content/10">
		<div class="flex items-center justify-between gap-2">
			<button
				class="btn btn-sm btn-ghost"
				on:click={goBack}
				title="Go back"
			>
				← Back
			</button>
			<div class="flex items-center gap-2">
				<button
					class="btn btn-sm btn-ghost"
					class:btn-active={$showProfileEditor}
					on:click={() => showProfileEditor.update((v) => !v)}
					title="Toggle Profile Editor (Ctrl+E)"
				>
					Profile Editor
				</button>
				<button
					class="btn btn-sm btn-ghost"
					class:btn-active={$showDebugPanel}
					on:click={() => showDebugPanel.update((v) => !v)}
					title="Toggle Debug Panel (Ctrl+D)"
				>
					Debug Panel
				</button>
			</div>
		</div>
	</div>

	<!-- Main content area -->
	<div class="flex-1 flex overflow-hidden">
		<slot />
	</div>
</div>
