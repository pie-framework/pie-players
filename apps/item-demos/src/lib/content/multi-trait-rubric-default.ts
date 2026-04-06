import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "multi-trait-rubric-default",
	"name": "Multi Trait Rubric: Ideas",
	"description": "Basic multi-trait rubric configuration",
	"sourcePackage": "multi-trait-rubric",
	"sourceVariantId": "default",
	"tags": [
		"multi-trait-rubric",
		"default"
	],
	"item": {
		"id": "multi-trait-rubric-default",
		"name": "Multi Trait Rubric: Ideas",
		"config": {
			"id": "",
			"markup": "<multi-trait-rubric id=\"1\"></multi-trait-rubric>",
			"elements": {
				"multi-trait-rubric": "@pie-element/multi-trait-rubric@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "multi-trait-rubric",
					"visibleToStudent": true,
					"halfScoring": false,
					"pointLabels": true,
					"description": false,
					"standards": false,
					"scales": [
						{
							"maxPoints": 4,
							"scorePointsLabels": [
								"<div>Non-Scorable</div>",
								"<div>Developing</div>",
								"<div>Progressing</div>",
								"<div>Effective</div>"
							],
							"traitLabel": "Trait",
							"traits": [
								{
									"name": "<div>Ideas</div>",
									"standards": [],
									"description": "the main message",
									"scorePointsDescriptors": [
										"<div>Student's response is blank, not in English, not legible, or does not respond to the prompt.</div>",
										"<div>Topic undefined and/or difficult to followDetails are unclear</div>",
										"<div>Topic too broadDetails are limited</div>",
										"<div>Writing stays on topicComplete details given</div>"
									]
								},
								{
									"name": "<div>Organization</div>",
									"standards": [],
									"description": "the internal structure of the piece",
									"scorePointsDescriptors": [
										"<div>Student's response is blank, not in English, not legible, or does not respond to the prompt.</div>",
										"<div>Does not have a beginning, middle and/or endDoes not have a lead and/or conclusionTransitions confusing and/or not presentNot written in logical orderNo sign of paragraphing / incorrect paragraphing</div>",
										"<div>Weak beginning, middle and endHas evidence of a lead and/or conclusion but missing elementsTransitions are used sometimesSome logical orderMost paragraphing incorrect</div>",
										"<div>Has an acceptable beginning, middle and endIncludes a lead and conclusionTransitions are used correctlyMostly logical orderMostly correct paragraphing</div>"
									]
								}
							]
						}
					],
					"excludeZero": true,
					"maxPointsEnabled": true,
					"addScaleEnabled": true
				}
			]
		}
	}
};

export default demo;
