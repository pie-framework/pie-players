import { expect, test } from "@playwright/test";

const EXPECTED_TOOLS_NO_MAGNIFIER: Array<{
	label: string;
	tag: string;
}> = [
	{ label: "Calculator", tag: "pie-tool-calculator" },
	{ label: "Graph", tag: "pie-tool-graph" },
	{ label: "Periodic Table", tag: "pie-tool-periodic-table" },
	{ label: "Protractor", tag: "pie-tool-protractor" },
	{ label: "Line Reader", tag: "pie-tool-line-reader" },
	{ label: "Ruler", tag: "pie-tool-ruler" },
];

const MAGNIFIER_TOOL = { label: "Magnifier", tag: "pie-tool-magnifier" };

const OPEN_LOCATOR_BY_TAG: Record<
	string,
	{ role: "dialog" | "application"; name: RegExp }
> = {
	"pie-tool-calculator": { role: "dialog", name: /Calculator tool/i },
	"pie-tool-graph": { role: "dialog", name: /Graph Tool/i },
	"pie-tool-periodic-table": { role: "dialog", name: /Periodic Table/i },
	"pie-tool-protractor": { role: "application", name: /Protractor tool/i },
	"pie-tool-line-reader": { role: "application", name: /Line Reader tool/i },
	"pie-tool-ruler": { role: "application", name: /Ruler tool/i },
};
