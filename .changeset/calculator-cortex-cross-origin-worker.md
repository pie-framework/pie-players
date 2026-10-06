---
"@pie-players/pie-calculator-cortex": patch
---

The Cortex calculator starts when its script is served from another origin, such
as a CDN. It starts its worker from a same-origin `blob:` module that imports the
worker file, so a page's CSP needs `blob:` in `worker-src`.
