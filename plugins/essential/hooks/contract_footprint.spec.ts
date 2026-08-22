import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPlugin } from "../../../scripts/contract_footprint.ts";
const plugin = resolve(fileURLToPath(new URL("..", import.meta.url)));
it("should keep the essential contract footprint within budget", () => expect(checkPlugin(plugin, ["hooks/ALLAGENT.md", "hooks/MAINAGENT.md", "hooks/SUBAGENT.md"], ["hooks/ALLAGENT.md", "references/working-attitude.md"])).toEqual([]));
