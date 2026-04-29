import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "multiple-choice-no-prefix",
	"name": "No Choice Prefix",
	"description": "Choices without letter/number prefixes",
	"sourcePackage": "multiple-choice",
	"sourceVariantId": "no-prefix",
	"tags": [
		"checkbox",
		"no-prefix"
	],
	"item": {
		"id": "multiple-choice-no-prefix",
		"name": "No Choice Prefix",
		"config": {
			"id": "",
			"markup": "<multiple-choice id=\"3\"></multiple-choice>",
			"elements": {
				"multiple-choice": "@pie-element/multiple-choice@latest"
			},
			"models": [
				{
					"id": "3",
					"element": "multiple-choice",
					"choiceMode": "checkbox",
					"choicePrefix": "none",
					"choices": [
						{
							"correct": true,
							"value": "1",
							"label": "Apple"
						},
						{
							"correct": false,
							"value": "2",
							"label": "Carrot"
						},
						{
							"correct": true,
							"value": "3",
							"label": "Banana"
						},
						{
							"correct": false,
							"value": "4",
							"label": "Broccoli"
						},
						{
							"correct": true,
							"value": "5",
							"label": "Orange"
						}
					],
					"prompt": "<p>Select all fruits from the list below:</p>",
					"promptEnabled": true
				}
			]
		}
	}
};

export default demo;
