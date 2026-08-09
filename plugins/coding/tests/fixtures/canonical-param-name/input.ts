// violation: `payload` is a non-semantic placeholder
export function sendEvent(payload: EventBody): void {
  void payload;
}

// violation: `cfg` placeholder instead of the canonical `config`
export function initialize(cfg: AppConfig): void {
  void cfg;
}

// compliant: canonical parameter names
export function createUser(data: CreateUserData): void {
  void data;
}

export function formatName(name: string, options: FormatOptions): void {
  void name;
  void options;
}

interface EventBody { type: string; }
interface AppConfig { host: string; }
interface CreateUserData { name: string; }
interface FormatOptions { locale?: string; }
