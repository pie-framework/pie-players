---
"@pie-players/pie-assessment-toolkit": patch
---

A section player given its `runtime` a tick after mount now applies that runtime's
tools and assessment id. A change to those inputs after the section has
initialized is reported once in the console, since the coordinator keeps the
values it was built with.
