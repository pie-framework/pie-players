/** Registers the provider-neutral `<pie-tool-calculator>` custom element. */
import { defineCustomElementSafely } from "@pie-players/pie-players-shared";
import CalculatorElement, { registration } from "./CalculatorElement.svelte";

const elementConstructor = (
	CalculatorElement as typeof CalculatorElement & {
		element: CustomElementConstructor;
	}
).element;

defineCustomElementSafely(registration.tag, elementConstructor);

export type { CalculatorType } from "@pie-players/pie-assessment-toolkit/tools/client";
