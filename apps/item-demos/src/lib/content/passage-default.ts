import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "passage-default",
	"name": "Hope Is the Thing with Feathers",
	"description": "Basic passage configuration",
	"sourcePackage": "passage",
	"sourceVariantId": "default",
	"tags": [
		"passage",
		"default"
	],
	"item": {
		"id": "passage-default",
		"name": "Hope Is the Thing with Feathers",
		"config": {
			"id": "",
			"markup": "<passage-element id=\"1\"></passage-element>",
			"elements": {
				"passage-element": "@pie-element/passage@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "passage-element",
					"passages": [
						{
							"teacherInstructions": "Teacher instructions for first tab",
							"title": "Hope Is the Thing with Feathers",
							"subtitle": "from <em>The Complete Poems of Emily Dickinson</em>",
							"author": "by Emily Dickinson",
							"text": "<p><font style=\"visibility:hidden\">00000</font>Hope is the thing with feathers<br /><font style=\"visibility:hidden\">00000</font>That perches in the soul,<br /><font style=\"visibility:hidden\">00000</font>And sings the tune without the words,<br /><font style=\"visibility:hidden\">00000</font>And never stops at all,</p><p>5<font style=\"visibility:hidden\">0000</font>And sweetest in the gale is heard;<br /><font style=\"visibility:hidden\">00000</font>And sore must be the storm<br /><font style=\"visibility:hidden\">00000</font>That could abash the little bird<br /><font style=\"visibility:hidden\">00000</font>That kept so many warm.</p><p><font style=\"visibility:hidden\">00000</font>I&#8217;ve heard it in the chillest land,<br />10<font style=\"visibility:hidden\">000</font>And on the strangest sea;<br /><font style=\"visibility:hidden\">00000</font>Yet, never, in extremity,<br /><font style=\"visibility:hidden\">00000</font>It asked a crumb of me.</p>"
						},
						{
							"title": "Ineskeen Road, July Evening",
							"text": "The bicycles go by in twos and threes -<br/>\n        There's a dance in Billy Brennan's barn tonight,<br/>\n        And there's the half-talk code of mysteries<br/>\n        And the wink-and-elbow language of delight.<br/>\n        Half-past eight and there is not a spot<br/>\n        Upon a mile of road, no shadow thrown<br/>\n        That might turn out a man or woman, not<br/>\n        A footfall tapping secrecies of stone. <br/>\n        <p/>\n        I have what every poet hates in spite<br/>\n        Of all the solemn talk of contemplation.<br/>\n        Oh, Alexander Selkirk knew the plight<br/>\n        Of being king and government and nation.<br/>\n        A road, a mile of kingdom. I am king<br/>\n        Of banks and stones and every blooming thing.<br/>\n        "
						}
					]
				}
			]
		}
	}
};

export default demo;
