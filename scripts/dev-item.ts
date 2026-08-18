#!/usr/bin/env bun

import { runDevServerBootstrap } from "./lib/dev-server-bootstrap.js";

await runDevServerBootstrap({
	devScriptName: "item",
	label: "item",
	appDir: "apps/item-demos",
	requiredDistArtifacts: [
		"packages/item-player/dist/pie-item-player.js",
		"packages/players-shared/dist/index.js",
		"packages/section-player-tools-instrumentation-debugger/dist/section-player-tools-instrumentation-debugger.js",
	],
});
