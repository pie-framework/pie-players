// Bun runs every test file in one process, so speech-rule-engine evaluates once,
// under whichever file imports it first, and picks its table source as it
// evaluates: a public CDN when `window.document` exists, as it does once a file
// has registered happy-dom, otherwise its own package directory. In Bun its
// start-up load of `base` also lands before `src/services/tts/sre-engine.ts` can
// hand it the packaged loader. Evaluating it here, before any test file runs,
// keeps the suite off the network in any file order.
import "speech-rule-engine";
