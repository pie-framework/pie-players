# Local Evals (YAML-driven)

This repo uses **local-only** evals to validate `pie-iife-player`, `pie-esm-player`, and the **intent** of `assessment-toolkit` (including accessibility intent).

- **Where**: `docs/evals/**/evals.yaml`
- **How**: YAML case specs + a local Playwright YAML runner (opt-in command; not part of CI).

## Goals

- Provide a shared, reviewable set of **high-signal scenarios** for local development.
- Keep the format **AI-friendly** (explicit steps + explicit expectations) and also usable for manual QA.
- Track **assessment-toolkit intent** even when implementation is incomplete (via `severity: warn`).
- Validate **semantic quality and tone** of user-facing content (via `spirit_checks`).

## Running locally

From repo root (recommended, if eval runner scripts are configured in your host app):

```bash
bun run --cwd apps/section-demos test:evals
```

From `apps/section-demos` (equivalent):

```bash
bun run test:evals
```

Optional:

```bash
bun run test:evals:ui
bun run test:evals:headed
```

## Directory layout

- `docs/evals/item-players/` — iife + esm player behaviors (loading, events, env modes, authoring)
- `docs/evals/assessment-toolkit/` — toolkit intent + contracts (events, tools, TTS, response discovery, a11y intent)
- `docs/evals/tools/` — individual tool testing (color-scheme, calculator, graph, etc.)

## Controller Loading: `hosted` Property

Both IIFE and ESM players support the `hosted` property to control where PIE controllers execute:

### Client-Side Processing (Default)

```typescript
<pie-iife-player hosted={false} ... />  // Loads client-player.js with controllers
<pie-esm-player hosted={false} ... />   // Loads element + controller modules
```

When `hosted={false}` (default):

- **IIFE Player**: Loads `client-player.js` bundle containing elements + controllers
- **ESM Player**: Dynamically imports both element modules and `/controller` subpath modules
- Controllers execute on the client to transform student responses into scored outcomes
- Suitable for development, testing, and client-side deployments

### Server-Side Processing (Production)

```typescript
<pie-iife-player hosted={true} ... />   // Loads player.js without controllers
<pie-esm-player hosted={true} ... />    // Skips controller module loading
```

When `hosted={true}`:

- **IIFE Player**: Loads `player.js` bundle with elements only (no controllers)
- **ESM Player**: Skips importing `/controller` subpath modules
- Server must handle model transformation via `/player/load` and `/player/score` endpoints
- Suitable for server-side deployments where controllers run on backend

### Bundle Type Decision Logic

**IIFE Player** ([PieIifePlayer.svelte:222-225](../../packages/iife-player/src/PieIifePlayer.svelte#L222-L225)):

```typescript
const bundleType = mode === 'author'
    ? BundleType.editor      // editor.js for authoring
    : (hosted ? BundleType.player : BundleType.clientPlayer);
const needsControllers = !hosted;
```

**ESM Player** ([PieEsmPlayer.svelte:199-201](../../packages/esm-player/src/PieEsmPlayer.svelte#L199-L201)):

```typescript
const needsControllers = !hosted;
await esmLoader.load(transformedConfig, document, needsControllers);
```

### Example Usage in Evals

All eval harness pages use `hosted={false}` to test client-side controller processing:

```yaml
- id: item-players/mc_basic/controller-execution/iife
  severity: error
  intent: "IIFE player loads client-player.js with controllers for client-side scoring"
  steps:
    - action: navigate
      path: "/evals/item-player/mc_basic?player=iife&mode=gather"
      # Player automatically uses hosted={false}

    - action: click
      target: { testId: choice-option-a }

    - action: observe
      target: { testId: last-event-type }
      expect: { equals: "session-changed" }
      # Confirms controllers processed response on client
```

### Architecture Comparison

| Aspect          | IIFE (`hosted=false`) | IIFE (`hosted=true`) | ESM (`hosted=false`)       | ESM (`hosted=true`) |
| --------------- | --------------------- | -------------------- | -------------------------- | ------------------- |
| **Bundle Type** | `client-player.js`    | `player.js`          | Individual modules         | Individual modules  |
| **Controllers** | ✅ Included            | ❌ Not included       | ✅ Loaded via `/controller` | ❌ Skipped           |
| **Processing**  | Client-side           | Server-side          | Client-side                | Server-side         |
| **Use Case**    | Testing, development  | Production           | Modern deployments         | Production          |
| **CDN Format**  | Monolithic bundle     | Monolithic bundle    | Separate imports           | Separate imports    |

### When to Use Each Mode

**Use `hosted={false}` (default) for:**

- Local development and testing
- Eval harness validation
- Client-side deployments (static hosting)
- Offline/embedded scenarios
- Rapid prototyping

**Use `hosted={true}` for:**

- Production deployments with server-side processing
- Scenarios requiring centralized scoring logic
- When controller code must remain private
- Bandwidth-constrained environments (smaller bundles)

## Player Modes and Roles

The item player eval harness supports multiple modes and roles via query parameters:

### Modes

- **`gather`** (default) - Student response gathering mode (editable, interactive)
- **`view`** - View-only mode (read-only, no editing)
- **`evaluate`** - Instructor evaluation mode (shows scoring/correctness)
- **`browse`** - Browse mode with correct answers pre-populated (automatically sets role=instructor)
- **`author`** - Authoring/configuration mode (requires editor bundles)

### Roles

- **`student`** (default) - Student role
- **`instructor`** - Instructor role (may show additional feedback/controls)

### Browse Mode

Browse mode is a special mode that:

1. Maps internally to `view` mode (read-only display)
2. Automatically sets `role=instructor` (for correct answer access)
3. Sets `addCorrectResponse=true` (populates session with correct answers)
4. Calls `createCorrectResponseSession()` on PIE controllers to fetch correct answers

**Use browse mode for:**

- Authoring workflows (preview with correct answers)
- Content review (verify correct responses are configured)
- Answer key generation

**Example:**

```yaml
- id: item-players/mc_basic/browse-mode/iife
  sampleId: mc_basic
  severity: warn
  intent: "Browse mode loads with correct responses populated"
  steps:
    - action: navigate
      path: "/evals/item-player/mc_basic?player=iife&mode=browse"
    - action: observe
      target: { testId: player-mode }
      expect: { equals: "browse" }
```

## YAML format (v1)

Each `evals.yaml` looks like:

```yaml
version: 1

component:
  area: item-players
  underTest: pie-iife-player

examplesApp:
  app: "@pie-framework/pie-players-example"
  routeTemplate: "/evals/item-player/{sampleId}?player={player}&mode={mode}&role={role}"

evals:
  - id: item-players/mc_basic/load-complete/iife
    sampleId: mc_basic
    severity: error # error | warn
    intent: "Loads iife player and emits load-complete."
    steps:
      - action: navigate
        path: "/evals/item-player/mc_basic?player=iife&mode=gather&role=student"
      - action: observe
        target:
          testId: player-root
      - action: observe
        target:
          testId: last-event-type
        expect:
          equals: "load-complete"
```

### Concepts

- **`severity`**:
  - `error` means failures should fail the local run.
  - `warn` means failures are reported but do **not** fail the run (useful for "intent" cases).

- **`spirit_checks`** (optional):
  - Validates semantic quality and tone beyond technical correctness.
  - Each check is a natural language statement about user experience.
  - Inspired by external eval frameworks while remaining repo-specific.

### Supported actions (runner)

The runner supports a small action vocabulary (similar spirit to `pie-qti`):

- `navigate`: `path`
- `click`: by `target.testId` (or by role/name fallback)
- `type`: `target.testId` + `value`
- `select`: `target.testId` + `value`
- `observe`: assert UI state via `target.testId` + `expect` matcher
- `dispatchEvent`: dispatch a DOM event on `target.testId` with `eventType` and JSON `detail`
- `axe`: run axe-core scan (optional, local only)

### Supported assertion operators

The `expect` field in `observe` actions supports these operators:

**String/Text Matchers:**
- `equals: "exact-value"` - exact text match
- `contains: "substring"` - text contains substring
- `containsAny: ["opt1", "opt2"]` - text contains any of the options
- `notEquals: "value"` - text does not equal value
- `notContains: "substring"` - text does not contain substring
- `in: ["val1", "val2", "val3"]` - text equals one of these values

**Numeric Matchers:**
- `range: [min, max]` - numeric value within range (inclusive)
- `greaterThan: number` - numeric value > threshold
- `greaterThanOrEqual: number` - numeric value >= threshold
- `lessThan: number` - numeric value < threshold
- `lessThanOrEqual: number` - numeric value <= threshold

**Existence Matchers:**
- `exists: true` - element exists in DOM
- `exists: false` - element does not exist in DOM

**Input Value Matchers:**
- `valueContains: "substring"` - input value contains substring

**Accessibility Matchers:**
- `maxViolations: number` - max allowed axe violations (used with `axe` action)

## Spirit Checks

Spirit checks validate **semantic quality and tone** beyond technical correctness. They answer:
- Does the user understand *why* something happened?
- Is the tone appropriate (supportive, clear, non-judgmental)?
- Are next steps actionable?
- Does the message avoid jargon or technical terms?

### How Spirit Checks Work

Spirit checks use **pattern matching** to validate page content:

1. **Quoted phrases** (required to be present):
   ```yaml
   spirit_checks:
     - "Message includes 'try again' or similar helpful guidance"
   ```

2. **Forbidden words** (must NOT be present):
   ```yaml
   spirit_checks:
     - "Error message avoids 'invalid' or 'wrong'"
   ```

3. **Tone validation**:
   ```yaml
   spirit_checks:
     - "Tone is supportive and encouraging"
   ```

4. **Explanatory language**:
   ```yaml
   spirit_checks:
     - "User understands why the action was needed"
   ```

### Spirit Check Examples

**Example 1: Error Message Quality**
```yaml
- id: assessment-toolkit/calculator/error-message-quality
  severity: error
  intent: "Calculator shows helpful error for division by zero"
  steps:
    - action: navigate
      path: "/evals/assessment-toolkit"
    - action: click
      target: { testId: tool-calculator-open }
    - action: type
      target: { testId: calculator-input }
      value: "10 / 0"
    - action: observe
      target: { testId: calculator-error }
      expect: { exists: true }

  spirit_checks:
    - "Error message avoids technical jargon (no 'NaN' or 'Infinity')"
    - "Message suggests corrective action like 'try a different number'"
    - "Tone is non-judgmental: no 'invalid' or 'wrong'"
    - "User understands what went wrong without frustration"
```

**Example 2: Accessibility Feedback**
```yaml
- id: assessment-toolkit/a11y/screen-reader-guidance
  severity: warn
  intent: "Screen reader announces navigation state changes"
  steps:
    - action: navigate
      path: "/evals/assessment-toolkit"
    - action: click
      target: { testId: next-question-btn }
    - action: observe
      target: { testId: sr-announcement }
      expect: { exists: true }

  spirit_checks:
    - "Announcement mentions 'Question 2 of 10' or similar progress"
    - "User understands their position in the assessment"
    - "Message is concise (under 20 words) to avoid overwhelming users"
```

**Example 3: Tool Coordination**
```yaml
- id: assessment-toolkit/tools/calculator-ready-message
  severity: error
  intent: "Calculator announces when it's ready to use"
  steps:
    - action: navigate
      path: "/evals/assessment-toolkit"
    - action: click
      target: { testId: tool-calculator-open }
    - action: observe
      target: { testId: calculator-status }
      expect: { contains: "ready" }

  spirit_checks:
    - "Status message is actionable: 'calculator ready' or 'enter expression'"
    - "User knows they can start typing immediately"
```

### When to Use Spirit Checks

**Use spirit checks for:**
- User-facing error messages
- Status announcements
- Accessibility feedback (ARIA labels, live regions)
- Guidance text for tools and features
- Success/failure confirmations

**Don't use spirit checks for:**
- Pure technical validation (use `observe` assertions)
- Internal state verification
- Event plumbing and contracts
- Performance or timing checks

### Writing Good Spirit Checks

**Good Examples:**
```yaml
spirit_checks:
  - "Error message avoids 'invalid input' and uses plain language"
  - "Tone is encouraging: mentions 'you can' or 'try'"
  - "User understands next steps clearly"
```

**Avoid:**
```yaml
spirit_checks:
  - "The message is good"  # Too vague
  - "Everything looks correct"  # Not measurable
  - "UI is nice"  # Subjective, no validation criteria
```

**Best Practices:**
1. **Be specific**: Reference exact phrases in quotes or describe patterns clearly
2. **Focus on user impact**: What does the user understand or feel?
3. **Check tone**: Is it supportive, clear, non-judgmental?
4. **Validate guidance**: Are next steps actionable?
5. **Avoid jargon**: Ensure messages use plain language

## Best Practices

### Eval Organization

**Use descriptive IDs:**
```yaml
# Good: Clear hierarchy and purpose
- id: assessment-toolkit/navigation/next-button-disabled-on-last-question

# Avoid: Vague or overly generic
- id: test-1
```

**Group related scenarios:**
```
docs/evals/
├── assessment-toolkit/
│   ├── event-contracts/        # Event plumbing
│   ├── tools-coordination/     # Tool visibility and focus
│   ├── navigation-and-persistence/  # User journey
│   └── a11y-intent/           # Accessibility quality
```

### Severity Guidelines

**Use `severity: error` for:**
- Core functionality that must work
- Accessibility requirements (WCAG violations)
- Event contracts between components
- Critical user journeys

**Use `severity: warn` for:**
- Aspirational features not yet implemented
- Enhanced UX improvements
- Optional optimizations
- Intent tracking during development

### Intent Statements

Write clear intent statements that explain *what* and *why*:

```yaml
# Good: Explains both behavior and purpose
intent: "Calculator tool closes when user clicks outside, preserving focus order"

# Avoid: Too technical or vague
intent: "Click handler works"
```

### Step Design

**Keep steps focused:**
```yaml
# Good: One clear action per step
steps:
  - action: navigate
    path: "/evals/assessment-toolkit"
  - action: click
    target: { testId: tool-calculator-open }
  - action: observe
    target: { testId: calculator-panel }
    expect: { exists: true }
```

**Make observations explicit:**
```yaml
# Good: Verify state before proceeding
- action: observe
  target: { testId: player-host }
  expect: { exists: true }
- action: dispatchEvent
  target: { testId: player-host }
  eventType: "session-changed"
```

### Spirit Check Guidelines

1. **Test the user experience**, not just correctness
2. **Focus on communication quality**: tone, clarity, actionability
3. **Validate accessibility feedback** is helpful, not just present
4. **Check for forbidden patterns** (jargon, negative tone)
5. **Ensure guidance is actionable**, not just descriptive

See templates:

- `docs/evals/item-players/evals.template.yaml`
- `docs/evals/assessment-toolkit/evals.template.yaml`

## Implementation Details

### Test Runner

The eval system is implemented in host-app eval specs (for example, under `apps/section-demos/tests/evals/`).

**Key features:**
- Recursively discovers all `evals.yaml` files in `docs/evals/`
- Generates Playwright tests dynamically from YAML
- Executes steps sequentially with proper error handling
- Validates spirit checks after all steps complete
- Honors severity levels (error vs warn)
- Provides detailed failure messages

**Execution flow:**
1. Load and parse YAML files
2. Generate test suite for each eval file
3. For each eval case:
   - Execute all steps in order
   - Run spirit checks (if present)
   - Handle failures based on severity
4. Report results with annotations for warnings

### Adding New Assertion Operators

To add a new operator, modify `runObserve()` in the test runner:

```typescript
if ("yourOperator" in matcher) {
  await expect(loc).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
  await expect
    .poll(
      async () => {
        const text = (await loc.innerText().catch(() => "")).trim();
        // Your validation logic
        return /* boolean result */;
      },
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBe(true);
  return;
}
```

### Spirit Check Pattern Matching

Spirit checks use multiple validation strategies:

1. **Quoted Phrase Extraction**: Regex `/(['"])(.*?)\1/g` finds exact text requirements
2. **Forbidden Word Detection**: Patterns like `/no ['"]([^'"]+)['"]/gi` identify text that must NOT appear
3. **Tone Analysis**: Keywords like "supportive", "encouraging" trigger sentiment validation
4. **Explanatory Language**: Keywords like "user understands" check for causal words (because, since, etc.)
5. **Concept Matching**: Long words (>4 chars) from unquoted portions provide semantic context

## Approach and Philosophy

### Two-Level Validation

The eval system validates at two levels:

**Level 1: Technical Correctness** (via assertion operators)
- Does the component load?
- Do events fire correctly?
- Is the data accurate?
- Does state update properly?

**Level 2: User Experience Quality** (via spirit checks)
- Is the message helpful?
- Is the tone appropriate?
- Can users understand what to do next?
- Does it avoid jargon and technical terms?

This dual approach is especially valuable for:
- **AI-generated content**: Catches technically correct but unhelpful output
- **Accessibility features**: Ensures feedback is helpful, not just present
- **Error messages**: Validates supportive tone and actionable guidance
- **Tool coordination**: Confirms clear state change communication

### Intent Tracking with Severity Levels

The `severity: warn` feature enables **intent-first development**:

```yaml
- id: future-feature
  severity: warn  # Won't block tests
  intent: "Describes desired behavior before implementation"
  steps: # ...
  spirit_checks:
    - "User receives encouraging feedback"
```

**Benefits:**
- Documents desired behavior early
- Provides context for AI coding agents
- Creates natural transition path (warn → error as features mature)
- Enables progressive hardening of test suite

### AI Coding Agent Support

This eval system is optimized for AI coding agents:

**Explicit Structure:**
- Clear YAML schema with well-defined fields
- Step-by-step action sequences
- Explicit expectations for each observation

**Human-Readable:**
- Natural language intent statements
- Descriptive IDs and notes
- Spirit checks in plain English

**Machine-Actionable:**
- Deterministic test execution
- Programmatic validation
- Clear pass/fail criteria

**Quality Validation:**
- Spirit checks catch tone-deaf AI output
- Validates user-facing content quality
- Ensures accessibility feedback is helpful

## Examples and Templates

### Example Eval Files

Working examples in this repository:

**Item Players:**
- [load-and-errors](./item-players/load-and-errors/evals.yaml) - Basic loading and error scenarios
- [session-and-events](./item-players/session-and-events/evals.yaml) - Event forwarding and plumbing
- [env-modes-and-roles](./item-players/env-modes-and-roles/evals.yaml) - Environment configuration
- [authoring-mode](./item-players/authoring-mode/evals.yaml) - Authoring mode validation

**Assessment Toolkit:**
- [event-contracts](./assessment-toolkit/event-contracts/evals.yaml) - Event API contracts
- [tools-coordination](./assessment-toolkit/tools-coordination/evals.yaml) - Tool visibility and focus
- [navigation-and-persistence](./assessment-toolkit/navigation-and-persistence/evals.yaml) - User journeys
- [a11y-intent](./assessment-toolkit/a11y-intent/evals.yaml) - Accessibility requirements
- [spirit-checks-examples](./assessment-toolkit/spirit-checks-examples/evals.yaml) - Spirit check demonstrations

### Quick Start Template

```yaml
version: 1

component:
  area: your-area
  underTest: "your-component"

examplesApp:
  app: "@pie-framework/pie-players-example"
  routeTemplate: "/your/route/template"

evals:
  - id: your-area/feature/scenario
    severity: error  # or warn
    intent: "Clear description of what and why"
    notes:
      - "Optional: Additional context"
      - "Optional: Implementation notes"
    steps:
      - action: navigate
        path: "/your/test/path"

      - action: observe
        target: { testId: some-element }
        expect: { exists: true }

      - action: click
        target: { testId: some-button }

      - action: observe
        target: { testId: result }
        expect: { contains: "expected text" }

    spirit_checks:  # Optional
      - "User understands what happened"
      - "Message uses supportive tone"
      - "Guidance is actionable"
```

## Troubleshooting

### Common Issues

**Spirit check fails unexpectedly:**
- Check that quoted phrases match exactly (case-insensitive)
- Verify forbidden words aren't present in unrelated content
- Use browser DevTools to inspect actual page text

**Numeric matchers not working:**
- Ensure target element contains numeric text (e.g., "42" not "forty-two")
- Check element is visible (Playwright reads visible text only)

**Test timeout:**
- Increase timeout in observe actions (default: 15s)
- Verify element exists and is visible in browser
- Check for race conditions (add explicit observe steps)

### Debugging Tips

**Run in UI mode:**
```bash
bun run test:evals:ui
```

**Run in headed mode:**
```bash
bun run test:evals:headed
```

**Filter to specific test:**
```bash
bun run test:evals --grep "your-test-id"
```

**Inspect failures:**
- Check `playwright-report/` for HTML report
- Review screenshots in test artifacts
- Use `console.warn` output for spirit check failures

## Related Documentation

- Use this guide as the canonical evals reference for spirit checks and quality gates.


