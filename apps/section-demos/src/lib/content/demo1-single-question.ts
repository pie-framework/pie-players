import type { QtiAssessmentSection } from '@pie-players/pie-players-shared/types';

/**
 * Demo 1: Single Question, No Passage
 *
 * Topic: Climate Change Science (9th grade level, Lexile ~1000L)
 * Complexity: Beginner (★☆☆)
 * Time: ~5 minutes
 *
 * Learning Objectives:
 * - Understand the simplest section player implementation
 * - See how a single question renders in page mode
 * - Learn about greenhouse gases and climate change
 */
export const demo1Section: QtiAssessmentSection = {
  identifier: 'demo1-single-question',
  title: 'Demo 1: Single Question',
  keepTogether: true, // Page mode - all content visible

  assessmentItemRefs: [
    {
      identifier: 'q1-climate',
      required: true,
      item: {
        id: 'climate-q1',
        name: 'Climate Question',
        baseId: 'climate-q1',
        version: { major: 1, minor: 0, patch: 0 },
        config: {
          markup: '<multiple-choice id="q1"></multiple-choice>',
          elements: {
            'multiple-choice': '@pie-element/multiple-choice@latest'
          },
          models: [
            {
              id: 'q1',
              element: 'multiple-choice',
              prompt: `<div>
                <p><strong>Which greenhouse gas is most responsible for trapping heat in Earth's atmosphere?</strong></p>
              </div>`,
              choiceMode: 'radio',
              choices: [
                {
                  value: 'a',
                  label: 'Oxygen (O₂)'
                },
                {
                  value: 'b',
                  label: 'Nitrogen (N₂)'
                },
                {
                  value: 'c',
                  label: 'Carbon dioxide (CO₂)'
                },
                {
                  value: 'd',
                  label: 'Argon (Ar)'
                }
              ]
            }
          ]
        }
      }
    }
  ]
};
