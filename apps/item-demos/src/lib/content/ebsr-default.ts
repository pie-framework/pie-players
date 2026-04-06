import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "ebsr-default",
	"name": "What color is the sky?",
	"description": "Basic EBSR configuration",
	"sourcePackage": "ebsr",
	"sourceVariantId": "default",
	"tags": [
		"ebsr",
		"default"
	],
	"item": {
		"id": "ebsr-default",
		"name": "What color is the sky?",
		"config": {
			"id": "",
			"markup": "<ebsr-element id=\"1\"></ebsr-element>",
			"elements": {
				"ebsr-element": "@pie-element/ebsr@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "ebsr-element",
					"partA": {
						"choiceMode": "checkbox",
						"choices": [
							{
								"value": "yellow",
								"label": "Yellow"
							},
							{
								"value": "green",
								"label": "Green"
							},
							{
								"correct": true,
								"value": "blue",
								"label": "Blue"
							}
						],
						"choicePrefix": "numbers",
						"partialScoring": false,
						"prompt": "What color is the sky?",
						"promptEnabled": true
					},
					"partB": {
						"choiceMode": "checkbox",
						"choices": [
							{
								"value": "orange",
								"label": "Orange"
							},
							{
								"correct": true,
								"value": "purple",
								"label": "Purple"
							},
							{
								"value": "pink",
								"label": "Pink"
							},
							{
								"value": "green",
								"label": "Green"
							}
						],
						"choicePrefix": "numbers",
						"partialScoring": false,
						"prompt": "What color do you get when you mix Red with your answer in Part 1?",
						"promptEnabled": true
					}
				}
			]
		}
	}
};

export default demo;
