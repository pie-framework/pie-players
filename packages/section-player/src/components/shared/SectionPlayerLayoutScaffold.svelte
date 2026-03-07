<script lang="ts">
	import "../section-player-base-element.js";
	import "../section-player-shell-element.js";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

	let {
		runtime = null as Record<string, unknown> | null,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
		onCompositionChanged,
	} = $props<{
		runtime?: Record<string, unknown> | null;
		section?: AssessmentSection | null;
		sectionId?: string;
		attemptId?: string;
		showToolbar?: boolean | string | null | undefined;
		toolbarPosition?: string;
		enabledTools?: string;
		onCompositionChanged?: (event: Event) => void;
	}>();

	function handleCompositionChanged(event: Event) {
		onCompositionChanged?.(event);
	}
</script>

<pie-section-player-base
	{runtime}
	{section}
	section-id={sectionId}
	attempt-id={attemptId}
	oncomposition-changed={handleCompositionChanged}
>
	<pie-section-player-shell
		show-toolbar={showToolbar}
		toolbar-position={toolbarPosition}
		enabled-tools={enabledTools}
	>
		<slot></slot>
	</pie-section-player-shell>
</pie-section-player-base>
