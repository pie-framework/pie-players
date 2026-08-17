/**
 * The packaged capabilities that carry an authored alternate and render it as a
 * region.
 *
 * A projection of the composition set below, kept in its own module for one
 * reason: it must be importable without reaching the packaged composition table,
 * whose lazy loaders name concrete `pie-tool-*` packages. A renderer that only
 * ever shows text alternates — print — would otherwise carry a calculator and a
 * TTS bundle it can never activate.
 *
 * Which slot an alternate fills is still the renderer's decision, not this list's:
 * every entry declares its own `surfaces`, and a host resolves the slots it
 * actually opens. Print opens the in-flow one and not the docked-media one,
 * because a signed alternate on paper is a blank rectangle.
 *
 * `tests/content-alternates.test.ts` pins this against the composition set in both
 * directions, so a capability added there cannot quietly fail to reach print.
 */

import type { ToolRegistration } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { audioTranscriptRegistration } from "./registrations/audio-transcript.js";

export const CONTENT_ALTERNATE_REGISTRATIONS: readonly ToolRegistration[] = [
	audioTranscriptRegistration,
];
