<script lang="ts">
	import SessionDbPanelShared from '@pie-players/pie-section-player-tools-shared/SessionDbPanel.svelte';

	interface Props {
		assessmentId: string;
		sectionId: string;
		attemptId: string;
		onResetDb: () => void | Promise<void>;
		onClose: () => void;
	}

	let { assessmentId, sectionId, attemptId, onResetDb, onClose }: Props = $props();
</script>

<SessionDbPanelShared
	mode="section"
	{assessmentId}
	{sectionId}
	{attemptId}
	{onResetDb}
	{onClose}
/>
