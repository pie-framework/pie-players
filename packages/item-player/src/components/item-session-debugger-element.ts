import {
	installContentStyles,
	auditContentStyles,
} from "@pie-players/pie-players-shared";
import contentStyles from "@pie-players/pie-theme/components.css?raw";
import "../ItemSessionDebugger.svelte";

// This entry is separately importable, so it installs the shared content
// stylesheet itself rather than relying on the main player entry — the debugger's
// own chrome (pie-section-player-tools-session-debugger*) lives there too.
// Installation is idempotent, so loading both entries still yields one copy.
installContentStyles(contentStyles, "pie-item-player-session-debugger");
auditContentStyles("pie-item-player-session-debugger");

export type { PieItemSessionDebuggerElement } from "../types.js";
