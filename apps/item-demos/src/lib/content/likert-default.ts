import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "likert-default",
	"name": "How likely are you to report a problem?",
	"description": "Basic likert configuration",
	"sourcePackage": "likert",
	"sourceVariantId": "default",
	"tags": [
		"likert",
		"default"
	],
	"item": {
		"id": "likert-default",
		"name": "How likely are you to report a problem?",
		"config": {
			"id": "",
			"markup": "<likert-element id=\"1\"></likert-element>",
			"elements": {
				"likert-element": "@pie-element/likert@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "likert-element",
					"likertScale": "likert3",
					"likertType": "agreement",
					"likertOrientation": "horizontal",
					"choices": [
						{
							"label": "Disagree",
							"value": -1
						},
						{
							"label": "Unsure",
							"value": 0
						},
						{
							"label": "Agree",
							"value": 1
						}
					],
					"prompt": "How likely are you to report a problem?"
				}
			]
		}
	}
};

export default demo;
