# NAM-FUNC-02: Async Clarity

## Intent

Async behavior must be obvious from naming: promise-returning I/O work should use explicit operation verbs (`fetch`, `load`, `save`, `set`, etc.) and must not masquerade as pure local computation. Avoid names that hide latency or side effects.

## Fix

```typescript
// async behavior obvious from naming
async function fetchOrderHistory(customerId: string): Promise<Order[]> {
  return orderApi.getHistory(customerId);
}
async function loadConfiguration(): Promise<AppConfig> {
  return configStore.read();
}
```

### Sync vs Async Distinguished by Verb Choice

```typescript
function getUserName(user: User): string { return user.name; }        // sync, pure
async function fetchUserProfile(userId: string): Promise<UserProfile> { // async, I/O
  return apiClient.get(`/users/${userId}`);
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `function user(){return fetch()}`, refactor before adding new behavior.
- `get*` is acceptable for sync or cached retrieval; `fetch*`/`load*`/`save*` signal I/O-bound async work.

## Related

NAM-FUNC-01, NAM-FUNC-03, NAM-FUNC-04
