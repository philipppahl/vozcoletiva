# Code Quality Guidelines

Working principles for Rust and TypeScript code. These descend from Robert Martin's *Clean Code* but have been updated to reflect what the last fifteen years of language design and production experience have taught us.

Last verified against current practice: April 2026.

These are guidelines, not laws. Favor judgment over dogma.

## Philosophy

Code is read far more than written. Optimize aggressively for the reader, but remember the reader also cares about correctness and performance. "Clean" is not a synonym for "small functions and lots of classes."

The strongest tools available for clean code in Rust and TS are not naming conventions or function size rules. They are:

1. The type system (use it to make illegal states unrepresentable).
2. Errors as values (push fallibility into signatures).
3. Pure functions at the core, effects at the edges.
4. Tooling (formatter, linter, type checker, borrow checker) running automatically.

If a guideline below conflicts with one of these four, the four win.

## Types First

Before naming, before structure, before tests: shape the types so that bad states are impossible to construct.

- Prefer enums and sum types (`enum` in Rust, discriminated unions in TS) over booleans and string flags. `Status::Pending | Approved | Rejected` beats `is_approved: bool, is_rejected: bool`.
- Newtype primitives that carry meaning. `VatRate(f64)`, `CountryCode(String)`, `OrderId(Uuid)` in Rust; branded types in TS. This eliminates a whole class of "passed the wrong string" bugs.
- Make optionality explicit. `Option<T>` and `T | undefined` are honest; nullable everything is not.
- Total over partial functions. If a function cannot handle every input of its declared type, the type is wrong.
- In TS, prefer `unknown` over `any`. `any` is an escape hatch; using it should require justification.
- Validate at boundaries, brand the result. In TS, Zod (or similar schema validators) at the edges of the system parses untrusted input and produces branded, trusted types for the interior. The runtime check is the bridge between unknown data and your type system.

When you find yourself writing a runtime check that could have been a compile-time guarantee, change the type instead.

## Naming

- Names reveal intent. If a name needs a comment to explain it, rename.
- Pronounceable, searchable. Single letters only for short, conventional loop counters or generic type parameters.
- Classes, structs, types are nouns. Functions and methods are verbs.
- Pick one word per concept across the codebase. Do not mix `fetch`, `get`, `retrieve`, `load` for the same operation.
- Avoid type prefixes (`iCount`, `strName`). The type system already knows.
- Avoid disinformation. Do not call something a `list` if it is a `set`.
- Module and crate names matter as much as function names. They frame how the rest of the code reads.

## Functions

- Do one thing at one level of abstraction. Mixing levels (high-level orchestration with low-level byte fiddling in the same function) is the strongest readability smell.
- Small is a means, not an end. Extract when it adds clarity or enables reuse, not because the function exceeded an arbitrary line count. Three well-named ten-line functions can be worse than one clear forty-line function if the extraction fragments a single coherent operation.
- Few arguments. Three is a soft ceiling. If you need more, group related ones into a struct or options object.
- No flag arguments. `do_thing(x, force=true)` should be two functions or two enum variants.
- Side effects belong in the signature. In Rust, `&mut self` and `Result` make most side effects visible. In TS, mark async, return what you produce instead of mutating inputs.
- Push effects to the edges. The functional core, imperative shell pattern: pure logic in the middle, IO and mutation at the boundary. This is how you make code testable without mock frameworks.

## Errors as Values

This section replaces *Clean Code*'s "use exceptions" advice, which has not aged well in either language.

### Rust

- Use `Result<T, E>` for recoverable errors. Reserve `panic!` for bugs (invariants the programmer believes cannot be violated). Do not use panics for control flow or expected failure modes.
- The right framing for choosing an error library is "handle vs report," not "library vs application." If callers need to match on specific failure modes, give them a typed enum (use `thiserror` to cut boilerplate). If callers will only display or log the error, an opaque reportable type is fine (use `anyhow` or `eyre`).
- Mixing both is normal: `thiserror` enums at module boundaries, `anyhow`/`eyre` aggregating in `main` or top-level handlers.
- Be aware that `thiserror` is a proc-macro crate and adds compile-time cost. For very large workspaces or hot iteration loops, hand-rolled enums with `From` impls remain a valid choice.
- Always wire up cause chains. Use `#[source]` or `#[from]` on your error variants so the underlying error is preserved. Without this, debugging is painful.
- Errors carry context. The error message should answer "what was being attempted, with what inputs, why did it fail." Use `.context()` (anyhow/eyre) or descriptive variant payloads.
- Do not silently coerce errors to `None`. If something can fail, say so in the type.

### TypeScript

- Exceptions remain idiomatic in TS for genuinely exceptional conditions. Unlike Rust, the language and ecosystem do not push you toward Result types.
- For expected failure modes (network calls, parsing, validation), consider Result-style returns. Three realistic options:
  - Hand-rolled discriminated unions (`{ ok: true, value } | { ok: false, error }`). No dependency, fully explicit, more boilerplate.
  - `neverthrow`: lightweight, focused on Result types, has an ESLint plugin to enforce handling. The most common starting point.
  - `Effect`: a much larger functional ecosystem (closer to ZIO/cats-effect). More power, more learning curve, more lock-in.
- Going "all-in" on Result types in TS has real friction (no language support for `?`, no monadic do-notation in standard TS). The benefits compound only if the team commits and uses linting to enforce it. A half-adopted Result library is worse than consistent exceptions.
- Wrap third-party error types at module boundaries. Your domain code should not depend on a specific HTTP client's exception shape.

## Comments and Documentation

- Treat inline comments as a failure to express intent in code. Try renaming or restructuring first.
- Acceptable: legal headers, public API docs (rustdoc, TSDoc), warnings about non-obvious consequences, scoped TODOs with owner or ticket reference, explanations of *why* (not *what*) when the reasoning is genuinely non-obvious.
- Doc comments on public APIs are not optional. Future you and your collaborators read them constantly. Examples in doc comments are gold; in Rust they double as tests.
- Delete: commented-out code, journal entries, redundant restatements of the code, comments that have drifted from the code they describe.
- "Just in case" commented-out code does not exist. Version control remembers.

## Formatting and Linting

- Delegate to the formatter. No team time spent on bracket placement.
- Rust: `rustfmt` (default config is fine for most projects; pick once and check it in).
- TypeScript (new projects): Biome (v2.x, currently v2.4 as of Feb 2026) is now the default. Single binary, formats and lints in one pass, includes type-aware lint rules without invoking `tsc`. Use `biome check` in CI.
- TypeScript (existing projects): if you depend on plugins not yet covered by Biome (some `eslint-plugin-react-hooks` rules, framework-specific plugins, custom in-house rules), stay on ESLint + Prettier or run a hybrid. Migrate when the gap closes.
- Lint configuration is part of the codebase. `clippy` for Rust, with strictness dialed up. CI fails on lint errors.
- Vertical openness separates concepts; vertical density associates them. Related functions live near each other.

## Boundaries and Architecture

- Keep external dependencies behind interfaces you own. Adapters at the edge, domain in the middle. This is hexagonal architecture, ports and adapters, or just "do not let the SDK leak into your domain types."
- Write learning tests when integrating a new library. They pin down your assumptions and catch breaking changes on upgrade.
- Module boundaries are the most important design decisions. They are also the hardest to change later. Spend disproportionate care on what each module exposes.
- Public APIs are forever. Default to private (`pub(crate)`, non-exported). Add visibility deliberately, not reflexively.

## Refactoring as Part of the Work

Most production code accumulates scar tissue. New features get bolted onto structures that no longer fit, because each individual PR was "out of scope" for a deeper fix. That accumulated cost compounds.

The principle is Kent Beck's: make the change easy, then make the easy change. If a feature or fix is hard because the surrounding code is in the wrong shape, the right move is usually to reshape it first, then make the targeted change on top.

- If touching a piece of code reveals it is in the wrong shape for the change you need, reshape it. A workaround that preserves the diff size is usually worse than a slightly larger, structurally honest change.
- Separate refactor commits from feature commits when reasonable. A clean refactor commit (no behavior change, tests still pass) is easy to review and easy to revert. Squashing them together hides risk.
- Apply the boy scout rule within scope: leave the code you are touching cleaner than you found it. Do not extend that license to code you are not touching.
- The line between "in scope" and "out of scope" is whether the change you are making would be materially worse without the refactor. If yes, refactor. If you are reshaping code only because it offends you, save it for another PR.
- If a refactor is too big to land alongside the feature, land the refactor first as its own change, then come back. Do not bolt the feature on and promise to clean up later. The cleanup rarely happens.

## Tests

- Tests are first-class code. Same standards: clear names, small scope, no duplication.
- F.I.R.S.T.: Fast, Independent, Repeatable, Self-validating, Timely.
- Cover behavior, not implementation. Tests that break on any refactor are noise.
- Property-based testing for code with rich input domains (parsers, codecs, math, anything with invariants):
  - Rust: `proptest` is the most popular and has the best shrinking. `quickcheck` is simpler and faster but per-type only. `arbtest` and `arbitrary` are useful when you also want fuzzing integration with a single generator.
  - TypeScript: `fast-check`.
- Snapshot tests where appropriate (rendered output, serialized formats), but review snapshots like real assertions, not rubber-stamp them.
- Integration tests at module boundaries, unit tests inside. Most value lives in the boundary tests; most volume should live in unit tests.
- TDD is one approach, not the only one. Write tests first when you understand the spec; write code first when exploring. Either way, ship them together.
- Concurrency tests deserve special tools: `loom` for Rust permutation testing, deterministic schedulers, fuzzing. Stress tests catch what unit tests cannot.

## Modules, Types, and Composition

The original *Clean Code* SOLID-flavored guidance was Java-shaped. The principles still apply, but the expression differs.

- Single Responsibility: a module or type has one reason to change. If you describe it with "and," split it.
- Composition over inheritance is a non-issue in Rust (no inheritance to begin with). In TS, prefer composition; reach for `class extends` only with a real reason.
- Depend on abstractions. In Rust, take generic `T: Trait` or `&dyn Trait` rather than concrete types in library code. In TS, depend on interfaces, accept narrow function-shaped parameters, or use closures for injection.
- Avoid premature trait abstractions. Two implementations is the threshold; one implementation is just indirection.

## Objects vs Data

The distinction still matters and shapes good API design.

- Objects (types with invariants) hide data and expose behavior. Data structures (DTOs, plain records, config) expose data and have minimal behavior.
- Mixing the two is the smell. A struct that is sometimes a value bag and sometimes a stateful service confuses every reader.
- Law of Demeter applies to objects: avoid `a.get_b().get_c().do_something()` chains. The caller should not need to know your internal graph.
- Law of Demeter does not apply to data structures. Reaching through a config struct's fields is fine because exposing data is the point.
- In Rust, the type system makes the distinction crisp: types with private fields and `pub fn` methods are objects; types with `pub` fields are data. Decide per type and stay consistent.

## Concurrency and Parallelism

This section is rewritten from the original. The 2008 advice (quarantine concurrency, avoid threads where possible) does not match Rust's `Send`/`Sync` model or TS's async-first runtime.

- Distinguish concurrency (structuring independent work) from parallelism (running work simultaneously for speed). Different design questions, often different tools.
- Parallel-first when work is independent.
  - Rust, CPU-bound: `rayon` (`par_iter`, `join`, `scope`). Do *not* use `tokio::spawn` for CPU work; tokio assumes futures are IO-bound and poll quickly.
  - Rust, IO-bound: `tokio` with structured concurrency primitives.
  - TypeScript, IO-bound: `Promise.all` (or `Promise.allSettled` when partial failure is acceptable).
  - TypeScript, CPU-bound: worker threads or process pools. The main event loop is single-threaded.
- Use structured concurrency in async Rust. Spawned tasks should not outlive their parent scope.
  - `JoinSet` to track and await a group of tasks; dropping it cancels them.
  - `CancellationToken` (from `tokio-util`) for tree-structured cancellation propagation.
  - Avoid bare `tokio::spawn` for anything that is not a true background daemon. Orphaned tasks leak resources and lose errors.
- Make data flow through the type system. Rust enforces this via ownership and `Send`/`Sync`; lean on it rather than fighting it. In TS, prefer immutable data passed through promises and channels over shared mutable objects.
- Keep parallel decomposition at the call site, the per-item logic pure and synchronous where possible. `items.par_iter().map(process_item)` works precisely because `process_item` does not know it is being parallelized.
- Push `.await` to the edges. Async coloring (the way `async` propagates through callers) is real. Pure logic should stay sync; IO and orchestration are async.
- Know your runtime's footguns:
  - Tokio: cancellation safety (a future may be dropped at any `.await`), blocking inside async (use `spawn_blocking`), `Send` bounds across `.await`, the cost of holding `MutexGuard` across `.await`.
  - Node/TS: microtask vs macrotask ordering, unhandled promise rejections, accidental serialization of awaits in loops (`for ... await` vs `Promise.all`), event loop blocking from sync work.
- Limit shared mutable state. Where unavoidable, prefer message passing (channels, actors) over locks. Where locks are unavoidable, keep critical sections small and document the lock order.
- Test concurrent code with the right tools: `loom` for Rust permutation testing, property tests, fuzzing, deterministic test schedulers. Hope is not a strategy.

## Performance is a Quality Attribute

This was largely absent from *Clean Code* and is increasingly recognized as a gap.

- Performance is not separable from "clean." Code that takes 100x longer than it should is not clean, however readable. Data-oriented design (Mike Acton, Casey Muratori) is a useful corrective to OOP-by-default thinking.
- Measure before optimizing. Profilers do not lie; intuition often does.
  - Rust: `samply` is the modern cross-platform default (records, then opens the Firefox profiler UI). `cargo flamegraph` and raw `perf` still work, especially on Linux. `tokio-console` for runtime introspection of async tasks.
  - TypeScript/Node: `--prof` (built in), Chrome DevTools, `clinic`, `0x`.
- Sampling profilers can mislead in async Rust. They show where threads are running, not where logical async work is spending wall time waiting on IO. For async-aware timing, instrument with `tracing` spans or use tools that measure logical execution (e.g. `hotpath`). Use sampling and instrumentation together; they answer different questions.
- Algorithmic complexity dominates micro-optimization. Pick the right data structure first.
- Allocations matter, especially in hot paths. Rust gives you control; use it. In TS, watch allocation patterns in tight loops (avoid creating new arrays/objects per iteration when reuse is feasible).
- Premature optimization is real, but so is premature pessimization. Writing obviously inefficient code "because it's cleaner" is not a virtue when the inefficiency compounds.

## Code Smells

Most still hold. A few updates:

- Duplication: extract when the duplication represents the same concept, not when two pieces of code happen to look alike. The "rule of three" is a reasonable trigger.
- Dead code: delete it. Version control remembers.
- Feature envy: a function that uses another type's data more than its own probably belongs there.
- Primitive obsession: passing raw strings and numbers where domain types would do. Newtype in Rust, branded types in TS make this nearly free.
- Stringly-typed code: case-matched strings where an enum would do.
- Long parameter lists: usually a struct waiting to be born.
- Magic numbers: extract named constants.
- God modules and god functions: split by responsibility.
- Boolean blindness: a function taking three booleans is almost always wrong; use enums.
- Unjustified `any`/`unwrap()`/`expect()`: each occurrence is a bet that the code is correct without compiler help. Bets should be deliberate and survive review.

## Priorities When Rules Conflict

Resolve in this order (Kent Beck's four rules of simple design, with one addition):

1. Correct (passes tests, does what it should, including under concurrency and edge cases).
2. Reveals intent.
3. No duplication of meaningful concepts.
4. Sufficiently performant for its context.
5. Fewest moving parts (types, modules, functions).

The first two matter most. Do not collapse code into clever one-liners to satisfy rule five. Do not extract abstractions to satisfy rule three when there is no real duplication of concept.

## What This Document Is Not

- Not a substitute for reading the surrounding code before changing it.
- Not a license to refactor unrelated code while making a targeted change. But also not a reason to bolt new code onto a structure that no longer fits. Reshape the code you are touching when the change demands it; leave the rest alone.
- Not absolute. If a rule produces worse code in a specific case, note why and move on.
- Not a replacement for code review. Two readers find what one reader misses.
