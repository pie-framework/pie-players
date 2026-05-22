<script lang="ts">
	import { SessionDbPanel as SessionDbPanelShared } from "@pie-players/pie-section-player-tools-shared";

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
