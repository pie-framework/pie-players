---
"@pie-players/pie-item-list": patch
---

`pinnedSummaries` retries a summarizer whose load failed because the CDN was unreachable or answered 408, 429 or 5xx, up to three times per page, instead of keeping the prompt rung for the rest of the page.
