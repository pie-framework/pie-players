import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "mc-populated-blank-variant-sel-r1-ggplus",
	"name": "sel_r1-_ggplusggg (canonical CQT sample)",
	"description": "Canonical sample from item 0291a767-2334-4742-a899-e4178e85fc02 and question a469c1cf-fc1c-4cef-ae9f-04cc3f0cfc49.",
	"sourcePackage": "@pie-element/mc-populated-blank",
	"sourceVariantId": "variant-sel-r1-ggplus",
	"tags": [
		"mc-populated-blank",
		"cqt-sample",
		"sel_r1-_ggplusggg",
		"sel_r1-_ggplusgggv0.0.1"
	],
	"item": {
		"id": "mc-populated-blank-variant-sel-r1-ggplus",
		"name": "sel_r1-_ggplusggg (canonical CQT sample)",
		"config": {
			"id": "",
			"markup": "<mc-populated-blank id=\"7\"></mc-populated-blank>",
			"elements": {
				"mc-populated-blank": "@pie-element/mc-populated-blank@latest"
			},
			"models": [
				{
					"id": "7",
					"element": "mc-populated-blank",
					"prompt": "",
					"promptEnabled": false,
					"template": "{{blank}} <span style=\"font-size:3em;\">m</span> <span style=\"font-size:3em;\">n</span>",
					"choiceMode": "text",
					"choices": [
						{
							"id": "distractor_1",
							"labelHtml": "<span style=\"font-size:3em;\">o</span>"
						},
						{
							"id": "distractor_2",
							"labelHtml": "<span style=\"font-size:3em;\">k</span>"
						},
						{
							"id": "distractor_3",
							"labelHtml": "<span style=\"font-size:3em;\">l</span>"
						}
					],
					"correctChoiceId": "distractor_3",
					"hasAudio": true,
					"audioUrl": "https://assets.learnosity.com/organisations/844/bdceb0db-e8c7-4602-8b3d-d7594848f8a1.mp3",
					"audioTranscript": "These letters are m and n. Pick the letter that comes just before them in the alphabet.",
					"interactionMode": "populate_blank",
					"sentenceHtml": "",
					"layoutProfile": "token_sequence",
					"choiceLayout": "horizontal",
					"locale": "",
					"autoplayAudioEnabled": true,
					"completeAudioEnabled": true,
					"showVisibleTranscript": false,
					"source": {
						"csvQuestionTypeTag": "sel_r1-_ggplusgggv0.0.1",
						"learnosityItemReference": "0291a767-2334-4742-a899-e4178e85fc02",
						"learnosityQuestionReference": "a469c1cf-fc1c-4cef-ae9f-04cc3f0cfc49"
					}
				}
			]
		}
	}
};

export default demo;
