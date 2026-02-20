<script lang="ts">
	
	import type { AssessmentEntity } from '@pie-players/pie-players-shared';
	import ToolColorScheme from '@pie-players/pie-tool-color-scheme';
	import ToolTextToSpeech from '@pie-players/pie-tool-text-to-speech';
	import { onMount } from 'svelte';
import type { AssessmentPlayer } from '../../player/AssessmentPlayer.js';

	let {
		player,
		assessment,
		currentQuestion,
		totalQuestions,
		userName
	}: {
		player: AssessmentPlayer;
		assessment: AssessmentEntity;
		currentQuestion: number;
		totalQuestions: number;
		userName?: string;
	} = $props();

	let isFullscreen = $state(false);
	const toolCoordinator = $derived(player.getToolCoordinator());
	
	// Accommodation tool visibility
	let showTTS = $state(false);
	let showColorScheme = $state(false);
	let flagged = $state(false);

	function updateAccommodationVisibility() {
		showTTS = toolCoordinator.isToolVisible('tts-accommodation');
		showColorScheme = toolCoordinator.isToolVisible('colorScheme');
	}

	onMount(() => {
		const unsubscribe = toolCoordinator.subscribe(() => {
			updateAccommodationVisibility();
		});
		updateAccommodationVisibility();
		return unsubscribe;
	});

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().then(() => {
				isFullscreen = true;
			});
		} else {
			document.exitFullscreen().then(() => {
				isFullscreen = false;
			});
		}
	}

	function handleAction(action: string) {
		// Placeholder: host products can intercept by listening to toolkit events,
		// or swap this component with their own header.
		console.log('[AssessmentHeader] action:', action);
	}
</script>

<header class="assessment-header">
	<!-- Left: Assessment Title -->
	<div class="header-left">
		<h1 class="assessment-title">{assessment?.name || 'Assessment'}</h1>
		<span class="question-count">{totalQuestions} Questions</span>
	</div>

	<!-- Center: Assessment-level actions -->
	<div class="header-center">
		<button class="action-button" onclick={() => handleAction('overall-instructions')}>
			Overall Instructions
		</button>
		<button class="action-button" onclick={() => handleAction('resources')}>
			Resources
		</button>
		<button class="action-button" onclick={() => handleAction('review-summary')}>
			Review Summary
		</button>
		<button class="action-button" onclick={() => handleAction('finish-later')}>
			Finish Later
		</button>
		<button
			class="action-button flag"
			class:active={flagged}
			onclick={() => (flagged = !flagged)}
			aria-pressed={flagged}
		>
			Flag Question
		</button>
	</div>

	<!-- Right: User Info and Accommodations -->
	<div class="header-right">
		<span class="user-name">{userName || 'Student Name'}</span>
		<div class="accommodations">
			<!-- Audio (TTS) -->
			<div class="accommodation-item">
				<button
					class="accommodation-button"
					class:active={showTTS}
					onclick={() => {
						toolCoordinator.toggleTool('tts-accommodation');
						updateAccommodationVisibility();
					}}
					aria-label="Toggle audio/text-to-speech"
				>
					Audio
				</button>
			</div>

			<!-- Contrast -->
			<div class="accommodation-item">
				<button
					class="accommodation-button"
					class:active={showColorScheme}
					onclick={() => {
						toolCoordinator.toggleTool('colorScheme');
						updateAccommodationVisibility();
					}}
					aria-label="Toggle color contrast"
				>
					Contrast
				</button>
			</div>

			<!-- Fullscreen -->
			<div class="accommodation-item">
				<button
					class="accommodation-button"
					onclick={toggleFullscreen}
					aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
				>
					Fullscreen
				</button>
			</div>
		</div>
	</div>
	</header>

	<!-- Render tools outside header (floating modals) -->
	<ToolTextToSpeech visible={showTTS} toolId="tts-accommodation" coordinator={toolCoordinator} ttsService={player.getTTSService()} />
	<ToolColorScheme visible={showColorScheme} toolId="colorScheme" coordinator={toolCoordinator} />

<style>
	.assessment-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background-color: var(--pie-background, #ffffff);
		border-bottom: 1px solid var(--pie-border, #e0e0e0);
		min-height: 56px;
		gap: 1rem;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 200px;
	}

	.header-center {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		justify-content: center;
		min-width: 0;
	}

	.action-button {
		padding: 0.5rem 0.75rem;
		background-color: transparent;
		border: 1px solid var(--pie-border, #e0e0e0);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--pie-text, #000);
		white-space: nowrap;
	}

	.action-button:hover {
		background-color: var(--pie-secondary-background, #f5f5f5);
	}

	.action-button.flag.active {
		background-color: var(--pie-primary, #3f51b5);
		color: #fff;
		border-color: var(--pie-primary, #3f51b5);
	}

	.assessment-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.question-count {
		font-size: 0.875rem;
		color: var(--pie-text-secondary, #666);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 300px;
		justify-content: flex-end;
	}

	.user-name {
		font-size: 0.875rem;
		color: var(--pie-text, #000);
		white-space: nowrap;
	}

	.accommodations {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.accommodation-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.accommodation-button {
		padding: 0.5rem;
		background-color: transparent;
		border: 1px solid var(--pie-border, #e0e0e0);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--pie-text, #000);
	}

	.accommodation-button:hover {
		background-color: var(--pie-secondary-background, #f5f5f5);
	}
</style>

