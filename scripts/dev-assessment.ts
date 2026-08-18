#!/usr/bin/env bun

import { runDevServerBootstrap } from "./lib/dev-server-bootstrap.js";

await runDevServerBootstrap({
	devScriptName: "assessment",
	label: "assessment",
	appDir: "apps/assessment-demos",
	requiredDistArtifacts: [
		"packages/assessment-player/dist/pie-assessment-player.js",
		"packages/assessment-toolkit/dist/index.js",
		"packages/players-shared/dist/index.js",
		"packages/section-player-tools-event-debugger/dist/section-player-tools-event-debugger.js",
		"packages/section-player-tools-instrumentation-debugger/dist/section-player-tools-instrumentation-debugger.js",
		"packages/section-player-tools-session-debugger/dist/section-player-tools-session-debugger.js",
		"packages/section-player-tools-shared/dist/index.js",
		"packages/tool-calculator-desmos/dist/pie-tool-calculator.js",
		"packages/tool-text-to-speech/dist/tool-text-to-speech.js",
		"packages/tts-server-google/dist/index.js",
		"packages/tts-server-polly/dist/index.js",
	],
});
