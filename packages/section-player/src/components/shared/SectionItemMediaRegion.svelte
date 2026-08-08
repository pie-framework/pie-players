<script lang="ts">
	/**
	 * Renders one resolved accessibility-catalog media card.
	 *
	 * Named for the slot, not its first tenant: what fills it is a resolved
	 * catalog card, and audio description is the same "docked alternate media,
	 * gated by PNP" shape. Signing is simply the first occupant.
	 *
	 * A minimal `<video>` wrapper on purpose — the clips are seconds long, so
	 * sharing a player with a section-scale stimulus element buys nothing.
	 */
	import type { TtsServiceApi } from "@pie-players/pie-assessment-toolkit";
	import {
		applyMediaFragment,
		describeSignLanguage,
	} from "@pie-players/pie-assessment-toolkit";
	import type { MediaSource } from "@pie-players/pie-players-shared/types";
	import type { ResolvedSignLanguageAlternate } from "./section-item-media.js";

	let {
		media,
		regionId = "",
		ttsService = null as TtsServiceApi | null,
	} = $props<{
		media: ResolvedSignLanguageAlternate;
		regionId?: string;
		ttsService?: TtsServiceApi | null;
	}>();

	let videoElement = $state<HTMLVideoElement | null>(null);

	const languageName = $derived(describeSignLanguage(media.signLang));
	// The label names the language rather than saying "video": "American Sign
	// Language" tells a learner what this is; "video" does not.
	const accessibleLabel = $derived(media.label || `${languageName} translation`);
	const sources = $derived(
		media.sources.map((source: MediaSource) => ({
			...source,
			src: applyMediaFragment(source.src, media.fragment),
		})),
	);

	function pauseSigning(): void {
		if (videoElement && !videoElement.paused) videoElement.pause();
	}

	/**
	 * Signing playback and TTS must not run at once, and the action the learner
	 * just took wins: starting one pauses the other.
	 */
	function onPlay(): void {
		if (!ttsService) return;
		try {
			if (ttsService.isPlaying()) ttsService.pause();
		} catch {
			// A torn-down or uninitialized TTS service must not break playback.
		}
	}

	function onLoadedMetadata(): void {
		const start = media.fragment?.startSeconds;
		if (!videoElement || start === undefined) return;
		// The `#t=` hint on the source URL is honoured inconsistently, so seek
		// explicitly. Only forward: never fight a learner who already scrubbed.
		if (videoElement.currentTime < start) videoElement.currentTime = start;
	}

	function onTimeUpdate(): void {
		const end = media.fragment?.endSeconds;
		if (!videoElement || end === undefined) return;
		// Browsers vary on enforcing a fragment's end bound; stopping here keeps a
		// time-sliced recording from running into the next node's translation.
		if (videoElement.currentTime >= end) videoElement.pause();
	}

	$effect(() => {
		if (!ttsService || typeof ttsService.onStateChange !== "function") return;
		const listenerId = `pie-section-player-item-media-${regionId || "region"}`;
		const onTtsState = (state: unknown) => {
			if (state === "playing" || state === "loading") pauseSigning();
		};
		ttsService.onStateChange(listenerId, onTtsState as never);
		return () => {
			try {
				ttsService.offStateChange(listenerId, onTtsState as never);
			} catch {
				// Detach errors are non-fatal; the service may already be gone.
			}
		};
	});
</script>

<figure
	class="pie-section-player-item-media"
	data-pie-sign-language={media.signLang || undefined}
	data-pie-catalog-id={media.catalogId || undefined}
>
	<!-- Muted by default: the signing recording's own audio channel carries
	     nothing a signing learner needs, and unmuting stays one control away. -->
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={videoElement}
		class="pie-section-player-item-media__video"
		aria-label={accessibleLabel}
		poster={media.poster || undefined}
		controls
		muted
		playsinline
		preload="metadata"
		onplay={onPlay}
		onloadedmetadata={onLoadedMetadata}
		ontimeupdate={onTimeUpdate}
	>
		{#each sources as source (source.src)}
			<source src={source.src} type={source.type || undefined} />
		{/each}
	</video>
	<figcaption class="pie-section-player-item-media__caption">{languageName}</figcaption>
</figure>

<style>
	.pie-section-player-item-media {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		min-width: 0;
	}

	.pie-section-player-item-media__video {
		width: 100%;
		/* Signing needs height for hands and face, so the recording's own frame
		   shape drives the box (portrait clips stay tall) with a target for the
		   common case and a floor so a narrow column cannot crush it. A flat
		   width percentage alone either wastes space or makes signing
		   unreadable. */
		aspect-ratio: var(--pie-section-player-item-media-aspect-ratio, 3 / 4);
		min-height: var(--pie-section-player-item-media-min-height, 220px);
		max-height: var(--pie-section-player-item-media-max-height, 60vh);
		object-fit: contain;
		border-radius: var(--pie-section-player-card-radius, 8px);
		background: var(--pie-blue-grey-900, #111827);
	}

	.pie-section-player-item-media__caption {
		font-size: 0.8125rem;
		color: var(--pie-text-light, var(--pie-text, #111827));
	}
</style>
