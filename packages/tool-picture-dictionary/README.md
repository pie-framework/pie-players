# @pie-players/pie-tool-picture-dictionary

Picture dictionary panel for the PIE assessment player. Registers
`<pie-tool-picture-dictionary>`.

## Lookup is host-supplied

PIE ships no endpoint. The symbol corpus behind a picture dictionary is licensed, so
a host supplies one.

```html
<pie-tool-picture-dictionary endpoint="/api/picture-dictionary" language="en">
</pie-tool-picture-dictionary>
```

```js
element.lookup = async ({ keyword, language, max }, signal) => ({
  status: "ok",
  items: [{ url: "/symbols/apple.png", caption: "An apple" }],
});
```

With neither, the panel says no service is configured.

The endpoint is called `same-origin`, so a route already behind the assessment's own
session answers with no further configuration. A host authorising some other way
passes a `headers` function, read per request so a short-lived token is fetched fresh;
one that wants no ambient credentials passes `credentials: "omit"`. Both are optional
properties.

### Request

`POST` with `{ keyword, language?, max? }` — the shape a picture-dictionary service
is expected to accept. `keyword` is normalised before it is sent, and a selection
longer than four words is refused without a request.

### Response

```json
{
  "pictures": [
    { "url": "/symbols/apple.png", "caption": "An apple", "width": 120, "height": 90 }
  ]
}
```

`images` is accepted as an alias for `pictures`, and within an entry `image` as an
alias for `url` — `url` wins if a payload carries both. Unknown extra fields are
ignored. Signed, short-lived URLs are expected and fine.

### Pointing it at an existing service

A service that already takes `{ keyword, language?, max? }` and answers
`{ images: [{ image }] }` needs no resolver: name it in `endpoint` and the built-in
lookup speaks it as it stands.

Two things such a service decides rather than this panel. If it is cross-origin from the
assessment, the `same-origin` default sends no credentials, so a service token goes
through `headers` — a path a host can use directly instead of proxying. And if it
defaults the language server-side, a non-default language has to be declared: the panel
sends `language` only when the host sets it.

A picture whose URL is not `https:`, protocol-relative, or a same-origin path is
dropped — host data still reaches an attribute the browser acts on, and a symbol
service has no reason to return `javascript:` or `data:`. Plain `http:` is dropped
because it is mixed content on every https deployment, which is a broken image where
the definition should be. A leading `/` is checked by resolving rather than by prefix:
`/\evil.example/x.png` looks like a path and resolves to another host, because a
backslash is a path separator for special schemes. If every picture is dropped the
panel reports "no picture" rather than rendering a broken grid.

Zero pictures is reported as "no picture", distinct from a service failure.

## Alt text

The picture *is* the definition, so it is never decorative and never gets an empty
`alt`. The caption becomes the `alt`; without one the keyword stands in, which at
least tells a screen reader user what the picture is meant to depict. The visible
caption is `aria-hidden`, since it is already the `alt`.

## Two entry points, deliberately

The `term` property is set by whatever selection affordance the host offers. The
field is the tool's keyboard route, not a convenience: a sighted keyboard-only
learner cannot originate a text selection in non-editable content, because Chromium
does not extend one with Shift+Arrow there without caret browsing — an OS-level
toggle that does not exist on mobile. A selection-only picture dictionary would be
unreachable for exactly the learners most likely to need it.

## Properties

| Name       | Attribute  | Type     | Notes                                          |
| ---------- | ---------- | -------- | ---------------------------------------------- |
| `visible`  | `visible`  | boolean  | Owned by the toolbar shell.                    |
| `toolId`   | `tool-id`  | string   | Scoped tool instance id.                       |
| `term`     | `term`     | string   | Pre-fills and searches when the panel is open. |
| `termRequestId` | —     | string \| number | Identity of the current `term`; optional. |
| `endpoint` | `endpoint` | string   | Enables the built-in POST lookup.              |
| `language` | `language` | string   | BCP-47 tag sent with the request.              |
| `lookup`   | —          | function | Host resolver; takes precedence over `endpoint`. |
| `headers`  | —          | function | Extra request headers for `endpoint`, read per request. |
| `credentials` | —       | string   | Overrides the `same-origin` default for `endpoint`. |

A `lookup` resolves to `{ status: "ok", items }`, `{ status: "empty" }`, or
`{ status: "error", reason }`. `empty` and `error` are separate on purpose: a learner
must not be told their word is not real when the network is down.

The panel renders its body only; floating chrome belongs to the toolbar shell.
