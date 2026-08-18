import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Interface locale: the switcher's demo.
 *
 * The authored content here is English and stays English in every locale. That
 * is the point of the demo rather than an oversight: interface locale and
 * content language are separate channels, so the chrome the player owns —
 * toolbar names, tool panels, card headings, live-region announcements — moves
 * while the passage and the questions do not. Translating a stem is authoring
 * work, and it travels as a second item, not as a catalog key.
 *
 * The passage carries date ranges and a chemical name because the toolbar's
 * relevance gates read the content: `hasMathContent` and `hasScienceContent`
 * decide whether the graph and periodic-table buttons appear at all, and both
 * open shelled tool windows, which is the surface a locale most easily fails to
 * reach.
 */
export const demoInterfaceLocaleSection: AssessmentSection = {
	identifier: "interface-locale",
	title: "The Dutch Republic: Water, Trade and Tulips",
	keepTogether: true,

	rubricBlocks: [
		{
			identifier: "interface-locale-passage",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "interface-locale-passage-001",
				name: "Water, Trade and Tulips",
				baseId: "interface-locale-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>Water, Trade and Tulips</h2>

            <p>
              Roughly a quarter of the Netherlands lies below sea level, and much of the rest would
              flood without help. From the 1200s onward, communities banded together into water
              boards — some of the oldest continuously operating democratic bodies in Europe — to
              maintain dikes and drain lakes. Windmills pumped water out of low-lying land into
              ringed canals, turning shallow lakes into fields called polders. The Beemster polder,
              drained between 1607-1612, was laid out on such a strict grid that it is now a UNESCO
              World Heritage site.
            </p>

            <p>
              Reclaimed land and sheltered harbours fed an unusual economy. The Dutch East India
              Company, chartered in 1602 and dissolved in 1799, could sign treaties, raise armies
              and found trading posts of its own, and it sold shares to ordinary townspeople in what
              became the first modern stock exchange. Amsterdam grew from a fishing town of about
              30,000 people to a city of 200,000 within a century.
            </p>

            <p>
              Prosperity had strange side effects. Between 1634-1637, contracts for rare tulip bulbs
              changed hands at prices approaching the cost of a canal house, then collapsed within
              weeks — the episode economists still cite as the first speculative bubble. Less famous
              but longer lasting: Dutch chemists of the same period were among the first to describe
              the gas we now call carbon dioxide, and Antonie van Leeuwenhoek ground lenses good
              enough to see single cells, which he reported to London in letters written in his own
              dialect because he read no Latin.
            </p>

            <table class="passage-table">
              <caption>Four things the Dutch Republic is remembered for</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Development</th>
                  <th scope="col">Why it mattered</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1200s onward</td>
                  <td>Water boards and dikes</td>
                  <td>Collective flood defence, and early elected administration</td>
                </tr>
                <tr>
                  <td>1602-1799</td>
                  <td>The Dutch East India Company</td>
                  <td>Tradable shares, and the first modern stock exchange</td>
                </tr>
                <tr>
                  <td>1607-1612</td>
                  <td>Draining the Beemster</td>
                  <td>Windmill drainage turned lakes into farmland</td>
                </tr>
                <tr>
                  <td>1634-1637</td>
                  <td>The tulip trade</td>
                  <td>The first documented speculative bubble</td>
                </tr>
              </tbody>
            </table>
          </div>`,
					elements: {},
					models: [],
				},
			},
		},
	],

	assessmentItemRefs: [
		{
			identifier: "interface-locale-q1",
			required: true,
			item: {
				id: "interface-locale-q1",
				name: "Question 1",
				baseId: "interface-locale-q1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="ilq1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "ilq1",
							element: "multiple-choice",
							prompt:
								"<p>According to the passage, what did windmills make possible in the low-lying parts of the Netherlands?</p>",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Grinding grain for the growing cities",
									correct: false,
								},
								{
									value: "b",
									label:
										"Pumping water off shallow lakes so the land could be farmed",
									correct: true,
								},
								{
									value: "c",
									label: "Powering the looms of the textile trade",
									correct: false,
								},
								{
									value: "d",
									label: "Lifting cargo from ships onto the quayside",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "interface-locale-q2",
			required: true,
			item: {
				id: "interface-locale-q2",
				name: "Question 2",
				baseId: "interface-locale-q2",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="ilq2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "ilq2",
							element: "multiple-choice",
							prompt:
								"<p>The passage calls the tulip trade of 1634-1637 the first speculative bubble. Which detail best supports that description?</p>",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"Bulb contracts reached the price of a house and then collapsed within weeks",
									correct: true,
								},
								{
									value: "b",
									label: "Tulips had to be imported from far outside Europe",
									correct: false,
								},
								{
									value: "c",
									label: "Only wealthy merchant families were allowed to trade",
									correct: false,
								},
								{
									value: "d",
									label: "The Dutch East India Company controlled the bulb supply",
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
