import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

// QTI 3.0 test assessment
export const qti3TestAssessment: AssessmentEntity = {
  id: 'qti3-test-001',
  name: 'QTI 3.0 Test Assessment',
  title: 'Sample QTI 3.0 Assessment',
  identifier: 'test-qti3-001',
  qtiVersion: '3.0',
  testParts: [
    {
      identifier: 'part1',
      navigationMode: 'nonlinear',
      submissionMode: 'individual',
      sections: [
        {
          identifier: 'section1',
          title: 'Section 1',
          visible: true,
          itemRefs: [
            {
              identifier: 'item1',
              itemVId: 'mc_basic',
              required: true
            },
            {
              identifier: 'item2',
              itemVId: 'mc_multi',
              required: false
            }
          ]
        }
      ]
    }
  ],
  contextDeclarations: [
    {
      identifier: 'testVar1',
      baseType: 'string',
      cardinality: 'single',
      defaultValue: 'test value'
    }
  ],
  accessibilityCatalogs: [],
  stimulusRefs: []
};

console.log('QTI 3.0 test assessment loaded');
console.log('testParts:', qti3TestAssessment.testParts?.length);
console.log('contextDeclarations:', qti3TestAssessment.contextDeclarations?.length);
