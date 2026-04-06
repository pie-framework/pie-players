import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "select-text-default",
	"name": "What sentences contain the character 6 in them?",
	"description": "Basic select text configuration",
	"sourcePackage": "select-text",
	"sourceVariantId": "default",
	"tags": [
		"select-text",
		"default"
	],
	"item": {
		"id": "select-text-default",
		"name": "What sentences contain the character 6 in them?",
		"config": {
			"id": "",
			"markup": "<select-text id=\"1\"></select-text>",
			"elements": {
				"select-text": "@pie-element/select-text@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "select-text",
					"highlightChoices": false,
					"feedback": {
						"correct": {
							"type": "default",
							"default": "Correct"
						},
						"incorrect": {
							"type": "default",
							"default": "Incorrect"
						},
						"partial": {
							"type": "default",
							"default": "Nearly"
						}
					},
					"partialScoring": false,
					"maxSelections": 2,
					"mode": "sentence",
					"rationale": "Rationale goes here.",
					"prompt": "What sentences contain the character 6 in them?",
					"promptEnabled": true,
					"toolbarEditorPosition": "bottom",
					"text": "<p>If 'tweren't for sight and sound and smell,<br />\nI'd like the city pretty well,<br />\nBut when it comes to getting rest,<br />\nI like the country lots the best.</p>\n\n<p>Sometimes it seems to me I must<br />\nJust quit the city's din and dust,<br />\nAnd get out where the sky is blue,<br />\nAnd say, now, how does it seem to you?</p>",
					"tokens": [
						{
							"text": "If 'tweren't for sight and sound and smell,",
							"start": 0,
							"end": 43
						},
						{
							"text": "I'd like the city pretty well,",
							"start": 44,
							"end": 74
						},
						{
							"text": "But when it comes to getting rest,",
							"start": 75,
							"end": 109
						},
						{
							"text": "I like the country lots the best.",
							"start": 110,
							"end": 143
						},
						{
							"text": "Sometimes it seems to me I must",
							"start": 145,
							"end": 176
						},
						{
							"text": "Just quit the city's din and dust,",
							"start": 177,
							"end": 211
						},
						{
							"text": "And get out where the sky is blue,",
							"start": 212,
							"end": 246
						},
						{
							"text": "And say, now, how does it seem to you?",
							"start": 247,
							"end": 285
						}
					],
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
