---
name: ticket-comment-discipline
description: Enforces brief, on-scope Jira / Confluence / GitHub ticket comments. Use whenever posting to an external tracker on the user's behalf (addCommentToJiraIssue, Confluence comments, GitHub PR/issue comments, or any equivalent external-communication tool). Keep comments tight; do not expand scope.
allowed-tools: Read
---

# Ticket Comment Discipline

Canonical rule: [`.cursor/rules/ticket-comment-discipline.mdc`](../../../.cursor/rules/ticket-comment-discipline.mdc).

## Core rules

1. **Brief and on-point.** Summarize what landed in this repo, plus — if
   relevant — the single action another team needs to take. Nothing more.
2. **Stay in scope.** Do not add sub-ticket asks, epic restructuring
   suggestions, process recommendations, or unsolicited next-steps unless
   the user explicitly asked for them. If you think something is worth
   raising, **ask the user first**.
3. **Prefer bullets over prose** for technical summaries. Cite APIs, tags,
   filenames verbatim in backticks.
4. **No editorializing** about responsibility splits, team ownership, or
   process unless the ticket thread is explicitly about that.
5. **No filler.** Skip greetings, sign-offs, "Short version:", "Hope this
   helps", "Thanks!". Open with content.
6. **Honor removals.** If the user removed a prior comment and asks for a
   rewrite, do not reintroduce content they removed.

## When to use

Triggered whenever you are about to call any of:

- `addCommentToJiraIssue`
- `createConfluenceFooterComment` / `createConfluenceInlineComment`
- GitHub PR/issue comment creation (`gh pr comment`, `gh issue comment`)
- Any equivalent external-communication MCP tool

## Checklist before sending

- [ ] Does the comment cover only the work just completed / the user's
      stated topic?
- [ ] Any asks, next-steps, or process suggestions? If yes, remove them
      (or ask the user first).
- [ ] Is it shorter than the previous draft when a previous draft exists?
- [ ] No filler phrases, greetings, or sign-offs?
- [ ] APIs / tags / filenames in backticks?
