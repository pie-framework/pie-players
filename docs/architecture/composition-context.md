# Composition Context

Authored content renders in containers it was never written for. An item goes
into a section player's split pane, a vertical stack, a tabbed narrow layout, a
Studio preview, a print booklet, Quiz Engine's page and DNA-OT's page — and some
part of rendering it correctly depends on which of those it landed in.

**Composition context** is the name for those facts. A composition context is a
fact about the *place* content is rendered, not about the content and not about
the component rendering it. Neither the author nor the component can know it; the
container can, and only the container.

The pattern: the container **publishes** the fact, and any descendant that needs
it **resolves** it. Resolution is pull, not push.

## The class of problem

Heading depth is the worked example in this document, but the class is wide. Each
of these is a composition context in this repo:

| Fact | Publisher | Resolver | Why the resolver cannot know it |
|---|---|---|---|
| Heading depth | section player | every PIE element | the same item sits under a host `<h1>` in one page and three levels down in another |
| Card title convention | host, through `hooks.cardTitleFormatter` | item and passage cards | the host names its own questions; the card cannot know the convention, and an item has no idea it is question 5 of 12 |
| Read-aloud arbitration | toolkit coordinator | signing region, TTS tool | two media capabilities must not play at once, and neither can see the other |
| Region scope for annotation | item/passage shell | annotation toolbar | the selectable scope is the card, which the tool does not own |
| Split-region width | section player | item media region | the available width is the layout's, not the capability's |
| Theme tokens | theme package | every component | a deployment picks the palette, not the component |
| Granted accommodations | policy engine | every capability | eligibility is per learner and per deployment |
| Interface locale | item/section player, from its `locale` attribute | every component rendering a string of its own | the deployment picks the language the chrome speaks; a tool nested several packages deep cannot see it, and it is independent of the item's content language |

They share a shape, which is why they share a mechanism.

## Roles and terms

**Publisher.** The container that knows the fact. It publishes a small, stable
value — ideally a scalar — and does not enumerate its consumers.

**Resolver.** Any descendant that needs the fact. It reads the published value
and derives whatever it needs from it. Resolvers are not registered anywhere; a
new one can appear without the publisher changing.

**Resolution order.** How a resolver finds the value, in precedence order.
Property, then attribute, then a default that works with no publisher at all.

**Change signal.** The observable event that tells resolvers the value moved. A
published context without one is read exactly once.

**Graceful default.** What a resolver produces with no publisher present. This is
what lets the same component render inside our players, inside Studio, and in a
bare page.

## Why pull rather than push

The alternative is to push the fact down the data pipeline the container already
uses for content. In this repo that pipeline is narrow and deliberate — the
player sets two properties on a PIE element:

```ts
// packages/players-shared/src/pie/updates.ts
const controllerResult = await modelFunction(model, elementSession, env, updateSession);
element.model = wrapModelRichContent({ id: model.id, element: model.element, ...controllerResult });
element.session = elementSession;
```

`model` is authored content, filtered by the item's own controller. Pushing
composition context through it fails on four counts, and the four generalise:

**The publisher does not know its consumers.** For heading depth the player would
have to know that an EBSR emits a two-part heading plus optional part labels,
that a multiple-choice item emits one item-type heading, and that a passage emits
a title plus two levels of authored sub-headings. Publishing one number means the
player knows none of that.

**The consumer set is open.** PIE element bundles are third-party, versioned
independently, and fetched at runtime from a bundle service. A push channel needs
a container release for every new consumer; a pull channel needs none.

**Resolvers must work with no container.** The same elements run in Studio
preview, in authoring harnesses, and in `print-player`, which never mounts a
player element at all. Pull degrades to the graceful default. Push makes the
container a hard dependency.

**The value changes after mount.** A host adjusts the outline when its own page
structure changes; an accommodation is granted mid-session. Pull plus a change
signal handles that. Push means re-running the content pipeline to move one
number, which for a `<video>` mid-playback means restarting the recording.

There is a fifth reason, specific to authored content and the most expensive to
get wrong. Push it into the model and delivery context contaminates authored
data: the model stops being what the author wrote, server-side controller output
has to carry client display state, and caching and diffing lose their meaning.

## Invariants

These are the parts that have failed in practice.

**A published context must carry a change signal.** Without one, resolvers pin
the first value they see and nothing errors. This has failed twice here, at two
different layers, in the same quarter:

- `ToolSurfaceRenderResult.sync` took no argument, so a capability had nothing to
  read but the context captured when it first rendered. A signed alternate
  re-resolved to a different recording left the learner watching the previous
  one.
- `baseHeadingLevel` was published as a property but the resolver observes the
  attribute, so a host's change reached the element's property and never
  triggered a re-read. Two of a demo's controls did nothing.

Both were silent. Both rendered the first value forever. When you add a
composition context, decide the change signal in the same change as the value.

**Publish the invariant, derive the variant.** Split the decision so the
publisher owns the small, slow-changing half and the resolver owns the
element-specific half. Heading depth is one number, not a vocabulary of heading
kinds; if the publisher had to name kinds, every element type would have to agree
on the names and adding an element type would become a cross-repo negotiation.

**A resolver must have a graceful default.** No publisher is a legitimate state,
not an error.

**Publish structure, not presentation, in authored content.** The authoring side
of a composition context must express *what a thing is*, leaving the container to
decide how deep it sits. `<p data-heading="heading1">` is re-hostable;
`<h3>` is not. This is the difference between content that can move and content
that has to be re-authored, and it is the expensive kind of coupling because you
can refactor code and you cannot easily re-author a bank of passages.

## Worked example: heading depth

### What the standard requires

Screen-reader users navigate by heading structure, which means levels must nest
without skipping and must not duplicate. Two constraints collide:

- The host knows the page outline — whether there is already an `<h2>` above this
  item, and therefore whether a screen-reader-only item heading would be a
  duplicate.
- The element knows what headings it emits, which differs per element type.

The same element wants opposite answers in different containers. From the design
record for [PIE-159](https://illuminate.atlassian.net/browse/PIE-159): in Quiz
Engine the item level is `h2` and the element must furnish no heading, because
the section player supplies "Question 5"; in DNA-OT the item level is `h2` and the
element must furnish its own, because nothing above it does.

### The mechanism

The section player publishes one number — `baseHeadingLevel`, the level its card
headings occupy — and reflects it to `base-heading-level` on each player element.
Each PIE element resolves it:

```js
const player = element.closest("pie-player") ?? element.closest("pie-item-player");
if (!player) return { baseHeadingLevel: undefined, includeSrHeading: true }; // graceful default

let value = player.baseHeadingLevel;                                          // property first
if (value == null) value = player.getAttribute("base-heading-level");          // then attribute

new MutationObserver(() => rerender()).observe(player, {                       // change signal
  attributes: true,
  attributeFilter: ["base-heading-level", "include-sr-heading"],
});
```

From that one number the container derives per-kind values, and the difference
between the kinds is the whole point of publishing rather than dictating:

| | card heading | published to the player | element emits |
|---|---|---|---|
| item | `h{N}` "Question 3" | `baseHeadingLevel: N`, `includeSrHeading: false` | authored content at `N+1` |
| passage | `h{N}` "Passage" | `baseHeadingLevel: N+1` | title at `N+1`, content at `N+2` |

An item card's heading *is* the item's heading, so the element must not emit a
second one at that level. A passage card's heading is a group label, so the
passage's own title is real content belonging beneath it.

### What it fixes

Before, with the default `N = 2` unpublished:

```
h2     Passage                        <- section player's card
h2     Sea Turtles in Trouble         <- passage element's title: sibling of its own group label
p      Danger on Land                 <- authored data-heading, never promoted
p      Danger in the Water
p      Help is on the Way
h2     Question                       <- section player's card
h2(sr) Multiple Choice Question       <- element's item heading: duplicate of the card's
```

Four `h2`s, no nesting, and the authored sub-headings are paragraphs. After:

```
h2     Passage
h3       Sea Turtles in Trouble
h4         Danger on Land
h4         Danger in the Water
h4         Help is on the Way
h2     Question
```

Three defects, all one cause — a composition context that was never published:

1. **Duplicate item heading.** The element announced "Multiple Choice Question"
   at the same level as the card's "Question", so assistive technology heard the
   item type as a sibling of the question rather than a description of it.
2. **Flat passage structure.** The passage title sat at the level of its own
   group label.
3. **Authored headings inert.** `data-heading` markup is only promoted to heading
   elements once a level is published. Nothing published one, so
   [PIE-151](https://illuminate.atlassian.net/browse/PIE-151) — semantic headings
   inside passages and prompts — produced paragraphs in every shipped host.

The third is the one worth dwelling on for planning purposes. It was a completed
feature, with authored content already relying on it, that produced nothing. No
error, no warning, no failing test: the markup rendered, it just was not
structure. A composition context with no publisher does not announce itself.

### Beyond screen readers

Heading structure is consumed by more than assistive technology, though that is
where it is felt first: print and PDF output take document outline and bookmarks
from heading elements, export paths carry only structure that was marked up, and
host CSS keyed on real headings matches only once the promotion runs. The reach
is narrower than the accessibility case, but the failure is the same one.

## Applying the pattern

When you find a fact that only the container knows:

1. Name the publisher and the smallest value it can publish. Prefer one scalar to
   a structure; prefer a structure to a per-consumer map.
2. Define the resolution order, including the graceful default.
3. Define the change signal, in the same change. If you cannot say how a resolver
   learns the value moved, the context is not finished.
4. Give resolvers room to derive. If the publisher is computing per-consumer
   answers, the split is in the wrong place.
5. Keep the authored side structural. Authors express what a thing is; containers
   decide where it sits.

Within our own packages, `@pie-players/pie-context` is the mechanism — a typed
context protocol with real subscription. See
[`developer_patterns.md`](./developer_patterns.md) under CE Communication
Patterns. PIE elements cannot use it, being framework-agnostic third-party
bundles, so for them the mechanism is a property with a reflected attribute and a
`MutationObserver`. The mechanism differs; the pattern and the invariants do not.

## References

- [`developer_patterns.md`](./developer_patterns.md) — CE communication mechanisms
- [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md)
  — host surfaces, the same pattern applied to tool capabilities
- [PIE-159](https://illuminate.atlassian.net/browse/PIE-159) — heading structure
  for screen-reader accessibility, and its design record
- [PIE-150](https://illuminate.atlassian.net/browse/PIE-150) — host-controlled
  passage heading level
- [PIE-151](https://illuminate.atlassian.net/browse/PIE-151) — `data-heading`
  semantic markup for headings inside content
