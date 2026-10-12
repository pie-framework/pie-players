---
"@pie-players/pie-assessment-toolkit": patch
---

Removing the toolkit now commits its items' pending responses into the section before the section persists and disposes. They were lost when a host removed the player on submit, timeout or exit.
