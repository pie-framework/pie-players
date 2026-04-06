import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "match-default",
	"name": "Match: Column 1 / Column 2",
	"description": "Basic match configuration",
	"sourcePackage": "match",
	"sourceVariantId": "default",
	"tags": [
		"match",
		"default"
	],
	"item": {
		"id": "match-default",
		"name": "Match: Column 1 / Column 2",
		"config": {
			"id": "",
			"markup": "<match-element id=\"1\"></match-element>",
			"elements": {
				"match-element": "@pie-element/match@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "match-element",
					"feedback": {
						"correct": {
							"type": "none",
							"default": "Correct"
						},
						"partial": {
							"type": "none",
							"default": "Nearly"
						},
						"incorrect": {
							"type": "none",
							"default": "Incorrect"
						}
					},
					"headers": [
						"Column 1",
						"Column 2",
						"Column 3"
					],
					"layout": 3,
					"lockChoiceOrder": true,
					"partialScoring": false,
					"choiceMode": "radio",
					"rows": [
						{
							"id": 1,
							"title": "Question Text 1",
							"values": [
								false,
								false
							]
						},
						{
							"id": 2,
							"title": "Question Text 2",
							"values": [
								false,
								false
							]
						},
						{
							"id": 3,
							"title": "Question Text 3",
							"values": [
								false,
								false
							]
						},
						{
							"id": 4,
							"title": "Question Text 4",
							"values": [
								false,
								false
							]
						}
					],
					"promptEnabled": true,
					"prompt": "Select correct answers.",
					"toolbarEditorPosition": "bottom",
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
