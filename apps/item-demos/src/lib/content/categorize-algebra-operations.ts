import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "categorize-algebra-operations",
	"name": "Algebraic Operations",
	"description": "Categorize expressions by operation type (add/subtract, multiply/divide, exponents)",
	"sourcePackage": "categorize",
	"sourceVariantId": "algebra-operations",
	"tags": ["math", "algebra", "operations", "advanced"],
	"item": {
		"id": "categorize-algebra-operations",
		"name": "Algebraic Operations",
		"config": {
			"id": "",
			"markup": "<categorize-element id=\"3\"></categorize-element>",
			"elements": {
				"categorize-element": "@pie-element/categorize@latest"
			},
			"models": [
				{
					"id": "3",
					"element": "categorize-element",
					"prompt": "<p>Sort these algebraic expressions by their primary operation.</p>",
					"promptEnabled": true,
					"categories": [
						{
							"id": "0",
							"label": "<strong>Addition/Subtraction</strong>"
						},
						{
							"id": "1",
							"label": "<strong>Multiplication/Division</strong>"
						},
						{
							"id": "2",
							"label": "<strong>Exponents</strong>"
						}
					],
					"categoriesPerRow": 3,
					"choicesPosition": "above",
					"choicesLabel": "",
					"choices": [
						{
							"id": "0",
							"content": "\\(2x + 5\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "1",
							"content": "\\(3x^2\\)",
							"categoryCount": 1,
							"correctResponseCount": 2
						},
						{
							"id": "2",
							"content": "\\(\\frac{x}{4}\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "3",
							"content": "\\(x^3 + 1\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "4",
							"content": "\\((x+2)(x-1)\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						}
					],
					"correctResponse": [
						{
							"category": "0",
							"choices": ["0"]
						},
						{
							"category": "1",
							"choices": ["2", "4"]
						},
						{
							"category": "2",
							"choices": ["1", "3"]
						}
					],
					"lockChoiceOrder": true,
					"maxChoicesPerCategory": 0,
					"partialScoring": false,
					"minRowHeight": "100px",
					"fontSizeFactor": 1.15
				}
			]
		}
	}
};

export default demo;
