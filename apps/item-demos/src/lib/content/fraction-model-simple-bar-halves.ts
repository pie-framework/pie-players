import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "fraction-model-simple-bar-halves",
	"name": "Simple Bar Model - Halves",
	"description": "Basic bar model showing 1/2 using a single bar divided into 2 parts",
	"sourcePackage": "fraction-model",
	"sourceVariantId": "simple-bar-halves",
	"tags": [
		"bar",
		"halves",
		"basic",
		"simple-fraction"
	],
	"item": {
		"id": "fraction-model-simple-bar-halves",
		"name": "Simple Bar Model - Halves",
		"config": {
			"id": "",
			"markup": "<fraction-model id=\"1\"></fraction-model>",
			"elements": {
				"fraction-model": "@pie-element/fraction-model@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "fraction-model",
					"title": "Understanding Halves",
					"prompt": "<p>Shade the model to show <strong>1/2</strong> (one half).</p>",
					"modelTypeSelected": "bar",
					"maxModelSelected": 1,
					"partsPerModel": 2,
					"allowedStudentConfig": false,
					"showGraphLabels": false,
					"correctResponse": [
						{
							"id": 1,
							"value": 1
						}
					]
				}
			]
		}
	}
};

export default demo;
