/** Registers the provider-neutral `<pie-tool-calculator>` custom element. */
import { defineCustomElementSafely } from "@pie-players/pie-players-shared";
import CalculatorElement, { registration } from "./CalculatorElement.svelte";
import type { CalculatorProps } from "./element-props.js";

const elementConstructor = (
	CalculatorElement as typeof CalculatorElement & {
		element: CustomElementConstructor;
	}
).element;

defineCustomElementSafely(registration.tag, elementConstructor);

export type { CalculatorType } from "@pie-players/pie-calculator";

/** Native host interface for `<pie-tool-calculator>`. Properties may be unset until it mounts. */
export interface PieToolCalculatorElement extends HTMLElement, CalculatorProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-calculator": PieToolCalculatorElement;
	}
}
