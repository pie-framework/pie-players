# PIE Assessment Tools & Accommodations Architecture

This document describes how the PIE (Portable Interactions and Elements) assessment toolkit delivers tools and accommodations to students during online assessments: its principles, the capability model, tool scope and instance ids, and the shared services behind them. It is for engineers evaluating or extending the toolkit. Host integrators configuring tools start with [Configuring Tools](./tool_provider_system.md); tool authors start with the [tool registry reference](../../packages/assessment-toolkit/docs/TOOL_REGISTRY.md), which is authoritative for registrations.

The system supports accommodations such as text-to-speech, highlighting, calculators and rulers, and targets WCAG 2.2 AA. It is built on web standards (the CSS Custom Highlight API and custom elements), so a host in any framework can embed it.

See also:

- [`../wcag/readme.md`](../wcag/readme.md) for the WCAG reference library
- [`../wcag/patterns-and-widgets.md`](../wcag/patterns-and-widgets.md) for widget guidance
- [`../wcag/evaluation-method.md`](../wcag/evaluation-method.md) for review methodology

---

## Table of Contents

1. [Architectural Principles](#architectural-principles)
2. [System Context](#system-context)
3. [Component Architecture](#component-architecture)
4. [Tool Invocation](#tool-invocation)
5. [What Counts As A Tool](#what-counts-as-a-tool)
6. [Capability Ownership Layers](#capability-ownership-layers)
7. [Tool Scope Architecture](#tool-scope-architecture-placement--scoped-ids)
8. [Core Services](#core-services)
9. [Integration Patterns](#integration-patterns)
10. [Technology Stack](#technology-stack)
11. [Accessibility & Accommodations](#accessibility--accommodations)
12. [Architecture Decisions](#architecture-decisions)
13. [References](#references)

---

## Architectural Principles

### Separation of Concerns

Tools are independent, self-contained components. Shared services (TTS, highlighting) are factored into reusable infrastructure. The player container orchestrates without coupling to tool internals.

**Benefit:** Tools can be developed, tested, and deployed independently. New tools can be added without modifying existing infrastructure.

### Modern Web Standards First

The architecture leverages native browser APIs that are now widely supported, reducing dependency on third-party libraries and enabling cleaner, more maintainable implementations.

**Key Standards Used:**
- **CSS Custom Highlight API** - Text highlighting without DOM mutation
- **Web Components** - Framework-agnostic custom elements
- **Web Speech API** - Browser-native text-to-speech
- **CSS Container Queries** - Responsive tool layouts

**Benefit:** Better performance, reduced bundle size and improved accessibility.

### Framework Agnostic

Tools use the Web Components standard with internal implementation in Svelte 5. The public API surface is clean and consumable by any JavaScript framework.

**Benefit:** Assessment platforms using React, Vue, Angular, or vanilla JavaScript can integrate tools without friction.

### Zero DOM Mutation

Tools never modify PIE item content DOM directly. Visual effects use modern browser APIs (CSS Custom Highlight API) that work above the DOM layer.

**Benefit:** Preserves framework virtual DOM integrity, maintains screen reader compatibility, and eliminates security risks from innerHTML manipulation.

### Accessibility First

WCAG 2.2 AA is the target. Tools are operated through native controls or their own keyboard handlers, and automated browser tests cover keyboard paths and axe rules; no manual screen-reader pass has validated them yet ([deferred accessibility issues](../wcag/deferred-issues.md)). Tool policy grants tools from the student's personal needs profile, where a program records the accommodations an IEP or 504 plan requires.

**Legal Context:** Public education agencies are covered by Section 504 of the Rehabilitation Act and Title II of the ADA; Section 508 governs federal agencies' own ICT. WCAG is the technical standard these obligations are measured against.

---

## System Context

### Purpose

The PIE Assessment Tools system provides:

1. **Accessibility accommodations** for students with disabilities
2. **Testing tools** required by assessment content
3. **Assistive technology integration** for equitable access
4. **Reference materials** (periodic table, formula sheets)

### Stakeholders

- **Students** - Primary users requiring accommodations
- **Assessment Administrators** - Configure available tools per test
- **Content Authors** - Specify required tools per item
- **Platform Integrators** - Embed toolkit in assessment systems
- **Accessibility Coordinators** - Ensure compliance with accommodation plans

### System Boundary

**In Scope:**
- Tool implementations (calculator, ruler, protractor, etc.)
- Coordination services (z-index, highlighting, TTS)
- Annotation infrastructure (highlight, underline)
- Accommodation configuration

**Out of Scope:**
- Assessment content authoring
- Item response validation
- Session persistence and timing: the host owns backend I/O, and the toolkit's [Test Attempt Session](../../packages/assessment-toolkit/README.md#test-attempt-session) is a shape the host maps its attempt data to and from
- Score reporting

---

## Component Architecture

### High-Level Components

**Section player** (`pie-section-player-splitpane`, `pie-section-player-vertical`, `pie-section-player-tabbed`)
- Renders a section's passages and items
- Registers authored catalogs and preprocessed `extractedCatalogs`
- Manages accessibility catalog lifecycle
- Integrates toolkit services (TTS, tools, highlighting)
- Renders TTS tools inline in passage/item headers

**PIE Item Player**
- Renders individual assessment items
- Manages PIE element instances
- Collects and validates responses
- Provides content queries for tools

**Tool Registry & Toolbar**
- Central tool registry and launcher
- Manages tool button states
- Delegates to ToolCoordinator for visibility
- Tool configuration UI

**Individual Tools**
- Self-contained functionality (calculator, ruler, etc.)
- Manage own UI and state
- Register with ToolCoordinator
- Communicate via events/props

**Annotation Toolbar**
- Text selection detection
- Floating toolbar on selection
- Annotation creation (highlight/underline)
- Read-aloud of the selection
- Renders host-supplied selection actions, without naming what they open

---

## Tool Invocation

### Activation

A capability declares how it is invoked, as `ToolActivation`:

- **`toolbar-toggle`** — a button on a toolbar opens it. The default, and what a floating panel uses: calculator, ruler, protractor, periodic table, graph, line reader, both dictionaries.
- **`selection-gateway`** — a section-scoped singleton that appears over a text selection and offers actions on it. `annotationToolbar` is the one PIE ships.
- **`region`** — rendered into a host surface with no toolbar button, for a capability that is part of the content rather than a tool over it.

Activation is orthogonal to placement, to eligibility, and to whether the capability needs authored content. See [What Counts As A Tool](#what-counts-as-a-tool).

### Gateway independence

A selection gateway is a capability that appears over the learner's text selection and offers actions on it. It hands the selection to a capability through `ToolkitCoordinator.requestTool`, as a shortcut onto a capability that is reachable without it. No capability depends on a gateway for its only input.

The constraint is a browser fact. Chromium will not extend a selection with Shift+Arrow in non-editable content unless caret browsing is on, an OS-level toggle absent on mobile, so a sighted keyboard-only learner cannot originate a text selection at all. A capability reachable only through a selection is unreachable for them, which fails WCAG 2.2 SC 2.1.1.

Both dictionaries therefore carry a toolbar button and their own term field, and treat an incoming `term` as one of two equal entry points. A capability that receives text from a gateway and offers no input of its own cannot be made keyboard accessible by any amount of work inside the gateway.

### Selection-action pairing

Three layers, each able to change alone:

- The **gateway** renders the actions it is handed (`ToolSelectionAction`) and knows nothing about what they do.
- The **capability** exposes a term or equivalent input and knows nothing about selections.
- The **composition layer** (`@pie-players/pie-default-tool-loaders`) names both and pairs them.

Core names no capability, so the annotation toolbar cannot name a dictionary. A host can contribute an action for a capability PIE does not ship, and an action whose capability no toolbar hosts is left out.

`requestTool` resolves as a claim rather than a broadcast: one target answers, the first toolbar that currently hosts the capability. A broadcast would open a panel in every toolbar whose scope contains the selection, which in a section player is both the item card's toolbar and the section's.

Resolution prefers section scope, the level at which a whole section shares one instance, and falls back to any level that hosts the capability. A request that names a level makes it a constraint, honored strictly.

The fallback keeps a placement decision from silently removing the affordance. A host that places a capability at item scope only would otherwise see it granted, hosted and visible, with no action on the selection; matching a level in the gateway to a placement made elsewhere is a step it has no reason to expect.

At item and passage scope a section holds one target per card, and the first registered one claims the request, so a requester cannot ask for a particular card's instance. The shipped gateway has no need to. The strip is a section-scoped singleton that raises on passage selections, so the selection belongs to no card, and a request opens a floating shell that the toolbar positions outside any card. Which card's toolbar owns the instance is invisible to the learner.

The request's `params` are reapplied on every sync, so a request carries an identity as well as its payload. Without one a capability cannot tell a re-render from a fresh ask. Keying on the payload instead means asking twice for the same thing does nothing; keying on what the capability last did with it means every re-render overrides work the learner has done since. The identity is optional, and a request without one falls back to the payload, the best available identity for a host that assigns a capability's property directly and mints none.

The shipped gateway never asks twice for the same thing: the strip does not raise on a word already selected once in the session. The payload fallback serves a host that assigns a property directly, and covers the gateway if that limit lifts.

### Testing

Each layer is testable without the others: a capability against its own input, a gateway against a stub action list, the request seam against stub targets. The pairing is checked end to end in a browser, because focus crossing two shadow boundaries and a real selection are what it depends on.

---

## What Counts As A Tool

A tool in this codebase is a **policy-addressable capability**: something a `toolId` names so district, test-administration, item and student policy can decide whether it is available. That id is the tool's support id; `PnpPolicyDecisionEvent` carries it as `featureId`.

Registry membership implies nothing about three independent properties.

**1. Who may enable it (eligibility).** The assessment domain distinguishes *universal features* available to every student (highlighting, zoom, line reader), *designated supports* an educator indicates a need for (masking, color contrast, often TTS), and *accommodations* requiring a documented need such as an IEP or 504 plan (braille, ASL, scribe). This is the framing of the CCSSO accessibility manual.

**Eligibility does not belong in a tool registration.** It is a property of the program: TTS is a universal tool in one program and a documented accommodation in another. It belongs in policy configuration, where the district and test-administration levels already live, and `PnpPolicySource`'s precedence rules (`district-block`, `test-admin-override`, `item-restriction`, `pnp-prohibited`, `item-requirement`, `district-requirement`, `pnp-support`) carry it.

**2. Whether it needs authored content.** A calculator or a highlighter works on any item. ASL needs a signing video authored for *that specific content*; braille needs a transcription; authored-SSML speech needs `<speak>` in that item. For these, availability is a function of the content as well as the student, and an affordance offered where no content exists is a dead affordance.

Unlike eligibility, this **is** intrinsic to the capability and belongs with it. AfA (IMS Access for All) 3.0 formalizes it as the resource half of a matching pair: the PNP (Personal Needs and Preferences) describes learner needs, and the [DRD](https://www.imsglobal.org/accessibility/afav3p0pd/AfAv3p0_SpecPrimer_v1p0pd.html) (Digital Resource Description) describes what a resource offers. QTI 3 approximates DRD in-band, where the presence of a catalog card *is* the resource-side declaration. PIE follows QTI, so a matching catalog card is its DRD check.

**3. Where it renders.** Toolbar-invoked overlay, in-content transform, or its own layout region. Covered by [Tool Scope Architecture](#tool-scope-architecture-placement--scoped-ids) below and independent of the other two. Also separate from how it is invoked, in [Tool Invocation](#tool-invocation) above — a capability's activation, its placement, its eligibility, and its content dependency are four orthogonal things.

### How The Standards Treat This

Neither reference point draws the tool-versus-accommodation line.

**AfA / PNP 3.0 refuses it deliberately.** On-screen calculators and dictionaries sit at the same structural level as captions and sign language; all are features a user may request. The [PNP information model](https://www.imsglobal.org/spec/afa/v3p0/info) contains no eligibility criteria and no authorization levels at all — who may grant a support is out of scope by design, left to policy frameworks above the spec.

**Learnosity has no accommodation concept in its content model.** It splits content into Questions (capture a response, scored) and [Features](https://help.learnosity.com/hc/en-us/articles/16684575643549-feature-types) (no response, not scored). Feature types include Audio player, Calculator, Imagetool, Line Reader, Passage, and Video player — so a signing video is authored as ordinary item content and renders unconditionally. Calculator and Line Reader appear both as item-level Features and as activity-level tools, so their answer to "tool or content?" is "choose a configuration scope." Their only real axis is *where it is configured*: item, activity, or session.

### Consequence For PIE

PIE matches both: an AfA-shaped, eligibility-free `supports` list (`PersonalNeedsProfile.supports`, naming capabilities by `toolId`), plus a policy engine supplying the tiering AfA omits.

**Accommodations are tools like any other.** They get a support id, their eligibility comes from policy configuration, and catalog resolution checks their content dependency. Sign language is the worked example: its support id gives it the eight-level precedence, its content dependency keeps it absent when an item carries no card, and it renders as its own section-player region with no toolbar surface. None of the three answers follows from the other two. See [`../prds/sign-language-asl-support.md`](../prds/sign-language-asl-support.md).

Two mechanisms carry this.

**Decisions without a placement.** `decideToolPolicy(...)` answers "should this tool appear in *this* toolbar". For a capability with no toolbar surface that answer is always absent, because nothing placed it. `ToolPolicyEngine.decideFeature(featureId)`, exposed as `ToolkitCoordinator.decideFeaturePolicy(featureId)`, resolves one support id through the same eight levels, independent of placement. It delegates to `PnpPolicySource.resolveFeature(...)`, which reuses the existing rule evaluation, so the two paths cannot drift.

`decideFeature` does not consult `pnpEnforcement`. That flag governs whether profile policy *refines* an otherwise-visible tool set, and a capability with no placement has no unrefined baseline to fall back to: honoring the flag would make the accommodation permanently unavailable.

**Eligibility tier is configuration.** The core ships no default profile, and `createEmptyPersonalNeedsProfile()` in `@pie-players/pie-default-tool-loaders` grants nothing. Registration means policy-addressable and never universal eligibility: a default derived from registered support ids would grant accommodation-tier capabilities to every learner of a host that supplies no profile.

`@pie-players/pie-default-tool-loaders` ships today's universal set as `createUniversalPersonalNeedsProfile()`, data a host adopts, extends or replaces. What does belong on a registration is the content dependency, `requiresAuthoredContent`: signing needs an authored catalog card, braille a transcription. That is the resource half of AfA's PNP/DRD pair, and declaring it keeps a content-dependent accommodation out of a wholesale grant by structure, with no list of names.

---

## Capability Ownership Layers

Four layers, and which one a piece of code belongs to is decided by whether it names a capability.

| Layer | Package | Knows |
| --- | --- | --- |
| Core | `assessment-toolkit` | Support ids as opaque strings, placement levels, activation kinds, precedence, the registration contract. **No capability ids.** |
| Capability | `tool-*` | One capability: its registration, its content resolver, its element |
| Composition | `default-tool-loaders` | Which capabilities a deployment has, their tags, placement presets, universal supports, module loaders |
| Renderer | `section-player`, `item-player`, toolbars | Surfaces and layout. Asks the registry what to mount |

`bun run check:capability-neutrality` fails when a capability id or a `pie-tool-*` tag appears in core. A renderer is held to the same rule by its own source-boundary tests, because a renderer that names one is the same defect one layer up: it means a host cannot contribute that kind of capability without a PR here.

The rule this encodes: **a capability id may only appear in the layer that is a decision about capabilities.** Core naming one turns a deployment choice into a code change. So core has no packaged registry to fall back on when a host passes none, derives no default profile from registry membership, and no renderer names the capability it mounts.

Within the composition layer, PIE's packaged set is authored through one
**Packaged Capability Composition**. A capability entry binds its registration
to its custom-element delivery and lazy-loader bootstrap sets, its membership
and order in the shipped placement presets, its toolbar order, and an explicit
flag for whether this program treats it as universal. The familiar root exports
— `PACKAGED_TOOL_REGISTRATIONS`, tag and loader maps, placement/order constants,
the universal preset, and `createPackagedToolRegistry()` — are projections of
that module rather than independent catalogs. Universal policy remains
explicit data: the composition rejects a universal content-dependent capability
but never infers eligibility from registry membership.

Composition invariants are strict in the package build because they are
PIE-authored release data, not runtime host input. They are not repeated as a
browser import-time exception. Host behavior stays fail-soft: loader
installation is still opt-in, overrides keep their existing precedence, and an
unknown id in a `toolIds` selection is ignored while known capabilities continue
to register. That distinction catches a package author forgetting a loader or
tagging a region as a toolbar element without making our defect — or a host's
non-critical stale selection — block an assessment.

### Host surfaces

A capability that does not render on a toolbar declares `activation: "region"`, the host slot names it fits in `surfaces`, and `renderSurface(context)`. The renderer asks `registry.getToolsBySurface(name)` and mounts what comes back, so it names no capability and a host opens a new surface without a change here. Surface names belong to the renderer; core validates only that a region capability claims one.

Section-player's three slots — `content-lead`, `content-media`, and
`section-overlay` — are geometry adapters over one internal **Tool Surface
Host**. Its narrow interface is `update(currentInput)` plus `destroy()`, with a
snapshot containing only `mountable` and `occupied`. The module owns registry,
policy, and catalog observation; eligibility; structural comparison; lazy
loading; ordered DOM reconciliation; synchronization; diagnostics; and
teardown. Deleting it would put the same lifecycle back into all three
adapters.

Availability at a surface is grant **and** content: `decideFeaturePolicy(supportId)`, then `requiresAuthoredContent.resolve(...)`, then `renderSurface`. Neither half implies the other, which keeps a learner with an accommodation from seeing a dead affordance on the items that carry no resource. The catalog resolver owns entity and model traversal and owner-filtered observation; `resolve` receives only the immutable cards visible to that owner.

Two constraints follow. A `region` capability is gated on the feature question and never the placement question — placing one is a `tools.unplaceableActivation` error, so the placement question has no answer to give. And a content dependency resolves against an item model or a passage, never a section, because a DRD resource pairs with content rather than with a container: a section-scoped surface declines a capability that declares one.

The host's off switch for a `region` capability is therefore `tools.policy.blocked`, which names capabilities rather than placements. `decideFeature(...)` applies it, and `tools.policy.allowed` as an allow-list, before any policy source is consulted; the denial reports `rule: "host-blocked"` / `"host-allowlist"` at precedence 0, the same vocabulary `composeDecision(...)` records. `provider-disabled` and `placement-membership` stay out of the feature path, both being statements about a toolbar the capability was never on.

A host denial outranks `resolvesWithoutGrant`. That flag lets a content-dependent capability answer from the content when policy granted nobody, since an authored `visibility: "always"` transcript is not an accommodation. A blocklist entry says the capability has no place in this delivery, and the content does not get to reopen it.

The host observes successful `ToolRegistry` mutations. Registering a capability
adds it in registration order; unregistering or clearing destroys it; overriding
remounts that id with the new registration; component-override and late-loader
changes are reconciled without a player rerender. Lazy completions are guarded
against stale registrations and teardown, and mounted nodes are reordered
without recreation when modules resolve out of order.

A failure in resolution, loading, rendering, synchronization, or teardown is
isolated to that capability and reported as a recoverable `tool-surface`
framework warning. Render failure omits only that capability, sync failure keeps
its last working element, and destroy failure still force-removes the node.
Recoverable warnings remain observable through events and hooks but do not set
section readiness to `error`; nonrecoverable framework errors retain the
existing blocking behavior.

`@pie-players/pie-tool-sign-language` is the worked example. It is deliberately absent from `createPackagedToolRegistry`, because a content-dependent accommodation is opt-in, so a host installs and registers it exactly as it would one of its own. The [tool registry reference](../../packages/assessment-toolkit/docs/TOOL_REGISTRY.md#host-surfaces) carries both contracts.

Host surfaces are one instance of a broader pattern: a fact only the container knows, published for whichever descendant needs it rather than pushed to a known list of consumers. `renderSurface(context)` publishes, the capability resolves, and `sync(context)` is the change signal. [`../architecture/composition-context.md`](../architecture/composition-context.md) states the pattern and its invariants.

---

## Tool Scope Architecture: Placement + Scoped IDs

Independently of how a capability is invoked, tools are categorized by their **scope and lifecycle** within an assessment:

![Item and section tool instances over one navigation: when section s1 opens, every item card mounts its own toolbar, so answerEliminator:item:q1 and answerEliminator:item:q2 exist beside graph:section:s1; moving to q2 creates or releases nothing; when s2 opens, the s1 cards release their tools and the section toolbar re-scopes to graph:section:s2; back on s1 the tool elements are new and closed, eliminations come back from the coordinator's tool-state store, and graph points start over](../img/tools-scope-lifecycle.excalidraw.svg)

### Item-Level Tools

Tools placed at item level work within one item card:

**Characteristics:**
- **One instance per card**: each card's toolbar holds its own instance, such as `answerEliminator:item:q5`
- **DOM-scoped**: the tool queries and acts on its card's content region
- **State isolation**: tool state is tracked per item and element (Q5 eliminations ≠ Q6 eliminations)
- **UI integration**: buttons in the card's header toolbar
- **Compact footprint**: small buttons suited to inline placement

**Examples:**
- **Text-to-speech** (`textToSpeech`, rendered by `<pie-tool-tts-inline>`): reads this item's text
- **Answer eliminator** (`answerEliminator`): strikes through choices for this item only
- **Annotation toolbar** (`annotationToolbar`): highlights within this item's text; one strip serves the whole section (see [Selection-Gateway Runtime Model](#selection-gateway-runtime-model))
- **Calculator** (`calculator`, item-only): opens a draggable window scoped to this item

**State Management:**

The coordinator's `ElementToolStateStore` holds what a tool writes to it, keyed per element and attempt. Only three tools write there: the answer eliminator (eliminations), the annotation toolbar (highlights) and the color-scheme tool (`theme`, the learner's scheme). Other state, such as whether a tool is open, lives in the tool element and starts over when the element is created.

```typescript
// State stored with item-specific ID
elementToolStateStore.setState(
  'assessment:section-1:attempt-1:question-5:mc1',
  'answerEliminator',
  { eliminatedChoices: ['choice-b', 'choice-d'] }
);

// When the learner comes back to this section, the eliminator reads it back
const state = elementToolStateStore.getState('assessment:section-1:attempt-1:question-5:mc1', 'answerEliminator');
// { eliminatedChoices: ['choice-b', 'choice-d'] }
```

### Section-Level Tools

Tools placed at section level sit on the section toolbar and serve every item in the section:

**Characteristics:**
- **One instance per section**: such as `graph:section:section-1`
- **Global scope**: not bound to one item's DOM
- **Element state**: the graph's points and lines last while the section is open
- **UI pattern**: floating windows with z-index management. Item-level window tools, such as the calculator and the dictionaries, use the same draggable windows.

**Examples:**
- **Graph** (`graph`): plot points and lines on a coordinate plane, for reference across the section
- **Periodic table** (`periodicTable`): reference material
- **Protractor** (`protractor`) and **ruler** (`ruler`): measure angles and lengths in diagrams
- **Line reader** (`lineReader`): reading guide overlay
- **Color-scheme tool** (`theme`): applies a color scheme, such as high contrast, to all content

Every example except the color-scheme tool also supports item placement, and the line reader passage and rubric placement as well. The color-scheme tool supports assessment and section placement.

**Element reuse:**

A section-level tool keeps its state in its own element; the graph's points and lines are component state. Every packaged window tool reuses one element per coordinator and scoped id, so a policy change that re-renders the toolbar keeps that state; the element is recreated only if the cached one was disconnected. A registration that creates its element on every render starts over on each re-render. An item's settings registering or withdrawing re-renders only the toolbars whose tools it changed.

### Configuration in ToolkitCoordinator

`tools.placement` carries the scope distinction: each tool id is listed under the level it shows at (`section`, `item`, `passage`), and `tools.providers` carries its runtime configuration. [Configuring Tools](./tool_provider_system.md#basic-integration) gives a complete configuration, and [Calculator With Host Auth](./tool_provider_system.md#calculator-with-host-auth) the calculator's key.

### Canonical Tool Resolution Flow

![Six gates between a placed tool and its button: placement, the policy decision, the tool registry, a host resolver or the registry's context checks, toolbar activation, then the button and tool element; a tool that fails a gate gets no button, and its provider and backend start on first use, or at readiness for text-to-speech](../img/tools-resolution.excalidraw.svg)

[Runtime Tool Context Resolvers](./tool_provider_system.md#runtime-tool-context-resolvers)
gives the resolution order and what a host resolver may change.

### Structured Tool Instance IDs

Tool instances use a scoped ID format:

```text
<toolId>:<scopeLevel>:<scopeId>
```

Examples:
- `calculator:item:q1`
- `graph:section:section-1`
- `textToSpeech:passage:passage-2`

The scope levels are fixed: `assessment`, `section`, `item`, `passage` and `rubric`. `createScopedToolId` throws on any other. The toolbars the players render scope their ids at `section`, `item` or `passage`, and a rubric block's toolbar scopes at `passage`.

### Lifetimes and Scope Consequences

**1. Lifetimes**
- All item cards of a section stay mounted, so moving between items creates and releases nothing.
- An item card's tools are released when the card unmounts, at a section change.
- Section tools re-scope at a section change, to the new section's id; their element state starts over.
- Only eliminations, highlights and the color-scheme choice survive a section change, through the tool-state store. Open state and graph points are not restored.

**2. Service Requirements**
- Any tool, at any level, may declare provider and runtime hooks (auth, backend request bridge, host events).

**3. UI Patterns**
- Item tools: compact buttons in the card header
- Window tools at any level: draggable windows
- The floating shell host notifies optional tool hooks (`onHostedMount`, `onHostedResize`, `onHostedUnmount`)

**4. State Models**
- Item tools: state per item (which answers are eliminated for Q5)
- Section tools: one state for the section (graph points and lines)

**5. PNP Mapping**
- A profile grants a tool by its `toolId`, which is its support id; placement sets the level the tool shows at
- Example: `answerEliminator`, placed at item level
- Example: `graph`, placed at section level
- An id no tool is registered under, in the profile, district policy, test administration or item settings, produces a `tool-policy.unknownSupportId` diagnostic on the policy engine's resolved inputs, which the toolkit coordinator logs once per id

### Implementation Example

**Section Player Rendering:**

```svelte
<!-- One coordinator serves every toolbar under the toolkit -->
<pie-assessment-toolkit {coordinator}>
  <!-- Section level: one toolbar for the whole section -->
  <pie-section-toolbar section-id={section.id} />

  <!-- Item level: each card renders a scope, its toolbar and its content region -->
  {#each items as item}
    <pie-item-scope item-id={item.id} {item}>
      <!-- Placement decides the buttons. The scope supplies the item, its id and
           the element the tools act on; the registry comes from the coordinator. -->
      <pie-item-toolbar />

      <!-- textToSpeech reads this region first -->
      <div data-region="content">
        <pie-item-player config={item.config} />
      </div>
    </pie-item-scope>
  {/each}
</pie-assessment-toolkit>
```

Each toolbar mounts the elements of its floating tools, such as `pie-tool-graph` and `pie-tool-calculator`, in toolbar-hosted windows. A toolbar's own `item`, `item-id`, `scopeElement` and `toolRegistry` override what it takes from the scope and the coordinator.

---

## Core Services

### ToolCoordinator

**Purpose:** Central service holding tool visibility state and stacking tool elements.

**Responsibilities:**
- Register/unregister tools
- Hold each tool's on/off state; whoever renders a tool shows or hides it from that state
- Bring a tool to the front of its layer when it is shown or pressed
- Maintain z-index layers
- Notify subscribers of state changes

A tool's own registration names its layer. A toolbar registers the tool when it activates it, before the tool's component mounts, and binds its floating window; the window then stacks in the tool's layer. The outermost bound element stacks, so a tool rendered inside a toolbar window stacks by the window.

**Z-Index Layers:**
```
0-999:     PIE content and player chrome (BASE)
1000-1999: Floating tools and their windows: calculator, graph, ruler, protractor, line reader (TOOL)
2000-2999: Modal tool surfaces, such as the color-scheme tool's picker (MODAL)
3000-3999: Drag handles and resize controls (CONTROL)
4000-4999: TTS and annotation highlights (HIGHLIGHT)
```

**Pattern:** One instance per ToolkitCoordinator, shared by every tool under it, with listener-based subscriptions.

**Benefits:**
- No z-index conflicts between tools
- Consistent visual stacking
- Tools don't need to know about each other
- Easy "hide all tools" functionality
- Simplifies state persistence

### HighlightCoordinator

**Purpose:** Manages text highlighting for TTS and annotations using CSS Custom Highlight API.

TTS (temporary word and sentence highlights) and student annotations (persistent highlights) show at the same time, so HighlightCoordinator keeps a separate highlight registry for each, through the browser's CSS Custom Highlight API.

**Key Methods:**
```typescript
// TTS Highlights (temporary)
highlightTTSWord(ranges)
highlightTTSSentence(ranges)
clearTTS()

// Annotation Highlights (persistent)
addAnnotation(range, color) → annotationId
removeAnnotation(annotationId)
clearAnnotations()
```

**Technology: CSS Custom Highlight API**

Modern browser standard (Chrome 105+, Safari 17.2+, Firefox 140+) for highlighting text without DOM mutation:

```typescript
// NO DOM changes - virtual highlight layer
const range = new Range();
range.setStart(textNode, startOffset);
range.setEnd(textNode, endOffset);

const highlight = new Highlight(range);
CSS.highlights.set('highlight-name', highlight);
```

Highlights overlap without changing the text structure; [CSS Custom Highlight API](#css-custom-highlight-api) under Architecture Decisions gives the reasoning.

**Browser Support:** Graceful degradation for older browsers.

### TTS Service

**Purpose:** Text-to-speech with word highlighting synchronization; one instance per ToolkitCoordinator, shared by every tool under it.

**Capabilities:**
- Read full question or selected text
- Pause, resume, stop playback
- Word-level highlighting synchronized with audio
- Voice selection and speed control
- State management (playing, paused, stopped)

**Provider Architecture:**

The service uses a pluggable provider pattern:
- **BrowserTTSProvider** - Uses Web Speech API (the `browser` backend)
- **ServerTTSProvider** - From `@pie-players/tts-client-server`, which the TTS registration in `@pie-players/pie-default-tool-loaders` loads and hands to `TTSToolProvider`. The `server` backend uses it, with the vendor in `serverProvider` (`polly`, `google` or `custom`), to play speech synthesized by a host TTS server, such as one built on `@pie-players/tts-server-polly` or `@pie-players/tts-server-google`
- Provider registration is descriptor-driven from tool registrations.
- `tools.providers[toolId]` is generic for every tool (`enabled`, `provider`, `settings`); `tools.providers.textToSpeech` is closed to its runtime settings, set at its top level, and reads no `settings`.
- Runtime hooks (`provider.runtime`) support auth fetch, backend request bridging, and host event wiring.

**Integration with Highlighting:**
```
TTS Service
  ↓ triggers
HighlightCoordinator.highlightTTSWord()
  ↓ creates
CSS.highlights.set('tts-word', highlight)
  ↓ renders
Yellow highlight with underline (::highlight CSS)
```

**QTI 3.0 Catalog Integration:** TTS integrates with AccessibilityCatalogResolver for SSML support. The section player registers authored catalogs and `config.extractedCatalogs`; embedded `<speak>` extraction must run before render if that content style is used.

**Multi-Level TTS Entry Points:**

- **Content-Level TTS** (`textToSpeech`, rendered by `<pie-tool-tts-inline>`): Speaker icons in passage/item headers pass catalog context and a live content element, allowing `TTSService` to resolve `data-catalog-idref` regions.
- **Annotation toolbar read-aloud**: Passes the selection's range to `speak`, with the catalog context of the shell holding it. A `data-catalog-idref` region the selection holds whole reads its spoken card; part of one reads as the selected visible text.

**Read-aloud suppression:** `data-tts-suppress` on a content element marks it never-spoken, for items where reading is the construct (decoding, spelling). It is enforced in *every* entry point above — including the selection path, which filters the `Range` because it never walks the DOM — and it overrides both an authored `spoken` card and the learner's PNP entitlement. Speech-only by decision: braille preserves orthography where speech destroys it, and for signing the deciding fact lives in the recording rather than the markup. See [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md#suppressing-read-aloud).

**Recorded audio:** a `spoken` card may carry an audio file instead of a script, which QTI treats as the same support rather than a separate accommodation. The clip plays in the composed chunk sequence, the docked node highlights as a block for its duration since a recording emits no word boundaries, and a clip that will not play degrades to the node's script. See [Recorded Audio as a Spoken Alternate](../accessibility/accessibility-catalogs-integration-guide.md#recorded-audio-as-a-spoken-alternate).

**Design Decision:** Every TTS entry point under a ToolkitCoordinator speaks through its one TTS service, so two entry points never play at once. Catalog resolution is shared by every entry point: the inline TTS tool resolves cards for the region it reads, selection read-aloud for the regions a selection holds whole.

---

## Integration Patterns

### Tool Registration Pattern

A tool element registers with the ToolCoordinator in its runtime context through
`createToolCoordinatorRegistration`, re-registers when a republished context
brings a new coordinator, and hands the coordinator its element once it renders.
`release` unregisters from the coordinator the registration was made against,
which is not necessarily the one currently in context. The
[ToolCoordinator API](../../packages/assessment-toolkit/README.md#toolcoordinator)
gives the code.

### Text Selection Pattern

Annotation Toolbar detects selection and provides gateway to text-based tools:

```
User selects text
  ↓
Annotation Toolbar detects it from `selectionchange`; a pointer drag only delays the strip until it settles
  ↓
Extract range, validate (highlightable content)
  ↓
Show floating toolbar with options
  ↓
User clicks action → Emit event with text/range
  ↓
Tool receives event and displays with data
```

**Benefits:**
- Single implementation of selection logic
- Consistent UX across text tools
- Centralized accessibility handling
- Easy to add new text-based tools

### Selection-Gateway Runtime Model

`annotationToolbar` runs as one section-scoped singleton gateway, whichever toolbars carry its button:

- Mounted once per section runtime
- Activated by text selection events in content
- Owns highlight, underline and read-aloud of the selection
- Renders `ToolSelectionAction` entries supplied by whoever composes it, and calls `requestTool` through them. The composition layer pairs those to the dictionary and picture dictionary; the gateway names neither.
- Latches itself down after a completed action, because the selection survives on purpose and opening a panel fires `selectionchange` — without the latch the strip returns over the panel it just opened. Escape and focus leaving do not latch; Shift+F10 clears one.

Whether it shows follows the standard decision order: placement, the provider's `enabled` flag, the allow and block lists, custom policy sources and the profile, then any host resolver. [Runtime Tool Context Resolvers](./tool_provider_system.md#runtime-tool-context-resolvers) gives the full order.

### State Persistence Pattern

Tools write state to the coordinator's `ElementToolStateStore`, keyed `assessmentId:sectionId:attemptId:itemId:elementId`, so each attempt keeps its own. The answer eliminator writes per element; the annotation toolbar writes per item, or per section when it sits outside an item, leaving the trailing parts empty; the color-scheme tool (`theme`) writes the learner's scheme per section and attempt. The host persists the store through two coordinator hooks:

```typescript
const coordinator = new ToolkitCoordinator({
  assessmentId: 'math-exam',
  toolRegistry,
  hooks: {
    // Read once, while the coordinator gets ready
    loadToolState: () => JSON.parse(sessionStorage.getItem('tool-state') ?? 'null'),
    // Receives the whole state map on every change
    saveToolState: (state) => sessionStorage.setItem('tool-state', JSON.stringify(state)),
  },
});
```

**Storage Options** (the host's choice):
- sessionStorage (temporary, current session)
- IndexedDB or a server (persistent, cross-session)

**Benefits:**
- State isolated per element
- Survives navigation
- Host controls storage strategy
- Tools don't need storage logic


### PIE Element Integration

Content controls tools through two data attributes:

```html
<!-- A region an accessibility catalog card describes; TTSService resolves it -->
<div data-catalog-idref="prompt-1">Question text</div>

<!-- Never read aloud, for items where reading is the construct -->
<span data-tts-suppress="computer-read-aloud">cat</span>
```

**Benefits:**
- Non-invasive (data- attributes ignored by screen readers)
- Content authors control tool behavior per element
- Clear contract between content and tools

Tools otherwise read the content itself. Relevance checks read the item's authored config: `hasMathContent`, `hasReadableText` and `hasScienceContent` scan its markup and model text, and `hasChoiceInteraction` looks for choice element types among its models. The annotation toolbar works on the rendered selection, highlighting it through the CSS Custom Highlight API and reading it aloud. The answer eliminator finds choices in rendered multiple-choice, EBSR and inline-dropdown elements through per-element adapters, which depend on each element's markup.

---

## Technology Stack

### Core Technologies

**Web Components (Custom Elements)**
- Framework-agnostic standard
- Native browser support
- Encapsulation with shadow DOM (optional)
- Lifecycle hooks (connectedCallback, disconnectedCallback)

**Svelte 5**
- Internal tool implementation
- Reactive state management with runes ($state, $derived, $effect)
- Compiles to efficient vanilla JavaScript

**CSS Custom Highlight API**
- Native browser highlighting without DOM mutation
- Multiple overlapping highlights
- Screen reader compatible
- Better performance than span-based approaches

**Web Speech API**
- Browser-native text-to-speech
- Voice selection and rate control
- Word boundary events for highlighting
- No external dependencies

### Supporting Libraries

**Calculator provider suites**
- The generic calculator contract (`@pie-players/pie-calculator`) and the
  toolkit's lifecycle surface do not import a vendor. The calculator toolbar
  registration in `@pie-players/pie-default-tool-loaders` imports all three
  provider adapters and selects one by `provider.id`.
- Desmos is the default when no `provider.id` is set and supports basic,
  scientific, and graphing modes. It needs an application key; see
  [Calculator With Host Auth](./tool_provider_system.md#calculator-with-host-auth).
- GeoGebra is selected explicitly with `provider.id =
  "calculator-geogebra"`; it supports scientific and graphing apps and maps a
  basic request to scientific.
- Cortex is selected with `provider.id = "calculator-cortex"`;
  `@pie-players/pie-calculator-cortex` bundles MathLive, the Cortex Compute
  Engine and JSXGraph, supports basic, scientific, and graphing modes, and
  needs no key, CDN, or network connection at runtime.
- Desmos and GeoGebra application code is loaded at runtime from the vendor and
  is not bundled into PIE packages.
- Desmos and GeoGebra are separately licensed from PIE's MIT adapter code; hosts
  are responsible for the applicable license and attribution in demos and
  deployed applications.

### Browser Support

**Target:** Modern evergreen browsers (Chrome, Edge, Firefox, Safari)

**Key API Support:**
- CSS Custom Highlight API: Chrome 105+, Safari 17.2+, Firefox 140+
- Custom elements and Web Speech synthesis (`speechSynthesis`): every target browser
- CSS Container Queries: Chrome 105+, Safari 16+, Firefox 110+

**Fallback Strategy:** Graceful degradation for highlighting (features work, visuals may be limited)

---

## Accessibility & Accommodations

### WCAG 2.2 AA Baseline

The toolkit is held to the criteria in the [WCAG 2.2 AA baseline](../wcag/wcag-2.2-aa-baseline.md).
Known gaps against it are listed in [deferred issues](../wcag/deferred-issues.md).

### Accommodation Types

**Text-to-Speech**
- Reads question, passage, or selection
- Highlighting synchronized with audio: by sentence on browser voices, by word on server voices that return speech marks
- Speed and voice control
- Pause/resume capability

**Visual Accommodations**
- Color scheme adjustment (high contrast)
- Text highlighting in four colors, and underline
- Line reader (focus/masking)

**Calculation Support**
- Basic, scientific, graphing calculators
- Calculation history in the bundled Cortex calculator

**Measurement Tools**
- Ruler (metric/imperial)
- Protractor (degree measurement)
- Reference materials (periodic table)

### Configuration Precedence

Policy merges district, test-administration, item and learner-profile inputs through eight precedence levels; the [PNP configuration guide](../../packages/assessment-toolkit/docs/PNP_CONFIGURATION.md#precedence) lists them with their rule ids.

---

## Architecture Decisions

### CSS Custom Highlight API

Highlights are drawn through the CSS Custom Highlight API. The alternative is wrapping text in markup:

**DOM-Mutation Highlighting Pattern:**
```html
<span class="highlight-yellow">Selected text</span>
```

**Problems:**
- Breaks React/Vue/Svelte virtual DOM
- Security risk (innerHTML manipulation)
- Requires cleanup
- Interferes with screen readers
- Complex serialization

**PIE's approach:**
```typescript
const highlight = new Highlight(range);
CSS.highlights.set('annotation-yellow', highlight);
```

**Benefits:**
- Zero DOM changes
- Framework-compatible
- Screen reader friendly
- Better performance
- Simpler code

### One Service Instance Per Coordinator

**ToolCoordinator, TTS Service and HighlightCoordinator have one instance per ToolkitCoordinator, shared by every tool under it.**

**Rationale:**
- Single source of truth for state
- Prevents conflicts (one TTS playback, one z-index manager)
- Simplifies tool implementation (no coordination needed)
- Easier testing (one instance to mock)
- Matches the coordinator's lifecycle

### Declared Activation

A capability declares its activation and keeps its own input. The alternative, a dependency hierarchy with a tier of capabilities that depend on the gateway, makes a capability's keyboard accessibility a property of the gateway. No gateway can supply that, because a sighted keyboard-only learner cannot originate a text selection in non-editable content.

**Rationale:** activation says how a capability is invoked and nothing about what it depends on. A selection is one way in, added by the composition layer; the capability keeps its own input and stays reachable when no gateway is granted.

**Benefits:**
- Keyboard reachability is a property of the capability, where it can be guaranteed
- Selection handling stays in one place without capabilities inheriting a dependency on it
- A host can pair its own capability to the gateway without changing either
- Each layer is testable alone

### Web Components

**Rationale:**
- Framework-agnostic (works with React, Vue, Angular, vanilla JS)
- Native browser standard
- No build-time dependencies for consumers
- Clean public API surface

**Trade-offs:**
- Slightly larger than pure Svelte (but still small)
- Tool elements use open shadow roots; the three floating calculator elements (Desmos, GeoGebra, Cortex) render without one
- Requires compilation step (handled by Svelte)

---

## References

### Standards & Specifications

- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
- [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

### Legal & Compliance

- [Section 508 Standards](https://www.section508.gov/)
- [Section 504 FAQ (U.S. Department of Education)](https://www.ed.gov/laws-and-policy/civil-rights-laws/disability-discrimination/frequently-asked-questions-disability-discrimination)

### Implementation

- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [Desmos API v1.12](https://www.desmos.com/api/v1.12/docs/index.html)
- [Desmos API Terms](https://www.desmos.com/api-terms)
- [GeoGebra Apps Embedding](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/)
- [GeoGebra Apps API](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/)
- [GeoGebra License](https://www.geogebra.org/license)
