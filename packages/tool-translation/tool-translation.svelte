<svelte:options
	customElement={{
		tag: "pie-tool-translation",
		shadow: "none",
		props: {
			enabled: { type: "Boolean", attribute: "enabled" },
			requestText: { type: "String", attribute: "request-text" },
			requestNonce: { type: "Number", attribute: "request-nonce" },
			targetLanguage: { type: "String", attribute: "target-language" },
			annotationApiClient: { type: "Object" },
			defaultLanguage: { type: "String", attribute: "default-language" },
		},
	}}
/>

<script lang="ts">
	import {
		AnnotationToolbarAPIClient,
		type AnnotationToolbarConfig,
	} from "@pie-players/pie-assessment-toolkit";

	interface Props {
		enabled?: boolean;
		requestText?: string;
		requestNonce?: number;
		targetLanguage?: string;
		annotationApiClient?: AnnotationToolbarAPIClient | null;
		defaultLanguage?: string;
	}

	const isBrowser = typeof window !== "undefined";

	let {
		enabled = false,
		requestText = "",
		requestNonce = 0,
		targetLanguage = "es",
		annotationApiClient = null,
		defaultLanguage = "en-us",
	}: Props = $props();

	let dialogState = $state({
		open: false,
		loading: false,
		error: null as string | null,
		originalText: "",
		translatedText: "",
		sourceLanguage: "",
		targetLanguage: "",
	});

	let internalClient = $state<AnnotationToolbarAPIClient | null>(null);
	let lastHandledNonce = $state(0);

	function getApiClient() {
		if (annotationApiClient) {
			return annotationApiClient;
		}
		if (!isBrowser) {
			return null;
		}
		if (!internalClient) {
			const config: AnnotationToolbarConfig = {
				translationEndpoint: "/api/translation",
				defaultLanguage,
			};
			internalClient = new AnnotationToolbarAPIClient(config);
		}
		return internalClient;
	}

	function closeDialog() {
		dialogState = { ...dialogState, open: false };
	}

	async function translate(text: string) {
		if (!enabled || !text.trim()) {
			return;
		}
		const client = getApiClient();
		if (!client) {
			return;
		}

		dialogState = {
			open: true,
			loading: true,
			error: null,
			originalText: text,
			translatedText: "",
			sourceLanguage: defaultLanguage,
			targetLanguage,
		};

		try {
			const response = await client.translate(text, targetLanguage);
			dialogState = {
				open: true,
				loading: false,
				error: null,
				originalText: response.text,
				translatedText: response.translatedText,
				sourceLanguage: response.sourceLanguage,
				targetLanguage: response.targetLanguage,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			dialogState = {
				open: true,
				loading: false,
				error: message,
				originalText: text,
				translatedText: "",
				sourceLanguage: defaultLanguage,
				targetLanguage,
			};
		}
	}

	$effect(() => {
		if (!enabled || requestNonce <= 0 || requestNonce === lastHandledNonce) {
			return;
		}
		lastHandledNonce = requestNonce;
		void translate(requestText);
	});
</script>

{#if dialogState.open}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-2xl">
			<form method="dialog">
				<button
					class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
					onclick={closeDialog}
				>
					✕
				</button>
			</form>
			<h3 class="font-bold text-lg mb-4">Translation</h3>

			{#if dialogState.loading}
				<div class="flex items-center gap-2">
					<span class="loading loading-spinner loading-sm"></span>
					<span>Translating selection...</span>
				</div>
			{:else if dialogState.error}
				<div class="alert alert-error">
					<span>Translation failed: {dialogState.error}</span>
				</div>
			{:else}
				<div class="space-y-4">
					<div class="card bg-base-200">
						<div class="card-body p-4">
							<div class="badge badge-outline mb-2">{dialogState.sourceLanguage.toUpperCase()}</div>
							<p class="text-base">{dialogState.originalText}</p>
						</div>
					</div>

					<div class="card bg-primary/10 border-2 border-primary/20">
						<div class="card-body p-4">
							<div class="badge badge-primary mb-2">{dialogState.targetLanguage.toUpperCase()}</div>
							<p class="text-base font-medium">{dialogState.translatedText}</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="modal-action">
				<button class="btn btn-primary" onclick={closeDialog}>Close</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={closeDialog}>close</button>
		</form>
	</dialog>
{/if}
