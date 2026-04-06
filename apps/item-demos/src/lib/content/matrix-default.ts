import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "matrix-default",
	"name": "How interested are you in the following domains?",
	"description": "Basic matrix configuration",
	"sourcePackage": "matrix",
	"sourceVariantId": "default",
	"tags": [
		"matrix",
		"default"
	],
	"item": {
		"id": "matrix-default",
		"name": "How interested are you in the following domains?",
		"config": {
			"id": "",
			"markup": "<matrix-element id=\"1\"></matrix-element>",
			"elements": {
				"matrix-element": "@pie-element/matrix@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "matrix-element",
					"labelType": "agreement",
					"rowLabels": [
						"I'm interested in politics.",
						"I'm interested in economics."
					],
					"columnLabels": [
						"Disagree",
						"Unsure",
						"Agree"
					],
					"matrixValues": {},
					"prompt": "How interested are you in the following domains?"
				}
			]
		}
	}
};

export default demo;
