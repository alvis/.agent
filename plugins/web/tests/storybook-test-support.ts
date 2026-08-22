import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function createStorybookCommandEnvironment(
  root: string,
): Promise<NodeJS.ProcessEnv> {
  const bin = join(root, "bin");
  await mkdir(bin, { recursive: true });

  const agentBrowser = join(bin, "agent-browser");
  await writeFile(
    agentBrowser,
    `#!/bin/sh
set -eu
printf '%s\\n' "$0 $*" >> "${join(root, "commands.log")}"
payload="$(/bin/cat)"
case "$payload" in
  *matches_focus_visible*) printf '%s\\n' '[{"result":{"matches_focus_visible":true}}]' ;;
  *available*) printf '%s\\n' '[{"result":{"available":false}}]' ;;
  *STORY_RENDERED*) printf '%s\\n' '[{"result":true}]' ;;
  *) printf '%s\\n' '[{"result":true}]' ;;
esac
`,
  );
  await chmod(agentBrowser, 0o755);

  const curl = join(bin, "curl");
  await writeFile(curl, "#!/bin/sh\nexit 1\n");
  await chmod(curl, 0o755);

  return {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    TMPDIR: root,
  };
}
