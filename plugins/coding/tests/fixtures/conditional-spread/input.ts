export function buildQuery(flag: boolean, value: string): object {
  return {
    base: true,
    ...(flag ? { extra: value } : {}),
    ...(flag ? {} : { fallback: value }),
  };
}

export function noSpread(flag: boolean): object {
  return { ...(flag ? { a: 1 } : { a: 3 }) };
}
