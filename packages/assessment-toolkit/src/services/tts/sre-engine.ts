import * as speechRuleEngine from "speech-rule-engine";
import { sreStartupLocaleSource } from "./sre-locales.js";

const sre = speechRuleEngine.default ?? speechRuleEngine;

// SRE starts itself up while this module's import of it evaluates, then loads
// `base` and `en` a few microtasks later from whatever locale source is set by
// then. In a bundle this call runs synchronously after that evaluation, so it
// lands first; configuring SRE after awaiting an `import()` of it lands after
// those loads. Bun drains microtasks between evaluating a CommonJS module and
// its importer, so there SRE reads `base` from its own package directory.
void sre.setupEngine(sreStartupLocaleSource());

export default sre;
