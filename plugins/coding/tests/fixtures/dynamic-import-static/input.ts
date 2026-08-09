export async function loadStatic(): Promise<unknown> {
  return import('./module');
}

export async function loadDynamic(name: string): Promise<unknown> {
  return import(`./plugins/${name}`);
}

export type StaticType = typeof import('./other');

export function viMocked(): void {
  vi.mock('./should-not-flag', () => ({}));
}

declare const vi: { mock: (p: string, f: () => unknown) => void };
