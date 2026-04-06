import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "drawing-response-default",
	"name": "Drawing Response",
	"description": "Basic drawing response configuration",
	"sourcePackage": "drawing-response",
	"sourceVariantId": "default",
	"tags": [
		"drawing",
		"default"
	],
	"item": {
		"id": "drawing-response-default",
		"name": "Drawing Response",
		"config": {
			"id": "",
			"markup": "<drawing-response id=\"1\"></drawing-response>",
			"elements": {
				"drawing-response": "@pie-element/drawing-response@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "drawing-response",
					"prompt": "This is the question prompt",
					"promptEnabled": true,
					"backgroundImageEnabled": true,
					"toolbarEditorPosition": "bottom",
					"imageUrl": "",
					"imageDimensions": {
						"height": 0,
						"width": 0
					},
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
