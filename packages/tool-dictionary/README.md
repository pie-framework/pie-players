# @pie-players/pie-tool-dictionary

Dictionary panel for the PIE assessment player. Registers
`<pie-tool-dictionary>`.

## Lookup is host-supplied

PIE ships no dictionary endpoint. The corpus behind a dictionary is licensed per
programme, so a default here would bake one deployment into the package.

Two ways to supply one, in precedence order:

```html
<!-- Built-in POST shaping -->
<pie-tool-dictionary endpoint="/api/dictionary" language="en"></pie-tool-dictionary>
```

```js
// Your own client, preferred when you already have one
element.lookup = async ({ keyword, language, max }, signal) => ({
  status: "ok",
  items: [{ word: keyword, senses: [{ definition: "…" }] }],
});
```

With neither, the panel says no service is configured rather than offering a field
that silently fails.

### Request

`POST` with `{ keyword, language?, max? }`. `keyword` is normalised before it is
sent: whitespace collapsed, surrounding punctuation stripped, internal hyphens and
apostrophes kept. A selection longer than four words is refused without a request.

### Response

```json
{
  "entries": [
    {
      "word": "reason",
      "pronunciation": "ˈriːzən",
      "senses": [
        { "partOfSpeech": "noun", "definition": "A cause or explanation.", "example": "…" }
      ]
    }
  ]
}
```

Unknown extra fields are ignored, so the payload can be extended without a change
here. An entry carrying no usable definition is dropped: rendering a bare headword
tells a learner the word exists and nothing they asked for. Zero entries is
reported as "no entry", distinct from a service failure — a learner must not be
told their word is not real when the network is down.

The endpoint is called `same-origin`, so a route already behind the assessment's own
session answers with no further configuration — naming the endpoint is the whole
setup. A host authorising some other way passes a `headers` function, read per request
so a short-lived token is fetched fresh rather than captured at mount, and one that
wants no ambient credentials at all passes `credentials: "omit"`. Both are properties
rather than attributes, and both are optional.

## Two entry points, deliberately

The `term` property is set by whatever selection affordance the host offers. Under
`<pie-assessment-toolkit>` that is the annotation strip: selecting a word offers a
lookup, and activating it opens this panel with the word already searched, through
the coordinator's `requestTool`. The
field is how a learner looks up a word without one, and it is the reason the tool
is keyboard accessible rather than a convenience: a sighted keyboard-only learner
cannot originate a text selection in non-editable content, because Chromium does
not extend one with Shift+Arrow there unless caret browsing is on — an OS-level
toggle absent on mobile. A selection-only dictionary is unreachable for them.

The two entry points have to coexist within one open panel, which is what
`termRequestId` is for. A requested term is reapplied on every sync, so the term alone
cannot distinguish a re-render from a fresh ask: without an id, reopening the panel
re-searches the term that opened it and discards whatever the learner typed since. A
host setting `term` directly can leave the id unset and gets term-identity behaviour,
which is enough to stop a re-render re-issuing.

## Properties

| Name       | Attribute  | Type              | Notes                                        |
| ---------- | ---------- | ----------------- | -------------------------------------------- |
| `visible`  | `visible`  | boolean           | Owned by the toolbar shell.                  |
| `toolId`   | `tool-id`  | string            | Scoped tool instance id.                     |
| `term`     | `term`     | string            | Pre-fills and searches when the panel is open. |
| `termRequestId` | —     | string \| number  | Identity of the current `term`; optional. |
| `endpoint` | `endpoint` | string            | Enables the built-in POST lookup.            |
| `language` | `language` | string            | BCP-47 tag sent with the request.            |
| `lookup`   | —          | function          | Host resolver; takes precedence over `endpoint`. |
| `headers`  | —          | function          | Extra request headers for `endpoint`, read per request. |
| `credentials` | —       | string            | Overrides the `same-origin` default for `endpoint`. |

A `lookup` resolves to `{ status: "ok", items }`, `{ status: "empty" }`, or
`{ status: "error", reason }` — the same three states the shared term-lookup contract
in `@pie-players/pie-players-shared/tools/term-lookup` defines for both dictionaries.

The panel renders its body only. Floating chrome — title bar, drag, resize, close —
belongs to the toolbar shell.
