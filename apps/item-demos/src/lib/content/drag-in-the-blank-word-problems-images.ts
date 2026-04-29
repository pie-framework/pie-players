import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "drag-in-the-blank-word-problems-images",
	"name": "Word Problems with Arrays",
	"description": "Match word problems to visual array representations",
	"sourcePackage": "drag-in-the-blank",
	"sourceVariantId": "word-problems-images",
	"tags": [
		"images",
		"arrays",
		"word-problems",
		"multiplication"
	],
	"item": {
		"id": "drag-in-the-blank-word-problems-images",
		"name": "Word Problems with Arrays",
		"config": {
			"id": "",
			"markup": "<drag-in-the-blank id=\"3\"></drag-in-the-blank>",
			"elements": {
				"drag-in-the-blank": "@pie-element/drag-in-the-blank@latest"
			},
			"models": [
				{
					"id": "3",
					"element": "drag-in-the-blank",
					"prompt": "<p>Drag and drop the correct array into the box next to the matching word problem.</p>",
					"promptEnabled": true,
					"markup": "<table class=\"table table-bordered table-striped\"><tbody><tr><td class=\"text-center\"><strong>Word Problem</strong></td><td class=\"text-center\"><strong>Array</strong></td></tr><tr><td><p>Jamie is buying color pencils for an art project. There are 8 colored pencils in each pack. She buys 3 packs of colored pencils. How many colored pencils did she buy for her art project?</p></td><td><p>{{0}}</p></td></tr><tr><td><p>Mark has 36 jelly beans to split between 9 friends. How many jelly beans will each friend get?</p></td><td><p>{{1}}</p></td></tr><tr><td><p>Mr. Smith drinks 5 bottles of water each day. If there are 7 days in a week, how many bottles of water does Mr. Smith drink in 1 week?</p></td><td><p>{{2}}</p></td></tr></tbody></table>",
					"choices": [
						{
							"id": "0",
							"value": "<img alt=\"3x8 array\" src=\"https://app.fluence.net/ia/image/3099cb73d5fe400b91b72f2606d1211c\" />"
						},
						{
							"id": "1",
							"value": "<img alt=\"36÷9 array\" src=\"https://app.fluence.net/ia/image/cc6e862dad4749d4a1ae6540ea775179\" />"
						},
						{
							"id": "2",
							"value": "<img alt=\"5x7 array\" src=\"https://app.fluence.net/ia/image/ab3e342a466941a1a608f65eb7ec1c68\" />"
						}
					],
					"correctResponse": {
						"0": "0",
						"1": "1",
						"2": "2"
					},
					"choicesPosition": "below",
					"duplicates": false,
					"lockChoiceOrder": false,
					"partialScoring": true,
					"rationaleEnabled": true,
					"rationale": "<p>Match each word problem to its corresponding visual array representation to solve multiplication and division problems.</p>",
					"teacherInstructionsEnabled": false,
					"teacherInstructions": "",
					"toolbarEditorPosition": "bottom"
				}
			]
		}
	}
};

export default demo;
