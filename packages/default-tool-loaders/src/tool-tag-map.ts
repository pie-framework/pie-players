import type { ToolTagMap } from "@pie-players/pie-assessment-toolkit/tools/internal";

/**
 * Element tag for each packaged tool.
 *
 * Composition data, not core data: it is a catalogue of which capabilities exist
 * in a deployment and which element renders each. It lived in the toolkit, where
 * a core module naming eleven capabilities meant a host could not add a twelfth
 * without editing our package — the map was overridable, but its default was
 * core-resident, so the core still had to know the names.
 *
 * `resolveToolTag` in the toolkit reads only the overrides it is handed, and
 * `createPackagedToolRegistry` installs this map through
 * `ToolRegistry.setComponentOverrides`. A host composing its own registry
 * supplies its own map the same way.
 */
export const PACKAGED_TOOL_TAG_MAP: ToolTagMap = {
	calculator: "pie-tool-calculator",
	textToSpeech: "pie-tool-text-to-speech",
	ruler: "pie-tool-ruler",
	protractor: "pie-tool-protractor",
	answerEliminator: "pie-tool-answer-eliminator",
	highlighter: "pie-tool-annotation-toolbar",
	lineReader: "pie-tool-line-reader",
	theme: "pie-tool-theme",
	annotationToolbar: "pie-tool-annotation-toolbar",
	graph: "pie-tool-graph",
	periodicTable: "pie-tool-periodic-table",
};
