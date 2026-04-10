import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "mc-populated-blank-variant-sel-vic",
	"name": "SEL VIC (canonical CQT sample)",
	"description": "Canonical sample from item 04973d1a-0557-4963-937d-7ac76ee3baeb and question 11e9862e-cab1-415e-87a3-0f32fedcedfc.",
	"sourcePackage": "@pie-element/mc-populated-blank",
	"sourceVariantId": "variant-sel-vic",
	"tags": [
		"mc-populated-blank",
		"cqt-sample",
		"SEL VIC",
		"sel_vic",
		"sel_vicv0.0.1"
	],
	"item": {
		"id": "mc-populated-blank-variant-sel-vic",
		"name": "SEL VIC (canonical CQT sample)",
		"config": {
			"id": "",
			"markup": "<mc-populated-blank id=\"3\"></mc-populated-blank>",
			"elements": {
				"mc-populated-blank": "@pie-element/mc-populated-blank@latest"
			},
			"models": [
				{
					"id": "3",
					"element": "mc-populated-blank",
					"prompt": "",
					"promptEnabled": false,
					"template": "<p>Bill will have to {{blank}} fast to get the ball.</p>",
					"choiceMode": "text",
					"choices": [
						{
							"id": "distractor_1",
							"labelHtml": "<p>run</p>"
						},
						{
							"id": "distractor_2",
							"labelHtml": "<p>do</p>"
						},
						{
							"id": "distractor_3",
							"labelHtml": "<p>toy</p>"
						}
					],
					"correctChoiceId": "distractor_1",
					"hasAudio": true,
					"audioUrl": "https://assets.learnosity.com/organisations/844/af9f6179-fca4-4e5a-9b7f-8fb5374a23e5.mp3",
					"audioTranscript": "Read the sentence. Then pick the word that best completes the sentence.",
					"interactionMode": "populate_blank",
					"sentenceHtml": "",
					"layoutProfile": "inline_sentence",
					"choiceLayout": "vertical",
					"locale": "",
					"autoplayAudioEnabled": true,
					"completeAudioEnabled": true,
					"showVisibleTranscript": true,
					"source": {
						"csvQuestionTypeTag": "sel_vicv0.0.1",
						"learnosityItemReference": "04973d1a-0557-4963-937d-7ac76ee3baeb",
						"learnosityQuestionReference": "11e9862e-cab1-415e-87a3-0f32fedcedfc"
					}
				}
			]
		}
	}
};

export default demo;
