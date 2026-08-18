<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import '@pie-players/pie-item-player';
	import { makeUniqueTags } from '@pie-players/pie-players-shared/pie';
	import { config as configStore, updateConfig } from '$lib/stores/demo-state';
	import { demoHeadingName } from '$lib/utils/demo-heading-name';

	class AuthoringFixtureElement extends HTMLElement {
		private _model: any = null;

		set model(value: any) {
			this._model = value;
			this.render();
		}

		get model() {
			return this._model;
		}

		set session(_value: any) {
			this.render();
		}

		connectedCallback() {
			this.render();
		}

		private render() {
			this.innerHTML = `<div data-testid="delivery-fixture">Delivery: ${
				this._model?.prompt ?? ''
			}</div>`;
		}
	}

	class AuthoringFixtureConfigElement extends HTMLElement {
		private _model: any = null;
		private _configuration: any = {};

		set model(value: any) {
			this._model = value;
			this.render();
		}

		get model() {
			return this._model;
		}

		set configuration(value: any) {
			this._configuration = value;
			this.render();
		}

		get configuration() {
			return this._configuration;
		}

		connectedCallback() {
			this.render();
		}

		private render() {
			this.innerHTML = `
				<section data-testid="authoring-fixture">
					<p data-testid="authoring-model-id">${this._model?.id ?? ''}</p>
					<pre data-testid="authoring-config-value">${JSON.stringify(this._configuration)}</pre>
				</section>
			`;
		}
	}

	let { data } = $props();

	const demoHeading = $derived(demoHeadingName(data.demo?.name));

	let playerEl: any = $state(null);
	let lastConfig: any = null;
	let lastPlayerSetupSignature: string | null = null;
	let selectedLoaderStrategy = $state<'iife' | 'esm' | 'preloaded'>('iife');
	let authoringContractMode = $state(false);
	let missingAuthoringBackend = $state(false);
	let validationResult = $state('');
	let eventLog = $state<Array<{ type: string; detail: unknown }>>([]);
	let mediaCalls = $state<Array<{ type: string; src?: string }>>([]);

	$effect(() => {
		authoringContractMode =
			data.demo?.id === 'authoring-contract-fixture' ||
			$page.url.searchParams.get('authoring-contract') === '1';
		selectedLoaderStrategy = authoringContractMode
			? 'preloaded'
			: $page.url.searchParams.get('player') === 'esm'
				? 'esm'
				: 'iife';
		missingAuthoringBackend = $page.url.searchParams.get('missingBackend') === '1';
	});

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

	const authoringContractMediaBackend = {
		onInsertImage(handler: any) {
			mediaCalls = [...mediaCalls, { type: 'insert-image' }];
			handler?.done?.(undefined, '/fixture/image.png');
		},
		onDeleteImage(src: string, done: (err?: Error) => void) {
			mediaCalls = [...mediaCalls, { type: 'delete-image', src }];
			done();
		},
		onInsertSound(handler: any) {
			mediaCalls = [...mediaCalls, { type: 'insert-sound' }];
			handler?.done?.(undefined, '/fixture/sound.wav');
		},
		onDeleteSound(src: string, done: (err?: Error) => void) {
			mediaCalls = [...mediaCalls, { type: 'delete-sound', src }];
			done();
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
		const setupSignature = JSON.stringify({
			config: currentConfig,
			authoringContractMode,
			missingAuthoringBackend,
		});

		if (playerEl && currentConfig) {
			if (currentConfig !== lastConfig || setupSignature !== lastPlayerSetupSignature) {
				untrack(() => {
					if (authoringContractMode) {
						defineAuthoringContractFixture(currentConfig);
					}
					playerEl.config = currentConfig;
					playerEl.session = { id: 'preview', data: [] };
					playerEl.env = { mode: 'author', role: 'instructor' };
					playerEl.configuration = currentConfig.configuration ?? {};
					playerEl.authoringBackend = 'required';
					playerEl.loaderOptions = {
						bundleHost: 'https://proxy.pie-api.com/bundles/',
						runtimeSupportCheck: 'on'
					};
					if (!missingAuthoringBackend) {
						const mediaBackend = authoringContractMode ? authoringContractMediaBackend : demoMediaBackend;
						playerEl.onInsertImage = mediaBackend.onInsertImage;
						playerEl.onDeleteImage = mediaBackend.onDeleteImage;
						playerEl.onInsertSound = mediaBackend.onInsertSound;
						playerEl.onDeleteSound = mediaBackend.onDeleteSound;
					} else {
						playerEl.onInsertImage = null;
						playerEl.onDeleteImage = null;
						playerEl.onInsertSound = null;
						playerEl.onDeleteSound = null;
					}
				});

				lastConfig = currentConfig;
				lastPlayerSetupSignature = setupSignature;
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

	function cloneForLog(value: unknown): unknown {
		try {
			return JSON.parse(JSON.stringify(value));
		} catch {
			return String(value);
		}
	}

	function recordAuthoringEvent(type: string, detail: unknown) {
		eventLog = [...eventLog, { type, detail: cloneForLog(detail) }];
	}

	function defineAuthoringContractFixture(currentConfig: any) {
		const versionedConfig = makeUniqueTags({ config: currentConfig }).config;
		const runtimeTag = Object.keys(versionedConfig?.elements ?? {})[0];
		const packageSpec = versionedConfig?.elements?.[runtimeTag];
		const modelId = versionedConfig?.models?.[0]?.id;
		if (!runtimeTag || !packageSpec || !modelId) return;
		const configTag = `${runtimeTag}-config`;

		if (!customElements.get(runtimeTag)) {
			customElements.define(runtimeTag, AuthoringFixtureElement);
		}
		if (!customElements.get(configTag)) {
			customElements.define(configTag, AuthoringFixtureConfigElement);
		}

		const registry = ((window as any).PIE_REGISTRY ??= {});
		registry[runtimeTag] = {
			package: packageSpec,
			status: 'loaded',
			tagName: runtimeTag,
			element: AuthoringFixtureElement,
			controller: {
				model: async (model: any) => model,
				outcome: async () => ({
					id: modelId,
					element: runtimeTag,
					score: 1,
				}),
			},
			bundleType: 'client-player.js',
		};
		registry[configTag] = {
			package: packageSpec,
			status: 'loaded',
			tagName: configTag,
			element: AuthoringFixtureConfigElement,
			controller: {
				validate: (model: any, config: any) => ({
					errors: config?.requirePrompt && model?.prompt ? [] : ['prompt is required'],
					authoringOnly: config?.authoringOnly,
				}),
			},
			bundleType: 'editor.js',
		};
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

	$effect(() => {
		if (!playerEl || !authoringContractMode) return;
		const eventTypes = ['model-loaded', 'model-updated', 'player-error'];
		const listeners = eventTypes.map((type) => {
			const listener = (event: Event) => recordAuthoringEvent(type, (event as CustomEvent).detail);
			playerEl.addEventListener(type, listener);
			return { type, listener };
		});
		return () => {
			for (const { type, listener } of listeners) {
				playerEl?.removeEventListener(type, listener);
			}
		};
	});

	async function runValidation() {
		const result = await playerEl?.validateModels?.();
		validationResult = JSON.stringify(result);
	}

</script>

<svelte:head>
	<title>{demoHeading} - Author</title>
</svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<pie-item-player
				bind:this={playerEl}
				strategy={selectedLoaderStrategy}
				mode="author"
			></pie-item-player>
			{#if authoringContractMode}
				<div class="mt-4 grid gap-3" data-testid="authoring-contract-harness">
					<button type="button" class="btn btn-primary" data-testid="run-validation" onclick={runValidation}>
						Run validation
					</button>
					<pre data-testid="validation-result">{validationResult}</pre>
					<pre data-testid="event-log">{JSON.stringify(eventLog)}</pre>
					<pre data-testid="media-call-log">{JSON.stringify(mediaCalls)}</pre>
				</div>
			{/if}
		</div>
	</div>
</div>
