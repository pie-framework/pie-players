#!/usr/bin/env bun

import { runDevServerBootstrap } from "./lib/dev-server-bootstrap.js";

await runDevServerBootstrap({
	devScriptName: "section",
	label: "section",
	appDir: "apps/section-demos",
	requiredDistArtifacts: [
		"packages/tts-client-server/dist/index.js",
		"packages/calculator-desmos/dist/index.js",
		"packages/tool-calculator-desmos/dist/pie-tool-calculator.js",
		"packages/tool-text-to-speech/dist/tool-text-to-speech.js",
		"packages/tool-answer-eliminator/dist/tool-answer-eliminator.js",
		"packages/tool-annotation-toolbar/dist/tool-annotation-toolbar.js",
		"packages/tool-color-scheme/dist/tool-color-scheme.js",
		"packages/tool-graph/dist/tool-graph.js",
		"packages/tool-periodic-table/dist/tool-periodic-table.js",
		"packages/tool-protractor/dist/tool-protractor.js",
		"packages/tool-line-reader/dist/tool-line-reader.js",
		"packages/tool-ruler/dist/tool-ruler.js",
	],
});
