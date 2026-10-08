/**
 * Imported first by every test file here. The package's event classes extend
 * the `Event` global of the moment their module is evaluated, and happy-dom
 * dispatches only its own events, so happy-dom is registered before the package
 * loads and stays registered for the run.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
