import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo: Keyboard Navigation in MC and EBSR
 *
 * Topic: Accessibility Practices & WCAG Guidelines for Radio Buttons and Checkboxes
 * Complexity: Intermediate (★★)
 * Time: ~10 minutes
 *
 * Learning Objectives:
 * - Understand WCAG 2.2 keyboard interaction requirements for radio buttons and checkboxes
 * - Distinguish between single-select (radio) and multi-select (checkbox) interaction patterns
 * - Apply knowledge of accessible form control expectations
 */
export const demoKeyboardNavMcEbsrSection: AssessmentSection = {
	identifier: "demo-keyboard-nav-mc-ebsr",
	title: "Keyboard Navigation in MC and EBSR",
	keepTogether: true,

	rubricBlocks: [
		{
			identifier: "passage-keyboard-nav-a11y",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "passage-keyboard-nav-a11y-001",
				name: "Keyboard Accessibility for Radio Buttons and Checkboxes",
				baseId: "passage-keyboard-nav-a11y",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>Keyboard Accessibility for Radio Buttons and Checkboxes</h2>

            <p>
              Web Content Accessibility Guidelines (WCAG) 2.2 require that all interactive controls
              on a webpage be fully operable via keyboard alone, without requiring a mouse or other
              pointing device. This requirement, captured in <strong>Success Criterion 2.1.1
              (Keyboard)</strong>, is essential for users who rely on screen readers, switch devices,
              or keyboard-only navigation due to motor disabilities.
            </p>

            <p>
              <strong>Radio buttons</strong> follow a roving tabindex pattern defined in the
              ARIA Authoring Practices Guide (APG). A radio group receives a single tab stop: pressing
              <kbd>Tab</kbd> moves focus into the group, and the <kbd>Arrow</kbd> keys then move
              selection among the options. Pressing <kbd>Tab</kbd> again moves focus out of the group
              entirely. This pattern prevents users from having to tab through every option individually,
              which would be burdensome in groups with many choices.
            </p>

            <p>
              <strong>Checkboxes</strong> behave differently. Because each checkbox is an independent
              control, every checkbox in a group is a separate tab stop. Users press <kbd>Tab</kbd>
              to move between checkboxes and use <kbd>Space</kbd> to toggle the checked state on or off.
              Unlike radio buttons, checking one checkbox does not affect the others. WCAG SC 2.1.1
              requires that this full toggle behavior be achievable by keyboard alone.
            </p>

            <p>
              Both control types must also satisfy <strong>SC 2.4.7 (Focus Visible)</strong>, which
              requires that the keyboard focus indicator be visible at all times. WCAG 2.2 strengthens
              this with <strong>SC 2.4.11 (Focus Appearance)</strong>, setting minimum size and contrast
              requirements for the focus ring. A focus indicator that disappears or blends into the
              background fails these criteria and leaves keyboard users unable to track where they are
              on the page.
            </p>

            <p>
              Finally, all form controls need an accessible name — typically provided via a
              <code>&lt;label&gt;</code> element or an <code>aria-label</code> attribute — so that
              screen readers can announce what each control represents. A checkbox that reads only
              "Option 1" without context fails <strong>SC 1.3.1 (Info and Relationships)</strong>
              and <strong>SC 4.1.2 (Name, Role, Value)</strong>, because the relationship between
              the control and its meaning is not programmatically determinable.
            </p>
          </div>`,
					elements: {},
					models: [],
				},
			},
		},
	],

	assessmentItemRefs: [
		{
			identifier: "knav-q1-radio-tabstop",
			required: true,
			item: {
				id: "knav-q1",
				name: "Question 1",
				baseId: "knav-q1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="knav-q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@13.2.0-next.19",
					},
					models: [
						{
							id: "knav-q1",
							element: "multiple-choice",
							prompt:
								"According to the passage, how many tab stops does a radio button group receive?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "One tab stop for the entire group",
									correct: true,
								},
								{
									value: "b",
									label: "One tab stop per radio button option",
									correct: false,
								},
								{
									value: "c",
									label: "Two tab stops — one for entering and one for exiting",
									correct: false,
								},
								{
									value: "d",
									label: "No tab stops; radio buttons are mouse-only controls",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "knav-q2-checkbox-key",
			required: true,
			item: {
				id: "knav-q2",
				name: "Question 2",
				baseId: "knav-q2",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="knav-q2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@13.2.0-next.19",
					},
					models: [
						{
							id: "knav-q2",
							element: "multiple-choice",
							prompt:
								"Which key does the passage identify as the primary way to toggle a checkbox using a keyboard?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Enter",
									correct: false,
								},
								{
									value: "b",
									label: "Arrow keys",
									correct: false,
								},
								{
									value: "c",
									label: "Space",
									correct: true,
								},
								{
									value: "d",
									label: "Escape",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "knav-q3-ebsr-focus-visible",
			required: true,
			item: {
				id: "knav-q3",
				name: "Question 3 (EBSR)",
				baseId: "knav-q3",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<ebsr id="knav-q3"></ebsr>',
					elements: {
						ebsr: "@pie-element/ebsr@14.2.0-next.19",
					},
					models: [
						{
							id: "knav-q3",
							element: "ebsr",
							partLabels: false,
							partA: {
								id: "knav-q3",
								element: "ebsr",
								prompt:
									"Part A: Which WCAG Success Criterion specifically requires that the keyboard focus indicator always be visible?",
								choiceMode: "radio",
								choices: [
									{
										value: "a",
										label: "SC 1.3.1 – Info and Relationships",
										correct: false,
									},
									{ value: "b", label: "SC 2.1.1 – Keyboard", correct: false },
									{
										value: "c",
										label: "SC 2.4.7 – Focus Visible",
										correct: true,
									},
									{
										value: "d",
										label: "SC 4.1.2 – Name, Role, Value",
										correct: false,
									},
								],
							},
							partB: {
								id: "knav-q3",
								element: "ebsr",
								prompt:
									"Part B: Select TWO statements from the passage that explain what can go wrong with focus indicators.",
								choiceMode: "checkbox",
								choices: [
									{
										value: "a",
										label:
											"A focus indicator that disappears fails SC 2.4.7 and leaves keyboard users unable to track focus",
										correct: true,
									},
									{
										value: "b",
										label:
											"WCAG 2.2 SC 2.4.11 sets minimum size and contrast requirements for the focus ring",
										correct: true,
									},
									{
										value: "c",
										label:
											"Radio buttons that use arrow keys also satisfy SC 2.4.7 automatically",
										correct: false,
									},
									{
										value: "d",
										label:
											"Checkboxes do not need a visible focus ring because they use Space to toggle",
										correct: false,
									},
								],
							},
						},
					],
				},
			},
		},
		{
			identifier: "knav-q4-ebsr-accessible-name",
			required: true,
			item: {
				id: "knav-q4",
				name: "Question 4 (EBSR)",
				baseId: "knav-q4",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<ebsr id="knav-q4"></ebsr>',
					elements: {
						ebsr: "@pie-element/ebsr@14.2.0-next.19",
					},
					models: [
						{
							id: "knav-q4",
							element: "ebsr",
							partLabels: false,
							partA: {
								id: "knav-q4",
								element: "ebsr",
								prompt:
									"Part A: According to the passage, what does a form control need so that screen readers can announce what it represents?",
								choiceMode: "radio",
								choices: [
									{
										value: "a",
										label: "A visible placeholder attribute",
										correct: false,
									},
									{
										value: "b",
										label: "An accessible name via a label or aria-label",
										correct: true,
									},
									{
										value: "c",
										label: "A tooltip revealed on hover",
										correct: false,
									},
									{
										value: "d",
										label: 'A role="button" attribute',
										correct: false,
									},
								],
							},
							partB: {
								id: "knav-q4",
								element: "ebsr",
								prompt:
									"Part B: Select the TWO WCAG Success Criteria the passage cites as being violated when a checkbox lacks a meaningful accessible name.",
								choiceMode: "checkbox",
								choices: [
									{
										value: "a",
										label: "SC 1.3.1 – Info and Relationships",
										correct: true,
									},
									{
										value: "b",
										label: "SC 2.1.1 – Keyboard",
										correct: false,
									},
									{
										value: "c",
										label: "SC 2.4.11 – Focus Appearance",
										correct: false,
									},
									{
										value: "d",
										label: "SC 4.1.2 – Name, Role, Value",
										correct: true,
									},
								],
							},
						},
					],
				},
			},
		},
	],
};
