---
"@pie-players/pie-assessment-toolkit": patch
---

A district or item requirement for a tool placed at another level no longer raises `tool-policy.requiredToolBlocked` at the levels that leave it out; a requirement no level places reports `placement-missing` with the placement map as `hostValue`. `ToolPolicyDiagnostic` is a union typed by `code` through the exported `ToolPolicyDiagnosticDetails`, and `ToolkitCoordinator.onPolicyDiagnostic` hands hosts the diagnostics the coordinator logs, replaying those already reported.
