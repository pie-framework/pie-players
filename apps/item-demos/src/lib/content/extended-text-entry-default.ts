import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "extended-text-entry-default",
	"name": "Extended Text Entry",
	"description": "Basic extended text entry configuration",
	"sourcePackage": "extended-text-entry",
	"sourceVariantId": "default",
	"tags": [
		"extended-text-entry",
		"default"
	],
	"item": {
		"id": "extended-text-entry-default",
		"name": "Extended Text Entry",
		"config": {
			"id": "",
			"markup": "<extended-text-entry id=\"1\"></extended-text-entry>",
			"elements": {
				"extended-text-entry": "@pie-element/extended-text-entry@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "extended-text-entry",
					"customKeys": [
						"\\square"
					],
					"feedback": {
						"type": "default",
						"default": "this is default feedback"
					},
					"prompt": "This is the question prompt",
					"promptEnabled": true,
					"mathInput": true,
					"playersToolbarPosition": "bottom",
					"toolbarEditorPosition": "bottom",
					"spellCheckEnabled": true,
					"rubricEnabled": false,
					"annotationsEnabled": false
				}
			]
		}
	}
};

export default demo;
