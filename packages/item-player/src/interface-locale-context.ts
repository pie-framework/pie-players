import {
	ContextProvider,
	type InterfaceLocaleContextValue,
	interfaceLocaleContext,
} from "@pie-players/pie-context";

/**
 * Answers `interfaceLocaleContext` for every element under `host`.
 *
 * Inside a section the player's provider is the section's, forwarded, so the
 * value published here is the one the toolkit above publishes; standalone, it
 * is the player's own. A locale change, and the catalog landing after it, each
 * reach subscribers through `setValue`.
 */
export function provideInterfaceLocaleContext(
	host: Element,
	initialValue: InterfaceLocaleContextValue,
) {
	const provider = new ContextProvider(host, {
		context: interfaceLocaleContext,
		initialValue,
	});
	provider.connect();
	return {
		setValue: (value: InterfaceLocaleContextValue) => provider.setValue(value),
		disconnect: () => provider.disconnect(),
	};
}
