<script lang="ts">
	import { createEventDispatcher, onMount } from "svelte";

	interface Props {
		value: string;
		packageName: string;
		label?: string;
		compact?: boolean;
	}

	let {
		value = "latest",
		packageName,
		label = "",
		compact = true,
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		change: { packageName: string; version: string };
	}>();

	let versions = $state<string[]>([]);
	let loading = $state(false);
	let searchInput = $state("");
	let dropdownVisible = $state(false);
	let selectedIndex = $state(-1);
	let containerElement: HTMLDivElement;
	let debounceTimer: ReturnType<typeof setTimeout>;
	let lastLoadedPackageName = $state("");

	const inputId = `item-demos-element-version-input-${Math.random().toString(36).slice(2, 11)}`;
	const listboxId = `item-demos-element-version-list-${Math.random().toString(36).slice(2, 11)}`;

	$effect(() => {
		searchInput = value;
	});

	$effect(() => {
		if (!packageName || packageName === lastLoadedPackageName) return;
		lastLoadedPackageName = packageName;
		versions = [];
		selectedIndex = -1;
		void loadVersions();
	});

	const activeDescendantId = $derived(
		dropdownVisible && selectedIndex >= 0 && selectedIndex < versions.length
			? `${listboxId}-option-${selectedIndex}`
			: undefined,
	);

	function debounce(func: (value: string) => void, wait: number) {
		return (...args: [string]) => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				func(...args);
			}, wait);
		};
	}

	async function loadVersions(search = "") {
		loading = true;
		try {
			const normalizedName = packageName.startsWith("@")
				? packageName
				: `@${packageName}`;
			const response = await fetch(
				`/api/packages?package=${encodeURIComponent(normalizedName)}&search=${encodeURIComponent(search)}`,
			);
			if (!response.ok) {
				versions = [];
				return;
			}
			const payload = await response.json();
			versions = Array.isArray(payload)
				? payload.filter((entry): entry is string => typeof entry === "string")
				: [];
		} catch {
			versions = [];
		} finally {
			loading = false;
		}
	}

	const debouncedSearch = debounce(loadVersions, 300);

	function handleInput() {
		dropdownVisible = true;
		selectedIndex = -1;
		debouncedSearch(searchInput);
	}

	function toggleDropdown() {
		dropdownVisible = !dropdownVisible;
		if (dropdownVisible && versions.length === 0 && !loading) {
			void loadVersions(searchInput);
		}
	}

	function selectVersion(version: string) {
		const normalized = version.trim();
		if (!normalized) return;
		searchInput = normalized;
		dropdownVisible = false;
		dispatch("change", { packageName, version: normalized });
	}

	function handleClickOutside(event: MouseEvent) {
		if (!containerElement || containerElement.contains(event.target as Node)) return;
		dropdownVisible = false;
		selectedIndex = -1;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			dropdownVisible = true;
			selectedIndex = Math.min(selectedIndex + 1, versions.length - 1);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			dropdownVisible = true;
			selectedIndex = Math.max(selectedIndex - 1, -1);
			return;
		}
		if (event.key === "Escape") {
			dropdownVisible = false;
			selectedIndex = -1;
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			if (selectedIndex >= 0 && selectedIndex < versions.length) {
				selectVersion(versions[selectedIndex]);
				return;
			}
			selectVersion(searchInput);
		}
	}

	onMount(() => {
		searchInput = value;
		document.addEventListener("click", handleClickOutside);
		return () => {
			document.removeEventListener("click", handleClickOutside);
			clearTimeout(debounceTimer);
		};
	});
</script>

<div class="relative inline-flex items-center {compact ? 'w-auto' : 'w-full'}" bind:this={containerElement}>
	{#if label}
		<span class="text-xs mr-1 font-medium">{label}:</span>
	{/if}
	<div class="relative {compact ? 'w-44' : 'w-full'}">
		<input
			id={inputId}
			type="text"
			class="input input-bordered input-sm w-full pr-8 bg-base-100 border-base-300 shadow-sm"
			bind:value={searchInput}
			oninput={handleInput}
			onfocus={() => {
				dropdownVisible = true;
			}}
			onkeydown={handleKeyDown}
			placeholder="Search or enter version..."
			aria-label={`${packageName} version`}
			role="combobox"
			aria-haspopup="listbox"
			aria-expanded={dropdownVisible}
			aria-controls={listboxId}
			aria-activedescendant={activeDescendantId}
		/>
		<button
			type="button"
			class="btn btn-ghost btn-xs absolute right-1 top-1/2 -translate-y-1/2 px-1 min-h-0 h-6"
			aria-label={`Toggle ${packageName} versions`}
			aria-expanded={dropdownVisible}
			aria-controls={listboxId}
			onclick={toggleDropdown}
			tabindex="-1"
		>
			<svg
				viewBox="0 0 20 20"
				width="12"
				height="12"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d={dropdownVisible ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} />
			</svg>
		</button>
	</div>

	{#if dropdownVisible}
		<div
			id={listboxId}
			class="absolute z-50 left-0 right-0 mt-1 top-full bg-base-100 border border-base-300 rounded-md shadow-xl max-h-60 overflow-y-auto"
			role="listbox"
			aria-label={`${packageName} versions`}
		>
			{#if loading}
				<div class="p-2 text-center text-sm">Loading...</div>
			{:else}
				{#each versions as version, versionIndex}
					<button
						id={`${listboxId}-option-${versionIndex}`}
						class="w-full px-3 py-2 text-left cursor-pointer text-sm transition-colors"
						class:bg-base-200={selectedIndex === versionIndex}
						class:font-medium={selectedIndex === versionIndex}
						role="option"
						aria-selected={selectedIndex === versionIndex}
						onclick={() => selectVersion(version)}
						onmouseenter={() => {
							selectedIndex = versionIndex;
						}}
					>
						{version}
					</button>
				{/each}
				{#if versions.length === 0}
					<div class="p-2 text-center text-sm">No versions found</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
