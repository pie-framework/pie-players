import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "mc-populated-blank-variant-sel-r1-plusggg",
	"name": "sel_r1-_plusggg (canonical CQT sample)",
	"description": "Canonical sample from item 000eb0e6-92a0-43cd-bb1f-89ddb52da2e5 and question 49d6bda1-4614-447d-8c2e-d4a317e13540.",
	"sourcePackage": "@pie-element/mc-populated-blank",
	"sourceVariantId": "variant-sel-r1-plusggg",
	"tags": [
		"mc-populated-blank",
		"cqt-sample",
		"sel_r1-_plusggg",
		"sel_r1-_plusgggv0.0.1"
	],
	"item": {
		"id": "mc-populated-blank-variant-sel-r1-plusggg",
		"name": "sel_r1-_plusggg (canonical CQT sample)",
		"config": {
			"id": "",
			"markup": "<mc-populated-blank id=\"1\"></mc-populated-blank>",
			"elements": {
				"mc-populated-blank": "@pie-element/mc-populated-blank@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "mc-populated-blank",
					"prompt": "",
					"promptEnabled": false,
					"template": "<p>{{blank}}</p>",
					"choiceMode": "text",
					"choices": [
						{
							"id": "distractor_1",
							"labelHtml": "<span style=\"font-size:1.8em;\">louk</span>"
						},
						{
							"id": "distractor_2",
							"labelHtml": "<span style=\"font-size:1.8em;\">lok</span>"
						},
						{
							"id": "distractor_3",
							"labelHtml": "<span style=\"font-size:1.8em;\">look</span>"
						}
					],
					"correctChoiceId": "distractor_3",
					"hasAudio": true,
					"audioUrl": "https://assets.learnosity.com/organisations/844/e134b07b-e827-4264-923f-3e3f1dac5d5a.mp3",
					"audioTranscript": "The word is look. Pick the correct spelling of the word look.",
					"interactionMode": "populate_blank",
					"sentenceHtml": "",
					"layoutProfile": "audio_blank_only",
					"choiceLayout": "horizontal",
					"locale": "",
					"autoplayAudioEnabled": true,
					"completeAudioEnabled": true,
					"showVisibleTranscript": false,
					"source": {
						"csvQuestionTypeTag": "sel_r1-_plusgggv0.0.1",
						"learnosityItemReference": "000eb0e6-92a0-43cd-bb1f-89ddb52da2e5",
						"learnosityQuestionReference": "49d6bda1-4614-447d-8c2e-d4a317e13540"
					}
				}
			]
		}
	}
};

export default demo;
