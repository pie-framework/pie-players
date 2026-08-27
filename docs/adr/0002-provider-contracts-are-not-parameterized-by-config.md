# 0002 — Provider contracts are not parameterized by their config type

Status: Accepted, 2026-08-26

Owner: PIE Players maintainers

## Decision

A provider contract interface in a `@pie-players` contract package — `CalculatorProvider`
in `pie-calculator`, `ITTSProvider` in `pie-tts` — takes no type parameter for the
configuration its implementations accept. An adapter extends the contract's config
interface and narrows the argument in its own class signature. Vendor credentials
reach a provider through the contract's own `initialize` parameter, not through a
structural mirror declared in a consumer.

## Constraint

TypeScript compares method parameters bivariantly, so a type parameter that appears
only in argument position constrains nothing. A provider declaring
`createCalculator(type, container, config?: DesmosCalculatorProviderConfig)`
satisfies an un-parameterized `CalculatorProvider` exactly as it satisfied
`CalculatorProvider<DesmosCalculatorProviderConfig>`; under `strict`,
`Calculator<A>` and `Calculator<B>` were mutually assignable in both directions.
The parameter's only effect was to require every implementor, every annotation
site, and every consumer holding a provider reference to carry it.

The precision it appeared to buy comes from the adapter's class signature instead. A
caller holding `DesmosCalculatorProvider` gets `DesmosCalculatorProviderConfig` on
`createCalculator` with no parameter in the contract at all.

This is not a rule against generics. A parameter in return position is checked:
`ToolProviderApi<TConfig, TInstance>` in `assessment-toolkit` keeps both, because
`createInstance(): Promise<TInstance>` makes `TInstance` load-bearing. The
discriminant is argument-only position.

## Supporting reason

`pie-tts` already answers this. `ITTSProvider` is not generic, vendor extension is
plain interface extension — `TTSConfig extends StandardTTSConfig, TTSConfigExtensions`
— and `initialize(config: TTSConfig)` takes a config, so a provider that
authenticates is describable by the contract. `CalculatorProvider.initialize()` took
no argument, which is the only reason `DesmosToolProvider` ever needed a structural
mirror of the adapter's `initialize`.

## Trade-off

A deliberate trade: a caller holding only the base interface types the config
argument as `CalculatorProviderConfig` and cannot see `desmos`. Code that needs the
vendor fields imports the adapter's type by name — which is where that type is
owned — so the loss falls on callers that had no business writing vendor config.

## Consequences

- An adapter package owns and exports its vendor configuration types.
  `pie-calculator-desmos` exports `DesmosCalculatorConfig` and
  `DesmosCalculatorProviderConfig`; the contract package exports neither.
- A tool provider in `assessment-toolkit` is typed by the contract-package
  interface, never by an adapter type. `DesmosToolProvider` is
  `ToolProviderApi<DesmosToolProviderConfig, CalculatorProvider>`, matching
  `TTSToolProvider` with `ITTSProvider`.
- An adapter that is an **optional peer** appears only inside a method body.
  Declaration emit preserves `implements` clauses and public return types, so a
  top-level `import type` from an optional peer lands in the published `.d.ts` and
  makes that peer required for any consumer type-checking without `skipLibCheck` —
  the TS2307 failure `scripts/check-deps.mjs` records for `assessment-toolkit`'s two
  peers. A config type parameter invites exactly that import, which is the second
  reason the parameter is gone.
- Provider-level credentials are a contract concern. `CalculatorProviderInit`
  (`apiKey`, `proxyEndpoint`, `onTelemetry`) is the provider-neutral core: a hosted
  vendor needs a key, or a host endpoint that mints one, and instrumentation for the
  load and auth events. A vendor field that does not generalize goes in the
  adapter's own config instead.
- Reviewers reach this through the `api-design-reviewer` checklist, which carries the
  argument-only-position rule and the optional-peer rule.
- Both rules are also stated in `AGENTS.md` — under "Decision Records" as rules, and
  generalized under "Design Principles" as the bar they came from: match the
  precedent this framework already sets, keep a contract from leaking who implements
  it, and delete a surface that constrains nothing rather than documenting that it is
  harmless. A rule reachable only from an ADR is not loaded when it is needed.

## History

The parameter was added to `CalculatorProvider` and `Calculator` and removed again
within one branch. Its inertness surfaced as a `Pick<Calculator, 'destroy' | 'focus'
| 'resize'>` workaround in `pie-tool-calculator-desmos`: the component could not
name the type it was holding, because the parameter carried no information to name.
