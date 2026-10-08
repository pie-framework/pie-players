/**
 * Imported first by every test file here. Registers happy-dom for the run, and
 * keeps the runtime's own `Event`, which a test loads a copy of the package
 * under to stand for a bundle evaluated before a DOM was registered.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

export const RuntimeEvent = globalThis.Event;

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
