import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "complex-rubric-1",
	"name": "Complex Rubric: Simple Rubric",
	"description": "Complex Rubric demo",
	"sourcePackage": "complex-rubric",
	"sourceVariantId": "1",
	"tags": [],
	"item": {
		"id": "complex-rubric-1",
		"name": "Complex Rubric: Simple Rubric",
		"config": {
			"id": "",
			"markup": "<complex-rubric id=\"1\"></complex-rubric>",
			"elements": {
				"complex-rubric": "@pie-element/complex-rubric@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "complex-rubric",
					"rubricType": "simpleRubric",
					"rubrics": {
						"simpleRubric": {
							"points": [
								"nothing right",
								"a teeny bit right",
								"mostly right",
								"bingo"
							],
							"sampleAnswers": [
								null,
								"just right",
								"not left",
								null
							],
							"maxPoints": 3,
							"excludeZero": false
						},
						"rubricless": {
							"maxPoints": 100,
							"excludeZero": false,
							"rubriclessInstructionEnabled": true
						},
						"multiTraitRubric": {
							"visibleToStudent": true,
							"halfScoring": false,
							"excludeZero": true,
							"pointLabels": true,
							"description": false,
							"standards": false,
							"scales": [
								{
									"maxPoints": 4,
									"scorePointsLabels": [
										"Non-Scorable",
										"Developing",
										"Progressing",
										"Effective",
										"Strong"
									],
									"traitLabel": "Trait",
									"traits": [
										{
											"name": "Ideas",
											"standards": [],
											"description": "the main message",
											"scorePointsDescriptors": [
												"Student’s response is blank, not in English, not legible, or does not respond to the prompt.",
												"Topic undefined and/or difficult to follow\n\nDetails are unclear",
												"Topic too broad\n\nDetails are limited",
												"Writing stays on topic\n\nComplete details given",
												"Strong control of topic\n\nRelevant, accurate, specific details that support topic"
											]
										},
										{
											"name": "Organization",
											"standards": [],
											"description": "the internal structure of the piece",
											"scorePointsDescriptors": [
												"Student’s response is blank, not in English, not legible, or does not respond to the prompt.",
												"Does not have a beginning, middle and/or end\n\nDoes not have a lead and/or conclusion\n\nTransitions confusing and/or not present\n\nNot written in logical order\n\nNo sign of paragraphing / incorrect paragraphing",
												"Weak beginning, middle and end\n\nHas evidence of a lead and/or conclusion but missing elements\n\nTransitions are used sometimes\n\nSome logical order\n\nMost paragraphing incorrect",
												"Has an acceptable beginning, middle and end\n\nIncludes a lead and conclusion\n\nTransitions are used correctly\n\nMostly logical order\n\nMostly correct paragraphing",
												"Has an effective beginning, middle and end\n\nPowerful introduction / lead and conclusion\n\nEffective transitions\n\nLogical order / sequencing\n\nUses appropriate paragraphing"
											]
										},
										{
											"name": "Word Choice",
											"standards": [],
											"description": "the vocabulary a writer chooses to convey meaning",
											"scorePointsDescriptors": [
												"Student’s response is blank, not in English, not legible, or does not respond to the prompt.",
												"Vocabulary is limited/used incorrectly\n\nNo figurative language; words do not convey meaning",
												"Generally correct words\n\nAttempt at figurative language\n\nand/or words convey general meaning",
												"Some active verbs and precise nouns\n\nEffective use of figurative language and/or words that enhance meaning",
												"Powerful and engaging words\n\nArtful use of figurative language and/or sensory detail"
											]
										},
										{
											"name": "Sentence Fluency",
											"standards": [],
											"description": "the rhythm and flow of the language",
											"scorePointsDescriptors": [
												"Student’s response is blank, not in English, not legible, or does not respond to the prompt.",
												"No sentences are clear\n\nNo variety in sentence structure\n\nFrequent run-ons and/or fragments are present",
												"Some sentences are clear\n\nSentence variety used rarely\n\nSome run-ons and/or fragments are present",
												"Most sentences are clear\n\nSome sentence variety is used\n\nRun-ons and/or fragments are rare",
												"All Sentences are clear\n\nVariety of sentence structure is used\n\nRun-ons and/or fragments are not present"
											]
										},
										{
											"name": "Conventions",
											"standards": [],
											"description": "the mechanical correctness",
											"scorePointsDescriptors": [
												"Student’s response is blank, not in English, not legible, or does not respond to the prompt.",
												"Many distracting errors are present in grammar, punctuation, capitalization and/or spelling",
												"Errors in grammar, punctuation, capitalization and/or spelling are present and some distract from meaning",
												"Errors in grammar, punctuation, capitalization and/or spelling are present but don’t distract from meaning",
												"Few errors in grammar, punctuation,\n\ncapitalization and/or spelling"
											]
										},
										{
											"name": "Voice",
											"standards": [],
											"description": "the personal tone and flavor of the author's message",
											"scorePointsDescriptors": [
												"Student’s response is blank, not in English, not legible, or does not respond to the prompt.",
												"Not concerned with audience or purpose\n\nNo viewpoint (perspective) used\n\nWriting is mechanical and lifeless",
												"Shows beginning awareness of audience/purpose\n\nSome viewpoint (perspective) used throughout the piece\n\nWriting is distant, too formal or informal",
												"Awareness of audience; purpose is clear most of the time\n\nUses viewpoint (perspective) throughout most of the paper\n\nWriting is pleasant, agreeable and satisfying",
												"Powerful connection with audience; purpose is clearly communicated\n\nMaintains strong viewpoint (perspective) throughout entire piece\n\nWriting is expressive, engaging and has lots of energy"
											]
										}
									]
								},
								{
									"maxPoints": 5,
									"scorePointsLabels": [
										"Non-Scorable",
										"Unsatisfactory",
										"Satisfactory"
									],
									"traitLabel": "Category",
									"traits": [
										{
											"name": "Presentation",
											"standards": [],
											"description": "",
											"scorePointsDescriptors": [
												"Handwriting is unreadable, or response is blank, not in English, or too brief to evaluate. ",
												"Handwriting poor\n\nOverall appearance is distracting to unacceptable",
												"Handwriting is generally legible\n\nOverall appearance is acceptable or better"
											]
										}
									]
								}
							]
						}
					}
				}
			]
		}
	}
};

export default demo;
