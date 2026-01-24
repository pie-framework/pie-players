# Tool Evals

This directory contains evaluation specifications for PIE assessment tools. Tools are auxiliary components that students can use during assessments (calculators, graphing tools, text-to-speech, etc.).

## Structure

Each tool has its own subdirectory:
- `calculator/` - Scientific/basic calculator
- `graph/` - Graphing tool (Desmos integration)
- `text-to-speech/` - TTS playback and highlighting
- `toolbar/` - Main toolbar coordination
- `ruler/` - Digital ruler
- `protractor/` - Angle measurement
- `periodic-table/` - Element reference
- `line-reader/` - Reading accommodation
- `magnifier/` - Screen magnification
- `answer-eliminator/` - Answer strikethrough
- `annotation-toolbar/` - Drawing and markup tools
- `color-scheme/` - Theme switching

## Tool Eval Principles

### 1. **Functionality First**
Test core tool features work as expected:
- Basic operations (calculator math, graph plotting)
- State management (open/close, settings)
- Integration with assessment context

### 2. **Coordination**
Validate tool coordination with assessment toolkit:
- Multiple tools can coexist
- Focus management between tools
- z-index and visibility handling
- Tool state persistence across items

### 3. **Accessibility**
All tools must be accessible:
- Keyboard navigation
- Screen reader support
- Focus indicators
- ARIA labels and roles
- High contrast compatibility

### 4. **Student Experience**
Spirit checks validate UX quality:
- Clear visual affordances
- Intuitive interactions
- Non-intrusive presence
- Helpful error messages
- Age-appropriate UI

## Test Coverage Goals

For each tool, aim for:
- **Smoke test**: Tool loads without errors
- **Core functionality**: 3-5 basic operations work correctly
- **Accessibility**: Passes axe checks, keyboard accessible
- **Coordination**: Works alongside other tools
- **Error handling**: Graceful degradation
- **Spirit checks**: Student-friendly UX

Minimum: 5-10 test cases per tool
Ideal: 10-15 test cases covering edge cases

## Running Tool Evals

```bash
# Run all tool evals
bun run test:evals -- --grep "^tools/"

# Run specific tool
bun run test:evals -- --grep "tools/calculator"

# Run in UI mode for debugging
bun run test:evals:ui -- --grep "tools/"
```

## Tool Eval Template

See `evals.template.yaml` for the standard structure. Key differences from item-player evals:
- Most tests use `/evals/assessment-toolkit` route
- Tools typically require click to open/activate
- Focus on coordination and accessibility
- Higher emphasis on spirit checks for UX

## Alignment with pie-qti

These tool evals follow the same patterns as pie-qti's component evals:
- Structured YAML with gradeBand/subject metadata
- Rich assertion operators (containsAll, equalsOrdered, etc.)
- spiritChecks for qualitative validation
- Deterministic actions over flaky UI automation

## Contributing New Tool Evals

1. Create directory: `docs/evals/tools/<tool-name>/`
2. Copy template: `cp evals.template.yaml <tool-name>/evals.yaml`
3. Customize for tool-specific behavior
4. Add 5-10 test cases covering functionality + a11y
5. Run tests to verify: `bun run test:evals -- --grep "tools/<tool-name>"`
6. Ensure spirit checks validate student-facing quality
