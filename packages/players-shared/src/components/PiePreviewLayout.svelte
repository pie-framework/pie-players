<!--
  PiePreviewLayout - Layout container for authoring with preview

  Combines PiePreviewToggle with conditional rendering of PieItemPlayer instances.
  Switches between authoring mode (configure elements) and preview mode (regular player elements).
-->
<script lang="ts">
	import { tick } from 'svelte';
	import type { LoaderConfig } from '../loader-config.js';
	import { DEFAULT_LOADER_CONFIG } from '../loader-config.js';
	import { createPieLogger, isGlobalDebugEnabled } from '../pie/logger.js';
	import { BundleType } from '../pie/types.js';
	import type { ConfigEntity, Env, ImageHandler, SoundHandler } from '../types/index.js';
	import PieItemPlayer from './PieItemPlayer.svelte';
	import PiePreviewToggle from './PiePreviewToggle.svelte';

	const logger = createPieLogger('pie-preview-layout', () => isGlobalDebugEnabled());

	// Props using Svelte 5 runes
	let {
		mode = $bindable('author' as 'author' | 'preview'),
		itemConfig,
		passageConfig = null,
		configuration = {} as Record<string, any>,
		env = { mode: 'gather', role: 'student' } as Env,
		session = [] as any[],
		addCorrectResponse = false,
		customClassName = '',
		passageContainerClass = '',
		containerClass = '',
		// Legacy: authoring uses editor.js, preview uses player/client-player.
		// For backwards-compat, keep `bundleType` but allow per-mode overrides.
		bundleType = BundleType.player,
		bundleTypeAuthor = BundleType.editor,
		bundleTypePreview = BundleType.player,
		loaderConfig = DEFAULT_LOADER_CONFIG as LoaderConfig,
		// Asset handler callbacks
		onInsertImage,
		onDeleteImage,
		onInsertSound,
		onDeleteSound,
		// Event callbacks
		onLoadComplete,
		onPlayerError,
		onSessionChanged,
		onModelUpdated
	}: {
		mode?: 'author' | 'preview';
		itemConfig: ConfigEntity;
		passageConfig?: ConfigEntity | null;
		configuration?: Record<string, any>;
		env?: Env;
		session?: any[];
		addCorrectResponse?: boolean;
		customClassName?: string;
		passageContainerClass?: string;
		containerClass?: string;
		bundleType?: BundleType;
		bundleTypeAuthor?: BundleType;
		bundleTypePreview?: BundleType;
		loaderConfig?: LoaderConfig;
		// Asset handlers
		onInsertImage?: (handler: ImageHandler) => void;
		onDeleteImage?: (src: string, done: (err?: Error) => void) => void;
		onInsertSound?: (handler: SoundHandler) => void;
		onDeleteSound?: (src: string, done: (err?: Error) => void) => void;
		// Event callbacks
		onLoadComplete?: (detail?: any) => void;
		onPlayerError?: (detail?: any) => void;
		onSessionChanged?: (detail?: any) => void;
		onModelUpdated?: (detail?: any) => void;
	} = $props();

	// Track current mode state
	let currentMode = $state(mode);

	// Handle mode changes from toggle
	function handleModeChange(newMode: 'author' | 'preview') {
		logger.debug('[PiePreviewLayout] Mode changed:', newMode);
		currentMode = newMode;
		mode = newMode; // Update parent via bindable
	}

	// Derive player mode from current mode
	const playerMode = $derived.by(() => {
		return currentMode === 'preview' ? 'view' : 'author';
	});

	// Derive bundle type from current mode (author vs preview).
	// Prefer per-mode overrides; fall back to `bundleType` for older callers.
	const effectiveBundleType = $derived.by(() => {
		if (currentMode === 'preview') return bundleTypePreview ?? bundleType;
		return bundleTypeAuthor ?? BundleType.editor;
	});

	// Key to force re-mount when switching modes
	const playerKey = $derived.by(() => {
		return `${currentMode}-${Date.now()}`;
	});
</script>

<div class="pie-preview-layout">
	<PiePreviewToggle mode={currentMode} onModeChange={handleModeChange} />

	<div class="preview-content" role="tabpanel" id="{currentMode}-panel" aria-labelledby="{currentMode}-tab">
		{#key playerKey}
			<PieItemPlayer
				{itemConfig}
				{passageConfig}
				{env}
				{session}
				{addCorrectResponse}
				{customClassName}
				{passageContainerClass}
				{containerClass}
				bundleType={effectiveBundleType}
				{loaderConfig}
				mode={playerMode}
				{configuration}
				{onInsertImage}
				{onDeleteImage}
				{onInsertSound}
				{onDeleteSound}
				{onLoadComplete}
				{onPlayerError}
				{onSessionChanged}
				{onModelUpdated}
			/>
		{/key}
	</div>
</div>

<style>
	.pie-preview-layout {
		display: block;
		width: 100%;
	}

	.preview-content {
		display: block;
		width: 100%;
		padding: 1rem 0;
	}
</style>
