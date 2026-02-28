<script lang="ts">
	import { untrack } from 'svelte';
	import '@pie-players/pie-item-player';
	import { config as configStore, updateConfig } from '$lib/stores/demo-state';

	let { data } = $props();

	let playerEl: any = $state(null);
	let lastConfig: any = null;

	function safeClone<T>(value: T): T {
		try {
			if (typeof structuredClone === 'function') {
				return structuredClone(value);
			}
		} catch {}
		try {
			return JSON.parse(JSON.stringify(value));
		} catch {
			return { ...(value as any) };
		}
	}

	// Set properties imperatively when config changes
	$effect(() => {
		const currentConfig = $configStore;

		if (playerEl && currentConfig) {
			if (currentConfig !== lastConfig) {
				untrack(() => {
					playerEl.config = currentConfig;
					playerEl.session = { id: 'preview', data: [] };
					playerEl.env = { mode: 'author', role: 'instructor' };
					playerEl.loaderOptions = { bundleHost: 'https://proxy.pie-api.com/bundles/' };
				});

				lastConfig = currentConfig;
			}
		}
	});

	function applySharedConfigFromAuthor(nextConfig: any) {
		// Prevent echoing author-originated config updates back into the same player,
		// which can reset focused author controls while typing.
		const cloned = safeClone(nextConfig);
		lastConfig = cloned;
		updateConfig(cloned);
	}

	function normalizeElementName(name: unknown): string {
		if (typeof name !== 'string') return '';
		return name.replace(/--version-.+$/, '');
	}

	function applyModelUpdateFromEvent(event: Event): boolean {
		const detail = (event as CustomEvent)?.detail;
		const update = detail?.update;
		if (!update || !$configStore || !Array.isArray($configStore.models)) return false;

		const normalizedUpdateElement = normalizeElementName(update.element);
		let didUpdate = false;
		const nextModels = $configStore.models.map((m: any) => {
			const sameId = m.id && update.id && m.id === update.id;
			const sameElement =
				normalizeElementName(m.element) &&
				normalizedUpdateElement &&
				normalizeElementName(m.element) === normalizedUpdateElement;

			if (sameId || sameElement) {
				didUpdate = true;
				return { ...m, ...update, element: normalizeElementName(update.element) || m.element };
			}
			return m;
		});

		if (!didUpdate) return false;
		applySharedConfigFromAuthor({ ...$configStore, models: nextModels });
		return true;
	}

	$effect(() => {
		if (!playerEl) return;
		const syncNow = (event: Event) => {
			applyModelUpdateFromEvent(event);
		};
		playerEl.addEventListener('model-updated', syncNow as EventListener);
		return () => {
			playerEl?.removeEventListener('model-updated', syncNow as EventListener);
		};
	});

</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - Author</title>
</svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<pie-item-player
				bind:this={playerEl}
				strategy="iife"
				mode="author"
			></pie-item-player>
		</div>
	</div>
</div>
