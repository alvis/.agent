# FUNC-ARCH-03: Avoid No-Value Wrappers

## Intent

Do not create pass-through wrappers that add no policy, boundary validation,
supported-failure mapping, or transformation. Validation of a trusted producer
postcondition and remapping of its impossible violation are not value. This is
the function-design application of `GEN-DESN-03`, with trust-boundary and
producer-postcondition decisions owned by `GEN-SAFE-03`.

## Fix

```typescript
function getUserOrThrow(id: string): Promise<User> {
  return userRepository.findById(id).then((user) => {
    if (!user) throw new MissingDataError("user not found");
    return user;
  });
}
```

### Acceptable Wrappers Add Value

A wrapper is justified only when it adds boundary validation, maps a supported
failure into the public contract, caches, records required telemetry, or
transforms data:

```typescript
// ✅ wrapper adds null-to-throw policy
function findUser(id: string): User | null {
  return userRepository.findById(id) ?? null;
}

// ✅ wrapper adds consistent return type normalization
function findUsers(ids: string[]): Promise<User[]> {
  return userRepository.findByIds(ids).then((users) => users ?? []);
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `return service.run(data)`, refactor before adding new behavior.
- Boundary validation follows `GEN-SAFE-03`; rechecking a closed first-party
  producer postcondition does not justify a wrapper.
- Error mapping counts only for a failure the wrapped contract supports, not an
  impossible programmer defect invented by the wrapper.

## Related

GEN-DESN-03, GEN-DESN-04, GEN-SAFE-03, FUNC-ARCH-01, FUNC-ARCH-02
