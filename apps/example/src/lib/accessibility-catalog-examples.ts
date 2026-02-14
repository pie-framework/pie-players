import type {
	AccessibilityCatalog,
	AssessmentEntity,
	ItemEntity,
} from "@pie-players/pie-players-shared/types";

/**
 * Comprehensive examples demonstrating all QTI 3.0 accessibility catalog types
 *
 * This file showcases:
 * - Assessment-level catalogs (shared across items)
 * - Item-level catalogs (item-specific alternatives)
 * - All catalog types: spoken, sign-language, braille, simplified-language, tactile
 * - Multi-language support
 * - Integration with PIE content (passages, prompts, choices)
 */

// =============================================================================
// ASSESSMENT-LEVEL CATALOGS (Shared across items)
// =============================================================================

/**
 * Assessment-level accessibility catalogs
 * These are shared resources that multiple items can reference
 */
export const assessmentLevelCatalogs: AccessibilityCatalog[] = [
	// Shared reading passage with multiple accessibility alternatives
	{
		identifier: "shared-passage-photosynthesis",
		cards: [
			{
				catalog: "spoken",
				language: "en-US",
				content: `
          <speak>
            <prosody rate="medium" pitch="medium">
              Photosynthesis is the process by which plants convert sunlight into chemical energy.
              <break time="500ms"/>
              During this process, plants take in carbon dioxide from the air
              <break time="300ms"/>
              and water from the soil,
              <break time="300ms"/>
              and use sunlight to convert these into glucose and oxygen.
              <break time="500ms"/>
              The glucose provides energy for the plant,
              <break time="300ms"/>
              while the oxygen is released into the atmosphere.
            </prosody>
          </speak>
        `.trim(),
			},
			{
				catalog: "spoken",
				language: "es-ES",
				content: `
          <speak>
            <prosody rate="medium" pitch="medium">
              La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar en energía química.
              <break time="500ms"/>
              Durante este proceso, las plantas absorben dióxido de carbono del aire
              <break time="300ms"/>
              y agua del suelo,
              <break time="300ms"/>
              y utilizan la luz solar para convertirlos en glucosa y oxígeno.
            </prosody>
          </speak>
        `.trim(),
			},
			{
				catalog: "sign-language",
				language: "en-US",
				content: "https://cdn.example.com/asl/photosynthesis-explanation.mp4",
			},
			{
				catalog: "braille",
				language: "en",
				content: `
⠠⠏⠓⠕⠞⠕⠎⠽⠝⠞⠓⠑⠎⠊⠎ ⠊⠎ ⠞⠓⠑ ⠏⠗⠕⠉⠑⠎⠎ ⠃⠽ ⠺⠓⠊⠉⠓ ⠏⠇⠁⠝⠞⠎ ⠉⠕⠝⠧⠑⠗⠞ ⠎⠥⠝⠇⠊⠛⠓⠞ ⠊⠝⠞⠕ ⠉⠓⠑⠍⠊⠉⠁⠇ ⠑⠝⠑⠗⠛⠽⠲
⠠⠙⠥⠗⠊⠝⠛ ⠞⠓⠊⠎ ⠏⠗⠕⠉⠑⠎⠎⠂ ⠏⠇⠁⠝⠞⠎ ⠞⠁⠅⠑ ⠊⠝ ⠉⠁⠗⠃⠕⠝ ⠙⠊⠕⠭⠊⠙⠑ ⠋⠗⠕⠍ ⠞⠓⠑ ⠁⠊⠗ ⠁⠝⠙ ⠺⠁⠞⠑⠗ ⠋⠗⠕⠍ ⠞⠓⠑ ⠎⠕⠊⠇⠂ ⠁⠝⠙ ⠥⠎⠑ ⠎⠥⠝⠇⠊⠛⠓⠞ ⠞⠕ ⠉⠕⠝⠧⠑⠗⠞ ⠞⠓⠑⠎⠑ ⠊⠝⠞⠕ ⠛⠇⠥⠉⠕⠎⠑ ⠁⠝⠙ ⠕⠭⠽⠛⠑⠝⠲
        `.trim(),
			},
			{
				catalog: "simplified-language",
				language: "en",
				content: `
          <p>Plants make food from sunlight. This is called photosynthesis.</p>
          <p>Plants need three things:</p>
          <ul>
            <li>Sunlight (from the sun)</li>
            <li>Carbon dioxide (from the air)</li>
            <li>Water (from the ground)</li>
          </ul>
          <p>Plants use these to make sugar for food. They also make oxygen that we breathe.</p>
        `.trim(),
			},
		],
	},

	// Shared diagram with tactile and audio description
	{
		identifier: "plant-cell-diagram",
		cards: [
			{
				catalog: "spoken",
				language: "en-US",
				content: `
          <speak>
            This diagram shows a plant cell with its major components.
            <break time="500ms"/>
            At the center is the <emphasis level="strong">nucleus</emphasis>,
            which contains the cell's genetic material.
            <break time="500ms"/>
            Surrounding the nucleus is the <emphasis level="strong">cytoplasm</emphasis>,
            a gel-like substance where cellular processes occur.
            <break time="500ms"/>
            The cell is enclosed by a <emphasis level="strong">cell wall</emphasis>,
            which provides structure and protection.
            <break time="500ms"/>
            <emphasis level="strong">Chloroplasts</emphasis> are scattered throughout the cytoplasm.
            These are the organelles where photosynthesis takes place.
          </speak>
        `.trim(),
			},
			{
				catalog: "tactile",
				language: "en",
				content: `
          TACTILE GRAPHIC DESCRIPTION:

          This raised-line diagram depicts a plant cell in cross-section.

          Outer boundary (textured line): Cell wall
          - Thick, rigid structure
          - Forms the outermost layer

          Interior (smooth area): Cytoplasm
          - Fills the cell interior
          - Contains various organelles

          Center (raised circle): Nucleus
          - Largest circular structure
          - Located near the center
          - Slightly raised with dotted texture

          Scattered ovals (6-8 small raised ovals): Chloroplasts
          - Distributed throughout cytoplasm
          - Smaller than nucleus
          - Smooth raised surfaces

          Spatial relationships:
          - Cell wall forms complete outer boundary
          - Nucleus centrally positioned
          - Chloroplasts distributed in cytoplasm around nucleus
        `.trim(),
			},
			{
				catalog: "audio-description",
				language: "en-US",
				content:
					"https://cdn.example.com/audio-descriptions/plant-cell-extended.mp3",
			},
			{
				catalog: "extended-description",
				language: "en",
				content: `
          <div class="extended-description">
            <h3>Plant Cell Diagram - Extended Description</h3>

            <p><strong>Overview:</strong> This cross-sectional diagram illustrates the internal structure
            of a typical plant cell, highlighting four major components and their spatial relationships.</p>

            <h4>Structural Components (from outside to inside):</h4>

            <ol>
              <li>
                <strong>Cell Wall (outer boundary):</strong>
                <p>A thick, rigid layer colored in dark green that forms the complete perimeter of the cell.
                The cell wall maintains the cell's rectangular shape and provides structural support.
                It is approximately 0.1-1 μm thick in the diagram representation.</p>
              </li>

              <li>
                <strong>Cytoplasm (interior space):</strong>
                <p>A light yellow, semi-transparent area filling the entire interior of the cell.
                This gel-like substance serves as the medium in which all organelles are suspended
                and where metabolic reactions occur.</p>
              </li>

              <li>
                <strong>Nucleus (central organelle):</strong>
                <p>A large, spherical structure positioned slightly off-center in the cell.
                Depicted in purple with a stippled texture, it measures approximately 5-10 μm in diameter.
                The nucleus contains the cell's DNA and controls cellular activities.</p>
              </li>

              <li>
                <strong>Chloroplasts (photosynthetic organelles):</strong>
                <p>Multiple oval-shaped structures (6-8 visible) scattered throughout the cytoplasm.
                Each chloroplast is colored bright green and measures approximately 2-3 μm in length.
                They are distributed around the nucleus with varying orientations, showing their
                three-dimensional nature within the cell.</p>
              </li>
            </ol>

            <h4>Scale and Proportions:</h4>
            <p>The diagram is not to exact scale but maintains relative size relationships.
            The nucleus occupies roughly 10-15% of the cell's interior volume.
            Each chloroplast is approximately one-third the size of the nucleus.</p>

            <h4>Functional Context:</h4>
            <p>The chloroplasts shown in this diagram are the sites where photosynthesis occurs,
            converting light energy into chemical energy. Their distribution throughout the cytoplasm
            maximizes light absorption efficiency.</p>
          </div>
        `.trim(),
			},
		],
	},

	// Shared instructions with multiple accessibility formats
	{
		identifier: "test-instructions",
		cards: [
			{
				catalog: "spoken",
				language: "en-US",
				content: `
          <speak>
            <prosody rate="slow">
              Welcome to the science assessment.
              <break time="1s"/>
              You will answer <emphasis>ten questions</emphasis> about plants and photosynthesis.
              <break time="800ms"/>
              Read each question carefully.
              <break time="500ms"/>
              Select the best answer from the choices provided.
              <break time="800ms"/>
              You may use the ruler and calculator tools if needed.
              <break time="500ms"/>
              Click the <emphasis>Submit</emphasis> button when you are finished.
            </prosody>
          </speak>
        `.trim(),
			},
			{
				catalog: "sign-language",
				language: "en-US",
				content: "https://cdn.example.com/asl/test-instructions-science.mp4",
			},
			{
				catalog: "simplified-language",
				language: "en",
				content: `
          <div>
            <p><strong>What to do:</strong></p>
            <ol>
              <li>Read each question</li>
              <li>Pick the best answer</li>
              <li>Click Submit when done</li>
            </ol>
            <p>You can use tools like ruler or calculator.</p>
            <p>There are 10 questions about plants.</p>
          </div>
        `.trim(),
			},
		],
	},
];

// =============================================================================
// ITEM-LEVEL CATALOGS (Item-specific alternatives)
// =============================================================================

/**
 * Example item with accessibility catalogs for all content elements:
 * - Prompt (question stem)
 * - Answer choices
 * - Rationale/feedback
 */
// Example structure (not a valid ItemEntity - for documentation only)
export const itemWithCatalogsExample = {
	id: "photosynthesis-mc-001",
	markup: `
    <multiple-choice-item id="mc-photo-001" pie-type="pie-multiple-choice">
      <pie-stimulus>
        <!-- Reference to assessment-level shared passage -->
        <div data-catalog-id="shared-passage-photosynthesis">
          <p>Photosynthesis is the process by which plants convert sunlight into chemical energy.
          During this process, plants take in carbon dioxide from the air and water from the soil,
          and use sunlight to convert these into glucose and oxygen. The glucose provides energy
          for the plant, while the oxygen is released into the atmosphere.</p>
        </div>
      </pie-stimulus>

      <pie-prompt>
        <div data-catalog-id="prompt-photo-001">
          <p>Based on the passage, what are the main inputs required for photosynthesis?</p>
        </div>
      </pie-prompt>

      <pie-choices>
        <pie-choice value="A" data-catalog-id="choice-photo-001-A">
          Sunlight, carbon dioxide, and water
        </pie-choice>
        <pie-choice value="B" data-catalog-id="choice-photo-001-B">
          Glucose and oxygen
        </pie-choice>
        <pie-choice value="C" data-catalog-id="choice-photo-001-C">
          Soil and air only
        </pie-choice>
        <pie-choice value="D" data-catalog-id="choice-photo-001-D">
          Sunlight and glucose
        </pie-choice>
      </pie-choices>
    </multiple-choice-item>
  `,

	// Item-level accessibility catalogs
	accessibilityCatalogs: [
		// Prompt catalogs
		{
			identifier: "prompt-photo-001",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content: `
            <speak>
              Based on the passage,
              <break time="300ms"/>
              what are the main <emphasis level="strong">inputs</emphasis>
              <break time="200ms"/>
              required for photosynthesis?
            </speak>
          `.trim(),
				},
				{
					catalog: "simplified-language",
					language: "en",
					content: "What do plants need to make food?",
				},
				{
					catalog: "braille",
					language: "en",
					content:
						"⠠⠃⠁⠎⠑⠙ ⠕⠝ ⠞⠓⠑ ⠏⠁⠎⠎⠁⠛⠑⠂ ⠺⠓⠁⠞ ⠁⠗⠑ ⠞⠓⠑ ⠍⠁⠊⠝ ⠊⠝⠏⠥⠞⠎ ⠗⠑⠟⠥⠊⠗⠑⠙ ⠋⠕⠗ ⠏⠓⠕⠞⠕⠎⠽⠝⠞⠓⠑⠎⠊⠎⠦",
				},
			],
		},

		// Choice A catalogs (correct answer)
		{
			identifier: "choice-photo-001-A",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content:
						'<speak>Choice A: <break time="200ms"/> Sunlight, carbon dioxide, and water</speak>',
				},
				{
					catalog: "simplified-language",
					language: "en",
					content: "Sun, air (CO2), and water",
				},
				{
					catalog: "braille",
					language: "en",
					content: "⠠⠎⠥⠝⠇⠊⠛⠓⠞⠂ ⠉⠁⠗⠃⠕⠝ ⠙⠊⠕⠭⠊⠙⠑⠂ ⠁⠝⠙ ⠺⠁⠞⠑⠗",
				},
			],
		},

		// Choice B catalogs
		{
			identifier: "choice-photo-001-B",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content:
						'<speak>Choice B: <break time="200ms"/> Glucose and oxygen</speak>',
				},
				{
					catalog: "simplified-language",
					language: "en",
					content: "Sugar and oxygen",
				},
				{
					catalog: "braille",
					language: "en",
					content: "⠠⠛⠇⠥⠉⠕⠎⠑ ⠁⠝⠙ ⠕⠭⠽⠛⠑⠝",
				},
			],
		},

		// Choice C catalogs
		{
			identifier: "choice-photo-001-C",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content:
						'<speak>Choice C: <break time="200ms"/> Soil and air only</speak>',
				},
				{
					catalog: "simplified-language",
					language: "en",
					content: "Ground and air",
				},
				{
					catalog: "braille",
					language: "en",
					content: "⠠⠎⠕⠊⠇ ⠁⠝⠙ ⠁⠊⠗ ⠕⠝⠇⠽",
				},
			],
		},

		// Choice D catalogs
		{
			identifier: "choice-photo-001-D",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content:
						'<speak>Choice D: <break time="200ms"/> Sunlight and glucose</speak>',
				},
				{
					catalog: "simplified-language",
					language: "en",
					content: "Sun and sugar",
				},
				{
					catalog: "braille",
					language: "en",
					content: "⠠⠎⠥⠝⠇⠊⠛⠓⠞ ⠁⠝⠙ ⠛⠇⠥⠉⠕⠎⠑",
				},
			],
		},

		// Rationale/feedback catalogs
		{
			identifier: "rationale-photo-001",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content: `
            <speak>
              <prosody rate="medium">
                The correct answer is <emphasis level="strong">A</emphasis>.
                <break time="500ms"/>
                The passage states that plants take in carbon dioxide from the air
                <break time="300ms"/>
                and water from the soil,
                <break time="300ms"/>
                and use sunlight to convert these into glucose and oxygen.
                <break time="500ms"/>
                Therefore, the main inputs are sunlight, carbon dioxide, and water.
                <break time="500ms"/>
                Glucose and oxygen are the <emphasis>outputs</emphasis> of photosynthesis,
                not the inputs.
              </prosody>
            </speak>
          `.trim(),
				},
				{
					catalog: "simplified-language",
					language: "en",
					content: `
            <p><strong>Answer: A is correct</strong></p>
            <p>Plants need:</p>
            <ul>
              <li>Sunlight</li>
              <li>Carbon dioxide (from air)</li>
              <li>Water (from ground)</li>
            </ul>
            <p>They make sugar and oxygen. These are not inputs - they are what plants make.</p>
          `.trim(),
				},
			],
		},
	],
};

/**
 * Example math item with complex notation and tactile graphics
 */
// Example structure (not a valid ItemEntity - for documentation only)
export const mathItemWithCatalogsExample = {
	id: "algebra-equation-001",
	markup: `
    <math-item id="math-algebra-001" pie-type="pie-math-inline">
      <pie-prompt>
        <div data-catalog-id="prompt-algebra-001">
          <p>Solve for x:</p>
          <math-display data-catalog-id="equation-algebra-001">
            <math xmlns="http://www.w3.org/1998/Math/MathML">
              <mrow>
                <mn>2</mn>
                <mi>x</mi>
                <mo>+</mo>
                <mn>5</mn>
                <mo>=</mo>
                <mn>17</mn>
              </mrow>
            </math>
          </math-display>
        </div>
      </pie-prompt>
    </math-item>
  `,

	accessibilityCatalogs: [
		{
			identifier: "prompt-algebra-001",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content: "<speak>Solve for x</speak>",
				},
				{
					catalog: "braille",
					language: "en",
					content: "⠠⠎⠕⠇⠧⠑ ⠋⠕⠗ ⠭⠒", // Nemeth Braille Code for math
				},
			],
		},
		{
			identifier: "equation-algebra-001",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content: `
            <speak>
              <prosody rate="slow">
                Two x
                <break time="200ms"/>
                plus five
                <break time="300ms"/>
                equals
                <break time="200ms"/>
                seventeen
              </prosody>
            </speak>
          `.trim(),
				},
				{
					catalog: "braille",
					language: "en",
					content: "⠼⠆⠭⠬⠼⠑⠀⠨⠅⠀⠼⠁⠛", // Nemeth: 2x+5 = 17
				},
				{
					catalog: "simplified-language",
					language: "en",
					content: "Two times x, plus five, equals seventeen",
				},
				{
					catalog: "tactile",
					language: "en",
					content: `
            TACTILE REPRESENTATION:

            Linear equation shown horizontally:

            Left side (raised elements):
            - Number "2" (standard digit)
            - Letter "x" (italicized variable)
            - Plus sign "+"
            - Number "5"

            Center (raised element):
            - Equals sign "="

            Right side (raised element):
            - Number "17"

            All elements are on a single horizontal line with consistent spacing.
          `.trim(),
				},
			],
		},
	],
};

/**
 * Example science item with diagram and multimedia accessibility
 */
// Example structure (not a valid ItemEntity - for documentation only)
export const scienceItemWithMediaExample = {
	id: "cell-structure-001",
	markup: `
    <science-item id="sci-cell-001" pie-type="pie-extended-text">
      <pie-stimulus>
        <figure data-catalog-id="plant-cell-diagram">
          <img src="/images/plant-cell.png" alt="Plant cell diagram" />
          <figcaption>Figure 1: Plant Cell Structure</figcaption>
        </figure>
      </pie-stimulus>

      <pie-prompt>
        <div data-catalog-id="prompt-cell-001">
          <p>Using the diagram above, identify the organelle where photosynthesis occurs.</p>
        </div>
      </pie-prompt>
    </science-item>
  `,

	// Note: References assessment-level catalog 'plant-cell-diagram'
	// but adds item-specific prompt catalog
	accessibilityCatalogs: [
		{
			identifier: "prompt-cell-001",
			cards: [
				{
					catalog: "spoken",
					language: "en-US",
					content: `
            <speak>
              Using the diagram above,
              <break time="300ms"/>
              identify the <emphasis level="strong">organelle</emphasis>
              <break time="200ms"/>
              where photosynthesis occurs.
            </speak>
          `.trim(),
				},
				{
					catalog: "simplified-language",
					language: "en",
					content:
						"Look at the picture. Which part of the cell makes food from sunlight?",
				},
				{
					catalog: "braille",
					language: "en",
					content:
						"⠠⠥⠎⠊⠝⠛ ⠞⠓⠑ ⠙⠊⠁⠛⠗⠁⠍ ⠁⠃⠕⠧⠑⠂ ⠊⠙⠑⠝⠞⠊⠋⠽ ⠞⠓⠑ ⠕⠗⠛⠁⠝⠑⠇⠇⠑ ⠺⠓⠑⠗⠑ ⠏⠓⠕⠞⠕⠎⠽⠝⠞⠓⠑⠎⠊⠎ ⠕⠉⠉⠥⠗⠎⠲",
				},
			],
		},
	],
};

// =============================================================================
// COMPLETE ASSESSMENT EXAMPLE
// =============================================================================

/**
 * Complete assessment demonstrating accessibility catalogs
 */
export const accessibilityDemoAssessment: AssessmentEntity = {
	id: "accessibility-demo-001",
	name: "QTI 3.0 Accessibility Catalog Demo",
	title: "Plant Biology Assessment with Full Accessibility Support",
	identifier: "assessment-accessibility-demo",
	qtiVersion: "3.0",

	// Assessment-level accessibility catalogs (shared resources)
	accessibilityCatalogs: assessmentLevelCatalogs,

	// Personal Needs Profile example
	personalNeedsProfile: {
		supports: ["textToSpeech", "highlighter", "magnifier"],
		activateAtInit: ["textToSpeech"],
	},

	testParts: [
		{
			identifier: "part1",
			navigationMode: "nonlinear",
			submissionMode: "individual",
			sections: [
				{
					identifier: "section1",
					title: "Photosynthesis and Cell Structure",
					visible: true,

					// Rubric block with catalog reference
					rubricBlocks: [
						{
							identifier: "instructions-1",
							class: "instructions",
							view: "candidate",
							content: '<div data-catalog-id="test-instructions">...</div>',
						},
					],

					assessmentItemRefs: [
						{
							identifier: "item1",
							itemVId: "photosynthesis-mc-001",
							required: true,
						},
						{
							identifier: "item2",
							itemVId: "cell-structure-001",
							required: true,
						},
						{
							identifier: "item3",
							itemVId: "algebra-equation-001",
							required: false,
						},
					],
				},
			],
		},
	],
};

// =============================================================================
// HELPER FUNCTION FOR CATALOG DISCOVERY
// =============================================================================

/**
 * Extract all catalog IDs from item markup
 * Useful for discovering which catalogs an item references
 */
export function extractCatalogIdsFromMarkup(markup: string): string[] {
	const catalogIds: string[] = [];
	const regex = /data-catalog-id=["']([^"']+)["']/g;
	let match;

	while ((match = regex.exec(markup)) !== null) {
		catalogIds.push(match[1]);
	}

	return catalogIds;
}

/**
 * Example usage:
 * const catalogIds = extractCatalogIdsFromMarkup(itemWithCatalogs.markup);
 * // Returns: ['shared-passage-photosynthesis', 'prompt-photo-001', 'choice-photo-001-A', ...]
 */

// =============================================================================
// EXPORT FOR TESTING
// =============================================================================

export default {
	assessmentLevelCatalogs,
	itemWithCatalogsExample,
	mathItemWithCatalogsExample,
	scienceItemWithMediaExample,
	accessibilityDemoAssessment,
	extractCatalogIdsFromMarkup,
};
