<svelte:options
	customElement={{
		tag: "pie-tool-picture-dictionary",
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
		type PictureDictionaryLookupResponse,
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
		images: PictureDictionaryLookupResponse["images"];
	}>({
		open: false,
		loading: false,
		error: null,
		keyword: "",
		images: [],
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
				pictureDictionaryEndpoint: "/api/picture-dictionary",
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
			images: [],
		};

		try {
			const response = await client.lookupPictureDictionary(text, undefined, 10);
			dialogState = {
				open: true,
				loading: false,
				error: null,
				keyword: text,
				images: response.images || [],
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			dialogState = {
				open: true,
				loading: false,
				error: message,
				keyword: text,
				images: [],
			};
		}
	}

	function handleImageError(event: Event) {
		const target = event.currentTarget as HTMLImageElement | null;
		if (!target) {
			return;
		}
		target.src = "https://via.placeholder.com/200x200/cccccc/666666?text=Image+Not+Found";
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
		<div class="modal-box max-w-4xl">
			<form method="dialog">
				<button
					class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
					onclick={closeDialog}
				>
					✕
				</button>
			</form>

			<h3 class="font-bold text-lg mb-4">
				Picture Dictionary: <span class="text-primary">{dialogState.keyword}</span>
			</h3>

			{#if dialogState.loading}
				<div class="flex items-center gap-2">
					<span class="loading loading-spinner loading-sm"></span>
					<span>Searching for images...</span>
				</div>
			{:else if dialogState.error}
				<div class="alert alert-error">
					<span>Picture dictionary lookup failed: {dialogState.error}</span>
				</div>
			{:else if dialogState.images.length === 0}
				<div class="alert alert-info">
					<span>No images found for "{dialogState.keyword}".</span>
				</div>
			{:else}
				<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
					{#each dialogState.images as img, i}
						<div class="card bg-base-200 shadow-xl">
							<figure class="px-4 pt-4">
								<img
									src={img.image}
									alt="{dialogState.keyword} - Image {i + 1}"
									class="rounded-xl w-full h-48 object-cover"
									onerror={handleImageError}
								/>
							</figure>
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
