// This comment references DOC-FORM-03 which should be flagged.
export function annotated(): void {}

/* Block comment mentioning TST-STRU-01 inside it. */
export function blockNote(): void {}

/**
 * JSDoc continuation referencing FUNC-ARCH-01 here.
 */
export function jsdocNote(): void {}

// CSS-MODE-01 is a real prefix after the Step 7 fix.
// WT-CORE-01 is also a real prefix after the Step 7 fix.
// PY-OLD-01 is a phantom prefix and must not match after the fix.
export function modes(): void {}
