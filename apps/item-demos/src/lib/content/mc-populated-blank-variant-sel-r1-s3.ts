import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "mc-populated-blank-variant-sel-r1-s3",
	"name": "sel_r1-s3_plusggg (canonical CQT sample)",
	"description": "Canonical sample from item 003dcbf8-ff38-4930-84ee-26ca8be834b9 and question 480b51c4-e8dd-4fed-8ddc-2e0667947326.",
	"sourcePackage": "@pie-element/mc-populated-blank",
	"sourceVariantId": "variant-sel-r1-s3",
	"tags": [
		"mc-populated-blank",
		"cqt-sample",
		"sel_r1-s3_plusggg",
		"sel_r1-s3_plusgggv0.0.1"
	],
	"item": {
		"id": "mc-populated-blank-variant-sel-r1-s3",
		"name": "sel_r1-s3_plusggg (canonical CQT sample)",
		"config": {
			"id": "",
			"markup": "<mc-populated-blank id=\"8\"></mc-populated-blank>",
			"elements": {
				"mc-populated-blank": "@pie-element/mc-populated-blank@latest"
			},
			"models": [
				{
					"id": "8",
					"element": "mc-populated-blank",
					"prompt": "",
					"promptEnabled": false,
					"template": "<p>{{blank}}</p>",
					"choiceMode": "text",
					"choices": [
						{
							"id": "distractor_1",
							"labelHtml": "<span style=\"font-size:1.8em;\">1 ten</span>"
						},
						{
							"id": "distractor_2",
							"labelHtml": "<span style=\"font-size:1.8em;\">2 tens</span>"
						},
						{
							"id": "distractor_3",
							"labelHtml": "<span style=\"font-size:1.8em;\">3 tens</span>"
						}
					],
					"correctChoiceId": "distractor_2",
					"hasAudio": true,
					"audioUrl": "https://assets.learnosity.com/organisations/844/eb26d640-8c6f-468d-a3bb-cbe4c70852d5.mp3",
					"audioTranscript": "Pick how many tens are in the number twenty.",
					"interactionMode": "populate_blank",
					"sentenceHtml": "<img alt=\"The picture shows groups of ten. The groups are\\n* 10, 10,\\n* The number 20 is below the groups. \" height=\"225\" src=\"https://assets.learnosity.com/organisations/844/863bd024-5883-40d7-a34c-178bedda8ccd.svg\" width=\"343\">",
					"layoutProfile": "stimulus_image_blank",
					"choiceLayout": "horizontal",
					"locale": "",
					"autoplayAudioEnabled": true,
					"completeAudioEnabled": true,
					"showVisibleTranscript": false,
					"source": {
						"csvQuestionTypeTag": "sel_r1-s3_plusgggv0.0.1",
						"learnosityItemReference": "003dcbf8-ff38-4930-84ee-26ca8be834b9",
						"learnosityQuestionReference": "480b51c4-e8dd-4fed-8ddc-2e0667947326"
					}
				}
			]
		}
	}
};

export default demo;
