# FUNC-ARCH-04: Parent–Child Class Boundary

## Intent

Never inject the parent class into a child as a dependency. If the child needs *private* parent state, expose it through a parent factory method that closes over the needed values and passes them as a normal capability contract. If the child needs only the parent's *public* surface, write a module-level standalone helper that takes the parent instance as its first argument. Never use `extends Parent` purely as a vehicle for sharing private helpers — inheritance is a "this class IS-A that class" declaration, not a code-reuse shortcut.

## Fix

### Factory Pattern — for private parent state

```typescript
// ✅ GOOD: parent exposes a public factory; child receives capability functions,
// not the parent itself. Public factory appears above any #private helper it calls (TYP-MODL-02).
class ContextEngine {
  createPacketBuilder(): ContextPacketBuilder {
    return new ContextPacketBuilder({
      createContextReceipt: (packet) => this.#createContextReceipt(packet),
      recordProvenanceEvent: (event) => this.#recordProvenanceEvent(event),
    });
  }

  #createContextReceipt(packet: ContextPacket): ContextReceipt {
    /* … uses private parent state … */
  }

  #recordProvenanceEvent(event: ProvenanceEvent): void {
    /* … uses private parent state … */
  }
}
```

### Standalone Helper — for public parent surface

```typescript
// ✅ GOOD: module-level helper takes the parent positionally; uses only public surface.
export function resolveOptions<T>(
  parent: Operator<T>,
  executorOptions?: ExecutorOptions<T>,
): ResolvedConfig<T> {
  // uses parent.profiles, parent.models — public only
  return {
    profile: parent.profiles[executorOptions?.profile ?? "default"],
    model: parent.models[executorOptions?.model ?? "default"],
  };
}

class ChildOperator<T> extends Operator<T> {
  run(opts?: ExecutorOptions<T>): Result<T> {
    const cfg = resolveOptions(this, opts);
    /* … */
  }
}
```

### Anti-Pattern — Parent Injection

```typescript
// ❌ BAD: passing `parent: this` smuggles private state across the boundary
// and creates a circular ownership graph.
class ContextEngine {
  createPacketBuilder(): ContextPacketBuilder {
    return new ContextPacketBuilder({ parent: this });
  }
}

// ❌ BAD: typing the back-reference into the child's params
type ChildParams = Readonly<{ parent: Parent }>;
```

### Anti-Pattern — Inheritance for Shared Logic

```typescript
// ❌ BAD: `extends` used purely to inherit private helpers,
// not because ContextPacketBuilder IS-A ContextEngine.
class ContextPacketBuilder extends ContextEngine {
  build(): ContextPacket {
    /* … calls inherited #helpers … */
  }
}
```

### When to choose Factory vs Standalone Helper

| Child needs… | Pattern | Why |
|---|---|---|
| Private parent state (`#field`, private method results) | Factory method on parent | Parent closes over the private values and exposes them as capability functions — child never sees the parent. |
| Only the parent's public surface (public fields / methods) | Standalone module-level helper taking parent as first arg | No new class wiring; the helper is just a function over a public type. |

## Edge Cases

- **Circular `Parent ↔ Child` types** — when child params reference the parent type and the parent's factory returns the child, use forward declarations (`type Parent = …; type Child = …`) or interface separation; do NOT collapse the cycle by inlining `parent: this`.
- **Generics across the factory boundary** — propagate the parent's generic parameters through the capability function signatures (`createX: (input: Input<T>) => Output<T>`), not by leaking the parent type into the child's contract.
- **Legitimate aggregate-root cases** — when the child genuinely *owns* a parent reference (e.g. a DOM-style "this node belongs to that document" relationship), document the ownership inline in a code comment explaining why parent injection is structural, not accidental.

## Related

FUNC-ARCH-01, FUNC-ARCH-03, FUNC-SIGN-07, TYP-PARM-04, TYP-MODL-02, TYP-TYPE-03, NAM-TYPE-03
