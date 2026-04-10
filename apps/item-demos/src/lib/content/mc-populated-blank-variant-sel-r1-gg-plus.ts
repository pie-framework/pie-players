import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "mc-populated-blank-variant-sel-r1-gg-plus",
	"name": "sel_r1-gg_plusggg (canonical CQT sample)",
	"description": "Canonical sample from item 0d42ee84-b291-4336-b689-6912199fa81f and question a32aa886-0153-46a5-a31c-fdab5fd5165a.",
	"sourcePackage": "@pie-element/mc-populated-blank",
	"sourceVariantId": "variant-sel-r1-gg-plus",
	"tags": [
		"mc-populated-blank",
		"cqt-sample",
		"sel_r1-gg_plusggg",
		"sel_r1-gg_plusgggv0.0.1"
	],
	"item": {
		"id": "mc-populated-blank-variant-sel-r1-gg-plus",
		"name": "sel_r1-gg_plusggg (canonical CQT sample)",
		"config": {
			"id": "",
			"markup": "<mc-populated-blank id=\"6\"></mc-populated-blank>",
			"elements": {
				"mc-populated-blank": "@pie-element/mc-populated-blank@latest"
			},
			"models": [
				{
					"id": "6",
					"element": "mc-populated-blank",
					"prompt": "",
					"promptEnabled": false,
					"template": "<span style=\"font-size:3em;\">l</span> <span style=\"font-size:3em;\">m</span> {{blank}}",
					"choiceMode": "text",
					"choices": [
						{
							"id": "distractor_1",
							"labelHtml": "<span style=\"font-size:3em;\">n</span>"
						},
						{
							"id": "distractor_2",
							"labelHtml": "<span style=\"font-size:3em;\">k</span>"
						},
						{
							"id": "distractor_3",
							"labelHtml": "<span style=\"font-size:3em;\">ñ</span>"
						}
					],
					"correctChoiceId": "distractor_1",
					"hasAudio": true,
					"audioUrl": "https://assets.learnosity.com/organisations/844/2379303a-89a6-4c6d-bc5b-206f93672256.mp3",
					"audioTranscript": "Estas letras son l y m. Elige la letra que sigue en el alfabeto.",
					"interactionMode": "populate_blank",
					"sentenceHtml": "",
					"layoutProfile": "token_sequence",
					"choiceLayout": "horizontal",
					"locale": "es-US",
					"autoplayAudioEnabled": true,
					"completeAudioEnabled": true,
					"showVisibleTranscript": false,
					"source": {
						"csvQuestionTypeTag": "sel_r1-gg_plusgggv0.0.1",
						"learnosityItemReference": "0d42ee84-b291-4336-b689-6912199fa81f",
						"learnosityQuestionReference": "a32aa886-0153-46a5-a31c-fdab5fd5165a"
					}
				}
			]
		}
	}
};

export default demo;
