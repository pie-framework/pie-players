---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

The New Relic provider looks the browser agent's API up on every call, on
`window.newrelic` or `window.NREUM`, instead of once in `initialize()`, so a
provider initialized before the agent loads sends once it arrives. A
`window.newrelic` whose `noticeError` or `addPageAction` is not a function no
longer counts as the agent.

This adds volume for Host P, which enables `trackPageActions` without naming a
provider and whose agent can load after the first player: on those pages the
item player's runtime errors, and the resource page actions and errors of items
started before the agent, now reach its New Relic account from the agent's
arrival on.
