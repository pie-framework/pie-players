---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-player": patch
---

Resolve Speech Rule Engine's XML dependency to `@xmldom/xmldom` 0.9.12 for
workspace builds, fixing GHSA-6gmq-8vp8-gcm6. Keep the existing Speech Rule Engine
version and math-speech API. The workspace override prevents future installs
from selecting an affected XML version, and rebuilt player/tool bundles use
the patched dependency.

Consumers resolving Speech Rule Engine as an external dependency must also
refresh their own lockfile to `@xmldom/xmldom` 0.9.12 or newer on the 0.9 line;
workspace overrides are not inherited from the published toolkit package.
