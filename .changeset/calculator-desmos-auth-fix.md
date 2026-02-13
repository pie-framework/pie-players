---
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-calculator": patch
---

Fix Desmos calculator authentication by including API key in script URL query parameter. The Desmos API requires the API key to be passed when loading the calculator library script.
