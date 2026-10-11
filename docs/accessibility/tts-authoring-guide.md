# TTS Authoring Guide

This guide covers authoring SSML (Speech Synthesis Markup Language) for PIE
read-aloud: which provider voices which tags, where SSML goes in item content,
and the patterns that fix speech that runs together or misreads. It is for
content authors and item developers who write item config.

## SSML Provider Support

What reaches the listener depends on the TTS provider the host configures:

| Provider | Authored SSML (`spoken` cards) | Generated math speech |
|----------|-------------------------------|-----------------------|
| **AWS Polly** (server) | Voiced within Polly's supported subset ([tags](https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html)); the default neural engine supports fewer tags than the standard engine | SSML |
| **Google Cloud TTS** (server) | Voiced within Google's supported subset ([tags](https://cloud.google.com/text-to-speech/docs/ssml)) | SSML |
| **Custom transport** (server), the SC adapter `@pie-players/tts-server-sc` included | Passed to the host's service as written; the service decides what it voices | Plain text |
| **Browser TTS** | The card's text is spoken, with `<sub>` aliases in place of the text they cover; every other tag is dropped and a `<break>` becomes a space | Plain text |

An authored `spoken` card replaces the visible text under every provider, so a
wording fix works everywhere. Pauses, rate, emphasis and phonemes need a server
provider that voices them. The host's TTS configuration decides which one
delivery uses
([Minimal Server-Backed TTS Config](../../packages/assessment-toolkit/README.md#minimal-server-backed-tts-config)).

---

## Embedding SSML in PIE Content

SSML reaches TTS as a `spoken` card in an accessibility catalog, which the
content references with `data-catalog-idref`. An author writes the card directly
(Method 2), or embeds `<speak>` in the content for a preprocessing step to
extract (Method 1).

### Method 1: Inline SSML (Preprocessed Extraction)

`SSMLExtractor` extracts `<speak>` from content and generates accessibility
catalogs before the item is rendered. Inline SSML works only where the import or
render path runs that preprocessing step.

```json
{
  "config": {
    "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
    "elements": {
      "multiple-choice": "@pie-element/multiple-choice@x.y.z"
    },
    "models": [{
      "id": "q1",
      "element": "multiple-choice",
      "prompt": "<div><speak xml:lang=\"en-US\">Question one:<break time=\"300ms\"/>Method Selection</speak><h3>Question 1: Method Selection</h3><p>Based on the passage...</p></div>"
    }]
  }
}
```

Preprocessing:

1. extracts the `<speak>` content into a catalog with the id `auto-prompt-q1-0`,
2. removes the `<speak>` from the visible markup,
3. docks the catalog on the element wrapping the `<speak>`, the `<div>` above,
   with `data-catalog-idref`.

The runtime registers the extracted catalog when the item mounts.

Step 3 has two authoring requirements, each reported with a console warning when
unmet:

- **The `<speak>` needs an element around it**, holding the visible content it
  speaks. Nothing is synthesized to stand in for one: a `<speak>` with no element
  around it has no content node to be an alternate *for*, and an invented wrapper
  would have to invent visible content too. The catalog is still emitted, but TTS
  resolves by walking the DOM, so it is never found.
- **That element must not already carry a `data-catalog-idref`.** An existing
  reference is never overwritten: it names a whole card array, so replacing it to
  win the spoken type would take that node's braille, simplified-language and
  sign-language cards down with it. If the node is already docked, author the
  SSML as a `spoken` card on that catalog (Method 2).

### Method 2: Spoken Catalog Cards

The card sits in the item's `accessibilityCatalogs`, and the prompt references it:

```json
{
  "accessibilityCatalogs": [{
    "identifier": "q1-prompt",
    "cards": [{
      "catalog": "spoken",
      "language": "en-US",
      "content": "<speak xml:lang=\"en-US\">Question one:<break time=\"300ms\"/>Method Selection.<break time=\"500ms\"/><prosody rate=\"medium\">Based on the passage, which method should you use to solve x squared minus five x plus six equals zero?</prosody></speak>"
    }]
  }],
  "config": {
    "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
    "elements": {
      "multiple-choice": "@pie-element/multiple-choice@x.y.z"
    },
    "models": [{
      "id": "q1",
      "element": "multiple-choice",
      "prompt": "<div data-catalog-idref=\"q1-prompt\"><h3>Question 1: Method Selection</h3><p>Based on the passage, which method should you use?</p></div>"
    }]
  }
}
```

### Choosing a Method

Inline SSML keeps the spoken and visible text side by side in one field, at the
cost of mixed markup and generated catalog ids; it suits an import pipeline that
runs `SSMLExtractor`. A catalog card keeps the spoken text separate, with an
identifier the author controls and one card per language, at the cost of the two
texts drifting apart unless both are edited together; it suits content authored
directly for delivery. The catalog model is defined in
[Accessibility Catalogs](./accessibility-catalogs-integration-guide.md).

---

## Common Patterns

The JSON snippets here show fields inside a PIE model. A full item uses
`config.markup`, `config.elements` and `config.models[]`, as above.

### Title and Body Text

```json
{
  "prompt": "<h3>Question 1: Method Selection</h3><p>Based on the passage, which method...</p>"
}
```

A heading with no closing punctuation runs into the body: "Question one method
selection based on the passage which method...". Ending the heading with a
period fixes it under every provider. A `<break>` controls the pause length
where a server provider voices it:

```json
{
  "prompt": "<div><speak><prosody rate=\"medium\">Question 1: Method Selection<break time=\"300ms\"/></prosody>Based on the passage, which method...</speak><h3>Question 1: Method Selection</h3><p>Based on the passage, which method...</p></div>"
}
```

This inline form needs `SSMLExtractor` preprocessing
([Method 1](#method-1-inline-ssml-preprocessed-extraction)); without it, author
the SSML as a `spoken` card (Method 2).

### Multiple-Choice Options

```json
{
  "choices": [
    {"value": "a", "label": "A. The quadratic formula, because it works for all equations"},
    {"value": "b", "label": "B. Factoring, because this equation factors easily"}
  ]
}
```

Options without closing punctuation run together: "A the quadratic formula
because it works for all equations B factoring because...". Ending each label
with a period separates them under every provider:

```json
{
  "choices": [
    {"value": "a", "label": "A. The quadratic formula, because it works for all equations."},
    {"value": "b", "label": "B. Factoring, because this equation factors easily."}
  ]
}
```

A `spoken` card on the prompt can also script the options, with pauses and
pacing:

```json
{
  "accessibilityCatalogs": [{
    "identifier": "question-1-prompt",
    "cards": [{
      "catalog": "spoken",
      "language": "en-US",
      "content": "<speak>Based on the passage, which method should you use? <break time=\"200ms\"/> Option A. <prosody rate=\"slow\">The quadratic formula</prosody>, because it works for all equations. <break time=\"200ms\"/> Option B...</speak>"
    }]
  }],
  "config": {
    "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
    "elements": {
      "multiple-choice": "@pie-element/multiple-choice@x.y.z"
    },
    "models": [{
      "id": "q1",
      "element": "multiple-choice",
      "prompt": "<div data-catalog-idref=\"question-1-prompt\">...</div>"
    }]
  }
}
```

### Math Expressions

PIE finds MathML in rendered content and converts it to natural-language speech
before calling the provider, under every provider and with no configuration, so
structured math needs no SSML. Author SSML only where an expression needs exact
pacing or content-specific wording:

```json
{
  "config": {
    "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
    "elements": {
      "multiple-choice": "@pie-element/multiple-choice@x.y.z"
    },
    "models": [{
      "id": "q1",
      "element": "multiple-choice",
      "prompt": "<div data-catalog-idref=\"equation-1\">x² - 5x + 6 = 0</div>",
      "accessibilityCatalogs": [{
        "identifier": "equation-1",
        "cards": [{
          "catalog": "spoken",
          "language": "en-US",
          "content": "<speak><prosody rate=\"slow\">x squared<break time=\"200ms\"/> minus five x<break time=\"200ms\"/> plus six<break time=\"200ms\"/> equals zero</prosody></speak>"
        }]
      }]
    }]
  }
}
```

An authored card takes precedence over generated math speech. Word highlighting
inside an equation follows a provider boundary only when it maps to a visible
MathML token with high confidence; otherwise PIE highlights the whole formula or
expression. Authored SSML that diverges from the rendered MathML highlights the
formula region
([generated math walkthrough](./tts-deep-dive.md#generated-math-walkthrough)).

---

## SSML Elements You Should Know

The provider references linked in [SSML Provider Support](#ssml-provider-support)
define each tag; these five cover most assessment content. Durations and
supported values vary by provider and voice.

- **`<break>`** adds a pause, by `time` (`300ms`) or by `strength` (`x-weak`
  through `x-strong`). Typical uses: after headings, between list items, between
  clauses.

  ```xml
  <speak>First sentence.<break time="300ms"/>Second sentence.</speak>
  ```

- **`<prosody>`** sets rate, pitch and volume. `rate` takes `x-slow` through
  `x-fast` or a percentage (`80%`); `slow` suits math and technical terms.

  ```xml
  <speak>Solve <prosody rate="slow">x squared, minus five x, plus six, equals zero</prosody>.</speak>
  ```

- **`<emphasis>`** stresses words, at `strong`, `moderate` or `reduced`.

  ```xml
  <speak>This is <emphasis level="strong">very important</emphasis>.</speak>
  ```

- **`<sub>`** speaks an alias in place of the written text: symbols
  (`<sub alias="pi">π</sub>`), abbreviations (`<sub alias="Doctor">Dr.</sub>`),
  acronyms read as letters (`<sub alias="S Q L">SQL</sub>`). The browser provider
  voices it too.

  ```xml
  <speak>The formula is <sub alias="x squared">x²</sub>.</speak>
  ```

- **`<phoneme>`** gives an exact pronunciation in IPA, for proper names,
  foreign words and jargon.

  ```xml
  <speak><phoneme alphabet="ipa" ph="təˈmeɪtoʊ">tomato</phoneme></speak>
  ```

---

## Authoring Practice

Punctuation comes first: a period after each sentence, heading and list item,
and commas where a reader pauses. It works under every provider, and content
that reads naturally aloud needs no SSML. Simple content such as a one-line
question with one-word options is fine as written.

Add SSML only where punctuation is not enough: a run-on section, an expression
read too fast, a term mispronounced. Read the text aloud; where you pause, add a
`<break>`; where you slow down, `<prosody rate="slow">`; where you stress a word,
`<emphasis>`. Then listen again.

### Worked Example: Math Word Problem

```json
{
  "prompt": "<p>A rectangle has length x+3 and width x-2. Write an expression for its area.</p>"
}
```

Without SSML this reads as "A rectangle has length x plus three and width x minus
two write an expression for its area". A `spoken` card paces the expressions and
separates the instruction:

```json
{
  "accessibilityCatalogs": [{
    "identifier": "rect-area-1",
    "cards": [{
      "catalog": "spoken",
      "language": "en-US",
      "content": "<speak>A rectangle has length <prosody rate=\"slow\">x plus three</prosody><break time=\"200ms\"/> and width <prosody rate=\"slow\">x minus two</prosody>.<break time=\"400ms\"/> Write an expression for its area.</speak>"
    }]
  }],
  "config": {
    "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
    "elements": {
      "multiple-choice": "@pie-element/multiple-choice@x.y.z"
    },
    "models": [{
      "id": "q1",
      "element": "multiple-choice",
      "prompt": "<div data-catalog-idref=\"rect-area-1\"><p>A rectangle has length x+3 and width x-2. Write an expression for its area.</p></div>"
    }]
  }
}
```

---

## Testing SSML

Listen to every SSML change under the provider delivery uses.

- **Section demos, in a pie-players checkout:** run `bun run dev:section` and
  open `http://localhost:5300/tts-ssml?mode=candidate&layout=splitpane`, then
  press the TTS button.
- **AWS Polly console:** in the Polly text-to-speech page, switch the input to
  SSML, paste the card's content and listen.

Check that:

- pacing is natural, neither too fast nor too slow
- sections and list items are separated by pauses
- no pause falls mid-sentence
- math expressions and technical terms are pronounced correctly

---

## See Also

- [TTS Deep Dive](./tts-deep-dive.md) - Runtime flow from the toolbar button to the highlighted word
- [Accessibility Catalogs](./accessibility-catalogs-integration-guide.md) - Catalog model
- [SSML Extraction](./accessibility-catalogs-integration-guide.md#ssml-extraction-from-pie-content) - SSML extraction and catalog registration
- [Accessibility Catalogs TTS Integration](./accessibility-catalogs-tts-integration.md) - How TTS resolves a card, and troubleshooting
- [Polly SSML reference](https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html) - Tags and `amazon:*` extensions Polly supports
- [Google Cloud TTS SSML reference](https://cloud.google.com/text-to-speech/docs/ssml) - Tags Google supports
