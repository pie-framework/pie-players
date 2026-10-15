/**
 * The support conflicts `ToolkitCoordinator` gives its policy engine. They name
 * capabilities, so they live here, outside the capability-neutral policy core.
 */

import type { SupportConflict } from "../policy/engine.js";

/**
 * A student's screen reader speaks the page, so PIE's read-aloud and item audio
 * that starts on its own would talk over it (ADR 0004).
 */
export const TOOLKIT_SUPPORT_CONFLICTS: readonly SupportConflict[] = [
	{ support: "screenReader", withholds: ["textToSpeech", "autoplayAudio"] },
];
