/**
 * Shared orchestration events for TTS tool UI controls.
 *
 * These events are intentionally UI-level coordination hints. They do not replace
 * playback controls such as stop/pause/resume.
 */
export const PIE_TTS_CONTROL_HANDOFF_EVENT = "pie-tts-control-handoff";

export type TTSControlHandoffDetail = {
	/**
	 * Optional source identifier for host-orchestrated handoff tracing.
	 */
	source?: "host";
};
