import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "fraction-model-pie-improper-fraction",
	"name": "Pie Model - Improper Fraction",
	"description": "Multiple pie charts showing 7/4 (one and three-quarters)",
	"sourcePackage": "fraction-model",
	"sourceVariantId": "pie-improper-fraction",
	"tags": [
		"pie",
		"improper-fraction",
		"multiple-models",
		"advanced"
	],
	"item": {
		"id": "fraction-model-pie-improper-fraction",
		"name": "Pie Model - Improper Fraction",
		"config": {
			"id": "",
			"markup": "<fraction-model id=\"2\"></fraction-model>",
			"elements": {
				"fraction-model": "@pie-element/fraction-model@latest"
			},
			"models": [
				{
					"id": "2",
					"element": "fraction-model",
					"title": "Representing Improper Fractions",
					"prompt": "<p>Shade the pie models to represent <strong>7/4</strong> (seven fourths).</p><p><em>Hint: This is more than one whole!</em></p>",
					"modelTypeSelected": "pie",
					"maxModelSelected": 2,
					"partsPerModel": 4,
					"allowedStudentConfig": false,
					"showGraphLabels": true,
					"correctResponse": [
						{
							"id": 1,
							"value": 4
						},
						{
							"id": 2,
							"value": 3
						}
					]
				}
			]
		}
	}
};

export default demo;
