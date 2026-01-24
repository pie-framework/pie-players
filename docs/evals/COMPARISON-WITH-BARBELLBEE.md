# Eval Systems Comparison: pie-players vs BarbellBee

**Date**: January 8, 2026
**Author**: Comparative analysis of two YAML-based eval systems

---

## Executive Summary

Both projects use YAML-based evaluation systems but serve fundamentally different purposes:

- **pie-players**: UI/interaction testing for web components using Playwright
- **BarbellBee**: Business logic validation for backend algorithms using Kotlin

The most significant innovation in BarbellBee is **spirit checks** - semantic and tone validation that goes beyond correctness. This concept has **high value for AI coding agents** and could be adapted to pie-players.

---

## Quick Comparison Table

| Aspect | pie-players | BarbellBee |
|--------|-------------|------------|
| **Primary Focus** | UI interactions, events, accessibility | Business logic, decision algorithms, UX quality |
| **Test Runner** | Playwright (browser automation) | Kotlin/JUnit (unit tests) |
| **Execution Environment** | Local-only, opt-in | CI-integrated via Gradle |
| **File Count** | ~11 eval files | ~86 eval files |
| **Actions Tested** | navigate, click, type, observe, dispatchEvent, axe | calculate, detect, assess (pure function calls) |
| **Spirit Checks** | ❌ Not present | ✅ 3-5 per eval (semantic/tone validation) |
| **Severity Levels** | error, warn | Implied by test result |
| **Human Verification** | Via `severity: warn` for intent tracking | Via spirit checks for UX quality |
| **AI Agent Support** | Step-by-step UI automation | Step-by-step logic validation + reasoning quality |

---

## Detailed Comparison

### 1. Purpose and Philosophy

#### pie-players
- **Goal**: Validate that web components (item players, assessment toolkit) behave correctly in browsers
- **Focus**:
  - Loading and initialization
  - Event plumbing (session-changed, model-updated)
  - Mode transitions (gather, view, evaluate, author)
  - Tool coordination (visibility, z-index, focus)
  - Accessibility (WCAG 2.2 AA via axe-core)
- **Design Philosophy**: "AI-friendly explicit steps + expectations" and "usable for manual QA"
- **Intent Tracking**: Uses `severity: warn` to track aspirational features not yet implemented

#### BarbellBee
- **Goal**: Validate that training algorithms produce correct recommendations with appropriate reasoning
- **Focus**:
  - Weight calculations and progressions
  - RPE-based adjustments
  - Stall detection and deload protocols
  - Transition readiness assessment
  - Injury substitution ranking
- **Design Philosophy**: "Dual-purpose: human-readable documentation + machine-loadable test data"
- **Quality Tracking**: Uses spirit checks to validate communication quality and user understanding

---

### 2. YAML Structure Comparison

#### pie-players Structure

```yaml
version: 1

component:
  area: item-players
  underTest: "pie-iife-player"

examplesApp:
  app: "@pie-framework/pie-players-example"
  routeTemplate: "/evals/item-player/{sampleId}?player={player}"

evals:
  - id: item-players/mc_basic/session-changed-plumbing/iife
    sampleId: mc_basic
    severity: error  # or warn
    intent: "session-changed DOM events are forwarded and observable"
    steps:
      - action: navigate
        path: "/evals/item-player/mc_basic?player=iife"
      - action: observe
        target: { testId: player-host }
        expect: { exists: true }
      - action: dispatchEvent
        target: { testId: player-host }
        eventType: "session-changed"
        detail: { complete: false }
      - action: observe
        target: { testId: last-event-type }
        expect: { equals: "session-changed" }
```

**Key Features**:
- Route-based navigation
- testId-based element selection
- Deterministic event injection
- Severity levels (error/warn)
- Intent statements for human readers

#### BarbellBee Structure

```yaml
version: 1

use_case:
  id: UC-001
  variant: baseline-on-target
  description: "First squat session baseline establishment"

component:
  type: LinearProgressionScheme
  function: calculateNextSession

context:
  user_profile:
    experience_level: NOVICE
    estimated_1rm:
      back_squat: 185.0
  exercise:
    id: back_squat
    increment: 5.0
  history:
    - session:
        weight: 110.0
        reps: [5, 5, 5]
        rpe: 7.0
        type: BASELINE_ESTABLISHMENT

steps:
  - action: calculate_next_session
    input:
      context: <from above>

expected:
  prescription:
    weight: { equals: 115.0 }
    sets: { equals: 3 }
    reps: { equals: 5 }
    rpe_target: { range: [7.0, 7.5] }
  metadata:
    recommendation_type: { equals: "standard_progression" }
  reasoning:
    contains: ["Perfect start", "right starting weight"]
    notContains: ["adjust", "problem"]

spirit_checks:
  - "Reasoning explains that RPE 7.0 matches target"
  - "User receives positive reinforcement about starting weight"
  - "Next session is clearly prescribed: 3×5 @ 115 lbs"
  - "Tone is encouraging: 'on track' or 'consistent weekly progression'"
```

**Key Features**:
- Rich context data structures
- Multiple assertion operators (equals, range, greaterThan, contains, in, etc.)
- Reasoning validation (contains/notContains)
- **Spirit checks** for semantic/tone quality
- Use case and variant taxonomy

---

### 3. Execution Model

#### pie-players Execution

**Runner**: Playwright test suite ([apps/example/tests/evals/docs-evals.spec.ts](../../../apps/example/tests/evals/docs-evals.spec.ts))

**Process**:
1. Recursively read all `evals.yaml` files from `docs/evals/`
2. Generate Playwright tests for each eval case
3. Start local dev server on port 5200
4. Navigate to test harness pages with query params
5. Execute UI actions (click, type, observe, dispatchEvent)
6. Assert on DOM state using testIds
7. Run axe-core scans for accessibility

**Execution Mode**:
- **Local-only**: Not part of CI
- **Sequential**: Single worker for deterministic behavior
- **Retries**: 2 in CI, 0 locally
- **Output**: HTML reporter, screenshots/videos on failure

**Commands**:
```bash
bun run test:evals         # Run all evals
bun run test:evals:ui      # Playwright UI mode
bun run test:evals:headed  # Headed browser mode
```

**Pros**:
- Validates real browser behavior
- Tests integration of multiple components
- Catches accessibility issues
- Visual debugging via screenshots

**Cons**:
- Slower than unit tests (browser startup)
- Requires running dev server
- Flakier than pure logic tests
- Not integrated into CI

#### BarbellBee Execution

**Runner**: Kotlin test framework with custom eval engine

**Key Classes**:
- `EvalModels.kt`: YAML data structures
- `EvalRunner.kt`: Orchestrates eval execution
- `AssertionEngine.kt`: Validates numerical/logical assertions
- `SpiritChecker.kt`: Validates semantic/tone quality
- `ContextBuilder.kt`: Converts YAML to domain objects

**Process**:
1. Load eval YAML files via `EvalSpecification.fromYaml()`
2. Build domain context from YAML data
3. Invoke target function (e.g., `calculateNextSession()`)
4. Validate prescription fields (weight, sets, reps, RPE)
5. Validate metadata fields (recommendation_type, baseline_status)
6. Validate reasoning text (contains/notContains)
7. **Validate spirit checks** (semantic pattern matching)
8. Aggregate results and generate report

**Execution Mode**:
- **CI-integrated**: Runs via `./gradlew :shared:jvmTest`
- **Fast**: Pure unit tests, no browser overhead
- **Deterministic**: No UI flakiness
- **Output**: Standard JUnit reports + custom summary

**Commands**:
```bash
./run-evals.sh                          # Run all evals
./test-single-parse.sh UC-001-baseline  # Test single file
./gradlew :shared:jvmTest               # CI integration
```

**Pros**:
- Fast execution (no browser)
- Deterministic results
- CI-integrated for continuous validation
- Validates business logic correctness AND communication quality

**Cons**:
- Doesn't test UI rendering
- Requires Kotlin framework
- More complex setup for non-Kotlin projects

---

### 4. Spirit Checks: The Killer Feature

**What are Spirit Checks?**

Spirit checks validate **semantic and tone quality** beyond correctness. They answer questions like:
- Does the user understand *why* this recommendation was made?
- Is the tone supportive and confidence-building?
- Are next steps actionable and clear?
- Does the system respond appropriately to user feedback?

**Example from BarbellBee** (UC-001 baseline too easy):

```yaml
spirit_checks:
  - "Reasoning frames adjustment positively: 'starting strength is higher than estimated'"
  - "Explains why 10 lb jump instead of 5 lb: 'RPE 5.5 indicates room for acceleration'"
  - "Clarifies return to standard increment: 'After that, we'll return to 5 lb increments'"
  - "User understands this is good news, not a mistake or problem"
  - "Revised 1RM estimate provided (e.g., 205 lbs based on RPE 5.5 @110)"
```

**SpiritChecker Implementation**

The `SpiritChecker.kt` validates checks using:

1. **Pattern Extraction**: Looks for quoted phrases like `'exact phrase'` or `"exact phrase"`
2. **Concept Keywords**: Identifies semantic patterns (celebrate, supportive, explain, positive)
3. **Semantic Matching**:
   - "mentions X": Extracts what should be present
   - "explains why": Looks for causal language (because, since, indicates)
   - "not alarming": Avoids negative words (problem, failure, concern)
   - "tone is positive": Finds positive words (good, great, progress)
   - "user understands": Checks reasoning depth (>50 chars with explanation)
4. **Flexible Validation**: Case-insensitive, multiple pattern alternatives

**Why Spirit Checks Matter for AI Coding Agents**

When an AI agent writes code that produces user-facing messages:
1. **Correctness alone is insufficient**: The message must be helpful and appropriate
2. **Tone affects trust**: Users need confidence-building language, not robotic output
3. **Transparency builds understanding**: Users need to know *why*, not just *what*
4. **Quality gate for prompts**: Spirit checks catch when AI-generated text lacks empathy or clarity

**Anthropic Research Connection**

This aligns with Anthropic's "Character" variant of Constitutional AI training:
- Generate multiple responses to character-relevant prompts
- Claude ranks its own responses by alignment with desired traits
- Train preference model on resulting data
- Outcome: Claude 3 is "more engaging and interesting to talk to"

Spirit checks provide a **programmatic way** to validate these character traits in application code.

---

### 5. Severity Levels and Intent Tracking

#### pie-players Approach

Uses **severity levels** to distinguish hard requirements from aspirational goals:

```yaml
severity: error  # Must pass
severity: warn   # Can fail without blocking
```

**Use Case**: Track assessment-toolkit intent before implementation is complete

**Example**:
```yaml
- id: assessment-toolkit/tts/word-highlighting-sync
  severity: warn
  intent: "Text-to-speech highlights the currently spoken word"
```

This allows:
- AI agents to understand desired behavior
- Manual QA to verify once implemented
- Documentation of feature roadmap
- Gradual hardening (warn → error as implementation matures)

#### BarbellBee Approach

Uses **spirit checks** to separate logical correctness from quality:

```yaml
expected:
  prescription:
    weight: { equals: 115.0 }  # Must be correct

spirit_checks:
  - "Tone is encouraging"  # Must be high-quality
```

Both must pass for eval to succeed.

**Trade-off**:
- pie-players: Explicit severity per eval
- BarbellBee: Implicit severity (both assertions + spirit must pass)

---

### 6. Assertion Operators

#### pie-players Operators

Limited to UI-focused matchers:

```yaml
expect:
  equals: "exact-value"
  contains: "substring"
  containsAny: ["option1", "option2"]
  exists: true  # or false
  valueContains: "substring"  # for input values
```

#### BarbellBee Operators

Rich set for numerical and logical validation:

```yaml
field:
  equals: value
  range: [min, max]
  greaterThan: value
  greaterThanOrEqual: value
  lessThan: value
  lessThanOrEqual: value
  contains: "substring"
  contains: ["phrase1", "phrase2"]  # all must be present
  in: [value1, value2, value3]      # one of these
  notEquals: value
  notContains: "substring"
```

**Advantage**: BarbellBee's operators enable more expressive assertions without custom code.

---

### 7. Scale and Coverage

#### pie-players
- **11 eval files** across 2 areas (item-players, assessment-toolkit)
- **Categories**:
  - Item Players: load-and-errors, session-and-events, env-modes-and-roles, authoring-mode
  - Assessment Toolkit: event-contracts, tools-coordination, tts-and-highlights, response-discovery, navigation-and-persistence, a11y-intent

#### BarbellBee
- **86 eval files** covering 36 use cases
- **2-5 variants per use case**:
  - Main scenario (happy path)
  - Edge cases (boundary conditions)
  - Variations (alternative paths)
  - Error scenarios (invalid inputs)

**Coverage Model**: BarbellBee uses a **use case taxonomy** (UC-001 through UC-036) with multiple variants per use case.

---

### 8. Real-World Example Comparison

#### pie-players Example: Session Event Forwarding

```yaml
- id: item-players/mc_basic/session-changed-plumbing/iife
  severity: warn
  intent: "session-changed DOM events inside PieItemPlayer are forwarded"
  steps:
    - action: navigate
      path: "/evals/item-player/mc_basic?player=iife&mode=gather"
    - action: observe
      target: { testId: player-host }
      expect: { exists: true }
    - action: dispatchEvent
      target: { testId: player-host }
      eventType: "session-changed"
      detail: { complete: false, component: "manual" }
    - action: observe
      target: { testId: last-event-type }
      expect: { equals: "session-changed" }
    - action: observe
      target: { testId: last-session-changed }
      expect: { contains: "\"manual\"" }
```

**What it validates**:
- Event bubbling through custom element boundaries
- Event data preservation
- Observable state updates

**Strengths**:
- Tests real DOM behavior
- Validates integration of multiple systems
- Deterministic via event injection

**Limitations**:
- No validation of user-facing implications
- No tone/quality checks
- Only tests technical correctness

#### BarbellBee Example: Baseline Establishment

```yaml
use_case:
  id: UC-001
  variant: baseline-on-target
  description: "First squat session baseline establishment"

context:
  user_profile:
    experience_level: NOVICE
    estimated_1rm: { back_squat: 185.0 }
  exercise:
    id: back_squat
    increment: 5.0
  history:
    - session:
        weight: 110.0
        reps: [5, 5, 5]
        rpe: 7.0
        type: BASELINE_ESTABLISHMENT

expected:
  prescription:
    weight: { equals: 115.0 }
    sets: { equals: 3 }
    rpe_target: { range: [7.0, 7.5] }
  metadata:
    recommendation_type: { equals: "standard_progression" }
    baseline_status: { equals: "confirmed" }
  reasoning:
    contains: ["Perfect start", "right starting weight", "7.0"]
    notContains: ["adjust", "problem"]

spirit_checks:
  - "Reasoning explains that RPE 7.0 matches target"
  - "User receives positive reinforcement about starting weight"
  - "Next session is clearly prescribed: 3×5 @ 115 lbs, RPE 7.0-7.5"
  - "Tone is encouraging: 'on track' or 'consistent weekly progression'"
```

**What it validates**:
- Numerical correctness (weight, sets, reps)
- Metadata generation (recommendation type, baseline status)
- **Reasoning content** (required and forbidden phrases)
- **Tone and quality** (supportive, actionable, confidence-building)

**Strengths**:
- Validates both correctness AND user experience
- Catches AI-generated text that's technically correct but unhelpful
- Enforces transparency and supportiveness

---

## Industry Best Practices

Based on web research, here are key findings relevant to both projects:

### 1. Three-Level Evaluation Hierarchy (Hamel Husain)

**Level 1: Unit Tests** (Fast, cheap)
- Run on every code change
- Organized by features/scenarios
- Both projects operate at this level

**Level 2: Human & Model Evaluation**
- Requires logging traces
- Human review with custom tools
- LLM-based critiques aligned to human judgment
- **Spirit checks fit here**: Programmatic validation of human-like quality judgments

**Level 3: A/B Testing**
- Real user validation
- Measures actual outcomes

### 2. Core Principle: "Never Stop Looking at Data"

Hamel Husain: "You can never stop looking at data—no free lunch exists."

**Application**:
- Start by examining ALL test cases
- Sample more selectively over time
- Use evals to *reduce* but not *eliminate* manual review

### 3. LLM-as-Judge

From Humanloop research: GPT-4 achieves **80%+ agreement with humans** when properly calibrated.

**Application to Spirit Checks**:
- Could use LLM to validate spirit checks initially
- Refine patterns based on LLM feedback
- Eventually codify into deterministic checks

### 4. YAML-Based Test Specifications

**Benefits** (from Promptfoo testimonials):
- Human-readable for non-programmers
- Version control friendly (clear diffs)
- Declarative (separates definition from execution)
- Portable across teams and tools
- Strong tooling support

**Both projects validate this approach**:
- pie-players: UI test specs
- BarbellBee: Business logic test specs

### 5. SWE-bench Standard

The industry benchmark for AI coding agents:
- Resolution rate: 60-75% on real GitHub issues
- Metrics: API call efficiency, cost analysis, attempt tracking
- **Key insight**: Tests must validate actual correctness, not just plausibility

**Application**: Spirit checks provide this rigor for user-facing text.

### 6. Anthropic's Character Training

Process:
1. Generate multiple responses to character-relevant prompts
2. Claude ranks responses by alignment with desired traits
3. Train preference model on resulting data

**Spirit checks = Character validation for application code**

### 7. Unreliable Approaches to Avoid (Eugene Yan)

- N-gram metrics (ROUGE, METEOR): Poor discrimination
- Vector similarity: Lacks discriminative power
- G-Eval: Low recall
- ChatGPT for factual checking: Only 53-58% accuracy

**Implication**: Deterministic pattern matching (like SpiritChecker) may be more reliable than LLM-based validation.

---

## Recommendations for pie-players

### 1. Add Spirit Checks

**Motivation**:
- Validate accessibility intent beyond WCAG compliance
- Ensure error messages are helpful and non-technical
- Verify that user guidance is actionable

**Example** (hypothetical):

```yaml
- id: assessment-toolkit/tools/calculator-error-message
  severity: error
  intent: "Calculator displays helpful error for invalid expression"
  steps:
    - action: navigate
      path: "/evals/assessment-toolkit"
    - action: click
      target: { testId: tool-calculator-open }
    - action: type
      target: { testId: calculator-input }
      value: "2 / 0"
    - action: observe
      target: { testId: calculator-error }
      expect: { exists: true }

  spirit_checks:
    - "Error message avoids technical jargon (no 'NaN' or 'Infinity')"
    - "Suggests corrective action: 'try a different number' or similar"
    - "Tone is non-judgmental: no 'invalid' or 'wrong'"
    - "User understands what went wrong without frustration"
```

**Implementation**:
- Add `spirit_checks` field to YAML schema
- Implement `SpiritChecker` class (port from BarbellBee)
- Run spirit checks after all assertions pass
- Report spirit check failures separately from assertion failures

### 2. Expand Assertion Operators

Add operators from BarbellBee:
- `range: [min, max]` for numerical bounds
- `greaterThan`, `lessThan` for comparisons
- `in: [...]` for set membership
- `notEquals`, `notContains` for negations

**Benefit**: More expressive assertions without custom code.

### 3. Add Use Case Taxonomy

Current structure:
```
docs/evals/
├── item-players/
│   ├── load-and-errors/
│   └── session-and-events/
└── assessment-toolkit/
    ├── event-contracts/
    └── tools-coordination/
```

Proposed addition:
```
docs/evals/
├── use-cases/
│   ├── UC-001-item-loading/
│   │   ├── UC-001-iife-success.eval.yaml
│   │   ├── UC-001-iife-failure.eval.yaml
│   │   └── UC-001-esm-success.eval.yaml
│   └── UC-002-session-management/
│       ├── UC-002-session-start.eval.yaml
│       └── UC-002-session-update.eval.yaml
```

**Benefit**: Clearer mapping to user scenarios, easier to track coverage.

### 4. Consider CI Integration

**Current**: Local-only, opt-in
**Proposed**: Add subset of critical evals to CI

**Strategy**:
- Mark critical evals with `ci: true` flag
- Run only those evals in CI (faster)
- Keep full suite for local development

**Trade-off**: Slower CI vs. higher confidence

### 5. Add Reasoning Validation

Many assessment-toolkit features generate messages for users. Validate content:

```yaml
expected:
  user_message:
    contains: ["saved successfully", "your progress"]
    notContains: ["error", "failed", "invalid"]
```

**Benefit**: Catch misleading or unhelpful messages before they reach users.

---

## Recommendations for BarbellBee

### 1. Add Accessibility Testing

**Motivation**: Training app likely has UI components that need WCAG validation.

**Approach**:
- Add `axe` action to eval runner
- Run accessibility scans on key UI flows
- Integrate with existing Playwright tests (if any)

### 2. Consider Playwright for UI Evals

**Motivation**: If BarbellBee has web UI, end-to-end testing would complement unit tests.

**Strategy**:
- Keep existing unit test evals
- Add UI interaction evals using pie-players pattern
- Use same YAML format for consistency

### 3. Expand Spirit Check Patterns

Current SpiritChecker handles:
- Quoted phrases
- Concept keywords
- Semantic matching

**Additions**:
- Sentiment analysis (positive/negative tone detection)
- Readability metrics (Flesch-Kincaid, reading level)
- Named entity recognition (ensure user name appears in reasoning)

### 4. Add Performance Benchmarks

**Motivation**: Algorithm efficiency matters for user experience.

**Approach**:
```yaml
expected:
  performance:
    execution_time:
      lessThan: 100  # milliseconds
    memory_usage:
      lessThan: 1024  # KB
```

---

## Adapting Spirit Checks for AI Coding Agents

### Why Spirit Checks Matter for AI Agents

1. **AI generates user-facing text**: Agents write error messages, docs, comments
2. **Tone varies by model**: Different prompts/models produce different styles
3. **Quality is subjective**: Hard to validate programmatically without spirit checks
4. **Prevents tone-deaf output**: Catches technically correct but unhelpful messages

### Example: Error Message Generation

**Without spirit checks**:
```typescript
// AI-generated code
throw new Error("Invalid input: parameter 'age' must be a number")
```

**With spirit checks**:
```yaml
spirit_checks:
  - "Error message is user-friendly (no 'Invalid' or 'must be')"
  - "Suggests corrective action: 'Please enter your age as a number'"
  - "Tone is helpful, not demanding"
```

**Refined output**:
```typescript
throw new Error("Please enter your age as a number (e.g., 25)")
```

### Example: Documentation Generation

**Without spirit checks**:
```typescript
/** Calculates next session prescription based on context */
function calculateNextSession(context: ProgressionContext): Prescription
```

**With spirit checks**:
```yaml
spirit_checks:
  - "Explains *why* calculation is needed, not just *what* it does"
  - "Mentions key inputs: user profile, exercise history, RPE feedback"
  - "References use case: 'Used to generate weekly progression recommendations'"
```

**Refined output**:
```typescript
/**
 * Generates the next training session prescription by analyzing the user's
 * recent performance (weight, reps, RPE) and adjusting for optimal progression.
 *
 * Used to recommend weekly progressions based on RPE feedback, ensuring users
 * stay in the 7.0-7.5 RPE target range for sustainable strength gains.
 */
function calculateNextSession(context: ProgressionContext): Prescription
```

### Integration with AI Agent Workflows

**Step 1: Agent generates code**
```typescript
const result = await aiAgent.generateCode(prompt)
```

**Step 2: Run standard tests**
```bash
bun test
```

**Step 3: Run evals (including spirit checks)**
```bash
bun run test:evals
```

**Step 4: If spirit checks fail, provide feedback**
```typescript
if (evalResult.spiritChecksFailed) {
  await aiAgent.refine({
    code: result.code,
    feedback: evalResult.spiritCheckFailures,
    instruction: "Improve tone and clarity of user-facing messages"
  })
}
```

**Step 5: Iterate until both correctness and quality pass**

---

## Key Insights

### 1. Spirit Checks Fill a Gap

Traditional testing validates:
- ✅ Correctness (does it work?)
- ✅ Performance (is it fast?)
- ✅ Security (is it safe?)

Spirit checks validate:
- ✅ **Usability** (is it helpful?)
- ✅ **Tone** (is it supportive?)
- ✅ **Clarity** (is it understandable?)

**This is crucial for AI-generated content**, which can be technically correct but unhelpful.

### 2. YAML-Based Evals Are Production-Ready

Both projects demonstrate that YAML-based test specifications:
- Scale to 10-100+ eval files
- Integrate with modern test runners (Playwright, JUnit)
- Support both AI agents and human verification
- Provide clear diffs in version control
- Enable non-programmers to contribute test cases

### 3. Local vs CI Integration Trade-offs

**pie-players** (local-only):
- ✅ Fast iteration during development
- ✅ No CI overhead
- ❌ Evals may drift from implementation
- ❌ Manual discipline required

**BarbellBee** (CI-integrated):
- ✅ Continuous validation
- ✅ Catches regressions immediately
- ✅ Enforces quality gate
- ❌ Slower CI builds

**Recommendation**: Start local-only, graduate critical evals to CI once stable.

### 4. Severity Levels Enable Intent Tracking

Using `severity: warn`:
- Documents desired behavior before implementation
- Provides context for AI agents
- Creates natural transition path (warn → error)
- Avoids blocking development on aspirational goals

**This is especially valuable for AI agents**, which can understand intent even when implementation is incomplete.

### 5. Playwright vs Pure Logic Testing

**Playwright** (pie-players):
- ✅ Tests real browser behavior
- ✅ Validates accessibility
- ✅ Catches integration issues
- ❌ Slower execution
- ❌ Flakier results
- ❌ Requires running dev server

**Pure Logic** (BarbellBee):
- ✅ Fast execution
- ✅ Deterministic
- ✅ Easy to debug
- ✅ CI-friendly
- ❌ Doesn't test UI rendering
- ❌ Misses integration issues

**Recommendation**: Use both. Pure logic tests for algorithms, Playwright for UI.

---

## Conclusion

### For pie-players

The BarbellBee eval system offers valuable lessons:

1. **Adopt spirit checks** to validate accessibility intent and user-facing messages
2. **Expand assertion operators** for more expressive validation
3. **Consider use case taxonomy** to improve organization and coverage
4. **Add reasoning validation** for toolkit messages and guidance
5. **Evaluate CI integration** for critical evals

**Biggest Opportunity**: Spirit checks could validate that accessibility features are not just technically compliant but actually helpful to users.

### For BarbellBee

The pie-players eval system offers complementary strengths:

1. **UI interaction testing** via Playwright for web components
2. **Accessibility validation** via axe-core integration
3. **Severity levels** for explicit intent tracking
4. **Event testing** for deterministic validation of async behavior

**Biggest Opportunity**: If BarbellBee has web UI, adapting pie-players' Playwright approach would provide end-to-end coverage.

### For AI Coding Agents

Both eval systems demonstrate that **YAML-based specifications** are ideal for AI agents:
- Explicit steps and expectations
- Human-readable for verification
- Machine-actionable for automation
- Version-controllable for iteration

**Spirit checks are the killer feature** for AI-generated code because they validate qualities that are hard to test otherwise:
- Tone and empathy
- Clarity and actionability
- Transparency and trust-building

**Recommendation**: Any project using AI coding agents should implement spirit checks for user-facing content.

---

## References

### Internal Documentation
- [pie-players evals README](./README.md)
- [BarbellBee evals README](file:///Users/eelco.hillenius/dev/prj/chillenious/barbellbee/docs/usecases/evals/README.md)

### Industry Research
- Hamel Husain: "Your AI Product Needs Evals"
- Humanloop: "LLM Evaluation Guide"
- Eugene Yan: "Patterns for Building LLM-based Systems"
- OpenAI: "OpenAI Evals Repository"
- Anthropic: "Constitutional AI and Character Training"
- SWE-bench: "Benchmarking AI Coding Agents"

### Tools and Frameworks
- OpenAI Evals
- DeepEval
- RAGAS
- Promptfoo
- Guardrails AI
- Braintrust
- LangSmith
- Langfuse

---

**Version**: 1.0
**Date**: January 8, 2026
**Author**: Comparative analysis based on deep exploration of both projects and industry research
