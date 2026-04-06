import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "multiple-choice-math-geometry-triangles",
	"name": "Math: Triangle Properties",
	"description": "Geometry question with LaTeX testing understanding of triangle theorems",
	"sourcePackage": "multiple-choice",
	"sourceVariantId": "math-geometry-triangles",
	"tags": [
		"math",
		"geometry",
		"latex",
		"checkbox"
	],
	"item": {
		"id": "multiple-choice-math-geometry-triangles",
		"name": "Math: Triangle Properties",
		"config": {
			"id": "",
			"markup": "<multiple-choice id=\"6\"></multiple-choice>",
			"elements": {
				"multiple-choice": "@pie-element/multiple-choice@latest"
			},
			"models": [
				{
					"id": "6",
					"element": "multiple-choice",
					"choiceMode": "checkbox",
					"choicePrefix": "letters",
					"choices": [
						{
							"correct": true,
							"value": "stmt1",
							"label": "For a right triangle with legs \\(a\\) and \\(b\\) and hypotenuse \\(c\\): \\(a^2 + b^2 = c^2\\)",
							"feedback": {
								"type": "default",
								"value": "Correct! This is the Pythagorean theorem."
							},
							"rationale": "The Pythagorean theorem states that in a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides. This is one of the most fundamental theorems in geometry."
						},
						{
							"correct": false,
							"value": "stmt2",
							"label": "The sum of angles in any triangle is \\(360^\\circ\\)",
							"feedback": {
								"type": "default",
								"value": "Incorrect. The sum of angles in a triangle is \\(180^\\circ\\), not \\(360^\\circ\\)."
							},
							"rationale": "The sum of interior angles in any triangle is always \\(180^\\circ\\). The value \\(360^\\circ\\) applies to quadrilaterals, not triangles."
						},
						{
							"correct": true,
							"value": "stmt3",
							"label": "The area of a triangle is \\(A = \\frac{1}{2}bh\\) where \\(b\\) is the base and \\(h\\) is the height",
							"feedback": {
								"type": "default",
								"value": "Correct! This is the standard formula for triangle area."
							},
							"rationale": "The area of any triangle can be calculated using \\(A = \\frac{1}{2}bh\\). This formula works because a triangle is half of a parallelogram with the same base and height."
						},
						{
							"correct": false,
							"value": "stmt4",
							"label": "In an equilateral triangle with side length \\(s\\), the area is \\(A = s^2\\)",
							"feedback": {
								"type": "default",
								"value": "Incorrect. The area formula for an equilateral triangle is \\(A = \\frac{\\sqrt{3}}{4}s^2\\)."
							},
							"rationale": "The correct formula for an equilateral triangle is \\(A = \\frac{\\sqrt{3}}{4}s^2\\). The formula \\(A = s^2\\) would give the area of a square, not a triangle."
						},
						{
							"correct": true,
							"value": "stmt5",
							"label": "For any triangle with sides \\(a\\), \\(b\\), and \\(c\\): the triangle inequality theorem states \\(a + b > c\\)",
							"feedback": {
								"type": "default",
								"value": "Correct! This is the triangle inequality theorem."
							},
							"rationale": "The triangle inequality theorem states that the sum of any two sides of a triangle must be greater than the third side. This must be true for all three combinations of sides: \\(a+b>c\\), \\(b+c>a\\), and \\(a+c>b\\)."
						}
					],
					"prompt": "<p><strong>Geometry Question:</strong> Select all true statements about triangles and their properties.</p>",
					"promptEnabled": true,
					"toolbarEditorPosition": "bottom",
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
