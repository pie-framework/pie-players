import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "multiple-choice-numbers-prefix",
	"name": "Number Prefix",
	"description": "Choices with number prefixes instead of letters",
	"sourcePackage": "multiple-choice",
	"sourceVariantId": "numbers-prefix",
	"tags": [
		"radio",
		"numbers",
		"prefix"
	],
	"item": {
		"id": "multiple-choice-numbers-prefix",
		"name": "Number Prefix",
		"config": {
			"id": "",
			"markup": "<multiple-choice id=\"4\"></multiple-choice>",
			"elements": {
				"multiple-choice": "@pie-element/multiple-choice@latest"
			},
			"models": [
				{
					"id": "4",
					"element": "multiple-choice",
					"choiceMode": "radio",
					"choicePrefix": "numbers",
					"choices": [
						{
							"correct": false,
							"value": "1",
							"label": "France"
						},
						{
							"correct": true,
							"value": "2",
							"label": "Canada"
						},
						{
							"correct": false,
							"value": "3",
							"label": "Germany"
						},
						{
							"correct": false,
							"value": "4",
							"label": "Italy"
						}
					],
					"prompt": "<p>Which country has the longest coastline in the world?</p>",
					"promptEnabled": true
				}
			]
		}
	}
};

export default demo;
