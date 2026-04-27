# Cursor skills (mirror of `.claude/skills/`)

These skills are kept **byte-identical** with [`.claude/skills/`](../../.claude/skills/).
Cursor and Claude Code read from different folders but both pick up the same
skill format (front-matter `name` + `description` + Markdown body), so we
mirror rather than symlink.

## Edit policy

- When editing a skill, edit **both** copies in the same change. CI guards do
  not currently enforce parity, so reviewers should compare with
  `diff -r .claude/skills .cursor/skills`.
- New skills always start in `.claude/skills/<name>/` then get mirrored to
  `.cursor/skills/<name>/`.
- Skill bodies link to canonical rules in
  [`../../.cursor/rules/`](../rules/) and the project-wide
  [`../../AGENTS.md`](../../AGENTS.md). Do not duplicate rule content into
  skill bodies — link instead.

## Commands

The same lockstep applies to [`../commands/`](../commands/) ↔
[`../../.claude/commands/`](../../.claude/commands/).
