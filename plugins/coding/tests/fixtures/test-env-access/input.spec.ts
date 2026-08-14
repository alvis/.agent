process.env.API_URL = "https://api.test";
process['env'].TOKEN = "token";
process["env"].DEBUG = "1";
globalThis.fetch = fakeFetch;
vi.stubEnv("MODE", "test");
vi.stubGlobal("fetch", fakeFetch);
