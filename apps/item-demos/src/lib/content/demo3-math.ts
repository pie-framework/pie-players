import type { ItemEntity } from '@pie-players/pie-players-shared/types';

export const demo3Item: Partial<ItemEntity> = {
	id: 'quadratic-equation',
	name: 'Quadratic Equation Solver',
	config: {
		elements: {
			'math-response-element': '@pie-element/explicit-constructed-response@latest'
		},
		models: [
			{
				id: 'math1',
				element: 'math-response-element',
				markup: '<p>Solve for <em>x</em>: x² - 5x + 6 = 0</p><p>x = {{0}} or x = {{1}}</p>',
				disabled: false,
				choices: {
					'0': [
						{ label: '2', value: '0' },
						{ label: '3', value: '1' }
					],
					'1': [
						{ label: '2', value: '0' },
						{ label: '3', value: '1' }
					]
				},
				prompt: '<div><p>Solve the quadratic equation by factoring or using the quadratic formula.</p><p><strong>Hint:</strong> Factor the expression into (x - a)(x - b) = 0</p></div>',
				promptEnabled: true,
				displayType: 'block',
				maxLengthPerChoiceEnabled: true,
				playerSpellCheckEnabled: false,
				rationale: '<div><p><strong>Solution:</strong></p><p>x² - 5x + 6 = 0</p><p>Factor: (x - 2)(x - 3) = 0</p><p>Therefore: x = 2 or x = 3</p></div>',
				rationaleEnabled: true,
				spellCheckEnabled: false,
				studentInstructionsEnabled: false,
				teacherInstructions: '<div>This problem assesses students\' understanding of quadratic equations and factoring.</div>',
				teacherInstructionsEnabled: true,
				toolbarEditorPosition: 'bottom',
				responseAreaInputConfiguration: { characters: { disabled: true } },
				slateMarkup: '<p>Solve for <em>x</em>: x² - 5x + 6 = 0</p><p>x = <span data-type="explicit_constructed_response" data-index="0" data-value=""></span> or x = <span data-type="explicit_constructed_response" data-index="1" data-value=""></span></p>',
				maxLengthPerChoice: [5, 5]
			}
		],
		markup: '<math-response-element id="math1"></math-response-element>',
		id: ''
	}
};
