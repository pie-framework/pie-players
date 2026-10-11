---
name: consumer-dependency-audit
description: Refresh docs/integrations/consumer-api-dependencies.md by re-deriving which @pie-players surfaces downstream host applications actually consume, and re-grouping the change-risk lists. Use when asked to update, refresh, verify, or extend the consumer dependency pad, when adding a consumer to it, when checking whether a proposed public-surface change would break a client, or before cutting a release that touches a public surface. Trigger on cues like "consumer dependencies", "dependency pad", "who consumes this", "will this break clients", "downstream hosts", "consumer api surface".
argument-hint: '[consumer-label | surface | "add <shape>"]'
---

Read and follow [`.agents/skills/consumer-dependency-audit/SKILL.md`](../../../.agents/skills/consumer-dependency-audit/SKILL.md).
