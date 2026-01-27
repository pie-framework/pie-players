<script lang="ts">
	import "@pie-players/pie-assessment-player";
	import { page } from "$app/stores";
	import { getContext } from "svelte";
	import type { Writable } from "svelte/store";
	import type { ProfileConfig } from "../profile-templates";
	import {
		getElementTypeById,
		getDefaultExampleForType,
	} from "../element-type-mapping";
	import type {
		AssessmentEntity,
		ItemEntity,
	} from "@pie-players/pie-players-shared/types";
	import ProfileEditor from "../ProfileEditor.svelte";
	import DebugPanel from "../DebugPanel.svelte";

	const profileStore = getContext<Writable<ProfileConfig>>("profileStore");
	const eventLogStore = getContext<Writable<any[]>>("eventLogStore");
	const showProfileEditor =
		getContext<Writable<boolean>>("showProfileEditor");
	const showDebugPanel = getContext<Writable<boolean>>("showDebugPanel");

	// Get element type from URL
	$: elementTypeId = $page.params.elementType || '';
	$: elementType = getElementTypeById(elementTypeId);
	$: example = getDefaultExampleForType(elementTypeId);

	// Create assessment entity for single item
	$: assessment = createAssessment(elementTypeId, example);
	$: itemBank = createItemBank(example);

	function createAssessment(
		typeId: string,
		example: any,
	): AssessmentEntity | null {
		if (!example) return null;

		return {
			id: `preview-${typeId}`,
			name: `${elementType?.name || "Element"} Preview`,
			questions: [
				{
					id: "q1",
					itemVId: example.id,
				},
			],
		} as AssessmentEntity;
	}

	function createItemBank(example: any): Record<string, ItemEntity> {
		if (!example?.item?.config) return {};

		return {
			[example.id]: {
				id: example.id,
				config: example.item.config,
			} as unknown as ItemEntity,
		};
	}

	// Handle player events
	function handlePlayerEvent(event: CustomEvent) {
		const eventData = {
			type: event.type,
			timestamp: Date.now(),
			data: event.detail,
		};
		$eventLogStore = [...$eventLogStore, eventData];
	}

	let playerElement: HTMLElement | null = null;

	function setupPlayerEventListeners(node: HTMLElement) {
		playerElement = node;

		// Listen to common player events
		const eventTypes = [
			"player:session-changed",
			"nav:next-requested",
			"nav:previous-requested",
			"state:saved",
			"state:restored",
			"tool:opened",
			"tool:closed",
			"a11y:focus-changed",
		];

		const handlers: { [key: string]: EventListener } = {};

		eventTypes.forEach((eventType) => {
			handlers[eventType] = (e) => handlePlayerEvent(e as CustomEvent);
			node.addEventListener(eventType, handlers[eventType]);
		});

		return {
			destroy() {
				eventTypes.forEach((eventType) => {
					node.removeEventListener(eventType, handlers[eventType]);
				});
				playerElement = null;
			},
		};
	}
</script>

<svelte:head>
	<title>{elementType?.name || "Element"} Preview - Toolkit Preview</title>
</svelte:head>

{#if !elementType || !example}
	<div class="flex-1 flex items-center justify-center">
		<div class="text-center">
			<h2 class="text-2xl font-bold mb-2">Element Type Not Found</h2>
			<p class="text-base-content/70">
				The element type "{elementTypeId}" could not be found.
			</p>
			<a href="/toolkit-preview" class="btn btn-primary mt-4">
				Back to Overview
			</a>
		</div>
	</div>
{:else}
	<!-- Three-column layout -->
	<div class="flex-1 flex overflow-hidden">
		<!-- Profile Editor (Left) -->
		{#if $showProfileEditor}
			<ProfileEditor />
		{/if}

		<!-- Assessment Player (Center) -->
		<div class="flex-1 overflow-hidden bg-base-100">
			{#if assessment && Object.keys(itemBank).length > 0}
				<div class="h-full" use:setupPlayerEventListeners>
					<pie-assessment-player
						{assessment}
						{itemBank}
						mode="gather"
						class="block h-full"
					></pie-assessment-player>
				</div>
			{:else}
				<div class="flex items-center justify-center h-full">
					<div class="text-center">
						<p class="text-base-content/60">Loading item...</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Debug Panel (Right) -->
		{#if $showDebugPanel}
			<DebugPanel />
		{/if}
	</div>
{/if}
