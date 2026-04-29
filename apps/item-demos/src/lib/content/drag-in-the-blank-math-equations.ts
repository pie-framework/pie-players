import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "drag-in-the-blank-math-equations",
	"name": "Mathematical Equations",
	"description": "Complete equations with mathematical expressions and symbols",
	"sourcePackage": "drag-in-the-blank",
	"sourceVariantId": "math-equations",
	"tags": [
		"math",
		"equations",
		"algebra"
	],
	"item": {
		"id": "drag-in-the-blank-math-equations",
		"name": "Mathematical Equations",
		"config": {
			"id": "",
			"markup": "<drag-in-the-blank id=\"2\"></drag-in-the-blank>",
			"elements": {
				"drag-in-the-blank": "@pie-element/drag-in-the-blank@latest"
			},
			"models": [
				{
					"id": "2",
					"element": "drag-in-the-blank",
					"prompt": "<p>Drag the correct mathematical expressions to complete each equation.</p>",
					"promptEnabled": true,
					"markup": "<div><p>1. Quadratic formula: \\(x = {{0}}\\)</p><p>2. Pythagorean theorem: \\(a^2 + b^2 = {{1}}\\)</p><p>3. Area of a circle: \\(A = {{2}}\\)</p></div>",
					"choices": [
						{
							"id": "0",
							"value": "\\(\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\)"
						},
						{
							"id": "1",
							"value": "\\(c^2\\)"
						},
						{
							"id": "2",
							"value": "\\(\\pi r^2\\)"
						},
						{
							"id": "3",
							"value": "\\(2\\pi r\\)"
						},
						{
							"id": "4",
							"value": "\\(a^2\\)"
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
					"rationale": "<p>These are fundamental formulas in mathematics. The quadratic formula solves equations of the form \\(ax^2 + bx + c = 0\\), the Pythagorean theorem relates the sides of a right triangle, and the circle area formula uses pi times the radius squared.</p>",
					"teacherInstructionsEnabled": false,
					"teacherInstructions": "",
					"toolbarEditorPosition": "bottom"
				}
			]
		}
	}
};

export default demo;
