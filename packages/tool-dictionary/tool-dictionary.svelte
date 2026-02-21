<svelte:options
	customElement={{
		tag: "pie-tool-dictionary",
		shadow: "none",
		props: {
			enabled: { type: "Boolean", attribute: "enabled" },
			requestText: { type: "String", attribute: "request-text" },
			requestNonce: { type: "Number", attribute: "request-nonce" },
			annotationApiClient: { type: "Object" },
			defaultLanguage: { type: "String", attribute: "default-language" },
		},
	}}
/>

<script lang="ts">
	import {
		AnnotationToolbarAPIClient,
		type AnnotationToolbarConfig,
		type DictionaryLookupResponse,
	} from "@pie-players/pie-assessment-toolkit";

	interface Props {
		enabled?: boolean;
		requestText?: string;
		requestNonce?: number;
		annotationApiClient?: AnnotationToolbarAPIClient | null;
		defaultLanguage?: string;
	}

	const isBrowser = typeof window !== "undefined";

	let {
		enabled = false,
		requestText = "",
		requestNonce = 0,
		annotationApiClient = null,
		defaultLanguage = "en-us",
	}: Props = $props();

	let dialogState = $state<{
		open: boolean;
		loading: boolean;
		error: string | null;
		keyword: string;
		definitions: DictionaryLookupResponse["definitions"];
	}>({
		open: false,
		loading: false,
		error: null,
		keyword: "",
		definitions: [],
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
				dictionaryEndpoint: "/api/dictionary",
				defaultLanguage,
			};
			internalClient = new AnnotationToolbarAPIClient(config);
		}
		return internalClient;
	}

	function closeDialog() {
		dialogState = { ...dialogState, open: false };
	}

	async function lookup(text: string) {
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
			keyword: text,
			definitions: [],
		};

		try {
			const response = await client.lookupDictionary(text);
			dialogState = {
				open: true,
				loading: false,
				error: null,
				keyword: response.keyword || text,
				definitions: response.definitions || [],
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			dialogState = {
				open: true,
				loading: false,
				error: message,
				keyword: text,
				definitions: [],
			};
		}
	}

	$effect(() => {
		if (!enabled || requestNonce <= 0 || requestNonce === lastHandledNonce) {
			return;
		}
		lastHandledNonce = requestNonce;
		void lookup(requestText);
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
			<h3 class="font-bold text-lg mb-4">
				Dictionary: <span class="text-primary">{dialogState.keyword}</span>
			</h3>

			{#if dialogState.loading}
				<div class="flex items-center gap-2">
					<span class="loading loading-spinner loading-sm"></span>
					<span>Looking up word...</span>
				</div>
			{:else if dialogState.error}
				<div class="alert alert-error">
					<span>Dictionary lookup failed: {dialogState.error}</span>
				</div>
			{:else if dialogState.definitions.length === 0}
				<div class="alert alert-info">
					<span>No definitions found for "{dialogState.keyword}".</span>
				</div>
			{:else}
				<div class="space-y-4">
					{#each dialogState.definitions as definition}
						<div class="card bg-base-200">
							<div class="card-body p-4">
								<div class="badge badge-primary badge-sm mb-2">{definition.partOfSpeech}</div>
								<p class="text-base">{definition.definition}</p>
								{#if definition.example}
									<p class="text-sm text-base-content/70 italic mt-2">
										Example: "{definition.example}"
									</p>
								{/if}
							</div>
						</div>
					{/each}
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
