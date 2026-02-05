/**
 * Custom Element Registry Management
 *
 * Provides safe custom element registration with state tracking to prevent
 * duplicate registrations and handle edge cases.
 *
 * Ported from pie-print-support/src/ce.ts
 */

interface DefinitionState {
  inProgress?: boolean;
  ready?: boolean;
  error?: Error;
}

const definitions = new Map<string, DefinitionState>();

/**
 * Safely define a custom element, preventing duplicate registrations
 *
 * @param name - Custom element tag name
 * @param def - Custom element constructor
 */
export const define = (name: string, def: CustomElementConstructor): void => {
  const existing = definitions.get(name);

  if (existing) {
    if (existing.ready) {
      return;
    }
    if (existing.inProgress) {
      return;
    }
    if (existing.error) {
      throw existing.error;
    }
  }

  definitions.set(name, { inProgress: true });

  try {
    customElements.define(name, def);
  } catch (e) {
    /**
     * It can be the case that different tags will use the same CustomElement.
     * We don't want to process all the markup so we wrap the definition in an anonymous class.
     */
    if (e && (e as DOMException).code === DOMException.NOT_SUPPORTED_ERR) {
      try {
        customElements.define(
          name,
          class extends def {}
        );
      } catch (wrappedError) {
        console.error('[ce-registry] Wrapped class failed', wrappedError);
        definitions.set(name, { inProgress: false, error: wrappedError as Error });
      }
    } else {
      definitions.set(name, { inProgress: false, error: e as Error });
    }
  }

  customElements
    .whenDefined(name)
    .then(() => {
      definitions.set(name, { inProgress: false, ready: true });
    })
    .catch((e) => {
      definitions.set(name, { inProgress: false, error: e });
    });
};

/**
 * Get the current status of a custom element definition
 *
 * @param name - Custom element tag name
 * @returns Status string indicating registration state
 */
export const status = (name: string): 'error' | 'inProgress' | 'none' | 'inRegistry' => {
  const existing = definitions.get(name);

  if (existing) {
    if (existing.inProgress) {
      return 'inProgress';
    }
    if (existing.ready) {
      return 'inRegistry';
    }
    if (existing.error) {
      return 'error';
    }
  }
  return 'none';
};

/**
 * Wait for a custom element to be defined
 *
 * @param name - Custom element tag name
 * @returns Promise that resolves when element is defined
 */
export const whenDefined = (name: string): Promise<CustomElementConstructor> => {
  return customElements.whenDefined(name);
};
