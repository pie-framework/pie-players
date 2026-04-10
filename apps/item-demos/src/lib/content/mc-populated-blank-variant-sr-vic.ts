import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "mc-populated-blank-variant-sr-vic",
	"name": "VIC (canonical CQT sample)",
	"description": "Canonical sample from item 00293f60-334f-48d0-b145-f7cb9f02a0fe and question a546c0a3-3d68-4d5c-994f-262e788f486c.",
	"sourcePackage": "@pie-element/mc-populated-blank",
	"sourceVariantId": "variant-sr-vic",
	"tags": [
		"mc-populated-blank",
		"cqt-sample",
		"VIC",
		"sr-vic",
		"sr-vicv0.0.1"
	],
	"item": {
		"id": "mc-populated-blank-variant-sr-vic",
		"name": "VIC (canonical CQT sample)",
		"config": {
			"id": "",
			"markup": "<mc-populated-blank id=\"2\"></mc-populated-blank>",
			"elements": {
				"mc-populated-blank": "@pie-element/mc-populated-blank@latest"
			},
			"models": [
				{
					"id": "2",
					"element": "mc-populated-blank",
					"prompt": "",
					"promptEnabled": false,
					"template": "<p>He will heat up the water in the {{blank}}.</p>",
					"choiceMode": "text",
					"choices": [
						{
							"id": "distractor_1",
							"labelHtml": "<p>teapot</p>"
						},
						{
							"id": "distractor_2",
							"labelHtml": "<p>flytrap</p>"
						},
						{
							"id": "distractor_3",
							"labelHtml": "<p>coffee</p>"
						},
						{
							"id": "distractor_4",
							"labelHtml": "<p>freezer</p>"
						}
					],
					"correctChoiceId": "distractor_1",
					"hasAudio": false,
					"audioUrl": "",
					"audioTranscript": "",
					"interactionMode": "populate_blank",
					"sentenceHtml": "",
					"layoutProfile": "inline_sentence",
					"choiceLayout": "vertical",
					"locale": "",
					"autoplayAudioEnabled": false,
					"completeAudioEnabled": false,
					"source": {
						"csvQuestionTypeTag": "sr-vicv0.0.1",
						"learnosityItemReference": "00293f60-334f-48d0-b145-f7cb9f02a0fe",
						"learnosityQuestionReference": "a546c0a3-3d68-4d5c-994f-262e788f486c"
					}
				}
			]
		}
	}
};

export default demo;
