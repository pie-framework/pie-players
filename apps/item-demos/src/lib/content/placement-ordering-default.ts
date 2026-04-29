import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "placement-ordering-default",
	"name": "Arrange the fruits alphabetically",
	"description": "Basic placement ordering configuration",
	"sourcePackage": "placement-ordering",
	"sourceVariantId": "default",
	"tags": [
		"placement-ordering",
		"default"
	],
	"item": {
		"id": "placement-ordering-default",
		"name": "Arrange the fruits alphabetically",
		"config": {
			"id": "",
			"markup": "<placement-ordering id=\"1\"></placement-ordering>",
			"elements": {
				"placement-ordering": "@pie-element/placement-ordering@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "placement-ordering",
					"choiceLabel": "Choices",
					"choices": [
						{
							"id": "c1",
							"label": "Blueberry"
						},
						{
							"id": "c2",
							"label": "Lemon"
						},
						{
							"id": "c3",
							"label": "Melon"
						},
						{
							"id": "c4",
							"label": "Pear"
						}
					],
					"correctResponse": [
						"c1",
						"c2",
						"c3",
						"c4"
					],
					"feedback": {
						"correct": {
							"type": "none",
							"default": "Correct"
						},
						"incorrect": {
							"type": "none",
							"default": "Incorrect"
						},
						"partial": {
							"type": "none",
							"default": "Nearly"
						}
					},
					"feedbackEnabled": true,
					"prompt": "Arrange the fruits alphabetically",
					"promptEnabled": true,
					"numberedGuides": false,
					"orientation": "vertical",
					"partialScoring": false,
					"placementArea": false,
					"scoringType": "auto",
					"targetLabel": "Answers",
					"toolbarEditorPosition": "bottom",
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
