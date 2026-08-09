# RST-OWNS-03: No `Rc<RefCell<T>>` Where `&mut` or Message Passing Fits

**Tool Coverage:** standard-only

## Intent

`Rc<RefCell<T>>` (and its threaded sibling `Arc<Mutex<T>>`) move ownership and aliasing checks from compile time to runtime — a `RefCell` borrow that violates exclusivity panics at runtime; a `Mutex` lock that races deadlocks instead of failing to compile. They are the right tool when shared mutable state genuinely cannot be expressed with the borrow checker (e.g. cyclic graphs, observer patterns crossing arbitrary call depth). They are the wrong tool — and a code smell — when reached for to avoid restructuring ownership: passing `&mut T` through a few functions, splitting a struct into independently-owned fields, or routing mutation through a channel. The Rust default is "the borrow checker is the design"; falling through to `Rc<RefCell<T>>` should be a documented, audited choice.

## Fix

```rust
// ✅ GOOD: explicit &mut ownership — compiler enforces exclusivity statically
pub struct Counter {
    value: u64,
}

impl Counter {
    pub fn increment(&mut self) {
        self.value += 1;
    }
}

pub fn run(counter: &mut Counter, n: u64) {
    for _ in 0..n {
        counter.increment();
    }
}

// ✅ GOOD: message passing for cross-task mutation — the actor owns the state
use tokio::sync::mpsc;

pub enum CounterMsg {
    Increment,
    Read { reply: tokio::sync::oneshot::Sender<u64> },
}

pub async fn counter_actor(mut rx: mpsc::Receiver<CounterMsg>) {
    let mut state = Counter { value: 0 };
    while let Some(msg) = rx.recv().await {
        match msg {
            CounterMsg::Increment => state.increment(),
            CounterMsg::Read { reply } => {
                let _ = reply.send(state.value);
            }
        }
    }
}
```

```rust
// ❌ BAD: Rc<RefCell<T>> threaded through every function to avoid
// passing &mut Counter
use std::cell::RefCell;
use std::rc::Rc;

pub struct Counter {
    value: u64,
}

pub fn run(counter: Rc<RefCell<Counter>>, n: u64) {
    for _ in 0..n {
        counter.borrow_mut().value += 1;   // runtime borrow check; panics
                                           // if any caller holds a borrow
    }
}

// ❌ BAD: Arc<Mutex<T>> for cross-task mutation when an actor would do.
// Every reader contends on the same lock; deadlocks are now possible.
use std::sync::{Arc, Mutex};
pub async fn run_shared(counter: Arc<Mutex<Counter>>, n: u64) {
    for _ in 0..n {
        counter.lock().unwrap().value += 1;
    }
}
```

### How to Tell If You Actually Need Shared Mutability

Apply these checks in order; if any one resolves the design, stop:

1. **Can `&mut T` thread through the call graph?** Restructure the API to take `&mut self` (or `&mut T`). Compile-time exclusivity is free.
2. **Can the state be split** so each owner holds a disjoint slice? Two `&mut` borrows of different fields are legal — see `slice::split_at_mut` or struct-field destructuring.
3. **Can the state live in an actor** that owns it and exposes a message API (`mpsc::Sender<Msg>`)? Each task owns its own state; only the channel is shared.
4. **Is the state a cyclic graph or observer registry** where ownership genuinely doesn't form a tree? Now `Rc<RefCell<T>>` (single-threaded) or `Arc<Mutex<T>>` (cross-thread) is the right tool — document the choice with a `// reason:` per RST-CORE-03 and keep the shared region as small as possible.

## Edge Cases

- **Single-threaded UI / event loops**: long-lived graphs of interconnected widgets often genuinely need `Rc<RefCell<T>>`. The rule does not forbid it — it forbids reaching for it as the first move. Document why restructuring is unworkable.
- **`Arc<RwLock<T>>` for read-heavy shared state** is preferable to `Arc<Mutex<T>>` when readers vastly outnumber writers — but the actor pattern still scales better and avoids contention entirely.
- **Interior mutability without sharing**: `Cell<T>` / `RefCell<T>` inside a non-`Rc`'d struct is sometimes correct (e.g. memoisation caches behind an `&self` method). The prohibition is on the *combination* `Rc<RefCell<T>>` used as a shared-mutable handle, not on `RefCell<T>` alone.
- **`Mutex` poisoning**: if you end up with `Arc<Mutex<T>>` anyway, prefer `parking_lot::Mutex` (no poisoning) for predictability — and still document the choice.
- **Test doubles**: shared `Rc<RefCell<Vec<Recorded>>>` in test code is fine; production paths still hold the line.

## Related

RST-OWNS-01, RST-OWNS-02, RST-OWNS-04, RST-ASYNC-02, RST-ASYNC-03
