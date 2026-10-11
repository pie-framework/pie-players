---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-player": patch
---

The built-in delivery client follows pie-api-aws's player contract. It stamps
each request with `x-date`, sends `overrides` only when the map has entries,
names the session rather than the item in a session model request, and rejects
with pie-api-aws's error detail. pie-api-aws's flat model response, under
authored tags, now refreshes item and passage models.

This breaks three things. `backend.authoring` drops `provider`, `baseUrl`,
`endpoints`, `request` and `auth`, along with the `BackendAuthoringEndpoints`
type, so every authoring operation needs `backend.authoring.client`. The score
option `disablePartialScoring` becomes `skipCached`, and `env.partialScoring`
now sets partial scoring. The assessment player no longer copies `attempt-id`
into `backend.delivery.assignmentId`.
