# RST-TOOL-02: cargo nextest run Is the Canonical Test Command

**Tool Coverage:** standard-only — no tool flags `cargo test` invocations in scripts, READMEs, or CI workflows.

## Intent

`cargo nextest run` is the only sanctioned test command for this project; `cargo test` MUST NOT appear in CI scripts, Makefiles, npm-style task runners, contributor docs, or `xtask` helpers. Nextest is materially better on the dimensions that matter for a real test suite: it runs tests in **parallel by default**, isolates each test in its **own process** (so a poison-pill `static mut` or a panic in `Drop` cannot corrupt sibling tests), surfaces failures in a **structured summary** rather than buried in interleaved output, and supports the operational flags CI actually needs (`--no-fail-fast`, `--retries`, `--partition`, `--profile`, JUnit XML output via `--profile ci`).

## Fix

```bash
# ✅ GOOD: developer loop and CI both use nextest
cargo nextest run                                  # local
cargo nextest run --no-fail-fast --retries 2       # CI: see every failure, retry flakes
cargo nextest run --profile ci                     # emits JUnit XML to target/nextest/ci/
```

```yaml
# ✅ GOOD: .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: taiki-e/install-action@v2
        with:
          tool: cargo-nextest
      - run: cargo nextest run --profile ci --no-fail-fast
```

```bash
# ❌ BAD: cargo test in scripts, docs, or CI
cargo test --all                                   # serialised output, single-process, opaque failures
cargo test -- --test-threads=1                     # working around poor isolation by serialising — slower still
```

```yaml
# ❌ BAD: CI uses cargo test
jobs:
  test:
    steps:
      - run: cargo test --workspace                # no retry, no JUnit, no parallel-by-default
```

### Why Per-Test Process Isolation Matters

Under `cargo test`, every test in a binary shares one process: a `static mut` poisoned by test A leaks into test B, a panic in a `Drop` impl can abort the whole binary, and a deadlock takes the entire test set down. Nextest spawns one process per test (by default), so the blast radius of any failure is exactly one test. This makes flaky-test detection and parallel scaling tractable.

### CI Install via `taiki-e/install-action`

`taiki-e/install-action` ships a pre-built `cargo-nextest` binary instead of running `cargo install cargo-nextest`, which would rebuild from source on every CI run. The cold-start time drops from minutes to seconds.

## Edge Cases

- Doc-tests: nextest does not yet run `--doc` tests; pair with `cargo test --doc` *only* for doctests, and document this exception explicitly in the test step. The ban applies to unit/integration tests.
- Benchmarks: `cargo bench` (or `cargo nextest run --profile bench` with a benchmark harness) is out of scope here — this rule governs the `#[test]` surface.
- Filtering by name: `cargo nextest run my_module::tests::` — nextest accepts the same path filters as cargo test, plus richer patterns via `--filter-expr`.
- Single-threaded subsuites: when a test genuinely needs sequential execution (e.g., a shared sqlite file), mark them in a nextest profile with `test-threads = 1`, not by abandoning nextest for that suite.

## Related

RST-TOOL-01, RST-TOOL-03, RST-TOOL-04, RST-CORE-04
