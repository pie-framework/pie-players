---
"@pie-players/pie-section-player": patch
"@pie-players/pie-theme": patch
---

Stop driving the split-pane pane backdrop from `--pie-passage-header-background` and read the canonical `--pie-background-dark` directly. The pane rule is a grouped selector covering the items pane as well, so a host that set the passage header hook to color a hosted passage-player's header also repainted both pane backdrops — including a pane that holds no passage header. `--pie-background-dark` is what the panes already resolved to whenever the hook was unset, so appearance is unchanged. The backdrop deliberately gets no pane-specific hook: it stays with the theme. `--pie-passage-header-background` keeps its documented job, the passage card bridging it to `--pie-section-player-card-header-background`.
