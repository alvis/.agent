export function loadSettings(): void {
  try {
    riskyOperation();
  } catch (error) {
    // violation: silent swallow — the error is dropped
    return;
  }
}

export function loadSettingsHandled(): void {
  try {
    riskyOperation();
  } catch (error) {
    // compliant: rethrow a domain error instead of swallowing
    throw new Error("failed to load settings", { cause: error as Error });
  }
}

declare function riskyOperation(): void;
