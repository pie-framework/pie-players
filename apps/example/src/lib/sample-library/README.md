# PIE Sample Library

This directory contains curated examples of PIE items and assessments for demonstration purposes.

## Files

### `pie-examples.ts`
**35+ Individual Item Examples**

Complete library of PIE element examples across 14 categories:
- Multiple Choice & Selection (4 types)
- Text Response (2 types)
- Drag and Drop (4 types)
- Math Questions (3 types)
- Graphical Tools (4 types)
- Text & Media Selection (2 types)
- Matching (2 types)
- Visual Tools (2 types)
- Passage Tool
- Assessment Tools (3 types)
- Rubric Tools (4 types)

**Usage:**
```typescript
import { getAllExamples, PIE_ELEMENT_GROUPS } from './pie-examples';

const examples = getAllExamples(); // Get all 35+ examples
const groups = PIE_ELEMENT_GROUPS;  // Get organized by category
```

### `assessment-examples.ts`
**7 Pre-Built Assessment Templates**

Curated assessment examples demonstrating different assessment patterns:

| Template | Items | Duration | Use Case |
|----------|-------|----------|----------|
| Quick Math Quiz | 5 | 10 min | Formative assessment |
| Reading Comprehension | 8 | 20 min | Passage-based assessment |
| Practice Test - Mixed | 15 | 45 min | Comprehensive test |
| Science Lab | 10 | 30 min | Data analysis & STEM |
| Geometry Interactive | 7 | 25 min | Math with tools |
| Vocabulary & Matching | 6 | 15 min | Language arts |
| Drag & Drop Showcase | 5 | 12 min | Interactive patterns |

**Usage:**
```typescript
import {
  ASSESSMENT_EXAMPLES,
  createAssessmentFromExample
} from './assessment-examples';

// Get a template
const template = ASSESSMENT_EXAMPLES[0]; // Quick Math Quiz

// Convert to AssessmentEntity
const assessment = createAssessmentFromExample(template);

// Use in assessment player
<pie-assessment-player
  assessment={assessment}
  itemBank={itemBank}
  mode="gather"
/>
```

## Data Source

All examples are sourced from **PIEOneer** production data, ensuring real-world complexity and variety.

## Adding New Examples

### Adding Individual Items

1. Add to appropriate group in `pie-examples.ts`:
```typescript
{
  id: 'my-new-example',
  name: 'My New Example',
  description: 'Description of the example',
  item: {
    id: 'my_example',
    config: {
      // PIE item config
    }
  }
}
```

### Adding Assessment Templates

1. Add to `ASSESSMENT_EXAMPLES` in `assessment-examples.ts`:
```typescript
{
  id: 'my-template',
  name: 'My Assessment Template',
  description: 'What this assessment demonstrates',
  itemIds: ['item1', 'item2', 'item3'],
  estimatedMinutes: 15,
  tags: ['subject', 'type']
}
```

## Best Practices

### Item Selection for Assessments
- **Formative (5-8 items)**: Quick checks, single topic
- **Summative (10-15 items)**: Broader coverage, multiple topics
- **Practice Tests (15-20 items)**: Comprehensive, mixed types

### Item Type Mix
- Balance easy/medium/hard difficulty
- Mix question types (MC, constructed response, interactive)
- Include passage-based items for context
- Use appropriate tools (calculator, protractor, etc.)

### Assessment Structure
- Start with easier items to build confidence
- Group related items together
- End with challenging items or open-ended questions
- Include variety to maintain engagement

## See Also

- [EXAMPLE_APP_EVALUATION_UPDATED.md](../../../../../docs/EXAMPLE_APP_EVALUATION_UPDATED.md) - Comprehensive evaluation
- [WEB_COMPONENTS.md](../../../../../docs/WEB_COMPONENTS.md) - Web component usage
- [ACCESSIBILITY.md](../../../../../docs/ACCESSIBILITY.md) - Accessibility testing
