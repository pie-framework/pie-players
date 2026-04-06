import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "multiple-choice-math-algebra-quadratic",
	"name": "Math: Quadratic Equation",
	"description": "Algebra question with LaTeX notation testing quadratic formula knowledge",
	"sourcePackage": "multiple-choice",
	"sourceVariantId": "math-algebra-quadratic",
	"tags": [
		"math",
		"algebra",
		"latex",
		"radio"
	],
	"item": {
		"id": "multiple-choice-math-algebra-quadratic",
		"name": "Math: Quadratic Equation",
		"config": {
			"id": "",
			"markup": "<multiple-choice id=\"5\"></multiple-choice>",
			"elements": {
				"multiple-choice": "@pie-element/multiple-choice@latest"
			},
			"models": [
				{
					"id": "5",
					"element": "multiple-choice",
					"choiceMode": "radio",
					"choicePrefix": "letters",
					"choices": [
						{
							"correct": false,
							"value": "opt1",
							"label": "\\(x = \\frac{-b \\pm \\sqrt{b^2+4ac}}{2a}\\)",
							"feedback": {
								"type": "default",
								"value": "Incorrect. The discriminant should be \\(b^2 - 4ac\\), not \\(b^2 + 4ac\\)."
							},
							"rationale": "The quadratic formula uses subtraction in the discriminant. The sign error would give incorrect solutions."
						},
						{
							"correct": true,
							"value": "opt2",
							"label": "\\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\)",
							"feedback": {
								"type": "default",
								"value": "Correct! This is the quadratic formula for solving equations of the form \\(ax^2 + bx + c = 0\\)."
							},
							"rationale": "The quadratic formula \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\) is derived by completing the square on the general quadratic equation. The discriminant \\(b^2-4ac\\) determines the nature and number of solutions."
						},
						{
							"correct": false,
							"value": "opt3",
							"label": "\\(x = \\frac{b \\pm \\sqrt{b^2-4ac}}{2a}\\)",
							"feedback": {
								"type": "default",
								"value": "Incorrect. The numerator should start with \\(-b\\), not \\(b\\)."
							},
							"rationale": "The sign of \\(b\\) is crucial. The formula must have \\(-b\\) in the numerator to correctly solve the equation."
						},
						{
							"correct": false,
							"value": "opt4",
							"label": "\\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{a}\\)",
							"feedback": {
								"type": "default",
								"value": "Incorrect. The denominator should be \\(2a\\), not just \\(a\\)."
							},
							"rationale": "The factor of 2 in the denominator comes from the process of completing the square. Without it, solutions would be doubled."
						}
					],
					"prompt": "<p><strong>Algebra Question:</strong> Which of the following is the correct quadratic formula for solving \\(ax^2 + bx + c = 0\\)?</p>",
					"promptEnabled": true,
					"toolbarEditorPosition": "bottom",
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
