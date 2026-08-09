# GEN-SCAL-02: Avoid Predictable Bottlenecks

## Intent

Choose data structures and boundaries that avoid predictable bottlenecks. Write code that accommodates growth by using appropriate data structures and extensible patterns.

## Fix

```typescript
// ❌ BAD: linear scan in hot path
const user = users.find((u) => u.id === id); // O(n) on every lookup

// ✅ GOOD: indexed lookup
const usersById = new Map(users.map((u) => [u.id, u]));
const user = usersById.get(id); // O(1) lookup
```

## Extensible Design With Strategy Pattern

```typescript
// ✅ GOOD: scalable design accommodating growth
interface PaymentProcessor {
  process(amount: number): Promise<PaymentResult>;
}

class PaymentService {
  #processors = new Map<string, PaymentProcessor>();

  registerProcessor(name: string, processor: PaymentProcessor): void {
    this.#processors.set(name, processor);
  }

  async processPayment(method: string, amount: number): Promise<PaymentResult> {
    const processor = this.#processors.get(method);
    if (!processor) throw new Error(`Payment method ${method} not supported`);
    return processor.process(amount);
  }
}
```

## Systems Thinking

Approach problems systemically -- model the system and its interactions before coding:

```typescript
// ✅ GOOD: think in systems and models
interface CacheStrategy {
  get(key: string): Promise<Value | null>;
  set(key: string, value: Value, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// Model the system: Cache -> Repository -> Database
// Reason about: What if cache fails? What if DB is slow?
// Optimize for: Long-term sustainability, not quick fixes
```

- Map systems and their interactions before coding
- Consider long-term consequences, not just immediate fixes
- Reason quantitatively where appropriate (complexity, performance)

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `users.find((u)=>u.id===id)` on hundreds+ entries, refactor before adding new behavior.
- Choosing Map/Set over linear scans is not premature optimization; it's appropriate data structure selection.

## Related

GEN-SCAL-01, GEN-SCAL-03, GEN-CONS-01
