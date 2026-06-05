import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo 2: Single Question with Single Passage
 *
 * Topic: Renaissance History (10th grade level, Lexile ~1050L)
 * Complexity: Intermediate (★★☆)
 * Time: ~10 minutes
 *
 * Learning Objectives:
 * - Understand how passages are rendered alongside questions
 * - See the relationship between passage content and comprehension questions
 * - Learn about the Renaissance period and its cultural impact
 */
export const demo2Section: AssessmentSection = {
	identifier: "demo2-question-passage",
	title: "Demo 2: Question with Passage",
	keepTogether: true, // Page mode - all content visible

	rubricBlocks: [
		{
			identifier: "passage-renaissance",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "passage-renaissance-001",
				name: "The Renaissance: A Cultural Rebirth",
				baseId: "passage-renaissance",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					// The <figure> below embeds an intentionally overwide authored image
					// (1792x592) to exercise the PIE-94 horizontal-scroll wrapper applied
					// by `sanitizeItemMarkup` / `wrapOverwideImages` in
					// `@pie-players/pie-players-shared`. In a narrow passage column (or
					// at 400% zoom) the image should surface its own horizontal scrollbar
					// instead of being clipped — satisfying WCAG 1.4.10 Reflow while
					// preserving the authored resolution. The authored <table> further
					// down exercises the matching `wrapOverwideTables` transform.
					markup: `<div class="passage">
            <h2>
              The Renaissance: A Cultural Rebirth
            </h2>

            <p>
              The Renaissance, spanning roughly from the 14th to 17th centuries, marked a profound
              transformation in European intellectual and artistic life. Beginning in Italy and spreading
              throughout Europe, this period witnessed a renewed interest in classical Greek and Roman
              learning, art, and philosophy. The term "Renaissance" itself means "rebirth," reflecting
              the era's emphasis on rediscovering and building upon ancient wisdom.
            </p>

            <p>
              During this time, wealthy merchant families like the Medici of Florence became patrons of
              the arts, supporting artists such as Leonardo da Vinci, Michelangelo, and Raphael. These
              artists developed new techniques like linear perspective, which created more realistic depth
              in paintings. Writers like Shakespeare and Dante explored human nature and emotion in
              unprecedented ways. Scientists and thinkers such as Galileo and Copernicus challenged
              long-held beliefs about the universe, laying the groundwork for the Scientific Revolution.
            </p>

            <figure class="passage-figure">
              <img
                src="/demo-assets/overwide-images/renaissance-timeline.jpg"
                alt="Illustrated timeline of the European Renaissance from 1300 to 1650, showing Dante Alighieri, Leonardo da Vinci, the Gutenberg printing press, Michelangelo at work on the Sistine Chapel, William Shakespeare writing, Galileo Galilei with a telescope, and Copernicus with a heliocentric model."
                width="1792"
                height="592"
              />
              <figcaption>
                A Renaissance timeline (1300&ndash;1650): key figures and inventions
                that shaped the era.
              </figcaption>
            </figure>

            <p>
              The invention of the printing press by Johannes Gutenberg around 1440 accelerated the spread
              of Renaissance ideas. Books became more accessible, literacy rates increased, and new ideas
              could travel faster than ever before. This technological advancement democratized knowledge
              and helped transform European society from the medieval period into the early modern era.
            </p>

            <table class="passage-table">
              <caption>Estimated populations of major Renaissance city-states (c.&nbsp;1500)</caption>
              <thead>
                <tr>
                  <th scope="col">City</th>
                  <th scope="col">Region</th>
                  <th scope="col">Estimated population</th>
                  <th scope="col">Notable patron family</th>
                  <th scope="col">Signature artists</th>
                  <th scope="col">Major civic landmark</th>
                  <th scope="col">Primary industry</th>
                  <th scope="col">University founded</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Florence</td>
                  <td>Tuscany</td>
                  <td>70,000</td>
                  <td>Medici</td>
                  <td>Leonardo da Vinci, Michelangelo, Botticelli</td>
                  <td>Cattedrale di Santa Maria del Fiore</td>
                  <td>Banking, wool textiles</td>
                  <td>1321</td>
                </tr>
                <tr>
                  <td>Venice</td>
                  <td>Veneto</td>
                  <td>100,000</td>
                  <td>Doge &amp; Council of Ten</td>
                  <td>Titian, Giovanni Bellini, Tintoretto</td>
                  <td>Basilica di San Marco</td>
                  <td>Maritime trade, glassmaking</td>
                  <td>1222 (nearby Padua)</td>
                </tr>
                <tr>
                  <td>Rome</td>
                  <td>Lazio</td>
                  <td>55,000</td>
                  <td>Papal States (Borgia, della Rovere)</td>
                  <td>Raphael, Michelangelo, Bramante</td>
                  <td>St. Peter's Basilica</td>
                  <td>Pilgrimage, papal administration</td>
                  <td>1303</td>
                </tr>
                <tr>
                  <td>Milan</td>
                  <td>Lombardy</td>
                  <td>100,000</td>
                  <td>Sforza</td>
                  <td>Leonardo da Vinci, Bramante</td>
                  <td>Castello Sforzesco</td>
                  <td>Armaments, silk</td>
                  <td>1361</td>
                </tr>
                <tr>
                  <td>Naples</td>
                  <td>Campania</td>
                  <td>150,000</td>
                  <td>House of Aragon</td>
                  <td>Antonello da Messina</td>
                  <td>Castel Nuovo</td>
                  <td>Agriculture, Mediterranean trade</td>
                  <td>1224</td>
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
			identifier: "q1-renaissance",
			required: true,
			item: {
				id: "renaissance-q1",
				name: "Question 1",
				baseId: "renaissance-q1",
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
							prompt: `Review the overwide timeline image in this question prompt, then answer the question below.
								<figure>
									<img
										src="/demo-assets/overwide-images/renaissance-timeline.jpg"
										alt="Question prompt copy of the Renaissance timeline from 1300 to 1650"
										width="1792"
										height="592"
									/>
								</figure>
								<p>According to the passage, what was the primary significance of Gutenberg's printing press during the Renaissance?</p>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"It allowed artists to reproduce their paintings more accurately",
									correct: false,
								},
								{
									value: "b",
									label:
										"It helped spread knowledge and ideas more quickly to more people",
									correct: true,
								},
								{
									value: "c",
									label: "It enabled scientists to conduct more experiments",
									correct: false,
								},
								{
									value: "d",
									label: "It replaced the need for wealthy patrons of the arts",
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
