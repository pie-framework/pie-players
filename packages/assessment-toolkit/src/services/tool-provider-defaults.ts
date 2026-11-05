/**
 * The provider configs a coordinator applies when the host's tools config
 * names none for a capability.
 *
 * This module names capabilities on purpose, like `services/support-conflicts.ts`:
 * a default is a statement about which capabilities a deployment starts with,
 * which is not a decision the capability-neutral coordination layer gets to
 * make. The coordinator applies the table without naming its entries —
 * `check-capability-neutrality` holds it to that. These are the coordinator's
 * previous inline defaults, moved verbatim.
 */

import type { ToolProvidersConfig } from "./tools-config-normalizer.js";

export const DEFAULT_TOOL_PROVIDERS: ToolProvidersConfig = {
	textToSpeech: {
		enabled: true,
		backend: "browser",
	},
	annotationToolbar: {
		enabled: true,
	},
};
