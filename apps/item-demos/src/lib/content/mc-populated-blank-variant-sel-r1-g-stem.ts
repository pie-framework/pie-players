import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "mc-populated-blank-variant-sel-r1-g-stem",
	"name": "sel_r1-g_plusggg (canonical CQT sample)",
	"description": "Canonical sample from item 0060b039-2605-47a6-8305-96e0463fcfd0 and question b78bf2ff-8d6e-4a6f-a0c9-9e188020b50e.",
	"sourcePackage": "@pie-element/mc-populated-blank",
	"sourceVariantId": "variant-sel-r1-g-stem",
	"tags": [
		"mc-populated-blank",
		"cqt-sample",
		"sel_r1-g_plusggg",
		"sel_r1-g_plusgggv0.0.1"
	],
	"item": {
		"id": "mc-populated-blank-variant-sel-r1-g-stem",
		"name": "sel_r1-g_plusggg (canonical CQT sample)",
		"config": {
			"id": "",
			"markup": "<mc-populated-blank id=\"5\"></mc-populated-blank>",
			"elements": {
				"mc-populated-blank": "@pie-element/mc-populated-blank@latest"
			},
			"models": [
				{
					"id": "5",
					"element": "mc-populated-blank",
					"prompt": "",
					"promptEnabled": false,
					"template": "<span style=\"font-size:1.8em;\">will</span> {{blank}}",
					"choiceMode": "text",
					"choices": [
						{
							"id": "distractor_1",
							"labelHtml": "<span style=\"font-size:1.8em;\">fill</span>"
						},
						{
							"id": "distractor_2",
							"labelHtml": "<span style=\"font-size:1.8em;\">mill</span>"
						},
						{
							"id": "distractor_3",
							"labelHtml": "<span style=\"font-size:1.8em;\">tall</span>"
						}
					],
					"correctChoiceId": "distractor_3",
					"hasAudio": true,
					"audioUrl": "https://assets.learnosity.com/organisations/844/bb2fe332-1693-4794-813f-5d7e8e7a7d96.mp3",
					"audioTranscript": "Look at the word. Pick the word that does not rhyme.",
					"interactionMode": "populate_blank",
					"sentenceHtml": "",
					"layoutProfile": "token_sequence",
					"choiceLayout": "horizontal",
					"locale": "",
					"autoplayAudioEnabled": true,
					"completeAudioEnabled": true,
					"showVisibleTranscript": false,
					"source": {
						"csvQuestionTypeTag": "sel_r1-g_plusgggv0.0.1",
						"learnosityItemReference": "0060b039-2605-47a6-8305-96e0463fcfd0",
						"learnosityQuestionReference": "b78bf2ff-8d6e-4a6f-a0c9-9e188020b50e"
					}
				}
			]
		}
	}
};

export default demo;
