import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "drag-in-the-blank-chemistry-duplicates",
	"name": "Chemistry Balance with Duplicates",
	"description": "Balance chemical equations allowing duplicate use of coefficients",
	"sourcePackage": "drag-in-the-blank",
	"sourceVariantId": "chemistry-duplicates",
	"tags": [
		"chemistry",
		"duplicates",
		"math",
		"equations"
	],
	"item": {
		"id": "drag-in-the-blank-chemistry-duplicates",
		"name": "Chemistry Balance with Duplicates",
		"config": {
			"id": "",
			"markup": "<drag-in-the-blank id=\"4\"></drag-in-the-blank>",
			"elements": {
				"drag-in-the-blank": "@pie-element/drag-in-the-blank@latest"
			},
			"models": [
				{
					"id": "4",
					"element": "drag-in-the-blank",
					"prompt": "<p>Balance the following chemical equations by dragging the correct coefficients. Some coefficients may be used more than once.</p>",
					"promptEnabled": true,
					"markup": "<div><p>1. {{0}}H₂ + {{1}}O₂ → {{2}}H₂O</p><p>2. {{3}}N₂ + {{4}}H₂ → {{5}}NH₃</p></div>",
					"choices": [
						{
							"id": "0",
							"value": "1"
						},
						{
							"id": "1",
							"value": "2"
						},
						{
							"id": "2",
							"value": "3"
						},
						{
							"id": "3",
							"value": "4"
						}
					],
					"correctResponse": {
						"0": "1",
						"1": "0",
						"2": "1",
						"3": "0",
						"4": "2",
						"5": "1"
					},
					"choicesPosition": "below",
					"duplicates": true,
					"lockChoiceOrder": true,
					"partialScoring": true,
					"rationaleEnabled": true,
					"rationale": "<p>Chemical equations must be balanced so that the number of atoms of each element is the same on both sides. For water formation: 2H₂ + O₂ → 2H₂O. For ammonia synthesis: N₂ + 3H₂ → 2NH₃.</p>",
					"teacherInstructionsEnabled": true,
					"teacherInstructions": "<p>This assesses understanding of stoichiometry and balancing chemical equations. Students must recognize that coefficients can be reused.</p>",
					"toolbarEditorPosition": "bottom"
				}
			]
		}
	}
};

export default demo;
