import { GlobalRegistrator } from "@happy-dom/global-registrator";

// One happy-dom window for the whole run, never unregistered: a Svelte custom element defines its
// tag when its module first evaluates, so a later file's fresh window would lack the tags an
// earlier file imported.
if (typeof window === "undefined") GlobalRegistrator.register();
