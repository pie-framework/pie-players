<script lang="ts">
	import { getContext } from "svelte";
	import type { Writable } from "svelte/store";
	import type { ProfileConfig } from "./profile-templates";

	const profileStore = getContext<Writable<ProfileConfig>>("profileStore");
	const eventLogStore = getContext<Writable<any[]>>("eventLogStore");

	let activeTab: "events" | "profile" | "a11y" | "performance" = "events";
	let eventFilter = "";
	let autoScroll = true;
	let eventLogContainer: HTMLElement;

	// Auto-scroll to bottom when new events arrive
	$: if (autoScroll && eventLogContainer && $eventLogStore) {
		setTimeout(() => {
			eventLogContainer.scrollTop = eventLogContainer.scrollHeight;
		}, 0);
	}

	$: filteredEvents = $eventLogStore.filter((event) => {
		if (!eventFilter) return true;
		const query = eventFilter.toLowerCase();
		return (
			event.type.toLowerCase().includes(query) ||
			JSON.stringify(event.data).toLowerCase().includes(query)
		);
	});

	function clearEvents() {
		$eventLogStore = [];
	}

	function exportEvents() {
		const blob = new Blob([JSON.stringify($eventLogStore, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `events-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString();
	}
</script>

<div
	class="w-[400px] h-full flex flex-col bg-base-200 border-l border-base-content/10"
>
	<!-- Tabs -->
	<div class="tabs tabs-boxed p-2 gap-1">
		<button
			class="tab tab-sm flex-1"
			class:tab-active={activeTab === "events"}
			on:click={() => (activeTab = "events")}
		>
			Events
		</button>
		<button
			class="tab tab-sm flex-1"
			class:tab-active={activeTab === "profile"}
			on:click={() => (activeTab = "profile")}
		>
			Profile
		</button>
		<button
			class="tab tab-sm flex-1"
			class:tab-active={activeTab === "a11y"}
			on:click={() => (activeTab = "a11y")}
		>
			A11y
		</button>
		<button
			class="tab tab-sm flex-1"
			class:tab-active={activeTab === "performance"}
			on:click={() => (activeTab = "performance")}
		>
			Perf
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-hidden">
		{#if activeTab === "events"}
			<div class="flex flex-col h-full">
				<!-- Controls -->
				<div class="p-2 bg-base-300 flex gap-2 items-center">
					<input
						type="text"
						placeholder="Filter events..."
						class="input input-sm flex-1"
						bind:value={eventFilter}
					/>
					<label class="label cursor-pointer gap-1 p-0">
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							bind:checked={autoScroll}
						/>
						<span class="label-text text-xs">Auto</span>
					</label>
					<button class="btn btn-sm btn-ghost" on:click={clearEvents}>
						Clear
					</button>
					<button class="btn btn-sm btn-ghost" on:click={exportEvents}>
						Export
					</button>
				</div>

				<!-- Event List -->
				<div
					class="flex-1 overflow-y-auto p-2 space-y-2"
					bind:this={eventLogContainer}
				>
					{#if filteredEvents.length === 0}
						<div class="text-center py-8 text-base-content/60 text-sm">
							{#if $eventLogStore.length === 0}
								No events logged yet
							{:else}
								No events match filter "{eventFilter}"
							{/if}
						</div>
					{:else}
						{#each filteredEvents as event}
							<div class="bg-base-100 p-2 rounded text-xs">
								<div class="flex justify-between mb-1">
									<span class="font-semibold text-primary">{event.type}</span>
									<span class="text-base-content/60">
										{formatTime(event.timestamp)}
									</span>
								</div>
								<pre
									class="text-base-content/80 overflow-x-auto">{JSON.stringify(event.data, null, 2)}</pre>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{:else if activeTab === "profile"}
			<div class="overflow-y-auto h-full p-4">
				<h3 class="font-semibold mb-2 text-sm">Current Profile</h3>

				<!-- Profile Summary -->
				<div class="space-y-2 mb-4">
					<div class="bg-base-100 p-2 rounded">
						<div class="text-xs font-semibold mb-1">Accessibility</div>
						<ul class="text-xs space-y-1 text-base-content/80">
							<li>
								TTS: {$profileStore.accessibility.textToSpeech.enabled
									? "Enabled"
									: "Disabled"}
							</li>
							<li>
								High Contrast: {$profileStore.accessibility.highContrast
									? "Yes"
									: "No"}
							</li>
							<li>Font Size: {$profileStore.accessibility.fontSize}</li>
							<li>
								Extended Time: {$profileStore.timing.extendedTimeMultiplier}x
							</li>
						</ul>
					</div>

					<div class="bg-base-100 p-2 rounded">
						<div class="text-xs font-semibold mb-1">Tools</div>
						<div class="flex flex-wrap gap-1 mt-1">
							{#if $profileStore.tools.calculator !== "none"}
								<div class="badge badge-sm">{$profileStore.tools.calculator}</div>
							{/if}
							{#each Object.entries($profileStore.tools) as [key, value]}
								{#if value === true}
									<div class="badge badge-sm">{key}</div>
								{/if}
							{/each}
						</div>
					</div>

					<div class="bg-base-100 p-2 rounded">
						<div class="text-xs font-semibold mb-1">Assessment</div>
						<ul class="text-xs space-y-1 text-base-content/80">
							<li>Subject: {$profileStore.assessment.subject}</li>
							<li>Grade: {$profileStore.assessment.gradeLevel}</li>
							<li>WCAG: {$profileStore.district.wcagLevel}</li>
						</ul>
					</div>
				</div>

				<!-- Full Profile JSON -->
				<h3 class="font-semibold mb-2 text-sm">Raw Profile Data</h3>
				<pre
					class="text-xs bg-base-100 p-2 rounded overflow-x-auto">{JSON.stringify($profileStore, null, 2)}</pre>
			</div>
		{:else if activeTab === "a11y"}
			<div class="overflow-y-auto h-full p-4">
				<div class="flex justify-between items-center mb-4">
					<h3 class="font-semibold text-sm">Accessibility Audit</h3>
					<button class="btn btn-sm btn-primary">Run Audit</button>
				</div>

				<!-- Placeholder for future a11y audit implementation -->
				<div class="text-center py-8 text-base-content/60 text-sm">
					<p>Click "Run Audit" to perform accessibility checks</p>
					<p class="mt-2 text-xs">
						This will check WCAG compliance, keyboard navigation, and screen
						reader support
					</p>
				</div>

				<!-- Current A11y Settings -->
				<div class="mt-4">
					<h4 class="font-semibold text-xs mb-2">Current Settings</h4>
					<div class="space-y-1 text-xs">
						<div class="flex justify-between">
							<span>WCAG Target:</span>
							<span class="font-mono">{$profileStore.district.wcagLevel}</span>
						</div>
						<div class="flex justify-between">
							<span>Keyboard Nav Required:</span>
							<span class="font-mono">
								{$profileStore.district.keyboardNavigationRequired
									? "Yes"
									: "No"}
							</span>
						</div>
						<div class="flex justify-between">
							<span>High Contrast:</span>
							<span class="font-mono">
								{$profileStore.accessibility.highContrast ? "Yes" : "No"}
							</span>
						</div>
						<div class="flex justify-between">
							<span>Screen Reader:</span>
							<span class="font-mono">
								{$profileStore.accessibility.screenReader ? "Yes" : "No"}
							</span>
						</div>
					</div>
				</div>
			</div>
		{:else if activeTab === "performance"}
			<div class="overflow-y-auto h-full p-4">
				<h3 class="font-semibold mb-4 text-sm">Performance Metrics</h3>

				<!-- Placeholder for future performance monitoring -->
				<div class="space-y-4">
					<div>
						<h4 class="font-semibold text-xs mb-2">Rendering</h4>
						<div class="space-y-1 text-xs">
							<div class="flex justify-between">
								<span>Initial Render:</span>
								<span class="font-mono">-</span>
							</div>
							<div class="flex justify-between">
								<span>Profile Change:</span>
								<span class="font-mono">-</span>
							</div>
						</div>
					</div>

					<div>
						<h4 class="font-semibold text-xs mb-2">Interactions</h4>
						<div class="space-y-1 text-xs">
							<div class="flex justify-between">
								<span>Average Response Time:</span>
								<span class="font-mono">-</span>
							</div>
							<div class="flex justify-between">
								<span>Tool Open Time:</span>
								<span class="font-mono">-</span>
							</div>
						</div>
					</div>

					<div>
						<h4 class="font-semibold text-xs mb-2">Memory</h4>
						<div class="space-y-1 text-xs">
							<div class="flex justify-between">
								<span>Heap Used:</span>
								<span class="font-mono">
									{(performance as any).memory
										? `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`
										: "N/A"}
								</span>
							</div>
						</div>
					</div>
				</div>

				<div class="mt-4 text-xs text-base-content/60">
					<p>
						Performance metrics will be captured during player interactions and
						displayed here.
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
