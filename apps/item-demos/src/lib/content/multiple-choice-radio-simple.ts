import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "multiple-choice-radio-simple",
	"name": "Single Select (Radio)",
	"description": "Radio button mode with single correct answer",
	"sourcePackage": "multiple-choice",
	"sourceVariantId": "radio-simple",
	"tags": [
		"radio",
		"single-select",
		"basic"
	],
	"item": {
		"id": "multiple-choice-radio-simple",
		"name": "Single Select (Radio)",
		"config": {
			"id": "",
			"markup": "<multiple-choice id=\"2\"></multiple-choice>",
			"elements": {
				"multiple-choice": "@pie-element/multiple-choice@latest"
			},
			"models": [
				{
					"id": "2",
					"element": "multiple-choice",
					"choiceMode": "radio",
					"choicePrefix": "letters",
					"choices": [
						{
							"correct": false,
							"value": "mercury",
							"label": "Mercury",
							"feedback": {
								"type": "default",
								"value": "Incorrect. Mercury is the smallest planet."
							}
						},
						{
							"correct": true,
							"value": "jupiter",
							"label": "Jupiter",
							"feedback": {
								"type": "default",
								"value": "Correct! Jupiter is the largest planet."
							}
						},
						{
							"correct": false,
							"value": "earth",
							"label": "Earth",
							"feedback": {
								"type": "default",
								"value": "Incorrect. Earth is the third planet."
							}
						},
						{
							"correct": false,
							"value": "mars",
							"label": "Mars",
							"feedback": {
								"type": "default",
								"value": "Incorrect. Mars is smaller than Earth."
							}
						}
					],
					"prompt": "<p>Which is the largest planet in our solar system?</p>",
					"promptEnabled": true,
					"toolbarEditorPosition": "bottom"
				}
			]
		}
	}
};

export default demo;
