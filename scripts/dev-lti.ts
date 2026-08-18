#!/usr/bin/env bun

import { runDevServerBootstrap } from "./lib/dev-server-bootstrap.js";

await runDevServerBootstrap({
	devScriptName: "lti",
	label: "LTI",
	appDir: "apps/lti-demos",
	requiredDistArtifacts: [
		"packages/assessment-player/dist/pie-assessment-player.js",
		"packages/assessment-toolkit/dist/index.js",
		"packages/players-shared/dist/index.js",
	],
});
