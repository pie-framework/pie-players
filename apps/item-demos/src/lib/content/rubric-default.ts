import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "rubric-default",
	"name": "Rubric",
	"description": "Basic rubric configuration",
	"sourcePackage": "rubric",
	"sourceVariantId": "default",
	"tags": [
		"rubric",
		"default"
	],
	"item": {
		"id": "rubric-default",
		"name": "Rubric",
		"config": {
			"id": "",
			"markup": "<rubric-element id=\"1\"></rubric-element>",
			"elements": {
				"rubric-element": "@pie-element/rubric@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "rubric-element",
					"points": [
						"nothing right",
						"a teeny bit right",
						"mostly right",
						"bingo"
					],
					"sampleAnswers": [
						null,
						"just right",
						"not left",
						null
					],
					"maxPoints": 3,
					"excludeZero": false
				}
			]
		}
	}
};

export default demo;
