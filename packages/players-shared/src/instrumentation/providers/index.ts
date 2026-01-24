/**
 * Instrumentation Providers
 *
 * This module exports all available instrumentation providers.
 */

// Base class for creating custom providers
export { BaseInstrumentationProvider } from "./BaseInstrumentationProvider";
export type { ConsoleProviderConfig } from "./ConsoleInstrumentationProvider";
// Built-in providers
export { ConsoleInstrumentationProvider } from "./ConsoleInstrumentationProvider";
export type { DataDogConfig } from "./DataDogInstrumentationProvider";
export { DataDogInstrumentationProvider } from "./DataDogInstrumentationProvider";
export { NewRelicInstrumentationProvider } from "./NewRelicInstrumentationProvider";
