import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "graphing-solution-set-system-two-inequalities",
	"name": "System of Two Inequalities",
	"description": "Graph the solution set for y < x + 2 AND y ≥ -2x + 1",
	"sourcePackage": "graphing-solution-set",
	"sourceVariantId": "system-two-inequalities",
	"tags": [],
	"item": {
		"id": "graphing-solution-set-system-two-inequalities",
		"name": "System of Two Inequalities",
		"config": {
			"id": "",
			"markup": "<graphing-solution-set id=\"system-two-inequalities\"></graphing-solution-set>",
			"elements": {
				"graphing-solution-set": "@pie-element/graphing-solution-set@latest"
			},
			"models": [
				{
					"id": "system-two-inequalities",
					"element": "graphing-solution-set",
					"prompt": "Graph the solution set for the system of inequalities:<br/><math>y < x + 2</math><br/><math>y \\geq -2x + 1</math>",
					"promptEnabled": true,
					"title": "System of Two Linear Inequalities",
					"rationale": "The system requires two boundary lines: y = x + 2 (dashed, since y < x + 2) and y = -2x + 1 (solid, since y ≥ -2x + 1). The solution set is the region that satisfies both conditions - below the dashed line and above/on the solid line.",
					"rationaleEnabled": true,
					"teacherInstructions": "Students should draw Line A as a dashed line for y = x + 2, then draw Line B as a solid line for y = -2x + 1. The solution set is the intersection region bounded by both inequalities.",
					"teacherInstructionsEnabled": true,
					"answers": {
						"correctAnswer": {
							"name": "Correct Answer",
							"marks": [
								{
									"type": "line",
									"from": {
										"x": -10,
										"y": -8
									},
									"to": {
										"x": 10,
										"y": 12
									},
									"fill": "Dashed",
									"building": false
								},
								{
									"type": "line",
									"from": {
										"x": -10,
										"y": 21
									},
									"to": {
										"x": 10,
										"y": -19
									},
									"fill": "Solid",
									"building": false
								},
								{
									"type": "polygon",
									"points": [
										{
											"x": -3.667,
											"y": -1.667
										},
										{
											"x": -10,
											"y": -8
										},
										{
											"x": -10,
											"y": 21
										},
										{
											"x": 10,
											"y": -19
										},
										{
											"x": 10,
											"y": -10
										}
									],
									"building": false,
									"closed": true,
									"isSolution": true
								}
							]
						}
					},
					"gssLineData": {
						"numberOfLines": 2,
						"selectedTool": "solutionSet",
						"sections": [
							[
								{
									"x": -3.667,
									"y": -1.667
								},
								{
									"x": -10,
									"y": -8
								},
								{
									"x": -10,
									"y": 21
								},
								{
									"x": 10,
									"y": -19
								},
								{
									"x": 10,
									"y": -10
								}
							],
							[
								{
									"x": -3.667,
									"y": -1.667
								},
								{
									"x": -10,
									"y": -8
								},
								{
									"x": -10,
									"y": -10
								},
								{
									"x": 10,
									"y": -10
								},
								{
									"x": 10,
									"y": -19
								}
							],
							[
								{
									"x": -3.667,
									"y": -1.667
								},
								{
									"x": -10,
									"y": 21
								},
								{
									"x": -10,
									"y": 10
								},
								{
									"x": 10,
									"y": 10
								},
								{
									"x": 10,
									"y": 12
								}
							],
							[
								{
									"x": -3.667,
									"y": -1.667
								},
								{
									"x": -10,
									"y": -8
								},
								{
									"x": 10,
									"y": 12
								}
							]
						],
						"lineA": {
							"lineType": "Dashed"
						},
						"lineB": {
							"lineType": "Solid"
						}
					},
					"domain": {
						"min": -10,
						"max": 10,
						"step": 1,
						"labelStep": 1,
						"axisLabel": "x"
					},
					"range": {
						"min": -10,
						"max": 10,
						"step": 1,
						"labelStep": 1,
						"axisLabel": "y"
					},
					"graph": {
						"width": 480,
						"height": 480
					},
					"arrows": {
						"left": true,
						"right": true,
						"up": true,
						"down": true
					},
					"standardGrid": true,
					"padding": true,
					"coordinatesOnHover": true,
					"labels": {},
					"labelsEnabled": false
				}
			]
		}
	}
};

export default demo;
