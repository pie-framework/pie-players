import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "mc-populated-blank-variant-sel-r1-gplusggg",
	"name": "sel_r1-_gplusggg (canonical CQT sample)",
	"description": "Canonical sample from item 0e7c3f32-9dfe-40d7-bbc4-0a6eea0e7874 and question a2837d4f-cdd0-4285-8352-a10a96e6564d.",
	"sourcePackage": "@pie-element/mc-populated-blank",
	"sourceVariantId": "variant-sel-r1-gplusggg",
	"tags": [
		"mc-populated-blank",
		"cqt-sample",
		"sel_r1-_gplusggg",
		"sel_r1-_gplusgggv0.0.1"
	],
	"item": {
		"id": "mc-populated-blank-variant-sel-r1-gplusggg",
		"name": "sel_r1-_gplusggg (canonical CQT sample)",
		"config": {
			"id": "",
			"markup": "<mc-populated-blank id=\"4\"></mc-populated-blank>",
			"elements": {
				"mc-populated-blank": "@pie-element/mc-populated-blank@latest"
			},
			"models": [
				{
					"id": "4",
					"element": "mc-populated-blank",
					"prompt": "",
					"promptEnabled": false,
					"template": "<p>{{blank}}</p>",
					"choiceMode": "text",
					"choices": [
						{
							"id": "distractor_1",
							"labelHtml": "<span style=\"font-size:1.8em;\">jump</span>"
						},
						{
							"id": "distractor_2",
							"labelHtml": "<span style=\"font-size:1.8em;\">fast</span>"
						},
						{
							"id": "distractor_3",
							"labelHtml": "<span style=\"font-size:1.8em;\">just</span>"
						}
					],
					"correctChoiceId": "distractor_3",
					"hasAudio": true,
					"audioUrl": "https://assets.learnosity.com/organisations/844/d6a4947a-8e99-41b1-a14e-103af719e3dd.mp3",
					"audioTranscript": "Look at the words. Pick the word \"just\" . . . \"just.\"",
					"interactionMode": "populate_blank",
					"sentenceHtml": "",
					"layoutProfile": "audio_blank_only",
					"choiceLayout": "horizontal",
					"locale": "",
					"autoplayAudioEnabled": true,
					"completeAudioEnabled": true,
					"showVisibleTranscript": false,
					"source": {
						"csvQuestionTypeTag": "sel_r1-_gplusgggv0.0.1",
						"learnosityItemReference": "0e7c3f32-9dfe-40d7-bbc4-0a6eea0e7874",
						"learnosityQuestionReference": "a2837d4f-cdd0-4285-8352-a10a96e6564d"
					}
				}
			]
		}
	}
};

export default demo;
