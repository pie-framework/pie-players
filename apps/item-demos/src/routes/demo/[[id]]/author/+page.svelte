<script lang="ts">
	import { untrack } from 'svelte';
	import '@pie-players/pie-item-player';
	import { config as configStore, updateConfig } from '$lib/stores/demo-state';

	let { data } = $props();

	let playerEl: any = $state(null);
	let lastConfig: any = null;

	async function callAuthoringMediaJsonService<T>(
		path: string,
		payload: Record<string, unknown>
	): Promise<T> {
		const response = await fetch(`/api/authoring-media/${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(
				`Authoring media service ${path} failed (${response.status}): ${text || response.statusText}`
			);
		}
		return (await response.json()) as T;
	}

	async function uploadAuthoringMedia<T>(
		path: string,
		file: File,
		extra: Record<string, string> = {}
	): Promise<T> {
		const formData = new FormData();
		formData.set('file', file);
		for (const [key, value] of Object.entries(extra)) {
			formData.set(key, value);
		}
		const response = await fetch(`/api/authoring-media/${path}`, {
			method: 'POST',
			body: formData,
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(
				`Authoring media upload ${path} failed (${response.status}): ${text || response.statusText}`
			);
		}
		return (await response.json()) as T;
	}

	const demoMediaBackend = {
		onInsertImage(handler: any) {
			console.log('[item-demos] demo backend insert image request', {
				isPasted: handler?.isPasted ?? false,
			});
			try {
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = 'image/*';
				input.onchange = async () => {
					const file = input.files?.[0];
					console.log('[item-demos] selected image file', file?.name || '(none)');
					if (!file) {
						handler?.done?.(new Error('No image file selected.'));
						return;
					}
					try {
						handler?.fileChosen?.(file);
						const result = await uploadAuthoringMedia<{ src: string }>('insert-image', file, {
							isPasted: String(handler?.isPasted ?? false),
						});
						handler?.done?.(undefined, result.src);
					} catch (error) {
						console.error('[item-demos] demo backend image insert failed', error);
						handler?.done?.(error instanceof Error ? error : new Error(String(error)));
					}
				};
				input.click();
			} catch (error) {
				console.error('[item-demos] demo backend image insert failed', error);
				handler?.done?.(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async onDeleteImage(src: string, done: (err?: Error) => void) {
			console.log('[item-demos] demo backend delete image request', { src });
			try {
				await callAuthoringMediaJsonService('delete-image', { src });
				done();
			} catch (error) {
				console.error('[item-demos] demo backend image delete failed', error);
				done(error instanceof Error ? error : new Error(String(error)));
			}
		},
		onInsertSound(handler: any) {
			console.log('[item-demos] demo backend insert sound request');
			try {
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = 'audio/*';
				input.onchange = async () => {
					const file = input.files?.[0];
					console.log('[item-demos] selected sound file', file?.name || '(none)');
					if (!file) {
						handler?.done?.(new Error('No sound file selected.'));
						return;
					}
					try {
						handler?.fileChosen?.(file);
						const result = await uploadAuthoringMedia<{ src: string }>('insert-sound', file);
						handler?.done?.(undefined, result.src);
					} catch (error) {
						console.error('[item-demos] demo backend sound insert failed', error);
						handler?.done?.(error instanceof Error ? error : new Error(String(error)));
					}
				};
				input.click();
			} catch (error) {
				console.error('[item-demos] demo backend sound insert failed', error);
				handler?.done?.(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async onDeleteSound(src: string, done: (err?: Error) => void) {
			console.log('[item-demos] demo backend delete sound request', { src });
			try {
				await callAuthoringMediaJsonService('delete-sound', { src });
				done();
			} catch (error) {
				console.error('[item-demos] demo backend sound delete failed', error);
				done(error instanceof Error ? error : new Error(String(error)));
			}
		},
	};

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
					playerEl.authoringBackend = 'required';
					playerEl.loaderOptions = { bundleHost: 'https://proxy.pie-api.com/bundles/' };
					playerEl.onInsertImage = demoMediaBackend.onInsertImage;
					playerEl.onDeleteImage = demoMediaBackend.onDeleteImage;
					playerEl.onInsertSound = demoMediaBackend.onInsertSound;
					playerEl.onDeleteSound = demoMediaBackend.onDeleteSound;
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
