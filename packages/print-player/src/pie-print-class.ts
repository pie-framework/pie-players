/**
 * `PiePrint`, typed as the framework-free {@link PiePrintElement}.
 *
 * The class extends `LitElement`, and a declaration that said so would put Lit
 * in every host's type graph. Assigning it to {@link PiePrintConstructor} is the
 * compile-time check that the interface describes what the class does.
 */

import type { PiePrintConstructor, PiePrintElement } from "./element.js";
import { PiePrint as PiePrintClass } from "./pie-print.js";

export const PiePrint: PiePrintConstructor = PiePrintClass;
export type PiePrint = PiePrintElement;
