# AWS SSML Tags Reference

AWS Polly provides enhanced SSML tags beyond standard SSML for improved speech synthesis control.

## Overview

When using the Polly TTS provider, you can use both standard SSML tags and AWS-specific extensions for more precise control over speech synthesis.

## AWS-Specific SSML Tags

### 1. `<aws-break>` - Enhanced Pauses

More granular control than standard `<break>` tag with strength parameter.

**Syntax:**
```xml
<aws-break time='duration' strength='level'/>
```

**Parameters:**
- `time`: Duration (e.g., '500ms', '1s', '2s')
- `strength`: Pause strength ('x-weak', 'weak', 'medium', 'strong', 'x-strong')

**Example:**
```xml
<speak>
  Read this sentence carefully.
  <aws-break time='2s' strength='strong'/>
  Now consider this next point.
</speak>
```

**Use Cases:**
- Emphasizing transitions between sections
- Creating dramatic pauses in narratives
- Separating complex instructions
- Giving students time to process information

### 2. `<aws-emphasis>` - Enhanced Emphasis

More levels of emphasis than standard SSML `<emphasis>` tag.

**Syntax:**
```xml
<aws-emphasis level='strength'>text</aws-emphasis>
```

**Levels:**
- `reduced` - Less emphasis than normal
- `moderate` - Standard emphasis
- `strong` - Strong emphasis

**Example:**
```xml
<speak>
  In your response, <aws-emphasis level='moderate'>be sure to</aws-emphasis>
  include all required elements.
  This is <aws-emphasis level='strong'>critically important</aws-emphasis>.
</speak>
```

**Use Cases:**
- Highlighting key instructions
- Drawing attention to important terms
- Reducing emphasis on parenthetical content

### 3. `<aws-w role='...'>` - Parts of Speech

Controls word interpretation by specifying part of speech.

**Syntax:**
```xml
<aws-w role='amazon:ROLE'>word</aws-w>
```

**Common Roles:**
- `amazon:VB` - Verb (present tense)
- `amazon:VBD` - Verb (past tense)
- `amazon:NN` - Noun (singular)
- `amazon:NNS` - Noun (plural)
- `amazon:SENSE_1` - First dictionary sense

**Example:**
```xml
<speak>
  I will <aws-w role='amazon:VB'>read</aws-w> the passage.
  I <aws-w role='amazon:VBD'>read</aws-w> it yesterday.
</speak>
```

**Use Cases:**
- Disambiguating heteronyms (read/read, lead/lead, close/close)
- Ensuring correct pronunciation of verbs vs nouns
- Technical terms with multiple meanings

### 4. `<aws-say-as interpret-as='spell-out'>` - Spell Out

Forces individual letter pronunciation.

**Syntax:**
```xml
<aws-say-as interpret-as='spell-out'>text</aws-say-as>
```

**Example:**
```xml
<speak>
  Write <aws-say-as interpret-as='spell-out'>x²</aws-say-as> as
  <aws-emphasis level='strong'>x squared</aws-emphasis>.
</speak>
```

**Use Cases:**
- Acronyms (NASA, FBI, HTML)
- Abbreviations that should be spelled
- Mathematical notation symbols
- Variable names in code

## Standard SSML Tags (Also Supported)

### `<prosody>` - Voice Characteristics

Control rate, pitch, and volume.

**Example:**
```xml
<prosody rate="slow" pitch="medium">
  x squared, minus five x, plus six
</prosody>
```

### `<phoneme>` - Pronunciation Override

Specify exact pronunciation using IPA phonetic alphabet.

**Example:**
```xml
<phoneme alphabet="ipa" ph="ˌpɒlɪˈnoʊmiəl">polynomial</phoneme>
```

### `<emphasis>` - Standard Emphasis

Standard SSML emphasis (reduced, moderate, strong).

**Example:**
```xml
The <emphasis>quadratic formula</emphasis> works for all equations.
```

### `<break>` - Standard Pause

Insert pauses of specified duration.

**Example:**
```xml
Read carefully. <break time="500ms"/> Now answer the question.
```

## Demo Content

The demo4-tts-ssml section demonstrates all these tags in context:

### Question 3: Essay Instructions

Shows advanced AWS SSML usage:

```xml
<speak xml:lang="en-US">
  Write a detailed explanation of how to solve quadratic equations.
  <aws-break time='2s' strength='strong'/>
  In your response, <aws-emphasis level='moderate'>be sure to</aws-emphasis>:
  <aws-break time='500ms' strength='medium'/>
  <prosody rate="95%">
    clearly <aws-w role='amazon:VB'>state</aws-w> the three main methods,
    <aws-break time='300ms' strength='weak'/>
    organize your ideas in writing,
    <aws-break time='300ms' strength='weak'/>
    develop your ideas in detail,
    <aws-break time='300ms' strength='weak'/>
    use evidence from the passage in your response,
    <aws-break time='300ms' strength='weak'/>
    and use correct spelling, capitalization, punctuation, and grammar.
  </prosody>
  <aws-break time='1s' strength='medium'/>
  For mathematical notation, spell out equations.
  For example, write <aws-say-as interpret-as='spell-out'>x²</aws-say-as> as
  <aws-emphasis level='strong'>x squared</aws-emphasis>.
</speak>
```

## Best Practices

### 1. Combine Standard and AWS Tags

Use standard SSML for basic control, AWS tags for fine-tuning:

```xml
<speak>
  <prosody rate="medium">
    This is normal speech.
    <aws-break time='1s' strength='strong'/>
    This follows a significant pause.
  </prosody>
</speak>
```

### 2. Strategic Pause Placement

Use pauses to improve comprehension:
- **Between instructions**: 1-2 seconds
- **Between list items**: 300-500ms
- **After key points**: 500ms-1s
- **Before important information**: 200-300ms

### 3. Emphasis for Clarity

Use emphasis sparingly:
- **Moderate**: Regular emphasis for key terms
- **Strong**: Only for critical information
- **Reduced**: De-emphasize parenthetical content

### 4. Parts of Speech for Accuracy

Use `<aws-w role='...'>` for ambiguous words:
- Verbs vs nouns (read, lead, use)
- Present vs past tense
- Technical terms with multiple meanings

### 5. Spell-Out for Precision

Use `<aws-say-as interpret-as='spell-out'>` for:
- Acronyms students must learn (e.g., PEMDAS)
- Mathematical notation (x², a³)
- Variable names (n, k, x₁)
- Abbreviations that aren't words

## Browser TTS Limitations

**Important:** AWS-specific tags are only fully supported by AWS Polly provider.

| Tag | Polly Support | Browser TTS |
|-----|---------------|-------------|
| `<aws-break>` | ✅ Full | ⚠️ Falls back to `<break>` |
| `<aws-emphasis>` | ✅ Full | ⚠️ Falls back to `<emphasis>` |
| `<aws-w role>` | ✅ Full | ❌ Ignored |
| `<aws-say-as>` | ✅ Full | ⚠️ Falls back to `<say-as>` |
| `<prosody>` | ✅ Full | ⚠️ Partial |
| `<phoneme>` | ✅ Full | ❌ Ignored |

**Recommendation:**
- Use AWS tags for production with Polly provider
- Always include visual content that works without TTS
- Test with both Polly and browser TTS for graceful degradation

## References

- [AWS Polly SSML Documentation](https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html)
- [W3C SSML Specification](https://www.w3.org/TR/speech-synthesis/)
- [Demo 4: TTS with SSML](../apps/section-demos/src/lib/content/demo4-tts-ssml.ts)
- [TTS Architecture](./tts-architecture.md)
