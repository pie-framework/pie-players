import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "drag-in-the-blank-basic-sentence",
	"name": "Basic Sentence Completion",
	"description": "Simple fill-in-the-blank sentence with text choices",
	"sourcePackage": "drag-in-the-blank",
	"sourceVariantId": "basic-sentence",
	"tags": [
		"basic",
		"text",
		"sentence"
	],
	"item": {
		"id": "drag-in-the-blank-basic-sentence",
		"name": "Basic Sentence Completion",
		"config": {
			"id": "",
			"markup": "<drag-in-the-blank id=\"1\"></drag-in-the-blank>",
			"elements": {
				"drag-in-the-blank": "@pie-element/drag-in-the-blank@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "drag-in-the-blank",
					"prompt": "<p>Complete the sentence by dragging the correct words into the blanks.</p>",
					"promptEnabled": true,
					"markup": "<p>The {{0}} is the largest planet in our solar system, while {{1}} is the smallest.</p>",
					"choices": [
						{
							"id": "0",
							"value": "Jupiter"
						},
						{
							"id": "1",
							"value": "Mercury"
						},
						{
							"id": "2",
							"value": "Saturn"
						},
						{
							"id": "3",
							"value": "Mars"
						}
					],
					"correctResponse": {
						"0": "0",
						"1": "1"
					},
					"choicesPosition": "below",
					"duplicates": false,
					"lockChoiceOrder": false,
					"partialScoring": true,
					"rationaleEnabled": true,
					"rationale": "<p>Jupiter is the largest planet with a diameter of about 86,881 miles, while Mercury is the smallest with a diameter of only 3,032 miles.</p>",
					"teacherInstructionsEnabled": true,
					"teacherInstructions": "<p>This tests basic planetary knowledge.</p>",
					"toolbarEditorPosition": "bottom"
				}
			]
		}
	}
};

export default demo;
