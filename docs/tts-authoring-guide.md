# TTS Authoring Guide: Using SSML for Better Prosody

**Audience:** Content authors, item developers
**Date:** February 6, 2026

---

## Overview

When authoring assessment content for text-to-speech (TTS), you may notice that the synthesized speech runs sentences together without natural pauses. This happens when content lacks proper punctuation, especially with:

- Question titles followed immediately by body text
- Multiple choice options (A, B, C, D) that run together
- Headings without ending punctuation

**Solution:** Use SSML (Speech Synthesis Markup Language) to control pacing and prosody.

---

## Quick Start: Common Patterns

### Pattern 1: Question Title + Body Text

**Problem:**
```json
{
  "prompt": "<h3>Question 1: Method Selection</h3><p>Based on the passage, which method...</p>"
}
```

**How it sounds:** "Question one method selection based on the passage which method..." (runs together)

**Solution - Add SSML with breaks:**
```json
{
  "prompt": "<speak><prosody rate=\"medium\">Question 1: Method Selection<break time=\"300ms\"/></prosody>Based on the passage, which method...</speak>"
}
```

**How it sounds:** "Question one: Method Selection. *[pause]* Based on the passage..."

### Pattern 2: Multiple Choice Options

**Problem:**
```json
{
  "choices": [
    {"label": "A", "value": "a", "content": "The quadratic formula, because it works for all equations"},
    {"label": "B", "value": "b", "content": "Factoring, because this equation factors easily"}
  ]
}
```

**How it sounds:** "A the quadratic formula because it works for all equations B factoring because..." (no pause between options)

**Solution - Add punctuation in content:**
```json
{
  "choices": [
    {"label": "A", "value": "a", "content": "The quadratic formula, because it works for all equations."},
    {"label": "B", "value": "b", "content": "Factoring, because this equation factors easily."}
  ]
}
```

Or use SSML in a catalog:
```json
{
  "prompt": "<div data-catalog-id=\"question-1-prompt\">...</div>",
  "accessibilityCatalogs": [{
    "identifier": "question-1-prompt",
    "cards": [{
      "catalog": "spoken",
      "language": "en-US",
      "content": "<speak>Based on the passage, which method should you use? <break time=\"200ms\"/> Option A. <prosody rate=\"slow\">The quadratic formula</prosody>, because it works for all equations. <break time=\"200ms\"/> Option B...</speak>"
    }]
  }]
}
```

### Pattern 3: Math Expressions

**Problem:** "x² - 5x + 6 = 0" sounds like "x two minus five x plus six equals zero" (too fast, unclear)

**Solution - Add SSML for controlled pacing:**
```json
{
  "accessibilityCatalogs": [{
    "identifier": "equation-1",
    "cards": [{
      "catalog": "spoken",
      "language": "en-US",
      "content": "<speak><prosody rate=\"slow\">x squared<break time=\"200ms\"/> minus five x<break time=\"200ms\"/> plus six<break time=\"200ms\"/> equals zero</prosody></speak>"
    }]
  }]
}
```

---

## SSML Elements You Should Know

### 1. `<break>` - Add Pauses

Adds a pause of specified duration.

```xml
<speak>
  First sentence.<break time="300ms"/>Second sentence.
</speak>
```

**Strength levels** (approximate durations):
- `x-weak`: ~50ms
- `weak`: ~100ms
- `medium`: ~200ms (default)
- `strong`: ~300ms
- `x-strong`: ~500ms

```xml
<speak>
  First sentence.<break strength="strong"/>Second sentence.
</speak>
```

**Use cases:**
- After headings: 300-500ms
- Between list items: 200ms
- Between clauses: 100ms

### 2. `<prosody>` - Control Speaking Rate

Controls speed, pitch, and volume.

```xml
<speak>
  This is normal speed.
  <prosody rate="slow">This is slow.</prosody>
  <prosody rate="fast">This is fast.</prosody>
</speak>
```

**Rate values:**
- `x-slow`: Very slow (good for complex terms)
- `slow`: Slow (good for math, technical content)
- `medium`: Normal speed (default)
- `fast`: Fast
- `x-fast`: Very fast
- Percentage: `rate="80%"` (relative to default)

**Use cases:**
- Math expressions: `rate="slow"`
- Technical terms: `rate="slow"`
- Review/summary: `rate="medium"`

### 3. `<emphasis>` - Add Emphasis

Makes words stand out with stress.

```xml
<speak>
  This is <emphasis level="strong">very important</emphasis>.
</speak>
```

**Levels:**
- `strong`: Strong emphasis
- `moderate`: Moderate emphasis (default)
- `reduced`: De-emphasize

### 4. `<sub>` - Pronunciation Substitution

Replace written text with spoken equivalent.

```xml
<speak>
  The formula is <sub alias="x squared">x²</sub>.
</speak>
```

**Use cases:**
- Math symbols: `<sub alias="pi">π</sub>`
- Abbreviations: `<sub alias="Doctor">Dr.</sub>`
- Technical terms: `<sub alias="S Q L">SQL</sub>`

### 5. `<phoneme>` - Precise Pronunciation

Specify exact pronunciation using IPA.

```xml
<speak>
  <phoneme alphabet="ipa" ph="təˈmeɪtoʊ">tomato</phoneme>
</speak>
```

**Use cases:**
- Proper names
- Foreign words
- Technical jargon

---

## Embedding SSML in PIE Content

### Method 1: Inline SSML (Automatic Extraction)

The PIE Players automatically extract SSML from content and generate accessibility catalogs.

**Example:**
```json
{
  "models": [{
    "id": "q1",
    "prompt": "<div><speak xml:lang=\"en-US\">Question one:<break time=\"300ms\"/>Method Selection</speak><h3>Question 1: Method Selection</h3><p>Based on the passage...</p></div>"
  }]
}
```

**What happens:**
1. System extracts `<speak>` content
2. Generates catalog entry with ID `auto-prompt-q1`
3. Removes `<speak>` tags from visual markup
4. TTS uses catalog content automatically

### Method 2: Explicit Accessibility Catalogs (QTI 3.0 Standard)

**Recommended for production content.**

```json
{
  "models": [{
    "id": "q1",
    "prompt": "<div data-catalog-id=\"q1-prompt\"><h3>Question 1: Method Selection</h3><p>Based on the passage, which method should you use?</p></div>"
  }],
  "accessibilityCatalogs": [{
    "identifier": "q1-prompt",
    "cards": [{
      "catalog": "spoken",
      "language": "en-US",
      "content": "<speak xml:lang=\"en-US\">Question one:<break time=\"300ms\"/>Method Selection.<break time=\"500ms\"/><prosody rate=\"medium\">Based on the passage, which method should you use to solve x squared minus five x plus six equals zero?</prosody></speak>"
    }]
  }]
}
```

**Benefits:**
- Clean separation of visual and spoken content
- Full SSML control
- Multiple language variants
- Reusable across items

---

## Best Practices

### 1. Always End Sentences with Punctuation

**Bad:**
```
<h3>Question 1: Method Selection</h3>
<p>Based on the passage...</p>
```

**Good:**
```
<h3>Question 1: Method Selection.</h3>
<p>Based on the passage...</p>
```

Or use SSML:
```xml
<speak>Question 1: Method Selection.<break time="300ms"/>Based on the passage...</speak>
```

### 2. Add Breaks Between List Items

For multiple choice questions, ensure each option is clearly separated.

**Bad:**
```
A. First option B. Second option C. Third option
```

**Good (with punctuation):**
```
A. First option. B. Second option. C. Third option.
```

**Better (with SSML):**
```xml
<speak>
  Option A. First option.<break time="200ms"/>
  Option B. Second option.<break time="200ms"/>
  Option C. Third option.
</speak>
```

### 3. Slow Down Complex Content

Use `<prosody rate="slow">` for:
- Mathematical expressions
- Technical terminology
- Foreign language words
- Complex sentences

```xml
<speak>
  Solve the equation:
  <prosody rate="slow">x squared, minus five x, plus six, equals zero</prosody>
</speak>
```

### 4. Use Natural Language for Math

**Bad:** "x² - 5x + 6 = 0" → "x two minus five x plus six equals zero"

**Good:**
```xml
<speak>
  <prosody rate="slow">x squared<break time="150ms"/> minus five x<break time="150ms"/> plus six<break time="200ms"/> equals zero</prosody>
</speak>
```

### 5. Test Your SSML

Always test how your SSML sounds. Use the PIE demos or AWS Polly console to preview.

**Testing checklist:**
- Does it sound natural?
- Are pauses appropriate (not too short/long)?
- Is the speaking rate comfortable?
- Are technical terms pronounced correctly?

---

## SSML Provider Support

Not all TTS providers support SSML equally:

| Provider | SSML Support | Notes |
|----------|--------------|-------|
| **AWS Polly** | ✅ Full | Supports all common tags |
| **Google Cloud TTS** | ✅ Full | Supports all common tags |
| **Azure Speech** | ✅ Full | Supports all common tags |
| **Browser TTS** | ⚠️ Limited | Most browsers ignore SSML |

**Recommendation:** Author with SSML for cloud TTS. The browser fallback will ignore tags and read plain text, which is acceptable for basic functionality.

---

## When NOT to Use SSML

SSML adds complexity. Skip it when:

1. **Content already has good punctuation** - Natural sentence structure doesn't need enhancement
2. **Simple, conversational text** - "Welcome! Let's begin." doesn't need SSML
3. **Testing/development** - Add SSML polish in later authoring phases

**Rule of thumb:** If the text reads naturally when you read it aloud, it probably doesn't need SSML.

---

## Automatic vs Manual SSML

### Automatic Extraction (Inline SSML)

**Pros:**
- Quick to author
- Visual and spoken content stay in sync
- Less boilerplate

**Cons:**
- Mixed markup (visual + SSML) in one field
- Less control over catalog structure
- Auto-generated catalog IDs

**Best for:** Rapid prototyping, simple items

### Manual Catalogs (QTI 3.0)

**Pros:**
- Clean separation
- Full control
- Reusable catalog entries
- Multiple language variants

**Cons:**
- More verbose
- Visual and spoken content can drift
- Requires catalog ID management

**Best for:** Production content, complex items, internationalization

---

## Examples from Real Assessments

### Example 1: Math Word Problem

**Without SSML:**
```json
{
  "prompt": "<p>A rectangle has length x+3 and width x-2. Write an expression for its area.</p>"
}
```

**Sounds like:** "A rectangle has length x plus three and width x minus two write an expression for its area" (run-on, unclear)

**With SSML:**
```json
{
  "prompt": "<div data-catalog-id=\"rect-area-1\"><p>A rectangle has length x+3 and width x-2. Write an expression for its area.</p></div>",
  "accessibilityCatalogs": [{
    "identifier": "rect-area-1",
    "cards": [{
      "catalog": "spoken",
      "language": "en-US",
      "content": "<speak>A rectangle has length <prosody rate=\"slow\">x plus three</prosody><break time=\"200ms\"/> and width <prosody rate=\"slow\">x minus two</prosody>.<break time=\"400ms\"/> Write an expression for its area.</speak>"
    }]
  }]
}
```

**Sounds like:** "A rectangle has length *x plus three* [pause] and width *x minus two*. [pause] Write an expression for its area." (clear, well-paced)

### Example 2: Reading Passage with Questions

**Content structure:**
```
Passage: "Urban Gardens" (3 paragraphs)
Question 1: "According to paragraph 2..." (with 4 options)
Question 2: "The author's main purpose..." (with 4 options)
```

**SSML approach:**
- Passage gets normal speech (no SSML needed - it's prose)
- Question headings get breaks after them
- Each answer option ends with punctuation

```json
{
  "questions": [{
    "id": "q1",
    "prompt": "<div data-catalog-id=\"q1-prompt\"><h4>Question 1: Reading Comprehension</h4><p>According to paragraph 2, what is the main benefit of urban gardens?</p></div>",
    "accessibilityCatalogs": [{
      "identifier": "q1-prompt",
      "cards": [{
        "catalog": "spoken",
        "language": "en-US",
        "content": "<speak>Question one:<break time=\"300ms\"/>Reading Comprehension.<break time=\"500ms\"/>According to paragraph two, what is the main benefit of urban gardens?</speak>"
      }]
    }]
  }]
}
```

---

## AWS Polly SSML Reference (Common Tags)

PIE Players with AWS Polly support these SSML tags:

### Pauses

```xml
<break time="300ms"/>          <!-- Exact duration -->
<break strength="strong"/>      <!-- Named strength -->
```

### Speaking Rate

```xml
<prosody rate="slow">text</prosody>
<prosody rate="80%">text</prosody>
```

### Emphasis

```xml
<emphasis level="strong">important word</emphasis>
```

### Pronunciation

```xml
<sub alias="sequel">SQL</sub>
<phoneme alphabet="ipa" ph="təˈmeɪtoʊ">tomato</phoneme>
```

### Pitch and Volume

```xml
<prosody pitch="high">text</prosody>
<prosody volume="loud">text</prosody>
```

### Language

```xml
<lang xml:lang="es-ES">Hola</lang>
```

**Full reference:** [AWS Polly SSML Tags](https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html)

---

## Prosody Guidelines

### Pause Durations

| Context | Duration | Example |
|---------|----------|---------|
| Between sentences | Natural (.) | Use periods |
| After heading | 300-500ms | `<break time="300ms"/>` |
| Between list items | 200ms | `<break time="200ms"/>` |
| Between clauses | 100ms | Use commas or `<break time="100ms"/>` |
| After labels | 200-300ms | "Question 1: <break time="300ms"/>" |

### Speaking Rates

| Content Type | Rate | Example |
|--------------|------|---------|
| Normal prose | `medium` (default) | Passages, instructions |
| Math expressions | `slow` or `80%` | "x² - 5x + 6" |
| Technical terms | `slow` | "polynomial", "coefficient" |
| Review/summary | `medium` to `fast` | End-of-section review |

---

## Testing Your SSML

### 1. Use the Demo Apps

Test your content in the PIE section demos:
```
http://localhost:5174/demo/your-item-id
```

Click the TTS button and listen - does it sound natural?

### 2. AWS Polly Console

Test SSML directly in the AWS Console:
1. Go to AWS Polly Console
2. Select "Plain text" → "SSML"
3. Paste your SSML
4. Click "Listen"

### 3. Common Issues to Check

- [ ] Natural pacing (not too fast/slow)
- [ ] Appropriate pauses between sections
- [ ] Math expressions clearly pronounced
- [ ] List items separated
- [ ] Technical terms pronounced correctly
- [ ] No awkward pauses mid-sentence

---

## Authoring Workflow

### Recommended Process

1. **Write content naturally** with proper punctuation
   - Use periods after sentences
   - Use commas for pauses
   - End all list items with periods

2. **Test basic TTS** - Does it sound acceptable?
   - If yes: You're done!
   - If no: Proceed to step 3

3. **Identify problem areas**
   - Run-on sections
   - Math expressions
   - Technical terms
   - List items

4. **Add targeted SSML** only where needed
   - Don't over-engineer
   - Focus on the worst issues first

5. **Test again** and iterate

### Simple Content → No SSML Needed

```
"What is the capital of France?"

A. London
B. Paris
C. Berlin
D. Madrid
```

This is fine as-is. Don't add SSML just because you can.

### Complex Content → Use SSML

```
"Question 1: Quadratic Equations

Based on the passage, which method should you use to solve x² - 5x + 6 = 0?

A. The quadratic formula, because it works for all equations
B. Factoring, because this equation factors easily into (x - 2)(x - 3)"
```

This needs SSML:
- Pause after "Question 1: Quadratic Equations"
- Slow down the equation reading
- Pause between options

---

## Summary

### Key Principles

1. **Punctuation first** - Add periods, commas naturally
2. **SSML for enhancement** - Use when punctuation isn't enough
3. **Test early and often** - Listen to how it sounds
4. **Be conservative** - Only add SSML where needed
5. **Use catalogs for production** - Cleaner, more maintainable

### Common Enhancements

- **After headings:** `<break time="300ms"/>`
- **Math expressions:** `<prosody rate="slow">...</prosody>`
- **Between options:** Add periods or `<break time="200ms"/>`
- **Technical terms:** `<sub alias="...">` or `<phoneme>`

### When in Doubt

If you're unsure whether to add SSML:
1. Read the text aloud naturally
2. If you pause somewhere, add a `<break>`
3. If you slow down somewhere, add `<prosody rate="slow">`
4. If you emphasize something, add `<emphasis>`

**Remember:** Natural, well-punctuated text is better than over-engineered SSML.

---

## See Also

- [TTS Architecture](./tts-architecture.md) - Technical implementation details
- [Accessibility Catalogs Integration Guide](./accessibility-catalogs-integration-guide.md) - How to structure catalogs
- [SSML Extraction](./accessibility-catalogs-tts-integration.md) - Automatic SSML processing
- [AWS SSML Tags Reference](./aws-ssml-tags-reference.md) - Complete tag list

---

**Document Version:** 1.0
**Last Updated:** February 6, 2026
**Author:** PIE Players Team
