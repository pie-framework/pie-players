import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "graphing-solution-set-inequality-dashed-line",
	"name": "Linear Inequality - Greater Than (Dashed Line)",
	"description": "Graph the solution set for y > 2x - 3",
	"sourcePackage": "graphing-solution-set",
	"sourceVariantId": "inequality-dashed-line",
	"tags": [],
	"item": {
		"id": "graphing-solution-set-inequality-dashed-line",
		"name": "Linear Inequality - Greater Than (Dashed Line)",
		"config": {
			"id": "",
			"markup": "<graphing-solution-set id=\"inequality-dashed-line\"></graphing-solution-set>",
			"elements": {
				"graphing-solution-set": "@pie-element/graphing-solution-set@latest"
			},
			"models": [
				{
					"id": "inequality-dashed-line",
					"element": "graphing-solution-set",
					"prompt": "Graph the solution set for the inequality: <math>y > 2x - 3</math>",
					"promptEnabled": true,
					"title": "Linear Inequality with Dashed Boundary",
					"rationale": "The inequality y > 2x - 3 requires a dashed line (since it's > not ≥) at y = 2x - 3, with the region above the line shaded as the solution set.",
					"rationaleEnabled": true,
					"teacherInstructions": "Students should draw a dashed line through points like (-1, -5) and (2, 1), then select the region above the line as the solution set.",
					"teacherInstructionsEnabled": true,
					"answers": {
						"correctAnswer": {
							"name": "Correct Answer",
							"marks": [
								{
									"type": "line",
									"from": {
										"x": -10,
										"y": -23
									},
									"to": {
										"x": 10,
										"y": 17
									},
									"fill": "Dashed",
									"building": false
								},
								{
									"type": "polygon",
									"points": [
										{
											"x": -10,
											"y": -23
										},
										{
											"x": 10,
											"y": 17
										},
										{
											"x": 10,
											"y": 10
										},
										{
											"x": -10,
											"y": 10
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
						"numberOfLines": 1,
						"selectedTool": "lineA",
						"sections": [
							[
								{
									"x": -10,
									"y": -23
								},
								{
									"x": 10,
									"y": 17
								},
								{
									"x": 10,
									"y": 10
								},
								{
									"x": -10,
									"y": 10
								}
							],
							[
								{
									"x": -10,
									"y": -23
								},
								{
									"x": 10,
									"y": 17
								},
								{
									"x": 10,
									"y": -10
								},
								{
									"x": -10,
									"y": -10
								}
							]
						],
						"lineA": {
							"lineType": "Dashed"
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
