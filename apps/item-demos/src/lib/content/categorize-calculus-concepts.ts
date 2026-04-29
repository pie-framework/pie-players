import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "categorize-calculus-concepts",
	"name": "Calculus: Derivatives vs Integrals",
	"description": "Four-category grid with calculus formulas and multiple placements",
	"sourcePackage": "categorize",
	"sourceVariantId": "calculus-concepts",
	"tags": [
		"math",
		"calculus",
		"derivatives",
		"integrals",
		"grid"
	],
	"item": {
		"id": "categorize-calculus-concepts",
		"name": "Calculus: Derivatives vs Integrals",
		"config": {
			"id": "",
			"markup": "<categorize-element id=\"4\"></categorize-element>",
			"elements": {
				"categorize-element": "@pie-element/categorize@latest"
			},
			"models": [
				{
					"id": "4",
					"element": "categorize-element",
					"prompt": "<p>Categorize these calculus formulas by type. Some formulas can be used multiple times.</p>",
					"promptEnabled": true,
					"categories": [
						{
							"id": "0",
							"label": "<strong>Power Rule<br/>(Derivatives)</strong>"
						},
						{
							"id": "1",
							"label": "<strong>Power Rule<br/>(Integrals)</strong>"
						},
						{
							"id": "2",
							"label": "<strong>Trigonometric<br/>(Derivatives)</strong>"
						},
						{
							"id": "3",
							"label": "<strong>Trigonometric<br/>(Integrals)</strong>"
						}
					],
					"categoriesPerRow": 2,
					"choicesPosition": "below",
					"choicesLabel": "Calculus Formulas",
					"choices": [
						{
							"id": "0",
							"content": "\\(\\frac{d}{dx}[x^n] = nx^{n-1}\\)",
							"categoryCount": 0,
							"correctResponseCount": 1
						},
						{
							"id": "1",
							"content": "\\(\\int x^n dx = \\frac{x^{n+1}}{n+1} + C\\)",
							"categoryCount": 0,
							"correctResponseCount": 1
						},
						{
							"id": "2",
							"content": "\\(\\frac{d}{dx}[\\sin x] = \\cos x\\)",
							"categoryCount": 0,
							"correctResponseCount": 1
						},
						{
							"id": "3",
							"content": "\\(\\int \\cos x dx = \\sin x + C\\)",
							"categoryCount": 0,
							"correctResponseCount": 1
						},
						{
							"id": "4",
							"content": "\\(\\frac{d}{dx}[\\cos x] = -\\sin x\\)",
							"categoryCount": 0,
							"correctResponseCount": 1
						},
						{
							"id": "5",
							"content": "\\(\\int \\sin x dx = -\\cos x + C\\)",
							"categoryCount": 0,
							"correctResponseCount": 1
						}
					],
					"correctResponse": [
						{
							"category": "0",
							"choices": [
								"0"
							]
						},
						{
							"category": "1",
							"choices": [
								"1"
							]
						},
						{
							"category": "2",
							"choices": [
								"2",
								"4"
							]
						},
						{
							"category": "3",
							"choices": [
								"3",
								"5"
							]
						}
					],
					"lockChoiceOrder": true,
					"allowMultiplePlacementsEnabled": "Yes",
					"maxChoicesPerCategory": 0,
					"partialScoring": true,
					"minRowHeight": "110px",
					"fontSizeFactor": 1.1
				}
			]
		}
	}
};

export default demo;
