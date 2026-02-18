/**
 * Instrumentation Providers
 *
 * This module exports all available instrumentation providers.
 */

// Base class for creating custom providers
export { BaseInstrumentationProvider } from "./BaseInstrumentationProvider.js";
export type { ConsoleProviderConfig } from "./ConsoleInstrumentationProvider.js";
// Built-in providers
export { ConsoleInstrumentationProvider } from "./ConsoleInstrumentationProvider.js";
export type { DataDogConfig } from "./DataDogInstrumentationProvider.js";
export { DataDogInstrumentationProvider } from "./DataDogInstrumentationProvider.js";
export { NewRelicInstrumentationProvider } from "./NewRelicInstrumentationProvider.js";
