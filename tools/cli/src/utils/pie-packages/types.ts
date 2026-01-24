export type ElementSpec = { package: string; version: string; tag?: string };

export type ElementsInput = ElementSpec[] | { elements: ElementSpec[] };
