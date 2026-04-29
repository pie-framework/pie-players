import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "categorize-math-equations",
	"name": "Math Equations Classification",
	"description": "Categorize equations as true or false with LaTeX math rendering",
	"sourcePackage": "categorize",
	"sourceVariantId": "math-equations",
	"tags": [
		"math",
		"equations",
		"true-false",
		"latex"
	],
	"item": {
		"id": "categorize-math-equations",
		"name": "Math Equations Classification",
		"config": {
			"id": "",
			"markup": "<categorize-element id=\"1\"></categorize-element>",
			"elements": {
				"categorize-element": "@pie-element/categorize@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "categorize-element",
					"prompt": "<p>Drag each equation to the correct category: True or False.</p>",
					"promptEnabled": true,
					"categories": [
						{
							"id": "0",
							"label": "<strong>True</strong>"
						},
						{
							"id": "1",
							"label": "<strong>False</strong>"
						}
					],
					"categoriesPerRow": 2,
					"choicesPosition": "above",
					"choicesLabel": "Equations",
					"choices": [
						{
							"id": "0",
							"content": "\\(6+3=9-2\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "1",
							"content": "\\(10-4=9-5\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "2",
							"content": "\\(17-9=9+17\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "3",
							"content": "\\(11+9=10+10\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "4",
							"content": "\\(14-4=5+5\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "5",
							"content": "\\(7+8=3\\times 5\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						}
					],
					"correctResponse": [
						{
							"category": "0",
							"choices": [
								"3",
								"4",
								"5"
							]
						},
						{
							"category": "1",
							"choices": [
								"0",
								"1",
								"2"
							]
						}
					],
					"lockChoiceOrder": true,
					"maxChoicesPerCategory": 0,
					"partialScoring": true,
					"minRowHeight": "120px",
					"fontSizeFactor": 1.2
				}
			]
		}
	}
};

export default demo;
