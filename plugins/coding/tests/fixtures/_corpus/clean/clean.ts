// a file with no `let` at all — exercises the "(no matches)" render path.
export function pure(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}
