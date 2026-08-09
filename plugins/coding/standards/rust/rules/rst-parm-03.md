# RST-PARM-03: Max Five Parameters, Then Bundle

**Tool Coverage:** clippy:too_many_arguments (the lint itself is explicitly **allowed** by `RST-CORE-04`'s curated list because its 7-arg default threshold would double-fire; this rule supersedes it with a stricter 5-arg ceiling enforced in review).

## Intent

A function signature may carry at most **five parameters** (excluding `self` / `cls`). Beyond that, bundle related arguments into a `*Request` / `*Config` struct; when many fields are optional, expose a builder. Long signatures wreck call-site readability, make test setup tedious, and turn every new option into a positional-reshuffling breaking change. A request struct gives names, defaults via `Default`, validation hooks at `build()`, and immutability. Note: `clippy::too_many_arguments` is on the curated **allow** list precisely because its threshold (7) differs from ours (5) and would double-fire alongside this rule — reviewer judgement is the canonical enforcement.

## Fix

```rust
// ✅ GOOD: a request struct + builder once the signature grows
use std::time::Duration;

pub struct DeployRequest {
    service: String,
    version: String,
    environment: Environment,
    dry_run: bool,
    verbose: bool,
    max_retries: u32,
    timeout: Duration,
}

#[derive(Default)]
pub struct DeployRequestBuilder {
    service: Option<String>,
    version: Option<String>,
    environment: Option<Environment>,
    dry_run: bool,
    verbose: bool,
    max_retries: Option<u32>,
    timeout: Option<Duration>,
}

impl DeployRequestBuilder {
    pub fn service(&mut self, s: impl Into<String>) -> &mut Self {
        self.service = Some(s.into());
        self
    }

    pub fn version(&mut self, v: impl Into<String>) -> &mut Self {
        self.version = Some(v.into());
        self
    }

    pub fn environment(&mut self, env: Environment) -> &mut Self {
        self.environment = Some(env);
        self
    }

    pub fn dry_run(&mut self, on: bool) -> &mut Self {
        self.dry_run = on;
        self
    }

    pub fn build(self) -> Result<DeployRequest, BuildError> {
        Ok(DeployRequest {
            service: self.service.ok_or(BuildError::MissingField("service"))?,
            version: self.version.ok_or(BuildError::MissingField("version"))?,
            environment: self.environment.ok_or(BuildError::MissingField("environment"))?,
            dry_run: self.dry_run,
            verbose: self.verbose,
            max_retries: self.max_retries.unwrap_or(3),
            timeout: self.timeout.unwrap_or(Duration::from_secs(30)),
        })
    }
}

pub fn deploy(request: DeployRequest) -> Result<DeployResult, DeployError> {
    // ...
    Ok(DeployResult::default())
}

// caller
let req = DeployRequestBuilder::default()
    .service("billing")
    .version("2.3.1")
    .environment(Environment::Staging)
    .dry_run(true)
    .build()?;
deploy(req)?;
```

```rust
// ❌ BAD: seven-parameter signature — every new option shifts positions
use std::time::Duration;

pub fn deploy(
    service: &str,
    version: &str,
    environment: Environment,
    dry_run: bool,
    verbose: bool,
    max_retries: u32,
    timeout: Duration,
) -> Result<DeployResult, DeployError> {
    // ...
    Ok(DeployResult::default())
}
```

### `typed_builder` Shorthand

For straightforward cases, `#[derive(typed_builder::TypedBuilder)]` produces an equivalent compile-time-checked builder without the hand-written boilerplate:

```rust
use typed_builder::TypedBuilder;

#[derive(TypedBuilder)]
pub struct DeployRequest {
    #[builder(setter(into))] service: String,
    #[builder(setter(into))] version: String,
    environment: Environment,
    #[builder(default)] dry_run: bool,
    #[builder(default)] verbose: bool,
    #[builder(default = 3)] max_retries: u32,
    #[builder(default = std::time::Duration::from_secs(30))] timeout: std::time::Duration,
}
```

## Edge Cases

- Methods count `&self` / `&mut self` / `self` as parameter zero; the five-parameter budget applies to the remaining arguments.
- Closely related parameters (`host`, `port`, `username`, `password` → `ConnectionConfig`) often want bundling well before hitting five — use judgement.
- A `*Request` with mostly required fields and no defaults does not need a builder; expose a plain `pub struct` with public fields, since the call site reads identically.

## Related

RST-PARM-01, RST-PARM-04, RST-TYPE-01, RST-CORE-04
