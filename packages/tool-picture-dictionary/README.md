# @pie-players/pie-tool-picture-dictionary

Picture dictionary panel for the PIE assessment player. Registers
`<pie-tool-picture-dictionary>`.

## Lookup is host-supplied

PIE ships no endpoint. The symbol corpus behind a picture dictionary is licensed, so
a host supplies both the endpoint and the credentials for it.

```html
<pie-tool-picture-dictionary endpoint="/api/picture-dictionary" language="en">
</pie-tool-picture-dictionary>
```

```js
element.lookup = async ({ keyword, language, max }, signal) => ({
  status: "ok",
  pictures: [{ url: "/symbols/apple.png", caption: "An apple" }],
});
```

With neither, the panel says no service is configured.

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

`images` is accepted as an alias for `pictures`. Unknown extra fields are ignored.
Signed, short-lived URLs are expected and fine.

A picture whose URL is not `https:`, protocol-relative, or a same-origin path is
dropped — host data still reaches an attribute the browser acts on, and a symbol
service has no reason to return `javascript:` or `data:`. If every picture is
dropped the panel reports "no picture" rather than rendering a broken grid.

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
| `endpoint` | `endpoint` | string   | Enables the built-in POST lookup.              |
| `language` | `language` | string   | BCP-47 tag sent with the request.              |
| `lookup`   | —          | function | Host resolver; takes precedence over `endpoint`. |

The panel renders its body only; floating chrome belongs to the toolbar shell.
