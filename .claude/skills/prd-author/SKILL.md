---
name: prd-author
description: Use when the user asks to draft, update, or turn a conversation/plan into a PIE Players PRD under docs/prds/ for a public contract, cross-package feature, architecture decision, or implementation-ready contract.
disable-model-invocation: true
---

# PRD Author

Draft or update a PIE Players PRD using this repo's PRD conventions. Prefer synthesis over a new interview: use the current conversation, explored code, architecture notes, and existing PRDs; put unresolved gaps in **Open Questions**.

## When To Use

Use for substantial changes that need an implementation-ready contract:

- new public package exports, custom elements, events, properties, or wire fields,
- shared runtime/session/scoring/media/evidence/accessibility contracts,
- assessment, section, item, toolkit, tool, theme, or adapter-facing behavior that crosses package boundaries,
- plans that need durable scope, ownership, compatibility, and test expectations before implementation.

Do not use for routine bug fixes, internal refactors with no contract change, docs-only edits, dependency bumps, or release/versioning mechanics.

## Process

1. Read `docs/prds/README.md` and `docs/prds/TEMPLATE.md`.
2. Read any related architecture note or existing PRD, especially under `docs/prds/shared-contracts/`.
3. Identify a kebab-case slug and target path under `docs/prds/`; check whether a related PRD already exists before creating a new one.
4. Draft by filling `docs/prds/TEMPLATE.md`. Start as `Status: Draft`.
5. Present the draft in the conversation and ask the user to confirm status and content before writing to disk.

Do not create Jira/GitHub issues, tracker labels, or external comments unless the user separately asks for that write.

## What To Emphasize

- **Ownership**: name exactly one owning package and public export path for public contracts.
- **Contract shape**: document TypeScript names, events, properties, methods, or wire fields precisely enough for review.
- **Compatibility**: call out versioned `pie-*` tags, contract attributes, player APIs, persisted/session data, and host-facing wire data.
- **Host responsibilities**: separate PIE-owned runtime behavior from host-owned persistence, identity, policy, reporting, gradebooks, and standards certification.
- **Serialization/versioning**: define unknown-field, unknown-version, migration, and fixture expectations for persisted or wire-facing contracts.
- **Accessibility**: cover focus, keyboard, screen reader, captions/transcripts, reduced motion, high contrast, and assistive technology impact when user-facing runtime behavior changes.
- **Standards/adapters**: do not claim QTI/PCI, LTI, xAPI, or Caliper conformance unless a concrete adapter and validation suite are scoped.
- **Testing seam**: prefer user-facing player behavior, custom-element boundaries, public runtime contracts, adapter projections, and accessibility outcomes over low-level implementation details.

## Length Discipline

Keep PRDs narrowly scoped to one independently reviewable contract or feature. Be concise, but do not omit required template sections. If a section does not apply, say so explicitly.

Avoid:

- broad generic sections with no PIE-specific content,
- long code snippets when a contract sketch is enough,
- duplicating architecture background already linked under `Related architecture`,
- resolved-question logs; inline resolved decisions into the relevant section.
