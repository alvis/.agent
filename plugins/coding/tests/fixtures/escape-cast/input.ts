export function parseConfig(raw: unknown): Config {
  // violation: double-cast silently discards type information
  const config = raw as unknown as Config;
  return config;
}

export function clearValue(): void {
  // violation: forbidden narrowing escape hatch below
  const empty = currentValue as never;
  void empty;
}

export function safeParse(raw: unknown): Config {
  // compliant: validated narrowing instead of an escape cast
  if (!isConfig(raw)) throw new Error("invalid config");
  return raw;
}

declare const currentValue: string;
declare function isConfig(value: unknown): value is Config;
interface Config {
  host: string;
}
