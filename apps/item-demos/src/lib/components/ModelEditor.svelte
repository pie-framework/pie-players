<script lang="ts">
	let {
		model,
		onUpdate
	}: {
		model: any;
		onUpdate: (changes: any) => void;
	} = $props();

	function handlePromptChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		onUpdate({ prompt: target.value });
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h3 class="card-title">Model: {model.id}</h3>

		<div class="form-control">
			<label class="label" for="prompt-textarea-{model.id}">
				<span class="label-text">Prompt</span>
			</label>
			<textarea id="prompt-textarea-{model.id}" class="textarea textarea-bordered" value={model.prompt} oninput={handlePromptChange}
			></textarea>
		</div>

		<!-- Can extend with element-specific controls -->
	</div>
</div>
