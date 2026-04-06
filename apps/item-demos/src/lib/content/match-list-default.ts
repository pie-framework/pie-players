import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "match-list-default",
	"name": "Match each year to the corresponding historical event",
	"description": "Basic match list configuration",
	"sourcePackage": "match-list",
	"sourceVariantId": "default",
	"tags": [
		"match-list",
		"default"
	],
	"item": {
		"id": "match-list-default",
		"name": "Match each year to the corresponding historical event",
		"config": {
			"id": "",
			"markup": "<match-list id=\"1\"></match-list>",
			"elements": {
				"match-list": "@pie-element/match-list@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "match-list",
					"lockChoiceOrder": true,
					"answers": [
						{
							"id": 2,
							"title": "Battle of Lexington and Concord"
						},
						{
							"id": 3,
							"title": "Declaration of Independence"
						},
						{
							"id": 1,
							"title": "Boston Tea Party"
						},
						{
							"id": 0,
							"title": "French and Indian War"
						},
						{
							"id": 4,
							"title": "Constitutional Convention"
						}
					],
					"prompt": "<p>Match each year to the corresponding historical event. Drag and drop the events.</p>",
					"prompts": [
						{
							"id": 1,
							"title": "1754",
							"relatedAnswer": 0
						},
						{
							"id": 2,
							"title": "1773",
							"relatedAnswer": 1
						},
						{
							"id": 3,
							"title": "1775",
							"relatedAnswer": 2
						},
						{
							"id": 4,
							"title": "1776",
							"relatedAnswer": 3
						},
						{
							"id": 5,
							"title": "1787",
							"relatedAnswer": 4
						}
					]
				}
			]
		}
	}
};

export default demo;
