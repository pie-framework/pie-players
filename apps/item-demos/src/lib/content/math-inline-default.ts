import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "math-inline-default",
	"name": "Find the value of the expression that you",
	"description": "Basic math inline configuration",
	"sourcePackage": "math-inline",
	"sourceVariantId": "default",
	"tags": [
		"math-inline",
		"default"
	],
	"item": {
		"id": "math-inline-default",
		"name": "Find the value of the expression that you",
		"config": {
			"id": "",
			"markup": "<math-inline id=\"1\"></math-inline>",
			"elements": {
				"math-inline": "@pie-element/math-inline@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "math-inline",
					"equationEditor": 3,
					"toolbarEditorPosition": "bottom",
					"prompt": "<p><strong>B.</strong> Find the value of the expression that you wrote in part A to find how much money the band members made.</p>\n\n<p>Use the on-screen keyboard to type your answer in the box below.</p>\n",
					// biome-ignore lint/suspicious/noTemplateCurlyInString: PIE math-inline template placeholder, not a JS template literal
					"expression": "${{response}}",
					"responses": [
						{
							"allowSpaces": true,
							"answer": "$410",
							"id": "1"
						}
					],
					"responseType": "Advanced Multi",
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
