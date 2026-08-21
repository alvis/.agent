import { once } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";

const servePath = fileURLToPath(new URL("./serve.ts", import.meta.url));

interface RunningServer {
  readonly child: ChildProcessWithoutNullStreams;
  readonly port: number;
}

async function startServer(): Promise<RunningServer> {
  const child = spawn("bun", [servePath], { stdio: "pipe" });
  let output = "";

  return await new Promise<RunningServer>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("serve.ts did not publish a port handshake"));
    }, 5_000);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/SERVING_PORT:(\d+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve({ child, port: Number(match[1]) });
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (code !== null || signal !== null) return;
      clearTimeout(timer);
      reject(new Error("serve.ts exited before publishing a port"));
    });
  });
}

async function stopServer(server: RunningServer): Promise<void> {
  if (server.child.exitCode !== null || server.child.signalCode !== null)
    return;
  server.child.kill("SIGTERM");
  await once(server.child, "exit");
}

describe("audit script file server", () => {
  let server: RunningServer | undefined;

  afterEach(async () => {
    if (server) await stopServer(server);
    server = undefined;
  });

  it("publishes an ephemeral localhost port and serves the script root", async () => {
    server = await startServer();

    expect(server.port).toBeGreaterThanOrEqual(49_152);
    expect(server.port).toBeLessThanOrEqual(65_535);

    const response = await fetch(`http://127.0.0.1:${server.port}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("serves opaque script bytes for GET and preserves metadata for HEAD", async () => {
    server = await startServer();
    const url = `http://127.0.0.1:${server.port}/serve.ts`;

    const get = await fetch(url);
    const head = await fetch(url, { method: "HEAD" });

    expect(get.status).toBe(200);
    expect(Number(get.headers.get("content-length"))).toBeGreaterThan(0);
    expect(get.headers.get("content-type")).toContain("javascript");
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe(
      get.headers.get("content-length"),
    );
    expect((await head.arrayBuffer()).byteLength).toBe(0);
  });

  it("rejects unsupported methods, missing files, and traversal paths", async () => {
    server = await startServer();
    const root = `http://127.0.0.1:${server.port}`;

    const unsupported = await fetch(`${root}/serve.ts`, { method: "POST" });
    const missing = await fetch(`${root}/missing.ts`);
    const traversal = await fetch(`${root}/..%2f..%2fAGENTS.md`);

    expect(unsupported.status).toBe(501);
    expect(missing.status).toBe(404);
    expect(traversal.status).toBe(404);
  });

  it("keeps separate server processes isolated and terminates on signal", async () => {
    const first = await startServer();
    const second = await startServer();
    server = second;

    expect(second.port).not.toBe(first.port);
    await stopServer(first);
    await expect(fetch(`http://127.0.0.1:${first.port}/`)).rejects.toThrow();

    const response = await fetch(`http://127.0.0.1:${second.port}/`);
    expect(response.status).toBe(200);
  });
});
