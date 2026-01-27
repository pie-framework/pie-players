<script lang="ts">
	import { getContext } from "svelte";
	import type { Writable } from "svelte/store";
	import type { ProfileConfig, ProfileTemplate } from "./profile-templates";
	import { getTemplateById, PROFILE_TEMPLATES } from "./profile-templates";

	const profileStore = getContext<Writable<ProfileConfig>>("profileStore");

	let selectedTemplate = "default";
	let editMode: "visual" | "json" = "visual";
	let jsonText = "";
	let jsonError: string | null = null;

	// Sync JSON text when switching to JSON mode
	$: if (editMode === "json") {
		jsonText = JSON.stringify($profileStore, null, 2);
	}

	function loadTemplate() {
		const template = getTemplateById(selectedTemplate);
		if (template) {
			$profileStore = structuredClone(template.profile);
		}
	}

	function resetProfile() {
		loadTemplate();
	}

	function copyJSON() {
		const json = JSON.stringify($profileStore, null, 2);
		navigator.clipboard.writeText(json);
	}

	async function pasteJSON() {
		try {
			const text = await navigator.clipboard.readText();
			const parsed = JSON.parse(text);
			$profileStore = parsed;
			jsonText = text;
			jsonError = null;
		} catch (e) {
			jsonError = e instanceof Error ? e.message : "Invalid JSON";
		}
	}

	function updateFromJSON() {
		try {
			const parsed = JSON.parse(jsonText);
			$profileStore = parsed;
			jsonError = null;
		} catch (e) {
			jsonError = e instanceof Error ? e.message : "Invalid JSON";
		}
	}

	function handleProfileChange() {
		// Trigger reactivity
		$profileStore = $profileStore;
	}
</script>

<div class="w-[360px] h-full overflow-y-auto bg-base-200 border-r border-base-content/10">
	<div class="p-4">
		<!-- Template Selector -->
		<div class="form-control mb-4">
			<label for="profile-template" class="label">
				<span class="label-text font-semibold">Profile Template</span>
			</label>
			<select
				id="profile-template"
				class="select select-bordered select-sm"
				bind:value={selectedTemplate}
				on:change={loadTemplate}
			>
				{#each PROFILE_TEMPLATES as template}
					<option value={template.id}>{template.name}</option>
				{/each}
			</select>
			<div class="label">
				<span class="label-text-alt text-base-content/60">
					{getTemplateById(selectedTemplate)?.description}
				</span>
			</div>
		</div>

		<!-- Mode Toggle -->
		<div class="tabs tabs-boxed mb-4">
			<button
				class="tab flex-1"
				class:tab-active={editMode === "visual"}
				on:click={() => (editMode = "visual")}
			>
				Visual
			</button>
			<button
				class="tab flex-1"
				class:tab-active={editMode === "json"}
				on:click={() => (editMode = "json")}
			>
				JSON
			</button>
		</div>

		{#if editMode === "visual"}
			<!-- Student Accommodations Section -->
			<div class="collapse collapse-arrow bg-base-100 mb-2">
				<input type="checkbox" checked />
				<div class="collapse-title font-medium text-sm">
					Student Accommodations
				</div>
				<div class="collapse-content">
					<!-- Text-to-Speech -->
					<div class="form-control mb-2">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Text-to-Speech</span>
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={$profileStore.accessibility.textToSpeech.enabled}
								on:change={handleProfileChange}
							/>
						</label>
					</div>

					{#if $profileStore.accessibility.textToSpeech.enabled}
						<div class="form-control ml-4 mb-2">
							<label class="label cursor-pointer py-1">
								<span class="label-text text-sm">Auto-read</span>
								<input
									type="checkbox"
									class="toggle toggle-sm"
									bind:checked={$profileStore.accessibility.textToSpeech.autoRead}
									on:change={handleProfileChange}
								/>
							</label>
						</div>
					{/if}

					<!-- High Contrast -->
					<div class="form-control mb-2">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">High Contrast</span>
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={$profileStore.accessibility.highContrast}
								on:change={handleProfileChange}
							/>
						</label>
					</div>

					<!-- Font Size -->
					<fieldset class="form-control mb-2">
						<legend class="label">
							<span class="label-text text-sm">Font Size</span>
						</legend>
						<div role="group" aria-label="Font size selection" class="btn-group btn-group-sm w-full">
							<button
								class="btn btn-sm flex-1"
								class:btn-active={$profileStore.accessibility.fontSize === "small"}
								on:click={() => {
									$profileStore.accessibility.fontSize = "small";
									handleProfileChange();
								}}
							>
								S
							</button>
							<button
								class="btn btn-sm flex-1"
								class:btn-active={$profileStore.accessibility.fontSize ===
									"medium"}
								on:click={() => {
									$profileStore.accessibility.fontSize = "medium";
									handleProfileChange();
								}}
							>
								M
							</button>
							<button
								class="btn btn-sm flex-1"
								class:btn-active={$profileStore.accessibility.fontSize === "large"}
								on:click={() => {
									$profileStore.accessibility.fontSize = "large";
									handleProfileChange();
								}}
							>
								L
							</button>
							<button
								class="btn btn-sm flex-1"
								class:btn-active={$profileStore.accessibility.fontSize ===
									"xlarge"}
								on:click={() => {
									$profileStore.accessibility.fontSize = "xlarge";
									handleProfileChange();
								}}
							>
								XL
							</button>
						</div>
					</fieldset>

					<!-- Extended Time -->
					<div class="form-control mb-2">
						<label for="extended-time" class="label">
							<span class="label-text text-sm">Extended Time</span>
							<span class="label-text-alt"
								>{$profileStore.timing.extendedTimeMultiplier}x</span
							>
						</label>
						<input
							id="extended-time"
							type="range"
							min="1"
							max="2"
							step="0.25"
							class="range range-sm"
							bind:value={$profileStore.timing.extendedTimeMultiplier}
							on:change={handleProfileChange}
						/>
						<div class="flex justify-between text-xs px-2 text-base-content/60">
							<span>1x</span>
							<span>1.25x</span>
							<span>1.5x</span>
							<span>1.75x</span>
							<span>2x</span>
						</div>
					</div>

					<!-- Keyboard Only -->
					<div class="form-control mb-2">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Keyboard Only</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.accessibility.keyboardOnly}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
				</div>
			</div>

			<!-- Tools Section -->
			<div class="collapse collapse-arrow bg-base-100 mb-2">
				<input type="checkbox" />
				<div class="collapse-title font-medium text-sm">Available Tools</div>
				<div class="collapse-content">
					<!-- Calculator -->
					<div class="form-control mb-2">
						<label for="calculator" class="label">
							<span class="label-text text-sm">Calculator</span>
						</label>
						<select
							id="calculator"
							class="select select-bordered select-sm"
							bind:value={$profileStore.tools.calculator}
							on:change={handleProfileChange}
						>
							<option value="none">None</option>
							<option value="basic">Basic</option>
							<option value="scientific">Scientific</option>
							<option value="graphing">Graphing</option>
						</select>
					</div>

					<!-- Tool Toggles -->
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Protractor</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.protractor}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Ruler</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.ruler}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Periodic Table</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.periodicTable}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Graph</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.graph}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Highlighter</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.highlighter}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Notepad</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.notepad}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Answer Eliminator</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.answerEliminator}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Line Reader</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.lineReader}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Magnifier</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.tools.magnifier}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
				</div>
			</div>

			<!-- Assessment Settings Section -->
			<div class="collapse collapse-arrow bg-base-100 mb-2">
				<input type="checkbox" />
				<div class="collapse-title font-medium text-sm">Assessment Settings</div>
				<div class="collapse-content">
					<div class="form-control mb-2">
						<label for="subject" class="label">
							<span class="label-text text-sm">Subject</span>
						</label>
						<select
							id="subject"
							class="select select-bordered select-sm"
							bind:value={$profileStore.assessment.subject}
							on:change={handleProfileChange}
						>
							<option value="math">Math</option>
							<option value="ela">ELA</option>
							<option value="science">Science</option>
							<option value="socialStudies">Social Studies</option>
						</select>
					</div>

					<div class="form-control mb-2">
						<label for="grade-level" class="label">
							<span class="label-text text-sm">Grade Level</span>
						</label>
						<select
							id="grade-level"
							class="select select-bordered select-sm"
							bind:value={$profileStore.assessment.gradeLevel}
							on:change={handleProfileChange}
						>
							<option value="K">Kindergarten</option>
							<option value="1-2">Grades 1-2</option>
							<option value="3-5">Grades 3-5</option>
							<option value="6-8">Grades 6-8</option>
							<option value="9-12">Grades 9-12</option>
						</select>
					</div>

					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Allow Review</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.assessment.allowReview}
								on:change={handleProfileChange}
							/>
						</label>
					</div>

					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Show Progress</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.assessment.showProgress}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
				</div>
			</div>

			<!-- District Policies Section -->
			<div class="collapse collapse-arrow bg-base-100 mb-2">
				<input type="checkbox" />
				<div class="collapse-title font-medium text-sm">District Policies</div>
				<div class="collapse-content">
					<div class="form-control mb-2">
						<label for="wcag-level" class="label">
							<span class="label-text text-sm">WCAG Level</span>
						</label>
						<select
							id="wcag-level"
							class="select select-bordered select-sm"
							bind:value={$profileStore.district.wcagLevel}
							on:change={handleProfileChange}
						>
							<option value="A">Level A</option>
							<option value="AA">Level AA</option>
							<option value="AAA">Level AAA</option>
						</select>
					</div>

					<div class="form-control">
						<label class="label cursor-pointer py-1">
							<span class="label-text text-sm">Keyboard Navigation Required</span>
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={$profileStore.district.keyboardNavigationRequired}
								on:change={handleProfileChange}
							/>
						</label>
					</div>
				</div>
			</div>
		{:else}
			<!-- JSON Editor -->
			<div class="form-control">
				<textarea
					class="textarea textarea-bordered font-mono text-xs h-96"
					bind:value={jsonText}
					on:blur={updateFromJSON}
				></textarea>
				{#if jsonError}
					<div class="alert alert-error mt-2 py-2">
						<span class="text-xs">{jsonError}</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="flex gap-2 mt-4">
			<button class="btn btn-sm flex-1" on:click={resetProfile}> Reset </button>
			<button class="btn btn-sm flex-1" on:click={copyJSON}>
				Copy JSON
			</button>
			<button class="btn btn-sm flex-1" on:click={pasteJSON}>
				Paste JSON
			</button>
		</div>
	</div>
</div>
