import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Two-passage demo: one stimulus rubric block whose passage element
 * carries two passages in its `passages` array, followed by a single
 * comparison question. Mirrors the production shape where a paired
 * stimulus (article + companion website, etc.) ships as one
 * @pie-element/passage instance with multiple passage entries.
 */
export const demoTwoPassagesSection: AssessmentSection = {
	identifier: "demo-two-passages",
	title: "Two Passages with One Question",
	keepTogether: true,

	rubricBlocks: [
		{
			identifier: "passage-paired-stimulus",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "passage-paired-stimulus-001",
				name: "Sea Turtles Paired Stimulus",
				baseId: "passage-paired-stimulus",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup:
						'<passage-element id="paired-passages"></passage-element>',
					elements: {
						"passage-element": "@pie-element/passage@latest",
					},
					models: [
						{
							id: "paired-passages",
							element: "passage-element",
							passages: [
								{
									title: "Sea Turtles in Trouble",
									subtitle: "",
									author: "",
									teacherInstructions: "",
									text: `<p>For baby sea turtles, the world is full of danger. Even though they can grow up to be quite big, they are tiny when they first hatch in the sand. They use the light of the moon to run across the beach to the ocean.</p>
<p data-heading="heading1"><span class="no-number"><strong>Danger on Land</strong></span><br>The birds and crabs are not the biggest danger, however. People are. In some places, people catch the mother turtles when they leave the water to lay their eggs. Then they eat the eggs and sell the shells. And near many beaches, bright lights confuse the babies so that they cannot find the ocean.</p>
<p data-heading="heading1"><span class="no-number"><strong>Danger in the Water</strong></span><br>Many sea turtles are killed when they are trapped in fishing nets. And water pollution is a problem that hurts all ocean life. That includes sea turtles. Oil spills can kill the plants and animals that adult turtles eat. When people throw plastic bags on the ground, they can end up in the ocean. Turtles get caught in the bags and cannot swim.</p>
<p data-heading="heading1"><span class="no-number"><strong>Help is on the Way</strong></span><br>Now that we know that most sea turtles are endangered, people all over the world are trying to protect them. We can all help by taking cloth bags to the store instead of using plastic bags. And if we do use plastic, we can be sure to recycle it instead of letting the wind carry it away.</p>`,
								},
								{
									title: "Sea Turtle Action and Rescue Website",
									subtitle: "",
									author: "",
									teacherInstructions: "",
									text: `<p>Welcome to the Sea Turtle Action and Rescue (STAR) website, your source for the latest information about sea turtles around the globe. Sea turtles have lived on Earth since the days of the dinosaurs — about 110 million years! Today there are seven types of sea turtles left, and almost all of them are endangered.</p>
<p>Click the links to learn more about what we do and why we do it.</p>
<table border="0" cellspacing="5" cellpadding="5" style="width: 500px;"><tbody>
<tr><td><strong><u>About STAR</u></strong></td><td><u><strong>Fun Facts About Sea Turtles</strong></u></td></tr>
<tr><td><strong><u>Sea Turtles in the News</u></strong></td><td><u><strong>Sea Turtles at Risk</strong></u></td></tr>
<tr><td><u><strong>Sea Turtle Basics</strong></u></td><td><u>Oil spills</u></td></tr>
<tr><td><u>Birth</u></td><td><u>Plastic pollution</u></td></tr>
<tr><td><u>Diet</u></td><td><u>Fishing nets</u></td></tr>
<tr><td><u>Behavior</u></td><td><u>Climate change</u></td></tr>
<tr><td><u>Life Span</u></td><td><u>Egg hunters</u></td></tr>
<tr><td></td><td><u>Bright lights</u></td></tr>
<tr><td></td><td><u>Cars on the beach</u></td></tr>
<tr><td><u><strong>Where Sea Turtles Live</strong></u></td><td><u><strong>Photos and Videos</strong></u></td></tr>
<tr><td><u>Maps</u></td><td><strong><u>How You Can Help</u></strong></td></tr>
<tr><td><strong><u>Types of Sea Turtles</u></strong></td><td><u>Donate</u></td></tr>
<tr><td><u>Loggerhead</u></td><td><u>Volunteer</u></td></tr>
<tr><td><u>Green Sea Turtle</u></td><td><u>Jobs with STAR</u></td></tr>
<tr><td colspan="2"><p style="text-align: center;"><strong>Sign up <u>here</u> to receive news about sea turtles in your email.</strong></p>
<p style="text-align: center;"><strong>Sea Turtle Action &amp; Rescue</strong></p>
<p style="text-align: center;"><strong>5555 Water St., Tampa, FL</strong></p>
<p style="text-align: center;"><strong>Phone: 1-800-555-1234</strong></p></td></tr>
</tbody></table>`,
								},
							],
						},
					],
				},
			},
		},
	],

	assessmentItemRefs: [
		{
			identifier: "q1-two-passages",
			required: true,
			item: {
				id: "two-passages-q1",
				name: "Question 1",
				baseId: "two-passages-q1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "q1",
							element: "multiple-choice",
							prompt:
								"Based on both passages, which idea best connects 'Sea Turtles in Trouble' with the STAR website?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"Sea turtles face many dangers, and organizations like STAR work to protect them",
									correct: true,
								},
								{
									value: "b",
									label:
										"Sea turtles are no longer endangered thanks to the STAR website",
									correct: false,
								},
								{
									value: "c",
									label:
										"The STAR website explains why sea turtles should be hunted for their shells",
									correct: false,
								},
								{
									value: "d",
									label:
										"Sea turtles are mainly threatened by other sea animals, not people",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
	],
};
