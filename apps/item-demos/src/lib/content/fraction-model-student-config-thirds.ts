import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "fraction-model-student-config-thirds",
	"name": "Student Configuration - Thirds",
	"description": "Student can choose number of models and parts to represent 2/3",
	"sourcePackage": "fraction-model",
	"sourceVariantId": "student-config-thirds",
	"tags": [
		"bar",
		"thirds",
		"student-config",
		"flexible"
	],
	"item": {
		"id": "fraction-model-student-config-thirds",
		"name": "Student Configuration - Thirds",
		"config": {
			"id": "",
			"markup": "<fraction-model id=\"3\"></fraction-model>",
			"elements": {
				"fraction-model": "@pie-element/fraction-model@latest"
			},
			"models": [
				{
					"id": "3",
					"element": "fraction-model",
					"title": "Flexible Fraction Modeling",
					"prompt": "<p>Choose your own number of models and parts per model, then shade to show <strong>2/3</strong> (two thirds).</p>",
					"modelTypeSelected": "bar",
					"maxModelSelected": 3,
					"partsPerModel": 3,
					"allowedStudentConfig": true,
					"showGraphLabels": false,
					"correctResponse": [
						{
							"id": 1,
							"value": 2
						}
					]
				}
			]
		}
	}
};

export default demo;
