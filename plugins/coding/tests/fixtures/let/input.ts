export function counters(): number {
  let total = 0;
  let count = 1; // eslint-disable-line prefer-const
  const fixed = 5;
  for (let i = 0; i < 3; i += 1) {
    total += i;
  }
  return total + count + fixed;
}
