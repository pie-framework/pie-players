<svelte:options
	customElement={{
		tag: "pie-tool-sign-language",
		shadow: "open",
		props: {
			media: { type: "Object", reflect: false },
			ttsService: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts" module>
	// One page can hold several item cards, each with its own region, so the TTS
	// listener id has to be unique per instance. Module scope, not instance scope.
	let instanceCounter = 0;
</script>

<script lang="ts">
	/**
	 * Renders one resolved sign-language catalog card in a host-provided region.
	 *
	 * A minimal `<video>` wrapper on purpose — the clips are seconds long, so
	 * sharing a player with a section-scale stimulus element buys nothing.
	 *
	 * The host mounts this through the registration's `renderSurface` and hands it
	 * a resolved card; it does no resolution of its own, so a card that reaches
	 * here is already known to be playable and already known to be one the learner
	 * is eligible for.
	 */
	import {
		applyMediaFragment,
		enforceMediaFragment,
	} from "@pie-players/pie-assessment-toolkit";
	import type { TtsServiceApi } from "@pie-players/pie-assessment-toolkit";
	import type { MediaSource } from "@pie-players/pie-players-shared/types";
	import { describeSignLanguage } from "./sign-language-cards.js";
	import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
	import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";
	import type { ResolvedSignLanguageAlternate } from "./sign-language-content.js";

	let {
		media = null as ResolvedSignLanguageAlternate | null,
		ttsService = null as TtsServiceApi | null,
		i18n = undefined as I18nProvider | undefined,
	} = $props<{
		media?: ResolvedSignLanguageAlternate | null;
		ttsService?: TtsServiceApi | null;
		/**
		 * Interface-locale provider, supplied by the host surface. Absent, the
		 * English-only default names the language rather than leaking a key.
		 */
		i18n?: I18nProvider;
	}>();

	let videoElement = $state<HTMLVideoElement | null>(null);
	const listenerId = `pie-tool-sign-language-${(instanceCounter += 1)}`;

	const languageName = $derived(describeSignLanguage(media?.signLang, i18n));
	// The label names the language rather than saying "video": "American Sign
	// Language" tells a learner what this is; "video" does not.
	const accessibleLabel = $derived(
		media?.label ||
			resolveInterfaceI18n({ i18n }).t('tools.signLanguage.regionA11y', { language: languageName }),
	);
	const sources = $derived(
		(media?.sources ?? []).map((source: MediaSource) => ({
			...source,
			src: applyMediaFragment(source.src, media?.fragment),
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

	// Hold playback to the authored slice. Stopping at the end keeps a
	// time-sliced recording from running into the next node's translation; the
	// shared helper owns the seek-forward-once and stop-at-end pair that recorded
	// read-aloud audio needs identically.
	$effect(() => {
		if (!videoElement) return;
		return enforceMediaFragment(videoElement, media?.fragment, pauseSigning);
	});

	$effect(() => {
		if (!ttsService || typeof ttsService.onStateChange !== "function") return;
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

{#if media && sources.length > 0}
	<figure
		class="pie-tool-sign-language"
		data-pie-sign-language={media.signLang || undefined}
		data-pie-catalog-id={media.catalogId || undefined}
	>
		<!-- Muted by default: the signing recording's own audio channel carries
		     nothing a signing learner needs, and unmuting stays one control away. -->
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			bind:this={videoElement}
			class="pie-tool-sign-language__video"
			aria-label={accessibleLabel}
			poster={media.poster || undefined}
			controls
			muted
			playsinline
			preload="metadata"
			onplay={onPlay}
		>
			{#each sources as source (source.src)}
				<source src={source.src} type={source.type || undefined} />
			{/each}
		</video>
		<figcaption class="pie-tool-sign-language__caption">{languageName}</figcaption>
	</figure>
{/if}

<style>
	:host {
		display: block;
		min-width: 0;
	}

	.pie-tool-sign-language {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		min-width: 0;
	}

	.pie-tool-sign-language__video {
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

	.pie-tool-sign-language__caption {
		font-size: 0.8125rem;
		color: var(--pie-text-light, var(--pie-text, #111827));
	}
</style>
