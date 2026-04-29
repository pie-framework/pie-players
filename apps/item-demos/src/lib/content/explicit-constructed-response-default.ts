import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "explicit-constructed-response-default",
	"name": "Complete the sentence",
	"description": "Basic explicit constructed response configuration",
	"sourcePackage": "explicit-constructed-response",
	"sourceVariantId": "default",
	"tags": [
		"explicit-constructed-response",
		"default"
	],
	"item": {
		"id": "explicit-constructed-response-default",
		"name": "Complete the sentence",
		"config": {
			"id": "",
			"markup": "<explicit-constructed-response id=\"1\"></explicit-constructed-response>",
			"elements": {
				"explicit-constructed-response": "@pie-element/explicit-constructed-response@latest"
			},
			"models": [
				{
					"id": "1",
					"markup": "<p>The {{0}} jumped {{1}} the {{2}}</p>",
					"disabled": false,
					"choices": {
						"0": [
							{
								"label": "cow",
								"value": "0"
							},
							{
								"label": "cattle",
								"value": "1"
							},
							{
								"label": "calf",
								"value": "2"
							}
						],
						"1": [
							{
								"label": "over",
								"value": "0"
							},
							{
								"label": "past",
								"value": "1"
							},
							{
								"label": "beyond",
								"value": "2"
							}
						],
						"2": [
							{
								"label": "moon",
								"value": "0"
							}
						]
					},
					"prompt": "<div>Complete the sentence</div>",
					"promptEnabled": true,
					"displayType": "block",
					"maxLengthPerChoiceEnabled": true,
					"playerSpellCheckEnabled": true,
					"rationale": "<div></div>",
					"rationaleEnabled": true,
					"spellCheckEnabled": true,
					"studentInstructionsEnabled": true,
					"teacherInstructions": "<div></div>",
					"teacherInstructionsEnabled": true,
					"toolbarEditorPosition": "bottom",
					"responseAreaInputConfiguration": {
						"characters": {
							"disabled": true
						}
					},
					"slateMarkup": "<p>The <span data-type=\"explicit_constructed_response\" data-index=\"0\" data-value=\"cow\"></span> jumped <span data-type=\"explicit_constructed_response\" data-index=\"1\" data-value=\"over\"></span> the <span data-type=\"explicit_constructed_response\" data-index=\"2\" data-value=\"moon\"></span></p>",
					"maxLengthPerChoice": [
						10,
						10,
						7
					],
					"element": "explicit-constructed-response"
				}
			]
		}
	}
};

export default demo;
