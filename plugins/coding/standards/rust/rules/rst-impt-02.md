# RST-IMPT-02: Import Group Ordering

**Tool Coverage:** rustfmt (with `group_imports = "StdExternalCrate"` and `imports_granularity = "Crate"` — enforced mechanically).

## Intent

`use` declarations are organised into three blocks separated by a single blank line: **standard library** → **external crates** → **crate-local**. Within each block, rustfmt sorts alphabetically. The blank-line separation makes the dependency surface readable at a glance — readers can see at the import block whether a module reaches outside its crate and where its third-party surface lives. Rustfmt enforces the ordering and blank lines mechanically when configured with `group_imports = "StdExternalCrate"`; reviewers MUST NOT re-litigate the ordering.

## Fix

```rust
// ✅ GOOD: three blocks, blank line between each, alphabetical within
use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use serde::Serialize;
use tokio::task::JoinSet;

use crate::auth::User;
use crate::services::billing::charge;
```

```rust
// ❌ BAD: groups not separated, ordering mixed
use anyhow::Result;
use crate::auth::User;
use std::collections::HashMap;
use serde::Serialize;
use std::path::Path;
use crate::services::billing::charge;
use tokio::task::JoinSet;
```

### Group Definitions

1. **Standard library** — `std::`, `core::`, `alloc::`.
2. **External crates** — anything from `Cargo.toml` `[dependencies]` (`anyhow`, `serde`, `tokio`, …).
3. **Crate-local** — `crate::`, `super::`, `self::`.

Configure `rustfmt.toml` at the repository root with:

```toml
group_imports = "StdExternalCrate"
imports_granularity = "Crate"
```

This ensures the three-block layout AND that all `use crate::a::b;` / `use crate::a::c;` collapse to `use crate::a::{b, c};` automatically.

## Edge Cases

- `extern crate` declarations (rarely needed in edition 2024) belong above all `use` blocks and are separated by a blank line.
- `#[macro_use]` attributes attached to imports do not change grouping — the import still lives in its natural group.
- Conditional imports (`#[cfg(test)] use ...`) stay in their group; the `cfg` attribute does not move them to a separate block.

## Related

RST-IMPT-01, RST-IMPT-03, RST-TOOL-01
