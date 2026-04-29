import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "categorize-geometry-shapes",
	"name": "Geometric Shapes by Dimensions",
	"description": "Sort shapes with math formulas into 2D and 3D categories",
	"sourcePackage": "categorize",
	"sourceVariantId": "geometry-shapes",
	"tags": [
		"math",
		"geometry",
		"shapes",
		"2d",
		"3d"
	],
	"item": {
		"id": "categorize-geometry-shapes",
		"name": "Geometric Shapes by Dimensions",
		"config": {
			"id": "",
			"markup": "<categorize-element id=\"2\"></categorize-element>",
			"elements": {
				"categorize-element": "@pie-element/categorize@latest"
			},
			"models": [
				{
					"id": "2",
					"element": "categorize-element",
					"prompt": "<p>Classify each shape as 2D (two-dimensional) or 3D (three-dimensional) based on their formulas.</p>",
					"promptEnabled": true,
					"categories": [
						{
							"id": "0",
							"label": "<div style=\"text-align:center;\"><strong>2D Shapes</strong><br/><small>Area formulas</small></div>"
						},
						{
							"id": "1",
							"label": "<div style=\"text-align:center;\"><strong>3D Shapes</strong><br/><small>Volume formulas</small></div>"
						}
					],
					"categoriesPerRow": 2,
					"choicesPosition": "below",
					"choicesLabel": "Shape Formulas",
					"choices": [
						{
							"id": "0",
							"content": "Circle: \\(A = \\pi r^2\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "1",
							"content": "Sphere: \\(V = \\frac{4}{3}\\pi r^3\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "2",
							"content": "Rectangle: \\(A = l \\times w\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "3",
							"content": "Cylinder: \\(V = \\pi r^2 h\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "4",
							"content": "Triangle: \\(A = \\frac{1}{2}bh\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						},
						{
							"id": "5",
							"content": "Cube: \\(V = s^3\\)",
							"categoryCount": 1,
							"correctResponseCount": 1
						}
					],
					"correctResponse": [
						{
							"category": "0",
							"choices": [
								"0",
								"2",
								"4"
							]
						},
						{
							"category": "1",
							"choices": [
								"1",
								"3",
								"5"
							]
						}
					],
					"lockChoiceOrder": false,
					"maxChoicesPerCategory": 0,
					"partialScoring": true,
					"minRowHeight": "140px",
					"fontSizeFactor": 1.1
				}
			]
		}
	}
};

export default demo;
